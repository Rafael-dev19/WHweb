<?php
// api/auth.php — Endpoints de autenticación (login, logout, verificar)
require_once __DIR__ . '/_helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($action) {

    // ── Login ─────────────────────────────────────────────────────
    case 'login':
        if ($method !== 'POST') jsonError('Método no permitido', 405);

        checkRateLimit('auth_login', 5, 900);

        $body = getJsonBody();

        checkHoneypot($body);

        $firebaseToken = trim($body['firebase_token'] ?? '');
        if (empty($firebaseToken)) {
            jsonError('firebase_token requerido', 422);
        }

        $payload = verificarTokenFirebase($firebaseToken);
        if (!$payload) {
            error_log('Login fallido - token inválido desde IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
            jsonError('Token de Firebase inválido o expirado', 401);
        }

        $uid = $payload['uid'] ?? '';
        if (empty($uid)) {
            jsonError('Token sin identificador de usuario', 401);
        }

        $usuario = obtenerUsuarioPorFirebaseUid($uid);
        if (!$usuario) {
            jsonError('Tu cuenta no tiene acceso al panel. Contacta al administrador.', 403);
        }

        _crearSesion($usuario);

        $redirect = $usuario['rol'] === 'administrador'
            ? '/admin/panel_administrador.php'
            : '/empleado/panel_empleado.php';

        jsonSuccess([
            'usuario' => [
                'id'     => $usuario['id'],
                'nombre' => $usuario['nombre_completo'],
                'correo' => $usuario['correo'],
                'rol'    => $usuario['rol'],
            ],
            'redirect' => $redirect,
            'csrf'     => getCsrfToken(),
        ]);
        break;

    // ── Logout ────────────────────────────────────────────────────
    case 'logout':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        _destruirSesionPersonal();
        jsonSuccess(['mensaje' => 'Sesión cerrada']);
        break;

    // ── Verificar sesión ──────────────────────────────────────────
    case 'verificar':
        $usuario = sesionActiva();
        if ($usuario) {
            jsonSuccess(['autenticado' => true, 'usuario' => $usuario, 'csrf' => getCsrfToken()]);
        }

        $token = getBearerToken();
        if ($token) {
            $payload = verificarTokenFirebase($token);
            if ($payload) {
                $uid = $payload['uid'] ?? '';
                $u   = $uid ? obtenerUsuarioPorFirebaseUid($uid) : null;
                if ($u) {
                    _crearSesion($u);
                    jsonSuccess(['autenticado' => true, 'usuario' => $u, 'csrf' => getCsrfToken()]);
                }
            }
        }

        jsonSuccess(['autenticado' => false]);
        break;

    // ── Perfil ────────────────────────────────────────────────────
    case 'perfil':
        $usuario = requerirAutenticacion();
        jsonSuccess(['usuario' => $usuario]);
        break;

    // ── Registro de cliente ───────────────────────────────────────
    case 'cliente-registro':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        checkRateLimit('cliente_registro', 3, 900);
        $body = getJsonBody();
        checkHoneypot($body);
        $firebaseToken = trim($body['firebase_token'] ?? '');
        if (empty($firebaseToken)) jsonError('firebase_token requerido', 422);
        $payload = verificarTokenFirebase($firebaseToken);
        if (!$payload) jsonError('Token de Firebase inválido', 401);
        $uid = $payload['uid'] ?? '';
        if (empty($uid)) jsonError('Token sin UID', 401);
        // Bloquear cuentas del personal: no pueden registrarse como clientes
        if (esPersonal($uid)) {
            jsonError('Esta cuenta es de acceso al personal. Usa la opción "Personal" del menú.', 403);
        }
        $nombre   = sanitize($body['nombre'] ?? '');
        $correo   = sanitize($body['correo'] ?? '');
        $telefono = sanitize($body['telefono'] ?? '');
        if (empty($nombre) || strlen($nombre) < 2) jsonError('Nombre requerido (mín. 2 caracteres)', 422);
        if (empty($correo) || !filter_var($correo, FILTER_VALIDATE_EMAIL)) jsonError('Correo electrónico inválido', 422);
        $tokenEmail = $payload['email'] ?? '';
        if (!empty($tokenEmail) && strtolower($tokenEmail) !== strtolower($correo)) {
            jsonError('El correo no coincide con la cuenta de Firebase', 422);
        }
        $cliente = registrarCliente(['firebase_uid' => $uid, 'nombre' => $nombre, 'correo' => $correo, 'telefono' => $telefono]);
        if (!$cliente) jsonError('No se pudo registrar la cuenta. Intenta nuevamente.', 500);
        _crearSesionCliente($cliente);
        // Los nuevos registros nunca tienen el correo verificado aún
        $_SESSION['cliente_email_verified'] = false;
        jsonSuccess(['cliente' => ['id' => $cliente['id'], 'nombre' => $cliente['nombre'], 'correo' => $cliente['correo']], 'email_verified' => false, 'csrf' => getCsrfToken(), 'mensaje' => '¡Cuenta creada exitosamente!']);
        break;

    // ── Login de cliente ──────────────────────────────────────────
    case 'cliente-login':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        checkRateLimit('cliente_login', 5, 900);
        $body = getJsonBody();
        checkHoneypot($body);
        $firebaseToken = trim($body['firebase_token'] ?? '');
        if (empty($firebaseToken)) jsonError('firebase_token requerido', 422);
        $payload = verificarTokenFirebase($firebaseToken);
        if (!$payload) jsonError('Token de Firebase inválido o expirado', 401);
        $uid = $payload['uid'] ?? '';
        if (!empty($uid) && esPersonal($uid)) {
            $usuario = obtenerUsuarioPorFirebaseUid($uid);
            if (!$usuario) jsonError('Tu cuenta de personal no está activa. Contacta al administrador.', 403);
            _crearSesion($usuario);
            $redirect = $usuario['rol'] === 'administrador' ? '/admin' : '/empleado';
            jsonSuccess(['redirect' => $redirect, 'tipo' => 'personal', 'rol' => $usuario['rol']]);
        }
        $cliente = $uid ? obtenerClientePorFirebaseUid($uid) : null;
        // Auto-registrar si no existe pero tiene email en el token
        if (!$cliente && !empty($uid) && !empty($payload['email'])) {
            $cliente = registrarCliente([
                'firebase_uid' => $uid,
                'nombre'       => $payload['name'] ?? $payload['email'],
                'correo'       => $payload['email'],
            ]);
        }
        if (!$cliente) jsonError('No se pudo autenticar la cuenta', 403);
        _crearSesionCliente($cliente);
        $emailVerified = (bool)($payload['email_verified'] ?? false);
        $_SESSION['cliente_email_verified'] = $emailVerified;
        jsonSuccess(['cliente' => ['id' => $cliente['id'], 'nombre' => $cliente['nombre'], 'correo' => $cliente['correo']], 'email_verified' => $emailVerified, 'csrf' => getCsrfToken()]);
        break;

    // ── Verificar sesión de cliente ───────────────────────────────
    case 'cliente-verificar':
        $cliente = sesionClienteActiva();
        if ($cliente) {
            $ev = $_SESSION['cliente_email_verified'] ?? null;
            jsonSuccess(['autenticado' => true, 'cliente' => $cliente, 'email_verified' => $ev, 'csrf' => getCsrfToken()]);
        }
        $token = getBearerToken();
        if ($token) {
            $payload = verificarTokenFirebase($token);
            if ($payload) {
                $uid = $payload['uid'] ?? '';
                $c   = $uid ? obtenerClientePorFirebaseUid($uid) : null;
                if ($c) {
                    _crearSesionCliente($c);
                    $ev = (bool)($payload['email_verified'] ?? false);
                    $_SESSION['cliente_email_verified'] = $ev;
                    jsonSuccess(['autenticado' => true, 'cliente' => $c, 'email_verified' => $ev, 'csrf' => getCsrfToken()]);
                }
            }
        }
        jsonSuccess(['autenticado' => false]);
        break;

    // ── Marcar correo como verificado (llamado desde el frontend tras confirmar con Firebase) ─
    case 'cliente-email-verificado':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        $cliente = sesionClienteActiva();
        if (!$cliente) jsonError('No autenticado', 401);
        $body = getJsonBody();
        $firebaseToken = trim($body['firebase_token'] ?? '');
        if (empty($firebaseToken)) jsonError('firebase_token requerido', 422);
        $payload = verificarTokenFirebase($firebaseToken);
        if (!$payload || empty($payload['email_verified'])) {
            jsonError('El correo aún no ha sido verificado', 403);
        }
        $_SESSION['cliente_email_verified'] = true;
        jsonSuccess(['email_verified' => true]);
        break;

    // ── Logout de cliente ─────────────────────────────────────────
    case 'cliente-logout':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        _destruirSesionCliente();
        jsonSuccess(['mensaje' => 'Sesión de cliente cerrada']);
        break;

    // ── Perfil de cliente ─────────────────────────────────────────
    case 'cliente-perfil':
        $cliente = requerirCliente();
        jsonSuccess(['cliente' => $cliente]);
        break;

    default:
        jsonError('Acción no válida. Opciones: login, logout, verificar, perfil, cliente-login, cliente-registro, cliente-verificar, cliente-logout', 400);
}
