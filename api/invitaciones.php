<?php
require_once __DIR__ . '/_helpers.php';

$method = requestMethod();
$action = $_GET['action'] ?? '';

switch ($action) {

    // ── Crear invitación (solo admin) ─────────────────────────────
    // POST /api/invitaciones.php?action=crear
    // Body: { nombre_completo, correo, rol }
    // Respuesta: enlace de invitación enviado al correo del empleado.
    case 'crear':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        requerirAdmin();
        requerirCsrf();
        checkRateLimit('inv_crear', 10, 3600);

        $body   = getJsonBody();
        requireFields($body, ['nombre_completo', 'correo', 'rol']);

        $nombre = sanitize($body['nombre_completo']);
        $correo = strtolower(trim($body['correo']));
        $rol    = $body['rol'];

        if (strlen($nombre) < 2)
            jsonError('Nombre demasiado corto', 422);
        if (!isValidEmail($correo))
            jsonError('Correo inválido', 422);
        if (!in_array($rol, ['administrador', 'empleado'], true))
            jsonError('Rol inválido', 422);

        // Verificar que el correo no esté ya en uso
        if (dbRow("SELECT id FROM usuarios_personal WHERE correo = ?", [$correo]))
            jsonError('Ese correo ya tiene una cuenta de personal activa.', 409);

        // Invalidar invitaciones previas para ese correo
        dbQuery("DELETE FROM invitaciones_personal WHERE correo = ? AND usada_en IS NULL", [$correo]);

        // Generar token seguro (64 hex chars = 256 bits)
        $token     = bin2hex(random_bytes(32));
        $expira    = date('Y-m-d H:i:s', strtotime('+48 hours'));
        $adminId   = (int)$_SESSION['usuario_id'];

        dbInsert('invitaciones_personal', [
            'token'          => $token,
            'correo'         => $correo,
            'nombre_completo'=> $nombre,
            'rol'            => $rol,
            'creada_por'     => $adminId,
            'expira_en'      => $expira,
        ]);

        // Disparar correo vía Firestore → Cloud Function
        notificarInvitacionPersonal([
            'token'          => $token,
            'correo'         => $correo,
            'nombre_completo'=> $nombre,
            'rol'            => $rol,
        ]);

        jsonSuccess(['mensaje' => "Invitación enviada a {$correo}. El enlace expira en 48 horas."]);
        break;

    // ── Validar token (público, antes de mostrar el form) ─────────
    // GET /api/invitaciones.php?action=validar&token=xxx
    case 'validar':
        if ($method !== 'GET') jsonError('Método no permitido', 405);
        $token = trim($_GET['token'] ?? '');
        if (strlen($token) !== 64) jsonError('Token inválido', 400);

        $inv = dbRow(
            "SELECT nombre_completo, correo, rol, expira_en, usada_en
             FROM invitaciones_personal WHERE token = ? LIMIT 1",
            [$token]
        );
        if (!$inv) jsonError('Invitación no encontrada o inválida.', 404);
        if ($inv['usada_en'] !== null) jsonError('Esta invitación ya fue usada.', 410);
        if (strtotime($inv['expira_en']) < time())
            jsonError('Esta invitación ha expirado. Pide al administrador que la reenvíe.', 410);

        jsonSuccess([
            'nombre_completo' => $inv['nombre_completo'],
            'correo'          => $inv['correo'],
            'rol'             => $inv['rol'],
        ]);
        break;

    // ── Activar cuenta usando la invitación ───────────────────────
    // POST /api/invitaciones.php?action=activar
    // Body: { token, firebase_token }
    // El empleado ya creó su cuenta en Firebase y manda el ID token aquí.
    case 'activar':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        requerirCsrf();
        checkRateLimit('inv_activar', 10, 3600);

        $body         = getJsonBody();
        $token        = trim($body['token'] ?? '');
        $firebaseToken= trim($body['firebase_token'] ?? '');

        if (strlen($token) !== 64)  jsonError('Token de invitación inválido', 400);
        if (empty($firebaseToken))  jsonError('firebase_token requerido', 422);

        $inv = dbRow(
            "SELECT id, nombre_completo, correo, rol, expira_en, usada_en
             FROM invitaciones_personal WHERE token = ? LIMIT 1",
            [$token]
        );
        if (!$inv)                  jsonError('Invitación inválida.', 404);
        if ($inv['usada_en'])       jsonError('Esta invitación ya fue usada.', 410);
        if (strtotime($inv['expira_en']) < time())
            jsonError('Invitación expirada.', 410);

        // Verificar que el token de Firebase corresponde al correo de la invitación
        $payload = verificarTokenFirebase($firebaseToken);
        if (!$payload) jsonError('Token de Firebase inválido o expirado.', 401);

        $uid            = $payload['uid'] ?? '';
        $emailFirebase  = strtolower($payload['email'] ?? '');
        if (empty($uid)) jsonError('Token sin UID.', 401);
        if ($emailFirebase !== strtolower($inv['correo']))
            jsonError('El correo de la invitación no coincide con la cuenta de Firebase.', 403);

        // Verificar que el UID no exista ya en la BD
        if (dbRow("SELECT id FROM usuarios_personal WHERE firebase_uid = ?", [$uid]))
            jsonError('Esta cuenta de Firebase ya está registrada.', 409);

        // Crear el registro de empleado
        $empId = dbInsert('usuarios_personal', [
            'firebase_uid'    => $uid,
            'nombre_completo' => $inv['nombre_completo'],
            'correo'          => $inv['correo'],
            'rol'             => $inv['rol'],
            'activo'          => 1,
        ]);

        // Marcar invitación como usada
        dbQuery(
            "UPDATE invitaciones_personal SET usada_en = NOW() WHERE id = ?",
            [(int)$inv['id']]
        );

        // Crear sesión para que el empleado entre directamente
        $usuario = dbRow("SELECT * FROM usuarios_personal WHERE id = ? LIMIT 1", [$empId]);
        if ($usuario) _crearSesion($usuario);

        $redirect = $inv['rol'] === 'administrador' ? '/admin' : '/empleado';
        jsonSuccess([
            'activado' => true,
            'redirect' => $redirect . '?setup_2fa=1',   // forzar setup de 2FA al entrar
            'mensaje'  => '¡Cuenta creada! Configura tu autenticación de dos factores.',
        ]);
        break;

    default:
        jsonError('Acción no válida', 400);
}
