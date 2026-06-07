<?php header('Content-Type: text/html; charset=utf-8'); ?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title id="pageTitle">Producto - Wooden House</title>
  <meta name="description" content="Descubre los detalles de nuestros muebles de madera artesanales en Wooden House. Características, especificaciones y precio. Fabricación a medida en Guadalajara.">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="/assets/css/variables.css">
  <link rel="stylesheet" href="/assets/css/styles.css?v=4">
  <link rel="stylesheet" href="/assets/css/detalle_producto.css?v=2">
  <link rel="stylesheet" href="/assets/css/animations.css">
  <link rel="stylesheet" href="/assets/css/modal-auth.css?v=4">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
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
      <a href="/solicitudes" title="Pedir cotización o agendar una cita de medición">
        <span class="nav-link-desc">Cotización y Citas<small>Pide precio o agenda visita</small></span>
      </a>
      <a href="/carrito" class="cart-icon" id="cartIcon" title="Ver mi carrito">
        <i class="fa-solid fa-cart-shopping"></i> <span class="cart-badge" id="cartCount">0</span>
      </a>
    </div>
  </div>


  <main id="contenido-principal">
  <div id="loadingState" class="container" style="text-align:center; padding:60px 20px;">
    <div class="spinner-large"></div>
    <p>Cargando producto...</p>
  </div>

  <div id="errorState" class="container" style="display:none; text-align:center; padding:60px 20px;">
    <p><i class="fa-solid fa-triangle-exclamation"></i> Producto no encontrado o no disponible.</p>
    <a href="/catalogo" class="btn-primary" style="display:inline-block;margin-top:15px;">← Volver al catálogo</a>
  </div>

  <div id="page" class="container" style="display:none;">
    <a href="/catalogo" class="btn-back" style="margin-bottom:16px;display:inline-flex;">
      <i class="fa-solid fa-arrow-left"></i> Volver al catálogo
    </a>
    <div class="row g-4 mb-5 product-detail" id="productDetail">
      <div class="col-md-6 gallery">
        <div class="main-image" id="mainImageBox">
          <div class="placeholder-img" id="imgPlaceholder"><i class="fa-solid fa-tree"></i></div>
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

        <div class="stock-indicator" id="pStockIndicador">
          <span id="pStockIcon"><i class="fa-solid fa-circle-check"></i></span>
          <span id="pStockText"><strong>Disponible</strong> - Fabricación bajo pedido</span>
          <span class="wh-help" data-tip="Nuestros muebles se fabrican a pedido, por lo que siempre están disponibles. El tiempo de fabricación varía entre 2 y 15 días hábiles según el modelo.">?</span>
        </div>

        <div class="description" id="pDesc"></div>

        <div class="features-box" id="featuresBox" style="display:none;">
          <h3>Características Principales</h3>
          <div id="pFeatures"></div>
        </div>

        <div class="cart-section">
          <div class="quantity-selector">
            <span>Cantidad:
              <span class="wh-help" data-tip="Selecciona cuántas unidades necesitas. Cada mueble se fabrica individualmente bajo pedido.">?</span>
            </span>
            <button class="quantity-btn" id="btnMinus" type="button" data-call="cambiarCantidad" data-args="[-1]">−</button>
            <input type="number" class="quantity-input" id="cantidad" value="1" min="1" max="99">
            <button class="quantity-btn" id="btnPlus" type="button" data-call="cambiarCantidad" data-args="[1]">+</button>
          </div>
          <button class="btn-add-cart" id="btnAddCart" type="button"><i class="fa-solid fa-cart-shopping"></i> Agregar al Carrito</button>
          <a href="/carrito" class="btn-ver-carrito" style="display:none;" id="btnVerCarrito">Ver Carrito →</a>
          <div class="shipping-note">
            <i class="fa-solid fa-truck"></i> Envíos en ZMG · Instalación profesional disponible
            <span class="wh-help wh-help--left" data-tip="Realizamos entregas dentro de la Zona Metropolitana de Guadalajara. La instalación profesional tiene un costo adicional que se muestra en el carrito.">?</span>
          </div>
        </div>
      </div>
    </div>

    <div class="tabs">
      <div class="tabs-header">
        <button class="tab-button active" data-tab="tab-especificaciones" type="button"><i class="fa-solid fa-clipboard-list"></i> Especificaciones</button>
        <button class="tab-button" data-tab="tab-delivery" type="button"><i class="fa-solid fa-truck"></i> Entrega e Instalación</button>
      </div>

      <div id="tab-especificaciones" class="tab-pane active">
        <h3>Especificaciones Técnicas</h3>
        <div id="specTable" class="spec-table"></div>
      </div>

      <div id="tab-delivery" class="tab-pane">
        <h3>Información de Entrega</h3>
        <ul>
          <li><strong>Tiempo de fabricación:</strong> A partir de 2 días hábiles (varía según demanda de producción)</li>
          <li><strong>Entrega a domicilio:</strong> Zona Metropolitana de Guadalajara (costo adicional)</li>
          <li><strong>Recogida en sucursal:</strong> Sin costo adicional</li>
          <li><strong>Instalación profesional:</strong> Disponible con costo adicional</li>
          <li><strong>Garantía:</strong> 1 año en defectos de fabricación</li>
        </ul>
        <p>¿Tienes dudas? <a href="/solicitudes">Solicita una cotización personalizada</a></p>
      </div>
    </div>

    <div class="related-section">
      <h2>Más Productos</h2>
      <div class="related-grid" id="relacionados"></div>
    </div>
  </div>

  <nav class="mobile-bottom-nav" aria-label="Navegación rápida">
    <div class="mobile-bottom-nav-inner">
      <a href="/inicio" class="mbn-item"><i class="fa-solid fa-house"></i><span>Inicio</span></a>
      <a href="/catalogo" class="mbn-item mbn-item--active"><i class="fa-solid fa-store"></i><span>Catálogo</span></a>
      <a href="/solicitudes" class="mbn-item"><i class="fa-solid fa-file-invoice"></i><span>Cotización</span></a>
      <a href="/carrito" class="mbn-item"><span class="mbn-icon-wrap"><i class="fa-solid fa-cart-shopping"></i><span class="mbn-cart-badge"></span></span><span>Carrito</span></a>
      <button class="mbn-item" data-auth-action="openMenuMovil"><i class="fa-solid fa-user"></i><span>Mi cuenta</span></button>
    </div>
  </nav>

  </main>
  <script src="/assets/js/firebase-config.js"></script>
  <script src="/assets/js/modal-auth.js?v=9"></script>
  <script src="/assets/js/detalle_producto.js"></script>
  <script src="/assets/js/event-delegation.js"></script>
  <script src="/assets/js/animations.js"></script>
</body>
</html>