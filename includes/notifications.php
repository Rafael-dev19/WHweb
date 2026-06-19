<?php
// notifications.php — PHP escribe en Firestore; Firebase Cloud Functions envía los correos

if (!defined('WH_LOADED')) {
    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/functions.php';
}

// ================================================================
// FIRESTORE REST API
// ================================================================

function crearNotificacionFirestore(string $tipo, string $titulo, string $mensaje, array $extra = []): bool {
    $projectId = FIREBASE_PROJECT_ID;
    $apiKey    = FIREBASE_API_KEY;
    if (empty($projectId) || empty($apiKey)) return false;

    $url = "https://firestore.googleapis.com/v1/projects/{$projectId}/databases/(default)/documents/notificaciones?key={$apiKey}";

    $doc = ['fields' => [
        'tipo'    => ['stringValue' => $tipo],
        'titulo'  => ['stringValue' => $titulo],
        'mensaje' => ['stringValue' => $mensaje],
        'leida'   => ['booleanValue' => false],
        'fecha'   => ['timestampValue' => date('c')],
    ]];

    foreach ($extra as $k => $v) {
        if (is_string($v))    $doc['fields'][$k] = ['stringValue' => $v];
        elseif (is_int($v))   $doc['fields'][$k] = ['integerValue' => (string)$v];
        elseif (is_float($v)) $doc['fields'][$k] = ['doubleValue' => $v];
        elseif (is_bool($v))  $doc['fields'][$k] = ['booleanValue' => $v];
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($doc),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 5,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($code !== 200 && $code !== 201) {
        appLog('error', '[Firestore] crearNotificacion falló', [
            'tipo' => $tipo, 'http' => $code, 'curl_err' => $err,
            'body' => substr((string)$body, 0, 300),
        ]);
    }
    return $code === 200 || $code === 201;
}

function obtenerNotificacionesFirestore(int $limit = 20): array {
    $projectId = FIREBASE_PROJECT_ID;
    $apiKey    = FIREBASE_API_KEY;
    if (empty($projectId) || empty($apiKey)) return [];

    $url = "https://firestore.googleapis.com/v1/projects/{$projectId}/databases/(default)/documents/notificaciones"
         . "?pageSize={$limit}&orderBy=fecha+desc&key={$apiKey}";

    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 5]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code !== 200 || empty($res)) return [];

    $data = json_decode($res, true);
    return array_map(function ($d) {
        $f = $d['fields'] ?? [];
        return [
            'id'      => basename($d['name'] ?? ''),
            'tipo'    => $f['tipo']['stringValue']     ?? '',
            'titulo'  => $f['titulo']['stringValue']   ?? '',
            'mensaje' => $f['mensaje']['stringValue']  ?? '',
            'leida'   => $f['leida']['booleanValue']   ?? false,
            'fecha'   => $f['fecha']['timestampValue'] ?? '',
        ];
    }, $data['documents'] ?? []);
}

function marcarNotificacionLeida(string $docId): bool {
    $projectId = FIREBASE_PROJECT_ID;
    $apiKey    = FIREBASE_API_KEY;
    if (empty($projectId) || empty($apiKey)) return false;

    $url  = "https://firestore.googleapis.com/v1/projects/{$projectId}/databases/(default)/documents/notificaciones/{$docId}"
          . "?updateMask.fieldPaths=leida&key={$apiKey}";
    $body = ['fields' => ['leida' => ['booleanValue' => true]]];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => 'PATCH',
        CURLOPT_POSTFIELDS     => json_encode($body),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 5,
    ]);
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code === 200;
}

// ================================================================
// NOTIFICACIONES COMPUESTAS
// ================================================================

// Devuelve los correos de todos los empleados activos para notificarles por email.
function _obtenerCorreosEmpleados(): string {
    try {
        $rows = dbRows(
            "SELECT correo FROM usuarios_personal WHERE activo = 1 AND rol = 'empleado'",
            []
        );
        return implode(',', array_column($rows, 'correo'));
    } catch (\Throwable $e) {
        return '';
    }
}

function notificarNuevoPedido(array $pedido): void {
    crearNotificacionFirestore(
        'nuevo_pedido',
        '🛒 Nuevo pedido recibido',
        "Pedido {$pedido['numero_pedido']} de {$pedido['nombre_cliente']} por $" . number_format((float)($pedido['total'] ?? 0), 2),
        [
            'correos_empleados' => _obtenerCorreosEmpleados(),
            'numero_pedido' => $pedido['numero_pedido'],
            'datos_pedido'  => json_encode([
                'id'                => (int)($pedido['id'] ?? 0),
                'numero_pedido'     => $pedido['numero_pedido'],
                'token_seguimiento' => $pedido['token_seguimiento'] ?? '',
                'nombre_cliente'    => $pedido['nombre_cliente'],
                'correo_cliente'    => $pedido['correo_cliente'],
                'telefono_cliente'  => $pedido['telefono_cliente'] ?? '',
                'total'             => (float)($pedido['total'] ?? 0),
                'subtotal'          => (float)($pedido['subtotal'] ?? 0),
                'tipo_pago'         => $pedido['tipo_pago']    ?? 'completo',
                'monto_pagado'      => (float)($pedido['monto_pagado'] ?? 0),
                'tipo_entrega'      => $pedido['tipo_entrega'] ?? 'envio',
                'direccion_envio'   => $pedido['direccion_envio'] ?? '',
                'colonia_envio'     => $pedido['colonia_envio']   ?? '',
                'ciudad_envio'      => $pedido['ciudad_envio']   ?? '',
                'municipio_envio'   => $pedido['municipio_envio'] ?? '',
                'cp_envio'          => $pedido['cp_envio']        ?? '',
                'costo_envio'       => (float)($pedido['costo_envio'] ?? 0),
                'incluye_instalacion' => !empty($pedido['incluye_instalacion']),
                'costo_instalacion' => (float)($pedido['costo_instalacion'] ?? 0),
                'descuento'         => (float)($pedido['descuento'] ?? 0),
                'fecha_estimada'    => $pedido['fecha_estimada'] ?? '',
                'notas'             => $pedido['notas'] ?? '',
                'items'             => $pedido['items'] ?? [],
                'metodo_pago'       => $pedido['metodo_pago'] ?? '',
                'referencia_pago'   => $pedido['referencia_pago'] ?? '',
                'fecha_pago'        => $pedido['fecha_pago'] ?? '',
            ]),
        ]
    );
}

function notificarCambioPedido(array $pedido, string $estadoAnterior): void {
    crearNotificacionFirestore(
        'estado_pedido',
        '📦 Estado de pedido actualizado',
        "Pedido {$pedido['numero_pedido']}: {$estadoAnterior} → {$pedido['estado']}",
        [
            'numero_pedido' => $pedido['numero_pedido'],
            'datos_pedido'  => json_encode([
                'numero_pedido'     => $pedido['numero_pedido'],
                'token_seguimiento' => $pedido['token_seguimiento'] ?? '',
                'nombre_cliente'    => $pedido['nombre_cliente'],
                'correo_cliente'    => $pedido['correo_cliente'],
                'estado'            => $pedido['estado'],
                'estado_anterior'   => $estadoAnterior,
                'total'             => (float)($pedido['total'] ?? 0),
                'tipo_pago'         => $pedido['tipo_pago']    ?? 'completo',
                'monto_pagado'      => (float)($pedido['monto_pagado'] ?? 0),
            ]),
        ]
    );
}

function notificarNuevaCotizacion(array $cot): void {
    crearNotificacionFirestore(
        'nueva_cotizacion',
        '📋 Nueva cotización recibida',
        "Cotización {$cot['numero_cotizacion']} de {$cot['nombre_cliente']}",
        [
            'numero_cotizacion' => $cot['numero_cotizacion'],
            'datos_cotizacion'  => json_encode([
                'id'                => (int)($cot['id'] ?? 0),
                'numero_cotizacion' => $cot['numero_cotizacion'],
                'nombre_cliente'    => $cot['nombre_cliente'],
                'correo_cliente'    => $cot['correo_cliente'],
                'telefono_cliente'  => $cot['telefono_cliente'] ?? '',
                'modelo_mueble'       => $cot['modelo_mueble'] ?? '',
                'descripcion'       => $cot['descripcion'] ?? '',
            ]),
        ]
    );
}

function notificarCotizacionRespondida(array $cot): void {
    crearNotificacionFirestore(
        'cotizacion_respondida',
        '📋 Cotización respondida',
        "Tu cotización {$cot['numero_cotizacion']} ha sido respondida",
        [
            'numero_cotizacion' => $cot['numero_cotizacion'],
            'datos_cotizacion'  => json_encode([
                'id'                    => (int)($cot['id'] ?? 0),
                'numero_cotizacion'     => $cot['numero_cotizacion'],
                'nombre_cliente'        => $cot['nombre_cliente'],
                'correo_cliente'        => $cot['correo_cliente'],
                'modelo_mueble'         => $cot['modelo_mueble'] ?? '',
                'descripcion_respuesta' => $cot['descripcion_respuesta'] ?? '',
                'precio_cotizado'       => (float)($cot['precio_cotizado'] ?? 0),
                'fecha_entrega_estimada'=> $cot['fecha_entrega_estimada'] ?? '',
                'notas_admin'           => $cot['notas_admin'] ?? '',
            ]),
        ]
    );
}

function notificarCotizacionEnProduccion(array $cot): void {
    crearNotificacionFirestore(
        'cotizacion_en_produccion',
        '🔨 Cotización en producción',
        "Cotización {$cot['numero_cotizacion']} de {$cot['nombre_cliente']} iniciada en producción",
        [
            'correos_empleados'  => _obtenerCorreosEmpleados(),
            'numero_cotizacion'  => $cot['numero_cotizacion'],
            'token_seguimiento'  => $cot['token_seguimiento'] ?? '',
            'datos_cotizacion'   => json_encode([
                'id'                    => (int)($cot['id'] ?? 0),
                'numero_cotizacion'     => $cot['numero_cotizacion'],
                'nombre_cliente'        => $cot['nombre_cliente'],
                'correo_cliente'        => $cot['correo_cliente'],
                'telefono_cliente'      => $cot['telefono_cliente'] ?? '',
                'modelo_mueble'         => $cot['modelo_mueble'] ?? '',
                'descripcion_respuesta' => $cot['descripcion_respuesta'] ?? '',
                'precio_cotizado'       => (float)($cot['precio_cotizado'] ?? 0),
                'fecha_entrega_estimada'=> $cot['fecha_entrega_estimada'] ?? '',
                'token_seguimiento'     => $cot['token_seguimiento'] ?? '',
            ]),
        ]
    );
}

function notificarCotizacionLista(array $cot): void {
    crearNotificacionFirestore(
        'cotizacion_lista',
        '✅ Mueble listo para entrega',
        "Mueble de cotización {$cot['numero_cotizacion']} listo",
        [
            'numero_cotizacion' => $cot['numero_cotizacion'],
            'datos_cotizacion'  => json_encode([
                'id'                => (int)($cot['id'] ?? 0),
                'numero_cotizacion' => $cot['numero_cotizacion'],
                'nombre_cliente'    => $cot['nombre_cliente'],
                'correo_cliente'    => $cot['correo_cliente'],
                'token_seguimiento' => $cot['token_seguimiento'] ?? '',
            ]),
        ]
    );
}

function notificarCotizacionEntregada(array $cot): void {
    crearNotificacionFirestore(
        'cotizacion_entregada',
        '🎉 Mueble entregado',
        "Cotización {$cot['numero_cotizacion']} entregada a {$cot['nombre_cliente']}",
        [
            'numero_cotizacion' => $cot['numero_cotizacion'],
            'datos_cotizacion'  => json_encode([
                'id'                => (int)($cot['id'] ?? 0),
                'numero_cotizacion' => $cot['numero_cotizacion'],
                'nombre_cliente'    => $cot['nombre_cliente'],
                'correo_cliente'    => $cot['correo_cliente'],
            ]),
        ]
    );
}

function notificarNuevaCita(array $cita): void {
    crearNotificacionFirestore(
        'nueva_cita',
        '📅 Nueva cita agendada',
        "Cita {$cita['numero_cita']} de {$cita['nombre_cliente']} para el {$cita['fecha_cita']}",
        [
            'correos_empleados' => _obtenerCorreosEmpleados(),
            'numero_cita' => $cita['numero_cita'],
            'datos_cita'  => json_encode([
                'id'               => (int)($cita['id'] ?? 0),
                'numero_cita'      => $cita['numero_cita'],
                'nombre_cliente'   => $cita['nombre_cliente'],
                'correo_cliente'   => $cita['correo_cliente'],
                'telefono_cliente' => $cita['telefono_cliente'] ?? '',
                'fecha_cita'       => $cita['fecha_cita'],
                'rango_horario'    => $cita['rango_horario'] ?? '',
                'tipo'             => $cita['tipo'] ?? 'medicion',
            ]),
        ]
    );
}

function notificarInvitacionPersonal(array $inv): void {
    $appUrl = defined('APP_URL') ? rtrim(APP_URL, '/') : 'https://muebleswh.com';
    crearNotificacionFirestore(
        'invitacion_personal',
        'Invitación al panel — Wooden House',
        "Invitación de personal para {$inv['correo']}",
        [
            'correo_empleado'  => $inv['correo'],
            'nombre_empleado'  => $inv['nombre_completo'],
            'rol'              => $inv['rol'],
            'url_activacion'   => $appUrl . '/invitacion.php?token=' . urlencode($inv['token']),
        ]
    );
}