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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mi Cuenta – Wooden House</title>
  <meta name="description" content="Gestiona tu cuenta en Wooden House. Consulta tu historial de pedidos, cotizaciones y actualiza tus datos personales.">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="./assets/css/variables.css">
  <link rel="stylesheet" href="./assets/css/styles.css?v=4">
  <link rel="stylesheet" href="./assets/css/modal-auth.css?v=4">
  <link rel="stylesheet" href="./assets/css/mi-cuenta.css?v=2">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
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
    <a href="/solicitudes" title="Pedir cotización o agendar una cita de medición">
      <span class="nav-link-desc">Cotización y Citas<small>Pide precio o agenda visita</small></span>
    </a>
    <a href="/seguimiento" title="Consulta el estado de tu pedido, cita o cotización">Seguimiento</a>
    <a href="/carrito" class="cart-icon" aria-label="Ver carrito" title="Ver mi carrito">
      <i class="fa-solid fa-cart-shopping"></i>
    </a>
    <button class="btn-cuenta-nav autenticado" title="Ver mi cuenta">
      <i class="fa-solid fa-user-circle"></i> Mi cuenta
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
    <div class="mc-noauth-icon"><i class="fa-solid fa-user-lock"></i></div>
    <h1>Inicia sesión para ver tu cuenta</h1>
    <p>Accede a tu historial de pedidos, cotizaciones y datos personales.</p>
    <button class="btn-mc-primary" data-auth-action="openAndReload">
      <i class="fa-solid fa-right-to-bracket"></i> Iniciar sesión
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
        <i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión
      </button>
    </div>

    <div class="mc-tabs">
      <button class="mc-tab active" data-tab="pedidos" data-call="mcShowTab" data-args='["pedidos"]'>
        <i class="fa-solid fa-box"></i> Mis pedidos
      </button>
      <button class="mc-tab" data-tab="perfil" data-call="mcShowTab" data-args='["perfil"]'>
        <i class="fa-solid fa-user-pen"></i> Mi perfil
      </button>
    </div>

    <div id="mcTabPedidos" class="mc-tab-content active">
      <div class="mc-section-title">
        <i class="fa-solid fa-box"></i> Historial de pedidos
      </div>
      <div id="mcPedidosList">
        <div class="mc-loading-inline"><div class="mc-spinner-sm"></div> Cargando pedidos…</div>
      </div>
    </div>

    <div id="mcTabPerfil" class="mc-tab-content" style="display:none;">
      <div class="mc-section-title">
        <i class="fa-solid fa-user-pen"></i> Editar perfil
      </div>
      <div id="mcPerfilAlert" class="mc-alert"></div>
      <p class="mc-form-hint"><i class="fa-solid fa-circle-info"></i> Completa tu dirección para agilizar cotizaciones y pedidos — no tendrás que escribirla de nuevo.</p>
      <form id="mcPerfilForm" class="mc-form">
        <div class="row g-3">
          <div class="col-md-6 mc-form-group">
            <label>Nombre completo <span class="mc-req">*</span>
              <span class="mc-tooltip" title="Este nombre aparecerá en tus cotizaciones y pedidos.">
                <i class="fa-solid fa-circle-question"></i>
              </span>
            </label>
            <input type="text" id="pfNombre" name="nombre" required minlength="2" maxlength="120">
          </div>
          <div class="col-md-6 mc-form-group">
            <label>Teléfono
              <span class="mc-tooltip" title="Te contactaremos aquí para coordinar entregas o instalación.">
                <i class="fa-solid fa-circle-question"></i>
              </span>
            </label>
            <input type="tel" id="pfTelefono" name="telefono" maxlength="20" placeholder="10 dígitos">
          </div>
          <div class="col-12 mc-form-group">
            <label>Calle y número
              <span class="mc-tooltip" title="Escribe solo la calle y número exterior/interior. La colonia va en el campo siguiente.">
                <i class="fa-solid fa-circle-question"></i>
              </span>
            </label>
            <input type="text" id="pfDireccion" name="direccion" maxlength="255" placeholder="Ej: Av. Lázaro Cárdenas 1234 Int. 5">
          </div>
          <div class="col-md-6 mc-form-group">
            <label>Colonia
              <span class="mc-tooltip" title="Nombre de tu colonia o fraccionamiento.">
                <i class="fa-solid fa-circle-question"></i>
              </span>
            </label>
            <input type="text" id="pfColonia" name="colonia" maxlength="120" placeholder="Ej: Col. Chapalita">
          </div>
          <div class="col-md-6 mc-form-group">
            <label>Municipio / Alcaldía
              <span class="mc-tooltip" title="En Jalisco generalmente es Guadalajara, Zapopan, Tlaquepaque, etc.">
                <i class="fa-solid fa-circle-question"></i>
              </span>
            </label>
            <input type="text" id="pfMunicipio" name="municipio" maxlength="100" placeholder="Ej: Zapopan">
          </div>
          <div class="col-md-6 mc-form-group">
            <label>Ciudad</label>
            <input type="text" id="pfCiudad" name="ciudad" maxlength="100" placeholder="Ej: Guadalajara">
          </div>
          <div class="col-md-6 mc-form-group">
            <label>Código postal
              <span class="mc-tooltip" title="Tu CP de 5 dígitos. Lo usamos para calcular el costo de envío.">
                <i class="fa-solid fa-circle-question"></i>
              </span>
            </label>
            <input type="text" id="pfCP" name="cp" maxlength="10" placeholder="Ej: 45040">
          </div>
        </div>
        <div class="mc-form-actions">
          <button type="submit" class="btn-mc-primary" id="btnGuardarPerfil">
            <i class="fa-solid fa-floppy-disk"></i> Guardar cambios
          </button>
        </div>
      </form>
    </div>

  </div><!-- /mcContent -->
</div>

<div class="footer">
  <p>© 2026 Wooden House · Guadalajara, Jalisco</p>
  <p style="margin-top:8px;font-size:14px;">
    <a href="mailto:ventas@muebleswh.com" style="color:var(--color-primary)">ventas@muebleswh.com</a> |
    <a href="tel:3317054017" style="color:var(--color-primary)">33 1705 4017</a>
  </p>
  <p style="margin-top:8px; font-size:12px;">
    <a href="/terminos" style="color:var(--color-primary); text-decoration:none;">Términos y Condiciones</a>
    &nbsp;·&nbsp;
    <a href="/terminos#privacidad" style="color:var(--color-primary); text-decoration:none;">Aviso de Privacidad</a>
  </p>
</div>

<nav class="mobile-bottom-nav" aria-label="Navegación rápida">
  <div class="mobile-bottom-nav-inner">
    <a href="/catalogo" class="mbn-item"><i class="fa-solid fa-store"></i><span>Catálogo</span></a>
    <a href="/solicitudes" class="mbn-item"><i class="fa-solid fa-file-invoice"></i><span>Solicitar</span></a>
    <a href="/seguimiento" class="mbn-item"><i class="fa-solid fa-magnifying-glass"></i><span>Seguimiento</span></a>
    <a href="/carrito" class="mbn-item"><span class="mbn-icon-wrap"><i class="fa-solid fa-cart-shopping"></i><span class="mbn-cart-badge"></span></span><span>Carrito</span></a>
    <button class="mbn-item mbn-item--active" data-auth-action="openMenuMovil"><i class="fa-solid fa-user"></i><span>Mi cuenta</span></button>
  </div>
</nav>

  </main>
<script src="./assets/js/firebase-config.js"></script>
<script src="./assets/js/modal-auth.js?v=9"></script>
<script src="./assets/js/mi-cuenta.js"></script>
<script src="./assets/js/event-delegation.js"></script>
<script src="./assets/js/animations.js"></script>
</body>
</html>
