<?php
// api/push_tokens.php — Registro de tokens FCM para notificaciones push del personal.
// Solo personal interno (jefe/administrador/empleado/disenador) recibe push; los
// clientes siguen recibiendo todo por correo (ver includes/notifications.php).
require_once __DIR__ . '/_helpers.php';

$method = requestMethod();
$action = $_GET['action'] ?? '';

// ── Limpieza de tokens muertos, llamada por la Cloud Function ──────────
// FCM le dice a enviarPush() qué tokens ya no son válidos (dispositivo
// desinstalado, permiso revocado, token rotado); esta acción los marca
// inactivos aquí para no seguir intentando enviarles push en vano.
// Autenticada con un secreto compartido (no hay sesión de personal del
// lado de la Cloud Function), nunca con las credenciales de un usuario.
if ($method === 'POST' && $action === 'limpiar') {
    $secreto = $_SERVER['HTTP_X_PUSH_SECRET'] ?? '';
    if (empty(PUSH_CLEANUP_SECRET) || !hash_equals(PUSH_CLEANUP_SECRET, $secreto)) {
        jsonError('No autorizado', 403);
    }
    $body   = getJsonBody();
    $tokens = array_values(array_filter(array_map('trim', $body['tokens'] ?? []), fn($t) => $t !== '' && strlen($t) <= 255));
    if (empty($tokens)) jsonSuccess(['desactivados' => 0]);

    $placeholders = implode(',', array_fill(0, count($tokens), '?'));
    dbQuery("UPDATE dispositivos_push SET activo = 0 WHERE fcm_token IN ($placeholders)", $tokens);
    jsonSuccess(['desactivados' => count($tokens)]);
}

switch ($method) {
    // ── Estado de un token para el dispositivo actual (módulo de notificaciones) ──
    case 'GET':
        $usuario = requerirPersonal();
        $token = trim($_GET['fcm_token'] ?? '');
        if (empty($token) || strlen($token) > 255) jsonError('fcm_token inválido', 422);
        $row = dbRow(
            "SELECT id FROM dispositivos_push WHERE fcm_token = ? AND usuario_personal_id = ? AND activo = 1",
            [$token, (int)$usuario['id']]
        );
        jsonSuccess(['activo' => (bool)$row]);
        break;

    case 'POST':
        $usuario = requerirPersonal();
        requerirCsrf();
        // El administrador (soporte técnico) no recibe push — ver
        // includes/notifications.php. Si este dispositivo era de otra
        // cuenta, se da de baja para que no le lleguen avisos ajenos.
        if ($usuario['rol'] === 'administrador') {
            $tokAdm = trim(getJsonBody()['fcm_token'] ?? '');
            if ($tokAdm !== '') dbQuery("UPDATE dispositivos_push SET activo = 0 WHERE fcm_token = ?", [$tokAdm]);
            jsonSuccess(['mensaje' => 'El administrador no recibe notificaciones push']);
        }
        $body  = getJsonBody();
        $token = trim($body['fcm_token'] ?? '');
        if (empty($token) || strlen($token) > 255) {
            jsonError('fcm_token inválido', 422);
        }
        $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);

        dbQuery(
            "INSERT INTO dispositivos_push (usuario_personal_id, fcm_token, user_agent, activo, ultima_actividad)
             VALUES (?, ?, ?, 1, NOW())
             ON DUPLICATE KEY UPDATE usuario_personal_id = VALUES(usuario_personal_id),
                                     user_agent = VALUES(user_agent),
                                     activo = 1,
                                     ultima_actividad = NOW()",
            [(int)$usuario['id'], $token, $ua]
        );
        jsonSuccess(['mensaje' => 'Token de notificaciones registrado']);
        break;

    case 'DELETE':
        $usuario = requerirPersonal();
        requerirCsrf();
        $body  = getJsonBody();
        $token = trim($body['fcm_token'] ?? '');
        if (empty($token)) jsonError('fcm_token requerido', 422);

        dbQuery(
            "UPDATE dispositivos_push SET activo = 0 WHERE fcm_token = ? AND usuario_personal_id = ?",
            [$token, (int)$usuario['id']]
        );
        jsonSuccess(['mensaje' => 'Token dado de baja']);
        break;

    default:
        jsonError('Método no permitido', 405);
}
