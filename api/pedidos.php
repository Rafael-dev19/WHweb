<?php
require_once __DIR__ . '/_helpers.php';

$method = requestMethod();
$id     = isset($_GET['id'])     ? sanitizeInt($_GET['id'])    : null;
$token  = isset($_GET['token'])  ? trim($_GET['token'])         : null;
$numero = isset($_GET['numero']) ? trim($_GET['numero'])        : null;

switch ($method) {
    case 'GET':
        if ($numero) {
            if (!preg_match('/^WH-\d{4}-\d{6}$/', $numero)) {
                jsonError('Formato de número inválido', 422);
            }
            $pedido = dbRow(
                "SELECT id, numero_pedido, nombre_cliente, correo_cliente, telefono_cliente,
                        tipo_entrega, direccion_envio, incluye_instalacion, estado,
                        subtotal, costo_envio, costo_instalacion, descuento, total,
                        tipo_pago, monto_pagado,
                        fecha_estimada, fecha_creacion, notas
                 FROM pedidos WHERE numero_pedido = ?",
                [$numero]
            );
            if (!$pedido) jsonError('Pedido no encontrado', 404);
            $pedido['items'] = dbRows(
                "SELECT dp.id, dp.producto_id, dp.cantidad, dp.precio_unitario,
                        dp.total_linea AS subtotal, dp.nombre_producto AS producto_nombre
                 FROM detalle_pedido dp WHERE dp.pedido_id = ?",
                [$pedido['id']]
            );
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
            requerirEmpleado();
            $pedido = dbRow("SELECT p.*, p.estado, p.total FROM pedidos p WHERE p.id = ?", [$id]);
            if (!$pedido) jsonError('Pedido no encontrado', 404);
            $pedido['items'] = dbRows(
                "SELECT dp.*, dp.nombre_producto AS producto_nombre FROM detalle_pedido dp WHERE dp.pedido_id = ?",
                [$id]
            );
            $pedido['pagos'] = dbRows(
                "SELECT * FROM pagos WHERE pedido_id = ? ORDER BY fecha_creacion DESC",
                [$id]
            );
            jsonSuccess(['pedido' => $pedido]);
        }

        requerirEmpleado();
        $page   = max(1, sanitizeInt($_GET['page'] ?? 1));
        $limit  = min(50, max(1, sanitizeInt($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $estado = trim($_GET['estado'] ?? '');
        $busq   = sanitize($_GET['busqueda'] ?? '');
        $desde  = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['fecha_desde'] ?? '') ? $_GET['fecha_desde'] : '';
        $hasta  = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['fecha_hasta'] ?? '') ? $_GET['fecha_hasta'] : '';

        $estadosValidos = ['pendiente','anticipo_pagado','pagado','en_produccion','listo','entregado','cancelado'];
        if ($estado && !in_array($estado, $estadosValidos, true)) $estado = '';

        $where = ['1=1']; $params = [];
        if ($estado) { $where[] = 'estado = ?'; $params[] = $estado; }
        if ($busq)   { $where[] = '(numero_pedido LIKE ? OR nombre_cliente LIKE ? OR correo_cliente LIKE ?)'; $params = array_merge($params, ["%$busq%", "%$busq%", "%$busq%"]); }
        if ($desde)  { $where[] = 'DATE(fecha_creacion) >= ?'; $params[] = $desde; }
        if ($hasta)  { $where[] = 'DATE(fecha_creacion) <= ?'; $params[] = $hasta; }

        $whereStr = 'WHERE ' . implode(' AND ', $where);
        $total = (int)(dbRow("SELECT COUNT(*) AS n FROM pedidos $whereStr", $params)['n'] ?? 0);
        $params[] = $limit; $params[] = $offset;
        $pedidos = dbRows(
            "SELECT id, numero_pedido, nombre_cliente, correo_cliente, telefono_cliente,
                    tipo_entrega, estado, total, fecha_estimada, fecha_creacion
             FROM pedidos $whereStr ORDER BY fecha_creacion DESC LIMIT ? OFFSET ?",
            $params
        );
        jsonSuccess(['pedidos' => $pedidos, 'paginacion' => getPaginacion($total, $page, $limit)]);
        break;

    case 'POST':
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
                  WHERE p.fecha_estimada = ? AND p.estado NOT IN ('cancelado','entregado')",
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
        requerirEmpleado();
        if (!$id) jsonError('ID requerido', 400);
        $pedido = dbRow("SELECT * FROM pedidos WHERE id = ?", [$id]);
        if (!$pedido) jsonError('Pedido no encontrado', 404);

        $body   = getJsonBody();
        $update = [];
        $estadiosValidos = ['pendiente', 'anticipo_pagado', 'pagado', 'en_produccion', 'listo', 'entregado', 'cancelado'];

        if (isset($body['estado'])) {
            if (!in_array($body['estado'], $estadiosValidos)) jsonError('Estado inválido', 422);
            $update['estado'] = $body['estado'];
        }
        if (isset($body['fecha_estimada'])) $update['fecha_estimada'] = $body['fecha_estimada'];
        if (isset($body['notas']))           $update['notas']          = sanitize($body['notas']);

        if ($update) dbUpdate('pedidos', $update, 'id = ?', [$id]);

        if (!empty($update['estado']) && $update['estado'] !== $pedido['estado']) {
            try {
                notificarCambioPedido(array_merge($pedido, $update), $pedido['estado']);
            } catch (Exception $e) {}
        }

        jsonSuccess(['mensaje' => 'Pedido actualizado']);
        break;

    default:
        jsonError('Método no permitido', 405);
}