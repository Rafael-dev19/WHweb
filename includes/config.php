<?php
// config.php — configuración central de Wooden House

define('WH_LOADED', true);

require_once __DIR__ . '/assets.php';
require_once __DIR__ . '/env.php';

// ── Encoding UTF-8 global ─────────────────────────────────────────
mb_internal_encoding('UTF-8');
mb_http_output('UTF-8');
// Solo enviar el header Content-Type HTML para páginas web (no para API JSON)
// Las APIs lo envían ellas mismas en jsonSuccess()/jsonError()
if (!defined('WH_API_REQUEST')) {
    header('Content-Type: text/html; charset=utf-8');

    // ── Headers de seguridad HTTP para páginas HTML (login, paneles, checkout) ──
    // api/_helpers.php ya los pone para las respuestas JSON; aquí faltaban para
    // el HTML servido directo — sin esto, login/paneles eran embebibles en un
    // <iframe> de otro sitio (clickjacking / UI redressing).
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header_remove('X-Powered-By');
    header_remove('Server');
    require_once __DIR__ . '/csp.php';
    enviarCabeceraCSP();
    $__isHttpsPage = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
                   || (int)($_SERVER['SERVER_PORT'] ?? 80) === 443;
    if ($__isHttpsPage) {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }
}

// ── Sesión segura ─────────────────────────────────────────────────
if (session_status() === PHP_SESSION_NONE) {
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
             || (int)($_SERVER['SERVER_PORT'] ?? 80) === 443;

    $appHost      = parse_url(APP_URL, PHP_URL_HOST) ?: '';
    $cookieDomain = preg_replace('/^www\./', '', $appHost);
    // Localhost e IPs no admiten domain con punto — el navegador los rechaza
    if ($cookieDomain && $cookieDomain !== 'localhost'
        && !preg_match('/^\d{1,3}(\.\d{1,3}){3}$/', $cookieDomain)) {
        $cookieDomain = '.' . $cookieDomain;
    } else {
        $cookieDomain = '';
    }

    // lifetime=0: la cookie muere al cerrar el navegador (protege equipos compartidos)
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => $cookieDomain,
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    define('SESSION_IDLE_TIMEOUT', 900);
    ini_set('session.gc_maxlifetime', 7200);

    session_start();

    // Regenerar ID en la primera visita — previene session fixation
    if (empty($_SESSION['_initiated'])) {
        session_regenerate_id(true);
        $_SESSION['_initiated']     = true;
        $_SESSION['_created']       = time();
        $_SESSION['_last_activity'] = time();
    }

    // ── Timeout por inactividad ───────────────────────────────────
    // Solo para sesiones de cliente/anónimas. El personal (jefe/administrador/
    // empleado/disenador) tiene su propio timeout en requerirAutenticacion()
    // (2h inactividad / 8h absoluto) — aplicarles también este de 15 min los
    // desconecta de golpe con solo dejar el panel abierto leyendo un reporte.
    if (empty($_SESSION['usuario_id']) && isset($_SESSION['_last_activity'])
        && (time() - $_SESSION['_last_activity']) > SESSION_IDLE_TIMEOUT) {
        $teniaSesion = !empty($_SESSION['cliente_id']) || !empty($_SESSION['usuario_id']);
        // El token CSRF ya emitido sigue siendo válido para la petición en curso
        // (es la que el navegador trae en la cookie ahora mismo) — conservarlo
        // evita que el propio reinicio de sesión por inactividad cause un 403
        // falso en la acción que el usuario está ejecutando justo en este momento.
        $csrfPrevio = $_SESSION['_csrf'] ?? null;
        session_unset();
        session_destroy();
        session_start();
        session_regenerate_id(true);
        $_SESSION['_initiated']     = true;
        $_SESSION['_created']       = time();
        $_SESSION['_last_activity'] = time();
        if ($csrfPrevio) {
            $_SESSION['_csrf'] = $csrfPrevio;
        }
        if ($teniaSesion) {
            $_SESSION['_session_expired'] = true;
        }
    } else {
        $_SESSION['_last_activity'] = time();
    }

    // ── Timeout absoluto (2 horas) ────────────────────────────────
    // Igual que arriba: solo cliente/anónimas. Para personal, este contador
    // arranca desde la primera visita al navegador (no desde el login), así
    // que podía cerrarles la sesión minutos después de haber iniciado sesión
    // si ya llevaban tiempo con el sitio abierto antes de loguearse.
    if (empty($_SESSION['usuario_id']) && isset($_SESSION['_created']) && (time() - $_SESSION['_created']) > 7200) {
        $csrfPrevio = $_SESSION['_csrf'] ?? null;
        session_unset();
        session_destroy();
        session_start();
        session_regenerate_id(true);
        $_SESSION['_initiated']     = true;
        $_SESSION['_created']       = time();
        $_SESSION['_last_activity'] = time();
        if ($csrfPrevio) {
            $_SESSION['_csrf'] = $csrfPrevio;
        }
    }

    // ── CSRF: emitir token en cada visita (patrón double-submit cookie) ──
    // No depende de includes/auth.php (no todas las páginas lo cargan).
    // El mismo $_SESSION['_csrf'] es leído por verificarCsrfToken() en auth.php.
    if (empty($_SESSION['_csrf'])) {
        $_SESSION['_csrf'] = bin2hex(random_bytes(32));
    }
    if (($_COOKIE['XSRF-TOKEN'] ?? '') !== $_SESSION['_csrf']) {
        setcookie('XSRF-TOKEN', $_SESSION['_csrf'], [
            'expires'  => 0,
            'path'     => '/',
            'domain'   => $cookieDomain,
            'secure'   => $isHttps,
            'httponly' => false, // debe ser legible por JS para reenviarlo como header
            'samesite' => 'Strict',
        ]);
    }
}

// ── Logs ───────────────────────────────────────────────────────────
$logDir = dirname(__DIR__) . '/logs';
if (!is_dir($logDir)) @mkdir($logDir, 0750, true);
ini_set('error_log', $logDir . '/php_errors.log');
date_default_timezone_set('America/Mexico_City');