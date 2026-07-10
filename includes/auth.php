<?php

if (!defined('WH_LOADED')) {
    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/db.php';
    require_once __DIR__ . '/functions.php';
}

// ── Extraer Bearer token del header ──────────────────────────────
function getBearerToken(): ?string {
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', trim($auth), $m)) {
        $token = trim($m[1]);
        if (substr_count($token, '.') === 2 && strlen($token) < 4096) {
            return $token;
        }
    }
    return null;
}

function obtenerClavesPublicasFirebase(): array {
    $cacheFile = sys_get_temp_dir() . '/wh_firebase_keys.json';
    $cacheAge  = file_exists($cacheFile) ? (time() - filemtime($cacheFile)) : PHP_INT_MAX;

    // Renovar si tiene más de 1 hora (las claves rotan cada 6h aprox)
    if ($cacheAge < 3600 && file_exists($cacheFile)) {
        $cached = json_decode(file_get_contents($cacheFile), true);
        if (!empty($cached)) return $cached;
    }

    $url = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $err  = '';
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if (!$res) $err = curl_error($ch);
    curl_close($ch);

    if ($code !== 200 || !$res) {
        error_log('[Firebase] obtenerClavesPublicas falló: HTTP ' . $code . ' curl_error="' . $err . '"');
        return [];
    }

    $keys = json_decode($res, true) ?: [];
    file_put_contents($cacheFile, json_encode($keys), LOCK_EX);
    return $keys;
}

function verificarTokenFirebase(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        error_log('[Firebase] Token malformado: no tiene 3 partes');
        return null;
    }

    $headerRaw  = base64_decode(strtr($parts[0], '-_', '+/') . '==');
    $payloadRaw = base64_decode(strtr($parts[1], '-_', '+/') . '==');
    $sigRaw     = base64_decode(strtr($parts[2], '-_', '+/') . '==');

    if (!$headerRaw || !$payloadRaw || !$sigRaw) {
        error_log('[Firebase] Error decodificando partes del token');
        return null;
    }

    $header  = json_decode($headerRaw,  true);
    $payload = json_decode($payloadRaw, true);

    if (!is_array($header) || !is_array($payload)) {
        error_log('[Firebase] Header o payload no es JSON válido');
        return null;
    }

    $now = time();
    if (($payload['exp'] ?? 0) < $now) {
        error_log('[Firebase] Token expirado: exp=' . ($payload['exp'] ?? 0) . ' now=' . $now);
        return null;
    }

    // iat no se valida estrictamente: la firma RSA de Google ya garantiza autenticidad.
    // Registrar solo si el desfase es grande (indica drift del reloj del servidor).
    $iatDiff = ($payload['iat'] ?? 0) - $now;
    if ($iatDiff > 60) {
        error_log('[Firebase] Aviso: iat futuro ' . $iatDiff . 's — verificar NTP del servidor');
    }

    $aud = $payload['aud'] ?? '';
    if ($aud !== FIREBASE_PROJECT_ID) {
        error_log('[Firebase] aud incorrecto: esperado="' . FIREBASE_PROJECT_ID . '" recibido="' . $aud . '"');
        return null;
    }

    $iss = $payload['iss'] ?? '';
    if ($iss !== 'https://securetoken.google.com/' . FIREBASE_PROJECT_ID) {
        error_log('[Firebase] iss incorrecto: "' . $iss . '"');
        return null;
    }

    $sub = $payload['sub'] ?? '';
    if (empty($sub)) {
        error_log('[Firebase] sub vacío en el token');
        return null;
    }

    // ── Verificar firma RSA con clave pública de Google ──────────
    $kid  = $header['kid'] ?? '';
    $keys = obtenerClavesPublicasFirebase();

    if (empty($kid) || !isset($keys[$kid])) {
        // Clave no encontrada (puede ser rotación reciente o fallo de red) - fallback a tokeninfo
        error_log('[Firebase] kid "' . $kid . '" no encontrado en claves locales (' . count($keys) . ' disponibles). Intentando tokeninfo API...');
        return verificarTokenFirebaseViaAPI($token);
    }

    $cert    = $keys[$kid];
    $pubKey  = openssl_pkey_get_public($cert);
    if (!$pubKey) {
        error_log('[Firebase] openssl_pkey_get_public falló para kid=' . $kid);
        return verificarTokenFirebaseViaAPI($token);
    }

    $data      = $parts[0] . '.' . $parts[1];
    $resultado = openssl_verify($data, $sigRaw, $pubKey, OPENSSL_ALGO_SHA256);

    if ($resultado !== 1) {
        error_log('[Firebase] Firma RSA inválida (openssl_verify=' . $resultado . ') para kid=' . $kid);
        return null;
    }

    $payload['uid'] = $sub;
    return $payload;
}

function verificarTokenFirebaseViaAPI(string $token): ?array {
    $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($token);
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $err  = '';
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if (!$res) $err = curl_error($ch);
    curl_close($ch);

    if ($code !== 200 || !$res) {
        error_log('[Firebase] tokeninfo API falló: HTTP ' . $code . ' curl_error="' . $err . '"');
        return null;
    }

    $payload = json_decode($res, true);
    if (!is_array($payload)) return null;

    if (($payload['aud'] ?? '') !== FIREBASE_PROJECT_ID) {
        error_log('[Firebase] tokeninfo aud incorrecto: "' . ($payload['aud'] ?? '') . '"');
        return null;
    }
    if (($payload['exp'] ?? 0) < time()) return null;

    $sub = $payload['sub'] ?? '';
    if (empty($sub)) return null;

    $payload['uid'] = $sub;
    return $payload;
}

// ── Consulta MySQL ────────────────────────────────────────────────

function obtenerUsuarioPorFirebaseUid(string $uid): ?array {
    if (!preg_match('/^[a-zA-Z0-9]{20,128}$/', $uid)) return null;

    try {
        return dbRow(
            "SELECT id, firebase_uid, nombre_completo, correo, rol, activo,
                    totp_activo, totp_secreto
             FROM usuarios_personal
             WHERE firebase_uid = ? AND activo = 1
             LIMIT 1",
            [$uid]
        );
    } catch (\Throwable $e) {
        // Columnas 2FA aún no existen (migración pendiente): consultar sin ellas
        if (str_contains($e->getMessage(), 'Unknown column')) {
            $row = dbRow(
                "SELECT id, firebase_uid, nombre_completo, correo, rol, activo
                 FROM usuarios_personal
                 WHERE firebase_uid = ? AND activo = 1 LIMIT 1",
                [$uid]
            );
            if ($row) { $row['totp_activo'] = 0; $row['totp_secreto'] = null; }
            return $row ?: null;
        }
        throw $e;
    }
}

// ── Middlewares de autenticación ──────────────────────────────────

function requerirAutenticacion(): array {
    if (!empty($_SESSION['usuario_id']) && !empty($_SESSION['_csrf'])) {
        $now = time();
        if (!empty($_SESSION['_usuario_login_time']) && ($now - $_SESSION['_usuario_login_time']) > 28800) {
            _destruirSesionPersonal();
            jsonError('Sesión expirada. Por favor inicia sesión nuevamente.', 401);
        }
        if (!empty($_SESSION['_last_activity']) && ($now - $_SESSION['_last_activity']) > 7200) {
            _destruirSesionPersonal();
            jsonError('Sesión expirada por inactividad.', 401);
        }
        $_SESSION['_last_activity'] = $now;

        try {
            $usuario = dbRow(
                "SELECT id, firebase_uid, nombre_completo, correo, rol,
                        totp_activo, totp_secreto
                 FROM usuarios_personal
                 WHERE id = ? AND activo = 1 LIMIT 1",
                [$_SESSION['usuario_id']]
            );
        } catch (\Throwable $e) {
            if (str_contains($e->getMessage(), 'Unknown column')) {
                $usuario = dbRow(
                    "SELECT id, firebase_uid, nombre_completo, correo, rol
                     FROM usuarios_personal WHERE id = ? AND activo = 1 LIMIT 1",
                    [$_SESSION['usuario_id']]
                );
                if ($usuario) { $usuario['totp_activo'] = 0; $usuario['totp_secreto'] = null; }
            } else { throw $e; }
        }
        if ($usuario) {
            // 2FA: bloquea si el usuario tiene TOTP activo y no lo ha verificado en esta sesión
            if (function_exists('requerir2FA')) requerir2FA($usuario);
            return $usuario;
        }
        _destruirSesion();
    }

    $token = getBearerToken();
    if (!$token) jsonError('No autenticado', 401);

    $payload = verificarTokenFirebase($token);
    if (!$payload) jsonError('Token inválido o expirado', 401);

    $uid     = $payload['uid'] ?? '';
    $usuario = $uid ? obtenerUsuarioPorFirebaseUid($uid) : null;
    if (!$usuario) jsonError('Usuario no autorizado en el sistema', 403);

    _crearSesion($usuario);
    return $usuario;
}

function requerirAdmin(): array {
    $usuario = requerirAutenticacion();
    if ($usuario['rol'] !== 'administrador') {
        jsonError('Acceso denegado: se requiere rol administrador', 403);
    }
    return $usuario;
}

function requerirEmpleado(): array {
    $usuario = requerirAutenticacion();
    if (!in_array($usuario['rol'], ['administrador', 'empleado'], true)) {
        jsonError('Acceso denegado', 403);
    }
    return $usuario;
}

function sesionActiva(): ?array {
    if (!empty($_SESSION['usuario_id'])) {
        try {
            return dbRow(
                "SELECT id, nombre_completo, correo, rol, totp_activo
                 FROM usuarios_personal
                 WHERE id = ? AND activo = 1 LIMIT 1",
                [$_SESSION['usuario_id']]
            );
        } catch (\Throwable $e) {
            if (str_contains($e->getMessage(), 'Unknown column')) {
                return dbRow(
                    "SELECT id, nombre_completo, correo, rol
                     FROM usuarios_personal WHERE id = ? AND activo = 1 LIMIT 1",
                    [$_SESSION['usuario_id']]
                );
            }
            throw $e;
        }
    }
    return null;
}

// ── Helpers de sesión ─────────────────────────────────────────────

function _crearSesion(array $usuario): void {
    // session_regenerate_id ya se ejecuta en config.php en la primera visita.
    // Volver a llamarlo aquí con requests concurrentes destruye la sesión de otras
    // llamadas paralelas (race condition) causando cierres de sesión intermitentes.
    $_SESSION['usuario_id']          = $usuario['id'];
    $_SESSION['usuario_rol']         = $usuario['rol'];
    $_SESSION['_usuario_login_time'] = time();
    // Solo regenerar CSRF si no hay sesión de cliente activa en paralelo
    if (empty($_SESSION['cliente_id'])) {
        $p = session_get_cookie_params();
        $_SESSION['_csrf'] = bin2hex(random_bytes(32));
        setcookie('XSRF-TOKEN', $_SESSION['_csrf'], [
            'expires'  => 0,
            'path'     => '/',
            'domain'   => $p['domain'],
            'secure'   => $p['secure'],
            'httponly' => false,
            'samesite' => 'Strict',
        ]);
    }
}

function _destruirSesion(): void {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 86400,
            $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        setcookie('XSRF-TOKEN', '', time() - 86400, '/', $p['domain'], true, false);
    }
    session_destroy();
    if (session_status() === PHP_SESSION_NONE) session_start();
    session_regenerate_id(true);
    session_destroy();
}

function cerrarSesion(): void {
    _destruirSesion();
}

// Cierra SOLO la sesión de cliente; conserva la sesión de personal si existe
function _destruirSesionCliente(): void {
    unset(
        $_SESSION['cliente_id'],
        $_SESSION['cliente_uid'],
        $_SESSION['cliente_rol'],
        $_SESSION['cliente_email_verified'],
        $_SESSION['_cliente_login_time']
    );
    if (empty($_SESSION['usuario_id'])) {
        session_regenerate_id(true);
        // Emite un token CSRF fresco — el modal de login (misma página, sin reload)
        // necesita un token válido en la cookie para el siguiente POST de autenticación.
        // Borrar la cookie aquí causaría un 403 inmediato al volver a iniciar sesión.
        $nuevoCsrf = bin2hex(random_bytes(32));
        $_SESSION['_csrf'] = $nuevoCsrf;
        $p = session_get_cookie_params();
        setcookie('XSRF-TOKEN', $nuevoCsrf, [
            'expires'  => 0,
            'path'     => '/',
            'domain'   => $p['domain'],
            'secure'   => $p['secure'],
            'httponly' => false,
            'samesite' => 'Strict',
        ]);
    }
}

// Cierra SOLO la sesión de personal; conserva la sesión de cliente si existe
function _destruirSesionPersonal(): void {
    unset(
        $_SESSION['usuario_id'],
        $_SESSION['usuario_rol'],
        $_SESSION['_usuario_login_time']
    );
    if (empty($_SESSION['cliente_id'])) {
        session_regenerate_id(true);
        $nuevoCsrf = bin2hex(random_bytes(32));
        $_SESSION['_csrf'] = $nuevoCsrf;
        $p = session_get_cookie_params();
        setcookie('XSRF-TOKEN', $nuevoCsrf, [
            'expires'  => 0,
            'path'     => '/',
            'domain'   => $p['domain'],
            'secure'   => $p['secure'],
            'httponly' => false,
            'samesite' => 'Strict',
        ]);
    }
}

// ── Generar y validar token CSRF ──────────────────────────────────

function getCsrfToken(): string {
    if (empty($_SESSION['_csrf'])) {
        $_SESSION['_csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['_csrf'];
}

function verificarCsrfToken(string $token): bool {
    $esperado = $_SESSION['_csrf'] ?? '';
    // hash_equals previene timing attacks
    return !empty($esperado) && hash_equals($esperado, $token);
}

// ── Autenticación de clientes (e-commerce) ───────────────────────

function obtenerClientePorFirebaseUid(string $uid): ?array {
    if (!preg_match('/^[a-zA-Z0-9]{20,128}$/', $uid)) return null;
    return dbRow(
        "SELECT id, firebase_uid, nombre, correo, telefono, direccion, colonia, municipio, ciudad, cp, activo
         FROM clientes WHERE firebase_uid = ? AND activo = 1 LIMIT 1",
        [$uid]
    );
}

function esPersonal(string $uid): bool {
    if (!preg_match('/^[a-zA-Z0-9]{20,128}$/', $uid)) return false;
    return (bool) dbRow(
        "SELECT id FROM usuarios_personal WHERE firebase_uid = ? LIMIT 1",
        [$uid]
    );
}

function registrarCliente(array $data): ?array {
    $uid    = trim($data['firebase_uid'] ?? '');
    $nombre = trim($data['nombre'] ?? '');
    $correo = trim($data['correo'] ?? '');
    if (empty($uid) || empty($nombre) || empty($correo)) return null;
    if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) return null;
    if (esPersonal($uid)) return null;  // nunca registrar personal como cliente
    try {
        dbQuery(
            "INSERT INTO clientes (firebase_uid, nombre, correo, telefono)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), correo=VALUES(correo), telefono=VALUES(telefono)",
            [$uid, $nombre, $correo, $data['telefono'] ?? null]
        );
        return obtenerClientePorFirebaseUid($uid);
    } catch (\Throwable $e) {
        error_log('registrarCliente error: ' . $e->getMessage());
        return null;
    }
}

function _crearSesionCliente(array $cliente): void {
    $_SESSION['cliente_id']          = $cliente['id'];
    $_SESSION['cliente_uid']         = $cliente['firebase_uid'];
    $_SESSION['cliente_rol']         = 'cliente';
    $_SESSION['_cliente_login_time'] = time();
    // Solo regenerar CSRF si no hay sesión de personal activa en paralelo
    if (empty($_SESSION['usuario_id'])) {
        $p = session_get_cookie_params();
        $_SESSION['_csrf'] = bin2hex(random_bytes(32));
        setcookie('XSRF-TOKEN', $_SESSION['_csrf'], [
            'expires'  => 0,
            'path'     => '/',
            'domain'   => $p['domain'],
            'secure'   => $p['secure'],
            'httponly' => false,
            'samesite' => 'Strict',
        ]);
    }
}

function sesionClienteActiva(): ?array {
    if (empty($_SESSION['cliente_id']) || ($_SESSION['cliente_rol'] ?? '') !== 'cliente') return null;
    $now = time();
    if (!empty($_SESSION['_cliente_login_time']) && ($now - $_SESSION['_cliente_login_time']) > 28800) { _destruirSesionCliente(); return null; }
    if (!empty($_SESSION['_last_activity']) && ($now - $_SESSION['_last_activity']) > 7200) { _destruirSesionCliente(); return null; }
    $_SESSION['_last_activity'] = $now;
    return dbRow(
        "SELECT id, firebase_uid, nombre, correo, telefono, direccion, colonia, municipio, ciudad, cp
         FROM clientes WHERE id = ? AND activo = 1 LIMIT 1",
        [$_SESSION['cliente_id']]
    );
}

function requerirCliente(): array {
    $cliente = sesionClienteActiva();
    if ($cliente) return $cliente;
    $token = getBearerToken();
    if (!$token) jsonError('No autenticado como cliente', 401);
    $payload = verificarTokenFirebase($token);
    if (!$payload) jsonError('Token de cliente inválido', 401);
    $uid     = $payload['uid'] ?? '';
    $cliente = $uid ? obtenerClientePorFirebaseUid($uid) : null;
    if (!$cliente) jsonError('Cliente no registrado en el sistema', 403);
    _crearSesionCliente($cliente);
    return $cliente;
}

function clienteAutenticado(): bool {
    return !empty($_SESSION['cliente_id']) && ($_SESSION['cliente_rol'] ?? '') === 'cliente';
}
