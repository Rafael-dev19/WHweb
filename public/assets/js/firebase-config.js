// firebase-config.js — SDK Firebase: compat para paneles, modular para páginas públicas

const firebaseConfig = {
  apiKey:            "AIzaSyA0G4QZuxw0l7hH82SW_Y8_UurYsqyrMGs",
  authDomain:        "woodenhouse-898de.firebaseapp.com",
  projectId:         "woodenhouse-898de",
  storageBucket:     "woodenhouse-898de.firebasestorage.app",
  messagingSenderId: "662534856209",
  appId:             "1:662534856209:web:a69eba68addb491d0a1bb0",
  measurementId:     "G-LTQWQQ44ZH"
};

// Site key pública de reCAPTCHA v3 (Firebase App Check)
const RECAPTCHA_SITE_KEY = '6LfSEyQtAAAAAPlm7sa3YbiMud-WSre2hTYVwzSW';

window.firebaseConfig = firebaseConfig;

// ── Inicialización según contexto ─────────────────────────────────

function initFirebase() {
  if (typeof window.firebase !== 'undefined') {
    // ── Paneles: compat SDK ya cargado vía CDN en el HTML ──────────
    const fb  = window.firebase;
    const app = fb.apps.length ? fb.apps[0] : fb.initializeApp(firebaseConfig);

    // App Check debe activarse ANTES de auth/firestore/storage
    if (typeof fb.appCheck === 'function') {
      try {
        fb.appCheck().activate(RECAPTCHA_SITE_KEY, true);
      } catch (e) {
        console.warn('[AppCheck] activate error:', e);
      }
    }

    window.firebaseApp  = app;
    window.firebaseAuth = fb.auth();
    if (typeof fb.firestore === 'function')
      window.firebaseFirestore = fb.firestore();
    if (typeof fb.storage  === 'function')
      window.firebaseStorage   = fb.storage();

    return true;
  }

  // ── Páginas públicas: SDK modular ─────────────────────────────────
  Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js'),
  ]).then(([
    { initializeApp, getApps, getApp },
    { getAuth },
    { initializeAppCheck, ReCaptchaV3Provider },
  ]) => {
    const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);

    // App Check antes que auth
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });

    window.firebaseApp  = app;
    window.firebaseAuth = getAuth(app);
  }).catch(err => console.warn('[Firebase] init modular error:', err));

  return false;
}

initFirebase();
window.initFirebase = initFirebase;

// ── Helpers ───────────────────────────────────────────────────────

async function getFirebaseToken() {
  const auth = window.firebaseAuth;
  if (!auth) return null;
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken(true);
}

async function logoutFirebase() {
  const auth = window.firebaseAuth;
  if (auth) {
    if (typeof auth.signOut === 'function') {
      await auth.signOut();  // compat (paneles)
    } else {
      const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      await signOut(auth);   // modular (páginas públicas)
    }
  }
  await fetch('/api/auth.php?action=logout', { method: 'POST' }).catch(() => {});
}

async function authFetch(url, options = {}) {
  const token = await getFirebaseToken();
  if (token) {
    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, options);
}

window.getFirebaseToken = getFirebaseToken;
window.logoutFirebase   = logoutFirebase;
window.authFetch        = authFetch;
