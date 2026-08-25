// push-notifications.js — Registro de notificaciones push (Web Push / FCM)
// Se usa SOLO dentro de los paneles de personal (jefe/administrador/empleado/
// disenador). Los clientes nunca reciben push, solo correo — ver
// includes/notifications.php.

// Aviso visible (no solo consola) de por qué no se pudo activar el push —
// sin esto el usuario no se entera de nada si algo falla (ej. iOS sin
// instalar el panel a pantalla de inicio).
function _avisoPush(msg, tipo) {
  console.warn('[Push] ' + msg);
  if (typeof showNotification === 'function') {
    showNotification('<i class="fa-solid fa-bell-slash"></i> ' + msg, tipo || 'info');
  }
}

function _esIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS moderno
}

function _esStandalone() {
  return window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
}

async function registerPush() {
  try {
    // iOS/iPadOS: Safari solo permite Web Push si el sitio está agregado a la
    // pantalla de inicio (iOS 16.4+) — en una pestaña normal ni siquiera se
    // puede pedir el permiso, así que hay que explicarlo en vez de fallar mudo.
    if (_esIOS() && !_esStandalone()) {
      _avisoPush('En iPhone/iPad: para recibir notificaciones, toca Compartir → "Agregar a pantalla de inicio" y vuelve a abrir el panel desde ese ícono (no desde Safari).', 'warning');
      return false;
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      _avisoPush('Este navegador no soporta notificaciones push. Prueba con Chrome, Edge o Safari 16.4+.', 'warning');
      return false;
    }
    if (!window.WH_FCM_VAPID_KEY) {
      _avisoPush('Las notificaciones push aún no están configuradas en el sitio (falta la clave VAPID en Firebase).', 'warning');
      return false;
    }
    if (typeof firebase === 'undefined' || !firebase.messaging) {
      console.warn('[Push] Firebase Messaging SDK no cargado.');
      return false;
    }

    let permiso = Notification.permission;
    if (permiso === 'default') {
      permiso = await Notification.requestPermission();
    }
    if (permiso !== 'granted') {
      _avisoPush('No podrás recibir notificaciones porque el permiso fue denegado. Actívalo desde los ajustes del sitio en tu navegador.', 'warning');
      return false;
    }

    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    if (!window.firebaseApp) {
      if (typeof initFirebase === 'function') initFirebase();
    }
    const messaging = firebase.messaging();

    const token = await messaging.getToken({
      vapidKey: window.WH_FCM_VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
    if (!token) {
      console.warn('[Push] No se pudo obtener el token FCM.');
      return false;
    }

    const resToken = await fetch('/api/push_tokens.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fcm_token: token }),
    });
    const dataToken = await resToken.json().catch(() => ({}));
    if (!resToken.ok || !dataToken.success) {
      _avisoPush('No se pudo registrar este dispositivo para notificaciones (' + (dataToken.error || 'error del servidor') + ').', 'error');
      return false;
    }

    // Notificaciones en primer plano (pestaña activa): el service worker solo
    // dispara con la pestaña en segundo plano, así que aquí se muestra la
    // misma alerta genérica dentro del panel.
    messaging.onMessage((payload) => {
      const titulo = payload.notification?.title || payload.data?.title || 'Wooden House';
      const cuerpo = payload.notification?.body  || payload.data?.body  || 'Ingresa al sitio para ver los detalles.';
      if (typeof showNotification === 'function') {
        showNotification(`<i class="fa-solid fa-bell"></i> <strong>${titulo}</strong> — ${cuerpo}`, 'info');
      }
    });

    return true;
  } catch (e) {
    _avisoPush('No se pudieron activar las notificaciones (' + (e.message || 'error desconocido') + ').', 'error');
    return false;
  }
}

window.registerPush = registerPush;
