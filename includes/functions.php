<?php
require_once __DIR__ . '/config.php';

// ---- Respuestas JSON ----
function jsonSuccess(array $data = [], int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array_merge(['success' => true], $data), JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError(string $message, int $code = 400, array $extra = []): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array_merge(['success' => false, 'error' => $message], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

// ---- Sanitización ----
function sanitize(mixed $val): string {
    return htmlspecialchars(strip_tags(trim((string)$val)), ENT_QUOTES, 'UTF-8');
}

function sanitizeInt(mixed $val, int $default = 0): int {
    $v = filter_var($val, FILTER_VALIDATE_INT);
    return $v !== false ? (int)$v : $default;
}

function sanitizeFloat(mixed $val, float $default = 0.0): float {
    $v = filter_var($val, FILTER_VALIDATE_FLOAT);
    return $v !== false ? (float)$v : $default;
}

// ---- Validaciones ----
function isValidEmail(string $email): bool {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function isValidPhone(string $phone): bool {
    return (bool)preg_match('/^[\d\s\(\)\+\-]{7,20}$/', $phone);
}

function requireFields(array $body, array $fields): void {
    $missing = [];
    foreach ($fields as $f) {
        if (!isset($body[$f]) || (is_string($body[$f]) && trim($body[$f]) === '')) {
            $missing[] = $f;
        }
    }
    if ($missing) {
        jsonError('Campos requeridos faltantes: ' . implode(', ', $missing), 422);
    }
}

// ---- Request helpers ----
function getJsonBody(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function requestMethod(): string {
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

// ---- Folios ----
function generarNumeroPedido(): string {
    $year = date('Y');
    $row = dbRow("SELECT MAX(CAST(SUBSTRING_INDEX(numero_pedido, '-', -1) AS UNSIGNED)) AS max_n FROM pedidos WHERE numero_pedido LIKE ?", ["WH-$year-%"]);
    $n = ($row['max_n'] ?? 0) + 1;
    return sprintf('WH-%s-%06d', $year, $n);
}

function generarNumeroCotizacion(): string {
    $year = date('Y');
    $row = dbRow("SELECT MAX(CAST(SUBSTRING_INDEX(numero_cotizacion, '-', -1) AS UNSIGNED)) AS max_n FROM cotizaciones WHERE numero_cotizacion LIKE ?", ["COT-$year-%"]);
    $n = ($row['max_n'] ?? 0) + 1;
    return sprintf('COT-%s-%06d', $year, $n);
}

function generarNumeroCita(): string {
    $year = date('Y');
    $row = dbRow("SELECT MAX(CAST(SUBSTRING_INDEX(numero_cita, '-', -1) AS UNSIGNED)) AS max_n FROM citas WHERE numero_cita LIKE ?", ["CIT-$year-%"]);
    $n = ($row['max_n'] ?? 0) + 1;
    return sprintf('CIT-%s-%06d', $year, $n);
}

function generarTokenSeguimiento(): string {
    return bin2hex(random_bytes(16));
}

// ---- Fechas ----
function fechaEstimadaPedido(int $diasHabiles = DIAS_FABRICACION): string {
    $fecha = new DateTime();
    $added = 0;
    while ($added < $diasHabiles) {
        $fecha->modify('+1 day');
        $dow = (int)$fecha->format('N');
        if ($dow < 6) $added++;
    }
    return $fecha->format('Y-m-d');
}

function formatearFecha(string $fecha, string $formato = 'd/m/Y'): string {
    $dt = DateTime::createFromFormat('Y-m-d', $fecha);
    return $dt ? $dt->format($formato) : $fecha;
}

// ---- Paginación ----
function getPaginacion(int $total, int $page, int $limit): array {
    $totalPages = max(1, (int)ceil($total / $limit));
    return [
        'total'        => $total,
        'pagina'       => $page,
        'limite'       => $limit,
        'total_paginas'=> $totalPages,
        'hay_siguiente'=> $page < $totalPages,
        'hay_anterior' => $page > 1,
    ];
}

// ---- Moneda ----
function formatearMoneda(float $monto): string {
    return '$' . number_format($monto, 2, '.', ',');
}

// ---- Logging ----
function appLog(string $level, string $message, array $context = []): void {
    $logDir = dirname(__DIR__) . '/logs';
    $file   = $logDir . '/' . date('Y-m') . '_app.log';
    $line   = sprintf('[%s] [%s] %s %s', date('Y-m-d H:i:s'), strtoupper($level), $message, $context ? json_encode($context, JSON_UNESCAPED_UNICODE) : '');
    @file_put_contents($file, $line . PHP_EOL, FILE_APPEND | LOCK_EX);

    // Enviar email al desarrollador en errores — máx. 1 correo por mensaje único por hora
    if ($level === 'error' && defined('DESARROLLADOR_EMAIL') && DESARROLLADOR_EMAIL) {
        $throttleFile = $logDir . '/err_' . md5($message) . '.throttle';
        $enviarEmail  = !file_exists($throttleFile) || (time() - (int)filemtime($throttleFile)) > 3600;
        if ($enviarEmail) {
            @touch($throttleFile);
            $from    = (defined('EMAIL_FROM') && EMAIL_FROM) ? EMAIL_FROM : 'no-reply@woodenhouse.com.mx';
            $subject = '[WH Error] ' . substr($message, 0, 80);
            $body    = "Error en Wooden House\n\n"
                     . $line . "\n\n"
                     . "URL: " . ($_SERVER['REQUEST_URI'] ?? 'CLI') . "\n"
                     . "IP:  " . clienteIp() . "\n"
                     . "APP: " . APP_URL;
            @mail(
                DESARROLLADOR_EMAIL,
                $subject,
                $body,
                "From: $from\r\nContent-Type: text/plain; charset=utf-8"
            );
        }
    }
}

// ---- ID desde URL ----
function getIdFromUrl(): ?int {
    $parts = explode('/', trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/'));
    $last = end($parts);
    $id = filter_var($last, FILTER_VALIDATE_INT);
    return $id !== false ? (int)$id : null;
}

// ── Alias de compatibilidad ────────────────────────────────────────
function logError(string $message, array $context = []): void {
    appLog('error', $message, $context);
}

function formatMoney(float $amount): string {
    return '$' . number_format($amount, 2);
}

function firestoreEscribir(string $coleccion, string $docId, array $datos): bool {
    if (function_exists('crearNotificacionFirestore')) {
        return crearNotificacionFirestore(
            $datos['tipo'] ?? 'general',
            $datos['titulo'] ?? '',
            $datos['mensaje'] ?? '',
            $datos
        );
    }
    return false;
}
// ---- Fechas inteligentes por tipo de entrega ----

function calcularFechaInteligente(string $tipoEntrega, string $cp, int $numProductos): string {
    // Usar las constantes globales de config.php para que todo el sistema
    // use el mismo límite de capacidad diaria
    $LIMITE     = defined('LIMITE_DIA')    ? LIMITE_DIA    : 10;
    $MARGEN     = defined('MARGEN_HABILES') ? MARGEN_HABILES : 2;
    $MAX_BUSCAR = 60;

    $hoy    = new DateTime();
    $minima = calcularFechaMinHabil($hoy, $MARGEN);

    $hasta = (clone $hoy)->modify("+{$MAX_BUSCAR} days")->format('Y-m-d');
    $rows  = dbRows(
        "SELECT p.fecha_estimada,
                p.tipo_entrega,
                COALESCE(p.cp_envio, '') AS cp_envio,
                SUM(dp.cantidad)         AS total_productos
         FROM pedidos p
         INNER JOIN detalle_pedido dp ON dp.pedido_id = p.id
         WHERE p.fecha_estimada BETWEEN ? AND ?
           AND p.estado NOT IN ('cancelado','finalizado')
         GROUP BY p.fecha_estimada, p.tipo_entrega, p.cp_envio",
        [$minima->format('Y-m-d'), $hasta]
    );

    $carga = [];
    foreach ($rows as $r) {
        $f  = $r['fecha_estimada'];
        $t  = $r['tipo_entrega'];
        $c  = $r['cp_envio'];
        $carga[$f][$t][$c] = ($carga[$f][$t][$c] ?? 0) + (int)$r['total_productos'];
    }

    $bloqueados = dbRows(
        "SELECT fecha FROM dias_bloqueados WHERE fecha BETWEEN ? AND ?",
        [$minima->format('Y-m-d'), $hasta]
    );
    $bloqueadosSet = array_flip(array_column($bloqueados, 'fecha'));

    // ── Recorrer días buscando el óptimo ──────────────────────────
    $fechaGeneral = null;   // primer día con espacio general
    $fechaZona    = null;   // primer día con pedidos del mismo CP

    $fecha = clone $minima;
    $dias  = 0;

    while ($dias < $MAX_BUSCAR) {
        $ymd = $fecha->format('Y-m-d');
        $dow = (int)$fecha->format('N');

        // Solo días hábiles (lun-vie) no bloqueados
        if ($dow <= 5 && !isset($bloqueadosSet[$ymd])) {

            $totalDia = 0;
            foreach ($carga[$ymd] ?? [] as $tipos) {
                foreach ($tipos as $prod) { $totalDia += $prod; }
            }

            $espacioGeneral = ($LIMITE - $totalDia) >= $numProductos;

            if ($espacioGeneral) {
                if ($fechaGeneral === null) $fechaGeneral = $ymd;

                if ($tipoEntrega === 'envio' && !empty($cp)) {
                    $yaHayMismoCP = isset($carga[$ymd]['envio'][$cp]);
                    if ($yaHayMismoCP && $fechaZona === null) {
                        $fechaZona = $ymd;
                    }
                }
            }

            if ($fechaGeneral !== null && ($tipoEntrega !== 'envio' || !empty($cp) === false || $fechaZona !== null)) {
                break;
            }
            if ($tipoEntrega === 'recoger' && $fechaGeneral !== null) {
                break;
            }
        }

        $fecha->modify('+1 day');
        $dias++;
    }

    if ($tipoEntrega === 'envio' && $fechaZona !== null) {
        return $fechaZona;   // agrupa con pedidos de la misma zona
    }
    return $fechaGeneral ?? fechaEstimadaPedido(); // fallback al cálculo simple
}

function calcularFechaMinHabil(DateTime $desde, int $dias): DateTime {
    $fecha    = clone $desde;
    $contados = 0;
    $limite   = (clone $desde)->modify('+30 days')->format('Y-m-d');
    $bloq     = dbRows("SELECT fecha FROM dias_bloqueados WHERE fecha BETWEEN ? AND ?",
                       [$desde->format('Y-m-d'), $limite]);
    $bloqSet  = array_flip(array_column($bloq, 'fecha'));

    while ($contados < $dias) {
        $fecha->modify('+1 day');
        $dow = (int)$fecha->format('N');
        $ymd = $fecha->format('Y-m-d');
        if ($dow <= 5 && !isset($bloqSet[$ymd])) $contados++;
    }
    return $fecha;
}

// Folios públicos (WH-/CIT-/COT-) son consecutivos: cualquiera puede probar
// números seguidos. En esas búsquedas el nombre se enmascara ("Juan P.") para
// que el folio sirva para confirmar un estado, no para sacar la lista de
// clientes. Los datos completos solo con el token del correo o la sesión del
// cliente dueño.
function enmascararNombre(string $nombre): string {
    $partes = preg_split('/\s+/u', trim(html_entity_decode($nombre, ENT_QUOTES, 'UTF-8')));
    if (!$partes || $partes[0] === '') return '';
    $out = $partes[0];
    if (isset($partes[1]) && $partes[1] !== '') $out .= ' ' . mb_substr($partes[1], 0, 1) . '.';
    return $out;
}

// IP real del visitante. El sitio corre detrás de un túnel de Cloudflare:
// PHP ve como REMOTE_ADDR la IP local del túnel, la MISMA para todos — así
// los límites de intentos eran compartidos por todo el mundo (5 logins de
// cualquiera bloqueaban a todos). Solo se confía en CF-Connecting-IP cuando
// la conexión viene del túnel local; si alguien la falsifica desde fuera,
// REMOTE_ADDR no es local y se ignora.
function clienteIp(): string {
    $remota = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $cf = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '';
    if (in_array($remota, ['127.0.0.1', '::1'], true) && $cf !== '' && filter_var($cf, FILTER_VALIDATE_IP)) {
        return $cf;
    }
    return $remota;
}
