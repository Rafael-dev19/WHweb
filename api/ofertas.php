<?php
// api/ofertas.php — Gestión de ofertas y promociones
require_once __DIR__ . '/_helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

// ── GET ofertas activas (público) ─────────────────────────────────
if ($method === 'GET' && $action === 'activas') {
    $hoy = date('Y-m-d');
    $ofertas = dbRows(
        "SELECT id, nombre, descripcion, tipo, valor, codigo, fecha_inicio, fecha_fin
         FROM ofertas
         WHERE activo = 1
           AND (fecha_inicio IS NULL OR fecha_inicio <= ?)
           AND (fecha_fin   IS NULL OR fecha_fin   >= ?)
           AND (usos_maximos IS NULL OR usos_actuales < usos_maximos)
         ORDER BY fecha_creacion DESC",
        [$hoy, $hoy]
    );
    jsonSuccess(['ofertas' => $ofertas]);
}

// ── POST validar código promo (público) ───────────────────────────
if ($method === 'POST' && $action === 'validar') {
    checkRateLimit('validar_codigo', 10, 60);
    $body   = getJsonBody();
    $codigo = strtoupper(trim(sanitize($body['codigo'] ?? '')));
    $total  = (float)($body['total'] ?? 0);

    if (empty($codigo)) jsonError('Código requerido', 422);

    $hoy    = date('Y-m-d');
    $oferta = dbRow(
        "SELECT * FROM ofertas
         WHERE codigo = ? AND activo = 1
           AND (fecha_inicio IS NULL OR fecha_inicio <= ?)
           AND (fecha_fin   IS NULL OR fecha_fin   >= ?)
           AND (usos_maximos IS NULL OR usos_actuales < usos_maximos)
         LIMIT 1",
        [$codigo, $hoy, $hoy]
    );
    if (!$oferta) jsonError('Código no válido o expirado', 404);

    $descuento = 0;
    if ($oferta['tipo'] === 'porcentaje') {
        $descuento = round($total * ((float)$oferta['valor'] / 100), 2);
    } elseif ($oferta['tipo'] === 'monto_fijo') {
        $descuento = min((float)$oferta['valor'], $total);
    }
    // envio_gratis: descuento = 0 pero se marca en checkout

    jsonSuccess([
        'oferta'    => [
            'id'          => $oferta['id'],
            'nombre'      => $oferta['nombre'],
            'tipo'        => $oferta['tipo'],
            'valor'       => $oferta['valor'],
            'codigo'      => $oferta['codigo'],
            'descripcion' => $oferta['descripcion'],
        ],
        'descuento' => $descuento,
        'mensaje'   => '¡Código aplicado correctamente!',
    ]);
}

// ── GET listar todas las ofertas (admin) ──────────────────────────
if ($method === 'GET' && !$id && !$action) {
    requerirJefe();
    $ofertas = dbRows(
        "SELECT *,
                CASE WHEN activo=1
                      AND (fecha_inicio IS NULL OR fecha_inicio <= CURDATE())
                      AND (fecha_fin   IS NULL OR fecha_fin   >= CURDATE())
                      AND (usos_maximos IS NULL OR usos_actuales < usos_maximos)
                     THEN 1 ELSE 0 END AS vigente
         FROM ofertas ORDER BY fecha_creacion DESC"
    );
    jsonSuccess(['ofertas' => $ofertas]);
}

// ── GET oferta individual (admin) ─────────────────────────────────
if ($method === 'GET' && $id) {
    requerirJefe();
    $oferta = dbRow("SELECT * FROM ofertas WHERE id=? LIMIT 1", [$id]);
    if (!$oferta) jsonError('Oferta no encontrada', 404);
    jsonSuccess(['oferta' => $oferta]);
}

// ── POST crear oferta (admin) ─────────────────────────────────────
if ($method === 'POST' && !$action) {
    requerirJefe();
    requerirCsrf();
    $body        = getJsonBody();
    $nombre      = sanitize($body['nombre'] ?? '');
    $descripcion = sanitize($body['descripcion'] ?? '');
    $tipo        = in_array($body['tipo'] ?? '', ['porcentaje','monto_fijo','envio_gratis']) ? $body['tipo'] : 'porcentaje';
    $valor       = max(0, (float)($body['valor'] ?? 0));
    $codigo      = !empty($body['codigo']) ? strtoupper(sanitize($body['codigo'])) : null;
    $activo      = (int)(bool)($body['activo'] ?? true);
    $fechaInicio = !empty($body['fecha_inicio']) ? sanitize($body['fecha_inicio']) : null;
    $fechaFin    = !empty($body['fecha_fin'])    ? sanitize($body['fecha_fin'])    : null;
    $usosMax     = isset($body['usos_maximos']) && $body['usos_maximos'] !== '' ? (int)$body['usos_maximos'] : null;

    if (empty($nombre)) jsonError('Nombre de oferta requerido', 422);

    try {
        dbExecute(
            "INSERT INTO ofertas (nombre, descripcion, tipo, valor, codigo, activo, fecha_inicio, fecha_fin, usos_maximos)
             VALUES (?,?,?,?,?,?,?,?,?)",
            [$nombre, $descripcion ?: null, $tipo, $valor, $codigo, $activo, $fechaInicio, $fechaFin, $usosMax]
        );
        $newId  = dbRow("SELECT LAST_INSERT_ID() AS id")['id'];
        $oferta = dbRow("SELECT * FROM ofertas WHERE id=?", [$newId]);
        jsonSuccess(['oferta' => $oferta, 'mensaje' => 'Oferta creada correctamente'], 201);
    } catch (\Throwable $e) {
        if (str_contains($e->getMessage(), 'Duplicate')) jsonError('El código promocional ya existe', 409);
        jsonError('Error al crear la oferta', 500);
    }
}

// ── PUT actualizar oferta (admin) ─────────────────────────────────
if ($method === 'PUT' && $id) {
    requerirJefe();
    requerirCsrf();
    if (!dbRow("SELECT id FROM ofertas WHERE id=?", [$id])) jsonError('Oferta no encontrada', 404);

    $body        = getJsonBody();
    $nombre      = sanitize($body['nombre'] ?? '');
    $descripcion = sanitize($body['descripcion'] ?? '');
    $tipo        = in_array($body['tipo'] ?? '', ['porcentaje','monto_fijo','envio_gratis']) ? $body['tipo'] : 'porcentaje';
    $valor       = max(0, (float)($body['valor'] ?? 0));
    $codigo      = !empty($body['codigo']) ? strtoupper(sanitize($body['codigo'])) : null;
    $activo      = (int)(bool)($body['activo'] ?? true);
    $fechaInicio = !empty($body['fecha_inicio']) ? sanitize($body['fecha_inicio']) : null;
    $fechaFin    = !empty($body['fecha_fin'])    ? sanitize($body['fecha_fin'])    : null;
    $usosMax     = isset($body['usos_maximos']) && $body['usos_maximos'] !== '' ? (int)$body['usos_maximos'] : null;

    if (empty($nombre)) jsonError('Nombre requerido', 422);

    try {
        dbExecute(
            "UPDATE ofertas SET nombre=?, descripcion=?, tipo=?, valor=?, codigo=?, activo=?, fecha_inicio=?, fecha_fin=?, usos_maximos=? WHERE id=?",
            [$nombre, $descripcion ?: null, $tipo, $valor, $codigo, $activo, $fechaInicio, $fechaFin, $usosMax, $id]
        );
        $actualizada = dbRow("SELECT * FROM ofertas WHERE id=?", [$id]);
        jsonSuccess(['oferta' => $actualizada, 'mensaje' => 'Oferta actualizada']);
    } catch (\Throwable $e) {
        if (str_contains($e->getMessage(), 'Duplicate')) jsonError('El código ya existe en otra oferta', 409);
        jsonError('Error al actualizar', 500);
    }
}

// ── DELETE eliminar oferta (admin) ────────────────────────────────
if ($method === 'DELETE' && $id) {
    requerirJefe();
    requerirCsrf();
    if (!dbRow("SELECT id FROM ofertas WHERE id=?", [$id])) jsonError('Oferta no encontrada', 404);
    dbExecute("DELETE FROM ofertas WHERE id=?", [$id]);
    jsonSuccess(['mensaje' => 'Oferta eliminada']);
}

jsonError('Endpoint no válido', 400);
