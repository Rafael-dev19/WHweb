<?php header('Content-Type: text/html; charset=utf-8'); ?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Catálogo - Wooden House</title>
  <meta name="description" content="Explora el catálogo completo de Wooden House. Muebles de madera artesanales: cocinas, clósets, muebles de baño y más. Encuentra el mueble perfecto para tu hogar.">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="./assets/css/variables.css">
  <link rel="stylesheet" href="./assets/css/styles.css?v=4">
  <link rel="stylesheet" href="./assets/css/catalogo.css?v=6">
  <link rel="stylesheet" href="./assets/css/modal-auth.css?v=4">
  <link rel="stylesheet" href="./assets/css/animations.css">
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
      <a href="/solicitudes" title="Pedir cotización o agendar una cita de medición">
        <span class="nav-link-desc">Cotización y Citas<small>Pide precio o agenda visita</small></span>
      </a>
      <a href="/carrito" class="cart-icon" id="cartIcon" title="Ver mi carrito de compras">
        <i class="fa-solid fa-cart-shopping"></i> <span class="cart-badge" id="cartCount">0</span>
      </a>
      <button class="btn-cuenta-nav" title="Iniciar sesión o ver mi cuenta">
        <i class="fa-solid fa-user"></i> Iniciar sesión
      </button>
    </div>
  </div>

  <main id="contenido-principal">
  <div class="container">
    <h1 class="page-title">Catálogo de Muebles de Madera</h1>

    <div class="d-flex flex-wrap gap-4 align-items-center justify-content-between catalog-header">
      <div class="search-bar">
        <input type="text" id="buscar-producto" placeholder="Buscar por nombre, características...">
        <button id="btn-buscar" class="btn-buscar"><i class="fa-solid fa-magnifying-glass"></i> Buscar</button>
        <span class="wh-help" data-tip="Busca por nombre del mueble, material (madera, MDF…) o característica. Puedes combinar palabras.">?</span>
      </div>

      <div class="d-flex align-items-center flex-wrap gap-3 filters-row">
        <div id="categorias-filtro" class="d-flex flex-wrap gap-2 filters">
          <button class="filter-btn active" data-cat-filter="">Todos</button>
        </div>
        <div style="display:flex;align-items:center;gap:4px;">
          <select id="ordenar-por" class="select-ordenar">
            <option value="recientes">Más recientes</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
            <option value="nombre">Nombre A-Z</option>
          </select>
          <span class="wh-help" data-tip="Cambia el orden en que se muestran los productos. El filtro de categoría y la búsqueda se aplican en conjunto.">?</span>
        </div>
      </div>
    </div>

    <div class="catalogo-meta">
      <span id="productos-count">Cargando productos...</span>
    </div>

    <div class="product-grid" id="productos-grid">
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Cargando productos...</p>
      </div>
    </div>

    <div id="paginacion-container" class="paginacion"></div>
  </div>

  <div class="footer">
    <p>&copy; 2026 Wooden House. Todos los derechos reservados.</p>
    <p style="margin-top:10px;">Muebles de madera a medida en Guadalajara, Jalisco</p>
    <p style="margin-top:10px; font-size:14px;">
      <a href="mailto:ventas@muebleswh.com" style="color:#8b7355;">ventas@muebleswh.com</a> |
      <a href="tel:3317054017" style="color:#8b7355;">33 1705 4017</a>
    </p>
    <p style="margin-top:8px; font-size:12px;">
      <a href="/terminos" style="color:#8b7355; text-decoration:none;">Términos y Condiciones</a>
      &nbsp;·&nbsp;
      <a href="/terminos#privacidad" style="color:#8b7355; text-decoration:none;">Aviso de Privacidad</a>
    </p>
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

  <!-- ══ GUÍA FLOTANTE "¿Cómo comprar?" ══════════════════════════════ -->
  <button class="wh-guide-btn" id="whGuideBtn" aria-label="¿Cómo comprar?" data-open-modal="whGuideCatModal">
    <i class="fa-solid fa-circle-question"></i>
    <span class="wh-guide-btn-label">¿Cómo comprar?</span>
  </button>

  <div class="wh-guide-modal" id="whGuideCatModal">
    <div class="wh-guide-content" role="dialog" aria-modal="true">
      <button class="wh-guide-close" data-close-modal="whGuideCatModal" aria-label="Cerrar">×</button>
      <h2 class="wh-guide-title"><i class="fa-solid fa-cart-shopping"></i> ¿Cómo comprar?</h2>
      <p class="wh-guide-subtitle">Estás en el catálogo. Aquí puedes ver todos los muebles:</p>
      <div class="wh-guide-steps">
        <div class="wh-guide-step">
          <div class="wh-step-num">1</div>
          <div class="wh-step-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
          <div class="wh-step-info">
            <strong>Busca el mueble que quieres</strong>
            <span>Usa la barra de búsqueda o los filtros de categoría de arriba</span>
          </div>
        </div>
        <div class="wh-guide-step">
          <div class="wh-step-num">2</div>
          <div class="wh-step-icon"><i class="fa-solid fa-cart-plus"></i></div>
          <div class="wh-step-info">
            <strong>Haz clic en "Agregar al carrito"</strong>
            <span>Puedes agregar varios productos antes de pagar</span>
          </div>
        </div>
        <div class="wh-guide-step">
          <div class="wh-step-num">3</div>
          <div class="wh-step-icon"><i class="fa-solid fa-user-plus"></i></div>
          <div class="wh-step-info">
            <strong>Crea tu cuenta o inicia sesión</strong>
            <span>Necesitas una cuenta gratis para finalizar la compra</span>
          </div>
        </div>
        <div class="wh-guide-step">
          <div class="wh-step-num">4</div>
          <div class="wh-step-icon"><i class="fa-solid fa-credit-card"></i></div>
          <div class="wh-step-info">
            <strong>Paga y recibe tu número de pedido</strong>
            <span>Con ese número puedes rastrear tu pedido en cualquier momento</span>
          </div>
        </div>
      </div>
      <div class="wh-guide-actions">
        <a href="/solicitudes" class="wh-guide-cta wh-guide-cta--alt" data-close-modal="whGuideCatModal">
          <i class="fa-solid fa-file-invoice"></i> ¿Prefiero cotizar primero
        </a>
      </div>
      <p class="wh-guide-note"><i class="fa-solid fa-circle-info"></i> Si no sabes el precio exacto o quieres medidas especiales, pide una cotización gratis</p>
    </div>
  </div>

  </main>
  <script src="./assets/js/firebase-config.js"></script>
  <script src="./assets/js/modal-auth.js?v=9"></script>
  <script src="./assets/js/catalogo.js?v=2"></script>
  <script src="./assets/js/event-delegation.js"></script>
  <script src="./assets/js/page-init.js"></script>
  <script src="./assets/js/animations.js"></script>
</body>
</html>