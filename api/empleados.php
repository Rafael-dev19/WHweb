<?php
require_once __DIR__ . '/_helpers.php';

$method = requestMethod();
$id     = isset($_GET['id']) ? sanitizeInt($_GET['id']) : null;

switch ($method) {
    case 'GET':
        requerirAdmin();
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
            if (!in_array($_GET['rol'], ['administrador', 'empleado'], true)) jsonError('rol inválido', 422);
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
        requerirAdmin();
        $body = getJsonBody();
        requireFields($body, ['firebase_uid', 'nombre_completo', 'correo', 'rol']);
        if (!isValidEmail($body['correo'])) jsonError('correo inválido', 422);
        $rolesValidos = ['administrador', 'empleado'];
        if (!in_array($body['rol'], $rolesValidos)) jsonError('rol inválido', 422);

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
        requerirAdmin();
        if (!$id) jsonError('ID requerido', 400);
        if (!dbRow("SELECT id FROM usuarios_personal WHERE id = ?", [$id])) jsonError('Empleado no encontrado', 404);
        $body = getJsonBody();
        $update = [];
        if (isset($body['nombre_completo'])) $update['nombre_completo'] = sanitize($body['nombre_completo']);
        if (isset($body['correo'])) {
            if (!isValidEmail($body['correo'])) jsonError('correo inválido', 422);
            $update['correo'] = strtolower(trim($body['correo']));
        }
        if (isset($body['rol'])) {
            if (!in_array($body['rol'], ['administrador', 'empleado'])) jsonError('rol inválido', 422);
            $update['rol'] = $body['rol'];
        }
        if (isset($body['activo'])) $update['activo'] = (int)(bool)$body['activo'];
        if ($update) dbUpdate('usuarios_personal', $update, 'id = ?', [$id]);
        jsonSuccess(['mensaje' => 'Empleado actualizado']);
        break;

    case 'DELETE':
        requerirAdmin();
        if (!$id) jsonError('ID requerido', 400);
        dbUpdate('usuarios_personal', ['activo' => 0], 'id = ?', [$id]);
        jsonSuccess(['mensaje' => 'Empleado desactivado']);
        break;

    default:
        jsonError('Método no permitido', 405);
}
