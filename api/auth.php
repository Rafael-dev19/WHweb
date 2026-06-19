<?php
// api/auth.php — Endpoints de autenticación (login, logout, verificar)
require_once __DIR__ . '/_helpers.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($action) {

    // ── Login ─────────────────────────────────────────────────────
    case 'login':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        requerirCsrf();

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

        $redirect    = $usuario['rol'] === 'administrador'
            ? '/admin/panel_administrador.php'
            : '/empleado/panel_empleado.php';
        $tiene2fa    = !empty($usuario['totp_activo']);
        // Si el usuario aún no tiene 2FA configurado, forzar que lo configure
        // antes de entrar al panel (obligatorio para admin y empleado).
        $forzar2fa   = !$tiene2fa;

        jsonSuccess([
            'usuario' => [
                'id'     => $usuario['id'],
                'nombre' => $usuario['nombre_completo'],
                'correo' => $usuario['correo'],
                'rol'    => $usuario['rol'],
            ],
            'redirect'      => $redirect,
            'csrf'          => getCsrfToken(),
            '2fa_required'  => $tiene2fa,   // ya tiene 2FA → pedir código
            '2fa_setup'     => $forzar2fa,  // no tiene 2FA → forzar configuración
        ]);
        break;

    // ── Logout ────────────────────────────────────────────────────
    case 'logout':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        requerirCsrf();
        // Revocar TODAS las sesiones del usuario en BD antes de destruir la local.
        // Esto invalida cookies robadas que aún no han caducado.
        if (!empty($_SESSION['usuario_id'])) {
            revocarSesionesPersonal((int)$_SESSION['usuario_id']);
        }
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
        requerirCsrf();
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
        requerirCsrf();
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
            $redirect   = $usuario['rol'] === 'administrador' ? '/admin' : '/empleado';
            $tiene2fa   = !empty($usuario['totp_activo']);
            jsonSuccess([
                'redirect'     => $redirect,
                'tipo'         => 'personal',
                'rol'          => $usuario['rol'],
                '2fa_required' => $tiene2fa,   // tiene 2FA → pedir código antes de entrar
                '2fa_setup'    => !$tiene2fa,  // no tiene 2FA → forzar configuración
            ]);
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
        requerirCsrf();
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
        requerirCsrf();
        if (!empty($_SESSION['cliente_id'])) {
            revocarSesionesCliente((int)$_SESSION['cliente_id']);
        }
        _destruirSesionCliente();
        jsonSuccess(['mensaje' => 'Sesión de cliente cerrada']);
        break;

    // ── Perfil de cliente ─────────────────────────────────────────
    case 'cliente-perfil':
        $cliente = requerirCliente();
        jsonSuccess(['cliente' => $cliente]);
        break;

    // ── 2FA: verificar código durante login ───────────────────────
    // El frontend envía el código tras el login normal si la respuesta
    // incluye 2fa_required=true.  No requiere sesión autenticada aún.
    case '2fa-check':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        requerirCsrf();
        checkRateLimit('2fa_check', 5, 120);   // 5 intentos / 2 min
        if (empty($_SESSION['usuario_id'])) jsonError('Sesión no iniciada', 401);
        $body    = getJsonBody();
        $codigo  = trim($body['codigo'] ?? '');
        $usuario = dbRow(
            "SELECT id, rol, totp_activo, totp_secreto FROM usuarios_personal WHERE id = ? AND activo = 1 LIMIT 1",
            [$_SESSION['usuario_id']]
        );
        if (!$usuario) jsonError('Usuario no encontrado', 403);
        if (!verificarYMarcar2FA($usuario, $codigo)) {
            jsonError('Código de verificación incorrecto.', 403);
        }
        jsonSuccess(['verificado' => true, 'csrf' => getCsrfToken()]);
        break;

    // ── 2FA: obtener URL de configuración (QR) ───────────────────
    // Solo admin puede configurar 2FA; devuelve el secreto y la URL QR.
    // El secreto provisional se almacena en sesión hasta que se active.
    case '2fa-setup':
        if ($method !== 'GET') jsonError('Método no permitido', 405);
        $usuario = requerirEmpleado();   // admin y empleado pueden configurar su propio 2FA
        requerirReautenticacion('2fa_setup', 300);
        $secreto = generarSecreto2FA();
        $_SESSION['_2fa_secreto_provisional'] = $secreto;
        $urlQr   = generarUrlQr2FA($secreto, $usuario['correo']);
        jsonSuccess(['secreto' => $secreto, 'qr_url' => $urlQr]);
        break;

    // ── 2FA: activar TOTP tras confirmar el primer código ─────────
    // El usuario escanea el QR y envía el primer código para confirmar
    // que el secreto quedó bien configurado en su app.
    case '2fa-activar':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        requerirCsrf();
        $usuario = requerirEmpleado();
        requerirReautenticacion('2fa_setup', 300);
        $body    = getJsonBody();
        $codigo  = trim($body['codigo'] ?? '');
        $secreto = $_SESSION['_2fa_secreto_provisional'] ?? '';
        if (empty($secreto)) jsonError('No hay configuración de 2FA pendiente. Inicia el proceso desde /2fa-setup.', 400);
        if (!verificarTotp($secreto, $codigo)) {
            jsonError('Código incorrecto. Verifica la hora de tu dispositivo e intenta de nuevo.', 403);
        }
        dbQuery(
            "UPDATE usuarios_personal SET totp_secreto = ?, totp_activo = 1 WHERE id = ?",
            [$secreto, $usuario['id']]
        );
        unset($_SESSION['_2fa_secreto_provisional']);
        $_SESSION['_2fa_verified'] = (int)$usuario['id'];   // ya verificado en esta sesión
        jsonSuccess(['activado' => true, 'mensaje' => 'Autenticación de dos factores activada correctamente.']);
        break;

    // ── 2FA: desactivar (solo admin sobre sí mismo o sobre empleados) ─
    case '2fa-desactivar':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        requerirCsrf();
        $usuario = requerirEmpleado();
        requerirReautenticacion('2fa_desactivar', 300);
        $body       = getJsonBody();
        // Un empleado solo puede desactivar su propia cuenta; admin puede desactivar cualquiera
        $objetivoId = isset($body['usuario_id']) && $usuario['rol'] === 'administrador'
            ? (int)$body['usuario_id']
            : (int)$usuario['id'];
        dbQuery(
            "UPDATE usuarios_personal SET totp_secreto = NULL, totp_activo = 0 WHERE id = ?",
            [$objetivoId]
        );
        if ($objetivoId === (int)$usuario['id']) {
            unset($_SESSION['_2fa_verified']);
        }
        jsonSuccess(['desactivado' => true]);
        break;

    default:
        jsonError('Acción no válida. Opciones: login, logout, verificar, perfil, cliente-login, cliente-registro, cliente-verificar, cliente-logout, 2fa-check, 2fa-setup, 2fa-activar, 2fa-desactivar', 400);
}
