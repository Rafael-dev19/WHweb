<?php
// api/eventos.php — Server-Sent Events para notificaciones en tiempo real
define('WH_API_REQUEST', true);
require_once dirname(__DIR__) . '/includes/auth.php';

requerirAutenticacion();

// Headers SSE
header('Content-Type: text/event-stream; charset=UTF-8');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');

// Deshabilitar compresión (deflate rompe el stream)
if (function_exists('apache_setenv')) {
    apache_setenv('no-gzip', '1');
}
ini_set('zlib.output_compression', 0);

while (ob_get_level()) ob_end_flush();
ob_implicit_flush(true);
set_time_limit(0);
ignore_user_abort(false);

$lastPedido     = max(0, (int)($_GET['lp'] ?? 0));
$lastCita       = max(0, (int)($_GET['lc'] ?? 0));
$lastCotizacion = max(0, (int)($_GET['lq'] ?? 0));

// Si el cliente no envía IDs, inicializa con los últimos existentes
// para no inundar con todo el historial al conectar
if ($lastPedido === 0) {
    $row = dbRow("SELECT COALESCE(MAX(id),0) AS m FROM pedidos");
    $lastPedido = (int)($row['m'] ?? 0);
}
if ($lastCita === 0) {
    $row = dbRow("SELECT COALESCE(MAX(id),0) AS m FROM citas");
    $lastCita = (int)($row['m'] ?? 0);
}
if ($lastCotizacion === 0) {
    $row = dbRow("SELECT COALESCE(MAX(id),0) AS m FROM cotizaciones");
    $lastCotizacion = (int)($row['m'] ?? 0);
}

function sseEvent(string $event, array $data): void {
    echo "event: {$event}\n";
    echo "data: " . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
    flush();
}

// Evento inicial — confirma conexión y envía IDs de referencia
sseEvent('conectado', [
    'lp' => $lastPedido,
    'lc' => $lastCita,
    'lq' => $lastCotizacion,
    't'  => time(),
]);

$tick = 0;

while (!connection_aborted()) {
    try {
        $p = dbRow(
            "SELECT id, numero_pedido, nombre_cliente, total, estado
             FROM pedidos WHERE id > ? ORDER BY id ASC LIMIT 1",
            [$lastPedido]
        );
        if ($p) {
            $lastPedido = (int)$p['id'];
            sseEvent('nuevo_pedido', $p);
        }

        $c = dbRow(
            "SELECT id, numero_cita, nombre_cliente, fecha_cita, tipo
             FROM citas WHERE id > ? ORDER BY id ASC LIMIT 1",
            [$lastCita]
        );
        if ($c) {
            $lastCita = (int)$c['id'];
            sseEvent('nueva_cita', $c);
        }

        $q = dbRow(
            "SELECT id, numero_cotizacion, nombre_cliente, descripcion_solicitud
             FROM cotizaciones WHERE id > ? ORDER BY id ASC LIMIT 1",
            [$lastCotizacion]
        );
        if ($q) {
            $lastCotizacion = (int)$q['id'];
            sseEvent('nueva_cotizacion', $q);
        }

    } catch (\Throwable $e) {
        error_log('[SSE] ' . $e->getMessage());
        break;
    }

    $tick++;
    // Heartbeat cada 25s — mantiene viva la conexión con Cloudflare (timeout ~100s)
    if ($tick % 25 === 0) {
        echo ": ping\n\n";
        flush();
    }

    sleep(2);
}
