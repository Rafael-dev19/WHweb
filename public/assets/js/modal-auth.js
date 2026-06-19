// modal-auth.js — Modal de autenticación de clientes (expone window.AuthModal)

(function () {
  'use strict';

  /* ── Estado ──────────────────────────────────────────────────── */
  let _cliente         = null;
  let _emailVerificado = null;  // null=desconocido, true=verificado, false=no verificado
  let _callback        = null;
  let _firebaseApp     = null;
  let _firebaseAuth    = null;
  let _verifPollTimer  = null;

  /* ── Crear estructura HTML del modal ─────────────────────────── */
  function _crearModal() {
    if (document.getElementById('authModalOverlay')) return;

    const html = `
<div id="authModalOverlay" class="auth-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
  <div class="auth-modal">
    <button class="auth-modal-close" id="btnAuthClose" aria-label="Cerrar">
      <i class="fa-solid fa-xmark"></i>
    </button>

    <div class="auth-modal-logo">
      <img src="/assets/img/logo-login.png" alt="Wooden House">
    </div>

    <div id="authViewLogin">
      <h2 class="auth-modal-title" id="authModalTitle">Iniciar sesión</h2>
      <p class="auth-modal-subtitle" id="authModalSubtitle">Accede a tu cuenta para continuar</p>

      <div id="authAlert" class="auth-alert"></div>

      <div id="authFormLogin">
        <form class="auth-form" id="formAuthLogin">
          <div class="auth-form-group">
            <label>Correo electrónico</label>
            <input type="email" id="loginEmail" placeholder="correo@ejemplo.com" autocomplete="email" required>
          </div>
          <div class="auth-form-group">
            <label>Contraseña</label>
            <input type="password" id="loginPassword" placeholder="Tu contraseña" autocomplete="current-password" required>
          </div>
          <button type="submit" class="btn-auth-primary" id="btnLoginSubmit">Iniciar sesión</button>
          <div class="auth-forgot-wrap">
            <a href="#" class="auth-forgot-link" id="linkAuthForgot">¿Olvidaste tu contraseña?</a>
          </div>
        </form>
        <div class="auth-switch-link">
          ¿No tienes cuenta? <a href="#" id="linkGoRegistro">Regístrate aquí</a>
        </div>
      </div>

      <div id="authFormRegistro" style="display:none;">
        <form class="auth-form" id="formAuthRegistro">
          <div class="auth-form-group">
            <label>Nombre completo</label>
            <input type="text" id="regNombre" placeholder="Juan Pérez" autocomplete="name" required minlength="2" maxlength="120">
          </div>
          <div class="auth-form-group">
            <label>Correo electrónico</label>
            <input type="email" id="regEmail" placeholder="correo@ejemplo.com" autocomplete="email" required>
          </div>
          <div class="auth-form-group">
            <label>Contraseña <span style="font-weight:400;font-size:11px;">(mín. 6 caracteres)</span></label>
            <input type="password" id="regPassword" placeholder="Crea una contraseña" autocomplete="new-password" required minlength="6">
          </div>
          <div class="auth-form-group">
            <label>Confirmar contraseña</label>
            <input type="password" id="regConfirmPassword" placeholder="Repite tu contraseña" autocomplete="new-password" required minlength="6">
          </div>
          <button type="submit" class="btn-auth-primary" id="btnRegSubmit">Crear cuenta</button>
        </form>
        <div class="auth-switch-link">
          ¿Ya tienes cuenta? <a href="#" id="linkGoLogin">Inicia sesión aquí</a>
        </div>
      </div>

      <div class="auth-social-divider"><span>o continúa con</span></div>
      <button type="button" class="btn-auth-google" id="btnAuthGoogle">
        <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-3.59-13.46-8.83l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        Continuar con Google
      </button>

      <div class="auth-modal-footer">
        <a href="/terminos" target="_blank" rel="noopener">Condiciones del Servicio</a>
        &nbsp;&middot;&nbsp;
        <a href="/privacidad" target="_blank" rel="noopener">Privacidad</a>
        <span class="auth-recaptcha-notice">
          Protegido por reCAPTCHA &mdash;
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacidad</a>
          y <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Términos</a> de Google
        </span>
      </div>
    </div>

    <div id="authViewVerificacion" style="display:none;">
      <div style="text-align:center; padding: 8px 0 20px;">
        <div style="font-size:52px; margin-bottom:18px;">📧</div>
        <h3 style="color:#c9a96e; font-size:20px; margin-bottom:10px;">¡Cuenta creada!</h3>
        <p style="color:#ccc; font-size:14px; line-height:1.6;">
          Te enviamos un enlace de verificación a<br>
          <strong id="authVerifEmailLabel" style="color:#e0e0e0;">—</strong>
        </p>
        <p style="color:#888; font-size:12px; margin-top:10px; line-height:1.5;">
          Haz clic en el enlace del correo para confirmar tu cuenta.<br>
          Si no ves el correo, revisa tu carpeta de <strong style="color:#aaa;">spam o promociones</strong>.
        </p>
        <div id="authVerifAlert" style="margin-top:12px; font-size:13px; min-height:20px;"></div>
        <button class="btn-auth-primary" style="margin-top:16px;" id="btnAuthContinuar">
          Continuar a mi cuenta
        </button>
        <div style="margin-top:14px;">
          <a href="#" id="btnReenviarVerif" style="font-size:12px; color:#9a8e80; text-decoration:none;">
            ¿No llegó? Reenviar correo
          </a>
        </div>
      </div>
    </div>

    <div id="authViewUser" style="display:none;">
      <div class="auth-user-view">
        <div class="auth-user-avatar" id="authUserAvatar">U</div>
        <div class="auth-user-name" id="authUserName">—</div>
        <div class="auth-user-email" id="authUserEmail">—</div>
        <div class="auth-user-actions">
          <button class="btn-auth-mi-cuenta" id="btnAuthMiCuenta">
            <i class="fa-solid fa-user-circle"></i> Mi cuenta
          </button>
          <button class="btn-auth-logout" id="btnAuthLogout">
            <i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  </div>
</div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    // El modal no se cierra al hacer clic en el fondo — solo con × o programáticamente
    _initCamposModal();
  }

  /* ── Sanitización en tiempo real del modal ───────────────────── */
  function _initCamposModal() {
    // ── Event listeners del modal ─────────────────────────────────
    const btnClose = document.getElementById('btnAuthClose');
    if (btnClose) btnClose.addEventListener('click', () => AuthModal.close());

    const formLogin = document.getElementById('formAuthLogin');
    if (formLogin) formLogin.addEventListener('submit', (e) => window._authLoginEmail(e));

    const linkForgot = document.getElementById('linkAuthForgot');
    if (linkForgot) linkForgot.addEventListener('click', (e) => window._authResetPassword(e));

    const linkGoReg = document.getElementById('linkGoRegistro');
    if (linkGoReg) linkGoReg.addEventListener('click', (e) => { e.preventDefault(); window._authSetTab('registro'); });

    const formReg = document.getElementById('formAuthRegistro');
    if (formReg) formReg.addEventListener('submit', (e) => window._authRegistroEmail(e));

    const linkGoLogin = document.getElementById('linkGoLogin');
    if (linkGoLogin) linkGoLogin.addEventListener('click', (e) => { e.preventDefault(); window._authSetTab('login'); });

    const btnContinuar = document.getElementById('btnAuthContinuar');
    if (btnContinuar) btnContinuar.addEventListener('click', () => window._authContinuarDespuesDeRegistro());

    const btnReenviar = document.getElementById('btnReenviarVerif');
    if (btnReenviar) btnReenviar.addEventListener('click', (e) => window._authReenviarVerificacion(e));

    const btnMiCuenta = document.getElementById('btnAuthMiCuenta');
    if (btnMiCuenta) btnMiCuenta.addEventListener('click', () => { location.href = '/mi-cuenta'; });

    const btnLogout = document.getElementById('btnAuthLogout');
    if (btnLogout) btnLogout.addEventListener('click', () => window._authLogout());

    const btnGoogle = document.getElementById('btnAuthGoogle');
    if (btnGoogle) btnGoogle.addEventListener('click', () => window._authLoginGoogle());

    // ── Sanitización de inputs ────────────────────────────────────
    const loginEmail = document.getElementById('loginEmail');
    if (loginEmail) loginEmail.addEventListener('input', function () {
      this.value = this.value.replace(/[^a-zA-Z0-9._%+\-@]/g, '');
    });

    const regNombre = document.getElementById('regNombre');
    if (regNombre) regNombre.addEventListener('input', function () {
      this.value = this.value.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/g, '');
    });

    const regEmail = document.getElementById('regEmail');
    if (regEmail) regEmail.addEventListener('input', function () {
      this.value = this.value.replace(/[^a-zA-Z0-9._%+\-@]/g, '');
    });

    const regConfirmPassword = document.getElementById('regConfirmPassword');
    if (regConfirmPassword) {
      regConfirmPassword.addEventListener('paste', (e) => e.preventDefault());
      regConfirmPassword.addEventListener('blur', function () {
        const orig = document.getElementById('regPassword')?.value || '';
        if (this.value && this.value !== orig) _authShowAlert('Las contraseñas no coinciden', 'error');
        else _authClearAlert();
      });
    }
  }

  /* ── Helpers de UI ───────────────────────────────────────────── */
  function _authShowAlert(msg, tipo) {
    const el = document.getElementById('authAlert');
    if (!el) return;
    el.textContent = msg;
    el.className = 'auth-alert ' + (tipo || 'error');
  }

  function _authClearAlert() {
    const el = document.getElementById('authAlert');
    if (el) { el.textContent = ''; el.className = 'auth-alert'; }
  }

  function _authSetLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (loading) {
      btn._origText = btn.innerHTML;
      btn.innerHTML = '<span class="auth-spinner"></span>Espera...';
      btn.disabled = true;
    } else {
      btn.innerHTML = btn._origText || btn.innerHTML;
      btn.disabled = false;
    }
  }

  /* ── Cambiar entre vista login y registro ────────────────────── */
  window._authSetTab = function (tab) {
    _authClearAlert();
    const isLogin = tab === 'login';
    document.getElementById('authFormLogin').style.display    = isLogin ? '' : 'none';
    document.getElementById('authFormRegistro').style.display = isLogin ? 'none' : '';
    const title    = document.getElementById('authModalTitle');
    const subtitle = document.getElementById('authModalSubtitle');
    if (title)    title.textContent    = isLogin ? 'Iniciar sesión' : 'Crear cuenta';
    if (subtitle) subtitle.textContent = isLogin ? 'Accede a tu cuenta para continuar' : 'Crea tu cuenta gratuita';
  };

  /* ── Obtener instancia de Firebase Auth ──────────────────────── */
  async function _getAuth() {
    if (_firebaseAuth) return _firebaseAuth;
    const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');

    const cfg = window.FIREBASE_CONFIG || window._fbConfig || window.firebaseConfig;
    if (!cfg) throw new Error('firebaseConfig no definida en window');

    _firebaseApp = getApps().length ? getApp() : initializeApp(cfg);
    _firebaseAuth = getAuth(_firebaseApp);
    return _firebaseAuth;
  }

  /* ── Llamar al backend ───────────────────────────────────────── */
  async function _llamarBackend(action, firebaseToken, extra = {}) {
    const csrfCookie = document.cookie.split(';')
      .map(c => c.trim()).find(c => c.startsWith('XSRF-TOKEN='));
    const csrf = csrfCookie ? decodeURIComponent(csrfCookie.split('=')[1]) : '';

    const res = await fetch(`/api/auth.php?action=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      },
      credentials: 'same-origin',
      body: JSON.stringify({ firebase_token: firebaseToken, ...extra }),
    });
    return res.json();
  }

  /* ── Extraer dos iniciales del nombre completo ───────────────── */
  const _PARTICULAS = new Set(['de','del','la','las','los','el','los','y','e','von','van','da','das','dos','di','le','les']);
  function _getIniciales(nombre) {
    const partes = (nombre || '').trim().split(/\s+/).filter(p => p && !_PARTICULAS.has(p.toLowerCase()));
    if (partes.length === 0) return 'U';
    if (partes.length === 1) return partes[0][0].toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }

  /* ── Detectar si el error es de red / carga de módulos ────────── */
  function _esFalloDeConexion(e) {
    const msg = (e && e.message) ? e.message.toLowerCase() : '';
    return msg.includes('failed to fetch') || msg.includes('dynamically imported') || msg.includes('load failed') || msg.includes('networkerror');
  }

  /* ── Abrir modal directamente cuando el usuario NO está autenticado ── */
  function _toggleGuestMenu() {
    AuthModal.open();
  }

  /* ── Mini menú de cuenta (para páginas sin dropdown en nav) ─────── */
  function _toggleAuthMiniMenu(btn) {
    const existing = document.querySelector('.auth-mini-menu');
    if (existing) {
      existing.remove();
      btn.classList.remove('menu-open');
      return;
    }

    btn.classList.add('menu-open');
    const menu = document.createElement('div');
    menu.className = 'auth-mini-menu';
    menu.innerHTML = `
      <div class="auth-mini-header">
        <strong>${_esc(_cliente.nombre || '—')}</strong>
        <span>${_esc(_cliente.correo || '')}</span>
      </div>
      <a href="/mi-cuenta" class="auth-mini-item">
        <i class="fa-solid fa-user-circle"></i> Mi cuenta
      </a>
      <div class="auth-mini-divider"></div>
      <button class="auth-mini-item auth-mini-logout">
        <i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión
      </button>`;
    btn.appendChild(menu);
    const miniLogout = menu.querySelector('.auth-mini-logout');
    if (miniLogout) miniLogout.addEventListener('click', () => window._authLogout());

    function _closeMiniMenu(e) {
      if (!btn.contains(e.target)) {
        menu.remove();
        btn.classList.remove('menu-open');
        document.removeEventListener('click', _closeMiniMenu);
      }
    }
    setTimeout(() => document.addEventListener('click', _closeMiniMenu), 0);

    function _escKey(e) {
      if (e.key === 'Escape') { menu.remove(); btn.classList.remove('menu-open'); document.removeEventListener('keydown', _escKey); }
    }
    document.addEventListener('keydown', _escKey);
  }

  function _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Badge del carrito en barra móvil ───────────────────────── */
  function _actualizarMbnCartBadge() {
    try {
      const carrito = JSON.parse(sessionStorage.getItem('wh_carrito') || '[]');
      const total   = carrito.reduce((s, i) => s + (Number(i.cantidad) || 1), 0);
      document.querySelectorAll('.mbn-cart-badge').forEach(badge => {
        badge.textContent = total > 99 ? '99+' : String(total);
        badge.style.display = total > 0 ? 'flex' : 'none';
      });
    } catch { /* silent */ }
  }

  /* ── Actualizar botón de cuenta en el nav ────────────────────── */
  function _actualizarNavBtn() {
    const btns = document.querySelectorAll('.btn-cuenta-nav');
    btns.forEach(btn => {
      if (_cliente) {
        const iniciales = _getIniciales(_cliente.nombre);
        const primerNombre = (_cliente.nombre || '').trim().split(/\s+/)[0];
        btn.classList.add('autenticado');
        btn.innerHTML = `
          <span class="nav-auth-avatar-sm">${iniciales}</span>
          <span class="nav-auth-label-sm">${_esc(primerNombre)}</span>
          <i class="fa-solid fa-chevron-down nav-auth-chevron-sm"></i>`;
        btn.title = _cliente.nombre;
        btn.onclick = (e) => { e.stopPropagation(); _toggleAuthMiniMenu(btn); };
      } else {
        btn.classList.remove('autenticado');
        btn.innerHTML = `<i class="fa-solid fa-user"></i> Iniciar sesión`;
        btn.title = 'Iniciar sesión o crear cuenta';
        btn.onclick = (e) => { e.stopPropagation(); AuthModal.open(); };
      }
    });

    const mbnBtn = document.querySelector('.mobile-bottom-nav .mbn-item:last-child');
    if (mbnBtn) {
      if (_cliente) {
        const iniciales = _getIniciales(_cliente.nombre);
        mbnBtn.innerHTML = `<i class="fa-solid fa-user-check"></i><span>${iniciales}</span>`;
        mbnBtn.style.color = '#c9a96e';
        mbnBtn.onclick = () => { window.location.href = '/mi-cuenta'; };
      } else {
        mbnBtn.innerHTML = `<i class="fa-solid fa-user"></i><span>Iniciar sesión</span>`;
        mbnBtn.style.color = '';
        mbnBtn.onclick = () => { AuthModal.open(); };
      }
    }

    _actualizarMbnCartBadge();
  }

  /* ── Actualizar vista del modal ──────────────────────────────── */
  function _actualizarVistaModal() {
    const viewLogin  = document.getElementById('authViewLogin');
    const viewUser   = document.getElementById('authViewUser');
    const viewVerif  = document.getElementById('authViewVerificacion');
    if (!viewLogin || !viewUser) return;

    if (viewVerif) viewVerif.style.display = 'none';
    if (_cliente) {
      viewLogin.style.display = 'none';
      viewUser.style.display  = '';
      const inicial = _getIniciales(_cliente.nombre);
      document.getElementById('authUserAvatar').textContent = inicial;
      document.getElementById('authUserName').textContent   = _cliente.nombre || '—';
      document.getElementById('authUserEmail').textContent  = _cliente.correo || '—';
    } else {
      viewLogin.style.display = '';
      viewUser.style.display  = 'none';
    }
  }

  /* ── Polling automático de verificación de correo ───────────── */
  // Firebase no tiene webhooks: consultamos cada 4s si el usuario ya verificó
  function _iniciarPollingVerificacion() {
    if (_verifPollTimer) return;
    _verifPollTimer = setInterval(async () => {
      try {
        const auth = await _getAuth();
        const user = auth.currentUser;
        if (!user) { _detenerPollingVerificacion(); return; }
        await user.reload();
        if (user.emailVerified) {
          _detenerPollingVerificacion();
          try {
            const token = await user.getIdToken(true);
            await fetch('/api/auth.php?action=cliente-email-verificado', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ firebase_token: token }),
            });
          } catch (_) {}
          _emailVerificado = true;
          document.getElementById('whVerifBanner')?.remove();
          const toast = document.createElement('div');
          toast.className = 'wh-toast-verificado';
          toast.innerHTML = '<i class="fa-solid fa-circle-check"></i> ¡Correo verificado! Ya puedes completar tus compras.';
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 5000);
          document.dispatchEvent(new CustomEvent('wh:email-verificado', { detail: _cliente }));
        }
      } catch (_) { /* ignorar errores de red */ }
    }, 4000);
  }

  function _detenerPollingVerificacion() {
    if (_verifPollTimer) { clearInterval(_verifPollTimer); _verifPollTimer = null; }
  }

  /* ── Banner de correo no verificado ─────────────────────────── */
  function _mostrarBannerVerificacion() {
    if (document.getElementById('whVerifBanner')) return;
    const correo = _cliente?.correo || '';
    const banner = document.createElement('div');
    banner.id        = 'whVerifBanner';
    banner.className = 'wh-verif-banner';
    banner.innerHTML = `
      <span class="wh-verif-icon"><i class="fa-solid fa-triangle-exclamation"></i></span>
      <span class="wh-verif-text">
        <strong>Confirma tu correo electrónico</strong> — Enviamos un enlace a <strong>${correo}</strong>.
        Sin confirmar no podrás completar compras.
      </span>
      <div class="wh-verif-actions">
        <button type="button" class="wh-verif-btn" id="btnBannerReenviar">
          <i class="fa-solid fa-paper-plane"></i> Reenviar
        </button>
        <button type="button" class="wh-verif-btn wh-verif-btn-ok" id="btnBannerYaVerifique">
          Ya verifiqué
        </button>
      </div>`;
    const nav = document.querySelector('.header-nav');
    if (nav) nav.insertAdjacentElement('afterend', banner);
    else document.body.insertAdjacentElement('afterbegin', banner);
    const btnBannerReenv = document.getElementById('btnBannerReenviar');
    if (btnBannerReenv) btnBannerReenv.addEventListener('click', (e) => window._authReenviarBanner(e));
    const btnBannerYaVerif = document.getElementById('btnBannerYaVerifique');
    if (btnBannerYaVerif) btnBannerYaVerif.addEventListener('click', () => window._authYaVerifique());
    _iniciarPollingVerificacion();
  }

  window._authReenviarBanner = async function(e) {
    const btn = document.getElementById('btnBannerReenviar');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando…'; }
    try {
      const auth = await _getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('sin sesión');
      const { sendEmailVerification } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      await sendEmailVerification(user);
      if (btn) { btn.innerHTML = '<i class="fa-solid fa-check"></i> Enviado'; btn.style.background = '#3d7848'; }
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = err.code === 'auth/too-many-requests'
          ? 'Espera un momento'
          : '<i class="fa-solid fa-paper-plane"></i> Reenviar';
      }
    }
  };

  window._authYaVerifique = async function() {
    try {
      const auth = await _getAuth();
      const user = auth.currentUser;
      if (user) {
        await user.reload();
        if (user.emailVerified) {
          try {
            const token = await user.getIdToken(true);
            await fetch('/api/auth.php?action=cliente-email-verificado', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ firebase_token: token }),
            });
          } catch (_) {}
          _detenerPollingVerificacion();
          _emailVerificado = true;
          document.getElementById('whVerifBanner')?.remove();
          return;
        }
      }
    } catch (_) {}
    const banner = document.getElementById('whVerifBanner');
    if (banner) {
      banner.style.animation = 'none';
      banner.offsetHeight; // reflow
      banner.style.animation = 'wh-shake 0.4s ease';
      const txt = banner.querySelector('.wh-verif-text');
      if (txt) { txt.style.color = '#ffd080'; setTimeout(() => { txt.style.color = ''; }, 1500); }
    }
  };

  /* ── Tras autenticación exitosa ──────────────────────────────── */
  function _onAutenticado(cliente, emailVerificado) {
    _cliente         = cliente;
    _emailVerificado = emailVerificado ?? false;
    _actualizarNavBtn();
    _actualizarVistaModal();
    if (_emailVerificado === false) {
      _mostrarBannerVerificacion();
    } else {
      document.getElementById('whVerifBanner')?.remove();
    }
    document.dispatchEvent(new CustomEvent('wh:autenticado', { detail: cliente }));

    if (typeof _callback === 'function') {
      const cb = _callback;
      _callback = null;
      AuthModal.close();
      cb(cliente);
    } else {
      _actualizarVistaModal();
    }
  }

  /* ── Contador de intentos y bloqueo temporal ────────────────── */
  let _loginIntentos = 0;
  let _loginTimer    = null;

  function _iniciarCuentaRegresiva(segundos = 30) {
    if (_loginTimer) { clearInterval(_loginTimer); _loginTimer = null; }
    const btn = document.getElementById('btnLoginSubmit');
    if (btn) btn.disabled = true;
    let restantes = segundos;
    const _actualizar = () => {
      const el = document.getElementById('authAlert');
      if (!el) return;
      el.innerHTML = `Demasiados intentos fallidos. Espera <strong>${restantes}s</strong> antes de reintentar.`;
      el.className = 'auth-alert error';
    };
    _actualizar();
    _loginTimer = setInterval(() => {
      restantes--;
      if (restantes <= 0) {
        clearInterval(_loginTimer);
        _loginTimer = null;
        _loginIntentos = 0;
        if (btn) btn.disabled = false;
        _authShowAlert('Puedes intentar de nuevo. Si el problema persiste, espera unos minutos.', 'error');
      } else {
        _actualizar();
      }
    }, 1000);
  }

  /* ── Login con email ─────────────────────────────────────────── */
  function _marcarCampoError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.borderColor = '#c0392b';
    el.style.boxShadow   = '0 0 0 2px rgba(192,57,43,0.35)';
    el.addEventListener('input', function _limpia() {
      this.style.borderColor = ''; this.style.boxShadow = '';
      this.removeEventListener('input', _limpia);
    });
  }

  window._authLoginEmail = async function (e) {
    e.preventDefault();
    _authClearAlert();
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) {
      if (!email)    _marcarCampoError('loginEmail',    'Requerido');
      if (!password) _marcarCampoError('loginPassword', 'Requerido');
      _authShowAlert('Por favor completa todos los campos', 'error');
      return;
    }

    _authSetLoading('btnLoginSubmit', true);
    try {
      const auth = await _getAuth();
      const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      const cred  = await signInWithEmailAndPassword(auth, email, password);
      const token = await cred.user.getIdToken();
      const data  = await _llamarBackend('cliente-login', token);
      if (!data.success) throw new Error(data.error || 'Error al iniciar sesión');
      if (data.redirect) {
        if (data['2fa_required']) {
          // Tiene 2FA activo: pedir código TOTP antes de entrar al panel
          _mostrar2faCheck(data.redirect, cred.user);
          return;
        }
        if (data['2fa_setup']) {
          // No tiene 2FA: redirigir al panel con flag para forzar la configuración
          window.location.href = data.redirect + '?setup_2fa=1';
          return;
        }
        window.location.href = data.redirect;
        return;
      }
      _onAutenticado(data.cliente, cred.user.emailVerified);
    } catch (e) {
      if (_loginTimer) {
        // timer activo — no interrumpir la cuenta regresiva
      } else if (_esFalloDeConexion(e)) {
        _authShowAlert('Sin conexión. Verifica tu internet e intenta de nuevo.', 'error');
      } else if (e.code === 'auth/too-many-requests') {
        _iniciarCuentaRegresiva(30);
      } else {
        _loginIntentos++;
        const restantes = Math.max(0, 5 - _loginIntentos);
        const map = {
          'auth/user-not-found':     'No existe cuenta con ese correo.',
          'auth/wrong-password':     'Contraseña incorrecta.',
          'auth/invalid-email':      'Correo inválido.',
          'auth/invalid-credential': 'Correo o contraseña incorrectos.',
        };
        const base = map[e.code] || (e.message?.startsWith('Error') ? e.message : 'Correo o contraseña incorrectos.');
        const aviso = restantes > 0
          ? ` ${restantes} intento${restantes !== 1 ? 's' : ''} restante${restantes !== 1 ? 's' : ''} antes del bloqueo.`
          : '';
        _authShowAlert(base + aviso, 'error');
      }
    } finally {
      _authSetLoading('btnLoginSubmit', false);
    }
  };

  /* ── Continuar después del registro (botón en vista verificación) ── */
  let _pendingCliente = null;
  window._authContinuarDespuesDeRegistro = async function () {
    if (_pendingCliente) {
      let verified = false;
      try {
        const auth = await _getAuth();
        const user = auth.currentUser;
        if (user) { await user.reload(); verified = user.emailVerified; }
      } catch (_) {}
      _onAutenticado(_pendingCliente, verified);
      _pendingCliente = null;
    } else {
      AuthModal.close();
    }
  };

  /* ── Reenviar correo de verificación ─────────────────────────── */
  window._authReenviarVerificacion = async function (e) {
    e.preventDefault();
    const alertEl = document.getElementById('authVerifAlert');
    const linkEl  = document.getElementById('btnReenviarVerif');
    if (linkEl) { linkEl.style.pointerEvents = 'none'; linkEl.style.opacity = '0.5'; }
    try {
      const auth = await _getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Sin sesión de Firebase');
      const { sendEmailVerification } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      await sendEmailVerification(user);
      if (alertEl) { alertEl.style.color = '#70c080'; alertEl.textContent = 'Correo reenviado. Revisa tu bandeja y spam.'; }
    } catch (err) {
      const msg = err.code === 'auth/too-many-requests'
        ? 'Espera unos minutos antes de reenviar.'
        : 'No se pudo reenviar. Intenta más tarde.';
      if (alertEl) { alertEl.style.color = '#e07070'; alertEl.textContent = msg; }
      console.warn('[Auth] reenviar verificación error:', err.code);
    } finally {
      if (linkEl) { linkEl.style.pointerEvents = 'auto'; linkEl.style.opacity = '1'; }
    }
  };

  /* ── Registro con email ──────────────────────────────────────── */
  window._authRegistroEmail = async function (e) {
    e.preventDefault();
    _authClearAlert();
    const nombre          = document.getElementById('regNombre').value.trim();
    const email           = document.getElementById('regEmail').value.trim();
    const password        = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    if (!nombre || !email || !password || !confirmPassword) {
      if (!nombre)          _marcarCampoError('regNombre',          'Requerido');
      if (!email)           _marcarCampoError('regEmail',           'Requerido');
      if (!password)        _marcarCampoError('regPassword',        'Requerido');
      if (!confirmPassword) _marcarCampoError('regConfirmPassword', 'Requerido');
      _authShowAlert('Por favor completa todos los campos', 'error');
      return;
    }

    if (password !== confirmPassword) {
      _marcarCampoError('regConfirmPassword', '');
      _authShowAlert('Las contraseñas no coinciden', 'error'); return;
    }

    _authSetLoading('btnRegSubmit', true);
    try {
      const auth = await _getAuth();
      const { createUserWithEmailAndPassword, sendEmailVerification } =
        await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      const cred  = await createUserWithEmailAndPassword(auth, email, password);

      try {
        await sendEmailVerification(cred.user);
      } catch (verErr) {
        console.warn('[Auth] sendEmailVerification error:', verErr.code, verErr.message);
      }

      const token = await cred.user.getIdToken();
      const data  = await _llamarBackend('cliente-registro', token, { nombre, correo: email });
      if (!data.success) throw new Error(data.error || 'Error al registrarse');

      _pendingCliente = data.cliente;
      const labelEl = document.getElementById('authVerifEmailLabel');
      if (labelEl) labelEl.textContent = email;

      document.getElementById('authViewLogin').style.display       = 'none';
      document.getElementById('authViewVerificacion').style.display = 'block';

      const formReg = document.querySelector('#authFormRegistro form');
      if (formReg) formReg.reset();
    } catch (e) {
      const map = {
        'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Inicia sesión.',
        'auth/invalid-email':        'Correo inválido.',
        'auth/weak-password':        'La contraseña es muy corta (mínimo 6 caracteres).',
      };
      const msg = e.message || '';
      if (_esFalloDeConexion(e)) {
        _authShowAlert('Sin conexión. Verifica tu internet e intenta de nuevo.', 'error');
      } else if (msg.includes('personal') || msg.includes('Personal')) {
        _authShowAlert('Ese correo pertenece a una cuenta de personal. Usa la opción "Personal" del menú.', 'error');
      } else {
        _authShowAlert(map[e.code] || (msg.startsWith('Error') ? msg : 'No se pudo crear la cuenta. Intenta de nuevo.'), 'error');
      }
    } finally {
      _authSetLoading('btnRegSubmit', false);
    }
  };

  /* ── Restablecer contraseña ──────────────────────────────────── */
  window._authResetPassword = async function (e) {
    e.preventDefault();
    const email = (document.getElementById('loginEmail')?.value || '').trim();
    if (!email) {
      _authShowAlert('Ingresa tu correo primero para restablecer tu contraseña.', 'error');
      document.getElementById('loginEmail')?.focus();
      return;
    }
    try {
      const auth = await _getAuth();
      const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      await sendPasswordResetEmail(auth, email);
      _authShowAlert('Te enviamos un enlace para restablecer tu contraseña. Revisa tu correo (y spam).', 'success');
    } catch (err) {
      const map = {
        'auth/user-not-found':    'No existe cuenta con ese correo.',
        'auth/invalid-email':     'Correo inválido.',
        'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
      };
      if (_esFalloDeConexion(err)) {
        _authShowAlert('Sin conexión. Verifica tu internet e intenta de nuevo.', 'error');
      } else {
        _authShowAlert(map[err.code] || 'No se pudo enviar el correo. Intenta de nuevo.', 'error');
      }
    }
  };

  /* ── Login con Google ───────────────────────────────────────── */
  window._authLoginGoogle = async function () {
    _authClearAlert();
    const btn = document.getElementById('btnAuthGoogle');
    if (btn) {
      btn._origHTML = btn.innerHTML;
      btn.disabled  = true;
      btn.innerHTML = '<span class="auth-spinner"></span>Espera...';
    }
    try {
      const auth = await _getAuth();
      const { GoogleAuthProvider, signInWithPopup } =
        await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred  = await signInWithPopup(auth, provider);
      const token = await cred.user.getIdToken();
      const data  = await _llamarBackend('cliente-login', token);
      if (!data.success) throw new Error(data.error || 'Error al iniciar sesión con Google');
      if (data.redirect) { window.location.href = data.redirect; return; }
      _onAutenticado(data.cliente, true);
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        // El usuario cerró el popup — no mostrar error
      } else if (e.code === 'auth/account-exists-with-different-credential') {
        _authShowAlert('Ya existe una cuenta con ese correo. Inicia sesión con tu contraseña en su lugar.', 'error');
      } else if (_esFalloDeConexion(e)) {
        _authShowAlert('Sin conexión. Verifica tu internet e intenta de nuevo.', 'error');
      } else {
        _authShowAlert(e.message?.startsWith('Error') ? e.message : 'No se pudo iniciar sesión con Google. Intenta de nuevo.', 'error');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        if (btn._origHTML) btn.innerHTML = btn._origHTML;
      }
    }
  };

  /* ── Logout ──────────────────────────────────────────────────── */
  window._authLogout = async function () {
    _detenerPollingVerificacion();
    try {
      const auth = await _getAuth();
      const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      await signOut(auth);
    } catch (_) { /* ignorar */ }

    const csrf = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('XSRF-TOKEN='));
    const csrfToken = csrf ? decodeURIComponent(csrf.split('=')[1]) : '';
    await fetch('/api/auth.php?action=cliente-logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
      credentials: 'same-origin',
      body: '{}',
    }).catch(() => {});

    _cliente = null;
    _actualizarNavBtn();
    AuthModal.close();
    location.reload();
  };

  /* ── API pública ─────────────────────────────────────────────── */
  window.AuthModal = {

    open(callback) {
      _crearModal();
      _callback = typeof callback === 'function' ? callback : null;
      _actualizarVistaModal();
      _authClearAlert();
      const overlay = document.getElementById('authModalOverlay');
      if (overlay) {
        overlay.style.display = 'flex';
        requestAnimationFrame(() => overlay.classList.add('visible'));
      }
    },

    openRegistro(callback) {
      this.open(callback);
      setTimeout(() => { if (window._authSetTab) window._authSetTab('registro'); }, 60);
    },

    close() {
      const overlay = document.getElementById('authModalOverlay');
      if (overlay) {
        overlay.classList.remove('visible');
        if (_loginTimer) { clearInterval(_loginTimer); _loginTimer = null; }
        setTimeout(() => {
          overlay.style.display = 'none';
          document.querySelector('#authFormLogin form')?.reset();
          document.querySelector('#authFormRegistro form')?.reset();
          _authClearAlert();
          _loginIntentos = 0;
          const btn = document.getElementById('btnLoginSubmit');
          if (btn) btn.disabled = false;
          if (typeof window._authSetTab === 'function') window._authSetTab('login');
          document.querySelectorAll('#authModalOverlay input').forEach(el => {
            el.style.borderColor = '';
            el.style.boxShadow   = '';
          });
        }, 300);
      }
    },

    logout() { window._authLogout(); },

    isAuthenticated() { return !!_cliente; },

    getCliente() { return _cliente ? { ..._cliente } : null; },

    async verificar() {
      try {
        const res  = await fetch('/api/auth.php?action=cliente-verificar', { credentials: 'same-origin' });
        const data = await res.json();
        if (data.success && data.autenticado && data.cliente) {
          _cliente = data.cliente;
          // Usar el valor que devuelve el servidor (guardado en sesión al hacer login)
          // Si el servidor devuelve null (sesión vieja sin el dato) intentar desde Firebase
          if (data.email_verified !== null && data.email_verified !== undefined) {
            _emailVerificado = data.email_verified;
          } else {
            try {
              const auth = await _getAuth();
              const user = auth.currentUser;
              if (user) { await user.reload(); _emailVerificado = user.emailVerified; }
              else { _emailVerificado = false; }
            } catch (_) { _emailVerificado = false; }
          }
          _actualizarNavBtn();
          if (_emailVerificado === false) _mostrarBannerVerificacion();
          return _cliente;
        }
      } catch (_) { /* ignorar */ }
      _cliente = null;
      _emailVerificado = null;
      _actualizarNavBtn();
      return null;
    },

    isEmailVerified() { return _emailVerificado !== false; },

    openMenuMovil(btn) {
      if (_cliente) { window.location.href = '/mi-cuenta'; }
      else { AuthModal.open(); }
    },

    actualizarCartBadge() { _actualizarMbnCartBadge(); },

    requireAuth(callback, mensajePersonalizado) {
      if (_cliente) {
        if (typeof callback === 'function') callback(_cliente);
        return;
      }
      _crearModal();
      if (mensajePersonalizado) {
        const sub = document.getElementById('authModalSubtitle');
        if (sub) sub.textContent = mensajePersonalizado;
      }
      this.open(callback);
    },
  };

  /* ── Verificar sesión al cargar la página ────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    _actualizarMbnCartBadge();
    AuthModal.verificar();
    _initTooltipsTouchSupport();
  });

  /* ── Soporte touch para tooltips .wh-help (móvil) ───────────── */
  function _initTooltipsTouchSupport() {
    document.addEventListener('click', function (e) {
      const tip = e.target.closest('.wh-help');
      if (tip) {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = tip.classList.toggle('wh-help--open');
        if (isOpen) {
          document.querySelectorAll('.wh-help--open').forEach(t => {
            if (t !== tip) t.classList.remove('wh-help--open');
          });
        }
        return;
      }
      document.querySelectorAll('.wh-help--open').forEach(t => t.classList.remove('wh-help--open'));
    });
  }

  /* ── Overlay de verificación 2FA para personal ───────────────── */
  // Se muestra después del login cuando el servidor devuelve 2fa_required=true.
  // El usuario ingresa su código TOTP; si es correcto se redirige al panel.
  function _mostrar2faCheck(redirectUrl, firebaseUser) {
    const overlay = document.createElement('div');
    overlay.id = 'wh-2fa-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:rgba(10,8,5,0.92);
      display:flex;align-items:center;justify-content:center;
      font-family:'Segoe UI',Arial,sans-serif;
    `;
    overlay.innerHTML = `
      <div style="
        background:#252525;border:1px solid #3a3020;border-radius:16px;
        padding:40px 36px;max-width:380px;width:90%;text-align:center;
        box-shadow:0 8px 40px rgba(0,0,0,0.6);
      ">
        <div style="font-size:40px;margin-bottom:16px;">🔐</div>
        <h2 style="color:#e8dcc8;font-size:20px;font-weight:700;margin-bottom:8px;">
          Verificación en dos pasos
        </h2>
        <p style="color:#a09080;font-size:13px;line-height:1.6;margin-bottom:24px;">
          Ingresa el código de 6 dígitos de tu app de autenticación.
        </p>
        <input id="wh-2fa-input"
          type="text" inputmode="numeric" autocomplete="one-time-code"
          maxlength="6" placeholder="000 000"
          style="
            width:100%;font-size:28px;letter-spacing:8px;text-align:center;
            background:#1a1a1a;border:2px solid #444;border-radius:10px;
            color:#e8dcc8;padding:14px;font-family:monospace;outline:none;
            margin-bottom:16px;
          ">
        <div id="wh-2fa-error" style="
          display:none;color:#e07070;font-size:13px;margin-bottom:14px;
          padding:10px;background:#2a0a0a;border-radius:6px;
        "></div>
        <button id="wh-2fa-btn" style="
          width:100%;padding:14px;border:none;border-radius:8px;
          background:linear-gradient(135deg,#c9a96e,#a07830);
          color:#1a1008;font-weight:700;font-size:15px;cursor:pointer;
        ">
          Verificar y entrar
        </button>
        <p style="color:#5a5040;font-size:11px;margin-top:16px;">
          ¿Perdiste acceso a tu app? Contacta al administrador.
        </p>
      </div>`;
    document.body.appendChild(overlay);

    const input  = overlay.querySelector('#wh-2fa-input');
    const errBox = overlay.querySelector('#wh-2fa-error');
    const btn    = overlay.querySelector('#wh-2fa-btn');
    input.focus();

    async function _verificar() {
      const codigo = input.value.replace(/\D/g, '');
      if (codigo.length !== 6) {
        errBox.textContent = 'Ingresa los 6 dígitos completos.';
        errBox.style.display = '';
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Verificando...';
      errBox.style.display = 'none';

      try {
        const csrfCookie = document.cookie.split(';').find(c => c.trim().startsWith('XSRF-TOKEN='));
        const csrf = csrfCookie ? decodeURIComponent(csrfCookie.split('=')[1]) : '';

        const res  = await fetch('/api/auth.php?action=2fa-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          credentials: 'same-origin',
          body: JSON.stringify({ codigo }),
        });
        const data = await res.json();

        if (data.success) {
          window.location.href = redirectUrl;
        } else {
          errBox.textContent = data.error || 'Código incorrecto. Intenta de nuevo.';
          errBox.style.display = '';
          input.value = '';
          input.focus();
        }
      } catch {
        errBox.textContent = 'Error de red. Intenta de nuevo.';
        errBox.style.display = '';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Verificar y entrar';
      }
    }

    btn.addEventListener('click', _verificar);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') _verificar(); });
    // Auto-submit cuando se completan 6 dígitos
    input.addEventListener('input', () => {
      if (input.value.replace(/\D/g,'').length === 6) _verificar();
    });
  }

})();
