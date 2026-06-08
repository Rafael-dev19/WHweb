<?php
require_once dirname(__DIR__) . '/includes/config.php';
// Leer y limpiar el mensaje flash (lo ponen las páginas protegidas al redirigir)
$_flash = null;
if (!empty($_SESSION['_flash'])) {
    $_flash = $_SESSION['_flash'];
    unset($_SESSION['_flash']);
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wooden House - Muebles de Madera a Medida en Guadalajara</title>
  <meta name="description" content="Wooden House — muebles de madera a medida en Guadalajara, Jalisco. Cocinas integrales, clósets, muebles de baño y más. Calidad artesanal con entrega en toda la ZMG.">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="./assets/css/styles.css?v=4">
  <link rel="stylesheet" href="./assets/css/index.css">
  <link rel="stylesheet" href="./assets/css/modal-auth.css?v=4">
  <link rel="stylesheet" href="./assets/css/animations.css">
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous" defer></script>
</head>

<body>

<?php if ($_flash): ?>
  <div class="wh-alerta" id="whAlerta" role="alert">
    <i class="fa-solid fa-triangle-exclamation"></i>
    <span><?= htmlspecialchars($_flash['msg'], ENT_QUOTES, 'UTF-8') ?></span>
    <button class="wh-alerta-cerrar" data-close-parent aria-label="Cerrar">×</button>
  </div>
<?php endif; ?>

  <!-- Header Navigation -->
  <div class="header-nav">
    <div class="logo">
      <a href="/" aria-label="Wooden House – inicio">
        <img src="/assets/img/logo-header.png" alt="Wooden House" style="height:80px;">
      </a>
    </div>

    <nav class="nav-links" id="navLinks" aria-label="Navegación principal">

      <div class="nav-item nav-dropdown" id="navDropdown">
        <button class="nav-dropdown-btn" id="dropdownBtn"
                aria-haspopup="true" aria-expanded="false"
                aria-controls="dropdownMenu">
          Inicio <i class="fa-solid fa-chevron-down nav-chevron"></i>
        </button>
        <div class="dropdown-menu" id="dropdownMenu" role="menu">
          <a href="#servicios" class="dropdown-item" role="menuitem">
            <i class="fa-solid fa-screwdriver-wrench"></i> Servicios
          </a>
          <a href="#proyectos" class="dropdown-item" role="menuitem">
            <i class="fa-solid fa-images"></i> Proyectos
          </a>
          <a href="#contacto" class="dropdown-item" role="menuitem">
            <i class="fa-solid fa-phone"></i> Contacto
          </a>
        </div>
      </div>

      <a href="/catalogo" class="nav-link-item">Catálogo</a>
      <a href="/solicitudes" title="Pedir cotización o agendar una cita de medición">
        <span class="nav-link-desc">Cotización y Citas<small>Pide precio o agenda visita</small></span>
      </a>
      <a href="/seguimiento" title="Consulta el estado de tu pedido, cita o cotización">Seguimiento</a>

      <a href="/carrito" class="cart-icon" id="cartIcon" aria-label="Ver carrito">
        <i class="fa-solid fa-cart-shopping"></i>
        <span class="cart-badge" id="cartCount">0</span>
      </a>

      <!-- Botón de cuenta — modal-auth.js actualiza su estado automáticamente -->
      <button class="btn-cuenta-nav" id="cuentaDropdownBtn" title="Iniciar sesión o ver mi cuenta">
        <i class="fa-solid fa-user"></i> Iniciar sesión
      </button>

    </nav>
  </div>

  <main id="contenido-principal">
  <!-- Hero Section -->
  <div class="hero" id="inicio">
    <h1>WOODEN HOUSE</h1>
    <p class="tagline">Muebles de Madera a Medida | Calidad Artesanal en Guadalajara</p>
    <p style="color:#888; font-size:15px; margin-top:10px;">
      <i class="fa-solid fa-location-dot"></i> Guadalajara, Jalisco · Entregas en toda la ZMG
    </p>
  </div>

  <!-- ── Acciones rápidas ──────────────────────────────────────── -->
  <div class="quick-actions-section">
    <p class="quick-actions-label">¿Qué deseas hacer?</p>
    <div class="wh-info-box" style="margin: 0 auto 16px; max-width:780px;">
      <i class="fa-solid fa-lightbulb"></i>
      <span>
        <strong>¿Primera vez aquí?</strong> — Explora el <strong>Catálogo</strong> para ver modelos y precios.
        Si ya sabes lo que quieres, pide una <strong>Cotización</strong>.
        Si prefieres asesoría en persona, <strong>Agenda una Cita</strong> y vamos a tu domicilio.
      </span>
    </div>
    <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3 quick-actions-grid">
      <div class="col">
        <a href="/catalogo" class="quick-action-card h-100">
          <div class="qa-icon"><i class="fa-solid fa-store"></i></div>
          <div class="qa-info">
            <div class="qa-title">Ver Catálogo</div>
            <div class="qa-sub">Explora nuestros muebles y precios</div>
          </div>
          <i class="fa-solid fa-chevron-right qa-arrow"></i>
        </a>
      </div>
      <div class="col">
        <a href="/solicitudes" class="quick-action-card h-100">
          <div class="qa-icon qa-icon--cot"><i class="fa-solid fa-file-invoice"></i></div>
          <div class="qa-info">
            <div class="qa-title">Pedir Cotización</div>
            <div class="qa-sub">Cuéntanos qué necesitas y te respondemos</div>
          </div>
          <i class="fa-solid fa-chevron-right qa-arrow"></i>
        </a>
      </div>
      <div class="col">
        <a href="/solicitudes#cita" class="quick-action-card h-100">
          <div class="qa-icon qa-icon--cita"><i class="fa-solid fa-calendar-check"></i></div>
          <div class="qa-info">
            <div class="qa-title">Agendar Cita</div>
            <div class="qa-sub">Visítanos o agendamos medición en tu casa</div>
          </div>
          <i class="fa-solid fa-chevron-right qa-arrow"></i>
        </a>
      </div>
      <div class="col">
        <a href="/solicitudes#seguimiento" class="quick-action-card h-100">
          <div class="qa-icon qa-icon--seg"><i class="fa-solid fa-magnifying-glass"></i></div>
          <div class="qa-info">
            <div class="qa-title">Seguimiento de Pedido</div>
            <div class="qa-sub">Consulta el estado de tu pedido o cita</div>
          </div>
          <i class="fa-solid fa-chevron-right qa-arrow"></i>
        </a>
      </div>
    </div>
  </div>

  <div class="container">

    <div class="about-box">
      <h2>¿Quiénes Somos?</h2>
      <p>
        En <strong>Wooden House</strong> nos especializamos en la fabricación de muebles de madera de alta calidad,
        diseñados y construidos a medida para transformar tus espacios. Con más de 10 años de experiencia,
        combinamos tradición artesanal con diseño moderno para crear piezas únicas que se adaptan perfectamente
        a tus necesidades y estilo.
      </p>
      <p>
        Desde cocinas integrales hasta clósets personalizados, cada proyecto es único y refleja nuestra pasión
        por la carpintería de excelencia.
      </p>
    </div>

    <div id="servicios">
      <h2 class="section-title"><i class="fa-solid fa-screwdriver-wrench"></i> Nuestros Servicios</h2>
      <div class="row row-cols-1 row-cols-md-3 g-4 mb-5">
        <div class="col">
          <a href="/catalogo?categoria=cocinas" class="service-card h-100 d-block">
            <div class="service-icon"><i class="fa-solid fa-utensils"></i></div>
            <h3>Cocinas Integrales</h3>
            <p>Diseño y fabricación de cocinas funcionales y elegantes, adaptadas a tu espacio y necesidades. Incluye gabinetes, barras y acabados personalizados.</p>
            <span class="service-card-link">Ver en catálogo →</span>
          </a>
        </div>
        <div class="col">
          <a href="/catalogo?categoria=closets" class="service-card h-100 d-block">
            <div class="service-icon"><i class="fa-solid fa-shirt"></i></div>
            <h3>Clósets a Medida</h3>
            <p>Maximiza tu espacio con clósets diseñados específicamente para ti. Múltiples compartimentos, cajones y opciones de organización.</p>
            <span class="service-card-link">Ver en catálogo →</span>
          </a>
        </div>
        <div class="col">
          <a href="/catalogo?categoria=bano" class="service-card h-100 d-block">
            <div class="service-icon"><i class="fa-solid fa-bath"></i></div>
            <h3>Muebles de Baño</h3>
            <p>Muebles resistentes a la humedad con diseños modernos y clásicos. Incluye lavabo, espejo y almacenamiento optimizado.</p>
            <span class="service-card-link">Ver en catálogo →</span>
          </a>
        </div>
      </div>
    </div>

    <div>
      <h2 class="section-title"><i class="fa-solid fa-star"></i> ¿Por Qué Elegirnos?</h2>
      <div class="row row-cols-1 row-cols-sm-3 g-4 mb-5">
        <div class="col">
          <div class="reason-card h-100">
            <h4><i class="fa-solid fa-palette"></i> Diseño a tu medida</h4>
            <p>Cada mueble es único. Diseñamos y fabricamos desde el concepto hasta la instalación según tus espacios exactos.</p>
          </div>
        </div>
        <div class="col">
          <div class="reason-card h-100">
            <h4><i class="fa-solid fa-tree"></i> Materiales nobles</h4>
            <p>Maderas de primera calidad — pino, cedro, encino, MDF. Durabilidad y belleza garantizada durante años.</p>
          </div>
        </div>
        <div class="col">
          <div class="reason-card h-100">
            <h4><i class="fa-solid fa-shield-halved"></i> Garantía + entrega puntual</h4>
            <p>1 año de garantía contra defectos. Cumplimos los plazos acordados y dejamos todo instalado y limpio.</p>
          </div>
        </div>
      </div>
    </div>

    <div>
      <h2 class="section-title"><i class="fa-solid fa-clipboard-list"></i> Así Funciona</h2>
      <div class="row row-cols-2 row-cols-md-4 g-4 mb-5">
        <div class="col">
          <div class="process-step h-100">
            <div class="process-number">1</div>
            <h4>Consulta o Cita</h4>
            <p>Cuéntanos tu proyecto en línea o agenda una visita a domicilio gratuita</p>
          </div>
        </div>
        <div class="col">
          <div class="process-step h-100">
            <div class="process-number">2</div>
            <h4>Cotización en 24 hrs</h4>
            <p>Recibes propuesta con precio, diseño y plazo de entrega — sin compromiso</p>
          </div>
        </div>
        <div class="col">
          <div class="process-step h-100">
            <div class="process-number">3</div>
            <h4>Fabricación a medida</h4>
            <p>Nuestros artesanos fabrican tu mueble con materiales de calidad</p>
          </div>
        </div>
        <div class="col">
          <a href="/solicitudes" class="process-step h-100 d-block" style="text-decoration:none;color:inherit;">
            <div class="process-number">4</div>
            <h4>Entrega e instalación</h4>
            <p>Instalamos en tu hogar, probamos y dejamos todo perfecto</p>
            <span style="display:block;margin-top:10px;font-size:12px;color:#8b7355;font-weight:600;">Iniciar ahora →</span>
          </a>
        </div>
      </div>
    </div>

    <div id="proyectos">
      <h2 class="section-title"><i class="fa-solid fa-sparkles"></i> Proyectos Realizados</h2>

      <div class="row row-cols-2 row-cols-md-3 g-3 mb-5">

        <div class="col">
          <div class="work-card video-card">
            <video muted loop playsinline preload="none">
              <source data-src="https://firebasestorage.googleapis.com/v0/b/woodenhouse-898de.firebasestorage.app/o/proyectos%2Fproyecto1.mp4?alt=media&token=27da66f5-8a7a-4b2f-aa97-2475947c5cb6" type="video/mp4">
            </video>
          </div>
        </div>

        <div class="col">
          <div class="work-card video-card">
            <video muted loop playsinline preload="none">
              <source data-src="https://firebasestorage.googleapis.com/v0/b/woodenhouse-898de.firebasestorage.app/o/proyectos%2Fproyecto2.mp4?alt=media&token=ba5e5413-3bb3-407c-845b-afc6e113cf50" type="video/mp4">
            </video>
          </div>
        </div>

        <div class="col">
          <div class="work-card video-card">
            <video muted loop playsinline preload="none">
              <source data-src="https://firebasestorage.googleapis.com/v0/b/woodenhouse-898de.firebasestorage.app/o/proyectos%2Fproyecto3.mp4?alt=media&token=859c8549-0c19-4a60-936e-45d1989c0f78" type="video/mp4">
            </video>
          </div>
        </div>

        <div class="col">
          <div class="work-card video-card">
            <video muted loop playsinline preload="none">
              <source data-src="https://firebasestorage.googleapis.com/v0/b/woodenhouse-898de.firebasestorage.app/o/proyectos%2Fproyecto4.mp4?alt=media&token=f513e173-9386-4cfc-b98f-195abd566efd" type="video/mp4">
            </video>
          </div>
        </div>

        <div class="col">
          <div class="work-card video-card">
            <video muted loop playsinline preload="none">
              <source data-src="https://firebasestorage.googleapis.com/v0/b/woodenhouse-898de.firebasestorage.app/o/proyectos%2Fproyecto5.mp4?alt=media&token=a75ea48f-eb33-4b67-969d-6a0c1b3c9dd5" type="video/mp4">
            </video>
          </div>
        </div>

        <div class="col">
          <div class="work-card video-card">
            <video muted loop playsinline preload="none">
              <source data-src="https://firebasestorage.googleapis.com/v0/b/woodenhouse-898de.firebasestorage.app/o/proyectos%2Fproyecto6.mp4?alt=media&token=cf9d54fe-9299-43dd-b79f-3def076921d0" type="video/mp4">
            </video>
          </div>
        </div>

      </div>
    </div>

    <div class="cta-section">
      <h2><i class="fa-solid fa-house"></i> ¿Listo para Transformar tu Espacio?</h2>
      <p>Contáctanos hoy y recibe una cotización personalizada sin compromiso</p>
      <div class="d-flex flex-wrap gap-3 justify-content-center cta-buttons">
        <a href="/solicitudes" class="btn-primary"><i class="fa-solid fa-tag"></i> Solicitar Cotización Gratis</a>
        <a href="#contacto" class="btn-secondary"><i class="fa-solid fa-phone"></i> Contactar Ahora</a>
      </div>
    </div>

    <div class="faq-section">
      <h2 class="section-title"><i class="fa-solid fa-circle-question"></i> Preguntas Frecuentes</h2>

      <div class="faq-item">
        <div class="faq-question">¿Hacen entregas a domicilio?<span class="faq-icon"><i class="fa-solid fa-chevron-down"></i></span></div>
        <div class="faq-answer">Sí, realizamos entregas en toda la Zona Metropolitana de Guadalajara. El costo de envío varía según la ubicación y tamaño del mueble. El tiempo de entrega es de 5-7 días hábiles después de la confirmación del pedido.</div>
      </div>

      <div class="faq-item">
        <div class="faq-question">¿Incluyen instalación profesional?<span class="faq-icon"><i class="fa-solid fa-chevron-down"></i></span></div>
        <div class="faq-answer">Sí, todos nuestros proyectos incluyen instalación profesional. Nuestro equipo técnico especializado se encargará de instalar tu mueble de manera segura, profesional y dejando todo limpio.</div>
      </div>

      <div class="faq-item">
        <div class="faq-question">¿Qué garantía tienen los muebles?<span class="faq-icon"><i class="fa-solid fa-chevron-down"></i></span></div>
        <div class="faq-answer">Todos nuestros muebles cuentan con garantía de 1 año contra defectos de fabricación. Además, ofrecemos 30 días de garantía de satisfacción: si no estás conforme con tu compra, trabajaremos contigo para resolver cualquier inconformidad.</div>
      </div>

      <div class="faq-item">
        <div class="faq-question">¿Puedo ver ejemplos antes de decidir?<span class="faq-icon"><i class="fa-solid fa-chevron-down"></i></span></div>
        <div class="faq-answer">Sí, puedes agendar una cita para visitar nuestro showroom o solicitar que uno de nuestros asesores visite tu hogar con muestras de materiales, acabados y fotos de proyectos anteriores.</div>
      </div>

      <div class="faq-item">
        <div class="faq-question">¿Cuánto tiempo tarda la fabricación?<span class="faq-icon"><i class="fa-solid fa-chevron-down"></i></span></div>
        <div class="faq-answer">Los tiempos varían según la complejidad del proyecto. Generalmente, los muebles personalizados tienen un tiempo de fabricación de 2-4 semanas. Te proporcionaremos un cronograma específico en tu cotización.</div>
      </div>

      <div class="faq-item">
        <div class="faq-question">¿Aceptan pagos en parcialidades?<span class="faq-icon"><i class="fa-solid fa-chevron-down"></i></span></div>
        <div class="faq-answer">Sí, aceptamos pagos a meses sin intereses con tarjetas de crédito participantes: 3, 6, 9 y 12 meses sin intereses en compras mayores a $5,000. También manejamos esquemas de pago: 50% anticipo y 50% al recibir.</div>
      </div>

      <div class="faq-item">
        <div class="faq-question">¿Qué tipo de maderas utilizan?<span class="faq-icon"><i class="fa-solid fa-chevron-down"></i></span></div>
        <div class="faq-answer">Trabajamos con diversas maderas de calidad: pino, encino, cedro, MDF, triplay y melamina. Durante la consulta inicial te asesoraremos sobre el mejor material para tu proyecto según uso, presupuesto y estilo.</div>
      </div>

      <div class="faq-item">
        <div class="faq-question">¿La cotización tiene costo?<span class="faq-icon"><i class="fa-solid fa-chevron-down"></i></span></div>
        <div class="faq-answer">No, la cotización es completamente gratuita y sin compromiso. Incluye visita a domicilio, toma de medidas, diseño preliminar y propuesta detallada con precios transparentes.</div>
      </div>

    </div>

    <div id="contacto">
      <h2 class="section-title"><i class="fa-solid fa-phone"></i> Información de Contacto</h2>
      <div class="row row-cols-1 row-cols-sm-2 g-4 mb-5">
        <div class="col">
          <div class="contact-card h-100">
            <div class="contact-icon"><i class="fa-solid fa-mobile-screen"></i></div>
            <h4>WhatsApp</h4>
            <p><a href="https://wa.me/5213317054017" target="_blank">33 1705 4017</a></p>
            <small>Lun - Sáb: 9:00 AM - 7:00 PM</small>
          </div>
        </div>
        <div class="col">
          <div class="contact-card h-100">
            <div class="contact-icon"><i class="fa-solid fa-envelope"></i></div>
            <h4>Email</h4>
            <p><a href="mailto:ventas@muebleswh.com">ventas@muebleswh.com</a></p>
            <small>Respuesta en 24 hrs</small>
          </div>
        </div>
        <div class="col">
          <div class="contact-card h-100">
            <div class="contact-icon"><i class="fa-solid fa-location-dot"></i></div>
            <h4>Ubicación</h4>
            <p>Guadalajara, Jalisco</p>
            <small>Servicio en toda la ZMG</small>
          </div>
        </div>
        <div class="col">
          <div class="contact-card h-100">
            <div class="contact-icon"><i class="fa-solid fa-clock"></i></div>
            <h4>Horario</h4>
            <p>Lunes a Sábado</p>
            <small>9:00 AM - 7:00 PM</small>
          </div>
        </div>
      </div>
    </div>

    <div class="map-section">
      <h2><i class="fa-solid fa-location-dot"></i> Nuestra Ubicación</h2>
      <p>Servicio de entrega e instalación en toda la Zona Metropolitana de Guadalajara</p>
      <div style="width:100%; height:450px; border-radius:15px; overflow:hidden; margin-top:20px;">
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3734.6659935791336!2d-103.4240335!3d20.601693400000002!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8428acf1f7ece931%3A0xcf2ad0ecc9c0376c!2sIgnacio%20Zaragoza%2C%20Zapopan%2C%20Jal.!5e0!3m2!1ses-419!2smx!4v1771103624242!5m2!1ses-419!2smx"
          width="100%" height="100%" style="border:0;"
          allowfullscreen="" loading="lazy"
          referrerpolicy="no-referrer-when-downgrade">
        </iframe>
      </div>
    </div>

    <div class="social-section">
      <h3><i class="fa-solid fa-globe"></i> Síguenos en Redes Sociales</h3>
      <p style="color:#a0a0a0; margin-bottom:20px;">Mantente al día con nuestros proyectos más recientes</p>
      <div class="d-flex flex-wrap gap-4 justify-content-center social-links">
        <a href="https://www.facebook.com/wh020" class="social-link facebook" title="Facebook" target="_blank">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </a>
        <a href="https://www.instagram.com/pablowooden_" class="social-link instagram" title="Instagram" target="_blank">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        </a>
        <a href="https://wa.me/5213317054017?text=Hola%2C%20me%20interesa%20una%20cotización" class="social-link whatsapp" title="WhatsApp" target="_blank">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
        <a href="https://www.tiktok.com/@pablowooden?is_from_webapp=1&sender_device=pc" class="social-link tiktok" title="TikTok" target="_blank" rel="noopener noreferrer">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z"/>
          </svg>
        </a>
      </div>
    </div>

  </div><!-- /container -->

  </main>
  <footer class="footer">
    <p>&copy; 2026 Wooden House. Todos los derechos reservados.</p>
    <p style="margin-top:10px;">Muebles de madera a medida en Guadalajara, Jalisco</p>
    <p style="margin-top:10px; font-size:14px;">
      <a href="mailto:ventas@muebleswh.com" style="color:#8b7355; text-decoration:none;">ventas@muebleswh.com</a>
    </p>
    <p style="margin-top:8px; font-size:12px;">
      <a href="/terminos" style="color:#8b7355; text-decoration:none;">Términos y Condiciones</a>
      &nbsp;·&nbsp;
      <a href="/terminos#privacidad" style="color:#8b7355; text-decoration:none;">Aviso de Privacidad</a>
    </p>
  </footer>

  <!-- ── Barra de navegación fija móvil ──────────────────────────── -->
  <nav class="mobile-bottom-nav" aria-label="Navegación rápida">
    <div class="mobile-bottom-nav-inner">
      <a href="/catalogo" class="mbn-item"><i class="fa-solid fa-store"></i><span>Catálogo</span></a>
      <a href="/solicitudes" class="mbn-item"><i class="fa-solid fa-file-invoice"></i><span>Solicitar</span></a>
      <a href="/seguimiento" class="mbn-item"><i class="fa-solid fa-magnifying-glass"></i><span>Seguimiento</span></a>
      <a href="/carrito" class="mbn-item"><span class="mbn-icon-wrap"><i class="fa-solid fa-cart-shopping"></i><span class="mbn-cart-badge"></span></span><span>Carrito</span></a>
      <button class="mbn-item" data-auth-action="openMenuMovil"><i class="fa-solid fa-user"></i><span>Mi cuenta</span></button>
    </div>
  </nav>

  <!-- ══ GUÍA FLOTANTE "¿Cómo comprar?" ══════════════════════════════ -->
  <button class="wh-guide-btn" id="whGuideBtn" aria-label="¿Cómo comprar?" data-open-modal="whGuideModal">
    <i class="fa-solid fa-circle-question"></i>
    <span class="wh-guide-btn-label">¿Cómo comprar?</span>
  </button>

  <div class="wh-guide-modal" id="whGuideModal">
    <div class="wh-guide-content" role="dialog" aria-modal="true" aria-labelledby="whGuideHeading">
      <button class="wh-guide-close" data-close-modal="whGuideModal" aria-label="Cerrar">×</button>
      <h2 class="wh-guide-title" id="whGuideHeading"><i class="fa-solid fa-cart-shopping"></i> ¿Cómo comprar?</h2>
      <p class="wh-guide-subtitle">Es muy fácil, sigue estos 4 pasos:</p>
      <div class="wh-guide-steps">
        <div class="wh-guide-step">
          <div class="wh-step-num">1</div>
          <div class="wh-step-icon"><i class="fa-solid fa-store"></i></div>
          <div class="wh-step-info">
            <strong>Explora el catálogo</strong>
            <span>Ve fotos, medidas y precios de todos nuestros muebles</span>
          </div>
        </div>
        <div class="wh-guide-step">
          <div class="wh-step-num">2</div>
          <div class="wh-step-icon"><i class="fa-solid fa-user-plus"></i></div>
          <div class="wh-step-info">
            <strong>Crea tu cuenta gratis</strong>
            <span>Solo necesitas tu correo y una contraseña. ¡Tarda menos de 1 minuto!</span>
          </div>
        </div>
        <div class="wh-guide-step">
          <div class="wh-step-num">3</div>
          <div class="wh-step-icon"><i class="fa-solid fa-cart-plus"></i></div>
          <div class="wh-step-info">
            <strong>Agrega al carrito y pide tu fecha</strong>
            <span>Elige si quieres recoger o envío a domicilio, y si quieres instalación</span>
          </div>
        </div>
        <div class="wh-guide-step">
          <div class="wh-step-num">4</div>
          <div class="wh-step-icon"><i class="fa-solid fa-credit-card"></i></div>
          <div class="wh-step-info">
            <strong>Paga seguro y recibe tu folio</strong>
            <span>Tarjeta o PayPal. Te mandamos confirmación por correo al instante</span>
          </div>
        </div>
      </div>
      <div class="wh-guide-actions">
        <a href="/catalogo" class="wh-guide-cta" data-close-modal="whGuideModal">
          <i class="fa-solid fa-store"></i> Ver Catálogo
        </a>
        <a href="/solicitudes" class="wh-guide-cta wh-guide-cta--alt" data-close-modal="whGuideModal">
          <i class="fa-solid fa-file-invoice"></i> Pedir Cotización
        </a>
      </div>
      <p class="wh-guide-note"><i class="fa-solid fa-headset"></i> ¿Tienes dudas? Escríbenos por WhatsApp o correo y te ayudamos</p>
    </div>
  </div>

  <script src="./assets/js/firebase-config.js"></script>
  <script src="./assets/js/modal-auth.js?v=9"></script>
  <script src="./assets/js/index.js?v=2"></script>
  <script src="./assets/js/event-delegation.js"></script>
  <script src="./assets/js/page-init.js"></script>
  <script src="./assets/js/animations.js"></script>

</body>
</html>