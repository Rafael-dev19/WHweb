// ── Wooden House — Pago (Stripe + PayPal) ────────────────────────
const API_BASE = '/api';

// Leer credenciales desde data attributes (sin inline script)
(function () {
  var cfg = document.getElementById('payment-config');
  if (cfg) {
    window.STRIPE_PK  = cfg.dataset.stripePk  || '';
    window.PAYPAL_ENV = cfg.dataset.paypalEnv || 'sandbox';
  }
})();

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let stripe, cardElement;
let pedidoCreado = null;
let metodoPago   = 'card';
let orderData    = null;

initMenuHamburguesa();
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const numero = params.get('numero');
  if (params.get('modo') === 'saldo' && numero) {
    cargarResumenSaldo(numero);
  } else {
    cargarResumen();
  }
});

// ── Resumen: pagar el saldo pendiente de un pedido existente ──────
async function cargarResumenSaldo(numeroPedido) {
  try {
    const res  = await fetch(`${API_BASE}/pedidos.php?numero=${encodeURIComponent(numeroPedido)}`);
    const data = await res.json();
    if (!data.success || !data.pedido) throw new Error('Pedido no encontrado');

    const p     = data.pedido;
    const saldo = Math.round((p.total - (p.monto_pagado || 0)) * 100) / 100;

    if (saldo <= 0) {
      const notice = document.getElementById('noticeBox');
      notice.innerHTML = '<strong><i class="fa-solid fa-circle-check"></i> Este pedido ya está completamente pagado.</strong>';
      notice.style.display = 'block';
      document.getElementById('btnStripe')?.setAttribute('disabled', true);
      return;
    }

    pedidoCreado = { pedido_id: p.id, numero_pedido: p.numero_pedido };
    orderData    = { esSaldo: true, total: saldo };

    const banner = document.getElementById('tipoPagoBanner');
    if (banner) {
      banner.style.display = 'block';
      banner.innerHTML = `<i class="fa-solid fa-circle-info"></i> Pagando el saldo pendiente del pedido <strong>${esc(p.numero_pedido)}</strong> — `
        + `Total del pedido: ${formatCurrency(p.total)} · Ya pagado: ${formatCurrency(p.monto_pagado || 0)}`;
    }

    document.getElementById('shippingLine').style.display = 'none';
    setText('subtotalDisplay', '—');
    setText('totalDisplay',    `<strong>${formatCurrency(saldo)}</strong>`);

    const itemsEl = document.getElementById('cart-items-summary');
    if (itemsEl) {
      itemsEl.innerHTML = `<div class="summary-item"><span>Saldo pendiente</span><span>${formatCurrency(saldo)}</span></div>`;
    }

    initStripe();
    initPayPal();
  } catch (err) {
    const notice = document.getElementById('noticeBox');
    notice.innerHTML = '<strong><i class="fa-solid fa-triangle-exclamation"></i> No se pudo cargar la información del pedido.</strong>';
    notice.style.display = 'block';
    document.getElementById('btnStripe')?.setAttribute('disabled', true);
  }
}

// ── Resumen del pedido ────────────────────────────────────────────
function cargarResumen() {
  let checkout = null;
  try {
    const raw = sessionStorage.getItem('wh_checkout');
    if (raw) checkout = JSON.parse(raw);
  } catch { /* silent */ }

  if (!checkout) {
    const carrito      = JSON.parse(sessionStorage.getItem('wh_carrito') || '[]');
    const deliveryData = JSON.parse(localStorage.getItem('wh_delivery') || '{}');
    if (!carrito.length) {
      document.getElementById('noticeBox').style.display = 'block';
      document.getElementById('btnStripe')?.setAttribute('disabled', true);
      return;
    }
    const subtotal    = carrito.reduce((s, i) => s + (i.precio * i.cantidad), 0);
    const envio       = deliveryData.tipo === 'domicilio' ? 500 : 0;
    const instalacion = deliveryData.instalacion ? 1000 : 0;
    const descuento   = parseFloat(localStorage.getItem('wh_descuento') || '0');
    checkout = {
      items: carrito,
      nombre_cliente: '', correo_cliente: '', telefono_cliente: '',
      tipo_entrega:    deliveryData.tipo === 'envio' ? 'envio' : deliveryData.tipo === 'recoger' ? 'recoger' : (deliveryData.tipo || 'envio'),
      direccion_envio: deliveryData.direccion || '',
      colonia_envio:   deliveryData.colonia   || '',
      ciudad_envio:    deliveryData.ciudad    || '',
      municipio_envio: deliveryData.municipio || '',
      cp_envio:        deliveryData.cp        || '',
      incluye_instalacion: deliveryData.instalacion ? 1 : 0,
      subtotal, costo_envio: envio, costo_instalacion: instalacion,
      total: subtotal + envio + instalacion - descuento,
    };
  }

  const { items: carrito, subtotal, costo_envio: envio, costo_instalacion: instalacion, total } = checkout;

  if (!carrito || carrito.length === 0) {
    document.getElementById('noticeBox').style.display = 'block';
    document.getElementById('btnStripe')?.setAttribute('disabled', true);
    return;
  }

  setText('subtotalDisplay',    formatCurrency(subtotal));
  setText('shippingDisplay',    formatCurrency(envio));
  setText('totalDisplay',       `<strong>${formatCurrency(total)}</strong>`);

  if (instalacion > 0) {
    document.getElementById('installationLine').style.display = 'flex';
    setText('installationDisplay', formatCurrency(instalacion));
  }

  if (checkout.tipo_pago === 'anticipo') {
    const montoAnticipo = Math.round(total * 0.5 * 100) / 100;
    const banner = document.getElementById('tipoPagoBanner');
    if (banner) {
      banner.style.display = 'block';
      banner.innerHTML = `<i class="fa-solid fa-circle-info"></i> Pagando anticipo del 50% — `
        + `Pagas ahora: <strong>${formatCurrency(montoAnticipo)}</strong> · Saldo pendiente: ${formatCurrency(total - montoAnticipo)}`;
    }
  }

  const itemsEl = document.getElementById('cart-items-summary');
  if (itemsEl) {
    itemsEl.innerHTML = carrito.map(i => `
      <div class="summary-item">
        <span>${esc(i.nombre)} × ${Number(i.cantidad)}</span>
        <span>${formatCurrency(i.precio * i.cantidad)}</span>
      </div>`).join('');
  }

  let formData = {};
  try { formData = JSON.parse(localStorage.getItem('wh_checkout_form') || '{}'); } catch {}

  const clienteNombre   = checkout.nombre_cliente   || formData.nombre   || '';
  const clienteCorreo   = checkout.correo_cliente   || formData.correo   || '';
  const clienteTelefono = checkout.telefono_cliente || formData.telefono || '';

  orderData = {
    carrito,
    cliente: {
      nombre:   clienteNombre,
      correo:   clienteCorreo,
      telefono: clienteTelefono,
    },
    deliveryData: {
      tipo:        checkout.tipo_entrega        || 'envio',
      direccion:   checkout.direccion_envio     || '',
      colonia:     checkout.colonia_envio       || '',
      ciudad:      checkout.ciudad_envio        || '',
      municipio:   checkout.municipio_envio     || '',
      cp:          checkout.cp_envio            || '',
      instalacion: !!checkout.incluye_instalacion,
    },
    subtotal, envio, instalacion, descuento: 0, total,
    tipoPago: checkout.tipo_pago === 'anticipo' ? 'anticipo' : 'completo',
  };

  initStripe();
  initPayPal();
}

// ── Stripe ────────────────────────────────────────────────────────
function initStripe() {
  const STRIPE_PK = window.STRIPE_PK || '';
  if (!STRIPE_PK) {
    showError('Error de configuración del pago. Contacta al administrador.');
    return;
  }
  if (!window.Stripe) return;

  stripe = Stripe(STRIPE_PK);
  const elements = stripe.elements({
    locale: 'es',
    appearance: { theme: 'night', variables: { colorPrimary: '#8b6914', fontFamily: 'Arial, sans-serif' } },
  });

  cardElement = elements.create('card', {
    style: { base: { fontSize: '16px', color: '#fff', '::placeholder': { color: '#aaa' } } },
  });

  const cardEl = document.getElementById('card-element');
  if (cardEl) {
    cardElement.mount('#card-element');
    cardElement.on('ready', () => {
      const btn = document.getElementById('btnStripe');
      if (btn) btn.disabled = false;
    });
    cardElement.on('change', (e) => {
      const errEl = document.getElementById('card-errors');
      if (errEl) errEl.textContent = e.error ? e.error.message : '';
    });
  }

  const btnStripe = document.getElementById('btnStripe');
  if (btnStripe) btnStripe.addEventListener('click', pagarConStripe);
}

async function pagarConStripe() {
  if (!orderData) {
    showError('No hay datos del pedido. Regresa al carrito e intenta nuevamente.');
    return;
  }
  const btn     = document.getElementById('btnStripe');
  const spinner = document.getElementById('stripeSpinner');
  btn.disabled  = true;
  if (spinner) spinner.style.display = 'inline-block';

  try {
    if (!pedidoCreado) pedidoCreado = await crearPedidoEnBD();

    const intentRes  = await fetch(`${API_BASE}/pagos.php?action=stripe_intent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedidoCreado.pedido_id }),
    });
    const intentData = await intentRes.json();
    if (!intentData.success) throw new Error(intentData.error || 'Error al iniciar pago');

    const result = await stripe.confirmCardPayment(intentData.client_secret, {
      payment_method: { card: cardElement },
    });
    if (result.error) throw new Error(result.error.message);

    const confirmRes  = await fetch(`${API_BASE}/pagos.php?action=stripe_confirm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_intent_id: result.paymentIntent.id, pedido_id: pedidoCreado.pedido_id }),
    });
    const confirmData = await confirmRes.json();
    if (confirmData.success) {
      irAConfirmacion();
    } else {
      throw new Error(confirmData.error || 'Error confirmando pago');
    }
  } catch (err) {
    showError(err.message || 'Error en el pago. Intenta nuevamente.');
    btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}

// ── PayPal ────────────────────────────────────────────────────────
function initPayPal() {
  if (!window.paypal) {
    console.warn('[PayPal] SDK no cargado - verificar Client ID en .env');
    const ppContainer = document.getElementById('paypal-button-container');
    if (ppContainer) ppContainer.innerHTML = '<p style="color:#e74c3c;font-size:13px;">⚠ PayPal no disponible. Usa Stripe.</p>';
    return;
  }

  paypal.Buttons({
    style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },

    createOrder: async (_pp, actions) => {
      try {
        if (!pedidoCreado) pedidoCreado = await crearPedidoEnBD();
        const res  = await fetch(`${API_BASE}/pagos.php?action=paypal_orden`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pedido_id: pedidoCreado.pedido_id }),
        });
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          throw new Error('Error del servidor al crear orden PayPal. Intenta con Stripe.');
        }
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error al crear orden PayPal');
        return data.order_id;
      } catch (err) {
        showError(err.message || 'No se pudo iniciar el pago con PayPal.');
        throw err;
      }
    },

    onApprove: async (data, actions) => {
      try {
        const res    = await fetch(`${API_BASE}/pagos.php?action=paypal_capturar`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: data.orderID, pedido_id: pedidoCreado?.pedido_id }),
        });
        const result = await res.json();
        if (result.success) { irAConfirmacion(); }
        else { throw new Error(result.error || 'Error al capturar pago PayPal'); }
      } catch (err) { showError(err.message || 'Error en el pago PayPal'); }
    },

    onError:  (err) => {
      console.error('[PayPal Error]', err);
      showError('Error con PayPal: ' + (err.message || 'Intenta con Stripe o recarga la página.'));
    },
    onCancel: ()    => { showError('Pago cancelado. Puedes intentarlo nuevamente.', 'warning'); },
  }).render('#paypal-button-container');
}

// ── Crear pedido en BD ────────────────────────────────────────────
async function crearPedidoEnBD() {
  if (!orderData) {
    const msg = 'No hay datos del pedido. Regresa al carrito e intenta nuevamente.';
    showError(msg); throw new Error(msg);
  }

  const clienteData = {
    nombre:   orderData.cliente?.nombre   || '',
    correo:   orderData.cliente?.correo   || '',
    telefono: orderData.cliente?.telefono || '',
  };

  if (!clienteData.nombre || clienteData.nombre.length < 3) {
    const msg = 'Por favor ingresa tu nombre completo en el carrito antes de pagar.';
    showError(msg);
    throw new Error(msg);
  }
  if (!clienteData.correo || !isValidEmailPago(clienteData.correo)) {
    const msg = 'Por favor ingresa un correo electrónico válido en el carrito antes de pagar.';
    showError(msg);
    throw new Error(msg);
  }

  try {
    const body = {
      nombre_cliente:      clienteData.nombre,
      correo_cliente:      clienteData.correo,
      telefono_cliente:    clienteData.telefono || '',
      tipo_entrega:        orderData.deliveryData.tipo === 'envio' ? 'envio' : orderData.deliveryData.tipo === 'recoger' ? 'recoger' : (orderData.deliveryData.tipo || 'envio'),
      direccion_envio:     orderData.deliveryData.direccion || '',
      colonia_envio:       orderData.deliveryData.colonia   || '',
      ciudad_envio:        orderData.deliveryData.ciudad    || '',
      municipio_envio:     orderData.deliveryData.municipio || '',
      cp_envio:            orderData.deliveryData.cp        || '',
      incluye_instalacion: !!orderData.deliveryData.instalacion,
      items:               orderData.carrito.map(i => ({ producto_id: i.id, cantidad: i.cantidad })),
      descuento:           orderData.descuento || 0,
      tipo_pago:           orderData.tipoPago || 'completo',
    };

    const res  = await fetch(`${API_BASE}/pedidos.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Error al registrar pedido en el servidor');

    localStorage.setItem('wh_pedido_creado', JSON.stringify(data));
    return data;
  } catch (err) {
    showError('Error al registrar pedido: ' + err.message);
    throw err;
  }
}

// ── Métodos de pago (ambas pasarelas visibles simultáneamente) ────
// Los bloques Stripe y PayPal son siempre visibles; no hay selector de método.

// ── Confirmación ──────────────────────────────────────────────────
function irAConfirmacion() {
  const pedido = JSON.parse(localStorage.getItem('wh_pedido_creado') || 'null') || pedidoCreado;
  sessionStorage.removeItem('wh_checkout');
  sessionStorage.removeItem('wh_carrito');
  localStorage.removeItem('wh_delivery');
  localStorage.removeItem('wh_cliente');
  localStorage.removeItem('wh_descuento');
  localStorage.removeItem('wh_pedido_creado');
  localStorage.removeItem('wh_checkout_form');

  if (pedido?.token_seguimiento) {
    window.location.href = `/seguimiento?token=${pedido.token_seguimiento}&pedido=${pedido.numero_pedido}`;
  } else {
    window.location.href = '/seguimiento?pago=exitoso';
  }
}

// ── Helpers ───────────────────────────────────────────────────────
function setText(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function formatCurrency(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n || 0));
}

function showError(msg, type = 'error') {
  const errEl = document.getElementById('card-errors');
  if (errEl) {
    errEl.textContent = msg;
    errEl.className   = type === 'warning' ? 'card-error warning' : 'card-error';
    errEl.style.display = msg ? 'block' : 'none';
    if (msg) errEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  const globalErr = document.getElementById('payment-error-global');
  if (globalErr) {
    globalErr.textContent = msg;
    globalErr.style.display = msg ? 'block' : 'none';
  }
  if (!errEl && !globalErr) alert(msg);
}


// ── Validación de email RFC ───────────────────────────────────────
function isValidEmailPago(email) {
  if (typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  if (/['"`;\\]/.test(clean)) return false;
  return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(clean);
}

// ── Menú hamburguesa ─────────────────────────────────────────────
function initMenuHamburguesa() {
  const menuToggle = document.getElementById('menuToggle');
  const navLinks   = document.getElementById('navLinks');
  if (!menuToggle || !navLinks) return;
  menuToggle.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    navLinks.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', navLinks.classList.contains('open'));
  });
  document.addEventListener('click', function (e) {
    if (!menuToggle.contains(e.target) && !navLinks.contains(e.target)) {
      navLinks.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });
}
