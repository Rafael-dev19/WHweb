<?php
require_once __DIR__ . '/_helpers.php';

// Lectura combinada de citas+pedidos para el widget de calendario del dashboard.
// El calendario es visible para todo el personal (jefe, administrador, ventas,
// empleado, disenador) — cualquiera puede necesitar ver qué hay agendado,
// aunque gestionar citas (crear/editar/cancelar) siga limitado a
// jefe/administrador/ventas (ver api/citas.php).
$usuario = requerirPersonal();
if (requestMethod() !== 'GET') jsonError('Método no permitido', 405);

$desde = trim($_GET['desde'] ?? date('Y-m-01'));
$hasta = trim($_GET['hasta'] ?? date('Y-m-t'));

$colorCita = ['nueva' => '#f59e0b', 'confirmada' => '#3b82f6', 'completada' => '#22c55e', 'cancelada' => '#ef4444'];
$colorPedido = ['pendiente' => '#a855f7', 'anticipo_pagado' => '#a855f7', 'pagado' => '#a855f7',
    'listo_para_produccion' => '#f97316', 'en_produccion' => '#f97316', 'alistando_pedido' => '#06b6d4',
    'en_camino_instalacion' => '#06b6d4', 'finalizado' => '#22c55e', 'cancelado' => '#ef4444'];

$citas = dbRows(
    "SELECT id, numero_cita, nombre_cliente, telefono_cliente, fecha_cita, rango_horario, tipo, estado, direccion
     FROM citas WHERE DATE(fecha_cita) BETWEEN ? AND ?",
    [$desde, $hasta]
);

$pedidos = dbRows(
    "SELECT id, numero_pedido, nombre_cliente, telefono_cliente, direccion_envio, colonia_envio,
            ciudad_envio, fecha_estimada, estado
     FROM pedidos WHERE fecha_estimada IS NOT NULL AND DATE(fecha_estimada) BETWEEN ? AND ?",
    [$desde, $hasta]
);

$eventos = [];

foreach ($citas as $cita) {
    $eventos[] = [
        'id'              => 'cita_' . $cita['id'],
        'title'           => "📅 {$cita['nombre_cliente']}",
        'start'           => $cita['fecha_cita'],
        'backgroundColor' => $colorCita[$cita['estado']] ?? '#6b7280',
        'borderColor'     => $colorCita[$cita['estado']] ?? '#6b7280',
        'extendedProps'   => [
            'tipo'         => 'cita',
            'numero'       => $cita['numero_cita'],
            'cliente'      => $cita['nombre_cliente'],
            'telefono'     => $cita['telefono_cliente'],
            'estado'       => $cita['estado'],
            'rango_horario'=> $cita['rango_horario'],
            'direccion'    => $cita['direccion'],
            'cita_tipo'    => $cita['tipo'],
        ],
    ];
}

foreach ($pedidos as $pedido) {
    $eventos[] = [
        'id'              => 'pedido_' . $pedido['id'],
        'title'           => "📦 {$pedido['nombre_cliente']}",
        'start'           => $pedido['fecha_estimada'],
        'backgroundColor' => $colorPedido[$pedido['estado']] ?? '#6b7280',
        'borderColor'     => $colorPedido[$pedido['estado']] ?? '#6b7280',
        'extendedProps'   => [
            'tipo'      => 'pedido',
            'numero'    => $pedido['numero_pedido'],
            'cliente'   => $pedido['nombre_cliente'],
            'telefono'  => $pedido['telefono_cliente'],
            'direccion' => trim(($pedido['direccion_envio'] ?? '') . (!empty($pedido['colonia_envio']) ? ', ' . $pedido['colonia_envio'] : '') . (!empty($pedido['ciudad_envio']) ? ', ' . $pedido['ciudad_envio'] : '')),
            'estado'    => $pedido['estado'],
        ],
    ];
}

jsonSuccess(['eventos' => $eventos]);
