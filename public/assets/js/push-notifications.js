// push-notifications.js — Registro de notificaciones push (Web Push / FCM)
// Se usa SOLO dentro de los paneles de personal (jefe/administrador/empleado/
// disenador). Los clientes nunca reciben push, solo correo — ver
// includes/notifications.php.
//
// Flujo: initPushPrompt() decide si mostrar una tarjeta pidiendo permiso
// explícito (nunca se pide el permiso del navegador sin que el usuario haya
// tocado "Activar" primero — pedirlo automáticamente al entrar es confuso y
// los navegadores lo penalizan). registerPush() hace el registro real.

const WH_PUSH_LS_REGISTRADO  = 'wh_push_registrado';
const WH_PUSH_LS_DESCARTADO  = 'wh_push_prompt_descartado_at';
const WH_PUSH_REPROMPT_DIAS  = 14; // si dice "Ahora no", se le vuelve a preguntar en N días

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

function _esSafari() {
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
}
function _esFirefox() {
  return /Firefox/.test(navigator.userAgent);
}

/* ── Registro real: pide permiso (dispara el diálogo nativo del navegador
   SOLO si el permiso está en "default") y registra el token en el servidor.
   Devuelve un status en vez de boolean para que el prompt sepa qué UI mostrar. */
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fcm_token: token }),
    });
    const dataToken = await resToken.json().catch(() => ({}));
    if (!resToken.ok || !dataToken.success) {
      _avisoPush('No se pudo registrar este dispositivo para notificaciones (' + (dataToken.error || 'error del servidor') + ').', 'error');
      return { ok: false, status: 'error-servidor' };
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

    try { localStorage.setItem(WH_PUSH_LS_REGISTRADO, '1'); } catch (_) {}
    return { ok: true, status: 'activado' };
  } catch (e) {
    return { ok: false, status: 'error', mensaje: e.message || 'error desconocido' };
  }
}

/* ── Tarjeta de opt-in explícita ─────────────────────────────────────── */

function _pushDescartadoRecientemente() {
  try {
    const t = parseInt(localStorage.getItem(WH_PUSH_LS_DESCARTADO) || '0', 10);
    if (!t) return false;
    const dias = (Date.now() - t) / 86400000;
    return dias < WH_PUSH_REPROMPT_DIAS;
  } catch (_) { return false; }
}

function _crearTarjetaPush() {
  if (document.getElementById('pushPromptCard')) return document.getElementById('pushPromptCard');
  const card = document.createElement('div');
  card.id = 'pushPromptCard';
  card.className = 'push-prompt-card';
  document.body.appendChild(card);
  return card;
}

function _cerrarTarjetaPush(card) {
  if (!card) return;
  card.classList.remove('visible');
  setTimeout(() => card.remove(), 250);
}

/* Vista 1: pedir permiso explícito (permission === 'default') */
function _mostrarPromptInicial() {
  const card = _crearTarjetaPush();
  card.innerHTML = `
    <div class="push-prompt-icon"><i class="fa-solid fa-bell"></i></div>
    <div class="push-prompt-body">
      <strong>¿Recibir notificaciones del sitio?</strong>
      <p>Te avisamos al instante de pedidos, cotizaciones y citas nuevas, aunque no tengas el panel abierto.</p>
    </div>
    <div class="push-prompt-actions">
      <button type="button" class="push-prompt-btn push-prompt-btn-primary" id="btnPushActivar">Activar notificaciones</button>
      <button type="button" class="push-prompt-btn push-prompt-btn-ghost" id="btnPushAhoraNo">Ahora no</button>
    </div>
    <button type="button" class="push-prompt-close" id="btnPushCerrar" aria-label="Cerrar">×</button>`;
  requestAnimationFrame(() => card.classList.add('visible'));

  document.getElementById('btnPushActivar').addEventListener('click', async () => {
    const btn = document.getElementById('btnPushActivar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Activando…';
    const res = await registerPush();
    if (res.ok) {
      _mostrarPromptExito(card);
    } else if (res.status === 'denegado') {
      _mostrarPromptInstrucciones(card);
    } else if (res.status === 'ios-no-instalado') {
      _mostrarPromptIOS(card);
    } else {
      _cerrarTarjetaPush(card);
      _avisoPush(res.mensaje ? ('No se pudieron activar las notificaciones (' + res.mensaje + ').') : 'No se pudieron activar las notificaciones.', 'error');
    }
  });
  document.getElementById('btnPushAhoraNo').addEventListener('click', () => _descartarPrompt(card));
  document.getElementById('btnPushCerrar').addEventListener('click', () => _descartarPrompt(card));
}

/* Vista 2: el navegador ya tiene el permiso bloqueado — no se puede volver a
   pedir por JS, hay que explicar cómo activarlo a mano en los ajustes. */
function _mostrarPromptInstrucciones(card) {
  const pasos = _esFirefox()
    ? 'Toca el candado 🔒 junto a la dirección del sitio → Permisos → Notificaciones → Permitir, y recarga la página.'
    : _esSafari()
    ? 'Ve a Safari → Ajustes… → Páginas web → Notificaciones, busca este sitio y cámbialo a Permitir.'
    : 'Toca el candado 🔒 o el ícono "i" junto a la dirección del sitio → Notificaciones → Permitir, y recarga la página.';

  card.innerHTML = `
    <div class="push-prompt-icon push-prompt-icon-warn"><i class="fa-solid fa-triangle-exclamation"></i></div>
    <div class="push-prompt-body">
      <strong>Las notificaciones están bloqueadas</strong>
      <p>Tu navegador ya no deja que el sitio vuelva a preguntar. ${pasos}</p>
    </div>
    <div class="push-prompt-actions">
      <button type="button" class="push-prompt-btn push-prompt-btn-primary" id="btnPushReintentar">Ya las activé, reintentar</button>
      <button type="button" class="push-prompt-btn push-prompt-btn-ghost" id="btnPushAhoraNo2">Ahora no</button>
    </div>
    <button type="button" class="push-prompt-close" id="btnPushCerrar2" aria-label="Cerrar">×</button>`;

  document.getElementById('btnPushReintentar').addEventListener('click', async () => {
    if (Notification.permission !== 'granted') {
      card.classList.add('push-prompt-shake');
      setTimeout(() => card.classList.remove('push-prompt-shake'), 400);
      return;
    }
    const res = await registerPush();
    if (res.ok) _mostrarPromptExito(card);
    else _cerrarTarjetaPush(card);
  });
  document.getElementById('btnPushAhoraNo2').addEventListener('click', () => _descartarPrompt(card));
  document.getElementById('btnPushCerrar2').addEventListener('click', () => _descartarPrompt(card));
}

/* Vista 3: iOS/iPadOS en Safari normal (no instalado a pantalla de inicio) */
function _mostrarPromptIOS(card) {
  card.innerHTML = `
    <div class="push-prompt-icon"><i class="fa-solid fa-mobile-screen-button"></i></div>
    <div class="push-prompt-body">
      <strong>Instala el panel para recibir notificaciones</strong>
      <p>En iPhone/iPad: toca <i class="fa-solid fa-arrow-up-from-bracket"></i> Compartir → "Agregar a pantalla de inicio", y vuelve a abrir el panel desde ese ícono (no desde Safari).</p>
    </div>
    <div class="push-prompt-actions">
      <button type="button" class="push-prompt-btn push-prompt-btn-primary" id="btnPushEntendido">Entendido</button>
    </div>
    <button type="button" class="push-prompt-close" id="btnPushCerrar3" aria-label="Cerrar">×</button>`;
  document.getElementById('btnPushEntendido').addEventListener('click', () => _descartarPrompt(card));
  document.getElementById('btnPushCerrar3').addEventListener('click', () => _descartarPrompt(card));
}

function _mostrarPromptExito(card) {
  card.innerHTML = `
    <div class="push-prompt-icon push-prompt-icon-ok"><i class="fa-solid fa-circle-check"></i></div>
    <div class="push-prompt-body">
      <strong>¡Notificaciones activadas!</strong>
      <p>Ya vas a recibir avisos de este dispositivo.</p>
    </div>`;
  setTimeout(() => _cerrarTarjetaPush(card), 2500);
}

function _descartarPrompt(card) {
  try { localStorage.setItem(WH_PUSH_LS_DESCARTADO, String(Date.now())); } catch (_) {}
  _cerrarTarjetaPush(card);
}

/* ── Punto de entrada: decide qué (si algo) mostrar al cargar el panel ── */
async function initPushPrompt() {
  if (!('Notification' in window)) return; // navegador sin soporte, no molestar

  // iOS en Safari normal: si ya descartó el aviso, no insistir cada visita.
  if (_esIOS() && !_esStandalone()) {
    if (!_pushDescartadoRecientemente()) _mostrarPromptIOS(_crearTarjetaPush());
    return;
  }

  if (Notification.permission === 'granted') {
    // Ya autorizado antes — solo (re)registrar el token en silencio, sin UI.
    registerPush();
    return;
  }

  if (Notification.permission === 'denied') {
    if (!_pushDescartadoRecientemente()) _mostrarPromptInstrucciones(_crearTarjetaPush());
    return;
  }

  // permission === 'default': nunca se ha preguntado — mostrar el opt-in.
  if (!_pushDescartadoRecientemente()) _mostrarPromptInicial();
}

window.registerPush   = registerPush;
window.initPushPrompt = initPushPrompt;
