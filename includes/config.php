<?php
// config.php — configuración central de Wooden House

define('WH_LOADED', true);

// ── Encoding UTF-8 global ─────────────────────────────────────────
mb_internal_encoding('UTF-8');
mb_http_output('UTF-8');
// Solo enviar el header Content-Type HTML para páginas web (no para API JSON)
// Las APIs lo envían ellas mismas en jsonSuccess()/jsonError()
if (!defined('WH_API_REQUEST')) {
    header('Content-Type: text/html; charset=utf-8');
}

// ── Cargar .env ───────────────────────────────────────────────────
// El .env vive FUERA de /public, nunca es accesible por navegador
$envFile = dirname(__DIR__) . '/.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (strpos($line, '=') !== false) {
            [$k, $v] = explode('=', $line, 2);
            $k = trim($k);
            $v = trim($v, " \t\n\r\"'");
            if (!array_key_exists($k, $_ENV)) {
                putenv("$k=$v");
                $_ENV[$k] = $v;
            }
        }
    }
}

function env(string $key, $default = null) {
    $v = getenv($key);
    return ($v !== false && $v !== '') ? $v : ($_ENV[$key] ?? $default);
}

// ── Entorno ────────────────────────────────────────────────────────
define('APP_ENV',   env('APP_ENV', 'development'));
define('APP_DEBUG', filter_var(env('APP_DEBUG', 'false'), FILTER_VALIDATE_BOOLEAN));
define('APP_URL',   rtrim(env('APP_URL', 'http://localhost'), '/'));

if (APP_DEBUG) {
    ini_set('display_errors', 1);
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', 0);
    error_reporting(0);
}

// ── Base de Datos ─────────────────────────────────────────────────
define('DB_HOST',    env('DB_HOST',    '127.0.0.1'));
define('DB_PORT',    (int) env('DB_PORT', 3306));
define('DB_NAME',    env('DB_NAME',    'wooden_house'));
define('DB_USER',    env('DB_USER',    ''));
define('DB_PASS',    env('DB_PASS',    ''));
define('DB_CHARSET', 'utf8mb4');

// ── Firebase ──────────────────────────────────────────────────────
// Solo project ID y API Key PUBLIC van aquí (son seguros para el frontend)
// La verificación real usa las JWKS públicas de Google, no secretos
define('FIREBASE_PROJECT_ID', env('FIREBASE_PROJECT_ID', ''));
define('FIREBASE_API_KEY',    env('FIREBASE_API_KEY',    ''));

// ── Stripe ────────────────────────────────────────────────────────
define('STRIPE_SECRET_KEY',     env('STRIPE_SECRET_KEY',     ''));
define('STRIPE_PUBLIC_KEY',     env('STRIPE_PUBLIC_KEY',''));
define('STRIPE_WEBHOOK_SECRET', env('STRIPE_WEBHOOK_SECRET', ''));

// ── PayPal ────────────────────────────────────────────────────────
define('PAYPAL_CLIENT_ID',     env('PAYPAL_CLIENT_ID',     ''));
define('PAYPAL_CLIENT_SECRET', env('PAYPAL_CLIENT_SECRET', ''));
define('PAYPAL_MODE',          env('PAYPAL_MODE',          'sandbox'));
define('PAYPAL_API_URL', PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com');
define('PAYPAL_WEBHOOK_ID',    env('PAYPAL_WEBHOOK_ID',    ''));

// ── Email ─────────────────────────────────────────────────────────
define('EMAIL_FROM',      env('EMAIL_FROM',      ''));
define('EMAIL_FROM_NAME', env('EMAIL_FROM_NAME', 'Wooden House'));
define('SMTP_HOST',       env('SMTP_HOST',       ''));
define('SMTP_PORT',       (int) env('SMTP_PORT', 587));
define('SMTP_USER',       env('SMTP_USER',       ''));
define('SMTP_PASS',       env('SMTP_PASS',       ''));

// ── Negocio ────────────────────────────────────────────────────────
define('COSTO_INSTALACION', (float) env('COSTO_INSTALACION', 1500));
define('COSTO_ENVIO',       (float) env('COSTO_ENVIO',       500));
define('DIAS_FABRICACION',    (int)   env('DIAS_FABRICACION',   15));
define('LIMITE_DIA',          (int)   env('LIMITE_DIA',          10));
define('MARGEN_HABILES',      (int)   env('MARGEN_HABILES',        2));
define('SITE_NAME',         'Wooden House');
define('SITE_PHONE',        env('SITE_PHONE',   '33 1705 4017'));
define('SITE_EMAIL',        env('SITE_EMAIL',   'contacto@woodenhouse.com'));
define('SITE_ADDRESS',      env('SITE_ADDRESS', 'Av. Chapultepec #1234, Col. Americana, Guadalajara'));

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
    if (isset($_SESSION['_last_activity'])
        && (time() - $_SESSION['_last_activity']) > SESSION_IDLE_TIMEOUT) {
        $teniaSesion = !empty($_SESSION['cliente_id']) || !empty($_SESSION['usuario_id']);
        session_unset();
        session_destroy();
        session_start();
        session_regenerate_id(true);
        $_SESSION['_initiated']     = true;
        $_SESSION['_created']       = time();
        $_SESSION['_last_activity'] = time();
        if ($teniaSesion) {
            $_SESSION['_session_expired'] = true;
        }
    } else {
        $_SESSION['_last_activity'] = time();
    }

    // ── Timeout absoluto (2 horas) ────────────────────────────────
    if (isset($_SESSION['_created']) && (time() - $_SESSION['_created']) > 7200) {
        session_unset();
        session_destroy();
        session_start();
        session_regenerate_id(true);
        $_SESSION['_initiated']     = true;
        $_SESSION['_created']       = time();
        $_SESSION['_last_activity'] = time();
    }
}

// ── CSP con nonce por petición (solo páginas web, no API) ────────
if (!defined('WH_API_REQUEST') && !defined('CSP_NONCE')) {
    $cspNonce = base64_encode(random_bytes(16));
    define('CSP_NONCE', $cspNonce);
    header('Content-Security-Policy: ' .
        "default-src 'self'; " .
        "script-src 'self' 'nonce-{$cspNonce}' " .
            "https://cdn.sheetjs.com https://js.stripe.com " .
            "https://www.paypal.com https://www.sandbox.paypal.com https://www.paypalobjects.com " .
            "https://www.gstatic.com https://apis.google.com https://maps.googleapis.com " .
            "https://cdnjs.cloudflare.com https://cdn.jsdelivr.net " .
            "https://woodenhouse-898de.firebaseapp.com " .
            "https://static.cloudflareinsights.com " .
            "https://www.googletagmanager.com https://www.google-analytics.com; " .
        "style-src 'self' 'unsafe-inline' " .
            "https://fonts.googleapis.com https://cdnjs.cloudflare.com " .
            "https://cdn.jsdelivr.net https://maps.googleapis.com; " .
        "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; " .
        "img-src 'self' data: blob: https:; " .
        "media-src 'self' blob: https: " .
            "https://firebasestorage.googleapis.com https://*.firebasestorage.app " .
            "https://storage.googleapis.com; " .
        "connect-src 'self' " .
            "https://www.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com " .
            "https://*.firebaseio.com wss://*.firebaseio.com " .
            "https://firestore.googleapis.com https://firebase.googleapis.com " .
            "https://www.googleapis.com https://identitytoolkit.googleapis.com " .
            "https://securetoken.googleapis.com https://oauth2.googleapis.com " .
            "https://accounts.google.com https://firebasestorage.googleapis.com " .
            "https://*.firebasestorage.app https://*.firebaseapp.com " .
            "https://woodenhouse-898de.firebaseapp.com " .
            "https://js.stripe.com https://api.stripe.com https://m.stripe.com " .
            "https://m.stripe.network https://merchant-ui-api.stripe.com " .
            "https://api-m.sandbox.paypal.com https://api-m.paypal.com " .
            "https://www.paypal.com https://www.sandbox.paypal.com " .
            "https://maps.googleapis.com " .
            "https://cloudflareinsights.com https://static.cloudflareinsights.com; " .
        "frame-src " .
            "https://js.stripe.com https://hooks.stripe.com " .
            "https://m.stripe.com https://m.stripe.network " .
            "https://www.paypal.com https://www.sandbox.paypal.com " .
            "https://woodenhouse-898de.firebaseapp.com " .
            "https://accounts.google.com https://www.google.com " .
            "https://maps.google.com https://www.google.com/maps; " .
        "worker-src 'self' blob:; " .
        "object-src 'none'; " .
        "base-uri 'self';"
    );
}

// ── Logs ───────────────────────────────────────────────────────────
$logDir = dirname(__DIR__) . '/logs';
if (!is_dir($logDir)) @mkdir($logDir, 0750, true);
ini_set('error_log', $logDir . '/php_errors.log');
date_default_timezone_set('America/Mexico_City');