<?php
header('Content-Type: text/html; charset=utf-8');
require_once dirname(__DIR__) . '/includes/assets.php';
require_once dirname(__DIR__) . '/includes/env.php';
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Política de Privacidad – Wooden House</title>
  <meta name="description" content="Política de privacidad de Wooden House. Conoce cómo recopilamos, usamos y protegemos tus datos personales conforme a la LFPDPPP.">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="./assets/<?= av('css/variables.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/styles.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/terminos.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/modal-auth.css') ?>">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</head>
<body>

<!-- Header -->
<div class="header-nav">
  <div class="logo">
    <a href="/inicio" aria-label="Wooden House – ir al inicio" style="display:block;line-height:0;">
      <img src="/assets/img/logo-header.png" alt="Wooden House" style="height:80px;">
    </a>
  </div>
  <div class="nav-links">
    <a href="/inicio"><i class="fa-solid fa-house"></i> Inicio</a>
    <a href="/catalogo">Catálogo</a>
    <a href="/solicitudes" title="Pedir cotización o agendar una cita de medición">Solicitar</a>
    <a href="/seguimiento" title="Consulta el estado de tu pedido, cita o cotización">Seguimiento</a>
  </div>
</div>

<!-- Contenido -->
<main id="contenido-principal">
<div class="page-wrap">

  <div class="page-header">
    <h1><i class="fa-solid fa-shield-halved"></i> Política de Privacidad</h1>
    <p>Wooden House &nbsp;·&nbsp; Última actualización: junio de 2026 &nbsp;·&nbsp; Guadalajara, Jalisco</p>
    <p style="margin-top:6px;font-size:13px;color:#aaa;">
      En cumplimiento de la <strong style="color:#c9a96e;">Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)</strong>,
      Wooden House informa a sus usuarios la manera en que se recopilan, usan y protegen sus datos personales.
    </p>
  </div>

  <!-- 1. Responsable -->
  <div class="section">
    <h2><i class="fa-solid fa-building"></i> 1. Responsable del tratamiento de datos</h2>
    <p>
      <strong>Wooden House</strong> es una empresa mexicana con domicilio en Guadalajara, Jalisco,
      dedicada a la fabricación y comercialización de muebles de madera a medida.
    </p>
    <p>
      Para cualquier consulta relacionada con el tratamiento de tus datos personales, puedes
      contactarnos en: <a href="mailto:<?= SITE_EMAIL ?>"><?= SITE_EMAIL ?></a>
    </p>
  </div>

  <!-- 2. Datos que recopilamos -->
  <div class="section">
    <h2><i class="fa-solid fa-database"></i> 2. Datos personales que recopilamos</h2>
    <p>Wooden House recopila los siguientes datos personales cuando usas nuestro sitio:</p>
    <ul>
      <li><strong>Datos de identificación:</strong> nombre completo.</li>
      <li><strong>Datos de contacto:</strong> correo electrónico y número de teléfono.</li>
      <li><strong>Datos de ubicación:</strong> dirección de entrega (calle, colonia, ciudad, municipio, código postal).</li>
      <li><strong>Datos de transacción:</strong> historial de pedidos, cotizaciones y citas agendadas.</li>
      <li><strong>Datos técnicos:</strong> dirección IP, tipo de navegador y datos de sesión (recopilados automáticamente para seguridad).</li>
    </ul>
    <div class="highlight-box">
      Wooden House <strong>no recopila</strong> datos de tarjetas de crédito o débito. El procesamiento
      de pagos es gestionado de forma segura por <strong>Stripe</strong> y <strong>PayPal</strong>,
      quienes cuentan con certificación PCI DSS.
    </div>
  </div>

  <!-- 3. Finalidad del tratamiento -->
  <div class="section">
    <h2><i class="fa-solid fa-bullseye"></i> 3. Finalidad del tratamiento</h2>
    <p>Los datos personales que recopilamos se utilizan exclusivamente para las siguientes finalidades <strong>primarias</strong>:</p>
    <ul>
      <li>Procesar y gestionar tus pedidos, cotizaciones y citas de medición.</li>
      <li>Enviarte confirmaciones, actualizaciones de estatus y comunicaciones relacionadas con tus compras.</li>
      <li>Gestionar tu cuenta de usuario y garantizar la seguridad de acceso.</li>
      <li>Cumplir con obligaciones legales y fiscales (emisión de CFDI previa solicitud).</li>
      <li>Atender aclaraciones, devoluciones y ejercicio de derechos ARCO.</li>
    </ul>
    <p>Finalidades <strong>secundarias</strong> (puedes oponerte en cualquier momento):</p>
    <ul>
      <li>Enviarte información sobre nuevos productos, promociones y descuentos disponibles.</li>
      <li>Realizar encuestas de satisfacción sobre nuestros productos y servicios.</li>
    </ul>
  </div>

  <!-- 4. Transferencia de datos -->
  <div class="section">
    <h2><i class="fa-solid fa-share-nodes"></i> 4. Transferencia de datos a terceros</h2>
    <p>
      Wooden House <strong>no vende ni comparte</strong> tus datos personales con terceros con fines comerciales.
      Únicamente los compartimos con los proveedores necesarios para operar el servicio:
    </p>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px;">
        <thead>
          <tr style="border-bottom:2px solid #3d3d3d;">
            <th style="padding:10px 14px;text-align:left;color:#c9a96e;">Proveedor</th>
            <th style="padding:10px 14px;text-align:left;color:#c9a96e;">Finalidad</th>
            <th style="padding:10px 14px;text-align:left;color:#c9a96e;">Datos compartidos</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #3a3a3a;">
            <td style="padding:10px 14px;color:#e0e0e0;"><strong>Firebase / Google</strong></td>
            <td style="padding:10px 14px;color:#aaa;">Autenticación, base de datos y notificaciones</td>
            <td style="padding:10px 14px;color:#aaa;">Correo electrónico, nombre, UID de sesión</td>
          </tr>
          <tr style="border-bottom:1px solid #3a3a3a;">
            <td style="padding:10px 14px;color:#e0e0e0;"><strong>Stripe</strong></td>
            <td style="padding:10px 14px;color:#aaa;">Procesamiento de pagos con tarjeta</td>
            <td style="padding:10px 14px;color:#aaa;">Nombre, correo, monto de transacción</td>
          </tr>
          <tr style="border-bottom:1px solid #3a3a3a;">
            <td style="padding:10px 14px;color:#e0e0e0;"><strong>PayPal</strong></td>
            <td style="padding:10px 14px;color:#aaa;">Procesamiento de pagos con PayPal</td>
            <td style="padding:10px 14px;color:#aaa;">Nombre, correo, monto de transacción</td>
          </tr>
          <tr style="border-bottom:1px solid #3a3a3a;">
            <td style="padding:10px 14px;color:#e0e0e0;"><strong>Brevo</strong></td>
            <td style="padding:10px 14px;color:#aaa;">Envío de correos transaccionales</td>
            <td style="padding:10px 14px;color:#aaa;">Nombre y correo electrónico</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;color:#e0e0e0;"><strong>reCAPTCHA (Google)</strong></td>
            <td style="padding:10px 14px;color:#aaa;">Protección contra acceso automatizado</td>
            <td style="padding:10px 14px;color:#aaa;">Datos de comportamiento del navegador</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p style="margin-top:14px;font-size:13px;color:#888;">
      Este sitio está protegido por <strong style="color:#c9a96e;">reCAPTCHA de Google</strong>. Se aplican la
      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Política de Privacidad</a>
      y los
      <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Términos de Servicio</a>
      de Google.
    </p>
  </div>

  <!-- 5. Derechos ARCO -->
  <div class="section" id="arco">
    <h2><i class="fa-solid fa-user-shield"></i> 5. Derechos ARCO</h2>
    <p>
      Conforme a la LFPDPPP, tienes derecho a <strong>Acceder, Rectificar, Cancelar u Oponerte</strong>
      al uso de tus datos personales en cualquier momento.
    </p>
    <div class="highlight-box">
      Para ejercer tus derechos ARCO, escríbenos a <a href="mailto:<?= SITE_EMAIL ?>"><?= SITE_EMAIL ?></a>
      desde el correo registrado en tu cuenta, indicando:<br><br>
      <ul style="margin:0;padding-left:20px;">
        <li>Tu nombre completo y correo registrado.</li>
        <li>El derecho que deseas ejercer (Acceso, Rectificación, Cancelación u Oposición).</li>
        <li>Una descripción clara de los datos sobre los que solicitas el ejercicio de tu derecho.</li>
      </ul>
      <br>Responderemos en un plazo máximo de <strong>20 días hábiles</strong>.
    </div>
  </div>

  <!-- 6. Cookies y tecnologías de rastreo -->
  <div class="section">
    <h2><i class="fa-solid fa-cookie-bite"></i> 6. Cookies y tecnologías de rastreo</h2>
    <p>El sitio utiliza las siguientes cookies y tecnologías similares:</p>
    <ul>
      <li><strong>Cookies de sesión:</strong> necesarias para mantener tu sesión activa. Se eliminan al cerrar el navegador.</li>
      <li><strong>Cookie CSRF:</strong> token de seguridad para prevenir ataques de falsificación de solicitudes.</li>
      <li><strong>Cookies de Firebase:</strong> para gestión de autenticación y sesión de usuario.</li>
      <li><strong>reCAPTCHA (Google):</strong> analiza el comportamiento del usuario para detectar actividad automatizada.</li>
    </ul>
    <p>No utilizamos cookies de rastreo publicitario de terceros.</p>
  </div>

  <!-- 7. Seguridad -->
  <div class="section">
    <h2><i class="fa-solid fa-lock"></i> 7. Seguridad de los datos</h2>
    <ul>
      <li>Todas las comunicaciones se realizan mediante <strong>HTTPS con TLS</strong>.</li>
      <li>Las contraseñas se gestionan a través de Firebase Authentication — Wooden House <strong>no almacena contraseñas</strong> en texto plano.</li>
      <li>El acceso a los paneles administrativos requiere autenticación con Firebase y verificación de rol.</li>
      <li>Los pagos son procesados por Stripe y PayPal con certificación <strong>PCI DSS</strong>.</li>
      <li>Se implementan tokens CSRF en todas las operaciones sensibles para prevenir ataques.</li>
    </ul>
  </div>

  <!-- 8. Conservación de datos -->
  <div class="section">
    <h2><i class="fa-solid fa-clock-rotate-left"></i> 8. Conservación de datos</h2>
    <p>
      Tus datos personales se conservan mientras mantengas una cuenta activa en el sitio o mientras
      sean necesarios para los fines descritos en esta política. Una vez concluida la relación comercial
      y cumplidas las obligaciones legales, los datos serán eliminados o anonimizados.
    </p>
    <p>Los datos de transacciones se conservan por el tiempo requerido por la legislación fiscal mexicana (mínimo 5 años).</p>
  </div>

  <!-- 9. Menores de edad -->
  <div class="section">
    <h2><i class="fa-solid fa-child"></i> 9. Menores de edad</h2>
    <p>
      Este sitio no está dirigido a menores de 18 años. No recopilamos intencionalmente datos
      personales de menores. Si detectamos que un menor proporcionó sus datos sin consentimiento
      del tutor, procederemos a eliminarlos de inmediato.
    </p>
  </div>

  <!-- 10. Cambios a esta política -->
  <div class="section">
    <h2><i class="fa-solid fa-pen-to-square"></i> 10. Cambios a esta política</h2>
    <p>
      Wooden House se reserva el derecho de actualizar esta Política de Privacidad en cualquier momento.
      Los cambios entrarán en vigor desde su publicación en esta página. Te recomendamos revisarla periódicamente.
    </p>
    <p style="margin-top:14px;">
      ¿Tienes dudas? Consulta también nuestras
      <a href="/terminos" style="color:#c9a96e;">Condiciones del Servicio</a> o
      escríbenos a <a href="mailto:<?= SITE_EMAIL ?>"><?= SITE_EMAIL ?></a>.
    </p>
    <p style="margin-top:10px;color:#aaa;font-size:13px;">
      Política elaborada en <strong>junio de 2026</strong> y vigente a partir de esa fecha.
    </p>
  </div>

</div>

<!-- Footer -->
<div class="footer">
  <p>&copy; <?= date('Y') ?> Wooden House · Guadalajara, Jalisco</p>
  <p style="margin-top:8px;">
    <a href="mailto:<?= SITE_EMAIL ?>"><?= SITE_EMAIL ?></a> &nbsp;|&nbsp;
    <a href="tel:<?= sitePhoneDigits() ?>"><?= SITE_PHONE ?></a>
  </p>
</div>

</main>

<!-- Barra de navegación fija móvil -->
<nav class="mobile-bottom-nav" aria-label="Navegación rápida">
  <div class="mobile-bottom-nav-inner">
    <a href="/catalogo"    class="mbn-item"><i class="fa-solid fa-store"></i><span>Catálogo</span></a>
    <a href="/solicitudes" class="mbn-item"><i class="fa-solid fa-file-invoice"></i><span>Solicitar</span></a>
    <a href="/seguimiento" class="mbn-item"><i class="fa-solid fa-magnifying-glass"></i><span>Seguimiento</span></a>
    <a href="/carrito"     class="mbn-item"><span class="mbn-icon-wrap"><i class="fa-solid fa-cart-shopping"></i><span class="mbn-cart-badge"></span></span><span>Carrito</span></a>
    <button class="mbn-item" data-auth-action="openMenuMovil"><i class="fa-solid fa-user"></i><span>Mi cuenta</span></button>
  </div>
</nav>
<script src="/assets/<?= av('js/firebase-config.js') ?>"></script>
<script src="/assets/<?= av('js/modal-auth.js') ?>"></script>
<script src="/assets/<?= av('js/event-delegation.js') ?>"></script>
<script src="/assets/<?= av('js/animations.js') ?>"></script>
</body>
</html>
