<?php
require_once dirname(__DIR__) . '/includes/config.php';
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Seguimiento de Solicitud – Wooden House</title>
  <meta name="description" content="Consulta el estado de tu pedido, cita o cotización en Wooden House. Ingresa tu número de folio WH-, CIT- o COT- para ver el estado en tiempo real.">
  <link rel="canonical" href="<?= APP_URL ?>/seguimiento">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="./assets/<?= av('css/variables.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/solicitudes.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/theme-toggle.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/animations.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/modal-auth.css') ?>">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <script src="/assets/vendor/lucide-1.55.0.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous" defer></script>
</head>
<body data-site-email="<?= htmlspecialchars(SITE_EMAIL) ?>">

  <div class="header-nav">
    <div class="logo">
      <a href="/inicio" aria-label="Wooden House – ir al inicio" style="display:block;line-height:0;">
        <img src="/assets/img/logo-header.png" alt="Wooden House" style="height:80px;">
      </a>
    </div>
    <div class="nav-links" id="navLinks">
      <a href="/inicio" title="Volver al inicio">Inicio</a>
      <a href="/catalogo" title="Ver todos los muebles y precios">Catálogo</a>
      <a href="/solicitudes" title="Pedir cotización o agendar una cita de medición">Solicitar</a>
      <a href="/carrito" class="cart-icon" aria-label="Ver carrito" title="Ver mi carrito">
        <i data-lucide="shopping-cart"></i> <span class="cart-badge" id="cartCount">0</span>
      </a>
      <button class="btn-cuenta-nav" title="Iniciar sesión o ver mi cuenta">
        <i data-lucide="user"></i> Iniciar sesión
      </button>
    </div>
  </div>

  <main id="contenido-principal">
  <div class="container">
    <h1 class="page-title"><i data-lucide="search"></i> Seguimiento de Solicitud</h1>
    <p class="page-subtitle">
      Consulta el estado de tu pedido, cita o cotización en tiempo real.
    </p>

    <div id="alertMessage" class="alert"></div>

    <div class="tracking-section">

      <div class="tracking-header">
        <div class="tracking-icon-circle">
          <i data-lucide="search"></i>
        </div>
        <h2 class="tracking-title">Consultar Estado de Solicitud</h2>
        <p class="tracking-subtitle">
          Ingresa el número de tu pedido, cotización o cita para ver su estado en tiempo real
        </p>
      </div>

      <div class="tracking-search-box">
        <div class="tracking-input-wrap">
          <i data-lucide="hash" class="tracking-search-icon"></i>
          <input type="text" id="trackingNumber"
            placeholder="WH-2026-000001 · CIT-2026-000001 · COT-2026-000001"
            maxlength="25" autocomplete="off" autocapitalize="characters">
        </div>
        <button class="btn-track" data-call="trackOrder">
          <i data-lucide="search"></i> Buscar
        </button>
      </div>

      <div class="tracking-types-row">
        <div class="tracking-type-chip">
          <i data-lucide="package" style="color:#8b7355;"></i>
          <span><strong>WH-</strong> Pedido</span>
        </div>
        <div class="tracking-type-chip">
          <i data-lucide="calendar-days" style="color:#5b9aad;"></i>
          <span><strong>CIT-</strong> Cita</span>
        </div>
        <div class="tracking-type-chip">
          <i data-lucide="briefcase" style="color:#6aad7a;"></i>
          <span><strong>COT-</strong> Cotización</span>
        </div>
      </div>

      <div class="tracking-hint-box">
        <i data-lucide="mail-open" style="color:var(--color-primary);width:20px;height:20px;stroke-width:1.75;flex-shrink:0;"></i>
        <div>
          <strong style="color:var(--color-text-main);">¿Dónde encuentro mi número?</strong>
          <p style="color:var(--color-text-muted);margin:4px 0 0;font-size:13px;">
            Te lo enviamos automáticamente por correo al registrar tu pedido, cita o cotización.
          </p>
        </div>
      </div>

      <div id="trackingResult"></div>

    </div>

    <div style="text-align:center;margin-top:32px;padding-bottom:8px;">
      <a href="/solicitudes" class="btn-tab-nav btn-tab-back">
        <i data-lucide="arrow-left"></i> Ir a Solicitar
      </a>
    </div>
  </div>

  <div class="footer">
    <p>&copy; <?= date('Y') ?> Wooden House. Todos los derechos reservados.</p>
    <p style="margin-top: 10px;">Muebles de madera a medida en Guadalajara, Jalisco</p>
    <p style="margin-top: 10px; font-size: 14px;">
      <a href="mailto:<?= SITE_EMAIL ?>" style="color: #8b7355;"><?= SITE_EMAIL ?></a> |
      <a href="tel:<?= sitePhoneDigits() ?>" style="color: #8b7355;"><?= SITE_PHONE ?></a>
    </p>
    <p style="margin-top:8px; font-size:12px;">
      <a href="/terminos" style="color:#8b7355; text-decoration:none;">Términos y Condiciones</a>
      &nbsp;·&nbsp;
      <a href="/privacidad" style="color:#8b7355; text-decoration:none;">Aviso de Privacidad</a>
    </p>
  </div>

  </main>

  <nav class="mobile-bottom-nav" aria-label="Navegación rápida">
    <div class="mobile-bottom-nav-inner">
      <a href="/catalogo" class="mbn-item"><i data-lucide="store"></i><span>Catálogo</span></a>
      <a href="/solicitudes" class="mbn-item"><i data-lucide="receipt"></i><span>Solicitar</span></a>
      <a href="/seguimiento" class="mbn-item mbn-item--active"><i data-lucide="search"></i><span>Seguimiento</span></a>
      <a href="/carrito" class="mbn-item"><span class="mbn-icon-wrap"><i data-lucide="shopping-cart"></i><span class="mbn-cart-badge"></span></span><span>Carrito</span></a>
      <button class="mbn-item" data-auth-action="openMenuMovil"><i data-lucide="user"></i><span>Mi cuenta</span></button>
    </div>
  </nav>

  <script src="./assets/<?= av('js/theme-toggle.js') ?>"></script>
<script src="./assets/<?= av('js/firebase-config.js') ?>"></script>
  <script src="./assets/<?= av('js/modal-auth.js') ?>"></script>
  <script src="./assets/<?= av('js/seguimiento.js') ?>"></script>
  <script src="./assets/<?= av('js/event-delegation.js') ?>"></script>
  <script src="./assets/<?= av('js/animations.js') ?>"></script>
  <script nonce="<?= cspNonce() ?>">
    document.addEventListener('DOMContentLoaded', function () {
      if (window.lucide) window.lucide.createIcons();
    });
  </script>
</body>
</html>
