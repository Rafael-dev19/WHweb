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
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Proceso de Pago - Wooden House</title>
  <meta name="description" content="Completa tu compra en Wooden House de forma segura. Pago con tarjeta de crédito/débito o PayPal. Transacciones cifradas con SSL.">

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

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="/assets/<?= av('css/variables.css') ?>">
  <link rel="stylesheet" href="/assets/<?= av('css/styles.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/pago.css') ?>">
  <link rel="stylesheet" href="./assets/<?= av('css/theme-toggle.css') ?>">
  <link rel="stylesheet" href="/assets/<?= av('css/animations.css') ?>">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <script src="/assets/vendor/lucide-1.55.0.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous" defer></script>
</head>
<body>

  <div class="header-nav">
    <a href="/inicio" class="logo" style="text-decoration:none;">
      <img src="/assets/img/logo-header.png" alt="Wooden House" style="height:80px;">
    </a>
    <a href="/carrito" id="linkRegresar" style="color:#a0a0a0;text-decoration:none;font-size:14px;display:flex;align-items:center;gap:6px;">
      <i data-lucide="arrow-left" style="width:14px;height:14px;stroke-width:2;"></i> <span id="linkRegresarTexto">Regresar al carrito</span>
    </a>
  </div>

  <div class="steps-indicator" id="stepsIndicator">
    <div class="step completed">
      <div class="step-number"><i data-lucide="check" style="width:14px;height:14px;stroke-width:2.5;"></i></div><span>Carrito</span>
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
      <h1 class="page-title"><i data-lucide="credit-card"></i> Proceso de Pago</h1>
      <p class="page-subtitle">Completa tu compra de forma segura y protegida</p>
    </div>

    <div class="row g-4 payment-container">
      <div class="col-lg-8 payment-section">

        <!-- Error global visible para todos los métodos de pago -->
        <div id="payment-error-global" style="display:none; background:rgba(231,76,60,0.1); border:1px solid #e74c3c; border-radius:10px; padding:14px 18px; margin-bottom:20px; color:#e74c3c; font-size:14px; font-weight:600;"></div>
        <div class="notice" id="noticeBox" style="display:none;">
          <strong><i data-lucide="triangle-alert"></i> No hay datos del carrito.</strong><br>
          <a href="/catalogo">Regresa al catálogo</a> para seleccionar productos.
        </div>
        <div id="tipoPagoBanner" style="display:none; background:rgba(139,115,85,0.12); border:1px solid #8b7355; border-radius:10px; padding:12px 16px; margin-bottom:20px; color:#e0c9a6; font-size:13px;"></div>



        <h2 class="section-title">
          <span><i data-lucide="lock"></i></span> Pago Seguro
          <span class="wh-help" data-tip="Elige cómo quieres pagar. Ambas opciones son 100% seguras y cifradas. Tu información de tarjeta nunca toca nuestros servidores — va directo a Stripe o PayPal.">?</span>
        </h2>

        <!-- ── Stripe ── -->
        <div id="stripe-section" class="payment-form-section">
          <div class="payment-gateway-header">
            <i data-lucide="credit-card"></i>
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
            <i data-lucide="lock"></i> Pagar con Tarjeta
          </button>
        </div>

        <!-- ── Divider ── -->
        <div class="payment-divider">
          <span>o paga con</span>
        </div>

        <!-- ── PayPal ── -->
        <div id="paypal-section" class="payment-form-section">
          <div class="payment-gateway-header">
            <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" style="flex-shrink:0;">
              <path fill="#003087" d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zM19.61 6.548c-.024.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19a1.06 1.06 0 0 0-.293.04l1.226-7.766a.909.909 0 0 1 .898-.768h1.885c3.66 0 6.522-1.487 7.36-5.79.017-.09.032-.177.045-.263" opacity=".7"/>
              <path fill="#009cde" d="M8.897 5.53a.909.909 0 0 1 .898-.767h5.878c.696 0 1.346.046 1.94.144a8.13 8.13 0 0 1 1.174.28c.301.099.58.215.837.35.301-1.918-.003-3.223-1.043-4.408C17.435.548 15.437 0 12.86 0h-7.46A1.061 1.061 0 0 0 4.34.901L1.837 20.597a.641.641 0 0 0 .633.74h4.606l1.157-7.34 1.664-8.467z"/>
            </svg>
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
          <span title="Conexión cifrada con SSL de 256 bits — todos los datos viajan protegidos entre tu navegador y los servidores de pago"><i data-lucide="lock"></i> SSL 256-bit</span>
          <span title="PCI DSS: estándar internacional de seguridad para pagos con tarjeta. Significa que Stripe/PayPal cumplen los máximos requisitos de seguridad"><i data-lucide="circle-check"></i> PCI DSS</span>
          <span title="Wooden House nunca almacena, procesa ni ve tus datos de tarjeta. Todo va directo a Stripe o PayPal"><i data-lucide="shield-check"></i> Datos protegidos</span>
          <span title="Puedes cancelar antes de que el pago se confirme. Una vez pagado, contáctanos para gestionar cualquier cambio"><i data-lucide="rotate-ccw"></i> Cancelación fácil</span>
        </div>
      </div>

      <div class="col-lg-4 order-summary">
        <h2 class="section-title"><i data-lucide="clipboard-list"></i> Resumen del Pedido</h2>
        <div id="cart-items-summary"></div>
        <div class="totals">
          <div class="total-row"><span>Subtotal</span><span id="subtotalDisplay">$0</span></div>
          <div class="total-row" id="shippingLine"><span>Envío</span><span id="shippingDisplay">$0</span></div>
          <div class="total-row" id="installationLine" style="display:none;"><span>Instalación</span><span id="installationDisplay">$0</span></div>
          <div class="total-row" id="discountLine" style="display:none;"><span>Descuento</span><span id="discountDisplay">-$0</span></div>
          <div class="total-row total-final"><span><strong>TOTAL</strong></span><span id="totalDisplay"><strong>$0</strong></span></div>
          <div class="total-row" id="lineaAnticipoPago" style="display:none;"><span>Anticipo (50%)</span><span id="montoAnticipoPago">$0</span></div>
          <div class="total-row" id="lineaSaldoPago" style="display:none;"><span>Saldo pendiente</span><span id="montoSaldoPago">$0</span></div>
        </div>
      </div>
    </div>
  </div>

  </main>
  <footer class="footer">
    <p><i data-lucide="shield-check" style="color:#4caf50;"></i> Pago 100% seguro &nbsp;|&nbsp; <i data-lucide="lock" style="color:#8b7355;"></i> SSL 256-bit &nbsp;|&nbsp; Wooden House &copy; <?= date('Y') ?></p>
    <p style="margin-top:8px; font-size:12px;">
      <a href="/terminos" style="color:#8b7355; text-decoration:none;">Términos y Condiciones</a>
      &nbsp;·&nbsp;
      <a href="/privacidad" style="color:#8b7355; text-decoration:none;">Aviso de Privacidad</a>
    </p>
  </footer>

  <script src="./assets/<?= av('js/utils.js') ?>"></script>
  <script src="/assets/<?= av('js/theme-toggle.js') ?>"></script>
<script src="/assets/<?= av('js/firebase-config.js') ?>"></script>
  <script src="/assets/<?= av('js/modal-auth.js') ?>"></script>
  <script src="./assets/<?= av('js/pago.js') ?>"></script>
  <script src="./assets/<?= av('js/event-delegation.js') ?>"></script>
  <script src="./assets/<?= av('js/animations.js') ?>"></script>
  <script nonce="<?= cspNonce() ?>">
    document.addEventListener('DOMContentLoaded', function () {
      if (window.lucide) window.lucide.createIcons();
    });
  </script>
</body>
</html>