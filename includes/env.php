<?php
// env.php — carga de .env y constantes públicas del sitio.
// Sin sesión ni headers: lo pueden cargar páginas estáticas (catálogo, detalle,
// términos) sin pagar el costo de abrir una sesión PHP en cada visita anónima.
if (defined('WH_ENV_LOADED')) return;
define('WH_ENV_LOADED', true);

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
define('EMAIL_FROM',           env('EMAIL_FROM',           ''));
define('EMAIL_FROM_NAME',      env('EMAIL_FROM_NAME',      'Wooden House'));
define('SMTP_HOST',            env('SMTP_HOST',            ''));
define('SMTP_PORT',            (int) env('SMTP_PORT',      587));
define('SMTP_USER',            env('SMTP_USER',            ''));
define('SMTP_PASS',            env('SMTP_PASS',            ''));
define('ADMIN_EMAIL',          env('ADMIN_EMAIL',          ''));
define('DESARROLLADOR_EMAIL',  env('DESARROLLADOR_EMAIL',  ''));
define('EMAIL_PEDIDOS',        env('EMAIL_PEDIDOS',        ''));
define('EMAIL_CITAS',          env('EMAIL_CITAS',          ''));
define('EMAIL_COTIZACIONES',   env('EMAIL_COTIZACIONES',   ''));
define('EMAIL_VENTAS',         env('EMAIL_VENTAS',         ''));

// ── Google Maps ───────────────────────────────────────────────────
define('GOOGLE_MAPS_API_KEY', env('GOOGLE_MAPS_API_KEY', ''));

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

function sitePhoneDigits(): string {
    return preg_replace('/\D/', '', SITE_PHONE);
}
function siteWhatsappUrl(string $texto = ''): string {
    $url = 'https://wa.me/521' . sitePhoneDigits();
    return $texto === '' ? $url : $url . '?text=' . rawurlencode($texto);
}
