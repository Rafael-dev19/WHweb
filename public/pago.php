<?php
require_once dirname(__DIR__) . '/includes/config.php';

// ── Guarda de acceso: pago requiere sesión activa y correo verificado ──────
if (empty($_SESSION['cliente_id'])) {
    $_SESSION['_flash'] = ['msg' => 'Debes iniciar sesión para acceder al pago.'];
    header('Location: /inicio');
    exit;
}
if (empty($_SESSION['cliente_email_verified'])) {
    $_SESSION['_flash'] = ['msg' => 'Debes verificar tu correo electrónico antes de continuar con el pago. Revisa tu bandeja de entrada.'];
    header('Location: /inicio');
    exit;
}

// Fallback si faltan constantes en config.php
$stripePk  = defined('STRIPE_PUBLIC_KEY') ? STRIPE_PUBLIC_KEY : '';
$paypalId  = defined('PAYPAL_CLIENT_ID')  ? PAYPAL_CLIENT_ID  : '';
$paypalEnv = defined('PAYPAL_MODE')       ? PAYPAL_MODE       : 'sandbox';

if (!$stripePk)  error_log('[pago.php] STRIPE_PUBLIC_KEY vacío o no definido');
if (!$paypalId)  error_log('[pago.php] PAYPAL_CLIENT_ID vacío o no definido');
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proceso de Pago - Wooden House</title>
  <meta name="description" content="Completa tu compra en Wooden House de forma segura. Pago con tarjeta de crédito/débito o PayPal. Transacciones cifradas con SSL.">

  <link rel="icon" href="/assets/img/favicon.ico">

  <!-- Credenciales inyectadas desde .env — leídas por pago.js desde data attributes -->
  <div id="payment-config"
       data-stripe-pk="<?= htmlspecialchars($stripePk, ENT_QUOTES, 'UTF-8') ?>"
       data-paypal-env="<?= htmlspecialchars($paypalEnv, ENT_QUOTES, 'UTF-8') ?>"
       hidden></div>

  <script src="https://js.stripe.com/v3/"></script>

  <!-- PayPal JS SDK — Client ID inyectado desde .env -->
  <?php $paypalSdkUrl = ($paypalEnv === 'sandbox')
    ? 'https://www.sandbox.paypal.com/sdk/js'
    : 'https://www.paypal.com/sdk/js'; ?>
  <script
    src="<?= $paypalSdkUrl ?>?client-id=<?= urlencode($paypalId) ?>&currency=MXN&locale=es_MX&components=buttons&intent=capture"
    data-sdk-integration-source="button-factory"
    id="paypalScript">
  </script>

  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="/assets/css/variables.css">
  <link rel="stylesheet" href="/assets/css/styles.css?v=4">
  <link rel="stylesheet" href="./assets/css/pago.css?v=3">
  <link rel="stylesheet" href="/assets/css/animations.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous" defer></script>
</head>
<body>

  <div class="header-nav">
    <a href="/inicio" class="logo" style="text-decoration:none;">
      <img src="/assets/img/logo-header.png" alt="Wooden House" style="height:80px;">
    </a>
    <a href="/carrito" style="color:#a0a0a0;text-decoration:none;font-size:14px;display:flex;align-items:center;gap:6px;">
      <i class="fa-solid fa-arrow-left"></i> Regresar al carrito
    </a>
  </div>

  <div class="steps-indicator">
    <div class="step completed">
      <div class="step-number"><i class="fa-solid fa-check"></i></div><span>Carrito</span>
    </div>
    <div class="step active">
      <div class="step-number">2</div><span>Pago</span>
    </div>
    <div class="step">
      <div class="step-number">3</div><span>Confirmación</span>
    </div>
  </div>

  <main id="contenido-principal">
  <div class="container">
    <div class="page-header">
      <h1 class="page-title"><i class="fa-solid fa-credit-card"></i> Proceso de Pago</h1>
      <p class="page-subtitle">Completa tu compra de forma segura y protegida</p>
    </div>

    <div class="row g-4 payment-container">
      <div class="col-lg-8 payment-section">

        <!-- Error global visible para todos los métodos de pago -->
        <div id="payment-error-global" style="display:none; background:rgba(231,76,60,0.1); border:1px solid #e74c3c; border-radius:10px; padding:14px 18px; margin-bottom:20px; color:#e74c3c; font-size:14px; font-weight:600;"></div>
        <div class="notice" id="noticeBox" style="display:none;">
          <strong><i class="fa-solid fa-triangle-exclamation"></i> No hay datos del carrito.</strong><br>
          <a href="/catalogo">Regresa al catálogo</a> para seleccionar productos.
        </div>



        <h2 class="section-title">
          <span><i class="fa-solid fa-lock"></i></span> Pago Seguro
          <span class="wh-help" data-tip="Elige cómo quieres pagar. Ambas opciones son 100% seguras y cifradas. Tu información de tarjeta nunca toca nuestros servidores — va directo a Stripe o PayPal.">?</span>
        </h2>

        <!-- ── Stripe ── -->
        <div id="stripe-section" class="payment-form-section">
          <div class="payment-gateway-header">
            <i class="fa-solid fa-credit-card"></i>
            <div>
              <h3>Tarjeta de Crédito o Débito</h3>
              <p class="gateway-sub">Visa · Mastercard · American Express — procesado por Stripe</p>
            </div>
            <div class="gateway-badges">
              <img src="https://cdn.jsdelivr.net/npm/payment-icons@1.1.0/min/flat/visa.svg" alt="Visa" width="36" loading="lazy">
              <img src="https://cdn.jsdelivr.net/npm/payment-icons@1.1.0/min/flat/mastercard.svg" alt="Mastercard" width="36" loading="lazy">
              <img src="https://cdn.jsdelivr.net/npm/payment-icons@1.1.0/min/flat/amex.svg" alt="Amex" width="36" loading="lazy">
            </div>
          </div>
          <div class="stripe-card-container">
            <label class="stripe-label">
              Número de tarjeta, vencimiento y CVV
              <span class="wh-help" data-tip="El CVV son los 3 dígitos al reverso de tu tarjeta (4 dígitos en Amex). Este formulario es cifrado con SSL — nosotros nunca vemos ni guardamos tu número de tarjeta.">?</span>
            </label>
            <div id="card-element" class="stripe-element"></div>
            <div id="card-errors" class="card-error" role="alert"></div>
          </div>
          <button id="btnStripe" class="btn-pay btn-stripe" disabled>
            <span id="stripeSpinner" class="spinner" style="display:none;"></span>
            <i class="fa-solid fa-lock"></i> Pagar con Tarjeta
          </button>
        </div>

        <!-- ── Divider ── -->
        <div class="payment-divider">
          <span>o paga con</span>
        </div>

        <!-- ── PayPal ── -->
        <div id="paypal-section" class="payment-form-section">
          <div class="payment-gateway-header">
            <i class="fab fa-paypal" style="color:#009cde;font-size:28px;"></i>
            <div>
              <h3>PayPal</h3>
              <p class="gateway-sub">Usa tu cuenta PayPal o cualquier tarjeta sin registrarte
                <span class="wh-help" data-tip="No necesitas cuenta PayPal — puedes pagar con tarjeta de débito o crédito directamente en la ventana de PayPal. Es seguro y no compartimos tus datos.">?</span>
              </p>
            </div>
          </div>
          <div id="paypal-button-container"></div>
        </div>

        <div class="security-badges">
          <span title="Conexión cifrada con SSL de 256 bits — todos los datos viajan protegidos entre tu navegador y los servidores de pago"><i class="fa-solid fa-lock"></i> SSL 256-bit</span>
          <span title="PCI DSS: estándar internacional de seguridad para pagos con tarjeta. Significa que Stripe/PayPal cumplen los máximos requisitos de seguridad"><i class="fa-solid fa-circle-check"></i> PCI DSS</span>
          <span title="Wooden House nunca almacena, procesa ni ve tus datos de tarjeta. Todo va directo a Stripe o PayPal"><i class="fa-solid fa-shield-halved"></i> Datos protegidos</span>
          <span title="Puedes cancelar antes de que el pago se confirme. Una vez pagado, contáctanos para gestionar cualquier cambio"><i class="fa-solid fa-rotate-left"></i> Cancelación fácil</span>
        </div>
      </div>

      <div class="col-lg-4 order-summary">
        <h2 class="section-title"><i class="fa-solid fa-clipboard-list"></i> Resumen del Pedido</h2>
        <div id="cart-items-summary"></div>
        <div class="totals">
          <div class="total-row"><span>Subtotal</span><span id="subtotalDisplay">$0</span></div>
          <div class="total-row" id="shippingLine"><span>Envío</span><span id="shippingDisplay">$0</span></div>
          <div class="total-row" id="installationLine" style="display:none;"><span>Instalación</span><span id="installationDisplay">$0</span></div>
          <div class="total-row" id="discountLine" style="display:none;"><span>Descuento</span><span id="discountDisplay">-$0</span></div>
          <div class="total-row total-final"><span><strong>TOTAL</strong></span><span id="totalDisplay"><strong>$0</strong></span></div>
        </div>
      </div>
    </div>
  </div>

  </main>
  <footer class="footer">
    <p><i class="fa-solid fa-shield-halved" style="color:#4caf50;"></i> Pago 100% seguro &nbsp;|&nbsp; <i class="fa-solid fa-lock" style="color:#8b7355;"></i> SSL 256-bit &nbsp;|&nbsp; Wooden House &copy; 2026</p>
    <p style="margin-top:8px; font-size:12px;">
      <a href="/terminos" style="color:#8b7355; text-decoration:none;">Términos y Condiciones</a>
      &nbsp;·&nbsp;
      <a href="/terminos#privacidad" style="color:#8b7355; text-decoration:none;">Aviso de Privacidad</a>
    </p>
  </footer>

  <script src="./assets/js/utils.js"></script>
  <script src="/assets/js/firebase-config.js"></script>
  <script src="/assets/js/modal-auth.js?v=9"></script>
  <script src="./assets/js/pago.js"></script>
  <script src="./assets/js/event-delegation.js"></script>
  <script src="./assets/js/animations.js"></script>
</body>
</html>