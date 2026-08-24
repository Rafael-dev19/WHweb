// push-notifications.js — Registro de notificaciones push (Web Push / FCM)
// Se usa SOLO dentro de los paneles de personal (jefe/administrador/empleado/
// disenador). Los clientes nunca reciben push, solo correo — ver
// includes/notifications.php.

async function registerPush() {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push] Este navegador no soporta notificaciones push.');
      return false;
    }
    if (!window.WH_FCM_VAPID_KEY) {
      console.warn('[Push] FCM_VAPID_KEY no configurada — el jefe debe generarla en Firebase Console.');
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
      console.warn('[Push] Permiso de notificaciones no concedido.');
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

    await fetch('/api/push_tokens.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fcm_token: token }),
    });

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
    console.warn('[Push] registerPush error:', e);
    return false;
  }
}

window.registerPush = registerPush;
