<?php
require_once __DIR__ . '/_helpers.php';
require_once dirname(__DIR__) . '/includes/stripe.php';
require_once dirname(__DIR__) . '/includes/paypal.php';

// ── Anticipo (50%) / pago completo ─────────────────────────────────
// Calcula cuánto se debe cobrar EN ESTE PAGO: 50% si es el primer pago de
// un anticipo, o el saldo restante (segundo pago, o pago completo normal).
function montoPendienteAPagar(array $pedido): float {
    $total       = (float)$pedido['total'];
    $montoPagado = (float)($pedido['monto_pagado'] ?? 0);
    $tipoPago    = $pedido['tipo_pago'] ?? 'completo';
    if ($tipoPago === 'anticipo' && $montoPagado <= 0.009) {
        return round($total * 0.5, 2);
    }
    return round(max(0, $total - $montoPagado), 2);
}

// Acumula un pago aprobado en el pedido. Si el pedido todavía está en fase de
// pago (pendiente/anticipo_pagado/pagado), avanza el estado automáticamente.
// Si producción ya avanzó (listo_para_produccion/en_produccion/alistando_pedido/
// en_camino_instalacion/finalizado), NO se debe regresar el estado — solo se
// actualiza monto_pagado, conservando el progreso real.
function registrarPagoAprobado(int $pedidoId, float $montoPago): void {
    $pedido = dbRow("SELECT total, monto_pagado, estado, tipo_pago FROM pedidos WHERE id = ?", [$pedidoId]);
    if (!$pedido) return;

    $estadoPrevio      = $pedido['estado'];
    $montoPagadoPrevio = (float)$pedido['monto_pagado'];
    $total             = (float)$pedido['total'];
    $nuevoMontoPagado  = round($montoPagadoPrevio + $montoPago, 2);
    $liquidado         = $nuevoMontoPagado >= ($total - 0.01);
    // Es liquidación de saldo (no el primer pago) si ya había algo pagado antes.
    $esLiquidacionSaldo = $liquidado && $montoPagadoPrevio > 0.009;

    $datosUpdate = ['monto_pagado' => $nuevoMontoPagado];
    $estadosFasePago = ['pendiente', 'anticipo_pagado', 'pagado'];
    if (in_array($estadoPrevio, $estadosFasePago, true)) {
        $datosUpdate['estado'] = $liquidado ? 'pagado' : 'anticipo_pagado';
    }
    dbUpdate('pedidos', $datosUpdate, 'id = ?', [$pedidoId]);

    if ($esLiquidacionSaldo) {
        try {
            $pedidoActualizado = dbRow("SELECT * FROM pedidos WHERE id = ?", [$pedidoId]);
            if ($pedidoActualizado) {
                // Para el correo: indica que el saldo quedó liquidado, sin alterar
                // el estado real de fulfillment ya guardado en la base de datos.
                $pedidoActualizado['estado'] = 'pagado';
                notificarCambioPedido($pedidoActualizado, 'anticipo_pagado');
            }
        } catch (Exception $e) {
            appLog('warning', 'Notif saldo liquidado error', ['error' => $e->getMessage()]);
        }
    }
}

$method    = requestMethod();
$_rawBody  = file_get_contents('php://input');
$_jsonBody = json_decode($_rawBody, true) ?? [];
$action    = $_GET['action'] ?? $_jsonBody['accion'] ?? $_jsonBody['action'] ?? '';

// ── STRIPE ────────────────────────────────────────────
if ($action === 'stripe_intent') {
    if ($method !== 'POST') jsonError('Método no permitido', 405);
    requerirCsrf();
    $body     = $_jsonBody;
    requireFields($body, ['pedido_id']);
    $pedidoId = sanitizeInt($body['pedido_id']);
    if ($pedidoId <= 0) jsonError('pedido_id inválido', 422);
    $pedido   = dbRow("SELECT id, numero_pedido, nombre_cliente, correo_cliente, total, tipo_pago, monto_pagado FROM pedidos WHERE id = ?", [$pedidoId]);
    if (!$pedido) jsonError('Pedido no encontrado', 404);

    $montoACobrar = montoPendienteAPagar($pedido);
    if ($montoACobrar <= 0) jsonError('Este pedido ya está liquidado', 400);

    try {
        $amountCentavos = (int)round($montoACobrar * 100);
        $intent = stripe()->crearPaymentIntent($amountCentavos, 'mxn', [
            'pedido_id'      => (string)$pedidoId,
            'numero_pedido'  => $pedido['numero_pedido'],
            'correo_cliente' => $pedido['correo_cliente'],
        ]);

        dbInsert('pagos', [
            'pedido_id'          => $pedidoId,
            'metodo'             => 'stripe',
            'referencia_externa' => $intent['id'],
            'monto'              => $montoACobrar,
            'moneda'             => 'MXN',
            'estado'             => 'pendiente',
        ]);

        jsonSuccess([
            'client_secret'     => $intent['client_secret'],
            'payment_intent_id' => $intent['id'],
            'monto'             => $montoACobrar,
        ]);
    } catch (RuntimeException $e) {
        appLog('error', 'Stripe intent error', ['error' => $e->getMessage()]);
        jsonError('Error al crear pago con Stripe: ' . $e->getMessage(), 500);
    }
}

if ($action === 'stripe_confirm') {
    if ($method !== 'POST') jsonError('Método no permitido', 405);
    requerirCsrf();
    $body     = $_jsonBody;
    requireFields($body, ['payment_intent_id', 'pedido_id']);
    $piId     = trim($body['payment_intent_id']);
    $pedidoId = sanitizeInt($body['pedido_id']);

    try {
        $intent = stripe()->obtenerPaymentIntent($piId);
        $status = $intent['status'] ?? '';

        if ($status === 'succeeded') {
            $filasNuevas = dbUpdate('pagos', ['estado' => 'aprobado'], 'referencia_externa = ? AND estado != ?', [$piId, 'aprobado']);
            if ($filasNuevas > 0) {
                $pago = dbRow("SELECT monto FROM pagos WHERE referencia_externa = ?", [$piId]);
                if ($pago) registrarPagoAprobado($pedidoId, (float)$pago['monto']);
            }
            $pedido = dbRow("SELECT * FROM pedidos WHERE id = ?", [$pedidoId]);
            // Atómico: solo el primer proceso que llegue envía la notificación (evita duplicados)
            if ($pedido && dbUpdate('pedidos', ['notificacion_enviada' => 1], 'id = ? AND notificacion_enviada = 0', [$pedidoId]) > 0) {
                try {
                    $pedido['items']          = dbRows("SELECT nombre_producto, cantidad, precio_unitario FROM detalle_pedido WHERE pedido_id = ?", [$pedidoId]);
                    $pedido['metodo_pago']    = 'Stripe';
                    $pedido['referencia_pago'] = $piId;
                    $pedido['fecha_pago']      = date('d/m/Y H:i');
                    notificarNuevoPedido($pedido);
                } catch (Exception $e) {
                    appLog('warning', 'Notif stripe confirm fallback error', ['error' => $e->getMessage()]);
                }
            }
            jsonSuccess(['estado' => 'aprobado', 'mensaje' => 'Pago procesado exitosamente']);
        } elseif (in_array($status, ['requires_payment_method', 'requires_action', 'canceled'])) {
            dbQuery("UPDATE pagos SET estado = 'fallido' WHERE referencia_externa = ?", [$piId]);
            jsonError('El pago no pudo completarse. Estado: ' . $status, 400);
        } else {
            jsonSuccess(['estado' => $status, 'mensaje' => 'Pago en proceso']);
        }
    } catch (RuntimeException $e) {
        jsonError('Error verificando pago: ' . $e->getMessage(), 500);
    }
}

if ($action === 'stripe_webhook') {
    if ($method !== 'POST') jsonError('Método no permitido', 405);
    $sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

    try {
        $event = stripe()->verificarWebhook($_rawBody, $sigHeader);
        if (!$event) jsonError('Webhook inválido', 400);

        $type   = $event['type'] ?? '';
        $object = $event['data']['object'] ?? [];

        if ($type === 'payment_intent.succeeded') {
            $piId = $object['id'];
            $filasNuevas = dbUpdate('pagos', ['estado' => 'aprobado'], 'referencia_externa = ? AND estado != ?', [$piId, 'aprobado']);
            $pago = dbRow("SELECT pedido_id, monto FROM pagos WHERE referencia_externa = ?", [$piId]);
            if ($pago) {
                if ($filasNuevas > 0) registrarPagoAprobado((int)$pago['pedido_id'], (float)$pago['monto']);
                $pedido = dbRow("SELECT * FROM pedidos WHERE id = ?", [$pago['pedido_id']]);
                if ($pedido && dbUpdate('pedidos', ['notificacion_enviada' => 1], 'id = ? AND notificacion_enviada = 0', [$pago['pedido_id']]) > 0) {
                    try {
                        $pedido['items']           = dbRows("SELECT nombre_producto, cantidad, precio_unitario FROM detalle_pedido WHERE pedido_id = ?", [$pago['pedido_id']]);
                        $pedido['metodo_pago']     = 'Stripe';
                        $pedido['referencia_pago'] = $piId;
                        $pedido['fecha_pago']       = date('d/m/Y H:i');
                        notificarNuevoPedido($pedido);
                    } catch (Exception $e) {
                        appLog('error', 'Notif stripe webhook error', ['error' => $e->getMessage()]);
                    }
                }
            }
        } elseif ($type === 'payment_intent.payment_failed') {
            $piId = $object['id'];
            dbQuery("UPDATE pagos SET estado = 'fallido' WHERE referencia_externa = ?", [$piId]);
        }

        http_response_code(200);
        echo json_encode(['received' => true]);
        exit;
    } catch (RuntimeException $e) {
        jsonError('Webhook error: ' . $e->getMessage(), 400);
    }
}

// ── PAYPAL ────────────────────────────────────────────
if ($action === 'paypal_webhook') {
    if ($method !== 'POST') jsonError('Método no permitido', 405);

    $event = paypal()->verificarWebhook($_rawBody, $_SERVER);
    if (!$event) {
        http_response_code(400);
        echo json_encode(['error' => 'Webhook PayPal inválido o firma incorrecta']);
        exit;
    }

    $eventType = $event['event_type'] ?? '';
    $resource  = $event['resource']   ?? [];

    switch ($eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED':
            $orderId   = $resource['supplementary_data']['related_ids']['order_id'] ?? $resource['id'] ?? '';
            $captureId = $resource['id'] ?? '';
            if (strtoupper($resource['status'] ?? '') === 'COMPLETED' && $orderId) {
                $pagoPrevio = dbRow("SELECT pedido_id, monto, estado FROM pagos WHERE referencia_externa = ?", [$orderId]);
                $yaAprobado = $pagoPrevio && $pagoPrevio['estado'] === 'aprobado';
                dbQuery("UPDATE pagos SET estado = 'aprobado', referencia_externa = ? WHERE referencia_externa = ?", [$captureId, $orderId]);
                $pago = $pagoPrevio ?? dbRow("SELECT pedido_id, monto FROM pagos WHERE referencia_externa = ?", [$captureId]);
                if ($pago) {
                    if (!$yaAprobado) registrarPagoAprobado((int)$pago['pedido_id'], (float)$pago['monto']);
                    $pedido = dbRow("SELECT * FROM pedidos WHERE id = ?", [$pago['pedido_id']]);
                    if ($pedido && dbUpdate('pedidos', ['notificacion_enviada' => 1], 'id = ? AND notificacion_enviada = 0', [$pago['pedido_id']]) > 0) {
                        try {
                            $pedido['items']           = dbRows("SELECT nombre_producto, cantidad, precio_unitario FROM detalle_pedido WHERE pedido_id = ?", [$pago['pedido_id']]);
                            $pedido['metodo_pago']     = 'PayPal';
                            $pedido['referencia_pago'] = $captureId ?: $orderId;
                            $pedido['fecha_pago']       = date('d/m/Y H:i');
                            notificarNuevoPedido($pedido);
                        } catch (Exception $e) {
                            appLog('error', 'Notif paypal webhook error', ['error' => $e->getMessage()]);
                        }
                    }
                }
            }
            break;

        case 'PAYMENT.CAPTURE.DENIED':
        case 'PAYMENT.CAPTURE.DECLINED':
            $orderId = $resource['supplementary_data']['related_ids']['order_id'] ?? $resource['id'] ?? '';
            if ($orderId) dbQuery("UPDATE pagos SET estado = 'fallido' WHERE referencia_externa = ?", [$orderId]);
            break;

        case 'PAYMENT.CAPTURE.REFUNDED':
            $captureId = $resource['id'] ?? '';
            if ($captureId) {
                dbQuery("UPDATE pagos SET estado = 'reembolsado' WHERE referencia_externa = ?", [$captureId]);
                $pago = dbRow("SELECT pedido_id FROM pagos WHERE referencia_externa = ?", [$captureId]);
                if ($pago) dbUpdate('pedidos', ['estado' => 'cancelado'], 'id = ?', [$pago['pedido_id']]);
            }
            break;

        case 'CHECKOUT.ORDER.VOIDED':
            $orderId = $resource['id'] ?? '';
            if ($orderId) dbQuery("UPDATE pagos SET estado = 'fallido' WHERE referencia_externa = ?", [$orderId]);
            break;

        default:
            appLog('info', 'PayPal webhook evento no manejado', ['event_type' => $eventType]);
            break;
    }

    http_response_code(200);
    echo json_encode(['received' => true]);
    exit;
}

if ($action === 'paypal_orden') {
    if ($method !== 'POST') jsonError('Método no permitido', 405);
    requerirCsrf();
    $body     = $_jsonBody;
    requireFields($body, ['pedido_id']);
    $pedidoId = sanitizeInt($body['pedido_id']);
    $pedido   = dbRow("SELECT * FROM pedidos WHERE id = ?", [$pedidoId]);
    if (!$pedido) jsonError('Pedido no encontrado', 404);

    $montoACobrar = montoPendienteAPagar($pedido);
    if ($montoACobrar <= 0) jsonError('Este pedido ya está liquidado', 400);

    $returnUrl = APP_URL . '/pago?status=success&pedido_id=' . $pedidoId;
    $cancelUrl = APP_URL . '/pago?status=cancel';

    try {
        $order      = paypal()->crearOrden($montoACobrar, $pedido['numero_pedido'], $returnUrl, $cancelUrl);
        $orderId    = $order['id'] ?? '';
        $approveUrl = paypal()->getApproveUrl($order);

        dbInsert('pagos', [
            'pedido_id'          => $pedidoId,
            'metodo'             => 'paypal',
            'referencia_externa' => $orderId,
            'monto'              => $montoACobrar,
            'moneda'             => 'MXN',
            'estado'             => 'pendiente',
        ]);

        jsonSuccess(['order_id' => $orderId, 'approve_url' => $approveUrl]);
    } catch (RuntimeException $e) {
        appLog('error', 'PayPal orden error', ['error' => $e->getMessage()]);
        jsonError('Error al crear orden PayPal: ' . $e->getMessage(), 500);
    }
}

if ($action === 'paypal_capturar') {
    if ($method !== 'POST') jsonError('Método no permitido', 405);
    requerirCsrf();
    $body     = $_jsonBody;
    requireFields($body, ['order_id', 'pedido_id']);
    $orderId  = trim($body['order_id']);
    $pedidoId = sanitizeInt($body['pedido_id']);

    try {
        $capture = paypal()->capturarOrden($orderId);
        $status  = $capture['status'] ?? '';

        if ($status === 'COMPLETED') {
            $filasNuevas = dbUpdate('pagos', ['estado' => 'aprobado'], 'referencia_externa = ? AND estado != ?', [$orderId, 'aprobado']);
            if ($filasNuevas > 0) {
                $pago = dbRow("SELECT monto FROM pagos WHERE referencia_externa = ?", [$orderId]);
                if ($pago) registrarPagoAprobado($pedidoId, (float)$pago['monto']);
            }
            $pedido = dbRow("SELECT * FROM pedidos WHERE id = ?", [$pedidoId]);
            // Atómico: solo el primer proceso que llegue envía la notificación (evita duplicados)
            if ($pedido && dbUpdate('pedidos', ['notificacion_enviada' => 1], 'id = ? AND notificacion_enviada = 0', [$pedidoId]) > 0) {
                try {
                    $captureId = $capture['purchase_units'][0]['payments']['captures'][0]['id'] ?? $orderId;
                    $pedido['items']           = dbRows("SELECT nombre_producto, cantidad, precio_unitario FROM detalle_pedido WHERE pedido_id = ?", [$pedidoId]);
                    $pedido['metodo_pago']     = 'PayPal';
                    $pedido['referencia_pago'] = $captureId;
                    $pedido['fecha_pago']      = date('d/m/Y H:i');
                    notificarNuevoPedido($pedido);
                } catch (Exception $e) {
                    appLog('warning', 'Notif paypal capturar fallback error', ['error' => $e->getMessage()]);
                }
            }
            jsonSuccess(['estado' => 'aprobado', 'mensaje' => 'Pago PayPal completado']);
        } else {
            jsonError('Pago PayPal no completado. Estado: ' . $status, 400);
        }
    } catch (RuntimeException $e) {
        jsonError('Error capturando pago PayPal: ' . $e->getMessage(), 500);
    }
}

// ── Liquidar saldo manualmente (efectivo/transferencia/terminal) ──
// Nota: se deja abierta a todo el personal (requerirPersonal) a propósito
// — instalación la usa para marcar el saldo cobrado contra entrega en el
// momento de instalar. No tocar sin confirmar con el dueño del negocio.
if ($action === 'marcar_saldo_manual') {
    if ($method !== 'POST') jsonError('Método no permitido', 405);
    requerirPersonal();
    requerirCsrf();
    $body     = $_jsonBody;
    requireFields($body, ['pedido_id']);
    $pedidoId = sanitizeInt($body['pedido_id']);
    $pedido   = dbRow("SELECT id, total, monto_pagado, estado FROM pedidos WHERE id = ?", [$pedidoId]);
    if (!$pedido) jsonError('Pedido no encontrado', 404);

    $saldo = round((float)$pedido['total'] - (float)$pedido['monto_pagado'], 2);
    if ($saldo <= 0) jsonError('Este pedido ya está liquidado', 400);

    dbInsert('pagos', [
        'pedido_id'          => $pedidoId,
        'metodo'             => 'tarjeta',
        'referencia_externa' => 'manual-' . date('YmdHis'),
        'monto'              => $saldo,
        'moneda'             => 'MXN',
        'estado'             => 'aprobado',
    ]);
    registrarPagoAprobado($pedidoId, $saldo);

    jsonSuccess(['mensaje' => 'Saldo registrado como pagado', 'monto' => $saldo]);
}

// ── Registrar un pago manual por un MONTO específico (anticipo parcial,
// transferencia, efectivo, terminal) — a diferencia de marcar_saldo_manual
// (que liquida TODO lo que falta), aquí se captura exactamente lo que se
// recibió. Necesario para cotizaciones ya cerradas fuera del sitio (ej. un
// anticipo del 60% recibido por transferencia antes de cargar el pedido).
if ($action === 'registrar_pago_manual') {
    if ($method !== 'POST') jsonError('Método no permitido', 405);
    requerirVentasOGestion();
    requerirCsrf();
    $body     = $_jsonBody;
    requireFields($body, ['pedido_id', 'monto']);
    $pedidoId = sanitizeInt($body['pedido_id']);
    $monto    = round((float)$body['monto'], 2);
    $metodo   = in_array($body['metodo'] ?? '', ['transferencia', 'efectivo', 'terminal', 'tarjeta'], true)
        ? $body['metodo'] : 'transferencia';
    $referencia = trim((string)($body['referencia'] ?? ''));

    if ($monto <= 0) jsonError('El monto debe ser mayor a cero', 422);

    $pedido = dbRow("SELECT id, total, monto_pagado, estado FROM pedidos WHERE id = ?", [$pedidoId]);
    if (!$pedido) jsonError('Pedido no encontrado', 404);

    $saldoPendiente = round((float)$pedido['total'] - (float)$pedido['monto_pagado'], 2);
    if ($saldoPendiente <= 0) jsonError('Este pedido ya está liquidado', 400);
    if ($monto > $saldoPendiente + 0.01) {
        jsonError("El monto (\$" . number_format($monto, 2) . ") no puede ser mayor al saldo pendiente (\$" . number_format($saldoPendiente, 2) . ")", 422);
    }

    dbInsert('pagos', [
        'pedido_id'          => $pedidoId,
        'metodo'             => $metodo,
        'referencia_externa' => 'manual-' . date('YmdHis') . ($referencia !== '' ? '-' . sanitize(mb_substr($referencia, 0, 40)) : ''),
        'monto'              => $monto,
        'moneda'             => 'MXN',
        'estado'             => 'aprobado',
    ]);
    registrarPagoAprobado($pedidoId, $monto);

    jsonSuccess(['mensaje' => 'Pago registrado', 'monto' => $monto]);
}

// ── GET: Listar pagos (jefe/administrador — ledger financiero) ────
if ($method === 'GET') {
    requerirGestion();
    $pedidoId = sanitizeInt($_GET['pedido_id'] ?? 0);
    if ($pedidoId) {
        $pagos = dbRows("SELECT * FROM pagos WHERE pedido_id = ? ORDER BY fecha_creacion DESC", [$pedidoId]);
    } else {
        $page   = max(1, sanitizeInt($_GET['page'] ?? 1));
        $limit  = min(50, max(1, sanitizeInt($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $pagos  = dbRows("SELECT pa.*, pe.numero_pedido, pe.nombre_cliente FROM pagos pa LEFT JOIN pedidos pe ON pe.id = pa.pedido_id ORDER BY pa.fecha_creacion DESC LIMIT ? OFFSET ?", [$limit, $offset]);
    }
    jsonSuccess(['pagos' => $pagos]);
}

if (!$action && $method !== 'GET') {
    jsonError('Acción requerida. Usa: stripe_intent, stripe_confirm, stripe_webhook, paypal_orden, paypal_capturar', 400);
}