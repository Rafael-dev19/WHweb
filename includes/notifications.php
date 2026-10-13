<?php
// notifications.php — PHP escribe en Firestore; Firebase Cloud Functions envía los correos

if (!defined('WH_LOADED')) {
    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/functions.php';
}
require_once __DIR__ . '/firebase_admin.php';

// ================================================================
// FIRESTORE REST API
// ================================================================

function crearNotificacionFirestore(string $tipo, string $titulo, string $mensaje, array $extra = []): bool {
    if (empty(FIREBASE_PROJECT_ID) || (!firebaseUsaCuentaServicio() && empty(FIREBASE_API_KEY))) return false;

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

    $r = firestoreRequest('POST', 'notificaciones', [], $doc);
    if ($r['code'] !== 200 && $r['code'] !== 201) {
        appLog('error', '[Firestore] crearNotificacion falló', [
            'tipo' => $tipo, 'http' => $r['code'], 'curl_err' => $r['error'],
            'body' => substr($r['body'], 0, 300),
        ]);
    }
    return $r['code'] === 200 || $r['code'] === 201;
}

function obtenerNotificacionesFirestore(int $limit = 20): array {
    if (empty(FIREBASE_PROJECT_ID)) return [];
    $r = firestoreRequest('GET', 'notificaciones', ['pageSize' => $limit, 'orderBy' => 'fecha desc']);
    if ($r['code'] !== 200 || $r['body'] === '') return [];

    $data = json_decode($r['body'], true);
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
    if (empty(FIREBASE_PROJECT_ID) || !preg_match('/^[a-zA-Z0-9_-]{1,128}$/', $docId)) return false;
    $r = firestoreRequest('PATCH', 'notificaciones/' . $docId, ['updateMask.fieldPaths' => 'leida'],
        ['fields' => ['leida' => ['booleanValue' => true]]]);
    return $r['code'] === 200;
}

// ================================================================
// NOTIFICACIONES COMPUESTAS
// ================================================================

// Devuelve los correos de todos los empleados activos para notificarles por email.
// NOTA: el personal interno (jefe/administrador/empleado/disenador) ya NO recibe
// email de estos eventos — solo push (ver crearNotificacionPush abajo). Esta
// función queda por si algún flujo futuro todavía necesita el correo de soporte.
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

// ── Push (FCM) al personal interno ─────────────────────────────────

// El jefe es el único rol de personal que además recibe email (los demás
// roles solo push). Puede haber varias cuentas jefe activas a la vez (ej.
// una cuenta de prueba para validar el panel) — se le manda a todas.
function _obtenerCorreosJefe(): array {
    try {
        $rows = dbRows("SELECT correo FROM usuarios_personal WHERE rol = 'jefe' AND activo = 1");
        return array_values(array_filter(array_column($rows, 'correo')));
    } catch (\Throwable $e) {
        return [];
    }
}

// Correos del personal activo con alguno de los roles dados. $area filtra
// dentro del rol 'empleado' (taller/instalacion); null = todos.
function _obtenerCorreosPorRol(array $roles): array {
    if (empty($roles)) return [];
    try {
        $placeholders = implode(',', array_fill(0, count($roles), '?'));
        $rows = dbRows("SELECT correo FROM usuarios_personal WHERE activo = 1 AND rol IN ($placeholders)", $roles);
        return array_values(array_unique(array_filter(array_column($rows, 'correo'))));
    } catch (\Throwable $e) {
        return [];
    }
}

// Pedido completo para la copia interna por correo (jefe/ventas): lo mismo
// que ven en su panel — cliente, todos los teléfonos, entrega, muebles con
// medidas personalizadas y el estado del pago con cifras.
function _datosCopiaPedido(int $pedidoId): ?array {
    $p = dbRow("SELECT * FROM pedidos WHERE id = ?", [$pedidoId]);
    if (!$p) return null;
    $items = dbRows("SELECT * FROM detalle_pedido WHERE pedido_id = ? ORDER BY id", [$pedidoId]);
    $tels = [];
    if (!empty($p['telefonos_secundarios'])) {
        $tels = json_decode($p['telefonos_secundarios'], true) ?: [];
    }
    return [
        'numero_pedido'       => $p['numero_pedido'],
        'nombre_cliente'      => html_entity_decode((string)$p['nombre_cliente'], ENT_QUOTES, 'UTF-8'),
        'correo_cliente'      => $p['correo_cliente'] ?? '',
        'telefono_cliente'    => $p['telefono_cliente'] ?? '',
        'telefonos_secundarios' => array_values($tels),
        'tipo_entrega'        => $p['tipo_entrega'] ?? 'envio',
        'incluye_instalacion' => !empty($p['incluye_instalacion']),
        'direccion_envio'     => html_entity_decode((string)($p['direccion_envio'] ?? ''), ENT_QUOTES, 'UTF-8'),
        'fecha_estimada'      => $p['fecha_estimada'] ?? '',
        'subtotal'            => (float)($p['subtotal'] ?? 0),
        'costo_envio'         => (float)($p['costo_envio'] ?? 0),
        'costo_instalacion'   => (float)($p['costo_instalacion'] ?? 0),
        'descuento'           => (float)($p['descuento'] ?? 0),
        'total'               => (float)($p['total'] ?? 0),
        'tipo_pago'           => $p['tipo_pago'] ?? 'completo',
        'monto_pagado'        => (float)($p['monto_pagado'] ?? 0),
        'mensaje_disenador'   => html_entity_decode((string)($p['mensaje_disenador'] ?? ''), ENT_QUOTES, 'UTF-8'),
        'origen'              => strpos((string)($p['notas'] ?? ''), 'cargado a mano') !== false ? 'manual' : 'sitio',
        'items'               => array_map(fn($it) => [
            'nombre'          => html_entity_decode((string)$it['nombre_producto'], ENT_QUOTES, 'UTF-8'),
            'cantidad'        => (float)$it['cantidad'],
            'unidad'          => $it['unidad'] ?? 'pza',
            'precio_unitario' => (float)$it['precio_unitario'],
            'total_linea'     => (float)($it['total_linea'] ?? 0),
            'medidas'         => $it['medidas_personalizadas'] ?? '',
            'ancho_cm'        => $it['ancho_cm'] ?? null,
            'cubierta'        => $it['cubierta'] ?? null,
            'color'           => $it['color'] ?? '',
            'info_extra'      => $it['info_extra'] ?? '',
            'imagen_referencia' => $it['imagen_referencia'] ?? '',
            'ovalin'          => $it['ovalin'] ?? '',
            'monomando'       => $it['monomando'] ?? '',
            'adicionales'     => $it['adicionales'] ?? '',
        ], $items),
        'tipo_proyecto'       => $p['tipo_proyecto'] ?? 'bano',
    ];
}

// Aviso de pedido nuevo a todo el personal, en dos niveles:
//   - jefe y ventas: copia COMPLETA del pedido por correo (con cifras) + push.
//   - diseñador, taller e instalación: solo un aviso corto por correo y push
//     (sin datos del cliente ni montos — lo ven entrando a su panel).
// $disenadorId: si el pedido ya tiene diseñador asignado, solo a él le llega
// el aviso de diseño; si no, a todos los diseñadores activos.
function notificarPedidoNuevoPersonal(int $pedidoId, ?int $disenadorId = null, bool $pushJefe = true): void {
    $datos = _datosCopiaPedido($pedidoId);
    if (!$datos) return;
    $folio = $datos['numero_pedido'];

    $correosCopia = _obtenerCorreosPorRol(['jefe', 'ventas']);
    // Jefe y ventas tienen paneles distintos (/admin vs /ventas): el push de
    // ventas va en su propio documento para que el clic abra su panel.
    $tokensGestion = $pushJefe ? _obtenerTokensPushPorRol(['jefe']) : [];
    _avisoCortoPersonal('aviso_pedido_ventas', _obtenerTokensPushPorRol(['ventas']), [],
        'Nuevo pedido', "Nuevo pedido $folio, ingresa al sitio para revisarlo.", '/ventas#pedidos');
    $quien = trim($datos['nombre_cliente']) . ' · $' . number_format($datos['total'], 2);
    notificarPanel(['jefe'], null, 'pedido_nuevo', "Nuevo pedido $folio", $quien, '/admin#pedidos');
    notificarPanel(['ventas'], null, 'pedido_nuevo', "Nuevo pedido $folio", $quien, '/ventas#pedidos');
    if ($correosCopia || $tokensGestion) {
        $extra = [
            'datos_pedido' => json_encode($datos, JSON_UNESCAPED_UNICODE),
            'push_titulo'  => 'Nuevo pedido',
            'push_mensaje' => "Nuevo pedido $folio, ingresa al sitio para revisarlo.",
            'push_url'     => '/admin#pedidos',
        ];
        if ($correosCopia)  $extra['correos_copia_json'] = json_encode($correosCopia);
        if ($tokensGestion) $extra['push_tokens_json']   = json_encode($tokensGestion);
        crearNotificacionFirestore('copia_pedido_interna', "Nuevo pedido $folio", "Copia interna del pedido $folio", $extra);
    }

    // Diseño
    if ($disenadorId) {
        $tokensDis  = _obtenerTokensPushPorUsuario($disenadorId);
        $correoDis  = dbRow("SELECT correo FROM usuarios_personal WHERE id = ? AND activo = 1", [$disenadorId])['correo'] ?? '';
        $correosDis = $correoDis ? [$correoDis] : [];
    } else {
        $tokensDis  = _obtenerTokensPushPorRol(['disenador']);
        $correosDis = _obtenerCorreosPorRol(['disenador']);
    }
    _avisoCortoPersonal('aviso_pedido_disenador', $tokensDis, $correosDis,
        'Nuevo pedido para diseñar',
        "Hay un nuevo pedido ($folio) para diseñar. Ingresa a tu panel para ver los detalles.",
        '/disenador#pedidos');
    notificarPanel(['disenador'], $disenadorId, 'pedido_para_disenar', 'Nuevo pedido para diseñar',
        "Pedido $folio — ábrelo en Pedidos para ver lo que pidió el cliente.", '/disenador#pedidos');

    // Taller e instalación (rol empleado): lo verán en su panel cuando el
    // diseñador lo libere a producción, pero ya saben que viene en camino.
    _avisoCortoPersonal('aviso_pedido_empleado', _obtenerTokensPushPorRol(['empleado']), _obtenerCorreosPorRol(['empleado']),
        'Nuevo pedido',
        "Entró un nuevo pedido ($folio). Aparecerá en tu panel cuando pase a producción.",
        '/empleado#pedidos');
    notificarPanel(['empleado'], null, 'pedido_en_camino', 'Viene un pedido nuevo',
        "Pedido $folio — aparecerá en tu lista cuando el diseñador lo pase a producción.", '/empleado#pedidos');
}

function _avisoCortoPersonal(string $tipo, array $tokens, array $correos, string $titulo, string $mensaje, string $url): void {
    if (!$tokens && !$correos) return;
    $extra = ['push_titulo' => $titulo, 'push_mensaje' => $mensaje, 'push_url' => $url];
    if ($tokens)  $extra['push_tokens_json']   = json_encode($tokens);
    if ($correos) $extra['correos_aviso_json'] = json_encode($correos);
    crearNotificacionFirestore($tipo, $titulo, $mensaje, $extra);
}

// ── Destinatarios ──────────────────────────────────────────────────
// Un "destino" puede ser un rol ('jefe', 'ventas', 'disenador', 'empleado')
// o un rol con área ('empleado:taller', 'empleado:instalacion'). Un empleado
// sin área asignada (cuentas viejas) recibe los avisos de ambas áreas.
function _condicionDestinos(array $destinos, string $alias = 'up'): array {
    $partes = []; $params = [];
    foreach (array_unique($destinos) as $d) {
        if (strpos($d, ':') !== false) {
            [$rol, $area] = explode(':', $d, 2);
            $partes[] = "($alias.rol = ? AND ($alias.area = ? OR $alias.area IS NULL))";
            array_push($params, $rol, $area);
        } else {
            $partes[] = "$alias.rol = ?";
            $params[] = $d;
        }
    }
    return [$partes ? '(' . implode(' OR ', $partes) . ')' : '1=0', $params];
}

// Bandeja de la campana del panel: una fila por persona, con su propio
// "leído". Cada aviso se guarda SOLO para quien le corresponde — antes todo
// el personal veía los avisos de todos (ver migracion_2026_10c).
// $destinos: roles/áreas (ver _condicionDestinos); $usuarioId: una persona.
function notificarPanel(array $destinos, ?int $usuarioId, string $tipo, string $titulo, string $mensaje, string $url = ''): void {
    try {
        if ($usuarioId) {
            $ids = [$usuarioId];
        } else {
            [$cond, $params] = _condicionDestinos($destinos);
            $ids = array_column(dbRows("SELECT up.id FROM usuarios_personal up WHERE up.activo = 1 AND $cond", $params), 'id');
        }
        foreach ($ids as $uid) {
            dbInsert('notificaciones_personal', [
                'usuario_personal_id' => (int)$uid,
                'tipo'    => mb_substr($tipo, 0, 40),
                'titulo'  => mb_substr($titulo, 0, 200),
                'mensaje' => mb_substr($mensaje, 0, 500),
                'url'     => $url !== '' ? mb_substr($url, 0, 200) : null,
            ]);
        }
    } catch (\Throwable $e) {
        appLog('warning', 'notificarPanel falló (¿falta migracion_2026_10c?)', ['tipo' => $tipo, 'e' => $e->getMessage()]);
    }
}

// Tokens de dispositivo activos del personal con alguno de los destinos dados
// (roles o rol:área, ver _condicionDestinos).
function _obtenerTokensPushPorRol(array $roles): array {
    if (empty($roles)) return [];
    try {
        [$cond, $params] = _condicionDestinos($roles);
        $rows = dbRows(
            "SELECT dp.fcm_token
             FROM dispositivos_push dp
             INNER JOIN usuarios_personal up ON up.id = dp.usuario_personal_id
             WHERE dp.activo = 1 AND up.activo = 1 AND $cond",
            $params
        );
        return array_column($rows, 'fcm_token');
    } catch (\Throwable $e) {
        return [];
    }
}

// Tokens de dispositivo activos de un usuario de personal específico (para
// avisar solo al diseñador asignado, no a todo el rol — ver
// notificarPedidoManualAsignado).
function _obtenerTokensPushPorUsuario(int $usuarioId): array {
    try {
        $rows = dbRows(
            "SELECT dp.fcm_token
             FROM dispositivos_push dp
             INNER JOIN usuarios_personal up ON up.id = dp.usuario_personal_id
             WHERE dp.activo = 1 AND up.activo = 1 AND up.id = ?",
            [$usuarioId]
        );
        return array_column($rows, 'fcm_token');
    } catch (\Throwable $e) {
        return [];
    }
}

// Notificación push genérica: reutiliza el mismo documento de Firestore que ya
// dispara la Cloud Function, agregando los campos push_* que ésta lee para
// mandar el Web Push. El contenido del push es SIEMPRE genérico (nunca datos
// del cliente/pedido) — el detalle real solo se ve entrando al panel.
// $tambienEmailJefe: además del push, el jefe recibe un correo corto del
// mismo aviso (único rol de personal con email; el resto solo push).
function crearNotificacionPush(string $tipo, array $roles, string $titulo, string $mensaje, string $clickUrl = '/', bool $tambienEmailJefe = false): bool {
    $tokens = _obtenerTokensPushPorRol($roles);
    $extra  = [
        'push_titulo' => $titulo,
        'push_mensaje' => $mensaje,
        'push_url'    => $clickUrl,
    ];
    if (!empty($tokens)) {
        $extra['push_tokens_json'] = json_encode($tokens);
    }
    if ($tambienEmailJefe && in_array('jefe', $roles, true)) {
        $correosJefe = _obtenerCorreosJefe();
        if (!empty($correosJefe)) $extra['correos_jefe_json'] = json_encode($correosJefe);
    }
    if (empty($tokens) && empty($extra['correos_jefe_json'])) return false;
    return crearNotificacionFirestore($tipo, $titulo, $mensaje, $extra);
}

// $desdeConversionCotizacion=true cuando el pedido nace de convertir una
// cotización ya confirmada (Fase 7) — en ese caso el push ya lo recibió el
// jefe al confirmarse la cotización, así que aquí solo se avisa al diseñador.
function notificarNuevoPedido(array $pedido, bool $desdeConversionCotizacion = false): void {
    crearNotificacionFirestore(
        'nuevo_pedido',
        '🛒 Nuevo pedido recibido',
        "Pedido {$pedido['numero_pedido']} de {$pedido['nombre_cliente']} por $" . number_format((float)($pedido['total'] ?? 0), 2),
        [
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

    // Personal: copia completa a jefe/ventas, aviso corto a diseño/taller/
    // instalación. Si vino de una cotización ya confirmada, el jefe ya tuvo
    // su push en ese momento — no se le repite (el correo con la copia sí).
    if (!empty($pedido['id'])) {
        notificarPedidoNuevoPersonal((int)$pedido['id'], null, !$desdeConversionCotizacion);
    }
}

// Pedido cargado a mano por jefe/ventas/diseñador (encargo de WhatsApp,
// teléfono o mostrador): mismos avisos que un pedido del sitio. Si lo cargó
// un diseñador para sí mismo, el aviso de diseño solo le llega a él.
function notificarPedidoManualCreado(int $pedidoId, string $numeroPedido, ?int $disenadorId): void {
    notificarPedidoNuevoPersonal($pedidoId, $disenadorId, true);
}

function notificarCambioPedido(array $pedido, string $estadoAnterior): void {
    $etiquetas = [
        'pendiente' => 'Pendiente', 'anticipo_pagado' => 'Anticipo pagado', 'pagado' => 'Pagado',
        'listo_para_produccion' => 'Listo para producción', 'en_produccion' => 'En producción',
        'alistando_pedido' => 'Alistando pedido', 'en_camino_instalacion' => 'En camino a instalación',
        'finalizado' => 'Finalizado', 'cancelado' => 'Cancelado',
    ];
    $folio  = $pedido['numero_pedido'];
    $nuevo  = $etiquetas[$pedido['estado']] ?? $pedido['estado'];
    notificarPanel(['jefe'], null, 'pedido_estado', "Pedido $folio: $nuevo", 'Antes: ' . ($etiquetas[$estadoAnterior] ?? $estadoAnterior), '/admin#pedidos');
    notificarPanel(['ventas'], null, 'pedido_estado', "Pedido $folio: $nuevo", 'Antes: ' . ($etiquetas[$estadoAnterior] ?? $estadoAnterior), '/ventas#pedidos');
    // Instalación entra en juego cuando el taller termina: aviso solo a esa área.
    if ($pedido['estado'] === 'alistando_pedido') {
        notificarPanel(['empleado:instalacion'], null, 'pedido_para_entregar', 'Pedido listo para entregar',
            "Pedido $folio — ya está alistado para entrega/instalación.", '/empleado#pedidos');
        crearNotificacionPush('push_pedido_para_entregar', ['empleado:instalacion'], 'Pedido listo para entregar',
            'Hay un pedido listo para entrega o instalación, ingresa al sitio para revisarlo.', '/empleado#pedidos');
    }
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

    crearNotificacionPush(
        'push_nueva_cotizacion',
        ['jefe'],
        'Nueva cotización',
        'Hay una nueva cotización, ingresa al sitio para revisarla.',
        '/admin#cotizaciones',
        true
    );
    crearNotificacionPush('push_nueva_cotizacion', ['ventas'], 'Nueva cotización',
        'Hay una nueva cotización, ingresa al sitio para revisarla.', '/ventas#cotizaciones');
    $txt = 'De ' . html_entity_decode((string)$cot['nombre_cliente'], ENT_QUOTES, 'UTF-8');
    notificarPanel(['jefe'], null, 'cotizacion_nueva', "Nueva cotización {$cot['numero_cotizacion']}", $txt, '/admin#cotizaciones');
    notificarPanel(['ventas'], null, 'cotizacion_nueva', "Nueva cotización {$cot['numero_cotizacion']}", $txt, '/ventas#cotizaciones');
}

// Push+email al jefe cuando el cliente confirma una cotización respondida
// desde el portal de seguimiento (Fase 7). No genera email adicional al cliente.
function notificarConfirmacionCotizacion(array $cot): void {
    crearNotificacionPush(
        'push_confirmacion_cotizacion',
        ['jefe'],
        'Cotización confirmada',
        'Un cliente confirmó su cotización, ingresa al sitio para continuar.',
        '/admin#cotizaciones',
        true
    );
    crearNotificacionPush('push_confirmacion_cotizacion', ['ventas'], 'Cotización confirmada',
        'Un cliente confirmó su cotización, ingresa al sitio para continuar.', '/ventas#cotizaciones');
    $num = $cot['numero_cotizacion'] ?? '';
    notificarPanel(['jefe'], null, 'cotizacion_confirmada', "Cotización $num confirmada", 'El cliente aceptó la propuesta.', '/admin#cotizaciones');
    notificarPanel(['ventas'], null, 'cotizacion_confirmada', "Cotización $num confirmada", 'El cliente aceptó la propuesta.', '/ventas#cotizaciones');
}

// Push a empleados cuando el diseñador libera un pedido a producción — es el
// momento en que se vuelve visible/accionable para ellos.
function notificarPedidoListoParaProduccion(array $pedido): void {
    // Producción le toca al TALLER (instalación recibe su aviso cuando el
    // pedido queda alistado — ver notificarCambioPedido).
    notificarPanel(['empleado:taller'], null, 'pedido_a_produccion', 'Pedido listo para producción',
        'Pedido ' . ($pedido['numero_pedido'] ?? '') . ' — el diseño está listo, ya puede fabricarse.', '/empleado#pedidos');
    crearNotificacionPush(
        'push_pedido_listo_produccion',
        ['empleado:taller'],
        'Pedido listo para producción',
        'Hay un pedido listo para producción, ingresa al sitio para revisarlo.',
        '/empleado#pedidos'
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
                'pdf_url'               => $cot['pdf_url'] ?? '',
                'fecha_visita'          => $cot['fecha_visita'] ?? '',
                'hora_visita'           => $cot['hora_visita'] ?? '',
                'token_seguimiento'     => $cot['token_seguimiento'] ?? '',
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

    crearNotificacionPush(
        'push_nueva_cita',
        ['jefe'],
        'Nueva cita',
        'Hay una nueva cita agendada, ingresa al sitio para revisarla.',
        '/admin#citas',
        true
    );
    crearNotificacionPush('push_nueva_cita', ['ventas'], 'Nueva cita',
        'Hay una nueva cita agendada, ingresa al sitio para revisarla.', '/ventas#citas');
    $txt = html_entity_decode((string)$cita['nombre_cliente'], ENT_QUOTES, 'UTF-8') . ' · ' . $cita['fecha_cita'];
    notificarPanel(['jefe'], null, 'cita_nueva', "Nueva cita {$cita['numero_cita']}", $txt, '/admin#citas');
    notificarPanel(['ventas'], null, 'cita_nueva', "Nueva cita {$cita['numero_cita']}", $txt, '/ventas#citas');
}

function notificarInvitacionPersonal(array $inv): void {
    // Aviso en la campana solo para quienes administran al personal.
    notificarPanel(['jefe', 'administrador'], null, 'invitacion_enviada', 'Invitación enviada',
        "Se invitó a {$inv['correo']} al panel.", '/admin#empleados');
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