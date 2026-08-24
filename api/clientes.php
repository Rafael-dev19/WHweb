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
    requerirGestion();
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
    requerirGestion();
    $cliente = dbRow(
        "SELECT id, nombre, correo, telefono, direccion, colonia, municipio, ciudad, cp, lat, lng, activo, fecha_registro
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
// Actualización parcial: solo se tocan las columnas presentes en el body,
// para permitir que el formulario de datos (nombre/teléfono) y el picker
// de dirección (mapa, en su propio LockedField) guarden por separado
// sin pisarse el uno al otro.
if ($method === 'PUT' && $id) {
    $cliente = requerirCliente();
    requerirCsrf();
    if ((int)$cliente['id'] !== $id) jsonError('No autorizado', 403);

    $body   = getJsonBody();
    $campos = [];
    $valores = [];

    if (array_key_exists('nombre', $body)) {
        $nombre = sanitize($body['nombre'] ?? '');
        if (empty($nombre) || strlen($nombre) < 2) jsonError('Nombre requerido', 422);
        $campos[] = 'nombre=?'; $valores[] = $nombre;
    }
    if (array_key_exists('telefono', $body)) {
        $campos[] = 'telefono=?'; $valores[] = sanitize($body['telefono'] ?? '') ?: null;
    }
    if (array_key_exists('direccion', $body)) {
        $campos[] = 'direccion=?'; $valores[] = sanitize($body['direccion'] ?? '') ?: null;
    }
    if (array_key_exists('colonia', $body)) {
        $campos[] = 'colonia=?'; $valores[] = sanitize($body['colonia'] ?? '') ?: null;
    }
    if (array_key_exists('municipio', $body)) {
        $campos[] = 'municipio=?'; $valores[] = sanitize($body['municipio'] ?? '') ?: null;
    }
    if (array_key_exists('ciudad', $body)) {
        $campos[] = 'ciudad=?'; $valores[] = sanitize($body['ciudad'] ?? '') ?: null;
    }
    if (array_key_exists('cp', $body)) {
        $campos[] = 'cp=?'; $valores[] = sanitize($body['cp'] ?? '') ?: null;
    }
    if (array_key_exists('lat', $body)) {
        $lat = filter_var($body['lat'], FILTER_VALIDATE_FLOAT);
        $campos[] = 'lat=?'; $valores[] = $lat !== false ? $lat : null;
    }
    if (array_key_exists('lng', $body)) {
        $lng = filter_var($body['lng'], FILTER_VALIDATE_FLOAT);
        $campos[] = 'lng=?'; $valores[] = $lng !== false ? $lng : null;
    }

    if (empty($campos)) jsonError('Nada que actualizar', 422);

    $valores[] = $id;
    dbQuery("UPDATE clientes SET " . implode(', ', $campos) . " WHERE id=?", $valores);

    $actualizado = dbRow("SELECT id, nombre, correo, telefono, direccion, colonia, municipio, ciudad, cp, lat, lng FROM clientes WHERE id=?", [$id]);
    jsonSuccess(['cliente' => $actualizado, 'mensaje' => 'Perfil actualizado correctamente']);
}

jsonError('Endpoint no válido', 400);
