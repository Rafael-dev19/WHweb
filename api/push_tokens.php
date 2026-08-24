<?php
// api/push_tokens.php — Registro de tokens FCM para notificaciones push del personal.
// Solo personal interno (jefe/administrador/empleado/disenador) recibe push; los
// clientes siguen recibiendo todo por correo (ver includes/notifications.php).
require_once __DIR__ . '/_helpers.php';

$method = requestMethod();

switch ($method) {
    case 'POST':
        $usuario = requerirPersonal();
        requerirCsrf();
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
