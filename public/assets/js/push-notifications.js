// push-notifications.js — Registro de notificaciones push (Web Push / FCM)
// Se usa SOLO para personal (jefe/empleado/disenador) — el administrador no
// recibe push (ver includes/notifications.php) y los clientes tampoco, solo
// correo.
//
// Dos responsabilidades separadas:
//  1. registerPush() / initPushGate() — el módulo de activación
//     (notificaciones-push.php). Login redirige ahí mientras no estén
//     activadas en este dispositivo (si ya lo están, salta directo al panel
//     — ver _destinoTrasLogin en modal-auth.js). El menú de notificaciones
//     de cada panel también enlaza ahí para revisar el estado o
//     desactivarlas cuando se quiera — en ese caso initPushGate() muestra
//     una vista de estado en vez de saltarse el módulo.
//  2. initPushForegroundListener() — se llama desde dentro de los paneles en
//     cada carga; si el permiso ya está concedido, engancha el aviso en
//     pantalla para pushes que llegan con la pestaña activa (el service
//     worker solo dispara con la pestaña en segundo plano).

const WH_PUSH_LS_REGISTRADO  = 'wh_push_registrado';
// Alguien desactivó el push en ESTE dispositivo a propósito (módulo de
// notificaciones): no se vuelve a registrar solo al entrar al panel.
const WH_PUSH_LS_OPTOUT      = 'wh_push_optout';

function _avisoPush(msg, tipo) {
  console.warn('[Push] ' + msg);
  if (typeof showNotification === 'function') {
    showNotification('<i data-lucide="bell-off"></i> ' + msg, tipo || 'info');
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

function _esSafari() {
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
}
function _esFirefox() {
  return /Firefox/.test(navigator.userAgent);
}

function _leerCsrfCookie() {
  const cookie = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('XSRF-TOKEN='));
  return cookie ? decodeURIComponent(cookie.split('=')[1]) : '';
}

/* ── Aviso en pantalla para pushes recibidos con la pestaña activa ─────── */
function _bindForegroundOnMessage(messaging) {
  messaging.onMessage((payload) => {
    const titulo = payload.notification?.title || payload.data?.title || 'Wooden House';
    const cuerpo = payload.notification?.body  || payload.data?.body  || 'Ingresa al sitio para ver los detalles.';
    if (typeof showNotification === 'function') {
      showNotification(`<i data-lucide="bell"></i> <strong>${titulo}</strong> — ${cuerpo}`, 'info');
    }
  });
}

/* Engancha el aviso en pantalla si el permiso ya está concedido — se llama
   al cargar cada panel. No pide permiso ni registra token (eso es cosa del
   módulo de activación); si el permiso no está en 'granted' no hace nada. */
async function initPushForegroundListener() {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (typeof firebase === 'undefined' || !firebase.messaging) return;
    if (!window.firebaseApp && typeof initFirebase === 'function') initFirebase();
    _bindForegroundOnMessage(firebase.messaging());
    _reasignarDispositivo();
  } catch (e) {
    console.warn('[Push] initPushForegroundListener error:', e);
  }
}

/* El push de un dispositivo es de quien tiene la sesión abierta en él. En un
   teléfono/PC que usan varias personas, antes seguía llegando el push de la
   última cuenta que lo activó aunque ya hubiera entrado otra. Al cargar el
   panel se reasigna el dispositivo a la cuenta actual (una vez por sesión);
   el administrador nunca recibe push. */
async function _reasignarDispositivo() {
  try {
    if (window.WH_ROL === 'administrador' || !window.WH_UID) return;
    if (localStorage.getItem(WH_PUSH_LS_OPTOUT) === '1') return;
    if (sessionStorage.getItem('wh_push_dueno') === String(window.WH_UID)) return;
    const token = await _obtenerTokenActual();
    if (!token) return;
    const res = await fetch('/api/push_tokens.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': _leerCsrfCookie() },
      body: JSON.stringify({ fcm_token: token }),
    });
    if (res.ok) sessionStorage.setItem('wh_push_dueno', String(window.WH_UID));
  } catch (e) { /* sin push no pasa nada: el panel sigue funcionando */ }
}

/* Al cerrar sesión: este dispositivo deja de recibir push de esa cuenta
   (si otra persona entra después, se le reasigna a ella). */
async function bajaPushDispositivo() {
  try {
    sessionStorage.removeItem('wh_push_dueno');
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const token = await Promise.race([_obtenerTokenActual(), new Promise(r => setTimeout(() => r(null), 3000))]);
    if (token) await deactivatePush(token);
  } catch (e) { /* no bloquear el cierre de sesión */ }
}
window.bajaPushDispositivo = bajaPushDispositivo;

/* ── Registro real: pide permiso (dispara el diálogo nativo del navegador
   SOLO si el permiso está en "default") y registra el token en el servidor.
   Devuelve un status en vez de boolean para que el módulo de activación
   sepa qué UI mostrar. */
async function registerPush() {
  try {
    if (_esIOS() && !_esStandalone()) {
      return { ok: false, status: 'ios-no-instalado' };
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { ok: false, status: 'no-soportado' };
    }
    if (!window.WH_FCM_VAPID_KEY) {
      _avisoPush('Las notificaciones push aún no están configuradas en el sitio (falta la clave VAPID en Firebase).', 'warning');
      return { ok: false, status: 'sin-vapid' };
    }
    if (typeof firebase === 'undefined' || !firebase.messaging) {
      console.warn('[Push] Firebase Messaging SDK no cargado.');
      return { ok: false, status: 'sin-sdk' };
    }

    let permiso = Notification.permission;
    if (permiso === 'default') {
      permiso = await Notification.requestPermission();
    }
    if (permiso !== 'granted') {
      return { ok: false, status: 'denegado' };
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
      return { ok: false, status: 'sin-token' };
    }

    const resToken = await fetch('/api/push_tokens.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': _leerCsrfCookie() },
      body: JSON.stringify({ fcm_token: token }),
    });
    const dataToken = await resToken.json().catch(() => ({}));
    if (!resToken.ok || !dataToken.success) {
      _avisoPush('No se pudo registrar este dispositivo para notificaciones (' + (dataToken.error || 'error del servidor') + ').', 'error');
      return { ok: false, status: 'error-servidor' };
    }

    _bindForegroundOnMessage(messaging);

    try { localStorage.setItem(WH_PUSH_LS_REGISTRADO, '1'); localStorage.removeItem(WH_PUSH_LS_OPTOUT); } catch (_) {}
    return { ok: true, status: 'activado' };
  } catch (e) {
    return { ok: false, status: 'error', mensaje: e.message || 'error desconocido' };
  }
}

/* Token FCM actual de este dispositivo sin registrar nada (getToken() del SDK
   devuelve el token en caché si ya existe, no crea uno nuevo). */
async function _obtenerTokenActual() {
  if (!window.WH_FCM_VAPID_KEY || typeof firebase === 'undefined' || !firebase.messaging) return null;
  if (!window.firebaseApp && typeof initFirebase === 'function') initFirebase();
  const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const messaging = firebase.messaging();
  return await messaging.getToken({ vapidKey: window.WH_FCM_VAPID_KEY, serviceWorkerRegistration: swReg }) || null;
}

/* ¿Este dispositivo tiene un token activo registrado en el servidor? (el
   permiso del navegador puede estar en 'granted' sin que eso sea cierto —
   nunca se completó el registro, o se desactivó desde este mismo módulo). */
async function consultarEstadoPush() {
  try {
    const token = await _obtenerTokenActual();
    if (!token) return { activo: false, token: null };
    const res = await fetch('/api/push_tokens.php?fcm_token=' + encodeURIComponent(token), { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    return { activo: !!(res.ok && data.activo), token };
  } catch (e) {
    return { activo: false, token: null };
  }
}

/* Da de baja el token de este dispositivo — no hay forma de que un sitio
   revoque el permiso del navegador por JS, así que "desactivar" significa
   dejar de mandarle push a este dispositivo específico desde el servidor. */
async function deactivatePush(token) {
  try {
    const res = await fetch('/api/push_tokens.php', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': _leerCsrfCookie() },
      body: JSON.stringify({ fcm_token: token }),
    });
    const data = await res.json().catch(() => ({}));
    return !!(res.ok && data.success);
  } catch (e) {
    return false;
  }
}

/* ── Módulo de activación (página completa, no overlay) ────────────────
   Renderiza vistas dentro del contenedor #<containerId> de
   notificaciones-push.php. Cada vista termina llevando al usuario a
   `destino` (el panel que le corresponde) — activando, u "omitiendo" por
   ahora. Sin cooldown a propósito: si omite, el próximo login lo vuelve a
   traer aquí hasta que las active (a pedido del jefe). */

function _pgIr(destino) {
  window.location.href = destino;
}

function _pgRender(container, { icono, iconoVariante, titulo, cuerpo, acciones }) {
  container.innerHTML = `
    <div class="pg-icon${iconoVariante ? ' ' + iconoVariante : ''}"><i data-lucide="${icono}"></i></div>
    <h1 class="pg-titulo">${titulo}</h1>
    <p class="pg-cuerpo">${cuerpo}</p>
    <div class="pg-acciones">${acciones}</div>`;
  window.lucide?.createIcons();
}

/* Vista 1: pedir permiso explícito (permission === 'default') */
function _mostrarGateInicial(container, destino) {
  _pgRender(container, {
    icono: 'bell',
    titulo: '¿Recibir notificaciones del sitio?',
    cuerpo: 'Te avisamos al instante de pedidos, cotizaciones y citas nuevas, aunque no tengas el panel abierto. Puedes activarlas desde cualquier dispositivo — celular, tablet o computadora — y todos quedan registrados a la vez.',
    acciones: `
      <button type="button" class="pg-btn pg-btn-primary" id="pgBtnActivar">Activar notificaciones</button>
      <button type="button" class="pg-btn pg-btn-ghost" id="pgBtnOmitir">Ahora no</button>`,
  });

  document.getElementById('pgBtnActivar').addEventListener('click', async () => {
    const btn = document.getElementById('pgBtnActivar');
    btn.disabled = true;
    btn.innerHTML = '<i class="wh-icon-spin" data-lucide="loader-circle"></i> Activando…';
    window.lucide?.createIcons();
    const res = await registerPush();
    if (res.ok) {
      _mostrarGateExito(container, destino);
    } else if (res.status === 'denegado') {
      _mostrarGateInstrucciones(container, destino);
    } else if (res.status === 'ios-no-instalado') {
      _mostrarGateIOS(container, destino);
    } else {
      _avisoPush(res.mensaje ? ('No se pudieron activar las notificaciones (' + res.mensaje + ').') : 'No se pudieron activar las notificaciones.', 'error');
      setTimeout(() => _pgIr(destino), 1500);
    }
  });
  document.getElementById('pgBtnOmitir').addEventListener('click', () => _pgIr(destino));
}

/* Vista 2: el navegador ya tiene el permiso bloqueado — no se puede volver a
   pedir por JS, hay que explicar cómo activarlo a mano en los ajustes. */
function _mostrarGateInstrucciones(container, destino) {
  const pasos = _esFirefox()
    ? 'Toca el candado 🔒 junto a la dirección del sitio → Permisos → Notificaciones → Permitir, y recarga la página.'
    : _esSafari()
    ? 'Ve a Safari → Ajustes… → Páginas web → Notificaciones, busca este sitio y cámbialo a Permitir.'
    : 'Toca el candado 🔒 o el ícono "i" junto a la dirección del sitio → Notificaciones → Permitir, y recarga la página.';

  _pgRender(container, {
    icono: 'triangle-alert',
    iconoVariante: 'pg-icon-warn',
    titulo: 'Las notificaciones están bloqueadas',
    cuerpo: `Tu navegador ya no deja que el sitio vuelva a preguntar. ${pasos}`,
    acciones: `
      <button type="button" class="pg-btn pg-btn-primary" id="pgBtnReintentar">Ya las activé, reintentar</button>
      <button type="button" class="pg-btn pg-btn-ghost" id="pgBtnOmitir2">Continuar sin activar</button>`,
  });

  document.getElementById('pgBtnReintentar').addEventListener('click', async () => {
    const card = container.closest('.pg-card') || container;
    if (Notification.permission !== 'granted') {
      card.classList.add('pg-shake');
      setTimeout(() => card.classList.remove('pg-shake'), 400);
      return;
    }
    const res = await registerPush();
    if (res.ok) _mostrarGateExito(container, destino);
    else _pgIr(destino);
  });
  document.getElementById('pgBtnOmitir2').addEventListener('click', () => _pgIr(destino));
}

/* Vista 3: iOS/iPadOS en Safari normal (no instalado a pantalla de inicio) —
   único camino posible para push en iOS, ver nota en initPushGate(). */
function _mostrarGateIOS(container, destino) {
  _pgRender(container, {
    icono: 'smartphone',
    titulo: 'Instala el panel para recibir notificaciones',
    cuerpo: 'En iPhone/iPad, Apple solo permite avisos si el panel está instalado a la pantalla de inicio. Toca <i data-lucide="share"></i> Compartir → "Agregar a pantalla de inicio", y vuelve a abrir el panel desde ese ícono (no desde Safari).',
    acciones: `<button type="button" class="pg-btn pg-btn-primary" id="pgBtnEntendido">Continuar al panel</button>`,
  });
  document.getElementById('pgBtnEntendido').addEventListener('click', () => _pgIr(destino));
}

function _mostrarGateExito(container, destino) {
  _pgRender(container, {
    icono: 'circle-check',
    iconoVariante: 'pg-icon-ok',
    titulo: '¡Notificaciones activadas!',
    cuerpo: 'Ya vas a recibir avisos de este dispositivo. Entrando al panel…',
    acciones: '',
  });
  setTimeout(() => _pgIr(destino), 1800);
}

/* Vista de estado: el permiso del navegador ya está en 'granted'. Solo se
   llega aquí visitando el módulo a propósito (desde el menú de
   notificaciones del panel) — el login salta el módulo por completo cuando
   ya está en 'granted' (ver _destinoTrasLogin en modal-auth.js), así que no
   hace falta distinguir "vengo de login" de "lo abrí yo". */
function _mostrarGateEstado(container, destino, estado) {
  if (!estado.activo) {
    // Permiso concedido pero sin token activo en el servidor (nunca se
    // completó el registro, o se desactivó antes) — mismo flujo que activar
    // por primera vez, solo que aquí no se pedirá permiso al navegador
    // (ya lo tiene) así que va directo a registrar el token.
    _mostrarGateInicial(container, destino);
    return;
  }

  _pgRender(container, {
    icono: 'circle-check',
    iconoVariante: 'pg-icon-ok',
    titulo: 'Notificaciones activadas',
    cuerpo: 'Este dispositivo está registrado y recibe avisos de pedidos, cotizaciones y citas nuevas, aunque no tengas el panel abierto.',
    acciones: `
      <button type="button" class="pg-btn pg-btn-ghost" id="pgBtnDesactivar">Desactivar en este dispositivo</button>
      <button type="button" class="pg-btn pg-btn-primary" id="pgBtnContinuar">Continuar al panel</button>`,
  });

  document.getElementById('pgBtnDesactivar').addEventListener('click', async () => {
    const btn = document.getElementById('pgBtnDesactivar');
    btn.disabled = true;
    btn.textContent = 'Desactivando…';
    const ok = estado.token ? await deactivatePush(estado.token) : false;
    if (ok) { try { localStorage.setItem(WH_PUSH_LS_OPTOUT, '1'); } catch (_) {} }
    if (!ok) {
      _avisoPush('No se pudo desactivar. Intenta de nuevo.', 'error');
      btn.disabled = false;
      btn.textContent = 'Desactivar en este dispositivo';
      return;
    }
    _pgRender(container, {
      icono: 'bell-off',
      titulo: 'Notificaciones desactivadas',
      cuerpo: 'Este dispositivo ya no recibirá avisos push. Puedes volver a activarlas cuando quieras desde este mismo módulo.',
      acciones: `<button type="button" class="pg-btn pg-btn-primary" id="pgBtnContinuar2">Continuar al panel</button>`,
    });
    document.getElementById('pgBtnContinuar2').addEventListener('click', () => _pgIr(destino));
  });
  document.getElementById('pgBtnContinuar').addEventListener('click', () => _pgIr(destino));
}

/* ── Punto de entrada del módulo de activación ──────────────────────── */
async function initPushGate(containerId, destino) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // En iOS, `Notification` no existe en window fuera de una PWA instalada a
  // pantalla de inicio (ni siquiera en Safari normal) — Apple no entrega Web
  // Push a una pestaña normal bajo ninguna circunstancia, así que instalar
  // es la única vía posible ahí. El intento anterior de guiar a esto rompía
  // el login y congelaba la interfaz porque el manifest tenía `scope`
  // limitado a /admin o /empleado — cualquier navegación fuera de ese scope
  // (login en /inicio, este mismo módulo en /notificaciones-push.php) sacaba
  // a la app de su ventana standalone. Corregido en admin/manifest.json y
  // empleado/manifest.json (scope: "/"), así que este flujo ya es seguro.
  if (_esIOS() && !_esStandalone()) {
    _mostrarGateIOS(container, destino);
    return;
  }

  if (!('Notification' in window)) { _pgIr(destino); return; } // sin soporte real, no molestar

  if (Notification.permission === 'denied') {
    _mostrarGateInstrucciones(container, destino);
    return;
  }

  if (Notification.permission === 'granted') {
    const estado = await consultarEstadoPush();
    _mostrarGateEstado(container, destino, estado);
    return;
  }

  // permission === 'default': nunca se ha preguntado — mostrar el opt-in.
  _mostrarGateInicial(container, destino);
}

window.registerPush              = registerPush;
window.initPushGate              = initPushGate;
window.initPushForegroundListener = initPushForegroundListener;
