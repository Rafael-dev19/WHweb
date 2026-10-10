<?php
require_once __DIR__ . '/_helpers.php';

$usuarioNotif = requerirPersonal();
$method = requestMethod();
$id     = trim($_GET['id'] ?? '');

switch ($method) {
    case 'GET':
        $destinosValidos = ['todos', 'admin', 'empleado'];
        $destino = trim($_GET['destino'] ?? 'todos');
        if (!in_array($destino, $destinosValidos, true)) $destino = 'todos';
        $r = firestoreRequest('GET', 'notificaciones', ['pageSize' => 50, 'orderBy' => 'fecha desc']);
        $httpCode = $r['code'];
        $response = $r['body'];

        $notificaciones = [];
        if ($httpCode === 200) {
            $data = json_decode($response, true);
            $docs = $data['documents'] ?? [];
            foreach ($docs as $doc) {
                $fields = $doc['fields'] ?? [];
                $notif = [
                    'id'         => basename($doc['name'] ?? ''),
                    'tipo'       => $fields['tipo']['stringValue'] ?? '',
                    'titulo'     => $fields['titulo']['stringValue'] ?? '',
                    'mensaje'    => $fields['mensaje']['stringValue'] ?? '',
                    'referencia' => $fields['referencia']['stringValue'] ?? '',
                    'destino'    => $fields['destino']['stringValue'] ?? 'todos',
                    'leida'      => ($fields['leida']['booleanValue'] ?? false) === true,
                    'fecha'      => $fields['fecha']['timestampValue'] ?? $fields['fecha']['stringValue'] ?? '',
                ];
                // Sin permiso de montos (taller/instalación/diseño/administrador):
                // quitar las cifras ("… por $20,900.00") del texto del aviso.
                if (!puedeVerMontos($usuarioNotif)) {
                    $notif['mensaje'] = preg_replace('/\s*por\s*\$\s*[\d.,]+/u', '', $notif['mensaje']);
                }
                if (!$notif['leida'] && ($destino === 'todos' || $notif['destino'] === $destino || $notif['destino'] === 'todos')) {
                    $notificaciones[] = $notif;
                }
            }
        }

        jsonSuccess(['notificaciones' => $notificaciones]);
        break;

    case 'POST':
        requerirCsrf();
        $body = getJsonBody();
        requireFields($body, ['tipo', 'titulo', 'mensaje']);
        $ok = crearNotificacionFirestore(
            sanitize($body['tipo']),
            sanitize($body['titulo']),
            sanitize($body['mensaje']),
            ['referencia' => sanitize($body['referencia'] ?? ''), 'destino' => sanitize($body['destino'] ?? 'todos')]
        );
        if ($ok) {
            jsonSuccess(['mensaje' => 'Notificación creada']);
        } else {
            jsonError('Error al crear notificación en Firestore', 500);
        }
        break;

    case 'PUT':
        requerirCsrf();
        if (!$id) jsonError('ID requerido', 400);
        if (!preg_match('/^[a-zA-Z0-9_-]{1,128}$/', $id)) jsonError('ID inválido', 422);
        $ok = marcarNotificacionLeida($id);
        if ($ok) {
            jsonSuccess(['mensaje' => 'Notificación marcada como leída']);
        } else {
            jsonError('Error al actualizar notificación', 500);
        }
        break;

    default:
        jsonError('Método no permitido', 405);
}