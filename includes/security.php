<?php
// includes/security.php — Capa de defensa centralizada
// Cargado por api/_helpers.php después de db.php, functions.php y auth.php.

if (defined('WH_SECURITY_LOADED')) return;
define('WH_SECURITY_LOADED', true);

// ═══════════════════════════════════════════════════════════════════
// 1. LÍMITE DE TAMAÑO DEL CUERPO HTTP
// Rechaza peticiones sobredimensionadas antes de leer php://input.
// Protege contra DoS por payloads gigantes y denegación de memoria.
// ═══════════════════════════════════════════════════════════════════
function limitarTamanoCuerpo(int $maxKb = 512): void {
    $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > $maxKb * 1024) {
        http_response_code(413);
        echo json_encode(['success' => false, 'error' => 'Cuerpo de la petición demasiado grande.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ═══════════════════════════════════════════════════════════════════
// 2. IDOR — VERIFICACIÓN DE PROPIEDAD DE RECURSO
// Confirma que el recurso pertenece al usuario autenticado.
// Responde 403 sin revelar si el recurso existe (evita enumeración).
// ═══════════════════════════════════════════════════════════════════

/** @param string[] $tablasSoportadas lista blanca implícita */
function verificarPropiedadRecurso(
    string $tabla,
    string $campoOwner,
    int    $idRecurso,
    int    $idPropietario,
    string $campoPK = 'id'
): void {
    // Lista blanca de tablas para evitar inyección de nombre de tabla
    $permitidas = ['pedidos', 'cotizaciones', 'citas', 'clientes', 'carritos_guardados'];
    if (!in_array($tabla, $permitidas, true)) {
        jsonError('Recurso no permitido', 403);
    }
    // Columnas del owner y PK también deben estar en lista blanca
    $columnasPermitidas = ['id', 'cliente_id', 'firebase_uid'];
    if (!in_array($campoOwner, $columnasPermitidas, true) || !in_array($campoPK, $columnasPermitidas, true)) {
        jsonError('Configuración de recurso inválida', 403);
    }
    $fila = dbRow(
        "SELECT `{$campoPK}` FROM `{$tabla}` WHERE `{$campoPK}` = ? AND `{$campoOwner}` = ? LIMIT 1",
        [$idRecurso, $idPropietario]
    );
    if (!$fila) {
        jsonError('Acceso denegado al recurso solicitado', 403);
    }
}

// ═══════════════════════════════════════════════════════════════════
// 3. HUELLA DE SESIÓN (IP + User-Agent)
// Detecta robo de cookie de sesión desde otra IP/dispositivo.
// Usa sólo 3 octetos de IPv4 para tolerar CGNAT y proxies estables.
// ═══════════════════════════════════════════════════════════════════

function _calcularHuellaSesion(): string {
    // CF-Connecting-IP contiene la IP real del cliente detrás de Cloudflare.
    // REMOTE_ADDR es la IP del edge node de Cloudflare — cambia entre requests
    // desde distintos PoPs y causaría falsos positivos en la verificación de huella.
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP']
       ?? $_SERVER['HTTP_X_REAL_IP']
       ?? $_SERVER['REMOTE_ADDR']
       ?? '';
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    // Solo los primeros 2 octetos de IPv4 (/16) para tolerar CGNAT, redes móviles y VPNs
    // que cambian el tercer/cuarto octeto entre peticiones del mismo usuario.
    $ipBase = implode('.', array_slice(explode('.', $ip), 0, 2));
    $semilla = defined('APP_KEY') ? APP_KEY : 'wh-session-key-2026';
    return hash('sha256', $ipBase . '|' . $ua . '|' . $semilla);
}

function inicializarHuellaSesion(): void {
    if (empty($_SESSION['_session_fp'])) {
        $_SESSION['_session_fp'] = _calcularHuellaSesion();
    }
}

function verificarHuellaSesion(): bool {
    // Sin huella previa → primera visita, no hay nada que comparar
    if (empty($_SESSION['_session_fp'])) return true;
    // Sin sesión activa → no tiene sentido bloquear; el CSRF protege las mutaciones
    if (empty($_SESSION['usuario_id']) && empty($_SESSION['cliente_id'])) return true;
    return hash_equals($_SESSION['_session_fp'], _calcularHuellaSesion());
}

// ═══════════════════════════════════════════════════════════════════
// 4. REVOCACIÓN DE SESIONES
// Al cerrar sesión, registra la hora en BD.
// Sesiones PHP creadas ANTES de esa hora quedan inválidas en la
// próxima petición, aunque el atacante tenga la cookie.
//
// Requiere columnas (ver database/security_migration.sql):
//   usuarios_personal.sesiones_revocadas_desde  TIMESTAMP NULL
//   clientes.sesiones_revocadas_desde            TIMESTAMP NULL
// ═══════════════════════════════════════════════════════════════════

function revocarSesionesPersonal(int $usuarioId): void {
    try {
        dbQuery(
            "UPDATE usuarios_personal SET sesiones_revocadas_desde = NOW() WHERE id = ?",
            [$usuarioId]
        );
    } catch (\Throwable $e) {
        error_log('[security] revocarSesionesPersonal: ' . $e->getMessage());
    }
}

function revocarSesionesCliente(int $clienteId): void {
    try {
        dbQuery(
            "UPDATE clientes SET sesiones_revocadas_desde = NOW() WHERE id = ?",
            [$clienteId]
        );
    } catch (\Throwable $e) {
        error_log('[security] revocarSesionesCliente: ' . $e->getMessage());
    }
}

function verificarSesionPersonalRevocada(): void {
    if (empty($_SESSION['usuario_id']) || empty($_SESSION['_usuario_login_time'])) return;
    try {
        $row = dbRow(
            "SELECT sesiones_revocadas_desde FROM usuarios_personal WHERE id = ? LIMIT 1",
            [$_SESSION['usuario_id']]
        );
        if (!$row || empty($row['sesiones_revocadas_desde'])) return;
        if (strtotime($row['sesiones_revocadas_desde']) > $_SESSION['_usuario_login_time']) {
            _destruirSesionPersonal();
            jsonError('Sesión revocada. Por favor inicia sesión nuevamente.', 401);
        }
    } catch (\Throwable $e) {
        // Si la columna aún no existe (antes de migración) no bloquear
        if (str_contains($e->getMessage(), "Unknown column")) return;
        error_log('[security] verificarSesionPersonalRevocada: ' . $e->getMessage());
    }
}

function verificarSesionClienteRevocada(): void {
    if (empty($_SESSION['cliente_id']) || empty($_SESSION['_cliente_login_time'])) return;
    try {
        $row = dbRow(
            "SELECT sesiones_revocadas_desde FROM clientes WHERE id = ? LIMIT 1",
            [$_SESSION['cliente_id']]
        );
        if (!$row || empty($row['sesiones_revocadas_desde'])) return;
        if (strtotime($row['sesiones_revocadas_desde']) > $_SESSION['_cliente_login_time']) {
            _destruirSesionCliente();
            jsonError('Sesión revocada. Por favor inicia sesión nuevamente.', 401);
        }
    } catch (\Throwable $e) {
        if (str_contains($e->getMessage(), "Unknown column")) return;
        error_log('[security] verificarSesionClienteRevocada: ' . $e->getMessage());
    }
}

// ═══════════════════════════════════════════════════════════════════
// 5. REAUTENTICACIÓN PARA ACCIONES SENSIBLES
// Exige que el usuario haya enviado un Firebase ID token reciente
// (emitido en los últimos $ventanaSeg segundos) para acciones como
// cambiar correo, ver datos de pago o exportar información.
// El cliente envía el token fresco en el header Authorization: Bearer.
// ═══════════════════════════════════════════════════════════════════

function requerirReautenticacion(string $accion = 'accion_sensible', int $ventanaSeg = 300): void {
    $key = '_reauth_' . preg_replace('/[^a-z0-9_]/', '_', $accion);

    // Reautenticación reciente todavía válida
    if (!empty($_SESSION[$key]) && (time() - (int)$_SESSION[$key]) < $ventanaSeg) {
        return;
    }

    // Exigir un Bearer token fresco como prueba de identidad
    $token = getBearerToken();
    if (!$token) {
        jsonError(
            'Se requiere reautenticación para esta acción. Vuelve a iniciar sesión.',
            403,
            ['reauth_required' => true, 'accion' => $accion]
        );
    }

    $payload = verificarTokenFirebase($token);
    if (!$payload) {
        jsonError('Token de reautenticación inválido o expirado.', 403, ['reauth_required' => true]);
    }

    // El token debe haber sido emitido recientemente
    $iat = (int)($payload['iat'] ?? 0);
    if ((time() - $iat) > $ventanaSeg) {
        jsonError(
            'El token de reautenticación es demasiado antiguo. Vuelve a iniciar sesión.',
            403,
            ['reauth_required' => true]
        );
    }

    $_SESSION[$key] = time();
}

// ═══════════════════════════════════════════════════════════════════
// 6. WHITELIST DE ACCIONES EN QUERY STRING
// Previene que parámetros arbitrarios disparen lógica inesperada.
// ═══════════════════════════════════════════════════════════════════

function validarAccion(string $accion, array $permitidas): string {
    if (!in_array($accion, $permitidas, true)) {
        jsonError('Acción no válida', 400);
    }
    return $accion;
}

// ═══════════════════════════════════════════════════════════════════
// 8. SANITIZACIÓN PROFUNDA DE ARRAYS (nunca confíes en el cuerpo completo)
// Aplica sanitize() recursivamente sobre todo el body antes de usarlo.
// Úsalo cuando vayas a reenviar datos a otro sistema o a la BD en bloque.
// ═══════════════════════════════════════════════════════════════════

function sanitizarProfundo(array $data, int $maxProfundidad = 3): array {
    if ($maxProfundidad <= 0) return [];
    $salida = [];
    foreach ($data as $k => $v) {
        $clave = sanitize((string)$k);
        $salida[$clave] = is_array($v)
            ? sanitizarProfundo($v, $maxProfundidad - 1)
            : sanitize((string)$v);
    }
    return $salida;
}
