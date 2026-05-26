<?php
// api/clientes.php — Endpoints de clientes (e-commerce)
require_once __DIR__ . '/_helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

// ── GET mis-datos ─────────────────────────────────────────────────
if ($method === 'GET' && $action === 'mis-datos') {
    $cliente = requerirCliente();
    jsonSuccess(['cliente' => $cliente]);
}

// ── GET mis-pedidos ───────────────────────────────────────────────
if ($method === 'GET' && $action === 'mis-pedidos') {
    $cliente = requerirCliente();
    $pedidos = dbRows(
        "SELECT p.id, p.numero_pedido, p.estado, p.total, p.fecha_creacion,
                p.tipo_entrega, p.fecha_estimada, p.incluye_instalacion,
                COUNT(dp.id) AS cantidad_items
         FROM pedidos p
         LEFT JOIN detalle_pedido dp ON dp.pedido_id = p.id
         WHERE p.cliente_id = ?
         GROUP BY p.id
         ORDER BY p.fecha_creacion DESC
         LIMIT 50",
        [$cliente['id']]
    );
    jsonSuccess(['pedidos' => $pedidos]);
}

// ── GET lista de clientes (admin) ─────────────────────────────────
if ($method === 'GET' && !$id && !$action) {
    requerirAdmin();
    $busqueda = sanitize($_GET['q'] ?? '');
    $limit    = min((int)($_GET['limit'] ?? 50), 200);
    $offset   = max((int)($_GET['offset'] ?? 0), 0);

    $where  = '';
    $params = [];
    if ($busqueda) {
        $where  = "WHERE c.nombre LIKE ? OR c.correo LIKE ? OR c.telefono LIKE ? OR c.ciudad LIKE ?";
        $like   = '%' . $busqueda . '%';
        $params = [$like, $like, $like, $like];
    }

    $tieneClienteId = false;
    try {
        dbRow("SELECT cliente_id FROM pedidos LIMIT 1");
        $tieneClienteId = true;
    } catch (\Throwable $e) { $tieneClienteId = false; }

    if ($tieneClienteId) {
        $clientes = dbRows(
            "SELECT c.id, c.nombre, c.correo, c.telefono, c.ciudad, c.activo, c.fecha_registro,
                    COUNT(p.id) AS total_pedidos,
                    COALESCE(SUM(CASE WHEN p.estado != 'cancelado' THEN p.total ELSE 0 END), 0) AS total_gastado
             FROM clientes c
             LEFT JOIN pedidos p ON p.cliente_id = c.id
             $where
             GROUP BY c.id
             ORDER BY c.fecha_registro DESC
             LIMIT ? OFFSET ?",
            array_merge($params, [$limit, $offset])
        );
    } else {
        $clientes = dbRows(
            "SELECT c.id, c.nombre, c.correo, c.telefono, c.ciudad, c.activo, c.fecha_registro,
                    0 AS total_pedidos, 0 AS total_gastado
             FROM clientes c
             $where
             ORDER BY c.fecha_registro DESC
             LIMIT ? OFFSET ?",
            array_merge($params, [$limit, $offset])
        );
    }

    $totalRow = dbRow(
        "SELECT COUNT(*) AS n FROM clientes c " . ($busqueda ? "WHERE c.nombre LIKE ? OR c.correo LIKE ? OR c.telefono LIKE ? OR c.ciudad LIKE ?" : ""),
        $busqueda ? ['%'.$busqueda.'%','%'.$busqueda.'%','%'.$busqueda.'%','%'.$busqueda.'%'] : []
    );

    jsonSuccess(['clientes' => $clientes, 'total' => $totalRow['n'] ?? 0]);
}

// ── GET cliente individual con historial (admin) ──────────────────
if ($method === 'GET' && $id) {
    requerirAdmin();
    $cliente = dbRow(
        "SELECT id, nombre, correo, telefono, direccion, colonia, municipio, ciudad, cp, activo, fecha_registro
         FROM clientes WHERE id = ? LIMIT 1",
        [$id]
    );
    if (!$cliente) jsonError('Cliente no encontrado', 404);

    $pedidos = dbRows(
        "SELECT p.id, p.numero_pedido, p.estado, p.total, p.fecha_creacion, p.tipo_entrega, p.fecha_estimada
         FROM pedidos p WHERE p.cliente_id = ? ORDER BY p.fecha_creacion DESC LIMIT 20",
        [$id]
    );
    $cotizaciones = dbRows(
        "SELECT numero_cotizacion, estado, fecha_creacion
         FROM cotizaciones WHERE cliente_id = ? ORDER BY fecha_creacion DESC LIMIT 10",
        [$id]
    );

    jsonSuccess(['cliente' => $cliente, 'pedidos' => $pedidos, 'cotizaciones' => $cotizaciones]);
}

// ── PUT actualizar perfil del cliente ─────────────────────────────
if ($method === 'PUT' && $id) {
    $cliente = requerirCliente();
    if ((int)$cliente['id'] !== $id) jsonError('No autorizado', 403);

    $body      = getJsonBody();
    $nombre    = sanitize($body['nombre'] ?? '');
    $telefono  = sanitize($body['telefono'] ?? '');
    $direccion = sanitize($body['direccion'] ?? '');
    $colonia   = sanitize($body['colonia'] ?? '');
    $municipio = sanitize($body['municipio'] ?? '');
    $ciudad    = sanitize($body['ciudad'] ?? '');
    $cp        = sanitize($body['cp'] ?? '');

    if (empty($nombre) || strlen($nombre) < 2) jsonError('Nombre requerido', 422);

    dbQuery(
        "UPDATE clientes SET nombre=?, telefono=?, direccion=?, colonia=?, municipio=?, ciudad=?, cp=? WHERE id=?",
        [$nombre, $telefono ?: null, $direccion ?: null, $colonia ?: null, $municipio ?: null, $ciudad ?: null, $cp ?: null, $id]
    );

    $actualizado = dbRow("SELECT id, nombre, correo, telefono, direccion, colonia, municipio, ciudad, cp FROM clientes WHERE id=?", [$id]);
    jsonSuccess(['cliente' => $actualizado, 'mensaje' => 'Perfil actualizado correctamente']);
}

jsonError('Endpoint no válido', 400);
