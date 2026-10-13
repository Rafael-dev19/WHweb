<?php
// api/notificaciones.php — Campana de los paneles: la bandeja de CADA persona.
//
// Antes leía la colección compartida de Firestore (la cola de correos/push
// de todo el sistema): todo el personal veía los avisos de todos y "leída"
// era global. Ahora cada aviso se guarda solo para quien le corresponde
// (notificarPanel() en includes/notifications.php) y aquí cada quien ve y
// marca únicamente los suyos.
require_once __DIR__ . '/_helpers.php';

$usuarioNotif = requerirPersonal();
$uid    = (int)$usuarioNotif['id'];
$method = requestMethod();

switch ($method) {
    case 'GET':
        try {
            $rows = dbRows(
                "SELECT id, tipo, titulo, mensaje, url, fecha
                 FROM notificaciones_personal
                 WHERE usuario_personal_id = ? AND leida = 0
                 ORDER BY fecha DESC, id DESC
                 LIMIT 30",
                [$uid]
            );
        } catch (\Throwable $e) {
            $rows = []; // migración 2026_10c aún no aplicada
        }
        $notificaciones = array_map(fn($r) => [
            'id'      => (string)$r['id'],
            'tipo'    => $r['tipo'],
            'titulo'  => $r['titulo'],
            'mensaje' => $r['mensaje'],
            'url'     => $r['url'] ?? '',
            'leida'   => false,
            // ISO con zona para que el navegador muestre la hora local correcta.
            'fecha'   => date('c', strtotime($r['fecha'])),
        ], $rows);
        jsonSuccess(['notificaciones' => $notificaciones]);
        break;

    case 'PUT':
        // ?id=N marca una; ?todas=1 marca todas. Siempre solo las propias.
        requerirCsrf();
        try {
            if (!empty($_GET['todas'])) {
                dbQuery("UPDATE notificaciones_personal SET leida = 1 WHERE usuario_personal_id = ? AND leida = 0", [$uid]);
                jsonSuccess(['mensaje' => 'Notificaciones marcadas como leídas']);
            }
            $id = sanitizeInt($_GET['id'] ?? 0);
            if ($id <= 0) jsonError('ID inválido', 422);
            dbQuery("UPDATE notificaciones_personal SET leida = 1 WHERE id = ? AND usuario_personal_id = ?", [$id, $uid]);
        } catch (\Throwable $e) {
            jsonError('No se pudo actualizar la notificación', 500);
        }
        jsonSuccess(['mensaje' => 'Notificación marcada como leída']);
        break;

    default:
        jsonError('Método no permitido', 405);
}
