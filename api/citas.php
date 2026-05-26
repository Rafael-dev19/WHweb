<?php
require_once __DIR__ . '/_helpers.php';

$method = requestMethod();
$id     = isset($_GET['id']) ? sanitizeInt($_GET['id']) : null;

switch ($method) {
    case 'GET':
        if (!empty($_GET['numero_cita']) && !$id) {
            $num = trim($_GET['numero_cita']);
            if (!preg_match('/^CIT-\d{4}-\d{6}$/i', $num)) jsonError('Formato inválido', 422);
            $cita = dbRow(
                "SELECT numero_cita, nombre_cliente, fecha_cita, rango_horario, tipo, estado, fecha_creacion
                 FROM citas WHERE numero_cita = ?",
                [$num]
            );
            if (!$cita) jsonError('Cita no encontrada', 404);
            jsonSuccess(['cita' => $cita]);
        }

        $consultaPublica = !empty($_GET['fecha']) && !$id && empty($_GET['estado']) && empty($_GET['tipo']);
        if (!$consultaPublica) requerirEmpleado();

        if ($id) {
            $cita = dbRow("SELECT * FROM citas WHERE id = ?", [$id]);
            if (!$cita) jsonError('Cita no encontrada', 404);
            jsonSuccess(['cita' => $cita]);
        }

        if ($consultaPublica) {
            $fecha = $_GET['fecha'];
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) jsonError('Fecha inválida', 422);
            $citas = dbRows(
                "SELECT rango_horario, estado FROM citas WHERE DATE(fecha_cita) = ? AND estado != 'cancelada'",
                [$fecha]
            );
            jsonSuccess(['citas' => $citas]);
        }

        $page  = max(1, sanitizeInt($_GET['page'] ?? 1));
        $limit = min(50, max(1, sanitizeInt($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $where = ['1=1']; $params = [];
        $estadosValidos = ['nueva', 'confirmada', 'completada', 'cancelada'];
        $tiposPermitidos = ['medicion', 'instalacion', 'otro'];
        if (!empty($_GET['estado'])) {
            if (!in_array($_GET['estado'], $estadosValidos, true)) jsonError('estado inválido', 422);
            $where[] = 'estado = ?'; $params[] = $_GET['estado'];
        }
        if (!empty($_GET['tipo'])) {
            if (!in_array($_GET['tipo'], $tiposPermitidos, true)) jsonError('tipo inválido', 422);
            $where[] = 'tipo = ?'; $params[] = $_GET['tipo'];
        }
        if (!empty($_GET['fecha'])) {
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['fecha'])) jsonError('Formato de fecha inválido (YYYY-MM-DD)', 422);
            $where[] = 'DATE(fecha_cita) = ?'; $params[] = $_GET['fecha'];
        }
        if (!empty($_GET['fecha_desde'])) {
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['fecha_desde'])) jsonError('Formato de fecha_desde inválido (YYYY-MM-DD)', 422);
            $where[] = 'DATE(fecha_cita) >= ?'; $params[] = $_GET['fecha_desde'];
        }
        if (!empty($_GET['fecha_hasta'])) {
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['fecha_hasta'])) jsonError('Formato de fecha_hasta inválido (YYYY-MM-DD)', 422);
            $where[] = 'DATE(fecha_cita) <= ?'; $params[] = $_GET['fecha_hasta'];
        }
        $whereStr = 'WHERE ' . implode(' AND ', $where);
        $total = (int)(dbRow("SELECT COUNT(*) AS n FROM citas $whereStr", $params)['n'] ?? 0);
        $params[] = $limit; $params[] = $offset;
        $citas = dbRows("SELECT * FROM citas $whereStr ORDER BY fecha_cita ASC LIMIT ? OFFSET ?", $params);
        jsonSuccess(['citas' => $citas, 'paginacion' => getPaginacion($total, $page, $limit)]);
        break;

    case 'POST':
        checkRateLimit('citas_post', 5, 60);
        $body = getJsonBody();
        requireFields($body, ['nombre_cliente', 'correo_cliente', 'telefono_cliente', 'fecha_cita', 'tipo']);

        // ── ANTI-BOT: Honeypot ────────────────────────────────────
        if (!empty($body['_hp']) || !empty($body['website']) || !empty($body['url'])) {
            jsonSuccess(['numero_cita' => 'CIT-' . date('Y') . '-000000', 'mensaje' => 'Agendado']);
        }

        $emailCita = strtolower(trim($body['correo_cliente']));
        if (!isValidEmail($emailCita)) jsonError('Correo electrónico inválido', 422);
        if (strpbrk($emailCita, "'\"`;\\\n\r") !== false) jsonError('Correo electrónico contiene caracteres no permitidos', 422);

        if (!isValidPhone($body['telefono_cliente'])) jsonError('Teléfono inválido (mínimo 10 dígitos)', 422);

        if (mb_strlen($body['nombre_cliente']) > 150) jsonError('Nombre demasiado largo', 422);
        if (mb_strlen($body['direccion'] ?? '') > 255) jsonError('Dirección demasiado larga', 422);
        if (mb_strlen($body['colonia']   ?? '') > 120) jsonError('Colonia demasiado larga', 422);
        if (mb_strlen($body['municipio'] ?? '') > 100) jsonError('Municipio demasiado largo', 422);
        if (mb_strlen($body['ciudad']    ?? '') > 100) jsonError('Ciudad demasiado larga', 422);
        if (mb_strlen($body['notas']     ?? '') > 600) jsonError('Notas demasiado largas', 422);
        $tiposValidos = ['medicion', 'instalacion', 'otro'];
        if (!in_array($body['tipo'], $tiposValidos)) jsonError('tipo inválido. Usa: medicion, instalacion, otro', 422);

        $fechaCita = trim($body['fecha_cita']);
        if (strlen($fechaCita) > 10) $fechaCita = substr($fechaCita, 0, 10);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaCita)) {
            jsonError('fecha_cita debe tener formato YYYY-MM-DD', 422);
        }

        $numeroCita   = generarNumeroCita();
        $direccionCita = sanitize($body['direccion'] ?? '') ?: 'Sin especificar';
        $coloniaCita   = sanitize($body['colonia']   ?? '');
        $municipioCita = sanitize($body['municipio'] ?? '');
        $ciudadCita    = sanitize($body['ciudad']    ?? '');
        $cpCita        = sanitize($body['cp']        ?? '');

        $datosCita = [
            'numero_cita'      => $numeroCita,
            'nombre_cliente'   => sanitize($body['nombre_cliente']),
            'correo_cliente'   => $emailCita,
            'telefono_cliente' => sanitize($body['telefono_cliente']),
            'direccion'        => $direccionCita,
            'colonia'          => $coloniaCita   ?: null,
            'municipio'        => $municipioCita ?: null,
            'ciudad'           => $ciudadCita    ?: null,
            'cp'               => $cpCita        ?: null,
            'fecha_cita'       => $fechaCita,
            'rango_horario'    => sanitize($body['rango_horario'] ?? 'Por confirmar'),
            'tipo'             => $body['tipo'],
            'estado'           => 'nueva',
        ];
        $clienteSession = sesionClienteActiva();
        if ($clienteSession) {
            $tieneClienteId = false;
            try { dbRows("SELECT cliente_id FROM citas LIMIT 0"); $tieneClienteId = true; } catch (\Exception $e) {}
            if ($tieneClienteId) $datosCita['cliente_id'] = $clienteSession['id'];
        }
        $citaId = dbInsert('citas', $datosCita);

        if ($clienteSession) {
            $profileUpdate = [];
            if (!empty($body['telefono_cliente']))                 $profileUpdate['telefono']  = sanitize($body['telefono_cliente']);
            if ($direccionCita !== 'Sin especificar' && !$clienteSession['direccion']) $profileUpdate['direccion'] = $direccionCita;
            if ($coloniaCita   && !$clienteSession['colonia'])   $profileUpdate['colonia']   = $coloniaCita;
            if ($municipioCita && !$clienteSession['municipio']) $profileUpdate['municipio'] = $municipioCita;
            if ($ciudadCita    && !$clienteSession['ciudad'])    $profileUpdate['ciudad']    = $ciudadCita;
            if ($cpCita        && !$clienteSession['cp'])        $profileUpdate['cp']        = $cpCita;
            if ($profileUpdate) {
                try { dbUpdate('clientes', $profileUpdate, 'id = ?', [$clienteSession['id']]); }
                catch (\Exception $e) { appLog('warning', 'No se pudo sincronizar perfil en cita', ['e' => $e->getMessage()]); }
            }
        }

        try {
            notificarNuevaCita([
                'id'               => $citaId,
                'numero_cita'      => $numeroCita,
                'nombre_cliente'   => $body['nombre_cliente'],
                'correo_cliente'   => $body['correo_cliente'],
                'telefono_cliente' => $body['telefono_cliente'],
                'fecha_cita'       => $fechaCita,
                'rango_horario'    => $body['rango_horario'] ?? '',
                'tipo'             => $body['tipo'],
            ]);
        } catch (Throwable $e) {
            appLog('warning', 'Notif cita falló', ['e' => $e->getMessage()]);
        }

        jsonSuccess(['cita_id' => $citaId, 'numero_cita' => $numeroCita], 201);
        break;

    case 'PUT':
        requerirEmpleado();
        if (!$id) jsonError('ID requerido', 400);
        if (!dbRow("SELECT id FROM citas WHERE id = ?", [$id])) jsonError('Cita no encontrada', 404);
        $body = getJsonBody();
        $update = [];
        $estadosValidos = ['nueva', 'confirmada', 'completada', 'cancelada'];
        if (isset($body['estado'])) {
            if (!in_array($body['estado'], $estadosValidos)) jsonError('Estado inválido', 422);
            $update['estado'] = $body['estado'];
        }
        if (isset($body['fecha_cita']))    $update['fecha_cita']    = $body['fecha_cita'];
        if (isset($body['rango_horario'])) $update['rango_horario'] = sanitize($body['rango_horario']);
        if (isset($body['notas']))         $update['notas']         = sanitize($body['notas']);
        if ($update) dbUpdate('citas', $update, 'id = ?', [$id]);
        jsonSuccess(['mensaje' => 'Cita actualizada']);
        break;

    case 'DELETE':
        requerirEmpleado();
        if (!$id) jsonError('ID requerido', 400);
        dbUpdate('citas', ['estado' => 'cancelada'], 'id = ?', [$id]);
        jsonSuccess(['mensaje' => 'Cita cancelada']);
        break;

    default:
        jsonError('Método no permitido', 405);
}