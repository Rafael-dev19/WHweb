<?php
header('Content-Type: text/html; charset=utf-8');
require_once dirname(__DIR__) . '/includes/assets.php';
require_once dirname(__DIR__) . '/includes/env.php';
require_once dirname(__DIR__) . '/includes/csp.php';
enviarCabeceraCSP();
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Catálogo - Wooden House</title>
  <meta name="description" content="Catálogo 2026 de muebles de baño Wooden House: 7 modelos personalizables de 60 a 120 cm, con ovalín, monomando y herrajes de cierre lento. Cocinas y clósets a la medida bajo cotización.">
  <link rel="canonical" href="<?= APP_URL ?>/catalogo">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="./assets/<?= av('css/variables.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/styles.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/catalogo.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/theme-toggle.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/modal-auth.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/animations.css') ?>">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous" defer></script>
  <script src="/assets/vendor/lucide-1.55.0.min.js" defer></script>
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
      <a href="/solicitudes" title="Pedir cotización o agendar una cita de medición">Solicitar</a>
      <a href="/seguimiento" title="Consulta el estado de tu pedido, cita o cotización">Seguimiento</a>
      <a href="/carrito" class="cart-icon" id="cartIcon" title="Ver mi carrito de compras">
        <i data-lucide="shopping-cart"></i> <span class="cart-badge" id="cartCount">0</span>
      </a>
      <button class="btn-cuenta-nav" title="Iniciar sesión o ver mi cuenta">
        <i data-lucide="user"></i> Iniciar sesión
      </button>
    </div>
  </div>

  <main id="contenido-principal">
  <div class="container">
    <h1 class="page-title">Catálogo de Muebles de Baño</h1>
    <p class="catalogo-intro">7 diseños, cada uno personalizable a la medida (60 a 120 cm). Cocinas y clósets los diseñamos a tu medida <a href="/solicitudes">bajo cotización</a>.</p>

    <div class="catalog-main-categories" id="categoriasMain">
      <button class="main-cat-btn active" data-main-cat="banos">
        <i data-lucide="bath"></i>
        <span>Baños</span>
      </button>
      <button class="main-cat-btn" data-main-cat="cocinas">
        <i data-lucide="cooking-pot"></i>
        <span>Cocinas · a la medida</span>
      </button>
      <button class="main-cat-btn" data-main-cat="closets">
        <i data-lucide="shirt"></i>
        <span>Clósets · a la medida</span>
      </button>
    </div>

    <div class="d-flex flex-wrap gap-4 align-items-center justify-content-between catalog-header">
      <div class="search-bar">
        <input type="text" id="buscar-producto" placeholder="Buscar por nombre, características...">
        <button id="btn-buscar" class="btn-buscar"><i data-lucide="search"></i> Buscar</button>
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

    <?php require_once dirname(__DIR__) . '/includes/accesorios.php'; ?>
    <!-- ══ Accesorios y personalización (catálogo 2026, págs. 10-14) ══ -->
    <section class="accesorios-seccion" id="accesoriosSeccion" aria-labelledby="accTitulo">
      <h2 class="accesorios-titulo" id="accTitulo">Accesorios y personalización</h2>
      <p class="accesorios-intro">El ovalín y el monomando ya vienen incluidos en el precio de tu mueble: tú eliges cuál al agregarlo al carrito.</p>

      <div class="acc-grid">
        <article class="acc-card">
          <a href="/assets/img/catalogo/ovalines.jpg" data-lightbox class="acc-img"><img src="/assets/img/catalogo/ovalines.jpg" alt="Ovalines disponibles" loading="lazy"></a>
          <div class="acc-body">
            <h3><i data-lucide="droplets"></i> Ovalines</h3>
            <p>12 modelos de cerámica incluidos en el paquete. Los importados o premium pueden tener un ajuste.</p>
            <details><summary>Ver medidas</summary>
              <ul class="acc-lista"><?php foreach (WH_OVALINES as $o): if ($o['linea'] !== 'incluido') continue; ?>
                <li><strong><?= htmlspecialchars($o['codigo']) ?></strong> <?= htmlspecialchars($o['medidas']) ?></li>
              <?php endforeach; ?></ul>
            </details>
          </div>
        </article>

        <article class="acc-card">
          <a href="/assets/img/catalogo/ovalines-economicos.jpg" data-lightbox class="acc-img"><img src="/assets/img/catalogo/ovalines-economicos.jpg" alt="Ovalines línea económica" loading="lazy"></a>
          <div class="acc-body">
            <h3><i data-lucide="piggy-bank"></i> Línea económica</h3>
            <p>Misma calidad estructural con acabados más sencillos. Ideal para baños secundarios o presupuesto ajustado.</p>
            <details><summary>Ver medidas</summary>
              <ul class="acc-lista"><?php foreach (WH_OVALINES as $o): if ($o['linea'] !== 'economica') continue; ?>
                <li><strong><?= htmlspecialchars($o['codigo']) ?></strong> <?= htmlspecialchars($o['medidas']) ?></li>
              <?php endforeach; ?></ul>
            </details>
          </div>
        </article>

        <article class="acc-card">
          <a href="/assets/img/catalogo/monomandos.jpg" data-lightbox class="acc-img"><img src="/assets/img/catalogo/monomandos.jpg" alt="Monomandos disponibles" loading="lazy"></a>
          <div class="acc-body">
            <h3><i data-lucide="droplet"></i> Monomandos</h3>
            <p>Plateado, negro mate o dorado — tú eliges. Incluidos en el paquete; los dorados premium pueden tener un ajuste.</p>
            <details><summary>Ver modelos</summary>
              <ul class="acc-lista"><?php foreach (WH_MONOMANDOS as $m): ?>
                <li><strong><?= htmlspecialchars($m['codigo']) ?></strong> <?= htmlspecialchars($m['acabado']) ?></li>
              <?php endforeach; ?></ul>
            </details>
          </div>
        </article>
      </div>

      <div class="acc-dos">
        <div class="acc-card acc-card--texto">
          <h3><i data-lucide="gem"></i> Cubiertas de piedra</h3>
          <p>Lleva cualquier modelo al siguiente nivel. Se entregan cortadas, pulidas e instaladas (incluye hueco para ovalín).</p>
          <ul class="acc-precios">
            <li><span>Granito</span><strong>$<?= number_format(WH_CUBIERTAS_ML['granito']) ?> / metro lineal</strong></li>
            <li><span>Mármol</span><strong>$<?= number_format(WH_CUBIERTAS_ML['marmol']) ?> / metro lineal</strong></li>
            <li><span>Cuarzo</span><strong>$<?= number_format(WH_CUBIERTAS_ML['cuarzo']) ?> / metro lineal</strong></li>
          </ul>
          <p class="acc-mini">Para un mueble de 1 metro considera aprox. 1.2 m de cubierta (frente y laterales). <a href="/solicitudes">Cotízala aquí</a>.</p>
        </div>
        <div class="acc-card acc-card--texto">
          <h3><i data-lucide="sliders-horizontal"></i> Adicionales</h3>
          <p>Hazlo totalmente tuyo. Los eliges en la ficha de cada modelo:</p>
          <ul class="acc-precios">
            <?php foreach (WH_ADICIONALES as $a): ?>
              <li><span><?= htmlspecialchars($a['nombre']) ?> <small><?= htmlspecialchars($a['detalle']) ?></small></span><strong>+$<?= number_format($a['precio']) ?></strong></li>
            <?php endforeach; ?>
            <li><span>Espejo con LED <small>Varios tamaños</small></span><strong>Desde $1,500</strong></li>
            <li><span>Color o acabado especial</span><strong>Consultar</strong></li>
          </ul>
          <p class="acc-mini">¿Una idea 100% a medida? Te la diseñamos en 3D sin costo para proyectos confirmados con anticipo. <a href="/solicitudes">Pide tu cotización</a>.</p>
        </div>
      </div>
    </section>
  </div>

  <div class="footer">
    <p>&copy; <?= date('Y') ?> Wooden House. Todos los derechos reservados.</p>
    <p style="margin-top:10px;">Muebles de madera a medida en Guadalajara, Jalisco</p>
    <p style="margin-top:10px; font-size:14px;">
      <a href="mailto:<?= SITE_EMAIL ?>" style="color:#8b7355;"><?= SITE_EMAIL ?></a> |
      <a href="tel:<?= sitePhoneDigits() ?>" style="color:#8b7355;"><?= SITE_PHONE ?></a>
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
      <a href="/catalogo" class="mbn-item mbn-item--active"><i data-lucide="store"></i><span>Catálogo</span></a>
      <a href="/solicitudes" class="mbn-item"><i data-lucide="receipt"></i><span>Solicitar</span></a>
      <a href="/seguimiento" class="mbn-item"><i data-lucide="search"></i><span>Seguimiento</span></a>
      <a href="/carrito" class="mbn-item"><span class="mbn-icon-wrap"><i data-lucide="shopping-cart"></i><span class="mbn-cart-badge"></span></span><span>Carrito</span></a>
      <button class="mbn-item" data-auth-action="openMenuMovil"><i data-lucide="user"></i><span>Mi cuenta</span></button>
    </div>
  </nav>

  <!-- ══ GUÍA FLOTANTE "¿Cómo comprar?" ══════════════════════════════ -->
  <button class="wh-guide-btn" id="whGuideBtn" aria-label="¿Cómo comprar?" data-open-modal="whGuideCatModal">
    <i data-lucide="circle-help"></i>
    <span class="wh-guide-btn-label">¿Cómo comprar?</span>
  </button>

  <div class="wh-guide-modal" id="whGuideCatModal">
    <div class="wh-guide-content" role="dialog" aria-modal="true">
      <button class="wh-guide-close" data-close-modal="whGuideCatModal" aria-label="Cerrar">×</button>
      <h2 class="wh-guide-title"><i data-lucide="shopping-cart"></i> ¿Cómo comprar?</h2>
      <p class="wh-guide-subtitle">Estás en el catálogo. Aquí puedes ver todos los muebles:</p>
      <div class="wh-guide-steps">
        <div class="wh-guide-step">
          <div class="wh-step-num">1</div>
          <div class="wh-step-icon"><i data-lucide="search"></i></div>
          <div class="wh-step-info">
            <strong>Elige tu modelo y su ancho</strong>
            <span>Abre el modelo, elige el ancho que quepa en tu baño (60 a 120 cm) y el precio se ajusta solo</span>
          </div>
        </div>
        <div class="wh-guide-step">
          <div class="wh-step-num">2</div>
          <div class="wh-step-icon"><i data-lucide="shopping-cart"></i></div>
          <div class="wh-step-info">
            <strong>Haz clic en "Agregar al carrito"</strong>
            <span>Puedes agregar varios productos antes de pagar</span>
          </div>
        </div>
        <div class="wh-guide-step">
          <div class="wh-step-num">3</div>
          <div class="wh-step-icon"><i data-lucide="user-plus"></i></div>
          <div class="wh-step-info">
            <strong>Crea tu cuenta o inicia sesión</strong>
            <span>Necesitas una cuenta gratis para finalizar la compra</span>
          </div>
        </div>
        <div class="wh-guide-step">
          <div class="wh-step-num">4</div>
          <div class="wh-step-icon"><i data-lucide="credit-card"></i></div>
          <div class="wh-step-info">
            <strong>Paga y recibe tu número de pedido</strong>
            <span>Con ese número puedes rastrear tu pedido en cualquier momento</span>
          </div>
        </div>
      </div>
      <div class="wh-guide-actions">
        <a href="/solicitudes" class="wh-guide-cta wh-guide-cta--alt" data-close-modal="whGuideCatModal">
          <i data-lucide="receipt"></i> ¿Prefiero cotizar primero
        </a>
      </div>
      <p class="wh-guide-note"><i data-lucide="info"></i> ¿Otra medida, cubierta de piedra, una cocina o un clóset? Pide una cotización gratis</p>
    </div>
  </div>

  <script src="./assets/<?= av('js/theme-toggle.js') ?>"></script>
<script src="./assets/<?= av('js/firebase-config.js') ?>"></script>
  <script src="./assets/<?= av('js/modal-auth.js') ?>"></script>
  <script src="./assets/<?= av('js/catalogo.js') ?>"></script>
  <script src="./assets/<?= av('js/event-delegation.js') ?>"></script>
  <script src="./assets/<?= av('js/page-init.js') ?>"></script>
  <script src="./assets/<?= av('js/animations.js') ?>"></script>
  <script nonce="<?= cspNonce() ?>">
    document.addEventListener('DOMContentLoaded', function () {
      if (window.lucide) window.lucide.createIcons();
    });
  </script>
</body>
</html>