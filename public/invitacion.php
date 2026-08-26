<?php
// Página pública: el empleado invitado crea aquí su propia contraseña.
// El token viene en ?token=xxx (enviado por el admin por correo).
require_once dirname(__DIR__) . '/includes/config.php';

$token = htmlspecialchars(trim($_GET['token'] ?? ''), ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Activar cuenta — Wooden House</title>
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap">
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js" defer></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
      background: #0e0c09;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #1e1b14;
      border: 1px solid #3a3020;
      border-radius: 20px;
      padding: 48px 40px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 12px 48px rgba(0,0,0,.6);
    }
    .logo { text-align: center; margin-bottom: 28px; }
    .logo img { height: 52px; }
    h1 { font-family: 'Fraunces', Georgia, serif; color: #e8dcc8; font-size: 24px; font-weight: 600; text-align: center; margin-bottom: 6px; }
    .sub { color: #7a7060; font-size: 13px; text-align: center; line-height: 1.6; margin-bottom: 28px; }
    .badge-rol {
      display: inline-block;
      background: #2a2010; border: 1px solid #5a4020;
      color: #c9a96e; font-size: 11px; font-weight: 700;
      padding: 3px 10px; border-radius: 20px; margin-top: 6px; text-transform: uppercase; letter-spacing: 1px;
    }
    .form-group { margin-bottom: 18px; }
    label { display: block; color: #a09080; font-size: 12px; font-weight: 600; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .5px; }
    input {
      width: 100%; padding: 12px 14px;
      background: #121008; border: 1px solid #3a3020; border-radius: 8px;
      color: #e8dcc8; font-size: 14px; outline: none;
      transition: border-color .2s;
    }
    input:focus { border-color: #c9a96e; }
    input[readonly] { color: #6a6050; cursor: not-allowed; }
    .help { color: #5a5040; font-size: 11px; margin-top: 4px; }
    .btn {
      width: 100%; padding: 14px;
      background: linear-gradient(135deg, #c9a96e, #a07830);
      border: none; border-radius: 8px;
      color: #1a1008; font-weight: 700; font-size: 15px;
      cursor: pointer; margin-top: 8px;
      transition: opacity .2s;
    }
    .btn:disabled { opacity: .6; cursor: not-allowed; }
    .alert {
      padding: 12px 14px; border-radius: 8px;
      font-size: 13px; margin-bottom: 18px; display: none;
    }
    .alert-error   { background: #2a0a0a; color: #e07070; border: 1px solid #5a1010; }
    .alert-success { background: #0a2a0a; color: #70c070; border: 1px solid #105010; }
    #loadingView { text-align: center; color: #7a7060; padding: 20px 0; }
    #tokenInvalidView { display: none; text-align: center; }
    #tokenInvalidView svg { width: 48px; height: 48px; stroke-width: 1.25; color: #884422; margin-bottom: 16px; }
    #tokenInvalidView p { color: #7a7060; font-size: 14px; line-height: 1.6; }
    #formView { display: none; }
    .btn { display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn svg { width: 16px; height: 16px; stroke-width: 1.75; }
    .spin-loader {
      display: inline-block; width: 28px; height: 28px;
      border: 3px solid rgba(201,169,110,.25); border-top-color: #c9a96e;
      border-radius: 50%; animation: spin-loader-rotate .7s linear infinite;
    }
    .spin-loader-sm { width: 15px; height: 15px; border-width: 2px; vertical-align: -3px; margin-right: 6px; }
    @keyframes spin-loader-rotate { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
<div class="card">
  <div class="logo">
    <img src="/assets/img/logo-login.png" alt="Wooden House" onerror="this.style.display='none'">
  </div>

  <!-- Estado: cargando -->
  <div id="loadingView">
    <span class="spin-loader"></span>
    <p style="color:#7a7060;margin-top:12px;">Verificando invitación...</p>
  </div>

  <!-- Estado: token inválido / expirado -->
  <div id="tokenInvalidView">
    <i data-lucide="triangle-alert"></i>
    <h1 style="margin-bottom:10px;">Invitación inválida</h1>
    <p id="tokenInvalidMsg">Esta invitación no es válida o ha expirado.<br>Pide al administrador que te envíe una nueva.</p>
  </div>

  <!-- Estado: formulario -->
  <div id="formView">
    <h1>Activa tu cuenta</h1>
    <p class="sub" id="welcomeMsg">Bienvenido/a — crea tu contraseña para acceder al panel.</p>

    <div id="alertBox" class="alert alert-error"></div>

    <div class="form-group">
      <label>Nombre</label>
      <input type="text" id="invNombre" readonly>
    </div>
    <div class="form-group">
      <label>Correo</label>
      <input type="email" id="invCorreo" readonly>
      <div class="help">Este será tu usuario para iniciar sesión.</div>
    </div>
    <div class="form-group">
      <label>Contraseña *</label>
      <input type="password" id="invPassword" placeholder="Mínimo 8 caracteres" autocomplete="new-password">
      <div class="help">Usa letras, números y símbolos para mayor seguridad.</div>
    </div>
    <div class="form-group">
      <label>Confirmar contraseña *</label>
      <input type="password" id="invPasswordConfirm" placeholder="Repite tu contraseña">
    </div>

    <button class="btn" id="btnActivar" onclick="activarCuenta()">
      <i data-lucide="key"></i> Crear cuenta y entrar
    </button>
    <p style="color:#5a5040;font-size:11px;text-align:center;margin-top:14px;">
      Al activar, aceptas las políticas de seguridad de Wooden House.
    </p>
  </div>
</div>

<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="/assets/<?= av('js/firebase-config.js') ?>"></script>
<script>
const INV_TOKEN = <?= json_encode($token) ?>;

function _showAlert(msg, type = 'error') {
  const el = document.getElementById('alertBox');
  el.textContent = msg;
  el.className = 'alert alert-' + type;
  el.style.display = '';
}
function _hideAlert() { document.getElementById('alertBox').style.display = 'none'; }

async function _getCsrf() {
  const c = document.cookie.split(';').find(c => c.trim().startsWith('XSRF-TOKEN='));
  return c ? decodeURIComponent(c.split('=')[1]) : '';
}

// Validar token al cargar
async function validarToken() {
  if (!INV_TOKEN) {
    document.getElementById('loadingView').style.display  = 'none';
    document.getElementById('tokenInvalidView').style.display = 'block';
    return;
  }
  try {
    const res  = await fetch(`/api/invitaciones.php?action=validar&token=${encodeURIComponent(INV_TOKEN)}`);
    const data = await res.json();
    if (!data.success) {
      document.getElementById('tokenInvalidMsg').textContent = data.error || 'Invitación inválida.';
      document.getElementById('loadingView').style.display  = 'none';
      document.getElementById('tokenInvalidView').style.display = 'block';
      return;
    }
    document.getElementById('invNombre').value  = data.nombre_completo;
    document.getElementById('invCorreo').value  = data.correo;
    document.getElementById('welcomeMsg').innerHTML =
      `Hola <strong>${data.nombre_completo}</strong> — crea tu contraseña para acceder como <span class="badge-rol">${data.rol}</span>`;
    document.getElementById('loadingView').style.display = 'none';
    document.getElementById('formView').style.display    = 'block';
  } catch (e) {
    document.getElementById('tokenInvalidMsg').textContent = 'Error de red. Intenta recargar la página.';
    document.getElementById('loadingView').style.display  = 'none';
    document.getElementById('tokenInvalidView').style.display = 'block';
  }
}

async function activarCuenta() {
  _hideAlert();
  const correo  = document.getElementById('invCorreo').value.trim();
  const pass    = document.getElementById('invPassword').value;
  const pass2   = document.getElementById('invPasswordConfirm').value;
  const btn     = document.getElementById('btnActivar');

  if (pass.length < 8) { _showAlert('La contraseña debe tener al menos 8 caracteres.'); return; }
  if (pass !== pass2)  { _showAlert('Las contraseñas no coinciden.'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spin-loader spin-loader-sm"></span> Creando cuenta...';

  try {
    const auth = firebase.auth();

    // Crear la cuenta Firebase con la contraseña que el empleado eligió
    const cred    = await auth.createUserWithEmailAndPassword(correo, pass);
    const idToken = await cred.user.getIdToken();

    // Activar en el backend usando el token de invitación
    const csrf = await _getCsrf();
    const res  = await fetch('/api/invitaciones.php?action=activar', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      credentials: 'same-origin',
      body:    JSON.stringify({ token: INV_TOKEN, firebase_token: idToken }),
    });
    const data = await res.json();

    if (!data.success) {
      // Si el backend falla, eliminar la cuenta de Firebase para no dejar inconsistencia
      try { await cred.user.delete(); } catch(_) {}
      throw new Error(data.error || 'Error al activar la cuenta.');
    }

    btn.innerHTML = '<i data-lucide="circle-check"></i> ¡Cuenta creada! Redirigiendo...';
    if (window.lucide) window.lucide.createIcons();
    // El administrador nunca recibe push (ver includes/notifications.php); los
    // otros tres roles pasan primero por el módulo de activación.
    const destino = data.rol === 'administrador' ? data.redirect : '/notificaciones-push.php';
    setTimeout(() => { window.location.href = destino; }, 1200);

  } catch (e) {
    let msg = e.message || 'Error desconocido.';
    if (msg.includes('email-already-in-use'))
      msg = 'Ese correo ya tiene una cuenta en Firebase. Contacta al administrador.';
    if (msg.includes('weak-password'))
      msg = 'Contraseña muy débil. Usa al menos 8 caracteres con letras y números.';
    _showAlert(msg);
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="key"></i> Crear cuenta y entrar';
    if (window.lucide) window.lucide.createIcons();
  }
}

// Confirmar con Enter en el campo de contraseña
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) window.lucide.createIcons();
  validarToken();
  document.getElementById('invPasswordConfirm')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') activarCuenta();
  });
});
</script>
</body>
</html>
