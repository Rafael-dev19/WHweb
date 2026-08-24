<?php
// api/cotizador_catalogo.php — Catálogo de partidas del cotizador estructurado
// (hojas, bisagras, correderas, etc). El jefe/administrador puede agregar
// partidas nuevas desde el propio panel sin tocar código.
require_once __DIR__ . '/_helpers.php';

$method = requestMethod();
$id     = isset($_GET['id']) ? sanitizeInt($_GET['id']) : null;

switch ($method) {
    case 'GET':
        requerirGestion();
        $items = dbRows(
            "SELECT id, clave, nombre, unidad, precio_unitario_default, activo, orden
             FROM cotizador_items_catalogo WHERE activo = 1 ORDER BY orden ASC, nombre ASC"
        );
        jsonSuccess(['items' => $items]);
        break;

    case 'POST':
        requerirGestion();
        requerirCsrf();
        $body = getJsonBody();
        requireFields($body, ['clave', 'nombre']);

        $clave = strtolower(preg_replace('/[^a-z0-9_]/', '_', sanitize($body['clave'])));
        if (strlen($clave) < 2 || strlen($clave) > 60) jsonError('Clave inválida', 422);
        $nombre = sanitize($body['nombre']);
        if (mb_strlen($nombre) < 2 || mb_strlen($nombre) > 120) jsonError('Nombre inválido', 422);
        $unidad = sanitize($body['unidad'] ?? 'pza') ?: 'pza';
        $precio = max(0, (float)($body['precio_unitario_default'] ?? 0));
        $orden  = (int)($body['orden'] ?? 0);

        if (dbRow("SELECT id FROM cotizador_items_catalogo WHERE clave = ?", [$clave])) {
            jsonError('Ya existe una partida con esa clave', 409);
        }

        $newId = dbInsert('cotizador_items_catalogo', [
            'clave' => $clave, 'nombre' => $nombre, 'unidad' => $unidad,
            'precio_unitario_default' => $precio, 'orden' => $orden,
        ]);
        jsonSuccess(['id' => $newId, 'mensaje' => 'Partida agregada'], 201);
        break;

    case 'PUT':
        requerirGestion();
        requerirCsrf();
        if (!$id) jsonError('ID requerido', 400);
        if (!dbRow("SELECT id FROM cotizador_items_catalogo WHERE id = ?", [$id])) {
            jsonError('Partida no encontrada', 404);
        }
        $body = getJsonBody();
        $update = [];
        if (isset($body['nombre'])) {
            $nombre = sanitize($body['nombre']);
            if (mb_strlen($nombre) < 2 || mb_strlen($nombre) > 120) jsonError('Nombre inválido', 422);
            $update['nombre'] = $nombre;
        }
        if (isset($body['unidad']))                    $update['unidad'] = sanitize($body['unidad']) ?: 'pza';
        if (isset($body['precio_unitario_default']))    $update['precio_unitario_default'] = max(0, (float)$body['precio_unitario_default']);
        if (isset($body['orden']))                      $update['orden'] = (int)$body['orden'];
        if (isset($body['activo']))                     $update['activo'] = (int)(bool)$body['activo'];
        if ($update) dbUpdate('cotizador_items_catalogo', $update, 'id = ?', [$id]);
        jsonSuccess(['mensaje' => 'Partida actualizada']);
        break;

    case 'DELETE':
        requerirGestion();
        requerirCsrf();
        if (!$id) jsonError('ID requerido', 400);
        // Soft delete: las partidas ya usadas en cotizaciones respondidas quedan
        // como snapshot en cotizacion_respuesta_items, no se borran físicamente.
        dbUpdate('cotizador_items_catalogo', ['activo' => 0], 'id = ?', [$id]);
        jsonSuccess(['mensaje' => 'Partida desactivada']);
        break;

    default:
        jsonError('Método no permitido', 405);
}
