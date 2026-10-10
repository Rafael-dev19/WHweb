<?php
require_once __DIR__ . '/_helpers.php';

function validarUrlImagen(string $url): bool {
    if (empty($url) || strlen($url) > 2048) return false;
    // Fotos del catálogo que viven en el propio sitio (ver
    // database/migracion_2026_10_catalogo_banos.sql) — sin esto, guardar el
    // producto desde el panel las borraría por no ser de Firebase.
    if (preg_match('#^/assets/img/catalogo/[a-z0-9_-]+\.(jpe?g|png|webp)$#i', $url)) return true;
    if (!filter_var($url, FILTER_VALIDATE_URL)) return false;
    $parsed = parse_url($url);
    if (($parsed['scheme'] ?? '') !== 'https') return false;
    $host = $parsed['host'] ?? '';
    $allowedHosts = ['firebasestorage.googleapis.com', 'storage.googleapis.com'];
    return in_array($host, $allowedHosts, true) || str_ends_with($host, '.firebasestorage.app');
}

// Precio por ancho (catálogo 2026: cada modelo se vende de 60 a 120 cm).
// precio_base del producto queda siempre como el "desde" = el ancho más barato.
function medidasDeProductos(array $ids): array {
    $ids = array_values(array_filter(array_map('intval', $ids)));
    if (!$ids) return [];
    $ph = implode(',', array_fill(0, count($ids), '?'));
    try {
        $rows = dbRows("SELECT producto_id, ancho_cm, precio FROM producto_medidas WHERE producto_id IN ($ph) ORDER BY ancho_cm", $ids);
    } catch (\Throwable $e) {
        return []; // migración aún no aplicada
    }
    $out = [];
    foreach ($rows as $r) {
        $out[(int)$r['producto_id']][] = ['ancho_cm' => (int)$r['ancho_cm'], 'precio' => (float)$r['precio']];
    }
    return $out;
}

function leerMedidasBody(array $body): ?array {
    if (!isset($body['medidas']) || !is_array($body['medidas'])) return null;
    $medidas = [];
    foreach ($body['medidas'] as $m) {
        $ancho  = sanitizeInt($m['ancho_cm'] ?? 0);
        $precio = sanitizeFloat($m['precio'] ?? 0);
        if ($ancho < 20 || $ancho > 400) jsonError('Cada medida necesita un ancho entre 20 y 400 cm', 422);
        if ($precio <= 0) jsonError("El precio de {$ancho} cm debe ser mayor a 0", 422);
        $medidas[$ancho] = $precio;
    }
    ksort($medidas);
    return $medidas;
}

function guardarMedidas(int $productoId, array $medidas): void {
    dbQuery("DELETE FROM producto_medidas WHERE producto_id = ?", [$productoId]);
    foreach ($medidas as $ancho => $precio) {
        dbInsert('producto_medidas', ['producto_id' => $productoId, 'ancho_cm' => $ancho, 'precio' => $precio]);
    }
}

$method = requestMethod();
$id = isset($_GET['id']) ? sanitizeInt($_GET['id']) : null;

switch ($method) {
    // ---- GET: Listar o detalle ----
    case 'GET':
        if ($id) {
            $producto = dbRow(
                "SELECT p.*, c.nombre AS categoria_nombre
                 FROM productos p
                 LEFT JOIN categorias c ON c.id = p.categoria_id
                 WHERE p.id = ? AND p.activo = 1",
                [$id]
            );
            if (!$producto) jsonError('Producto no encontrado', 404);

            $imagenes = dbRows(
                "SELECT id, url_imagen, es_principal, orden FROM imagenes_producto WHERE producto_id = ? ORDER BY es_principal DESC, orden ASC",
                [$id]
            );

            $specs = dbRows(
                "SELECT clave, valor FROM especificaciones_producto WHERE producto_id = ? ORDER BY id ASC",
                [$id]
            );

            $producto['imagenes']          = $imagenes;
            $producto['especificaciones']  = $specs;
            $producto['medidas']           = medidasDeProductos([$id])[$id] ?? [];
            $producto['imagen_principal']  = $imagenes[0]['url_imagen'] ?? null;

            jsonSuccess(['producto' => $producto]);
        }

        $page     = max(1, sanitizeInt($_GET['page'] ?? 1));
        $limit    = min(48, max(1, sanitizeInt($_GET['limit'] ?? 12)));
        $offset   = ($page - 1) * $limit;
        $busqueda  = trim($_GET['busqueda'] ?? '');
        $catId     = sanitizeInt($_GET['categoria_id'] ?? 0);
        $etiqueta  = trim($_GET['etiqueta'] ?? '');
        $orden     = $_GET['orden'] ?? 'recientes';
        $activoRaw = trim($_GET['activo'] ?? '1');
        $mostrarTodos = (strtolower($activoRaw) === 'todos' || $activoRaw === '');
        $activo   = $mostrarTodos ? null : sanitizeInt($activoRaw, 1);

        $where  = [];
        $params = [];
        if (!$mostrarTodos) {
            $where[]  = 'p.activo = ?';
            $params[] = $activo;
        }

        if ($busqueda) {
            $terms = array_values(array_filter(preg_split('/\s+/', $busqueda), fn($t) => mb_strlen($t) >= 2));
            if (empty($terms)) $terms = [$busqueda];
            foreach ($terms as $term) {
                $where[]  = 'p.nombre LIKE ?';
                $params[] = "%{$term}%";
            }
        }
        if ($catId) {
            $where[]  = 'p.categoria_id = ?';
            $params[] = $catId;
        }
        if ($etiqueta) {
            $where[]  = 'p.etiqueta = ?';
            $params[] = $etiqueta;
        }

        $whereStr = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $orderMap = [
            'precio-asc'  => 'p.precio_base ASC',
            'precio-desc' => 'p.precio_base DESC',
            'nombre'      => 'p.nombre ASC',
            'recientes'   => 'p.fecha_creacion DESC, p.id ASC',
            'populares'   => 'p.etiqueta ASC, p.nombre ASC',
        ];
        $orderBy = $orderMap[$orden] ?? 'p.fecha_creacion DESC';

        $total = (int)(dbRow(
            "SELECT COUNT(*) AS n FROM productos p $whereStr",
            $params
        )['n'] ?? 0);

        $params[] = $limit;
        $params[] = $offset;
        $productos = dbRows(
            "SELECT p.id, p.nombre, p.descripcion, p.precio_base AS precio, p.stock_disponible,
                    p.etiqueta, p.activo, p.categoria_id, p.fecha_creacion,
                    c.nombre AS categoria_nombre,
                    (SELECT url_imagen FROM imagenes_producto ip WHERE ip.producto_id = p.id AND ip.es_principal = 1 LIMIT 1) AS imagen_principal
             FROM productos p
             LEFT JOIN categorias c ON c.id = p.categoria_id
             $whereStr
             ORDER BY $orderBy
             LIMIT ? OFFSET ?",
            $params
        );

        $medidas = medidasDeProductos(array_column($productos, 'id'));
        foreach ($productos as &$prod) $prod['medidas'] = $medidas[(int)$prod['id']] ?? [];
        unset($prod);

        jsonSuccess([
            'productos'  => $productos,
            'paginacion' => getPaginacion($total, $page, $limit),
        ]);
        break;

    // ---- POST: Crear producto (admin) ----
    case 'POST':
        requerirGestion();
        requerirCsrf();
        $body = getJsonBody();
        requireFields($body, ['nombre', 'categoria_id', 'precio_base']);

        $nombre     = sanitize($body['nombre']);
        $catId      = sanitizeInt($body['categoria_id']);
        $precio     = sanitizeFloat($body['precio_base']);
        $desc       = sanitize($body['descripcion'] ?? '');
        $stock      = sanitizeInt($body['stock_disponible'] ?? 0);
        $etiqueta   = sanitize($body['etiqueta'] ?? '');
        $activo     = isset($body['activo']) ? (int)(bool)$body['activo'] : 1;

        $medidasNuevas = leerMedidasBody($body);
        if ($medidasNuevas) $precio = min($medidasNuevas);
        if ($precio <= 0) jsonError('precio_base debe ser mayor a 0', 422);
        if (!dbRow("SELECT id FROM categorias WHERE id = ?", [$catId])) {
            jsonError('categoria_id no válido', 422);
        }

        $productoId = dbInsert('productos', [
            'categoria_id'     => $catId,
            'nombre'           => $nombre,
            'descripcion'      => $desc,
            'precio_base'      => $precio,
            'stock_disponible' => $stock,
            'etiqueta'         => $etiqueta ?: null,
            'activo'           => $activo,
        ]);

        if (!empty($body['imagenes']) && is_array($body['imagenes'])) {
            foreach ($body['imagenes'] as $i => $img) {
                $url = sanitize($img['url'] ?? $img);
                if ($url && validarUrlImagen($url)) {
                    dbInsert('imagenes_producto', [
                        'producto_id'  => $productoId,
                        'url_imagen'   => $url,
                        'es_principal' => $i === 0 ? 1 : 0,
                        'orden'        => $i,
                    ]);
                }
            }
        }

        if (!empty($body['especificaciones']) && is_array($body['especificaciones'])) {
            foreach ($body['especificaciones'] as $spec) {
                $clave = sanitize($spec['clave'] ?? $spec['nombre'] ?? '');
                $valor = sanitize($spec['valor'] ?? '');
                if ($clave && $valor) {
                    dbInsert('especificaciones_producto', [
                        'producto_id' => $productoId,
                        'clave'       => $clave,
                        'valor'       => $valor,
                    ]);
                }
            }
        }

        if ($medidasNuevas) guardarMedidas($productoId, $medidasNuevas);

        jsonSuccess(['id' => $productoId, 'mensaje' => 'Producto creado'], 201);
        break;

    // ---- PUT: Actualizar producto (admin) ----
    case 'PUT':
        requerirGestion();
        requerirCsrf();
        if (!$id) jsonError('ID requerido', 400);
        if (!dbRow("SELECT id FROM productos WHERE id = ?", [$id])) {
            jsonError('Producto no encontrado', 404);
        }

        $body = getJsonBody();
        $update = [];

        if (isset($body['nombre']))           $update['nombre']           = sanitize($body['nombre']);
        if (isset($body['descripcion']))       $update['descripcion']      = sanitize($body['descripcion']);
        if (isset($body['precio_base']))       $update['precio_base']      = sanitizeFloat($body['precio_base']);
        if (isset($body['stock_disponible']))  $update['stock_disponible'] = sanitizeInt($body['stock_disponible']);
        if (isset($body['etiqueta']))          $update['etiqueta']         = sanitize($body['etiqueta']) ?: null;
        if (isset($body['activo']))            $update['activo']           = (int)(bool)$body['activo'];
        if (isset($body['categoria_id']))      $update['categoria_id']     = sanitizeInt($body['categoria_id']);
        $medidasNuevas = leerMedidasBody($body);
        if ($medidasNuevas) $update['precio_base'] = min($medidasNuevas);

        if (empty($update) && $medidasNuevas === null) jsonError('No hay campos para actualizar', 422);
        if ($update) dbUpdate('productos', $update, 'id = ?', [$id]);
        // Lista vacía = el modelo vuelve a precio único (sin selector de ancho).
        if ($medidasNuevas !== null) guardarMedidas($id, $medidasNuevas);

        if (isset($body['imagenes']) && is_array($body['imagenes'])) {
            dbQuery("DELETE FROM imagenes_producto WHERE producto_id = ?", [$id]);
            foreach ($body['imagenes'] as $i => $img) {
                $url = sanitize($img['url'] ?? $img);
                if ($url && validarUrlImagen($url)) {
                    dbInsert('imagenes_producto', [
                        'producto_id'  => $id,
                        'url_imagen'   => $url,
                        'es_principal' => $i === 0 ? 1 : 0,
                        'orden'        => $i,
                    ]);
                }
            }
        }

        if (isset($body['especificaciones']) && is_array($body['especificaciones'])) {
            dbQuery("DELETE FROM especificaciones_producto WHERE producto_id = ?", [$id]);
            foreach ($body['especificaciones'] as $spec) {
                $clave = sanitize($spec['clave'] ?? $spec['nombre'] ?? '');
                $valor = sanitize($spec['valor'] ?? '');
                if ($clave && $valor) {
                    dbInsert('especificaciones_producto', [
                        'producto_id' => $id,
                        'clave'       => $clave,
                        'valor'       => $valor,
                    ]);
                }
            }
        }

        jsonSuccess(['mensaje' => 'Producto actualizado']);
        break;

    // ---- DELETE: Desactivar (soft delete) ----
    case 'DELETE':
        requerirGestion();
        requerirCsrf();
        if (!$id) jsonError('ID requerido', 400);
        $rows = dbUpdate('productos', ['activo' => 0], 'id = ?', [$id]);
        if (!$rows) jsonError('Producto no encontrado', 404);
        jsonSuccess(['mensaje' => 'Producto desactivado']);
        break;

    default:
        jsonError('Método no permitido', 405);
}