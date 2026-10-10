<?php
// ── CRÍTICO: Suprimir errores PHP ANTES de cualquier output ─────
// Evita que warnings/notices contaminen la respuesta JSON
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(0);

// Marcar que esto es una petición de API para que config.php
// NO envíe el header Content-Type: text/html (las APIs lo envían ellas mismas)
if (!defined('WH_API_REQUEST')) {
    define('WH_API_REQUEST', true);
}

if (!defined('WH_LOADED')) {
    require_once dirname(__DIR__) . '/includes/config.php';
}
require_once dirname(__DIR__) . '/includes/db.php';
require_once dirname(__DIR__) . '/includes/functions.php';
require_once dirname(__DIR__) . '/includes/auth.php';
require_once dirname(__DIR__) . '/includes/notifications.php';
require_once dirname(__DIR__) . '/includes/accesorios.php';
require_once dirname(__DIR__) . '/includes/security.php';

// ── CORS ──────────────────────────────────────────────────────────
$allowedOrigins = array_filter(array_map('trim', explode(',',
    env('CORS_ALLOWED_ORIGINS', APP_URL)
)));

$appUrlBase = rtrim(env('APP_URL', ''), '/');
if ($appUrlBase) {
    $parsed = parse_url($appUrlBase);
    $scheme = $parsed['scheme'] ?? 'https';
    $host   = $parsed['host']   ?? '';
    $hostSinWww = preg_replace('/^www\./', '', $host);
    $allowedOrigins[] = $scheme . '://' . $hostSinWww;
    $allowedOrigins[] = $scheme . '://www.' . $hostSinWww;
    if (!empty($parsed['port'])) {
        $allowedOrigins[] = $scheme . '://' . $host . ':' . $parsed['port'];
    }
}
$allowedOrigins = array_unique(array_filter($allowedOrigins));

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Vary: Origin');
} elseif (!$origin) {
    // Petición sin origen (curl, Postman, PHP interno) — permitir siempre
    header('Access-Control-Allow-Origin: ' . ($appUrlBase ?: '*'));
} else {
    // Origen desconocido — denegar silenciosamente (sin header Allow-Origin)
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token');
header('Access-Control-Max-Age: 86400');

// Preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Defensa temprana (antes de cualquier lógica de negocio) ───────
limitarTamanoCuerpo(512);          // rechaza bodies > 512 KB
inicializarHuellaSesion();         // sella la sesión con IP+UA en primera visita
if (!verificarHuellaSesion()) {    // detecta cookie robada desde otro origen
    session_regenerate_id(true);
    $_SESSION = [];
    jsonError('Sesión inválida. Por favor inicia sesión nuevamente.', 401);
}
// Revocación: invalida sesiones cuya cookie sea anterior al último logout
verificarSesionPersonalRevocada();
verificarSesionClienteRevocada();

// ── Manejador global de excepciones ───────────────────────────────
set_exception_handler(function(Throwable $e): void {
    http_response_code(500);
    $logLine = sprintf('[%s] EXCEPTION %s: %s in %s:%d',
        date('Y-m-d H:i:s'), get_class($e), $e->getMessage(), $e->getFile(), $e->getLine()
    );
    $logDir = dirname(__DIR__) . '/logs';
    @file_put_contents($logDir . '/api_errors.log', $logLine . PHP_EOL, FILE_APPEND | LOCK_EX);
    error_log($logLine);

    $msg = (defined('APP_DEBUG') && APP_DEBUG)
        ? $e->getMessage() . ' in ' . basename($e->getFile()) . ':' . $e->getLine()
        : 'Error interno del servidor. Intenta de nuevo más tarde.';
    echo json_encode(['success' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
});

// ── Content-Type ──────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');

// ── Headers de seguridad HTTP ─────────────────────────────────────
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('X-XSS-Protection: 1; mode=block');
header_remove('X-Powered-By');
header_remove('Server');
header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// ── Rate limiting simple por IP ───────────────────────────────────
function checkRateLimit(string $key, int $maxRequests = 60, int $windowSec = 60): void {
    $ip      = clienteIp();
    $file    = sys_get_temp_dir() . '/wh_rl_' . md5($key . $ip) . '.json';
    $now     = time();
    $data    = file_exists($file) ? json_decode(file_get_contents($file), true) : [];

    $data = array_filter($data ?? [], fn($t) => ($now - $t) < $windowSec);

    if (count($data) >= $maxRequests) {
        http_response_code(429);
        echo json_encode(['success' => false, 'error' => 'Demasiadas solicitudes. Intenta en un momento.']);
        exit;
    }

    $data[] = $now;
    file_put_contents($file, json_encode(array_values($data)), LOCK_EX);
}

// ── CSRF: validar token en peticiones que cambian datos ───────────
// Llamar explícitamente en cada acción POST/PUT/DELETE de cada endpoint.
// NO usar en los webhooks de Stripe/PayPal: esos llegan directo desde sus
// servidores sin sesión de navegador y se autentican por firma, no por token.
function requerirCsrf(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!verificarCsrfToken($token)) {
        jsonError('Token de seguridad inválido o ausente. Recarga la página e intenta de nuevo.', 403);
    }
}

// ── Honeypot anti-spam ────────────────────────────────────────────
function checkHoneypot(array $body): void {
    if (!empty($body['_hp']) || !empty($body['website']) || !empty($body['url'])) {
        jsonError('Error de validación', 422);
    }
}

// Aplica un pago ya aprobado (Stripe/PayPal/manual) al pedido: suma a
// monto_pagado y mueve el estado a anticipo_pagado/pagado. Compartida por
// api/pagos.php y api/pedidos.php (pedido manual con pago recibido).
function registrarPagoAprobado(int $pedidoId, float $montoPago): void {
    $pedido = dbRow("SELECT total, monto_pagado, estado, tipo_pago FROM pedidos WHERE id = ?", [$pedidoId]);
    if (!$pedido) return;

    $estadoPrevio      = $pedido['estado'];
    $montoPagadoPrevio = (float)$pedido['monto_pagado'];
    $total             = (float)$pedido['total'];
    $nuevoMontoPagado  = round($montoPagadoPrevio + $montoPago, 2);
    $liquidado         = $nuevoMontoPagado >= ($total - 0.01);
    // Es liquidación de saldo (no el primer pago) si ya había algo pagado antes.
    $esLiquidacionSaldo = $liquidado && $montoPagadoPrevio > 0.009;

    $datosUpdate = ['monto_pagado' => $nuevoMontoPagado];
    $estadosFasePago = ['pendiente', 'anticipo_pagado', 'pagado'];
    if (in_array($estadoPrevio, $estadosFasePago, true)) {
        $datosUpdate['estado'] = $liquidado ? 'pagado' : 'anticipo_pagado';
    }
    dbUpdate('pedidos', $datosUpdate, 'id = ?', [$pedidoId]);

    if ($esLiquidacionSaldo) {
        try {
            $pedidoActualizado = dbRow("SELECT * FROM pedidos WHERE id = ?", [$pedidoId]);
            if ($pedidoActualizado) {
                // Para el correo: indica que el saldo quedó liquidado, sin alterar
                // el estado real de fulfillment ya guardado en la base de datos.
                $pedidoActualizado['estado'] = 'pagado';
                notificarCambioPedido($pedidoActualizado, 'anticipo_pagado');
            }
        } catch (Exception $e) {
            appLog('warning', 'Notif saldo liquidado error', ['error' => $e->getMessage()]);
        }
    }
}

// pagos.registrado_por (migración 2026-10): quién del personal registró un
// pago manual. Se consulta una vez por petición por si la columna aún no existe.
function pagosTieneRegistradoPor(): bool {
    static $tiene = null;
    if ($tiene === null) {
        try { dbRows("SELECT registrado_por FROM pagos LIMIT 0"); $tiene = true; } catch (\Throwable $e) { $tiene = false; }
    }
    return $tiene;
}
