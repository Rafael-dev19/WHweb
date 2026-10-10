<?php
require_once dirname(__DIR__) . '/includes/config.php';

// ── Guarda: mi cuenta requiere sesión activa ─────────────────────────────────
if (empty($_SESSION['cliente_id'])) {
    if (!empty($_SESSION['_session_expired'])) {
        unset($_SESSION['_session_expired']);
        $_SESSION['_flash'] = ['msg' => 'Tu sesión ha expirado por inactividad. Por favor inicia sesión nuevamente.', 'type' => 'warning'];
    } else {
        $_SESSION['_flash'] = ['msg' => 'Debes iniciar sesión para acceder a tu cuenta.'];
    }
    header('Location: /inicio');
    exit;
}

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Mi Cuenta – Wooden House</title>
  <meta name="description" content="Gestiona tu cuenta en Wooden House. Consulta tu historial de pedidos, cotizaciones y actualiza tus datos personales.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="./assets/<?= av('css/variables.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/styles.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/modal-auth.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/mi-cuenta.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/locked-field.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/theme-toggle.css') ?>">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <script src="/assets/vendor/lucide-1.55.0.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous" defer></script>
</head>
<body>

<!-- ── Header ──────────────────────────────────────────────────── -->
<div class="header-nav">
  <div class="logo">
    <a href="/inicio" aria-label="Wooden House – ir al inicio" style="display:block;line-height:0;">
      <img src="/assets/img/logo-header.png" alt="Wooden House" style="height:80px;">
    </a>
  </div>
  <div class="nav-links" id="navLinks">
    <a href="/inicio" title="Volver al inicio">Inicio</a>
    <a href="/catalogo" title="Ver catálogo de muebles">Catálogo</a>
    <a href="/solicitudes" title="Pedir cotización o agendar una cita de medición">Solicitar</a>
    <a href="/seguimiento" title="Consulta el estado de tu pedido, cita o cotización">Seguimiento</a>
    <a href="/carrito" class="cart-icon" aria-label="Ver carrito" title="Ver mi carrito">
      <i data-lucide="shopping-cart"></i>
    </a>
    <button class="btn-cuenta-nav autenticado" title="Ver mi cuenta">
      <i data-lucide="circle-user"></i> Mi cuenta
    </button>
  </div>
</div>

<!-- ── Main ────────────────────────────────────────────────────── -->
<div class="mc-container" id="mcContainer">

  <main id="contenido-principal">
  <div id="mcLoading" class="mc-loading">
    <div class="mc-spinner"></div>
    <p>Verificando sesión…</p>
  </div>

  <div id="mcNoAuth" style="display:none;" class="mc-noauth">
    <div class="mc-noauth-icon"><i data-lucide="lock"></i></div>
    <h1>Inicia sesión para ver tu cuenta</h1>
    <p>Accede a tu historial de pedidos, cotizaciones y datos personales.</p>
    <button class="btn-mc-primary" data-auth-action="openAndReload">
      <i data-lucide="log-in"></i> Iniciar sesión
    </button>
  </div>

  <div id="mcContent" style="display:none;">

    <div class="mc-profile-header">
      <div class="mc-avatar" id="mcAvatar">U</div>
      <div class="mc-profile-info">
        <h1 class="mc-nombre" id="mcNombre">—</h1>
        <p class="mc-correo" id="mcCorreo">—</p>
        <span class="mc-badge">Cliente registrado</span>
      </div>
      <button class="mc-logout-btn" data-auth-action="logout" title="Cerrar sesión">
        <i data-lucide="log-out"></i> Cerrar sesión
      </button>
    </div>

    <div class="mc-tabs">
      <button class="mc-tab active" data-tab="pedidos" data-call="mcShowTab" data-args='["pedidos"]'>
        <i data-lucide="package"></i> Mis pedidos
      </button>
      <button class="mc-tab" data-tab="perfil" data-call="mcShowTab" data-args='["perfil"]'>
        <i data-lucide="user-pen"></i> Mi perfil
      </button>
    </div>

    <div id="mcTabPedidos" class="mc-tab-content active">
      <div class="mc-section-title">
        <i data-lucide="package"></i> Historial de pedidos
      </div>
      <div id="mcPedidosList">
        <div class="mc-loading-inline"><div class="mc-spinner-sm"></div> Cargando pedidos…</div>
      </div>
    </div>

    <div id="mcTabPerfil" class="mc-tab-content" style="display:none;">
      <div class="mc-section-title">
        <i data-lucide="user-pen"></i> Editar perfil
      </div>
      <div id="mcPerfilAlert" class="mc-alert"></div>
      <p class="mc-form-hint"><i data-lucide="info"></i> Completa tu dirección para agilizar cotizaciones y pedidos — no tendrás que escribirla de nuevo.</p>
      <form id="mcPerfilForm" class="mc-form">
        <div class="row g-3">
          <div class="col-md-6 mc-form-group">
            <label>Nombre completo <span class="mc-req">*</span>
              <span class="mc-tooltip" title="Este nombre aparecerá en tus cotizaciones y pedidos.">
                <i data-lucide="circle-help"></i>
              </span>
            </label>
            <input type="text" id="pfNombre" name="nombre" required minlength="2" maxlength="120">
          </div>
          <div class="col-md-6 mc-form-group">
            <label>Teléfono
              <span class="mc-tooltip" title="Te contactaremos aquí para coordinar entregas o instalación.">
                <i data-lucide="circle-help"></i>
              </span>
            </label>
            <input type="tel" id="pfTelefono" name="telefono" maxlength="20" placeholder="10 dígitos">
          </div>
        </div>
        <div class="mc-form-actions">
          <button type="submit" class="btn-mc-primary" id="btnGuardarPerfil">
            <i data-lucide="save"></i> Guardar cambios
          </button>
        </div>
      </form>

      <div class="mc-section-title" style="margin-top:28px;">
        <i data-lucide="map-pin"></i> Dirección
      </div>
      <p class="mc-form-hint"><i data-lucide="info"></i> Guárdala una vez y la usaremos para tus próximas cotizaciones y pedidos, sin volver a pedírtela.</p>
      <div id="mcDireccionWrap"></div>
    </div>

  </div><!-- /mcContent -->
</div>

<div class="footer">
  <p>© <?= date('Y') ?> Wooden House · Guadalajara, Jalisco</p>
  <p style="margin-top:8px;font-size:14px;">
    <a href="mailto:<?= SITE_EMAIL ?>" style="color:var(--color-primary)"><?= SITE_EMAIL ?></a> |
    <a href="tel:<?= sitePhoneDigits() ?>" style="color:var(--color-primary)"><?= SITE_PHONE ?></a>
  </p>
  <p style="margin-top:8px; font-size:12px;">
    <a href="/terminos" style="color:var(--color-primary); text-decoration:none;">Términos y Condiciones</a>
    &nbsp;·&nbsp;
    <a href="/privacidad" style="color:var(--color-primary); text-decoration:none;">Aviso de Privacidad</a>
  </p>
</div>

  </main>

<nav class="mobile-bottom-nav" aria-label="Navegación rápida">
  <div class="mobile-bottom-nav-inner">
    <a href="/catalogo" class="mbn-item"><i data-lucide="store"></i><span>Catálogo</span></a>
    <a href="/solicitudes" class="mbn-item"><i data-lucide="receipt"></i><span>Solicitar</span></a>
    <a href="/seguimiento" class="mbn-item"><i data-lucide="search"></i><span>Seguimiento</span></a>
    <a href="/carrito" class="mbn-item"><span class="mbn-icon-wrap"><i data-lucide="shopping-cart"></i><span class="mbn-cart-badge"></span></span><span>Carrito</span></a>
    <button class="mbn-item mbn-item--active" data-auth-action="openMenuMovil"><i data-lucide="user"></i><span>Mi cuenta</span></button>
  </div>
</nav>
<script src="./assets/<?= av('js/theme-toggle.js') ?>"></script>
<script src="./assets/<?= av('js/firebase-config.js') ?>"></script>
<script src="./assets/<?= av('js/modal-auth.js') ?>"></script>
<script src="./assets/<?= av('js/maps-picker.js') ?>"></script>
<script src="./assets/<?= av('js/locked-field.js') ?>"></script>
<script src="./assets/<?= av('js/mi-cuenta.js') ?>"></script>
<script src="./assets/<?= av('js/event-delegation.js') ?>"></script>
<script src="./assets/<?= av('js/animations.js') ?>"></script>
<?php if (defined('GOOGLE_MAPS_API_KEY') && GOOGLE_MAPS_API_KEY): ?>
<script src="https://maps.googleapis.com/maps/api/js?key=<?= htmlspecialchars(GOOGLE_MAPS_API_KEY) ?>&libraries=places&callback=initMapsPickerReady&loading=async" async defer></script>
<?php endif; ?>
<script nonce="<?= cspNonce() ?>">
  document.addEventListener('DOMContentLoaded', function () {
    if (window.lucide) window.lucide.createIcons();
  });
</script>
</body>
</html>
