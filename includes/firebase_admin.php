<?php
// firebase_admin.php — Acceso de servidor a Firebase con CUENTA DE SERVICIO.
//
// Antes PHP escribía/leía Firestore con la API key pública (la misma que va
// en el navegador), lo que obligaba a dejar las reglas de Firestore abiertas:
// cualquiera podía leer las notificaciones (datos de clientes) y crear
// documentos que la Cloud Function convierte en correos/push. Con un token
// OAuth de cuenta de servicio, PHP actúa como administrador y las reglas se
// pueden cerrar por completo (ver firebase/firestore.rules).
//
// Configuración: FIREBASE_SERVICE_ACCOUNT_FILE en .env = ruta a la llave JSON
// (Consola Firebase → Configuración del proyecto → Cuentas de servicio →
// Generar nueva clave privada). Guárdala FUERA de public/. Si no está
// configurada, todo sigue funcionando con la API key como antes.

if (!defined('WH_LOADED')) {
    require_once __DIR__ . '/config.php';
}

function firebaseServiceAccount(): ?array {
    static $sa = false;
    if ($sa !== false) return $sa;
    $sa = null;
    $ruta = defined('FIREBASE_SERVICE_ACCOUNT_FILE') ? FIREBASE_SERVICE_ACCOUNT_FILE : '';
    if ($ruta === '' || !is_readable($ruta)) return null;
    $json = json_decode((string)file_get_contents($ruta), true);
    if (!is_array($json) || empty($json['client_email']) || empty($json['private_key'])) {
        appLog('error', '[FirebaseAdmin] La llave de cuenta de servicio no es válida');
        return null;
    }
    $sa = $json;
    return $sa;
}

function firebaseUsaCuentaServicio(): bool {
    return firebaseServiceAccount() !== null;
}

function _b64url(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

// Token OAuth2 (1 h) firmado con la llave privada; se cachea ~55 min.
function firebaseAccessToken(): ?string {
    $sa = firebaseServiceAccount();
    if (!$sa) return null;

    $cache = sys_get_temp_dir() . '/wh_fb_token_' . md5($sa['client_email']) . '.json';
    if (is_readable($cache)) {
        $c = json_decode((string)file_get_contents($cache), true);
        if (!empty($c['token']) && ($c['exp'] ?? 0) > time() + 60) return $c['token'];
    }

    $ahora = time();
    $header = _b64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $claims = _b64url(json_encode([
        'iss'   => $sa['client_email'],
        'scope' => 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/firebase',
        'aud'   => 'https://oauth2.googleapis.com/token',
        'iat'   => $ahora,
        'exp'   => $ahora + 3600,
    ]));
    $firma = '';
    if (!openssl_sign("$header.$claims", $firma, $sa['private_key'], OPENSSL_ALGO_SHA256)) {
        appLog('error', '[FirebaseAdmin] No se pudo firmar el JWT');
        return null;
    }
    $jwt = "$header.$claims." . _b64url($firma);

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion'  => $jwt,
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = json_decode((string)$res, true);
    if ($code !== 200 || empty($data['access_token'])) {
        appLog('error', '[FirebaseAdmin] Token OAuth rechazado', ['http' => $code, 'body' => substr((string)$res, 0, 200)]);
        return null;
    }
    @file_put_contents($cache, json_encode(['token' => $data['access_token'], 'exp' => $ahora + (int)($data['expires_in'] ?? 3600)]), LOCK_EX);
    @chmod($cache, 0600);
    return $data['access_token'];
}

// URL + cabeceras para la API REST de Firestore: con cuenta de servicio va
// el token en la cabecera; sin ella, la API key en la URL (comportamiento anterior).
function firestoreRequest(string $metodo, string $rutaDocs, array $query = [], ?array $body = null): array {
    $base = 'https://firestore.googleapis.com/v1/projects/' . FIREBASE_PROJECT_ID . '/databases/(default)/documents/' . ltrim($rutaDocs, '/');
    $headers = ['Content-Type: application/json'];
    $token = firebaseAccessToken();
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    } else {
        $query['key'] = FIREBASE_API_KEY;
    }
    $qs = '';
    foreach ($query as $k => $v) {
        foreach ((array)$v as $vv) $qs .= ($qs === '' ? '?' : '&') . rawurlencode($k) . '=' . rawurlencode((string)$vv);
    }
    $ch = curl_init($base . $qs);
    $opts = [
        CURLOPT_CUSTOMREQUEST  => $metodo,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 8,
    ];
    if ($body !== null) $opts[CURLOPT_POSTFIELDS] = json_encode($body);
    curl_setopt_array($ch, $opts);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    return ['code' => $code, 'body' => (string)$res, 'error' => $err];
}

// Marca la cuenta de Firebase de un miembro del personal con el claim
// {staff: true, rol}. Las reglas de Storage solo dejan subir/reemplazar
// fotos del catálogo y archivos de pedidos a quien tenga staff == true
// (antes bastaba con cualquier sesión, incluida la de un cliente).
// $rol = null quita el claim (personal desactivado).
function firebaseMarcarPersonal(string $uid, ?string $rol): bool {
    $token = firebaseAccessToken();
    if (!$token || $uid === '') return false;
    $claims = $rol ? ['staff' => true, 'rol' => $rol] : new stdClass();
    $ch = curl_init('https://identitytoolkit.googleapis.com/v1/projects/' . FIREBASE_PROJECT_ID . '/accounts:update');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['localId' => $uid, 'customAttributes' => json_encode($claims)]),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Authorization: Bearer ' . $token],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code !== 200) {
        appLog('warning', '[FirebaseAdmin] No se pudo actualizar el claim de personal', ['uid' => $uid, 'http' => $code, 'body' => substr((string)$res, 0, 200)]);
        return false;
    }
    return true;
}
