// firebase-messaging-sw.js — Service worker de Firebase Cloud Messaging.
// Debe vivir en la raíz servida (mismo nivel que index.php) para tener alcance
// (scope) sobre todo el sitio. Solo se registra en los paneles de personal
// (jefe/administrador/empleado/disenador) — ver assets/js/push-notifications.js.
//
// IMPORTANTE: este archivo corre en un Service Worker, no tiene `window` ni
// acceso a firebase-config.js (que usa `window.*`). El objeto de config se
// duplica aquí a propósito — si cambia el proyecto de Firebase, actualízalo
// también aquí.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyA0G4QZuxw0l7hH82SW_Y8_UurYsqyrMGs",
  authDomain:        "woodenhouse-898de.firebaseapp.com",
  projectId:         "woodenhouse-898de",
  storageBucket:     "woodenhouse-898de.firebasestorage.app",
  messagingSenderId: "662534856209",
  appId:             "1:662534856209:web:a69eba68addb491d0a1bb0",
});

const messaging = firebase.messaging();

// Notificación con el sitio en segundo plano o cerrado. El contenido siempre
// es genérico a propósito (ver includes/notifications.php): el detalle real
// se ve entrando al panel, nunca viaja en el push.
messaging.onBackgroundMessage((payload) => {
  const titulo = payload.notification?.title || payload.data?.title || 'Wooden House';
  const cuerpo = payload.notification?.body  || payload.data?.body  || 'Ingresa al sitio para ver los detalles.';
  const url    = payload.data?.click_url || payload.fcmOptions?.link || '/';

  self.registration.showNotification(titulo, {
    body: cuerpo,
    icon: '/assets/img/logo-icon.png',
    badge: '/assets/img/logo-icon.png',
    data: { url },
  });
});

// Al hacer clic en la notificación, enfocar una pestaña ya abierta del sitio
// o abrir una nueva en la URL indicada.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
