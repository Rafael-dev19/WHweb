<?php
header('Content-Type: text/html; charset=utf-8');
require_once dirname(__DIR__) . '/includes/assets.php';
require_once dirname(__DIR__) . '/includes/env.php';
require_once dirname(__DIR__) . '/includes/csp.php';
enviarCabeceraCSP();
require_once dirname(__DIR__) . '/includes/db.php';

// Devolver 404 real cuando el producto no existe/no está activo — sin esto
// la página siempre respondía 200 aunque mostrara "no encontrado" solo por
// JS, lo que Google reporta como "soft 404" y evita que se indexe bien.
$_prodId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($_prodId > 0) {
    $_prodExiste = dbRow("SELECT id FROM productos WHERE id = ? AND activo = 1 LIMIT 1", [$_prodId]);
    if (!$_prodExiste) {
        http_response_code(404);
    }
} else {
    http_response_code(404);
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title id="pageTitle">Producto - Wooden House</title>
  <meta name="description" content="Descubre los detalles de nuestros muebles de madera artesanales en Wooden House. Características, especificaciones y precio. Fabricación a medida en Guadalajara.">
  <?php if ($_prodId > 0): ?>
  <link rel="canonical" href="<?= APP_URL ?>/detalle/<?= $_prodId ?>">
  <?php endif; ?>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="/assets/<?= av('css/variables.css') ?>">
  <link rel="stylesheet" href="/assets/<?= av('css/styles.css') ?>">
  <link rel="stylesheet" href="/assets/<?= av('css/detalle_producto.css') ?>">
  <link rel="stylesheet" href="/assets/<?= av('css/theme-toggle.css') ?>">
  <link rel="stylesheet" href="/assets/<?= av('css/animations.css') ?>">
  <link rel="stylesheet" href="/assets/<?= av('css/modal-auth.css') ?>">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <script src="/assets/vendor/lucide-1.55.0.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous" defer></script>
</head>
<body>

  <div class="header-nav">
    <div class="logo">
      <a href="/inicio" aria-label="Wooden House – ir al inicio" style="display:block;line-height:0;">
        <img src="/assets/img/logo-header.png" alt="Wooden House" style="height:80px;">
      </a>
    </div>
    <div class="nav-links" id="navLinks">
      <a href="/inicio" title="Volver al inicio">Inicio</a>
      <a href="/catalogo" title="Ver todos los muebles">← Catálogo</a>
      <a href="/solicitudes" title="Pedir cotización o agendar una cita de medición">Solicitar</a>
      <a href="/seguimiento" title="Consulta el estado de tu pedido, cita o cotización">Seguimiento</a>
      <a href="/carrito" class="cart-icon" id="cartIcon" title="Ver mi carrito">
        <i data-lucide="shopping-cart"></i> <span class="cart-badge" id="cartCount">0</span>
      </a>
    </div>
  </div>


  <main id="contenido-principal">
  <div id="loadingState" class="container" style="text-align:center; padding:60px 20px;">
    <div class="spinner-large"></div>
    <p>Cargando producto...</p>
  </div>

  <div id="errorState" class="container" style="display:none; text-align:center; padding:60px 20px;">
    <p><i data-lucide="triangle-alert"></i> Producto no encontrado o no disponible.</p>
    <a href="/catalogo" class="btn-primary" style="display:inline-block;margin-top:15px;">← Volver al catálogo</a>
  </div>

  <div id="page" class="container" style="display:none;">
    <a href="/catalogo" class="btn-back" style="margin-bottom:16px;display:inline-flex;">
      <i data-lucide="arrow-left"></i> Volver al catálogo
    </a>
    <div class="row g-4 mb-5 product-detail" id="productDetail">
      <div class="col-md-6 gallery">
        <div class="main-image" id="mainImageBox">
          <div class="placeholder-img" id="imgPlaceholder"><i data-lucide="tree-pine"></i></div>
          <img id="mainImage" alt="Imagen principal" style="display:none;" data-img-fallback="imgPlaceholder">
        </div>
        <div class="row row-cols-4 g-2 mt-2 thumbnails" id="thumbs"></div>
      </div>

      <div class="col-md-6 product-info">
        <div class="product-header">
          <span id="pCategoria" class="product-category-badge"></span>
          <h1 class="product-title" id="pNombre"></h1>
          <span id="pEtiqueta" class="product-etiqueta" style="display:none;"></span>
        </div>

        <div class="price-large" id="pPrecio">$0</div>
        <div class="price-nota" id="pPrecioNota"></div>


        <div class="stock-indicator" id="pStockIndicador">
          <span id="pStockIcon"><i data-lucide="circle-check"></i></span>
          <span id="pStockText"><strong>Disponible</strong> - Fabricación bajo pedido</span>
          <span class="wh-help" data-tip="Nuestros muebles se fabrican a pedido, por lo que siempre están disponibles. Se producen en 8 días hábiles desde que se confirma tu anticipo.">?</span>
        </div>

        <div class="description" id="pDesc"></div>

        <div class="features-box" id="featuresBox" style="display:none;">
          <h3>Características Principales</h3>
          <div id="pFeatures"></div>
        </div>

        <div class="cart-section">
          <div class="ancho-selector" id="anchoSelector" style="display:none;">
            <div class="ancho-label">
              1. Elige el ancho de tu mueble
              <span class="wh-help" data-tip="Es lo que mide el mueble de izquierda a derecha. Mide el espacio donde irá y elige el ancho que quepa. ¿Necesitas otra medida? Pide una cotización.">?</span>
            </div>
            <div class="ancho-chips" id="anchoChips" role="group" aria-label="Ancho del mueble"></div>
          </div>
          <div class="quantity-selector">
            <span>2. Cantidad:
              <span class="wh-help" data-tip="Selecciona cuántas unidades necesitas. Cada mueble se fabrica individualmente bajo pedido.">?</span>
            </span>
            <button class="quantity-btn" id="btnMinus" type="button" data-call="cambiarCantidad" data-args="[-1]">−</button>
            <input type="number" class="quantity-input" id="cantidad" value="1" min="1" max="99">
            <button class="quantity-btn" id="btnPlus" type="button" data-call="cambiarCantidad" data-args="[1]">+</button>
          </div>
          <div class="accesorios-box" id="accesoriosBox" style="display:none;">
            <div class="ancho-label"><span>3. Elige tus accesorios <small>(incluidos en el precio)</small></span></div>
            <label class="acc-campo">Ovalín
              <select id="selOvalin" class="acc-select"></select>
            </label>
            <a href="/assets/img/catalogo/ovalines.jpg" class="acc-ver" data-lightbox>Ver fotos de ovalines</a> ·
            <a href="/assets/img/catalogo/ovalines-economicos.jpg" class="acc-ver" data-lightbox>Línea económica</a>
            <label class="acc-campo">Monomando
              <select id="selMonomando" class="acc-select"></select>
            </label>
            <a href="/assets/img/catalogo/monomandos.jpg" class="acc-ver" data-lightbox>Ver fotos de monomandos</a>
            <p class="acc-nota">¿No sabes cuál? Déjalo en "Lo elijo con un asesor" y lo vemos contigo antes de fabricar. Los dorados premium pueden tener un ajuste de precio.</p>
          </div>

          <div class="accesorios-box" id="adicionalesBox" style="display:none;">
            <div class="ancho-label"><span><span id="adicionalesPaso">4</span>. Adicionales <small>(opcional)</small></span></div>
            <div id="adicionalesLista" class="adic-lista"></div>
          </div>

          <button class="btn-add-cart" id="btnAddCart" type="button"><i data-lucide="shopping-cart"></i> Agregar al Carrito</button>
          <a href="/carrito" class="btn-ver-carrito" style="display:none;" id="btnVerCarrito">Ver Carrito →</a>
          <div class="shipping-note">
            <i data-lucide="truck"></i> Envíos en ZMG · Instalación profesional por <?= '$' . number_format(COSTO_INSTALACION, 0) ?> adicionales
            <span class="wh-help wh-help--left" data-tip="Entregamos en toda la Zona Metropolitana de Guadalajara. La instalación (2 personas, herramienta y garantía) la eliges en el carrito.">?</span>
          </div>
          <div class="personaliza-box">
            <strong><i data-lucide="gem"></i> ¿Lo quieres con cubierta de piedra u otra medida?</strong>
            <p>Granito o mármol desde $3,800 y cuarzo desde $4,800 por metro lineal (cortada, pulida e instalada). También hacemos cualquier modelo a la medida, con más cajones, otro color o espejo LED.</p>
            <a href="/solicitudes" class="personaliza-link">Pedir cotización sin costo →</a>
          </div>
        </div>
      </div>
    </div>

    <div class="tabs">
      <div class="tabs-header">
        <button class="tab-button active" data-tab="tab-especificaciones" type="button"><i data-lucide="clipboard-list"></i> Especificaciones</button>
        <button class="tab-button" data-tab="tab-delivery" type="button"><i data-lucide="truck"></i> Entrega e Instalación</button>
      </div>

      <div id="tab-especificaciones" class="tab-pane active">
        <h3>Especificaciones Técnicas</h3>
        <div id="specTable" class="spec-table"></div>
      </div>

      <div id="tab-delivery" class="tab-pane">
        <h3>Información de Entrega</h3>
        <ul>
          <li><strong>Tiempo de fabricación:</strong> 8 días hábiles desde que se confirma tu anticipo</li>
          <li><strong>Forma de pago:</strong> 50% de anticipo para apartar tu producción y 50% contra entrega</li>
          <li><strong>Entrega a domicilio:</strong> Zona Metropolitana de Guadalajara<?= COSTO_ENVIO > 0 ? ' ($' . number_format(COSTO_ENVIO, 0) . ')' : ' sin costo de flete' ?>. Zonas foráneas de Jalisco (Tapalpa, Mazamitla…) con flete cotizado según la distancia</li>
          <li><strong>Recoger en el taller:</strong> Sin costo — <?= htmlspecialchars(SITE_ADDRESS) ?></li>
          <li><strong>Instalación profesional:</strong> <?= '$' . number_format(COSTO_INSTALACION, 0) ?> por mueble (2 personas, herramienta y garantía)</li>
          <li><strong>Garantía:</strong> 1 año en la estructura del mueble y herrajes</li>
        </ul>
        <p>¿Tienes dudas? <a href="/solicitudes">Solicita una cotización personalizada</a></p>
      </div>
    </div>

    <div class="related-section">
      <h2>Más Productos</h2>
      <div class="related-grid" id="relacionados"></div>
    </div>
  </div>

  </main>

  <nav class="mobile-bottom-nav" aria-label="Navegación rápida">
    <div class="mobile-bottom-nav-inner">
      <a href="/catalogo" class="mbn-item mbn-item--active"><i data-lucide="store"></i><span>Catálogo</span></a>
      <a href="/solicitudes" class="mbn-item"><i data-lucide="receipt"></i><span>Solicitar</span></a>
      <a href="/seguimiento" class="mbn-item"><i data-lucide="search"></i><span>Seguimiento</span></a>
      <a href="/carrito" class="mbn-item"><span class="mbn-icon-wrap"><i data-lucide="shopping-cart"></i><span class="mbn-cart-badge"></span></span><span>Carrito</span></a>
      <button class="mbn-item" data-auth-action="openMenuMovil"><i data-lucide="user"></i><span>Mi cuenta</span></button>
    </div>
  </nav>

  <script src="/assets/<?= av('js/theme-toggle.js') ?>"></script>
<script src="/assets/<?= av('js/firebase-config.js') ?>"></script>
  <script src="/assets/<?= av('js/modal-auth.js') ?>"></script>
  <?php require_once dirname(__DIR__) . '/includes/accesorios.php'; ?>
  <script nonce="<?= cspNonce() ?>">window.WH_ACCESORIOS = <?= json_encode(whAccesoriosParaJs(), JSON_UNESCAPED_UNICODE) ?>;</script>
  <script src="/assets/<?= av('js/detalle_producto.js') ?>"></script>
  <script src="/assets/<?= av('js/event-delegation.js') ?>"></script>
  <script src="/assets/<?= av('js/animations.js') ?>"></script>
  <script nonce="<?= cspNonce() ?>">
    document.addEventListener('DOMContentLoaded', function () {
      if (window.lucide) window.lucide.createIcons();
    });
  </script>
</body>
</html>