<?php
// api/dias_bloqueados.php — Gestión de días bloqueados (jefe/administrador)

require_once __DIR__ . '/_helpers.php';
requerirGestion();

switch ($_SERVER['REQUEST_METHOD']) {

    // ── GET: listar días bloqueados + carga de pedidos próximos ──────────────
    case 'GET':
        $desde = $_GET['desde'] ?? date('Y-m-d');
        $hasta = $_GET['hasta'] ?? date('Y-m-d', strtotime('+90 days'));

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $desde) ||
            !preg_match('/^\d{4}-\d{2}-\d{2}$/', $hasta)) {
            jsonError('Formato de fecha inválido (YYYY-MM-DD)', 422);
        }

        $bloqueados = dbRows(
            "SELECT id, fecha, motivo, fecha_creacion
             FROM dias_bloqueados
             WHERE fecha BETWEEN ? AND ?
             ORDER BY fecha ASC",
            [$desde, $hasta]
        );

        $limite = defined('LIMITE_DIA') ? LIMITE_DIA : 10;
        $cargaRows = dbRows(
            "SELECT p.fecha_estimada,
                    COUNT(DISTINCT p.id) AS num_pedidos,
                    SUM(dp.cantidad)     AS total_productos,
                    GROUP_CONCAT(DISTINCT p.estado ORDER BY p.estado) AS estados
             FROM pedidos p
             INNER JOIN detalle_pedido dp ON dp.pedido_id = p.id
             WHERE p.fecha_estimada BETWEEN ? AND ?
               AND p.estado NOT IN ('cancelado','finalizado')
             GROUP BY p.fecha_estimada
             ORDER BY p.fecha_estimada ASC",
            [$desde, $hasta]
        );

        $carga = [];
        foreach ($cargaRows as $r) {
            $carga[$r['fecha_estimada']] = [
                'num_pedidos'      => (int)$r['num_pedidos'],
                'total_productos'  => (int)$r['total_productos'],
                'lugares_libres'   => max(0, $limite - (int)$r['total_productos']),
                'porcentaje'       => min(100, round(((int)$r['total_productos'] / $limite) * 100)),
                'estados'          => $r['estados'],
                'lleno'            => (int)$r['total_productos'] >= $limite,
            ];
        }

        $bloqueadosConInfo = array_map(function($b) use ($carga) {
            $b['tiene_pedidos'] = isset($carga[$b['fecha']]);
            $b['carga']         = $carga[$b['fecha']] ?? null;
            return $b;
        }, $bloqueados);

        jsonSuccess([
            'bloqueados'   => $bloqueadosConInfo,
            'carga_por_dia'=> $carga,
            'limite_dia'   => $limite,
            'desde'        => $desde,
            'hasta'        => $hasta,
        ]);
        break;

    // ── POST: bloquear un día ────────────────────────────────────────────────
    case 'POST':
        requerirCsrf();
        $body  = getJsonBody();
        $fecha = trim($body['fecha'] ?? '');
        $motivo = sanitize($body['motivo'] ?? 'Día no hábil');

        if (!$fecha || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
            jsonError('fecha inválida (YYYY-MM-DD)', 422);
        }
        if (strtotime($fecha) < strtotime('today')) {
            jsonError('No se pueden bloquear fechas pasadas', 422);
        }

        $existe = dbRow("SELECT id FROM dias_bloqueados WHERE fecha = ?", [$fecha]);
        if ($existe) {
            jsonError('Ese día ya está bloqueado', 409);
        }

        $pedidosEnDia = dbRow(
            "SELECT COUNT(*) AS total FROM pedidos
             WHERE fecha_estimada = ? AND estado NOT IN ('cancelado','finalizado')",
            [$fecha]
        );

        $id = dbInsert('dias_bloqueados', [
            'fecha'  => $fecha,
            'motivo' => $motivo,
        ]);

        jsonSuccess([
            'id'              => $id,
            'fecha'           => $fecha,
            'motivo'          => $motivo,
            'advertencia'     => (int)($pedidosEnDia['total'] ?? 0) > 0
                ? "⚠️ Hay " . (int)$pedidosEnDia['total'] . " pedido(s) asignados a ese día"
                : null,
        ], 201);
        break;

    // ── DELETE: desbloquear un día ───────────────────────────────────────────
    case 'DELETE':
        requerirCsrf();
        $fecha = trim($_GET['fecha'] ?? '');
        if (!$fecha || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
            jsonError('fecha inválida (YYYY-MM-DD)', 422);
        }

        $existe = dbRow("SELECT id FROM dias_bloqueados WHERE fecha = ?", [$fecha]);
        if (!$existe) {
            jsonError('Ese día no está bloqueado', 404);
        }

        dbQuery("DELETE FROM dias_bloqueados WHERE fecha = ?", [$fecha]);
        jsonSuccess(['fecha' => $fecha, 'desbloqueado' => true]);
        break;

    default:
        jsonError('Método no permitido', 405);
}
