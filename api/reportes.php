<?php
require_once __DIR__ . '/_helpers.php';

$usuario = requerirEmpleado(); // Admin y empleado pueden ver KPIs básicos
$esAdmin = $usuario['rol'] === 'administrador';

if (requestMethod() !== 'GET') jsonError('Método no permitido', 405);

$tipo = $_GET['tipo'] ?? 'resumen';

if (in_array($tipo, ['ingresos', 'clientes']) && !$esAdmin) {
    jsonError('Acceso denegado: se requiere rol administrador', 403);
}
$desde = trim($_GET['desde'] ?? date('Y-m-01'));
$hasta = trim($_GET['hasta'] ?? date('Y-m-d'));
$limit = min(100, max(1, sanitizeInt($_GET['limit'] ?? 20)));
if (isset($_GET['desde']) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $desde)) jsonError('Formato de "desde" inválido (YYYY-MM-DD)', 422);
if (isset($_GET['hasta']) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $hasta)) jsonError('Formato de "hasta" inválido (YYYY-MM-DD)', 422);

switch ($tipo) {
    case 'resumen':
        $hoy  = date('Y-m-d');
        $mes  = date('Y-m-01');

        $totalPedidos     = (int)(dbRow("SELECT COUNT(*) AS n FROM pedidos")['n'] ?? 0);
        $pedidosMes       = (int)(dbRow("SELECT COUNT(*) AS n FROM pedidos WHERE DATE(fecha_creacion) >= ?", [$mes])['n'] ?? 0);
        $ingresosMes      = (float)(dbRow("SELECT SUM(total) AS s FROM pedidos WHERE DATE(fecha_creacion) >= ? AND estado NOT IN ('cancelado')", [$mes])['s'] ?? 0);
        $pendientes       = (int)(dbRow("SELECT COUNT(*) AS n FROM pedidos WHERE estado = 'pendiente'")['n'] ?? 0);
        $pendientesMes    = (int)(dbRow("SELECT COUNT(*) AS n FROM pedidos WHERE estado = 'pendiente' AND DATE(fecha_creacion) >= ?", [$mes])['n'] ?? 0);
        $citasHoy         = (int)(dbRow("SELECT COUNT(*) AS n FROM citas WHERE DATE(fecha_cita) = ?", [$hoy])['n'] ?? 0);
        $cotNuevas        = (int)(dbRow("SELECT COUNT(*) AS n FROM cotizaciones WHERE estado = 'nueva'")['n'] ?? 0);
        $productosAct     = (int)(dbRow("SELECT COUNT(*) AS n FROM productos WHERE activo = 1")['n'] ?? 0);
        $clientesUnicos   = (int)(dbRow("SELECT COUNT(DISTINCT correo_cliente) AS n FROM pedidos WHERE estado NOT IN ('cancelado')")['n'] ?? 0);
        $clientesMes      = (int)(dbRow("SELECT COUNT(DISTINCT correo_cliente) AS n FROM pedidos WHERE DATE(fecha_creacion) >= ? AND estado NOT IN ('cancelado')", [$mes])['n'] ?? 0);

        $estadosPedidos = dbRows(
            "SELECT estado, COUNT(*) AS total FROM pedidos GROUP BY estado ORDER BY total DESC"
        );

        jsonSuccess([
            'total_pedidos'       => $totalPedidos,
            'pedidos_mes'         => $pedidosMes,
            'ingresos_mes'        => $ingresosMes,
            'pedidos_pendientes'  => $pendientes,
            'pedidos_pendientes_mes' => $pendientesMes,
            'citas_hoy'           => $citasHoy,
            'cotizaciones_nuevas' => $cotNuevas,
            'productos_activos'   => $productosAct,
            'clientes_unicos'     => $clientesUnicos,
            'clientes_mes'        => $clientesMes,
            'estados_pedidos'     => $estadosPedidos,
        ]);
        break;

    case 'pedidos':
        $pedidos = dbRows(
            "SELECT id, numero_pedido, nombre_cliente, correo_cliente, estado, subtotal, costo_envio, costo_instalacion, descuento, total, fecha_creacion, fecha_estimada
             FROM pedidos WHERE DATE(fecha_creacion) BETWEEN ? AND ? ORDER BY fecha_creacion DESC",
            [$desde, $hasta]
        );
        $totales = dbRow(
            "SELECT COUNT(*) AS total_pedidos, SUM(total) AS ingresos, SUM(CASE WHEN estado='cancelado' THEN 1 ELSE 0 END) AS cancelados
             FROM pedidos WHERE DATE(fecha_creacion) BETWEEN ? AND ?",
            [$desde, $hasta]
        );
        jsonSuccess(['pedidos' => $pedidos, 'totales' => $totales, 'periodo' => ['desde' => $desde, 'hasta' => $hasta]]);
        break;

    case 'productos':
        $productos = dbRows(
            "SELECT p.nombre AS nombre_producto, SUM(dp.cantidad) AS unidades_vendidas,
                    SUM(dp.total_linea) AS ingresos_generados, COUNT(DISTINCT dp.pedido_id) AS num_pedidos
             FROM detalle_pedido dp
             INNER JOIN pedidos pe ON pe.id = dp.pedido_id
             INNER JOIN productos p ON p.id = dp.producto_id
             WHERE DATE(pe.fecha_creacion) BETWEEN ? AND ? AND pe.estado != 'cancelado'
             GROUP BY dp.producto_id ORDER BY unidades_vendidas DESC LIMIT ?",
            [$desde, $hasta, $limit]
        );
        jsonSuccess(['productos' => $productos]);
        break;

    case 'ingresos':
        $agrupacion = $_GET['agrupacion'] ?? 'dia';
        $formatMap  = ['dia' => '%Y-%m-%d', 'semana' => '%Y-%u', 'mes' => '%Y-%m'];
        $fmt = $formatMap[$agrupacion] ?? '%Y-%m-%d';

        $datos = dbRows(
            "SELECT DATE_FORMAT(fecha_creacion, ?) AS periodo,
                    COUNT(*) AS pedidos,
                    SUM(total) AS ingresos,
                    SUM(subtotal) AS subtotal,
                    SUM(costo_envio) AS envios,
                    SUM(costo_instalacion) AS instalaciones
             FROM pedidos
             WHERE DATE(fecha_creacion) BETWEEN ? AND ? AND estado != 'cancelado'
             GROUP BY periodo ORDER BY periodo ASC",
            [$fmt, $desde, $hasta]
        );

        $total = dbRow(
            "SELECT SUM(total) AS total FROM pedidos WHERE DATE(fecha_creacion) BETWEEN ? AND ? AND estado != 'cancelado'",
            [$desde, $hasta]
        );

        jsonSuccess([
            'datos'       => $datos,
            'total'       => (float)($total['total'] ?? 0),
            'agrupacion'  => $agrupacion,
            'periodo'     => ['desde' => $desde, 'hasta' => $hasta],
        ]);
        break;

    case 'clientes':
        $clientes = dbRows(
            "SELECT correo_cliente, nombre_cliente, COUNT(*) AS total_pedidos,
                    SUM(total) AS total_gastado, MAX(fecha_creacion) AS ultimo_pedido
             FROM pedidos WHERE estado != 'cancelado'
             GROUP BY correo_cliente ORDER BY total_gastado DESC LIMIT ?",
            [$limit]
        );
        jsonSuccess(['clientes' => $clientes]);
        break;

    case 'cotizaciones':
        try {
            $funnel = dbRow(
                "SELECT COUNT(*) AS total,
                        SUM(CASE WHEN estado='nueva'       THEN 1 ELSE 0 END) AS nueva,
                        SUM(CASE WHEN estado='en_revision' THEN 1 ELSE 0 END) AS en_revision,
                        SUM(CASE WHEN estado='respondida'  THEN 1 ELSE 0 END) AS respondida,
                        SUM(CASE WHEN estado='cerrada'     THEN 1 ELSE 0 END) AS cerrada
                 FROM cotizaciones WHERE DATE(fecha_creacion) BETWEEN ? AND ?",
                [$desde, $hasta]
            );
            $totalRow   = dbRow("SELECT COUNT(*) AS n FROM cotizaciones");
            $totalCots  = (int)($totalRow['n'] ?? 0);
            $respRow    = dbRow("SELECT COUNT(*) AS n FROM cotizaciones WHERE estado IN ('respondida','cerrada')");
            $respondidas = (int)($respRow['n'] ?? 0);
            $conversionPct = $totalCots > 0 ? round(($respondidas / $totalCots) * 100, 1) : 0;

            $recientes = dbRows(
                "SELECT id, numero_cotizacion, nombre_cliente, estado, fecha_creacion
                 FROM cotizaciones WHERE DATE(fecha_creacion) BETWEEN ? AND ?
                 ORDER BY fecha_creacion DESC LIMIT ?",
                [$desde, $hasta, $limit]
            );
            jsonSuccess([
                'funnel'          => $funnel,
                'conversion_pct'  => $conversionPct,
                'total_historico' => $totalCots,
                'respondidas'     => $respondidas,
                'recientes'       => $recientes,
                'periodo'         => ['desde' => $desde, 'hasta' => $hasta],
            ]);
        } catch (\Throwable $e) {
            appLog('error', 'reportes/cotizaciones: ' . $e->getMessage());
            $msg = APP_DEBUG ? $e->getMessage() : 'Error al cargar reporte de cotizaciones.';
            jsonError($msg, 500);
        }
        break;

    case 'citas':
        $resumen = dbRow(
            "SELECT COUNT(*) AS total,
                    SUM(CASE WHEN tipo='medicion'     THEN 1 ELSE 0 END) AS mediciones,
                    SUM(CASE WHEN tipo='instalacion'  THEN 1 ELSE 0 END) AS instalaciones,
                    SUM(CASE WHEN tipo='otro'         THEN 1 ELSE 0 END) AS otros,
                    SUM(CASE WHEN estado='nueva'      THEN 1 ELSE 0 END) AS nuevas,
                    SUM(CASE WHEN estado='confirmada' THEN 1 ELSE 0 END) AS confirmadas,
                    SUM(CASE WHEN estado='completada' THEN 1 ELSE 0 END) AS completadas,
                    SUM(CASE WHEN estado='cancelada'  THEN 1 ELSE 0 END) AS canceladas
             FROM citas WHERE DATE(fecha_cita) BETWEEN ? AND ?",
            [$desde, $hasta]
        );
        $proximas = dbRows(
            "SELECT id, numero_cita, nombre_cliente, fecha_cita, rango_horario, tipo, estado
             FROM citas WHERE fecha_cita >= CURDATE() AND estado NOT IN ('cancelada','completada')
             ORDER BY fecha_cita ASC, rango_horario ASC LIMIT ?",
            [$limit]
        );
        jsonSuccess([
            'resumen'  => $resumen,
            'proximas' => $proximas,
            'periodo'  => ['desde' => $desde, 'hasta' => $hasta],
        ]);
        break;

    default:
        jsonError('tipo inválido. Usa: resumen, pedidos, productos, ingresos, clientes, cotizaciones, citas', 400);
}
