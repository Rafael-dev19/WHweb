<?php
require_once __DIR__ . '/_helpers.php';

$method = requestMethod();
$action = $_GET['action'] ?? '';
$id     = isset($_GET['id'])     ? sanitizeInt($_GET['id'])    : null;
$token  = isset($_GET['token'])  ? trim($_GET['token'])         : null;
$numero = isset($_GET['numero']) ? trim($_GET['numero'])        : null;

// ── Pedido cargado a mano por jefe/diseñador/ventas (encargo que hoy llega
// por WhatsApp/teléfono y se pasaba de palabra) — sin catálogo/precio, con
// descripción libre y/o nota de voz + fotos para el diseñador. Antes del
// switch porque no encaja en el POST de checkout de abajo (ese exige items
// de catálogo).
if ($method === 'POST' && $action === 'crear_manual') {
    $usuario = requerirPersonal();
    if (!in_array($usuario['rol'], ['jefe', 'disenador', 'ventas'], true)) {
        jsonError('Acceso denegado', 403);
    }
    requerirCsrf();
    checkRateLimit('pedidos_crear_manual', 20, 3600);

    $body = getJsonBody();
    requireFields($body, ['nombre_cliente']);

    $nombreCliente = sanitize($body['nombre_cliente']);
    if (mb_strlen($nombreCliente) < 2) jsonError('Nombre del cliente requerido', 422);

    $descripcion = sanitize($body['descripcion'] ?? '');
    $audioUrl    = trim($body['audio_url'] ?? '');
    if ($descripcion === '' && $audioUrl === '') {
        jsonError('Describe el proyecto por texto o adjunta una nota de voz', 422);
    }

    // Los adjuntos deben venir de Firebase Storage del proyecto — nunca una URL arbitraria.
    $storageHost = 'https://firebasestorage.googleapis.com/';
    $fotos = is_array($body['fotos'] ?? null) ? $body['fotos'] : [];
    $fotos = array_values(array_filter(array_map('trim', $fotos), fn($u) => strpos($u, $storageHost) === 0));
    if (count($fotos) > 10) jsonError('Máximo 10 fotos por pedido', 422);
    if ($audioUrl !== '' && strpos($audioUrl, $storageHost) !== 0) {
        jsonError('audio_url inválido', 422);
    }

    // El diseñador que lo carga se asigna a sí mismo; si lo carga el jefe
    // queda sin asignar y se avisa por push a todo el rol (puede haber más
    // de un diseñador activo) — el que lo tome lo abre desde su panel.
    $disenadorId = $usuario['rol'] === 'disenador' ? (int)$usuario['id'] : null;

    $numeroPedido = generarNumeroPedido();
    $tokenSeg     = generarTokenSeguimiento();

    $pedidoId = 0;
    try {
        db()->beginTransaction();

        $pedidoId = dbInsert('pedidos', [
            'numero_pedido'     => $numeroPedido,
            'token_seguimiento' => $tokenSeg,
            'nombre_cliente'    => $nombreCliente,
            'correo_cliente'    => '',
            'telefono_cliente'  => sanitize($body['telefono_cliente'] ?? ''),
            'tipo_entrega'      => 'envio',
            'direccion_envio'   => sanitize($body['direccion_envio'] ?? ''),
            'estado'            => 'pendiente',
            'disenador_id'      => $disenadorId,
            'mensaje_disenador' => $descripcion,
            'notas'             => 'Pedido cargado a mano desde el panel (encargo directo/WhatsApp).',
        ]);

        // Placeholder: el detalle real (medidas, materiales) lo define el
        // diseñador durante el trabajo — no hay catálogo/precio en el origen.
        dbInsert('detalle_pedido', [
            'pedido_id'       => $pedidoId,
            'producto_id'     => null,
            'nombre_producto' => 'Pedido personalizado — ver descripción para el diseñador',
            'cantidad'        => 1,
            'precio_unitario' => 0,
            'total_linea'     => 0,
        ]);

        foreach ($fotos as $url) {
            dbInsert('pedido_adjuntos', [
                'pedido_id'  => $pedidoId,
                'tipo'       => 'foto',
                'url'        => $url,
                'subido_por' => (int)$usuario['id'],
            ]);
        }
        if ($audioUrl !== '') {
            dbInsert('pedido_adjuntos', [
                'pedido_id'  => $pedidoId,
                'tipo'       => 'audio',
                'url'        => $audioUrl,
                'subido_por' => (int)$usuario['id'],
            ]);
        }

        db()->commit();
    } catch (Exception $e) {
        db()->rollBack();
        appLog('error', 'Error creando pedido manual', ['error' => $e->getMessage()]);
        jsonError('Error interno al crear el pedido', 500);
    }

    try {
        notificarPedidoManualCreado($pedidoId, $numeroPedido, $disenadorId);
    } catch (\Throwable $e) {}

    jsonSuccess(['pedido_id' => $pedidoId, 'numero_pedido' => $numeroPedido]);
}

// ── Ventas/jefe/administrador agrega contexto a un pedido YA existente
// (foto o nota de voz) — para que el diseñador tenga el panorama completo
// sin depender de que todo se haya capturado en la creación inicial. Antes
// del switch por la misma razón que crear_manual: no encaja en PUT (que es
// para cambiar estado/fecha/notas, no para adjuntar archivos).
if ($method === 'POST' && $action === 'agregar_adjunto') {
    $usuario = requerirVentasOGestion();
    requerirCsrf();
    checkRateLimit('pedidos_agregar_adjunto', 30, 3600);
    if (!$id) jsonError('ID requerido', 400);
    if (!dbRow("SELECT id FROM pedidos WHERE id = ?", [$id])) jsonError('Pedido no encontrado', 404);

    $body = getJsonBody();
    $tipo = $body['tipo'] ?? '';
    $url  = trim($body['url'] ?? '');
    if (!in_array($tipo, ['foto', 'audio'], true)) jsonError('tipo inválido. Usa: foto, audio', 422);

    $storageHost = 'https://firebasestorage.googleapis.com/';
    if (strpos($url, $storageHost) !== 0) jsonError('url inválida', 422);

    $totalAdjuntos = (int)(dbRow("SELECT COUNT(*) AS n FROM pedido_adjuntos WHERE pedido_id = ?", [$id])['n'] ?? 0);
    if ($totalAdjuntos >= 20) jsonError('Este pedido ya alcanzó el máximo de adjuntos (20).', 422);

    $adjId = dbInsert('pedido_adjuntos', [
        'pedido_id'  => $id,
        'tipo'       => $tipo,
        'url'        => $url,
        'subido_por' => (int)$usuario['id'],
    ]);
    jsonSuccess(['id' => $adjId, 'mensaje' => 'Adjunto agregado'], 201);
}

switch ($method) {
    case 'GET':
        if ($numero) {
            if (!preg_match('/^WH-\d{4}-\d{6}$/', $numero)) {
                jsonError('Formato de número inválido', 422);
            }
            // Búsqueda pública sin autenticar (folio no es secreto — es correlativo).
            // Solo los campos que /seguimiento realmente muestra: nada de correo,
            // teléfono, dirección ni el detalle de partidas (mismo criterio que ya
            // aplican citas.php y cotizaciones.php en su búsqueda por número).
            $pedido = dbRow(
                "SELECT numero_pedido, nombre_cliente, estado, total,
                        tipo_pago, monto_pagado, fecha_estimada, fecha_creacion
                 FROM pedidos WHERE numero_pedido = ?",
                [$numero]
            );
            if (!$pedido) jsonError('Pedido no encontrado', 404);
            jsonSuccess(['pedido' => $pedido]);
        }

        if ($token) {
            $pedido = dbRow(
                "SELECT id, numero_pedido, nombre_cliente, correo_cliente, telefono_cliente,
                        tipo_entrega, direccion_envio, incluye_instalacion, estado,
                        subtotal, costo_envio, costo_instalacion, descuento, total,
                        tipo_pago, monto_pagado,
                        fecha_estimada, fecha_creacion, notas
                 FROM pedidos WHERE token_seguimiento = ?",
                [$token]
            );
            if (!$pedido) jsonError('Pedido no encontrado', 404);
            $pedido['items'] = dbRows(
                "SELECT dp.id, dp.producto_id, dp.cantidad, dp.precio_unitario, dp.total_linea AS subtotal, dp.nombre_producto AS producto_nombre
                 FROM detalle_pedido dp WHERE dp.pedido_id = ?",
                [$pedido['id']]
            );
            jsonSuccess(['pedido' => $pedido]);
        }

        if ($id) {
            requerirPersonal();
            $pedido = dbRow("SELECT p.*, p.estado, p.total FROM pedidos p WHERE p.id = ?", [$id]);
            if (!$pedido) jsonError('Pedido no encontrado', 404);
            $items = dbRows(
                "SELECT dp.*, dp.nombre_producto AS producto_nombre FROM detalle_pedido dp WHERE dp.pedido_id = ?",
                [$id]
            );
            foreach ($items as &$item) {
                if (!empty($item['producto_id'])) {
                    try {
                        $specs = dbRows(
                            "SELECT clave, valor FROM especificaciones_producto WHERE producto_id = ? ORDER BY id",
                            [$item['producto_id']]
                        );
                        $item['especificaciones'] = $specs ?: [];
                    } catch (Exception $e) {
                        $item['especificaciones'] = [];
                    }
                } else {
                    $item['especificaciones'] = [];
                }
            }
            unset($item);
            $pedido['items'] = $items;
            $pedido['pagos'] = dbRows(
                "SELECT * FROM pagos WHERE pedido_id = ? ORDER BY fecha_creacion DESC",
                [$id]
            );
            try {
                $pedido['imagenes_diseno'] = dbRows(
                    "SELECT id, url_imagen, tipo, grupo, fecha_creacion FROM pedido_imagenes_diseno WHERE pedido_id = ? ORDER BY grupo, id",
                    [$id]
                );
            } catch (\Throwable $e) {
                $pedido['imagenes_diseno'] = [];
            }
            // Fotos/audio adjuntados al crear el pedido a mano (ver action=crear_manual) —
            // referencia de lo que el cliente pidió, distinto de imagenes_diseno (lo que
            // el diseñador produce).
            try {
                $pedido['adjuntos'] = dbRows(
                    "SELECT id, tipo, url, fecha_creacion FROM pedido_adjuntos WHERE pedido_id = ? ORDER BY id",
                    [$id]
                );
            } catch (\Throwable $e) {
                $pedido['adjuntos'] = [];
            }
            // Si el pedido nace de una cotización convertida (Fase 7), las partidas
            // cotizadas no caben en detalle_pedido (cantidades con decimales, ej.
            // "12.5 m²") — se adjunta aquí la cotización de origen completa para
            // que el diseñador/empleado vean qué se cotizó y con qué fotos.
            try {
                $cotOrigen = dbRow(
                    "SELECT id, numero_cotizacion, descripcion_respuesta, pdf_url, audio_respuesta_url
                     FROM cotizaciones WHERE pedido_id = ? LIMIT 1",
                    [$id]
                );
                if ($cotOrigen) {
                    $cotOrigen['items'] = dbRows(
                        "SELECT nombre_item, cantidad, unidad, precio_unitario, subtotal
                         FROM cotizacion_respuesta_items WHERE cotizacion_id = ? ORDER BY orden ASC, id ASC",
                        [$cotOrigen['id']]
                    );
                    $cotOrigen['imagenes'] = dbRows(
                        "SELECT url_imagen, tipo FROM cotizacion_imagenes WHERE cotizacion_id = ? ORDER BY tipo, orden ASC",
                        [$cotOrigen['id']]
                    );
                    $pedido['cotizacion_origen'] = $cotOrigen;
                }
            } catch (\Throwable $e) {
                // Tablas de la Fase 6 aún no migradas — no bloquear el detalle del pedido.
            }
            jsonSuccess(['pedido' => $pedido]);
        }

        requerirPersonal();
        $page   = max(1, sanitizeInt($_GET['page'] ?? 1));
        $limit  = min(50, max(1, sanitizeInt($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $estado = trim($_GET['estado'] ?? '');
        $busq   = sanitize($_GET['busqueda'] ?? '');
        $desde  = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['fecha_desde'] ?? '') ? $_GET['fecha_desde'] : '';
        $hasta  = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['fecha_hasta'] ?? '') ? $_GET['fecha_hasta'] : '';

        $estadosValidos = ['pendiente','anticipo_pagado','pagado',
            'listo_para_produccion','en_produccion','alistando_pedido','en_camino_instalacion','finalizado',
            'cancelado'];
        if ($estado && !in_array($estado, $estadosValidos, true)) $estado = '';

        $where = ['1=1']; $params = [];
        if ($estado) { $where[] = 'estado = ?'; $params[] = $estado; }
        if ($busq)   { $where[] = '(numero_pedido LIKE ? OR nombre_cliente LIKE ? OR correo_cliente LIKE ?)'; $params = array_merge($params, ["%$busq%", "%$busq%", "%$busq%"]); }
        if ($desde)  { $where[] = 'DATE(fecha_creacion) >= ?'; $params[] = $desde; }
        if ($hasta)  { $where[] = 'DATE(fecha_creacion) <= ?'; $params[] = $hasta; }

        $whereStr = 'WHERE ' . implode(' AND ', $where);
        $total = (int)(dbRow("SELECT COUNT(*) AS n FROM pedidos $whereStr", $params)['n'] ?? 0);
        $params[] = $limit; $params[] = $offset;
        try {
            $pedidos = dbRows(
                "SELECT id, numero_pedido, nombre_cliente, correo_cliente, telefono_cliente,
                        tipo_entrega, estado, total, tipo_pago, monto_pagado, fecha_estimada, fecha_creacion
                 FROM pedidos $whereStr ORDER BY fecha_creacion DESC LIMIT ? OFFSET ?",
                $params
            );
        } catch (Exception $e) {
            $pedidos = dbRows(
                "SELECT id, numero_pedido, nombre_cliente, correo_cliente, telefono_cliente,
                        tipo_entrega, estado, total, fecha_estimada, fecha_creacion
                 FROM pedidos $whereStr ORDER BY fecha_creacion DESC LIMIT ? OFFSET ?",
                $params
            );
            $pedidos = array_map(fn($p) => array_merge(['tipo_pago' => 'completo', 'monto_pagado' => 0], $p), $pedidos);
        }
        jsonSuccess(['pedidos' => $pedidos, 'paginacion' => getPaginacion($total, $page, $limit)]);
        break;

    case 'POST':
        requerirCsrf();
        checkRateLimit('pedidos_post', 10, 60);
        $body = getJsonBody();
        requireFields($body, ['nombre_cliente', 'correo_cliente', 'items']);

        // ── ANTI-BOT: Honeypot ────────────────────────────────────
        if (!empty($body['_hp']) || !empty($body['website']) || !empty($body['url'])) {
            // Silently fake success — no revelar que fue detectado
            jsonSuccess(['pedido_id' => 0, 'numero_pedido' => 'WH-' . date('Y') . '-000000', 'mensaje' => 'Pedido recibido']);
        }
        if (!isValidEmail($body['correo_cliente'])) jsonError('correo_cliente inválido', 422);
        if (empty($body['items']) || !is_array($body['items'])) jsonError('items requerido', 422);

        $tipoEntrega = $body['tipo_entrega'] ?? 'envio';
        if (!in_array($tipoEntrega, ['recoger', 'envio'])) $tipoEntrega = 'envio';
        if ($tipoEntrega === 'envio' && empty($body['direccion_envio'])) {
            jsonError('direccion_envio requerida para entrega a domicilio', 422);
        }

        $cpEnvio        = sanitize($body['cp_envio']        ?? '');
        $ciudadEnvio    = sanitize($body['ciudad_envio']    ?? '');
        $municipioEnvio = sanitize($body['municipio_envio'] ?? '');
        $coloniaEnvio   = sanitize($body['colonia_envio']   ?? '');

        $subtotal = 0;
        $itemsData = [];
        foreach ($body['items'] as $item) {
            $prodId = sanitizeInt($item['producto_id'] ?? 0);
            $cant   = max(1, sanitizeInt($item['cantidad'] ?? 1));
            $prod   = dbRow("SELECT id, nombre, precio_base, stock_disponible FROM productos WHERE id = ? AND activo = 1", [$prodId]);
            if (!$prod) jsonError("Producto ID $prodId no encontrado o inactivo", 422);
            $precioUnit = (float)$prod['precio_base'];
            $subProd    = $precioUnit * $cant;
            $subtotal  += $subProd;
            $itemsData[] = ['producto' => $prod, 'cantidad' => $cant, 'precio' => $precioUnit, 'subtotal' => $subProd];
        }

        $costoEnvio       = $tipoEntrega === 'envio' ? COSTO_ENVIO : 0;
        // Instalación: COSTO_INSTALACION por mueble × cantidad total de muebles
        // Coincide con la fórmula de checkout.js: costoInstUnit * totalMuebles
        $totalMuebles     = array_sum(array_column($itemsData, 'cantidad'));
        $costoInstalacion = !empty($body['incluye_instalacion'])
            ? (COSTO_INSTALACION * $totalMuebles)
            : 0;
        $descuento        = max(0, sanitizeFloat($body['descuento'] ?? 0));
        $total            = $subtotal + $costoEnvio + $costoInstalacion - $descuento;

        $tipoPago = ($body['tipo_pago'] ?? 'completo') === 'anticipo' ? 'anticipo' : 'completo';

        $numeroPedido = generarNumeroPedido();
        $tokenSeg     = generarTokenSeguimiento();
        $totalProductos = array_sum(array_column(array_map(fn($i) => ['c' => $i['cantidad']], $itemsData), 'c'));

        $fechaClienteRaw = trim($body['fecha_estimada'] ?? '');
        $fechaEst        = calcularFechaInteligente($tipoEntrega, $cpEnvio, $totalProductos);

        if (!empty($fechaClienteRaw) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaClienteRaw)) {
            $limite   = defined('LIMITE_DIA') ? LIMITE_DIA : 10;
            $cargaDia = (int)(dbRow(
                "SELECT COALESCE(SUM(dp.cantidad),0) AS total
                  FROM pedidos p
                  INNER JOIN detalle_pedido dp ON dp.pedido_id = p.id
                  WHERE p.fecha_estimada = ? AND p.estado NOT IN ('cancelado','finalizado')",
                [$fechaClienteRaw]
            )['total'] ?? 0);
            if (($limite - $cargaDia) >= $totalProductos) $fechaEst = $fechaClienteRaw;
        }

        $pedidoId = 0;
        try {
            db()->beginTransaction();

            $tieneColumnasZona  = false;
            $tieneColonia       = false;
            try { dbRows("SELECT cp_envio FROM pedidos LIMIT 0");     $tieneColumnasZona = true; } catch (Exception $e) {}
            try { dbRows("SELECT colonia_envio FROM pedidos LIMIT 0"); $tieneColonia      = true; } catch (Exception $e) {}
            $tieneMunicipio = false;
            try { dbRows("SELECT municipio_envio FROM pedidos LIMIT 0"); $tieneMunicipio  = true; } catch (Exception $e) {}
            $tieneTipoPago = false;
            try { dbRows("SELECT tipo_pago FROM pedidos LIMIT 0"); $tieneTipoPago = true; } catch (Exception $e) {}

            $datosPedido = [
                'numero_pedido'       => $numeroPedido,
                'token_seguimiento'   => $tokenSeg,
                'nombre_cliente'      => sanitize($body['nombre_cliente']),
                'correo_cliente'      => strtolower(trim($body['correo_cliente'])),
                'telefono_cliente'    => sanitize($body['telefono_cliente'] ?? ''),
                'tipo_entrega'        => $tipoEntrega,
                'direccion_envio'     => sanitize($body['direccion_envio'] ?? ''),
                'incluye_instalacion' => !empty($body['incluye_instalacion']) ? 1 : 0,
                'estado'              => 'pendiente',
                'subtotal'            => $subtotal,
                'costo_envio'         => $costoEnvio,
                'costo_instalacion'   => $costoInstalacion,
                'descuento'           => $descuento,
                'total'               => $total,
                'fecha_estimada'      => $fechaEst,
                'notas'               => sanitize($body['notas'] ?? ''),
            ];

            if ($tieneColumnasZona) {
                $datosPedido['cp_envio']     = $cpEnvio;
                $datosPedido['ciudad_envio'] = $ciudadEnvio;
            }
            if ($tieneColonia) {
                $datosPedido['colonia_envio'] = $coloniaEnvio;
            }
            if ($tieneMunicipio) {
                $datosPedido['municipio_envio'] = $municipioEnvio;
            }
            if ($tieneTipoPago) {
                $datosPedido['tipo_pago'] = $tipoPago;
            }

            // Coordenadas GPS del mapa picker (opcionales)
            $latEnvio = isset($body['lat_envio']) ? filter_var($body['lat_envio'], FILTER_VALIDATE_FLOAT) : false;
            $lngEnvio = isset($body['lng_envio']) ? filter_var($body['lng_envio'], FILTER_VALIDATE_FLOAT) : false;
            $tieneCoords = false;
            try { dbRows("SELECT lat FROM pedidos LIMIT 0"); $tieneCoords = true; } catch (Exception $e) {}
            if ($tieneCoords && $latEnvio !== false && $lngEnvio !== false) {
                $datosPedido['lat'] = $latEnvio;
                $datosPedido['lng'] = $lngEnvio;
            }

            $clienteSession = sesionClienteActiva();
            if ($clienteSession) {
                $datosPedido['cliente_id'] = $clienteSession['id'];
            }

            $pedidoId = dbInsert('pedidos', $datosPedido);

            if ($clienteSession) {
                $profileUpdate = [];
                if (!empty($body['telefono_cliente'])) $profileUpdate['telefono']  = sanitize($body['telefono_cliente']);
                if (!empty($body['direccion_envio']))  $profileUpdate['direccion'] = sanitize($body['direccion_envio']);
                if ($coloniaEnvio)                     $profileUpdate['colonia']   = $coloniaEnvio;
                if ($municipioEnvio)                   $profileUpdate['municipio'] = $municipioEnvio;
                if ($ciudadEnvio)                      $profileUpdate['ciudad']    = $ciudadEnvio;
                if ($cpEnvio)                          $profileUpdate['cp']        = $cpEnvio;
                if ($profileUpdate) {
                    try { dbUpdate('clientes', $profileUpdate, 'id = ?', [$clienteSession['id']]); }
                    catch (\Exception $e) { appLog('warning', 'No se pudo sincronizar perfil en pedido', ['e' => $e->getMessage()]); }
                }
            }

            foreach ($itemsData as $item) {
                dbInsert('detalle_pedido', [
                    'pedido_id'       => $pedidoId,
                    'producto_id'     => $item['producto']['id'],
                    'nombre_producto' => $item['producto']['nombre'],
                    'cantidad'        => $item['cantidad'],
                    'precio_unitario' => $item['precio'],
                    'total_linea'     => $item['subtotal'],
                ]);
            }

            db()->commit();
        } catch (Exception $e) {
            db()->rollBack();
            appLog('error', 'Error creando pedido', ['error' => $e->getMessage()]);
            jsonError('Error interno al crear el pedido', 500);
        }

        // El correo de confirmación se envía solo cuando se confirma el pago
        // en pagos.php (stripe_confirm, stripe_webhook, paypal_capturar, paypal_webhook)

        jsonSuccess([
            'pedido_id'         => $pedidoId,
            'numero_pedido'     => $numeroPedido,
            'token_seguimiento' => $tokenSeg,
            'total'             => $total,
            'tipo_pago'         => $tipoPago,
            'monto_a_pagar'     => $tipoPago === 'anticipo' ? round($total * 0.5, 2) : $total,
            'fecha_estimada'    => $fechaEst,
        ], 201);
        break;

    case 'PUT':
        $usuarioActual = requerirPersonal();
        requerirCsrf();
        if (!$id) jsonError('ID requerido', 400);
        $pedido = dbRow("SELECT * FROM pedidos WHERE id = ?", [$id]);
        if (!$pedido) jsonError('Pedido no encontrado', 404);

        $body   = getJsonBody();
        $update = [];

        // ── Máquina de estados estricta ────────────────────────────
        // 'pagado'/'anticipo_pagado' NUNCA se asignan manualmente aquí — solo
        // los produce un pago real (Stripe/PayPal/manual) vía api/pagos.php.
        if (isset($body['estado'])) {
            // Validar contra una whitelist ANTES de reflejar el valor en cualquier
            // mensaje de error — nunca interpolar input crudo del cliente sin filtrar.
            $estadosConocidos = ['pendiente','anticipo_pagado','pagado',
                'listo_para_produccion','en_produccion','alistando_pedido','en_camino_instalacion','finalizado',
                'cancelado'];
            if (!is_string($body['estado']) || !in_array($body['estado'], $estadosConocidos, true)) {
                jsonError('Estado inválido', 422);
            }
            // Cancelar es exclusivo de jefe/administrador — un empleado o disenador
            // no debe poder hacerlo ni siquiera llamando la API directamente.
            if ($body['estado'] === 'cancelado' && !in_array($usuarioActual['rol'], ['jefe', 'administrador'], true)) {
                jsonError('Solo jefe o administrador pueden cancelar pedidos', 403);
            }
            $estadoActual = $pedido['estado'];
            $transicionesValidas = [
                'pendiente'             => ['cancelado'],
                'anticipo_pagado'       => ['listo_para_produccion', 'cancelado'],
                'pagado'                => ['listo_para_produccion', 'cancelado'],
                'listo_para_produccion' => ['en_produccion', 'cancelado'],
                'en_produccion'         => ['alistando_pedido', 'cancelado'],
                'alistando_pedido'      => ['en_camino_instalacion', 'finalizado', 'cancelado'],
                'en_camino_instalacion' => ['finalizado'],
                'finalizado'            => [],
                'cancelado'             => [],
            ];
            $permitidos = $transicionesValidas[$estadoActual] ?? [];
            if (!in_array($body['estado'], $permitidos, true)) {
                jsonError("No se puede cambiar de '$estadoActual' a '{$body['estado']}'", 422);
            }

            if ($body['estado'] === 'listo_para_produccion') {
                // Solo el disenador (flujo normal) o jefe/administrador (override) pueden
                // liberar un pedido a producción. Un empleado nunca puede.
                if (!in_array($usuarioActual['rol'], ['disenador', 'jefe', 'administrador'], true)) {
                    jsonError('Solo el diseñador (o jefe/administrador) puede marcar un pedido listo para producción', 403);
                }
                // El requisito de pago (antes exigido para 'listo') se traslada aquí:
                // no tiene sentido diseñar/producir un pedido que nadie ha pagado.
                if ((float)($pedido['monto_pagado'] ?? 0) <= 0) {
                    jsonError('No se puede marcar listo para producción sin al menos el anticipo o pago registrado', 422);
                }
                // Normaliza 'imagenes': acepta tanto el formato viejo (array de URLs,
                // todas se guardaban como tipo 'otro') como el nuevo {url, tipo}, donde
                // tipo distingue el render (sketchup) del archivo de corte (vcarve) —
                // antes esa distinción existía en la tabla pero nunca se usaba de verdad.
                $imagenesRaw = $body['imagenes'] ?? [];
                $archivosDiseno = [];
                if (is_array($imagenesRaw)) {
                    foreach ($imagenesRaw as $img) {
                        if (is_string($img)) {
                            $url = $img; $tipo = 'otro'; $grupo = null;
                        } elseif (is_array($img)) {
                            $url = (string)($img['url'] ?? '');
                            $tipo = in_array($img['tipo'] ?? '', ['sketchup', 'vcarve', 'skp', 'otro'], true) ? $img['tipo'] : 'otro';
                            $grupo = isset($img['grupo']) ? sanitize(mb_substr((string)$img['grupo'], 0, 80)) : null;
                            if ($grupo === '') $grupo = null;
                        } else {
                            continue;
                        }
                        if (!filter_var($url, FILTER_VALIDATE_URL)) {
                            jsonError('Una de las imágenes/archivos de diseño no es una URL válida', 422);
                        }
                        $archivosDiseno[] = ['url' => $url, 'tipo' => $tipo, 'grupo' => $grupo];
                    }
                }

                // El diseñador (flujo normal, no el override de jefe/administrador) debe
                // entregar los DOS deliverables: al menos un render (sketchup) y al
                // menos un archivo de corte (vcarve) — un solo adjunto genérico ya no
                // basta, porque taller/instalación necesitan saber cuál es cuál.
                if ($usuarioActual['rol'] === 'disenador') {
                    $tieneRender = count(array_filter($archivosDiseno, fn($a) => $a['tipo'] === 'sketchup')) > 0;
                    $tieneCorte  = count(array_filter($archivosDiseno, fn($a) => $a['tipo'] === 'vcarve')) > 0;
                    if (!$tieneRender || !$tieneCorte) {
                        jsonError('Adjunta al menos un render (SketchUp) y al menos un archivo de corte (DXF/VCarve) antes de marcar listo para producción', 422);
                    }
                    foreach ($archivosDiseno as $a) {
                        dbInsert('pedido_imagenes_diseno', [
                            'pedido_id'  => $id,
                            'url_imagen' => $a['url'],
                            'tipo'       => $a['tipo'],
                            'grupo'      => $a['grupo'],
                            'subido_por' => (int)$usuarioActual['id'],
                        ]);
                    }
                    $update['disenador_id'] = (int)$usuarioActual['id'];
                    if (isset($body['mensaje_disenador'])) {
                        $update['mensaje_disenador'] = sanitize($body['mensaje_disenador']);
                    }
                } elseif (!empty($archivosDiseno)) {
                    // Override de jefe/administrador: si adjuntan archivos, se guardan
                    // con su tipo real (no forzados a 'otro'); si no adjuntan nada, se
                    // permite el override igual que antes (caso de excepción).
                    foreach ($archivosDiseno as $a) {
                        dbInsert('pedido_imagenes_diseno', [
                            'pedido_id'  => $id,
                            'url_imagen' => $a['url'],
                            'tipo'       => $a['tipo'],
                            'grupo'      => $a['grupo'],
                            'subido_por' => (int)$usuarioActual['id'],
                        ]);
                    }
                }
            } elseif ($usuarioActual['rol'] === 'disenador') {
                // El disenador SOLO puede ejecutar la transición de arriba — nada más.
                jsonError('El rol diseñador solo puede marcar pedidos como listos para producción', 403);
            }

            $update['estado'] = $body['estado'];
        }
        if (isset($body['fecha_estimada'])) $update['fecha_estimada'] = $body['fecha_estimada'];
        if (isset($body['notas']))           $update['notas']          = sanitize($body['notas']);

        if ($update) {
            try {
                dbUpdate('pedidos', $update, 'id = ?', [$id]);
            } catch (Throwable $e) {
                jsonError('Error al actualizar pedido: ' . $e->getMessage(), 500);
            }
        }

        if (!empty($update['estado']) && $update['estado'] !== $pedido['estado']) {
            try {
                if ($update['estado'] === 'listo_para_produccion') {
                    // Push a empleados: el pedido se vuelve visible/accionable para ellos.
                    notificarPedidoListoParaProduccion(array_merge($pedido, $update));
                } else {
                    notificarCambioPedido(array_merge($pedido, $update), $pedido['estado']);
                }
            } catch (Throwable $e) {}
        }

        jsonSuccess(['mensaje' => 'Pedido actualizado']);
        break;

    default:
        jsonError('Método no permitido', 405);
}