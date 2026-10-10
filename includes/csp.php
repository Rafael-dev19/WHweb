<?php
// csp.php — Content-Security-Policy de las páginas HTML, con nonce por carga.
//
// Antes la política vivía en public/.htaccess con script-src 'unsafe-inline':
// cualquier <script> o onclick="…" inyectado (p. ej. por un dato de cliente
// mal escapado) se ejecutaba. Ahora solo corren los <script> propios que
// llevan el atributo nonce (cspNonce()) y los archivos de los dominios listados.
// Los eventos inline (onclick=, onchange=…) se reemplazaron por data-call /
// data-onchange / data-oninput (public/assets/js/event-delegation.js).
//
// Excepción: pago.php conserva 'unsafe-inline' porque el SDK de PayPal lo
// requiere (mismo criterio que tenía el .htaccess).

function cspNonce(): string {
    static $nonce = null;
    if ($nonce === null) $nonce = base64_encode(random_bytes(16));
    return $nonce;
}

function enviarCabeceraCSP(): void {
    $esPago = basename($_SERVER['SCRIPT_NAME'] ?? '') === 'pago.php';
    $scriptBase = $esPago ? ["'self'", "'unsafe-inline'"] : ["'self'", "'nonce-" . cspNonce() . "'"];

    $politica = [
        'default-src' => ["'self'"],
        'script-src'  => array_merge($scriptBase, [
            'https://cdn.sheetjs.com', 'https://js.stripe.com',
            'https://www.paypal.com', 'https://www.sandbox.paypal.com', 'https://www.paypalobjects.com',
            'https://www.gstatic.com', 'https://apis.google.com', 'https://maps.googleapis.com',
            'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net',
            'https://woodenhouse-898de.firebaseapp.com', 'https://static.cloudflareinsights.com',
            'https://www.googletagmanager.com', 'https://www.google-analytics.com',
            'https://www.google.com/recaptcha/', 'https://recaptcha.google.com/recaptcha/',
        ]),
        // Estilos inline se mantienen: el sitio usa style="…" en todas partes
        // y el riesgo de un estilo inyectado es mucho menor que el de un script.
        'style-src'   => ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com',
                          'https://cdn.jsdelivr.net', 'https://maps.googleapis.com'],
        'font-src'    => ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
        'img-src'     => ["'self'", 'data:', 'blob:', 'https:'],
        'media-src'   => ["'self'", 'blob:', 'https:'],
        'connect-src' => [
            "'self'", 'https://www.gstatic.com', 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com',
            'https://*.firebaseio.com', 'wss://*.firebaseio.com', 'https://firestore.googleapis.com',
            'https://firebase.googleapis.com', 'https://www.googleapis.com', 'https://identitytoolkit.googleapis.com',
            'https://securetoken.googleapis.com', 'https://oauth2.googleapis.com', 'https://accounts.google.com',
            'https://firebasestorage.googleapis.com', 'https://*.firebasestorage.app', 'https://*.firebaseapp.com',
            'https://woodenhouse-898de.firebaseapp.com', 'https://js.stripe.com', 'https://api.stripe.com',
            'https://m.stripe.com', 'https://m.stripe.network', 'https://merchant-ui-api.stripe.com',
            'https://api-m.sandbox.paypal.com', 'https://api-m.paypal.com', 'https://www.paypal.com',
            'https://www.sandbox.paypal.com', 'https://maps.googleapis.com', 'https://cloudflareinsights.com',
            'https://static.cloudflareinsights.com', 'https://firebaseappcheck.googleapis.com',
            'https://content-firebaseappcheck.googleapis.com', 'https://firebaseinstallations.googleapis.com',
            'https://fcmregistrations.googleapis.com', 'https://www.google.com',
        ],
        'frame-src'   => ['https://js.stripe.com', 'https://hooks.stripe.com', 'https://m.stripe.com', 'https://m.stripe.network',
                          'https://www.paypal.com', 'https://www.sandbox.paypal.com', 'https://woodenhouse-898de.firebaseapp.com',
                          'https://accounts.google.com', 'https://www.google.com', 'https://maps.google.com'],
        'worker-src'  => ["'self'", 'blob:'],
        'object-src'  => ["'none'"],
        'base-uri'    => ["'self'"],
        // Nadie puede meter el sitio (login, paneles, pago) dentro de un iframe ajeno.
        'frame-ancestors' => ["'self'"],
    ];

    $partes = [];
    foreach ($politica as $directiva => $fuentes) $partes[] = $directiva . ' ' . implode(' ', $fuentes);
    header('Content-Security-Policy: ' . implode('; ', $partes));
}
