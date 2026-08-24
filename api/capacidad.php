<?php
// api/capacidad.php — Gestión de capacidad de producción (jefe/administrador)

require_once __DIR__ . '/_helpers.php';

$admin  = requerirGestion();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ── GET: listar semanas y días bloqueados ─────────────────────────
if ($method === 'GET') {
    $meses    = min((int)($_GET['meses'] ?? 3), 12);
    $hoy      = date('Y-m-d');
    $limite   = date('Y-m-d', strtotime("+{$meses} months"));

    $semanas = dbRows(
        "SELECT cp.*,
            (SELECT COUNT(*) FROM pedidos p
             WHERE p.fecha_estimada BETWEEN cp.semana_inicio
               AND DATE_ADD(cp.semana_inicio, INTERVAL 6 DAY)
               AND p.estado NOT IN ('cancelado','finalizado')
            ) AS pedidos_agendados
         FROM capacidad_produccion cp
         WHERE semana_inicio BETWEEN ? AND ?
         ORDER BY semana_inicio ASC",
        [$hoy, $limite]
    );

    $diasBloqueados = dbRows(
        "SELECT * FROM dias_bloqueados WHERE fecha BETWEEN ? AND ? ORDER BY fecha",
        [$hoy, $limite]
    );

    jsonSuccess([
        'semanas'         => $semanas,
        'dias_bloqueados' => $diasBloqueados,
    ]);
}

// ── POST: crear/actualizar semana o acciones especiales ───────────
if ($method === 'POST') {
    requerirCsrf();

    if ($action === 'generar') {
        $body    = getJsonBody();
        $semanas = min((int)($body['semanas'] ?? 12), 52);
        $slotsProd  = max(1, (int)($body['slots_produccion'] ?? 3));
        $slotsEnt   = max(1, (int)($body['slots_entrega']    ?? 5));

        $lunes = new DateTime();
        $dow   = (int)$lunes->format('N');
        if ($dow > 1) $lunes->modify('-' . ($dow - 1) . ' days');

        $creadas = 0;
        for ($i = 0; $i < $semanas; $i++) {
            $fecha = $lunes->format('Y-m-d');
            $existe = dbRow("SELECT id FROM capacidad_produccion WHERE semana_inicio = ?", [$fecha]);
            if (!$existe) {
                dbInsert('capacidad_produccion', [
                    'semana_inicio'    => $fecha,
                    'slots_produccion' => $slotsProd,
                    'slots_entrega'    => $slotsEnt,
                    'bloqueado'        => 0,
                ]);
                $creadas++;
            }
            $lunes->modify('+1 week');
        }
        jsonSuccess(['creadas' => $creadas, 'mensaje' => "{$creadas} semanas nuevas generadas"]);
    }

    if ($action === 'bloquear_dia') {
        $body   = getJsonBody();
        $fecha  = trim($body['fecha']  ?? '');
        $motivo = trim($body['motivo'] ?? 'Día bloqueado');

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
            jsonError('Fecha inválida (usa YYYY-MM-DD)', 422);
        }

        $existe = dbRow("SELECT id FROM dias_bloqueados WHERE fecha = ?", [$fecha]);
        if ($existe) {
            dbUpdate('dias_bloqueados', ['motivo' => $motivo], 'fecha = ?', [$fecha]);
        } else {
            dbInsert('dias_bloqueados', ['fecha' => $fecha, 'motivo' => $motivo]);
        }
        jsonSuccess(['mensaje' => "Día {$fecha} bloqueado: {$motivo}"]);
    }

    $body = getJsonBody();
    $semana = trim($body['semana_inicio'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $semana)) {
        jsonError('semana_inicio inválida (usa YYYY-MM-DD lunes)', 422);
    }

    $data = [
        'slots_produccion' => max(0, (int)($body['slots_produccion'] ?? 3)),
        'slots_entrega'    => max(0, (int)($body['slots_entrega']    ?? 5)),
        'bloqueado'        => (int)(bool)($body['bloqueado']         ?? false),
        'motivo_bloqueo'   => $body['bloqueado'] ? (trim($body['motivo_bloqueo'] ?? 'Taller cerrado') ?: null) : null,
    ];

    $existe = dbRow("SELECT id FROM capacidad_produccion WHERE semana_inicio = ?", [$semana]);
    if ($existe) {
        dbUpdate('capacidad_produccion', $data, 'semana_inicio = ?', [$semana]);
        jsonSuccess(['mensaje' => "Semana {$semana} actualizada"]);
    } else {
        $data['semana_inicio'] = $semana;
        $id = dbInsert('capacidad_produccion', $data);
        jsonSuccess(['id' => $id, 'mensaje' => "Semana {$semana} creada"]);
    }
}

// ── PUT: actualizar semana específica ─────────────────────────────
if ($method === 'PUT') {
    $semana = trim($_GET['semana'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $semana)) {
        jsonError('Parámetro semana inválido', 422);
    }

    $body = getJsonBody();
    $data = array_filter([
        'slots_produccion' => isset($body['slots_produccion']) ? max(0, (int)$body['slots_produccion']) : null,
        'slots_entrega'    => isset($body['slots_entrega'])    ? max(0, (int)$body['slots_entrega'])    : null,
        'bloqueado'        => isset($body['bloqueado'])        ? (int)(bool)$body['bloqueado']          : null,
        'motivo_bloqueo'   => $body['motivo_bloqueo'] ?? null,
    ], fn($v) => $v !== null);

    if (empty($data)) jsonError('Nada que actualizar', 422);

    $rows = dbUpdate('capacidad_produccion', $data, 'semana_inicio = ?', [$semana]);
    if (!$rows) jsonError("Semana {$semana} no encontrada", 404);
    jsonSuccess(['mensaje' => "Semana {$semana} actualizada"]);
}

// ── DELETE: desbloquear día ───────────────────────────────────────
if ($method === 'DELETE') {
    $dia = trim($_GET['dia'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dia)) {
        jsonError('Parámetro dia inválido', 422);
    }
    dbQuery("DELETE FROM dias_bloqueados WHERE fecha = ?", [$dia]);
    jsonSuccess(['mensaje' => "Día {$dia} desbloqueado"]);
}

jsonError('Método no permitido', 405);
