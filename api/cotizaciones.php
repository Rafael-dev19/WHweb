<?php
require_once __DIR__ . '/_helpers.php';

$method = requestMethod();
$id     = isset($_GET['id'])     ? sanitizeInt($_GET['id'])   : null;
$numero = isset($_GET['numero']) ? trim($_GET['numero'])      : null;
$token  = isset($_GET['token'])  ? trim($_GET['token'])       : null;
$action = $_GET['action'] ?? '';

// ── Asociar una imagen ya subida a Firebase Storage con la cotización ──
// (referencia del jefe en el cotizador — Fase 6; fotos del cliente — Fase 8)
if ($method === 'POST' && $action === 'agregar_imagen') {
    requerirVentasOGestion();
    requerirCsrf();
    if (!$id) jsonError('ID requerido', 400);
    if (!dbRow("SELECT id FROM cotizaciones WHERE id = ?", [$id])) jsonError('Cotización no encontrada', 404);
    $body = getJsonBody();
    $url  = trim($body['url_imagen'] ?? '');
    if (!filter_var($url, FILTER_VALIDATE_URL)) jsonError('url_imagen inválida', 422);
    $tipo = in_array($body['tipo'] ?? '', ['cliente_espacio', 'cliente_boceto', 'jefe_propuesta'], true)
        ? $body['tipo'] : 'jefe_propuesta';
    $newId = dbInsert('cotizacion_imagenes', [
        'cotizacion_id' => $id, 'tipo' => $tipo, 'url_imagen' => sanitize(mb_substr($url, 0, 350)),
    ]);
    jsonSuccess(['id' => $newId, 'mensaje' => 'Imagen agregada'], 201);
}

// ── El cliente adjunta fotos del espacio / boceto a SU PROPIA cotización ──
// (Fase 8 — cotizador rápido). Requiere sesión de cliente y que la
// cotización le pertenezca; límite de imágenes para evitar abuso.
if ($method === 'POST' && $action === 'agregar_imagen_cliente') {
    $cliente = requerirCliente();
    requerirCsrf();
    if (!$id) jsonError('ID requerido', 400);
    verificarPropiedadRecurso('cotizaciones', 'cliente_id', $id, (int)$cliente['id']);
    $body = getJsonBody();
    $url  = trim($body['url_imagen'] ?? '');
    if (!filter_var($url, FILTER_VALIDATE_URL)) jsonError('url_imagen inválida', 422);
    $tipo = in_array($body['tipo'] ?? '', ['cliente_espacio', 'cliente_boceto'], true)
        ? $body['tipo'] : 'cliente_espacio';
    $totalImgs = (int)(dbRow("SELECT COUNT(*) AS n FROM cotizacion_imagenes WHERE cotizacion_id = ?", [$id])['n'] ?? 0);
    if ($totalImgs >= 8) jsonError('Ya se alcanzó el máximo de imágenes para esta cotización.', 422);
    $newId = dbInsert('cotizacion_imagenes', [
        'cotizacion_id' => $id, 'tipo' => $tipo, 'url_imagen' => sanitize(mb_substr($url, 0, 350)),
    ]);
    jsonSuccess(['id' => $newId, 'mensaje' => 'Imagen agregada'], 201);
}

// ── El cliente confirma la propuesta desde el portal de seguimiento ──
// (público, por token — no requiere sesión de cliente).
if ($method === 'POST' && $action === 'confirmar') {
    requerirCsrf();
    checkRateLimit('cotizaciones_confirmar', 10, 300);
    $body  = getJsonBody();
    $tok   = trim($body['token'] ?? '');
    if (strlen($tok) < 16) jsonError('Token inválido', 400);

    $cot = dbRow("SELECT * FROM cotizaciones WHERE token_seguimiento = ?", [$tok]);
    if (!$cot) jsonError('Cotización no encontrada', 404);
    if ($cot['estado'] !== 'respondida') {
        jsonError('Esta cotización ya no está disponible para confirmar (puede que ya haya sido confirmada o esté cancelada).', 422);
    }

    dbUpdate('cotizaciones', [
        'confirmada_por_cliente' => 1,
        'estado'                 => 'aceptada',
        'fecha_confirmacion'     => date('Y-m-d H:i:s'),
    ], 'id = ?', [$cot['id']]);

    try {
        notificarConfirmacionCotizacion(array_merge($cot, ['estado' => 'aceptada']));
    } catch (Throwable $e) {
        appLog('warning', 'Notif confirmacion cotizacion falló', ['e' => $e->getMessage()]);
    }

    jsonSuccess(['mensaje' => '¡Gracias! Confirmamos tu cotización. Nos pondremos en contacto para continuar con tu proyecto.']);
}

// ── El jefe/administrador envía una cotización ya aceptada a producción ──
// Crea el pedido real; el precio ya negociado (precio_cotizado) se hereda tal
// cual, la ubicación se hereda intacta (se pasa hasta producción/entrega).
if ($method === 'POST' && $action === 'convertir_pedido') {
    requerirVentasOGestion();
    requerirCsrf();
    if (!$id) jsonError('ID requerido', 400);
    $cot = dbRow("SELECT * FROM cotizaciones WHERE id = ?", [$id]);
    if (!$cot) jsonError('Cotización no encontrada', 404);
    if ($cot['estado'] !== 'aceptada') {
        jsonError('Solo se puede enviar a producción una cotización ya aceptada por el cliente.', 422);
    }
    if (!empty($cot['pedido_id'])) jsonError('Esta cotización ya fue convertida a pedido.', 422);
    $total = (float)($cot['precio_cotizado'] ?? 0);
    if ($total <= 0) jsonError('La cotización no tiene un precio válido.', 422);

    $datosPedido = [
        'numero_pedido'       => generarNumeroPedido(),
        'token_seguimiento'   => bin2hex(random_bytes(16)),
        'nombre_cliente'      => $cot['nombre_cliente'],
        'correo_cliente'      => $cot['correo_cliente'],
        'telefono_cliente'    => $cot['telefono_cliente'],
        'tipo_entrega'        => 'envio',
        'direccion_envio'     => $cot['direccion'],
        'colonia_envio'       => $cot['colonia'],
        'ciudad_envio'        => $cot['ciudad'],
        'municipio_envio'     => $cot['municipio'],
        'cp_envio'            => $cot['cp'],
        'incluye_instalacion' => !empty($cot['requiere_instalacion']) ? 1 : 0,
        'fecha_estimada'      => $cot['fecha_entrega_estimada'],
        'subtotal'            => $total,
        'total'               => $total,
        'tipo_pago'           => 'completo',
        'estado'              => 'pendiente',
        'notas'               => 'Generado desde cotización ' . $cot['numero_cotizacion'],
    ];
    try {
        dbRows("SELECT lat FROM pedidos LIMIT 0");
        if (!empty($cot['lat'])) { $datosPedido['lat'] = $cot['lat']; $datosPedido['lng'] = $cot['lng'] ?? null; }
    } catch (Throwable $e) {}
    if (!empty($cot['cliente_id'])) $datosPedido['cliente_id'] = $cot['cliente_id'];

    db()->beginTransaction();
    try {
        $pedidoId = dbInsert('pedidos', $datosPedido);
        dbUpdate('cotizaciones', ['pedido_id' => $pedidoId, 'estado' => 'convertida_a_pedido'], 'id = ?', [$id]);
        db()->commit();
    } catch (Throwable $e) {
        db()->rollBack();
        jsonError('Error al convertir la cotización a pedido: ' . $e->getMessage(), 500);
    }

    try {
        $pedidoCompleto = dbRow("SELECT * FROM pedidos WHERE id = ?", [$pedidoId]);
        // El jefe ya recibió su push al confirmarse la cotización — aquí solo se
        // avisa al diseñador, que es quien tiene que diseñarlo.
        notificarNuevoPedido($pedidoCompleto, true);
    } catch (Throwable $e) {
        appLog('warning', 'Notif nuevo pedido (desde cotizacion) falló', ['e' => $e->getMessage()]);
    }

    jsonSuccess([
        'pedido_id' => $pedidoId, 'numero_pedido' => $datosPedido['numero_pedido'],
        'mensaje' => 'Cotización enviada a producción como pedido pendiente.',
    ], 201);
}

switch ($method) {
    case 'GET':
        if ($numero && !$id) {
            if (!preg_match('/^COT-\d{4,}-\d+$/i', $numero)) {
                jsonError('Formato de número inválido', 422);
            }
            $cot = dbRow(
                "SELECT numero_cotizacion, nombre_cliente, modelo_mueble,
                        descripcion_solicitud, estado, fecha_creacion
                 FROM cotizaciones WHERE numero_cotizacion = ?",
                [$numero]
            );
            if (!$cot) jsonError('Cotización no encontrada', 404);
            jsonSuccess(['cotizacion' => $cot]);
        }

        // ── Portal de seguimiento del cliente (público, por token) ──
        // Devuelve todo lo necesario para mostrar la propuesta y confirmarla:
        // precio, partidas, PDF, visita, y a qué pedido quedó ligada si ya se
        // convirtió.
        if ($token && !$id) {
            if (strlen($token) < 16) jsonError('Token inválido', 422);
            $cot = dbRow(
                "SELECT id, numero_cotizacion, nombre_cliente, estado, precio_cotizado,
                        descripcion_respuesta, fecha_visita, hora_visita, requiere_instalacion,
                        pdf_url, confirmada_por_cliente, fecha_confirmacion, pedido_id, fecha_creacion
                 FROM cotizaciones WHERE token_seguimiento = ?",
                [$token]
            );
            if (!$cot) jsonError('Cotización no encontrada', 404);
            $cot['items'] = dbRows(
                "SELECT nombre_item, cantidad, unidad, precio_unitario, subtotal
                 FROM cotizacion_respuesta_items WHERE cotizacion_id = ? ORDER BY orden ASC, id ASC",
                [$cot['id']]
            );
            if (!empty($cot['pedido_id'])) {
                $pedido = dbRow("SELECT numero_pedido FROM pedidos WHERE id = ?", [$cot['pedido_id']]);
                $cot['numero_pedido'] = $pedido['numero_pedido'] ?? null;
            }
            unset($cot['id'], $cot['pedido_id']);
            jsonSuccess(['cotizacion' => $cot]);
        }

        requerirVentasOGestion();
        if ($id) {
            $cot = dbRow("SELECT * FROM cotizaciones WHERE id = ?", [$id]);
            if (!$cot) jsonError('Cotización no encontrada', 404);
            $cot['items'] = dbRows(
                "SELECT id, clave_item, nombre_item, cantidad, unidad, precio_unitario, subtotal
                 FROM cotizacion_respuesta_items WHERE cotizacion_id = ? ORDER BY orden ASC, id ASC",
                [$id]
            );
            $cot['imagenes'] = dbRows(
                "SELECT id, tipo, url_imagen FROM cotizacion_imagenes WHERE cotizacion_id = ? ORDER BY tipo, orden ASC, id ASC",
                [$id]
            );
            if (!empty($cot['pedido_id'])) {
                $pedido = dbRow("SELECT numero_pedido FROM pedidos WHERE id = ?", [$cot['pedido_id']]);
                $cot['numero_pedido'] = $pedido['numero_pedido'] ?? null;
            }
            jsonSuccess(['cotizacion' => $cot]);
        }
        $page = max(1, sanitizeInt($_GET['page'] ?? 1));
        $limit = min(50, max(1, sanitizeInt($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $where = ['1=1']; $params = [];
        if (!empty($_GET['estado'])) { $where[] = 'estado = ?'; $params[] = $_GET['estado']; }
        if (!empty($_GET['busqueda'])) {
            $b = '%' . $_GET['busqueda'] . '%';
            $where[] = '(numero_cotizacion LIKE ? OR nombre_cliente LIKE ? OR correo_cliente LIKE ?)';
            $params = array_merge($params, [$b, $b, $b]);
        }
        $whereStr = 'WHERE ' . implode(' AND ', $where);
        $total = (int)(dbRow("SELECT COUNT(*) AS n FROM cotizaciones $whereStr", $params)['n'] ?? 0);
        $params[] = $limit; $params[] = $offset;
        $cots = dbRows("SELECT * FROM cotizaciones $whereStr ORDER BY fecha_creacion DESC LIMIT ? OFFSET ?", $params);
        jsonSuccess(['cotizaciones' => $cots, 'paginacion' => getPaginacion($total, $page, $limit)]);
        break;

    case 'POST':
        requerirCsrf();
        checkRateLimit('cotizaciones_post', 5, 60);
        $body = getJsonBody();
        requireFields($body, ['nombre_cliente', 'correo_cliente', 'telefono_cliente', 'descripcion_solicitud']);

        // ── ANTI-BOT: Honeypot ────────────────────────────────────
        if (!empty($body['_hp']) || !empty($body['website']) || !empty($body['url'])) {
            jsonSuccess(['numero_cotizacion' => 'COT-' . date('Y') . '-000000', 'mensaje' => 'Enviado']);
        }

        $emailCot = strtolower(trim($body['correo_cliente']));
        if (!isValidEmail($emailCot)) jsonError('Correo electrónico inválido', 422);
        if (strpbrk($emailCot, "'\"`;\\\n\r") !== false) jsonError('Correo electrónico contiene caracteres no permitidos', 422);

        if (!isValidPhone($body['telefono_cliente'])) jsonError('Teléfono inválido (mínimo 10 dígitos)', 422);

        if (mb_strlen($body['nombre_cliente'])        > 150)  jsonError('Nombre demasiado largo', 422);
        if (mb_strlen($body['descripcion_solicitud']) > 2000) jsonError('Descripción demasiado larga', 422);
        if (mb_strlen($body['medidas']              ?? '') > 600)  jsonError('Medidas demasiado largas', 422);
        if (mb_strlen($body['ciudad']               ?? '') > 100)  jsonError('Ciudad demasiado larga', 422);
        if (mb_strlen($body['colonia']              ?? '') > 120)  jsonError('Colonia demasiado larga', 422);
        if (mb_strlen($body['municipio']            ?? '') > 100)  jsonError('Municipio demasiado largo', 422);

        // ── Tipo de proyecto (Fase 8: reemplaza el viejo "modelo de mueble") ──
        $tiposMuebleValidos = ['cocina', 'closet', 'lavamanos', 'otro'];
        $tipoMueble = in_array($body['tipo_mueble'] ?? '', $tiposMuebleValidos, true) ? $body['tipo_mueble'] : 'otro';
        // Se conserva modelo_mueble (legado) con el mismo valor para no romper
        // las pantallas/reportes que todavía lo muestran (admin, seguimiento, emails).
        $modeloMuebleLabels = ['cocina' => 'Cocina', 'closet' => 'Closet', 'lavamanos' => 'Lavamanos', 'otro' => 'Otro'];
        $modeloMueble = $modeloMuebleLabels[$tipoMueble];

        // Nota: 'rango_presupuesto' y 'requiere_instalacion' YA NO se leen del
        // cliente aquí — este cotizador es solo un estimado; el jefe los define
        // tras la visita, al responder la cotización (Fase 6).

        $numCot = generarNumeroCotizacion();

        $descripcionCompleta = sanitize($body['descripcion_solicitud']);
        $extra = [];
        if (!empty($body['urgencia']))   $extra[] = 'Urgencia: '        . sanitize($body['urgencia']);
        if (!empty($body['referencia'])) $extra[] = 'Nos conoció por: ' . sanitize($body['referencia']);
        if ($extra) $descripcionCompleta .= ' | ' . implode(' | ', $extra);

        $direccionCot = sanitize($body['direccion'] ?? '');
        $coloniaCot   = sanitize($body['colonia']   ?? '');
        $municipioCot = sanitize($body['municipio'] ?? '');
        $ciudadCot    = sanitize($body['ciudad']    ?? '');
        $cpCot        = sanitize($body['cp']        ?? '');

        // Medidas del espacio (ancho/alto/fondo en metros — x/y/z para el cliente)
        $anchoEspacio = filter_var($body['ancho_espacio'] ?? null, FILTER_VALIDATE_FLOAT);
        $altoEspacio  = filter_var($body['alto_espacio']  ?? null, FILTER_VALIDATE_FLOAT);
        $fondoEspacio = filter_var($body['fondo_espacio'] ?? null, FILTER_VALIDATE_FLOAT);
        $lat = filter_var($body['lat'] ?? null, FILTER_VALIDATE_FLOAT);
        $lng = filter_var($body['lng'] ?? null, FILTER_VALIDATE_FLOAT);

        $datosCot = [
            'numero_cotizacion'     => $numCot,
            'nombre_cliente'        => sanitize($body['nombre_cliente']),
            'correo_cliente'        => $emailCot,
            'telefono_cliente'      => sanitize($body['telefono_cliente']),
            'direccion'             => $direccionCot ?: null,
            'colonia'               => $coloniaCot   ?: null,
            'municipio'             => $municipioCot ?: null,
            'ciudad'                => $ciudadCot    ?: null,
            'cp'                    => $cpCot        ?: null,
            'lat'                   => $lat !== false && $lat !== null ? $lat : null,
            'lng'                   => $lng !== false && $lng !== null ? $lng : null,
            'modelo_mueble'         => $modeloMueble,
            'tipo_mueble'           => $tipoMueble,
            'descripcion_solicitud' => $descripcionCompleta,
            'ancho_espacio'         => $anchoEspacio !== false && $anchoEspacio !== null ? $anchoEspacio : null,
            'alto_espacio'          => $altoEspacio  !== false && $altoEspacio  !== null ? $altoEspacio  : null,
            'fondo_espacio'         => $fondoEspacio !== false && $fondoEspacio !== null ? $fondoEspacio : null,
            'estado'                => 'nueva',
        ];
        $clienteSession = sesionClienteActiva();
        if ($clienteSession) {
            $tieneClienteId = false;
            try { dbRows("SELECT cliente_id FROM cotizaciones LIMIT 0"); $tieneClienteId = true; } catch (\Exception $e) {}
            if ($tieneClienteId) $datosCot['cliente_id'] = $clienteSession['id'];
        }
        $cotId = dbInsert('cotizaciones', $datosCot);

        if ($clienteSession) {
            $profileUpdate = [];
            if (!empty($body['telefono_cliente']))       $profileUpdate['telefono']  = sanitize($body['telefono_cliente']);
            if ($direccionCot && !$clienteSession['direccion']) $profileUpdate['direccion'] = $direccionCot;
            if ($coloniaCot   && !$clienteSession['colonia'])   $profileUpdate['colonia']   = $coloniaCot;
            if ($municipioCot && !$clienteSession['municipio']) $profileUpdate['municipio'] = $municipioCot;
            if ($ciudadCot    && !$clienteSession['ciudad'])    $profileUpdate['ciudad']    = $ciudadCot;
            if ($cpCot        && !$clienteSession['cp'])        $profileUpdate['cp']        = $cpCot;
            if ($profileUpdate) {
                try { dbUpdate('clientes', $profileUpdate, 'id = ?', [$clienteSession['id']]); }
                catch (\Exception $e) { appLog('warning', 'No se pudo sincronizar perfil en cotizacion', ['e' => $e->getMessage()]); }
            }
        }

        try {
            notificarNuevaCotizacion([
                'id'               => $cotId,
                'numero_cotizacion' => $numCot,
                'nombre_cliente'   => $body['nombre_cliente'],
                'correo_cliente'   => $body['correo_cliente'],
                'telefono_cliente' => $body['telefono_cliente'],
                'modelo_mueble'      => $modeloMueble,
                'descripcion'      => $descripcionCompleta,
            ]);
        } catch (Exception $e) {
            appLog('warning', 'Notif cotizacion falló', ['e' => $e->getMessage()]);
        }

        jsonSuccess(['cotizacion_id' => $cotId, 'numero_cotizacion' => $numCot], 201);
        break;

    case 'PUT':
        requerirVentasOGestion();   // jefe/administrador/ventas gestionan cotizaciones
        requerirCsrf();
        if (!$id) jsonError('ID requerido', 400);
        $cotActual = dbRow("SELECT * FROM cotizaciones WHERE id = ?", [$id]);
        if (!$cotActual) jsonError('Cotización no encontrada', 404);
        $body = getJsonBody();
        $update = [];

        // 'convertida_a_pedido' NO se asigna aquí — solo la produce la acción
        // dedicada ?action=convertir_pedido, que crea el pedido real.
        $estadosValidos = ['nueva', 'en_revision', 'respondida', 'aceptada',
                           'en_produccion', 'lista', 'entregada', 'cancelada'];
        $itemsParaGuardar = null;

        // ── Partidas del cotizador: se procesan siempre que vengan en el body,
        // sin importar si el estado cambia. Esto permite que el jefe "perfeccione"
        // una cotización ya aceptada (ajustar partidas) sin re-notificar al
        // cliente — solo notifica cuando el estado realmente pasa a 'respondida'.
        if (isset($body['items'])) {
            $itemsBody = $body['items'];
            if (!is_array($itemsBody) || count($itemsBody) < 1) {
                jsonError('Agrega al menos una partida al cotizador.', 422);
            }
            $itemsParaGuardar = [];
            $precioCalculado = 0.0;
            foreach ($itemsBody as $it) {
                $claveItem  = sanitize(mb_substr((string)($it['clave'] ?? ''), 0, 60));
                $nombreItem = sanitize(mb_substr((string)($it['nombre'] ?? ''), 0, 120));
                $cantidad   = max(0, (float)($it['cantidad'] ?? 0));
                $unidadItem = sanitize(mb_substr((string)($it['unidad'] ?? 'pza'), 0, 30)) ?: 'pza';
                $precioUnit = max(0, (float)($it['precio_unitario'] ?? 0));
                if ($claveItem === '' || $nombreItem === '' || $cantidad <= 0) continue;
                $itemsParaGuardar[] = [
                    'clave_item' => $claveItem, 'nombre_item' => $nombreItem,
                    'cantidad' => $cantidad, 'unidad' => $unidadItem, 'precio_unitario' => $precioUnit,
                ];
                $precioCalculado += round($cantidad * $precioUnit, 2);
            }
            if (count($itemsParaGuardar) < 1) {
                jsonError('Ninguna partida tiene datos válidos (clave, nombre y cantidad > 0).', 422);
            }
            if ($precioCalculado <= 0) jsonError('El total calculado de las partidas debe ser mayor a cero.', 422);
            // Nunca se confía en el total que mande el navegador — se recalcula aquí.
            $update['precio_cotizado'] = round($precioCalculado, 2);
        }

        if (isset($body['estado'])) {
            if (!in_array($body['estado'], $estadosValidos)) jsonError('Estado inválido', 422);

            // Al marcar/confirmar "respondida": precio y descripción obligatorios.
            if ($body['estado'] === 'respondida') {
                $tieneItemsPrevios = (int)(dbRow(
                    "SELECT COUNT(*) AS n FROM cotizacion_respuesta_items WHERE cotizacion_id = ?", [$id]
                )['n'] ?? 0) > 0;
                if ($itemsParaGuardar === null && !$tieneItemsPrevios) {
                    jsonError('Agrega al menos una partida al cotizador antes de responder.', 422);
                }
                $desc = trim($body['descripcion_respuesta'] ?? $cotActual['descripcion_respuesta'] ?? '');
                if (strlen($desc) < 10) jsonError('Ingresa la descripción de la propuesta (qué se fabricará).', 422);

                // El cliente necesita entrar al portal de seguimiento desde la
                // respuesta (para confirmar) — el token se asigna aquí, ya no al
                // pasar a producción.
                if (empty($cotActual['token_seguimiento'])) {
                    $update['token_seguimiento'] = bin2hex(random_bytes(16));
                }

                if (isset($body['fecha_visita'])) {
                    $fv = trim($body['fecha_visita']);
                    $update['fecha_visita'] = preg_match('/^\d{4}-\d{2}-\d{2}$/', $fv) ? $fv : null;
                }
                if (isset($body['hora_visita'])) {
                    $update['hora_visita'] = sanitize(mb_substr((string)$body['hora_visita'], 0, 20)) ?: null;
                }
                if (isset($body['requiere_instalacion'])) {
                    $update['requiere_instalacion'] = !empty($body['requiere_instalacion']) ? 1 : 0;
                }
                if (isset($body['pdf_url']) && filter_var($body['pdf_url'], FILTER_VALIDATE_URL)) {
                    $update['pdf_url'] = sanitize(mb_substr((string)$body['pdf_url'], 0, 350));
                }
            }

            $update['estado'] = $body['estado'];
        }

        if (isset($body['notas_admin']))          $update['notas_admin']          = sanitize($body['notas_admin']);
        if (isset($body['descripcion_respuesta'])) $update['descripcion_respuesta'] = sanitize($body['descripcion_respuesta']);
        if (isset($body['audio_respuesta_url'])) {
            $audioResp = trim((string)$body['audio_respuesta_url']);
            if ($audioResp !== '' && strpos($audioResp, 'https://firebasestorage.googleapis.com/') !== 0) {
                jsonError('audio_respuesta_url inválido', 422);
            }
            $update['audio_respuesta_url'] = $audioResp !== '' ? sanitize(mb_substr($audioResp, 0, 350)) : null;
        }
        if (isset($body['fecha_entrega_estimada'])) {
            $fe = trim($body['fecha_entrega_estimada']);
            $update['fecha_entrega_estimada'] = preg_match('/^\d{4}-\d{2}-\d{2}$/', $fe) ? $fe : null;
        }

        if ($itemsParaGuardar !== null) {
            db()->beginTransaction();
            try {
                if ($update) dbUpdate('cotizaciones', $update, 'id = ?', [$id]);
                dbQuery("DELETE FROM cotizacion_respuesta_items WHERE cotizacion_id = ?", [$id]);
                $orden = 0;
                foreach ($itemsParaGuardar as $it) {
                    dbInsert('cotizacion_respuesta_items', array_merge($it, [
                        'cotizacion_id' => $id,
                        'orden'         => $orden++,
                    ]));
                }
                db()->commit();
            } catch (Throwable $e) {
                db()->rollBack();
                jsonError('Error al guardar las partidas del cotizador: ' . $e->getMessage(), 500);
            }
        } elseif ($update) {
            dbUpdate('cotizaciones', $update, 'id = ?', [$id]);
        }

        // Recargar para tener todos los campos actualizados (incluye token recién asignado)
        $cotFinal = dbRow("SELECT * FROM cotizaciones WHERE id = ?", [$id]);

        // ── Disparar notificaciones por email según el estado nuevo ──
        $estadoNuevo   = $update['estado']      ?? null;
        $estadoAnterior = $cotActual['estado'];

        if ($estadoNuevo && $estadoNuevo !== $estadoAnterior) {
            try {
                switch ($estadoNuevo) {
                    case 'respondida':
                        notificarCotizacionRespondida($cotFinal);
                        break;
                    case 'en_produccion':
                        notificarCotizacionEnProduccion($cotFinal);
                        break;
                    case 'lista':
                        notificarCotizacionLista($cotFinal);
                        break;
                    case 'entregada':
                        notificarCotizacionEntregada($cotFinal);
                        break;
                }
            } catch (Exception $e) {
                appLog('warning', 'Notif cotizacion fallida', ['estado' => $estadoNuevo, 'e' => $e->getMessage()]);
            }
        }

        jsonSuccess(['mensaje' => 'Cotización actualizada', 'token_seguimiento' => $cotFinal['token_seguimiento'] ?? null]);
        break;

    default:
        jsonError('Método no permitido', 405);
}