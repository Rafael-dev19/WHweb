<?php
require_once __DIR__ . '/_helpers.php';

$method = requestMethod();
$action = $_GET['action'] ?? '';
$id     = isset($_GET['id'])     ? sanitizeInt($_GET['id'])    : null;
$token  = isset($_GET['token'])  ? trim($_GET['token'])         : null;
$numero = isset($_GET['numero']) ? trim($_GET['numero'])        : null;

// Taller, instalación y diseño no ven cifras (ver puedeVerMontos en
// includes/auth.php): se quitan del JSON en el servidor — no basta con no
// pintarlas, porque cualquiera puede abrir las DevTools — y en su lugar va
// estado_pago, que es lo único que necesitan para no cerrar un pedido con
// saldo por cobrar.
function ocultarMontosPedido(array $p): array {
    $p['estado_pago'] = estadoPagoPedido($p);
    foreach (['subtotal', 'costo_envio', 'costo_instalacion', 'descuento', 'total', 'monto_pagado'] as $k) unset($p[$k]);
    if (isset($p['items']) && is_array($p['items'])) {
        $p['items'] = array_map(function ($it) {
            unset($it['precio_unitario'], $it['total_linea'], $it['subtotal']);
            return $it;
        }, $p['items']);
    }
    unset($p['pagos']);
    if (isset($p['cotizacion_origen']) && is_array($p['cotizacion_origen'])) {
        unset($p['cotizacion_origen']['pdf_url']);
        $p['cotizacion_origen']['items'] = array_map(function ($it) {
            unset($it['precio_unitario'], $it['subtotal']);
            return $it;
        }, $p['cotizacion_origen']['items'] ?? []);
    }
    return $p;
}

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

    // Productos del pedido: del catálogo o líneas a la medida (nombre libre +
    // cantidad/unidad/precio) — mismas columnas que usa el flujo del cliente
    // (detalle_pedido), para que taller/instalación vean siempre la misma
    // tabla sin importar si el pedido nació del carrito o se cargó a mano.
    $itemsRaw = is_array($body['items'] ?? null) ? $body['items'] : [];
    $items = [];
    foreach ($itemsRaw as $it) {
        if (!is_array($it)) continue;
        $nombreItem = sanitize(mb_substr((string)($it['nombre'] ?? ''), 0, 180));
        $cantidad   = max(0, (float)($it['cantidad'] ?? 0));
        if ($nombreItem === '' || $cantidad <= 0) continue;
        $unidad = in_array($it['unidad'] ?? '', ['pza', 'ml', 'm2', 'juego'], true) ? $it['unidad'] : 'pza';
        $precio = max(0, (float)($it['precio_unitario'] ?? 0));
        // Si viene de un modelo del catálogo (no línea a la medida), se liga
        // producto_id — igual que cuando el cliente lo agrega desde el sitio —
        // para que sus especificaciones reales (medidas, material) se puedan
        // mostrar junto a la línea. Se valida que el producto exista de verdad.
        $productoId = null;
        if (!empty($it['producto_id'])) {
            $pid = sanitizeInt($it['producto_id']);
            if ($pid && dbRow("SELECT id FROM productos WHERE id = ?", [$pid])) $productoId = $pid;
        }
        // "Este modelo pero en otras medidas" — viaja pegado a la línea hasta
        // taller/instalación, en vez de perderse en la descripción general.
        // Sin htmlspecialchars (a diferencia de sanitize()): las medidas
        // llevan comillas de pulgadas (24") y los paneles ya escapan al pintar.
        $medidas = mb_substr(trim(strip_tags((string)($it['medidas_personalizadas'] ?? ''))), 0, 1000);
        // Mueble de baño: ancho, cubierta (MDF/piedra), color e info extra;
        // modelo fuera de catálogo: foto que trajo el cliente (Firebase Storage).
        $ancho    = sanitizeInt($it['ancho_cm'] ?? 0);
        $cubierta = in_array($it['cubierta'] ?? '', ['mdf', 'cuarzo', 'granito', 'marmol'], true) ? $it['cubierta'] : null;
        $color    = mb_substr(trim(strip_tags((string)($it['color'] ?? ''))), 0, 80);
        $info     = mb_substr(trim(strip_tags((string)($it['info_extra'] ?? ''))), 0, 2000);
        $imgRef   = trim((string)($it['imagen_referencia'] ?? ''));
        // 'NO_LLEVA' = el cliente no quiere ovalín/monomando (distinto de "por definir").
        $ovalinIt    = ($it['ovalin'] ?? '') === 'NO_LLEVA' ? 'No lleva'
            : (is_string($it['ovalin'] ?? null) && whOvalinValido($it['ovalin']) ? $it['ovalin'] : null);
        $monomandoIt = ($it['monomando'] ?? '') === 'NO_LLEVA' ? 'No lleva'
            : (is_string($it['monomando'] ?? null) && whMonomandoValido($it['monomando']) ? $it['monomando'] : null);
        [$adicIt] = whAdicionalesElegidos($it['adicionales'] ?? []);
        if ($imgRef !== '' && strpos($imgRef, 'https://firebasestorage.googleapis.com/') !== 0) $imgRef = '';
        $items[] = [
            'producto_id' => $productoId, 'nombre' => $nombreItem, 'cantidad' => $cantidad, 'unidad' => $unidad,
            'precio_unitario' => $precio, 'medidas' => $medidas,
            'ancho_cm' => ($ancho > 0 && $ancho <= 1000) ? $ancho : null,
            'cubierta' => $cubierta, 'color' => $color, 'info_extra' => $info, 'imagen_referencia' => $imgRef,
            // En el pedido manual el precio lo pone ventas (ya incluye los
            // adicionales que eligió); aquí solo se guarda qué lleva.
            'ovalin' => $ovalinIt, 'monomando' => $monomandoIt, 'adicionales' => $adicIt ? whAdicionalesTexto($adicIt) : null,
        ];
    }
    $tipoProyecto = in_array($body['tipo_proyecto'] ?? '', ['bano', 'cocina', 'closet'], true) ? $body['tipo_proyecto'] : 'bano';

    // Teléfonos adicionales que da el cliente (pareja, encargado de obra...).
    $telefonosSec = [];
    foreach ((is_array($body['telefonos_secundarios'] ?? null) ? $body['telefonos_secundarios'] : []) as $tel) {
        $tel = sanitize(mb_substr(trim((string)$tel), 0, 30));
        if ($tel !== '' && !in_array($tel, $telefonosSec, true)) $telefonosSec[] = $tel;
    }
    if (count($telefonosSec) > 10) jsonError('Máximo 10 teléfonos secundarios', 422);

    // Fecha de entrega/instalación acordada con el cliente — la misma columna
    // (fecha_estimada) que elige el cliente en el carrito, así aparece igual
    // en el calendario y en el detalle que ve el instalador.
    $fechaEntrega = trim((string)($body['fecha_estimada'] ?? ''));
    if ($fechaEntrega !== '') {
        $dt = DateTime::createFromFormat('Y-m-d', $fechaEntrega);
        if (!$dt || $dt->format('Y-m-d') !== $fechaEntrega) jsonError('Fecha de entrega inválida', 422);
        if ($fechaEntrega < date('Y-m-d')) jsonError('La fecha de entrega no puede ser anterior a hoy', 422);
    }
    $totalItems = array_sum(array_map(fn($it) => round($it['cantidad'] * $it['precio_unitario'], 2), $items));

    // Entrega igual que en el carrito: envío (con o sin instalación) o recoger.
    $tipoEntrega = ($body['tipo_entrega'] ?? 'envio') === 'recoger' ? 'recoger' : 'envio';
    $incluyeInstalacion = ($tipoEntrega === 'envio' && !empty($body['incluye_instalacion'])) ? 1 : 0;
    $direccionEnvio = $tipoEntrega === 'recoger' ? '' : sanitize($body['direccion_envio'] ?? '');

    // Montos y pago: solo los captura quien cobra (jefe/ventas). Si el pedido
    // lo carga el diseñador, se ignoran — no ve cifras (ver puedeVerMontos).
    $veMontos     = puedeVerMontos($usuario);
    $costoEnvio   = $veMontos && $tipoEntrega === 'envio' ? round(max(0, (float)($body['costo_envio'] ?? 0)), 2) : 0.0;
    $costoInst    = $veMontos && $incluyeInstalacion ? round(max(0, (float)($body['costo_instalacion'] ?? 0)), 2) : 0.0;
    $descuento    = $veMontos ? round(max(0, (float)($body['descuento'] ?? 0)), 2) : 0.0;
    $tipoPagoSel  = $veMontos && in_array($body['tipo_pago'] ?? '', ['completo', 'anticipo', 'sin_pago'], true) ? $body['tipo_pago'] : 'sin_pago';
    $montoRecibido = $veMontos && $tipoPagoSel !== 'sin_pago' ? round(max(0, (float)($body['monto_pagado'] ?? 0)), 2) : 0.0;
    $metodoPago   = in_array($body['metodo_pago'] ?? '', ['efectivo', 'transferencia', 'terminal', 'tarjeta'], true) ? $body['metodo_pago'] : 'efectivo';
    $referenciaPago = sanitize(mb_substr(trim((string)($body['referencia_pago'] ?? '')), 0, 40));

    if (!$veMontos) {
        // Sin cifras para el diseñador: los precios de las líneas tampoco cuentan.
        foreach ($items as &$itSinPrecio) $itSinPrecio['precio_unitario'] = 0;
        unset($itSinPrecio);
        $totalItems = 0;
    }
    $totalPedido = round(max(0, $totalItems + $costoEnvio + $costoInst - $descuento), 2);
    $subtotalPedido = $totalItems;
    // Total acordado con el cliente (proyecto grande, paquete, ajuste): manda
    // sobre la suma de los muebles. El subtotal se ajusta para que el desglose
    // (subtotal + envío + instalación − descuento) siga cuadrando.
    $totalAcordado = $veMontos ? round(max(0, (float)($body['total_acordado'] ?? 0)), 2) : 0.0;
    if ($totalAcordado > 0) {
        $totalPedido = $totalAcordado;
        $subtotalPedido = round(max(0, $totalAcordado - $costoEnvio - $costoInst + $descuento), 2);
    }
    if ($tipoPagoSel === 'completo') {
        if ($totalPedido <= 0) jsonError('Para "Pagó completo" captura el precio de los muebles (el total no puede ser $0).', 422);
        $montoRecibido = $totalPedido;
    }
    if ($tipoPagoSel === 'anticipo' && ($montoRecibido <= 0 || $montoRecibido >= $totalPedido)) {
        jsonError('El anticipo debe ser mayor a $0 y menor al total del pedido.', 422);
    }
    // tipo_pago del pedido (mismo significado que en el carrito): 'anticipo'
    // si queda saldo por cobrar al entregar, 'completo' si se pagó todo.
    $tipoPagoPedido = $tipoPagoSel === 'completo' ? 'completo' : 'anticipo';

    if ($descripcion === '' && $audioUrl === '' && !$items) {
        jsonError('Describe el proyecto por texto, adjunta una nota de voz, o agrega al menos un producto', 422);
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

    // Mismo patrón defensivo que el checkout: si la migración de
    // telefonos_secundarios / medidas_personalizadas (ver schema.sql) aún no
    // corrió en este servidor, el dato no se pierde — se agrega a las notas
    // del pedido, que el instalador también ve.
    $tieneTelSec = false;
    try { dbRows("SELECT telefonos_secundarios FROM pedidos LIMIT 0"); $tieneTelSec = true; } catch (Exception $e) {}
    $tieneMedidas = false;
    try { dbRows("SELECT medidas_personalizadas FROM detalle_pedido LIMIT 0"); $tieneMedidas = true; } catch (Exception $e) {}
    $tieneDetalleBano = false;
    try { dbRows("SELECT ancho_cm, cubierta, color, info_extra, imagen_referencia FROM detalle_pedido LIMIT 0"); $tieneDetalleBano = true; } catch (Exception $e) {}
    $tieneAccesoriosM = false;
    try { dbRows("SELECT ovalin, monomando, adicionales FROM detalle_pedido LIMIT 0"); $tieneAccesoriosM = true; } catch (Exception $e) {}
    if (!$tieneAccesoriosM) {
        // Migración (b) pendiente: no perder lo elegido — va al texto de extra.
        foreach ($items as &$itAcc) {
            $extra = implode(' · ', array_filter([
                $itAcc['ovalin'] ? "Ovalín {$itAcc['ovalin']}" : '',
                $itAcc['monomando'] ? "Monomando {$itAcc['monomando']}" : '',
                $itAcc['adicionales'] ? "Adicionales: {$itAcc['adicionales']}" : '',
            ]));
            if ($extra !== '') $itAcc['info_extra'] = trim($extra . "\n" . $itAcc['info_extra']);
        }
        unset($itAcc);
    }
    $tieneTipoProyecto = false;
    try { dbRows("SELECT tipo_proyecto FROM pedidos LIMIT 0"); $tieneTipoProyecto = true; } catch (Exception $e) {}
    $etiquetasCubierta = ['mdf' => 'Tapa de MDF', 'cuarzo' => 'Cuarzo', 'granito' => 'Granito', 'marmol' => 'Mármol'];

    $notas = 'Pedido cargado a mano desde el panel (encargo directo/WhatsApp).';
    if ($telefonosSec && !$tieneTelSec) {
        $notas .= "\nOtros teléfonos: " . implode(', ', $telefonosSec);
    }
    if (!$tieneMedidas) {
        foreach ($items as $it) {
            if ($it['medidas'] !== '') $notas .= "\nMedidas personalizadas — {$it['nombre']}: {$it['medidas']}";
        }
    }
    if (!$tieneDetalleBano) {
        foreach ($items as $it) {
            $partes = array_filter([
                $it['ancho_cm'] ? "{$it['ancho_cm']} cm" : '',
                $it['cubierta'] ? 'Cubierta: ' . $etiquetasCubierta[$it['cubierta']] : '',
                $it['color'] !== '' ? "Color: {$it['color']}" : '',
                $it['info_extra'] !== '' ? "Extra: {$it['info_extra']}" : '',
                $it['imagen_referencia'] !== '' ? "Foto: {$it['imagen_referencia']}" : '',
            ]);
            if ($partes) $notas .= "\n{$it['nombre']} — " . implode(' · ', $partes);
        }
    }

    // Aviso (no bloqueo): ventas acuerda la fecha con el cliente por teléfono,
    // pero conviene saber si ese día ya rebasa la capacidad del taller — el
    // mismo límite (LIMITE_DIA) que el carrito usa para ofrecer fechas.
    $avisoCapacidad = null;
    if ($fechaEntrega !== '') {
        $limite   = defined('LIMITE_DIA') ? LIMITE_DIA : 10;
        $cargaDia = (float)(dbRow(
            "SELECT COALESCE(SUM(dp.cantidad),0) AS total
              FROM pedidos p
              INNER JOIN detalle_pedido dp ON dp.pedido_id = p.id
              WHERE p.fecha_estimada = ? AND p.estado NOT IN ('cancelado','finalizado')",
            [$fechaEntrega]
        )['total'] ?? 0);
        $piezas = array_sum(array_map(fn($it) => $it['unidad'] === 'pza' ? $it['cantidad'] : 1, $items)) ?: 1;
        if ($cargaDia + $piezas > $limite) {
            $avisoCapacidad = "Ojo: el {$fechaEntrega} ya hay {$cargaDia} mueble(s) programados (límite diario: {$limite}).";
        }
    }

    $pedidoId = 0;
    try {
        db()->beginTransaction();

        $datosPedido = [
            'numero_pedido'     => $numeroPedido,
            'token_seguimiento' => $tokenSeg,
            'nombre_cliente'    => $nombreCliente,
            'correo_cliente'    => '',
            'telefono_cliente'  => sanitize($body['telefono_cliente'] ?? ''),
            'tipo_entrega'      => $tipoEntrega,
            'direccion_envio'   => $direccionEnvio,
            'incluye_instalacion' => $incluyeInstalacion,
            'fecha_estimada'    => $fechaEntrega !== '' ? $fechaEntrega : null,
            'estado'            => 'pendiente',
            'disenador_id'      => $disenadorId,
            'mensaje_disenador' => $descripcion,
            'notas'             => $notas,
            'subtotal'          => $subtotalPedido,
            'costo_envio'       => $costoEnvio,
            'costo_instalacion' => $costoInst,
            'descuento'         => $descuento,
            'total'             => $totalPedido,
            'tipo_pago'         => $tipoPagoPedido,
        ];
        if ($tieneTipoProyecto) $datosPedido['tipo_proyecto'] = $tipoProyecto;
        if ($tieneTelSec) {
            $datosPedido['telefonos_secundarios'] = $telefonosSec ? json_encode($telefonosSec, JSON_UNESCAPED_UNICODE) : null;
        }
        $pedidoId = dbInsert('pedidos', $datosPedido);

        if ($items) {
            foreach ($items as $it) {
                $linea = [
                    'pedido_id'       => $pedidoId,
                    'producto_id'     => $it['producto_id'],
                    'nombre_producto' => $it['nombre'],
                    'cantidad'        => $it['cantidad'],
                    'unidad'          => $it['unidad'],
                    'precio_unitario' => $it['precio_unitario'],
                    'total_linea'     => round($it['cantidad'] * $it['precio_unitario'], 2),
                ];
                if ($tieneMedidas && $it['medidas'] !== '') $linea['medidas_personalizadas'] = $it['medidas'];
                if ($tieneDetalleBano) {
                    $linea['ancho_cm']          = $it['ancho_cm'];
                    $linea['cubierta']          = $it['cubierta'];
                    $linea['color']             = $it['color'] !== '' ? $it['color'] : null;
                    $linea['info_extra']        = $it['info_extra'] !== '' ? $it['info_extra'] : null;
                    $linea['imagen_referencia'] = $it['imagen_referencia'] !== '' ? $it['imagen_referencia'] : null;
                }
                if ($tieneAccesoriosM) {
                    $linea['ovalin']      = $it['ovalin'];
                    $linea['monomando']   = $it['monomando'];
                    $linea['adicionales'] = $it['adicionales'];
                }
                dbInsert('detalle_pedido', $linea);
            }
        } else {
            // Sin productos capturados — el detalle real (medidas, materiales)
            // lo define el diseñador durante el trabajo.
            dbInsert('detalle_pedido', [
                'pedido_id'       => $pedidoId,
                'producto_id'     => null,
                'nombre_producto' => 'Pedido personalizado — ver descripción para el diseñador',
                'cantidad'        => 1,
                'precio_unitario' => 0,
                'total_linea'     => 0,
            ]);
        }

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

        // Pago que ventas ya recibió (mostrador/transferencia): mismo registro
        // que un pago del sitio — queda en el historial de pagos y el pedido
        // pasa a anticipo_pagado/pagado, listo para que el diseñador lo tome.
        if ($montoRecibido > 0) {
            $pagoInicial = [
                'pedido_id'          => $pedidoId,
                'metodo'             => $metodoPago,
                'referencia_externa' => 'manual-' . date('YmdHis') . ($referenciaPago !== '' ? '-' . $referenciaPago : ''),
                'monto'              => $montoRecibido,
                'moneda'             => 'MXN',
                'estado'             => 'aprobado',
            ];
            if (pagosTieneRegistradoPor()) $pagoInicial['registrado_por'] = (int)$usuario['id'];
            dbInsert('pagos', $pagoInicial);
            registrarPagoAprobado($pedidoId, $montoRecibido);
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

    jsonSuccess(['pedido_id' => $pedidoId, 'numero_pedido' => $numeroPedido, 'aviso_capacidad' => $avisoCapacidad]);
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

// ── Descarga de los entregables del diseñador (proyecto .skp y cortes del
// CNC). Pasa por aquí y no directo a Firebase porque: 1) el taller necesita
// el archivo con su NOMBRE ORIGINAL ("HOJA 1 BLANCA.nc") y Firebase lo
// entregaría con la ruta completa codificada; 2) una carpeta de cortes se
// baja de una sola vez en un .zip con la misma estructura que generó el
// programa de corte. Parámetros: archivo=<id> | grupo=<nombre> | todos=1.
if ($method === 'GET' && $action === 'descargar_diseno') {
    requerirPersonal();
    checkRateLimit('pedidos_descargar_diseno', 120, 3600);

    // Los errores se muestran como texto: esto se abre como enlace, no por fetch.
    $falla = function (string $msg, int $code) {
        http_response_code($code);
        header('Content-Type: text/plain; charset=utf-8');
        echo $msg;
        exit;
    };
    if (!$id) $falla('Pedido no indicado.', 400);
    $pedidoDl = dbRow("SELECT id, numero_pedido FROM pedidos WHERE id = ?", [$id]);
    if (!$pedidoDl) $falla('Pedido no encontrado.', 404);

    if (isset($_GET['archivo'])) {
        $filas = dbRows("SELECT id, url_imagen, tipo, grupo FROM pedido_imagenes_diseno WHERE pedido_id = ? AND id = ?",
                        [$id, sanitizeInt($_GET['archivo'])]);
    } elseif (isset($_GET['grupo'])) {
        $filas = dbRows("SELECT id, url_imagen, tipo, grupo FROM pedido_imagenes_diseno WHERE pedido_id = ? AND tipo = 'vcarve' AND COALESCE(grupo, 'Cortes') = ? ORDER BY id",
                        [$id, (string)$_GET['grupo']]);
    } else {
        $filas = dbRows("SELECT id, url_imagen, tipo, grupo FROM pedido_imagenes_diseno WHERE pedido_id = ? AND tipo = 'vcarve' ORDER BY grupo, id", [$id]);
    }
    if (!$filas) $falla('No se encontró el archivo.', 404);

    // Solo se descarga del bucket del proyecto (evita usar el servidor como
    // proxy hacia cualquier URL guardada en la base de datos).
    $bucket = getenv('FIREBASE_STORAGE_BUCKET') ?: 'woodenhouse-898de.firebasestorage.app';
    $prefijo = 'https://firebasestorage.googleapis.com/v0/b/' . $bucket . '/o/';
    $nombreDe = function (string $url) use ($prefijo): ?string {
        if (strpos($url, $prefijo) !== 0) return null;
        $ruta = rawurldecode(explode('?', substr($url, strlen($prefijo)), 2)[0]);
        $nombre = basename(str_replace('\\', '/', $ruta));
        $nombre = preg_replace('/[\x00-\x1F"\/\\\\:*?<>|]/u', '_', $nombre);
        return ($nombre === '' || $nombre === '.' || $nombre === '..') ? null : $nombre;
    };
    $bajar = function (string $url, int $max) use ($falla): string {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT        => 120,
            CURLOPT_PROTOCOLS      => CURLPROTO_HTTPS,
            CURLOPT_NOPROGRESS     => false,
            CURLOPT_PROGRESSFUNCTION => fn($c, $dlTotal, $dl) => ($dl > $max || $dlTotal > $max) ? 1 : 0,
        ]);
        $datos = curl_exec($ch);
        $code  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($datos === false || $code !== 200) $falla('No se pudo obtener el archivo del almacenamiento. Intenta de nuevo.', 502);
        return $datos;
    };
    $enviar = function (string $nombre, string $tipo, string $datos) {
        $ascii = preg_replace('/[^A-Za-z0-9._ -]/', '_', $nombre);
        header_remove('Pragma');
        header('Content-Type: ' . $tipo);
        header('Content-Length: ' . strlen($datos));
        header("Content-Disposition: attachment; filename=\"{$ascii}\"; filename*=UTF-8''" . rawurlencode($nombre));
        header('Cache-Control: private, no-store');
        echo $datos;
        exit;
    };

    // Un solo archivo: tal cual, con su nombre original.
    if (isset($_GET['archivo'])) {
        $f = $filas[0];
        $nombre = $nombreDe($f['url_imagen']);
        if ($nombre === null) $falla('Este archivo no está en el almacenamiento del proyecto.', 404);
        $enviar($nombre, 'application/octet-stream', $bajar($f['url_imagen'], 80 * 1024 * 1024));
    }

    // Carpeta(s) de cortes → .zip con "Carpeta/HOJA 1 BLANCA.nc". ZIP sin
    // compresión armado a mano (el servidor no siempre trae la extensión zip;
    // los .nc son texto chico, comprimir no ahorra nada que importe).
    $entradas = [];
    $total = 0;
    foreach ($filas as $f) {
        $nombre = $nombreDe($f['url_imagen']);
        if ($nombre === null) continue;
        $carpeta = html_entity_decode((string)($f['grupo'] ?? 'Cortes'), ENT_QUOTES, 'UTF-8');
        $carpeta = trim(preg_replace('/[\x00-\x1F"\/\\\\:*?<>|]/u', '_', $carpeta), ' .') ?: 'Cortes';
        $ruta = $carpeta . '/' . $nombre;
        for ($n = 2; isset($entradas[$ruta]); $n++) {
            $ruta = $carpeta . '/' . pathinfo($nombre, PATHINFO_FILENAME) . " ($n)." . pathinfo($nombre, PATHINFO_EXTENSION);
        }
        $datos = $bajar($f['url_imagen'], 30 * 1024 * 1024);
        $total += strlen($datos);
        if ($total > 150 * 1024 * 1024) $falla('La descarga es demasiado grande; baja las carpetas una por una.', 413);
        $entradas[$ruta] = $datos;
    }
    if (!$entradas) $falla('No hay archivos de corte para descargar.', 404);

    $t = getdate();
    $dosHora  = ($t['hours'] << 11) | ($t['minutes'] << 5) | intdiv($t['seconds'], 2);
    $dosFecha = (max(0, $t['year'] - 1980) << 9) | ($t['mon'] << 5) | $t['mday'];
    $zip = ''; $central = '';
    foreach ($entradas as $ruta => $datos) {
        $crc = crc32($datos); $tam = strlen($datos); $offset = strlen($zip);
        // 0x0800 = nombres en UTF-8 (para "BAÑOS5", acentos, etc.)
        $zip .= pack('VvvvvvVVVvv', 0x04034b50, 20, 0x0800, 0, $dosHora, $dosFecha, $crc, $tam, $tam, strlen($ruta), 0) . $ruta . $datos;
        $central .= pack('VvvvvvvVVVvvvvvVV', 0x02014b50, 20, 20, 0x0800, 0, $dosHora, $dosFecha, $crc, $tam, $tam, strlen($ruta), 0, 0, 0, 0, 0, $offset) . $ruta;
    }
    $inicioCentral = strlen($zip);
    $zip .= $central . pack('VvvvvVVv', 0x06054b50, 0, 0, count($entradas), count($entradas), strlen($central), $inicioCentral, 0);

    $base = ($pedidoDl['numero_pedido'] ?: 'Pedido-' . $id);
    if (isset($_GET['grupo'])) $base .= '-' . explode('/', array_key_first($entradas))[0];
    $enviar($base . '-cortes.zip', 'application/zip', $zip);
}

switch ($method) {
    case 'GET':
        if ($numero) {
            if (!preg_match('/^WH-\d{4}-\d{6}$/', $numero)) {
                jsonError('Formato de número inválido', 422);
            }
            // Búsqueda pública sin autenticar. El folio es CONSECUTIVO: antes
            // devolvía nombre y total, así que recorriendo WH-…-000001, 000002…
            // se sacaba la lista de clientes con lo que pagó cada uno. Ahora,
            // sin prueba de propiedad solo se ve estado/fechas y el nombre
            // enmascarado; montos (y pagar el saldo) requieren el token del
            // correo (?t=) o la sesión del cliente dueño del pedido.
            checkRateLimit('pedidos_folio', 30, 600);
            $pedido = dbRow(
                "SELECT id, cliente_id, token_seguimiento, numero_pedido, nombre_cliente, estado, total,
                        tipo_pago, monto_pagado, fecha_estimada, fecha_creacion
                 FROM pedidos WHERE numero_pedido = ?",
                [$numero]
            );
            if (!$pedido) jsonError('Pedido no encontrado', 404);
            $tokenFolio = trim((string)($_GET['t'] ?? ''));
            $clienteSes = sesionClienteActiva();
            $esDueno = ($tokenFolio !== '' && hash_equals((string)$pedido['token_seguimiento'], $tokenFolio))
                || ($clienteSes && $pedido['cliente_id'] && (int)$clienteSes['id'] === (int)$pedido['cliente_id']);
            unset($pedido['token_seguimiento'], $pedido['cliente_id']);
            if (!$esDueno) {
                $pedido = [
                    'numero_pedido'  => $pedido['numero_pedido'],
                    'nombre_cliente' => enmascararNombre($pedido['nombre_cliente']),
                    'estado'         => $pedido['estado'],
                    'fecha_estimada' => $pedido['fecha_estimada'],
                    'fecha_creacion' => $pedido['fecha_creacion'],
                    'parcial'        => true,
                ];
            }
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
            $usuarioGet = requerirPersonal();
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
            if (!puedeVerMontos($usuarioGet)) $pedido = ocultarMontosPedido($pedido);
            jsonSuccess(['pedido' => $pedido]);
        }

        $usuarioGet = requerirPersonal();
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
        if (!puedeVerMontos($usuarioGet)) $pedidos = array_map('ocultarMontosPedido', $pedidos);
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
            // Catálogo 2026: el precio depende del ancho elegido. Siempre se
            // toma de producto_medidas — nunca del precio que mande el navegador.
            $ancho = sanitizeInt($item['ancho_cm'] ?? 0) ?: null;
            $medidasProd = [];
            try { $medidasProd = dbRows("SELECT ancho_cm, precio FROM producto_medidas WHERE producto_id = ?", [$prodId]); } catch (\Throwable $e) {}
            if ($medidasProd) {
                $fila = $ancho ? current(array_filter($medidasProd, fn($m) => (int)$m['ancho_cm'] === $ancho)) : false;
                if (!$fila) jsonError("Elige un ancho válido para {$prod['nombre']}", 422);
                $precioUnit = (float)$fila['precio'];
            } else {
                $ancho = null;
            }
            // Accesorios (includes/accesorios.php): ovalín y monomando van
            // incluidos (solo se valida el código); los adicionales suman.
            $ovalin    = is_string($item['ovalin'] ?? null) && whOvalinValido($item['ovalin']) ? $item['ovalin'] : null;
            $monomando = is_string($item['monomando'] ?? null) && whMonomandoValido($item['monomando']) ? $item['monomando'] : null;
            [$adicionales, $costoAdic] = whAdicionalesElegidos($item['adicionales'] ?? []);
            $precioUnit += $costoAdic;
            $subProd    = $precioUnit * $cant;
            $subtotal  += $subProd;
            $itemsData[] = ['producto' => $prod, 'cantidad' => $cant, 'precio' => $precioUnit, 'subtotal' => $subProd, 'ancho_cm' => $ancho,
                            'ovalin' => $ovalin, 'monomando' => $monomando, 'adicionales' => $adicionales];
        }

        $costoEnvio       = $tipoEntrega === 'envio' ? COSTO_ENVIO : 0;
        // Instalación: COSTO_INSTALACION por mueble × cantidad total de muebles
        // Coincide con la fórmula de checkout.js: costoInstUnit * totalMuebles
        $totalMuebles     = array_sum(array_column($itemsData, 'cantidad'));
        $costoInstalacion = !empty($body['incluye_instalacion'])
            ? (COSTO_INSTALACION * $totalMuebles)
            : 0;
        // El descuento NUNCA se toma tal cual del navegador (antes sí: bastaba
        // mandar "descuento": 9000 para pagar casi nada y que el pedido quedara
        // "pagado"). Solo se aplica si viene un código de oferta vigente, con
        // la misma regla que api/ofertas.php?action=validar.
        $descuento = 0.0;
        $ofertaAplicada = null;
        $codigoDesc = strtoupper(trim((string)($body['codigo_descuento'] ?? '')));
        if ($codigoDesc !== '' && preg_match('/^[A-Z0-9_-]{2,40}$/', $codigoDesc)) {
            $hoyDesc = date('Y-m-d');
            $ofertaAplicada = dbRow(
                "SELECT * FROM ofertas WHERE codigo = ? AND activo = 1
                   AND (fecha_inicio IS NULL OR fecha_inicio <= ?)
                   AND (fecha_fin IS NULL OR fecha_fin >= ?)
                   AND (usos_maximos IS NULL OR usos_actuales < usos_maximos) LIMIT 1",
                [$codigoDesc, $hoyDesc, $hoyDesc]
            );
            if ($ofertaAplicada) {
                $baseDesc = $subtotal + $costoEnvio + $costoInstalacion;
                if ($ofertaAplicada['tipo'] === 'porcentaje') {
                    $descuento = round($subtotal * min(100, max(0, (float)$ofertaAplicada['valor'])) / 100, 2);
                } elseif ($ofertaAplicada['tipo'] === 'monto_fijo') {
                    $descuento = min((float)$ofertaAplicada['valor'], $subtotal);
                } elseif ($ofertaAplicada['tipo'] === 'envio_gratis') {
                    $descuento = $costoEnvio;
                }
                $descuento = max(0, min($descuento, $baseDesc));
            }
        }
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

            $tieneAncho = false;
            try { dbRows("SELECT ancho_cm FROM detalle_pedido LIMIT 0"); $tieneAncho = true; } catch (Exception $e) {}
            $tieneAccesorios = false;
            try { dbRows("SELECT ovalin, monomando, adicionales FROM detalle_pedido LIMIT 0"); $tieneAccesorios = true; } catch (Exception $e) {}
            foreach ($itemsData as $item) {
                $linea = [
                    'pedido_id'       => $pedidoId,
                    'producto_id'     => $item['producto']['id'],
                    'nombre_producto' => $item['producto']['nombre'] . ($item['ancho_cm'] ? " — {$item['ancho_cm']} cm" : ''),
                    'cantidad'        => $item['cantidad'],
                    'precio_unitario' => $item['precio'],
                    'total_linea'     => $item['subtotal'],
                ];
                if ($tieneAncho && $item['ancho_cm']) $linea['ancho_cm'] = $item['ancho_cm'];
                if ($tieneAccesorios) {
                    $linea['ovalin']      = $item['ovalin'];
                    $linea['monomando']   = $item['monomando'];
                    $linea['adicionales'] = $item['adicionales'] ? whAdicionalesTexto($item['adicionales']) : null;
                } elseif ($item['ovalin'] || $item['monomando'] || $item['adicionales']) {
                    $linea['nombre_producto'] .= ' (' . implode(' · ', array_filter([
                        $item['ovalin'] ? "Ovalín {$item['ovalin']}" : '',
                        $item['monomando'] ? "Monomando {$item['monomando']}" : '',
                        whAdicionalesTexto($item['adicionales']),
                    ])) . ')';
                }
                dbInsert('detalle_pedido', $linea);
            }

            if ($ofertaAplicada && $descuento > 0) {
                dbQuery("UPDATE ofertas SET usos_actuales = usos_actuales + 1 WHERE id = ?", [(int)$ofertaAplicada['id']]);
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
            // Un pedido solo se da por terminado cuando ya está pagado completo:
            // si fue con anticipo, quien entrega/instala primero confirma que el
            // cliente pagó el resto (pagos.php?action=marcar_saldo_manual) — el
            // mismo cierre para pedidos del sitio y cargados a mano.
            if ($body['estado'] === 'finalizado' && estadoPagoPedido($pedido) !== 'liquidado') {
                jsonError('El cliente aún tiene saldo pendiente. Confirma que pagó el resto antes de finalizar el pedido.', 422);
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
                        if (strlen($url) > 350) {
                            jsonError('El nombre de un archivo de diseño es demasiado largo; acórtalo y vuelve a subirlo', 422);
                        }
                        $archivosDiseno[] = ['url' => $url, 'tipo' => $tipo, 'grupo' => $grupo];
                    }
                }

                // El diseñador (flujo normal, no el override de jefe/administrador) debe
                // entregar lo que el taller necesita: el proyecto de SketchUp (.skp)
                // y la carpeta de cortes para el CNC (.nc). El render en imagen es
                // opcional.
                if ($usuarioActual['rol'] === 'disenador') {
                    $tieneSkp   = count(array_filter($archivosDiseno, fn($a) => $a['tipo'] === 'skp')) > 0;
                    $tieneCorte = count(array_filter($archivosDiseno, fn($a) => $a['tipo'] === 'vcarve')) > 0;
                    if (!$tieneSkp || !$tieneCorte) {
                        jsonError('Adjunta el proyecto de SketchUp (.skp) y la carpeta de cortes para el CNC antes de marcar listo para producción', 422);
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
        // Fecha de entrega y notas: las acuerda ventas/jefe con el cliente —
        // taller, instalación y diseño solo avanzan el estado (antes cualquier
        // personal podía cambiarlas y la fecha ni siquiera se validaba).
        if (isset($body['fecha_estimada']) || isset($body['notas'])) {
            if (!in_array($usuarioActual['rol'], ['jefe', 'administrador', 'ventas'], true)) {
                jsonError('Solo ventas o el jefe pueden cambiar la fecha o las notas del pedido', 403);
            }
        }
        if (isset($body['fecha_estimada'])) {
            $fe = (string)$body['fecha_estimada'];
            $dtFe = DateTime::createFromFormat('Y-m-d', $fe);
            if (!$dtFe || $dtFe->format('Y-m-d') !== $fe) jsonError('Fecha de entrega inválida', 422);
            $update['fecha_estimada'] = $fe;
        }
        if (isset($body['notas'])) $update['notas'] = sanitize(mb_substr((string)$body['notas'], 0, 2000));

        // Corregir el total de un pedido ya creado (precio acordado distinto,
        // pedido cargado con total incompleto): solo jefe/ventas. Nunca menor
        // a lo ya cobrado; el estado de pago se recalcula con el total nuevo.
        if (isset($body['total'])) {
            if (!puedeVerMontos($usuarioActual)) jsonError('Solo el jefe o ventas pueden cambiar el total del pedido', 403);
            $nuevoTotal = round((float)$body['total'], 2);
            if ($nuevoTotal <= 0) jsonError('El total debe ser mayor a $0', 422);
            $pagadoYa = (float)($pedido['monto_pagado'] ?? 0);
            if ($nuevoTotal < $pagadoYa - 0.01) {
                jsonError('El total no puede ser menor a lo que ya se cobró ($' . number_format($pagadoYa, 2) . ')', 422);
            }
            $update['total']    = $nuevoTotal;
            $update['subtotal'] = round(max(0, $nuevoTotal - (float)$pedido['costo_envio'] - (float)$pedido['costo_instalacion'] + (float)$pedido['descuento']), 2);
            if ($pagadoYa > 0.009) $update['tipo_pago'] = $pagadoYa >= $nuevoTotal - 0.01 ? 'completo' : 'anticipo';
            if (!isset($update['estado']) && in_array($pedido['estado'], ['pendiente', 'anticipo_pagado', 'pagado'], true)) {
                $update['estado'] = $pagadoYa <= 0.009 ? 'pendiente' : ($pagadoYa >= $nuevoTotal - 0.01 ? 'pagado' : 'anticipo_pagado');
            }
            appLog('info', 'Total de pedido modificado', [
                'pedido_id' => $id, 'antes' => (float)$pedido['total'], 'despues' => $nuevoTotal,
                'usuario_id' => (int)$usuarioActual['id'], 'rol' => $usuarioActual['rol'],
            ]);
        }

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