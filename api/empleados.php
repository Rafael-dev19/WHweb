<?php
require_once __DIR__ . '/_helpers.php';

$method = requestMethod();
$id     = isset($_GET['id']) ? sanitizeInt($_GET['id']) : null;
$action = $_GET['action'] ?? '';

// ── Reset de 2FA / revocación de sesiones sobre OTRA cuenta de personal ──
// Reproduce por el sitio lo que hoy solo se hacía con UPDATE directo en la BD:
//   UPDATE usuarios_personal SET totp_secreto=NULL, totp_activo=0, sesiones_revocadas_desde=NULL WHERE id=?
// Cualquier jefe/administrador puede ejecutarlo sobre cualquier otra cuenta de
// personal (mismo poder que ya existía por SQL directo); queda auditado.
if ($method === 'POST' && in_array($action, ['reset_2fa', 'revocar_sesiones'], true)) {
    $usuarioActual = requerirGestion();
    requerirCsrf();
    requerirReautenticacion('seguridad_personal', 300);
    if (!$id) jsonError('ID requerido', 400);
    if ($id === (int)$usuarioActual['id']) {
        jsonError('No puedes ejecutar esta acción sobre tu propia cuenta desde el panel. Si perdiste tu propio acceso, usa el procedimiento de base de datos.', 400);
    }
    $objetivo = dbRow("SELECT id, rol FROM usuarios_personal WHERE id = ?", [$id]);
    if (!$objetivo) jsonError('Empleado no encontrado', 404);
    // A diferencia de crear/editar/eliminar cuentas, aquí sí aplica la decisión
    // explícita del plan: cualquier jefe/administrador puede resetear 2FA o
    // revocar sesiones de cualquier otra cuenta de personal, pares incluidos
    // (mismo poder que ya existía por SQL directo).

    if ($action === 'reset_2fa') {
        dbQuery(
            "UPDATE usuarios_personal SET totp_secreto = NULL, totp_activo = 0, sesiones_revocadas_desde = NULL WHERE id = ?",
            [$id]
        );
        $accionAuditoria = 'reset_2fa';
        $mensaje = 'Verificación en dos pasos reseteada. El usuario deberá configurarla de nuevo en su próximo inicio de sesión.';
    } else {
        revocarSesionesPersonal($id);
        $accionAuditoria = 'revocar_sesiones';
        $mensaje = 'Sesiones activas revocadas. El usuario deberá iniciar sesión de nuevo.';
    }

    try {
        dbInsert('auditoria_seguridad_personal', [
            'usuario_afectado_id' => $id,
            'ejecutado_por_id'    => (int)$usuarioActual['id'],
            'accion'              => $accionAuditoria,
        ]);
    } catch (\Throwable $e) {
        appLog('warning', 'auditoria_seguridad_personal insert falló', ['e' => $e->getMessage()]);
    }

    jsonSuccess(['mensaje' => $mensaje]);
}

switch ($method) {
    case 'GET':
        requerirGestion();
        if ($id) {
            $emp = dbRow("SELECT id, firebase_uid, nombre_completo, correo, rol, activo, fecha_creacion FROM usuarios_personal WHERE id = ?", [$id]);
            if (!$emp) jsonError('Empleado no encontrado', 404);
            jsonSuccess(['empleado' => $emp]);
        }
        $page  = max(1, sanitizeInt($_GET['page'] ?? 1));
        $limit = min(50, max(1, sanitizeInt($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $where = ['1=1']; $params = [];
        if (isset($_GET['activo'])) { $where[] = 'activo = ?'; $params[] = sanitizeInt($_GET['activo']); }
        if (!empty($_GET['rol'])) {
            if (!in_array($_GET['rol'], ['jefe', 'administrador', 'empleado', 'disenador'], true)) jsonError('rol inválido', 422);
            $where[] = 'rol = ?'; $params[] = $_GET['rol'];
        }
        if (!empty($_GET['busqueda'])) {
            $b = '%' . $_GET['busqueda'] . '%';
            $where[] = '(nombre_completo LIKE ? OR correo LIKE ?)';
            $params = array_merge($params, [$b, $b]);
        }
        $whereStr = 'WHERE ' . implode(' AND ', $where);
        $total = (int)(dbRow("SELECT COUNT(*) AS n FROM usuarios_personal $whereStr", $params)['n'] ?? 0);
        $params[] = $limit; $params[] = $offset;
        $empleados = dbRows("SELECT id, firebase_uid, nombre_completo, correo, rol, activo, fecha_creacion FROM usuarios_personal $whereStr ORDER BY nombre_completo ASC LIMIT ? OFFSET ?", $params);
        jsonSuccess(['empleados' => $empleados, 'paginacion' => getPaginacion($total, $page, $limit)]);
        break;

    case 'POST':
        $usuarioActual = requerirGestion();
        requerirCsrf();
        $body = getJsonBody();
        requireFields($body, ['firebase_uid', 'nombre_completo', 'correo', 'rol']);
        if (!isValidEmail($body['correo'])) jsonError('correo inválido', 422);
        $rolesValidos = ['jefe', 'administrador', 'empleado', 'disenador'];
        if (!in_array($body['rol'], $rolesValidos)) jsonError('rol inválido', 422);
        if (in_array($body['rol'], ['jefe', 'administrador'], true) && $usuarioActual['rol'] !== 'jefe') {
            jsonError('Solo el jefe puede crear cuentas de jefe o administrador.', 403);
        }

        if (dbRow("SELECT id FROM usuarios_personal WHERE correo = ?", [$body['correo']])) {
            jsonError('correo ya registrado', 409);
        }
        if (dbRow("SELECT id FROM usuarios_personal WHERE firebase_uid = ?", [$body['firebase_uid']])) {
            jsonError('firebase_uid ya registrado', 409);
        }

        $empId = dbInsert('usuarios_personal', [
            'firebase_uid'   => trim($body['firebase_uid']),
            'nombre_completo'=> sanitize($body['nombre_completo']),
            'correo'         => strtolower(trim($body['correo'])),
            'rol'            => $body['rol'],
            'activo'         => 1,
        ]);
        jsonSuccess(['id' => $empId, 'mensaje' => 'Empleado creado'], 201);
        break;

    case 'PUT':
        $usuarioActual = requerirGestion();
        requerirCsrf();
        if (!$id) jsonError('ID requerido', 400);
        $objetivo = dbRow("SELECT id, rol FROM usuarios_personal WHERE id = ?", [$id]);
        if (!$objetivo) jsonError('Empleado no encontrado', 404);
        // Un administrador no puede editar cuentas de jefe/administrador (ni la suya
        // propia desde aquí): evita que el <select> de rol, que en su vista no incluye
        // esas opciones, termine degradando por accidente el rol de una cuenta que no
        // debería poder tocar.
        if (in_array($objetivo['rol'], ['jefe', 'administrador'], true) && $usuarioActual['rol'] !== 'jefe') {
            jsonError('Solo el jefe puede editar cuentas de jefe o administrador.', 403);
        }
        $body = getJsonBody();
        $update = [];
        if (isset($body['nombre_completo'])) $update['nombre_completo'] = sanitize($body['nombre_completo']);
        if (isset($body['correo'])) {
            if (!isValidEmail($body['correo'])) jsonError('correo inválido', 422);
            $update['correo'] = strtolower(trim($body['correo']));
        }
        if (isset($body['rol'])) {
            if (!in_array($body['rol'], ['jefe', 'administrador', 'empleado', 'disenador'], true)) jsonError('rol inválido', 422);
            if (in_array($body['rol'], ['jefe', 'administrador'], true) && $usuarioActual['rol'] !== 'jefe') {
                jsonError('Solo el jefe puede asignar el rol de jefe o administrador.', 403);
            }
            $update['rol'] = $body['rol'];
        }
        if (isset($body['activo'])) $update['activo'] = (int)(bool)$body['activo'];
        if ($update) dbUpdate('usuarios_personal', $update, 'id = ?', [$id]);
        jsonSuccess(['mensaje' => 'Empleado actualizado']);
        break;

    case 'DELETE':
        $usuarioActual = requerirGestion();
        requerirCsrf();
        if (!$id) jsonError('ID requerido', 400);
        $objetivo = dbRow("SELECT id, rol FROM usuarios_personal WHERE id = ?", [$id]);
        if (!$objetivo) jsonError('Empleado no encontrado', 404);
        if (in_array($objetivo['rol'], ['jefe', 'administrador'], true) && $usuarioActual['rol'] !== 'jefe') {
            jsonError('Solo el jefe puede desactivar cuentas de jefe o administrador.', 403);
        }
        dbUpdate('usuarios_personal', ['activo' => 0], 'id = ?', [$id]);
        jsonSuccess(['mensaje' => 'Empleado desactivado']);
        break;

    default:
        jsonError('Método no permitido', 405);
}
