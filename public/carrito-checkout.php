<?php
require_once dirname(__DIR__) . '/includes/config.php';

// ── Guarda de acceso: carrito requiere sesión activa ─────────────────────────
if (empty($_SESSION['cliente_id'])) {
    $_SESSION['_flash'] = ['msg' => 'Debes iniciar sesión para ver tu carrito.'];
    header('Location: /inicio');
    exit;
}
if (empty($_SESSION['cliente_email_verified'])) {
    $_SESSION['_flash'] = ['msg' => 'Debes verificar tu correo electrónico antes de continuar. Revisa tu bandeja de entrada.'];
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
    <title>Carrito – Wooden House</title>
    <meta name="description" content="Revisa tu carrito de compras en Wooden House. Elige tu método de entrega, fecha y completa tu pedido de muebles a medida.">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
    <link rel="stylesheet" href="./assets/css/variables.css">
    <link rel="stylesheet" href="./assets/css/carrito.css?v=4">
    <link rel="stylesheet" href="./assets/css/animations.css">
    <link rel="stylesheet" href="./assets/css/modal-auth.css?v=4">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous" defer></script>
</head>
<body>

<!-- ── Header ───────────────────────────────────────────────────── -->
<div class="header-nav">
    <div class="logo">
      <a href="/inicio" aria-label="Wooden House – ir al inicio" style="display:block;line-height:0;">
        <img src="/assets/img/logo-header.png" alt="Wooden House" style="height:80px;">
      </a>
    </div>
<div class="nav-links" id="navLinks">
        <a href="/inicio" title="Volver al inicio">Inicio</a>
        <a href="/catalogo" title="Seguir comprando en el catálogo">← Seguir comprando</a>
        <button class="btn-cuenta-nav" title="Iniciar sesión o ver mi cuenta">
            <i class="fa-solid fa-user"></i> Iniciar sesión
        </button>
    </div>
</div>

<!-- ── Pasos ─────────────────────────────────────────────────────── -->
<div class="steps-indicator" aria-label="Progreso del pedido">
    <div class="step active" aria-current="step">
        <div class="step-number">1</div>
        <span>Tu carrito</span>
    </div>
    <div class="step">
        <div class="step-number">2</div>
        <span>Pago</span>
    </div>
    <div class="step">
        <div class="step-number">3</div>
        <span>Listo</span>
    </div>
</div>

<!-- ── Main ──────────────────────────────────────────────────────── -->
<main id="contenido-principal">
<div class="container">
    <div class="page-header">
        <h1 class="page-title"><i class="fa-solid fa-cart-shopping"></i> Tu Carrito de Compras</h1>
        <p class="page-subtitle">Revisa tu pedido, elige opciones de entrega y selecciona tu fecha</p>
        <a href="/catalogo" class="btn-volver-catalogo"><i class="fa-solid fa-arrow-left"></i> Volver al Catálogo</a>
    </div>

    <div class="row g-4 cart-container">
        <!-- ── Columna izquierda ───────────────────────────────── -->
        <div class="col-lg-8 cart-items">

            <div class="section-card">
                <h2 class="section-title"><span class="section-icon"><i class="fa-solid fa-bath"></i></span> Productos en tu carrito</h2>
                <div id="carritoItems">
                    <div class="fecha-loading">Cargando carrito</div>
                </div>
            </div>

            <div class="section-card">
                <h2 class="section-title">
                  <span class="section-icon"><i class="fa-solid fa-truck"></i></span> Tipo de entrega
                  <span class="wh-help" data-tip="Elige cómo quieres recibir tus muebles. Puedes recogerlos gratis en nuestra sucursal o solicitar envío a domicilio dentro del área metropolitana de Guadalajara.">?</span>
                </h2>
                <div class="delivery-options">
                    <div class="option-card selected" id="optionRecoger" data-entrega="recoger">
                        <input type="radio" name="tipoEntrega" value="recoger" checked>
                        <div class="option-content">
                            <div class="option-header">
                                <span class="option-title">Recoger en sucursal</span>
                                <span class="option-price">GRATIS</span>
                            </div>
                            <div class="option-description">
                                <i class="fa-solid fa-location-dot"></i> <?= htmlspecialchars(SITE_ADDRESS) ?>
                            </div>
                        </div>
                    </div>

                    <div class="option-card" id="optionEnvio" data-entrega="envio">
                        <input type="radio" name="tipoEntrega" value="envio">
                        <div class="option-content">
                            <div class="option-header">
                                <span class="option-title">Envío a domicilio</span>
                                <span class="option-price" id="precioEnvioLabel">$<?= number_format(COSTO_ENVIO, 0) ?></span>
                            </div>
                            <div class="option-description">
                                Entregamos en tu domicilio en Guadalajara y área metropolitana.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="section-card">
                <h2 class="section-title">
                  <span class="section-icon"><i class="fa-solid fa-wrench"></i></span> Servicios adicionales
                  <span class="wh-help" data-tip="La instalación profesional incluye colocación del mueble, conexión hidráulica del lavabo y ajustes finales. Se aplica un cargo de $<?= number_format(COSTO_INSTALACION, 0) ?> por mueble instalado.">?</span>
                </h2>
                <div class="delivery-options">

                    <div class="option-card selected" id="optionSinInstalacion" data-instalacion="false">
                        <input type="radio" name="tipoInstalacion" value="sin_instalacion" checked>
                        <div class="option-content">
                            <div class="option-header">
                                <span class="option-title">Sin instalación</span>
                                <span class="option-price">GRATIS</span>
                            </div>
                            <div class="option-description">
                                Solo entrega del mueble, tú te encargas de la instalación.
                            </div>
                        </div>
                    </div>

                    <div class="option-card" id="optionConInstalacion" data-instalacion="true">
                        <input type="radio" name="tipoInstalacion" value="con_instalacion">
                        <div class="option-content">
                            <div class="option-header">
                                <span class="option-title">Instalación profesional</span>
                                <span class="option-price" id="precioInstalacionLabel">+ $<?= number_format(COSTO_INSTALACION, 0) ?></span>
                            </div>
                            <div class="option-description">
                                Instalación por expertos, incluye conexión de lavabo y ajustes finales.
                                <span id="notaInstalacion" style="display:block;margin-top:6px;color:#8b7355;font-size:12px;font-weight:600;">
                                    <i class="fa-solid fa-circle-info"></i> $<?= number_format(COSTO_INSTALACION, 0) ?> por mueble
                                </span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <div class="section-card">
                <h2 class="section-title">
                  <span class="section-icon"><i class="fa-solid fa-money-bill-wave"></i></span> Forma de pago
                  <span class="wh-help" data-tip="Puedes pagar tu pedido completo ahora, o solo el 50% de anticipo para iniciar la fabricación y liquidar el resto después (en línea o al recibir tu pedido).">?</span>
                </h2>
                <div class="delivery-options">

                    <div class="option-card selected" id="optionPagoCompleto" data-tipopago="completo">
                        <input type="radio" name="tipoPago" value="completo" checked>
                        <div class="option-content">
                            <div class="option-header">
                                <span class="option-title">Pago completo</span>
                                <span class="option-price">100%</span>
                            </div>
                            <div class="option-description">
                                Pagas el total de tu pedido ahora.
                            </div>
                        </div>
                    </div>

                    <div class="option-card" id="optionAnticipo" data-tipopago="anticipo">
                        <input type="radio" name="tipoPago" value="anticipo">
                        <div class="option-content">
                            <div class="option-header">
                                <span class="option-title">Anticipo del 50%</span>
                                <span class="option-price" id="precioAnticipoLabel">50%</span>
                            </div>
                            <div class="option-description">
                                Pagas la mitad ahora para iniciar la fabricación. El resto se liquida después, antes de la entrega.
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <!-- ── SELECTOR DE FECHA ──────────────────────────── -->
            <div class="section-card">
                <h2 class="section-title">
                  <span class="section-icon"><i class="fa-solid fa-calendar-days"></i></span> Fecha de entrega
                  <span class="wh-help" data-tip="Selecciona el día preferido para recibir tu pedido. Solo aparecen los días disponibles según la capacidad del taller. Si la fecha que necesitas no aparece, contáctanos.">?</span>
                </h2>

                <div class="date-info">
                    <strong><i class="fa-solid fa-clock"></i> Fabricación bajo pedido — entrega estimada en 2 días hábiles</strong>
                    <p>
                        Selecciona el día que prefieres recibir tu mueble.
                        La disponibilidad se actualiza en tiempo real según la carga del taller.
                    </p>
                </div>

                <div class="disponibilidad-indicator">
                    <span class="dot dot-ok"></span><span>Lugares disponibles</span>
                    <span class="dot dot-medio" style="margin-left:12px"></span><span>Casi lleno</span>
                    <span class="dot dot-lleno" style="margin-left:12px"></span><span>Sin lugares</span>
                </div>

                <div id="semanasGrid" class="semanas-grid">
                    <div class="fecha-loading">Consultando disponibilidad en tiempo real</div>
                </div>

                <input type="hidden" id="semanaSeleccionada" value="">
                <input type="hidden" id="fechaSugerida"      value="">

                <div class="info-box">
                    <p>
                        <i class="fa-solid fa-lightbulb"></i> <strong>Nota:</strong> La fecha seleccionada es tu día de entrega estimado.
                        Recibirás confirmación por correo electrónico.
                    </p>
                </div>
            </div>

            <div class="section-card">
                <h2 class="section-title">
                  <span class="section-icon"><i class="fa-solid fa-user"></i></span> Datos de contacto
                  <span class="wh-help" data-tip="Usamos estos datos para confirmar tu pedido y coordinar la entrega. Si ya tienes cuenta, tus datos se rellenan automáticamente.">?</span>
                </h2>
                <form id="formularioCliente" novalidate>
                  <!-- Anti-bot honeypot: invisible para humanos, bots lo llenan -->
                  <div style="position:absolute;left:-9999px;top:-9999px;opacity:0;height:0;overflow:hidden;" aria-hidden="true">
                    <label>No llenar este campo <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
                    <label>URL <input type="text" name="url" tabindex="-1" autocomplete="off"></label>
                    <input type="text" name="_hp" tabindex="-1" autocomplete="off">
                  </div>
                    <div class="form-group">
                        <label>Nombre completo <span class="required">*</span>
                          <span class="wh-help" data-tip="Escribe tu nombre tal como aparece en tu identificación oficial.">?</span>
                        </label>
                        <input type="text" id="clienteNombre" placeholder="Juan Pérez López" required>
                    </div>
                    <div class="row g-3 form-row">
                        <div class="col-md-6 form-group">
                            <label>Teléfono de contacto <span class="required">*</span>
                              <span class="wh-help" data-tip="Te llamaremos o enviaremos WhatsApp para coordinar la entrega. Mínimo 10 dígitos.">?</span>
                            </label>
                            <input type="tel" id="clienteTelefono" placeholder="33 1234 5678" required>
                        </div>
                        <div class="col-md-6 form-group">
                            <label>Correo electrónico <span class="required">*</span>
                              <span class="wh-help" data-tip="Enviaremos la confirmación del pedido y número de seguimiento a este correo.">?</span>
                            </label>
                            <input type="email" id="clienteCorreo" placeholder="correo@ejemplo.com" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Confirmar correo electrónico <span class="required">*</span>
                              <span class="wh-help" data-tip="Escribe el mismo correo otra vez para asegurarnos de que no haya errores de escritura.">?</span>
                            </label>
                            <input type="email" id="clienteCorreoConfirm" placeholder="correo@ejemplo.com" required autocomplete="off" autocorrect="off" spellcheck="false">
                            <div class="help-text">Escribe tu correo nuevamente para confirmarlo</div>
                        </div>
                    </div>

                    <div id="seccionDireccion">
                        <div class="wh-info-box" style="margin-bottom:14px;">
                          <i class="fa-solid fa-location-dot"></i>
                          <span>La siguiente dirección es <strong>donde entregaremos tu pedido</strong>. Asegúrate de que sea correcta.</span>
                        </div>
                        <div class="form-group">
                            <label>Calle y número <span class="required">*</span>
                              <span class="wh-help" data-tip="Solo la calle y el número exterior/interior. La colonia va en el campo siguiente.">?</span>
                            </label>
                            <input type="text" id="clienteDireccion" placeholder="Ej. Av. Chapultepec 1234 Int. 5" required>
                        </div>
                        <div class="row g-3 form-row">
                            <div class="col-md-6 form-group">
                                <label>Colonia <span class="required">*</span></label>
                                <input type="text" id="clienteColonia" placeholder="Ej. Col. Americana" required>
                            </div>
                            <div class="col-md-6 form-group">
                                <label>Ciudad <span class="required">*</span></label>
                                <input type="text" id="clienteCiudad" placeholder="Ej. Guadalajara" required>
                            </div>
                        </div>
                        <div class="row g-3 form-row">
                            <div class="col-12 form-group">
                                <label>Municipio <span class="required">*</span></label>
                                <input type="text" id="clienteMunicipio" placeholder="Ej. Zapopan" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Código Postal <span class="required">*</span>
                              <span class="wh-help" data-tip="Tu CP de 5 dígitos. Lo usamos para confirmar que la dirección está dentro de nuestra zona de entrega (ZMG).">?</span>
                            </label>
                            <input type="text" id="clienteCP" placeholder="45000" required maxlength="5">
                        </div>
                        <div class="form-group">
                            <label>Referencias adicionales
                              <span class="wh-help" data-tip="Describe referencias para encontrar tu domicilio: color de la fachada, entre qué calles está, si hay portón o reja, etc.">?</span>
                            </label>
                            <textarea id="clienteNotas" rows="3"
                                placeholder="Entre calles X y Y, portón negro, casa color beige…"></textarea>
                            <div class="help-text">Ayúdanos a encontrar tu domicilio</div>
                        </div>
                    </div>
                </form>
            </div>
        </div><!-- /cart-items -->

        <!-- ── Columna derecha: resumen ───────────────────────── -->
        <div class="col-lg-4 cart-summary-col">
        <div class="cart-summary">
            <h3 class="summary-title"><i class="fa-solid fa-clipboard-list"></i> Resumen del pedido</h2>

            <div id="resumenItems"></div>

            <div class="summary-item" id="lineaEnvio">
                <span>Envío a domicilio</span>
                <span id="totalEnvio">$500</span>
            </div>
            <div class="summary-item" id="lineaInstalacion" style="display:none">
                <span>Instalación profesional <span id="labelInstalacionQty" style="color:#a0a0a0;font-size:12px;"></span></span>
                <span id="costoInstalacionTotal">$1,500</span>
            </div>
            <div class="summary-total">
                <span>Total del pedido</span>
                <span id="totalFinal">$0</span>
            </div>
            <div class="summary-item" id="lineaAnticipo" style="display:none">
                <span><i class="fa-solid fa-circle-info" style="color:#8b7355;"></i> Pagas ahora (anticipo 50%)</span>
                <span id="montoAnticipo">$0</span>
            </div>
            <div class="summary-item" id="lineaSaldoPendiente" style="display:none">
                <span>Saldo pendiente (después)</span>
                <span id="montoSaldoPendiente">$0</span>
            </div>

            <div class="fecha-resumen-box" id="fechaResumenBox">
                <strong><i class="fa-solid fa-calendar-days"></i> Semana de entrega elegida</strong>
                <span id="fechaResumenTexto">—</span>
            </div>

            <button class="btn-checkout" id="btnCheckout" data-call="procederAlPago">
                Proceder al pago <i class="fa-solid fa-credit-card"></i>
            </button>

            <button class="btn-vaciar-carrito" id="btnVaciarCarrito" data-call="confirmarVaciarCarrito">
                <i class="fa-solid fa-trash"></i> Vaciar carrito
            </button>

            <p class="secure-note">
                <i class="fa-solid fa-lock"></i> Pago 100% seguro · Stripe &amp; PayPal<br>
                <i class="fa-solid fa-box"></i> Garantía de satisfacción incluida
            </p>
        </div>
        </div>
    </div>
</div>

<div class="footer">
    <p>© 2026 Wooden House · Guadalajara, Jalisco</p>
    <p style="margin-top:8px;font-size:14px;">
        <a href="mailto:ventas@muebleswh.com" style="color:#8b7355">ventas@muebleswh.com</a> |
        <a href="tel:3317054017" style="color:#8b7355">33 1705 4017</a>
    </p>
    <p style="margin-top:8px; font-size:12px;">
      <a href="/terminos" style="color:#8b7355; text-decoration:none;">Términos y Condiciones</a>
      &nbsp;·&nbsp;
      <a href="/terminos#privacidad" style="color:#8b7355; text-decoration:none;">Aviso de Privacidad</a>
    </p>
</div>

<nav class="mobile-bottom-nav" aria-label="Navegación rápida">
  <div class="mobile-bottom-nav-inner">
    <a href="/catalogo" class="mbn-item"><i class="fa-solid fa-store"></i><span>Catálogo</span></a>
    <a href="/solicitudes" class="mbn-item"><i class="fa-solid fa-file-invoice"></i><span>Solicitar</span></a>
    <a href="/seguimiento" class="mbn-item"><i class="fa-solid fa-magnifying-glass"></i><span>Seguimiento</span></a>
    <a href="/carrito" class="mbn-item mbn-item--active"><span class="mbn-icon-wrap"><i class="fa-solid fa-cart-shopping"></i><span class="mbn-cart-badge"></span></span><span>Carrito</span></a>
    <button class="mbn-item" data-auth-action="openMenuMovil"><i class="fa-solid fa-user"></i><span>Mi cuenta</span></button>
  </div>
</nav>

</main>
<script src="./assets/js/utils.js"></script>
<script src="./assets/js/firebase-config.js"></script>
<script src="./assets/js/modal-auth.js?v=9"></script>
<script src="./assets/js/carrito.js"></script>
<script src="./assets/js/checkout.js"></script>
<script src="./assets/js/event-delegation.js"></script>
<script src="./assets/js/animations.js"></script>
</body>
</html>