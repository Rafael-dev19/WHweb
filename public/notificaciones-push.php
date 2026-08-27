<?php
// notificaciones-push.php — Módulo de activación de notificaciones push.
// A pedido del jefe, el personal (jefe/empleado/disenador) pasa por aquí en
// cada inicio de sesión mientras no tenga las notificaciones activadas en
// ese dispositivo; una vez activadas, login ya no lo trae aquí (ver
// modal-auth.js). El administrador nunca recibe push (ver
// includes/notifications.php) así que jamás debería aterrizar aquí — si lo
// hace de todos modos, se le manda directo a su panel.
require_once dirname(__DIR__) . '/includes/config.php';
require_once dirname(__DIR__) . '/includes/db.php';
require_once dirname(__DIR__) . '/includes/functions.php';
require_once dirname(__DIR__) . '/includes/auth.php';

$_usuario = sesionActiva();
if (!$_usuario) {
    header('Location: /acceso-denegado');
    exit;
}

$_rol = $_usuario['rol'];
unset($_usuario);

if ($_rol === 'administrador') {
    header('Location: /admin/panel_administrador.php');
    exit;
}
if (!in_array($_rol, ['jefe', 'empleado', 'disenador'], true)) {
    header('Location: /acceso-denegado');
    exit;
}

$_destino = $_rol === 'jefe' ? '/admin/panel_administrador.php' : '/empleado/panel_empleado.php';
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Activar notificaciones — Wooden House</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="manifest" href="<?= $_rol === 'jefe' ? '/admin/manifest.json' : '/empleado/manifest.json' ?>">
  <link rel="apple-touch-icon" href="/assets/img/logo-icon-maskable.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap">
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js" defer></script>
  <link rel="stylesheet" href="./assets/<?= av('css/push-prompt.css') ?>">
</head>
<body>

  <main id="contenido-principal">
    <div class="pg-card" id="pgCard">
      <div class="pg-logo">
        <img src="/assets/img/logo-header.png" alt="Wooden House">
      </div>
      <div id="pgContent">
        <div class="pg-icon"><i class="wh-icon-spin" data-lucide="loader-circle"></i></div>
      </div>
    </div>
  </main>

  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check-compat.js"></script>
  <script src="./assets/<?= av('js/firebase-config.js') ?>"></script>
  <script>window.WH_FCM_VAPID_KEY = <?= json_encode(FCM_VAPID_KEY) ?>;</script>
  <script src="./assets/<?= av('js/push-notifications.js') ?>"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function () {
      if (window.lucide) window.lucide.createIcons();
      initPushGate('pgContent', <?= json_encode($_destino) ?>);
    });
  </script>
</body>
</html>
