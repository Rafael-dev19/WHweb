// public/assets/js/login.js — Login de personal (Firebase Auth + PHP session)
const loginForm  = document.getElementById('loginForm');
const alertBox   = document.getElementById('alertBox');
const btnLogin   = document.getElementById('btnLogin');
const togglePass = document.getElementById('togglePass');
const forgotLink = document.getElementById('forgotLink');

// ── Mostrar alerta ─────────────────────────────────────────
function showAlert(msg, type = 'error') {
  if (!alertBox) return;
  alertBox.innerHTML  = msg;
  alertBox.className  = `alert alert-${type}`;
  alertBox.style.display = 'block';
}

// ── Toggle ver/ocultar contraseña ──────────────────────────
togglePass?.addEventListener('click', () => {
  const pwd = document.getElementById('password');
  const isVisible = pwd.type === 'text';
  pwd.type = isVisible ? 'password' : 'text';
  togglePass.innerHTML = isVisible
    ? '<i class="fa-solid fa-eye"></i>'
    : '<i class="fa-solid fa-eye-slash"></i>';
});

// ── Recuperar contraseña ───────────────────────────────────
forgotLink?.addEventListener('click', (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  if (!email) { showAlert('Ingresa tu correo primero', 'error'); return; }

  let auth = window.firebaseAuth;
  try { if (!auth && typeof firebaseAuth !== 'undefined') auth = firebaseAuth; } catch(e){}
  if (!auth) { showAlert('Firebase no disponible', 'error'); return; }

  auth.sendPasswordResetEmail(email)
    .then(() => showAlert('Correo de recuperación enviado. Revisa tu bandeja.', 'success'))
    .catch(err => showAlert('Error: ' + err.message, 'error'));
});

// ── Submit del formulario ──────────────────────────────────
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) { showAlert('Ingresa correo y contraseña', 'error'); return; }

  btnLogin.disabled    = true;
  btnLogin.textContent = 'Iniciando sesión...';
  alertBox.style.display = 'none';

  try {
    let auth = window.firebaseAuth;
    try { if (!auth && typeof firebaseAuth !== 'undefined') auth = firebaseAuth; } catch(e){}
    if (!auth) throw new Error('Firebase no inicializado');

    // ── FIX CRASH: signOut previo para limpiar cualquier sesión residual ──
    // Sin esto, Firebase compat a veces lanza error si ya hay un usuario cargado
    try { await auth.signOut(); } catch(e) {}

    const credential = await auth.signInWithEmailAndPassword(email, password);
    const idToken    = await credential.user.getIdToken(true);

    const res = await fetch('/api/auth.php?action=login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        firebase_token: idToken,
        _hp:     document.querySelector('[name="_hp"]')?.value     || '',
        website: document.querySelector('[name="website"]')?.value || '',
      }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('El servidor no respondió con JSON. Verifica la configuración de la API PHP.');
    }

    const data = await res.json();

    if (data.success) {
      sessionStorage.setItem('wh_firebase_token', idToken);
      sessionStorage.setItem('wh_usuario', JSON.stringify(data.usuario));
      sessionStorage.removeItem('wh_just_logged_out');
      showAlert('<i class="fa-solid fa-circle-check"></i> Bienvenido, redirigiendo...', 'success');
      setTimeout(() => { window.location.href = data.redirect; }, 800);
    } else {
      // Backend rechazó → también cerrar sesión Firebase para no quedar a medias
      try { await auth.signOut(); } catch(e) {}
      throw new Error(data.error || 'Usuario no autorizado');
    }

  } catch (err) {
    console.error('Login error:', err);
    let msg = 'Error al iniciar sesión';
    if      (err.code === 'auth/user-not-found')      msg = 'Correo no registrado';
    else if (err.code === 'auth/wrong-password')       msg = 'Contraseña incorrecta';
    else if (err.code === 'auth/invalid-credential')   msg = 'Credenciales incorrectas';
    else if (err.code === 'auth/too-many-requests')    msg = 'Demasiados intentos. Espera un momento.';
    else if (err.message)                              msg = err.message;
    showAlert('<i class="fa-solid fa-xmark"></i> ' + msg, 'error');

  } finally {
    btnLogin.disabled    = false;
    btnLogin.textContent = 'Iniciar Sesión';
  }
});

// ── Verificar si ya está logueado al cargar ────────────────
document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('email');
  if (emailInput) {
    emailInput.addEventListener('input', function () {
      this.value = this.value.replace(/[^a-zA-Z0-9._%+\-@]/g, '');
    });
  }
  // ── FIX CRASH: Si venimos de un logout explícito, NO auto-redirigir ──
  // El panel de empleado/admin pone 'wh_just_logged_out' en sessionStorage antes de redirigir
  const justLoggedOut = sessionStorage.getItem('wh_just_logged_out');
  if (justLoggedOut) {
    sessionStorage.removeItem('wh_just_logged_out');
    // Limpiar Firebase también para que no quede sesión cacheada
    let auth = window.firebaseAuth;
    try { if (!auth && typeof firebaseAuth !== 'undefined') auth = firebaseAuth; } catch(e){}
    if (auth) auth.signOut().catch(() => {});
    return; // No registrar onAuthStateChanged → el usuario ve el formulario limpio
  }

  let auth = window.firebaseAuth;
  try { if (!auth && typeof firebaseAuth !== 'undefined') auth = firebaseAuth; } catch(e){}
  if (!auth) return;

  auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res   = await fetch('/api/auth.php?action=verificar', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const data = await res.json();
      if (data.success && data.autenticado) {
        const rol = data.usuario?.rol || '';
        window.location.href = (rol === 'jefe' || rol === 'administrador')
          ? '/admin/panel_administrador.php'
          : '/empleado/panel_empleado.php';
      }
    } catch (e) { /* error de red → continuar mostrando login */ }
  });
});