<?php
require_once __DIR__ . '/_helpers.php';

$method = requestMethod();
$id     = isset($_GET['id']) ? sanitizeInt($_GET['id']) : null;
$action = $_GET['action'] ?? '';

// ── Revocación de sesiones sobre OTRA cuenta de personal ──
// Cualquier jefe/administrador puede ejecutarlo sobre cualquier otra cuenta de
// personal (mismo poder que ya existía por SQL directo); queda auditado.
if ($method === 'POST' && $action === 'revocar_sesiones') {
    $usuarioActual = requerirGestion();
    requerirCsrf();
    requerirReautenticacion('seguridad_personal', 300);
    if (!$id) jsonError('ID requerido', 400);
    if ($id === (int)$usuarioActual['id']) {
        jsonError('No puedes ejecutar esta acción sobre tu propia cuenta desde el panel. Si perdiste tu propio acceso, usa el procedimiento de base de datos.', 400);
    }
    $objetivo = dbRow("SELECT id, rol FROM usuarios_personal WHERE id = ?", [$id]);
    if (!$objetivo) jsonError('Empleado no encontrado', 404);

    revocarSesionesPersonal($id);
    $accionAuditoria = 'revocar_sesiones';
    $mensaje = 'Sesiones activas revocadas. El usuario deberá iniciar sesión de nuevo.';

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
            $emp = dbRow("SELECT id, firebase_uid, nombre_completo, correo, rol, area, activo, fecha_creacion FROM usuarios_personal WHERE id = ?", [$id]);
            if (!$emp) jsonError('Empleado no encontrado', 404);
            jsonSuccess(['empleado' => $emp]);
        }
        $page  = max(1, sanitizeInt($_GET['page'] ?? 1));
        $limit = min(50, max(1, sanitizeInt($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $where = ['1=1']; $params = [];
        if (isset($_GET['activo'])) { $where[] = 'activo = ?'; $params[] = sanitizeInt($_GET['activo']); }
        if (!empty($_GET['rol'])) {
            if (!in_array($_GET['rol'], ['jefe', 'administrador', 'empleado', 'disenador', 'ventas'], true)) jsonError('rol inválido', 422);
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
        $empleados = dbRows("SELECT id, firebase_uid, nombre_completo, correo, rol, area, activo, fecha_creacion FROM usuarios_personal $whereStr ORDER BY nombre_completo ASC LIMIT ? OFFSET ?", $params);
        jsonSuccess(['empleados' => $empleados, 'paginacion' => getPaginacion($total, $page, $limit)]);
        break;

    case 'POST':
        $usuarioActual = requerirGestion();
        requerirCsrf();
        $body = getJsonBody();
        requireFields($body, ['firebase_uid', 'nombre_completo', 'correo', 'rol']);
        if (!isValidEmail($body['correo'])) jsonError('correo inválido', 422);
        $rolesValidos = ['jefe', 'administrador', 'empleado', 'disenador', 'ventas'];
        if (!in_array($body['rol'], $rolesValidos)) jsonError('rol inválido', 422);
        // El rol de administrador solo lo puede otorgar otro administrador, y el
        // rol de jefe (el más alto, dueño del taller) solo lo puede otorgar otro
        // jefe — un administrador NO puede crear cuentas jefe (antes sí podía,
        // era un hueco de escalamiento de privilegios).
        if ($body['rol'] === 'administrador' && $usuarioActual['rol'] !== 'administrador') {
            jsonError('Solo un administrador puede crear cuentas de administrador.', 403);
        }
        if ($body['rol'] === 'jefe' && $usuarioActual['rol'] !== 'jefe') {
            jsonError('Solo un jefe puede crear cuentas de jefe.', 403);
        }
        $area = null;
        if ($body['rol'] === 'empleado' && !empty($body['area'])) {
            if (!in_array($body['area'], ['taller', 'instalacion'], true)) jsonError('area inválida', 422);
            $area = $body['area'];
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
            'area'           => $area,
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
        $body = getJsonBody();
        $update = [];
        if (isset($body['nombre_completo'])) $update['nombre_completo'] = sanitize($body['nombre_completo']);
        if (isset($body['correo'])) {
            if (!isValidEmail($body['correo'])) jsonError('correo inválido', 422);
            $update['correo'] = strtolower(trim($body['correo']));
        }
        if (isset($body['rol'])) {
            if (!in_array($body['rol'], ['jefe', 'administrador', 'empleado', 'disenador', 'ventas'], true)) jsonError('rol inválido', 422);
            // Mismo criterio que al crear: administrador solo lo otorga otro
            // administrador, jefe solo lo otorga otro jefe. Solo se exige
            // cuando el rol REALMENTE cambia — el formulario siempre reenvía
            // el rol actual aunque solo se edite el nombre, y por ejemplo un
            // jefe editando el nombre de un administrador no debe bloquearse
            // solo porque él no puede *otorgar* el rol administrador.
            if ($body['rol'] !== $objetivo['rol']) {
                if ($body['rol'] === 'administrador' && $usuarioActual['rol'] !== 'administrador') {
                    jsonError('Solo un administrador puede asignar el rol de administrador.', 403);
                }
                if ($body['rol'] === 'jefe' && $usuarioActual['rol'] !== 'jefe') {
                    jsonError('Solo un jefe puede asignar el rol de jefe.', 403);
                }
            }
            $update['rol'] = $body['rol'];
            // Si deja de ser 'empleado', el área ya no aplica.
            if ($body['rol'] !== 'empleado') $update['area'] = null;
        }
        if (array_key_exists('area', $body)) {
            $rolFinal = $update['rol'] ?? $objetivo['rol'];
            if ($rolFinal !== 'empleado') {
                $update['area'] = null;
            } elseif (empty($body['area'])) {
                $update['area'] = null;
            } else {
                if (!in_array($body['area'], ['taller', 'instalacion'], true)) jsonError('area inválida', 422);
                $update['area'] = $body['area'];
            }
        }
        if (isset($body['activo'])) $update['activo'] = (int)(bool)$body['activo'];
        if ($update) dbUpdate('usuarios_personal', $update, 'id = ?', [$id]);
        // Mantener el claim de Firebase al día: desactivado = sin permiso de
        // subir archivos; cambio de rol = claim con el rol nuevo.
        $actual = dbRow("SELECT firebase_uid, rol, activo FROM usuarios_personal WHERE id = ?", [$id]);
        if ($actual) firebaseMarcarPersonal($actual['firebase_uid'], $actual['activo'] ? $actual['rol'] : null);
        jsonSuccess(['mensaje' => 'Empleado actualizado']);
        break;

    case 'DELETE':
        $usuarioActual = requerirGestion();
        requerirCsrf();
        if (!$id) jsonError('ID requerido', 400);
        $objetivo = dbRow("SELECT id, rol FROM usuarios_personal WHERE id = ?", [$id]);
        if (!$objetivo) jsonError('Empleado no encontrado', 404);
        dbUpdate('usuarios_personal', ['activo' => 0], 'id = ?', [$id]);
        $uidBaja = dbRow("SELECT firebase_uid FROM usuarios_personal WHERE id = ?", [$id])['firebase_uid'] ?? '';
        firebaseMarcarPersonal($uidBaja, null); // quitar permiso de Storage
        revocarSesionesPersonal($id);
        jsonSuccess(['mensaje' => 'Empleado desactivado']);
        break;

    default:
        jsonError('Método no permitido', 405);
}
