let carritoItems = [];
let carritoTotal = 0;
let _carritoRecuperado = false; // flag para notificar recuperación de carrito

function _refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
}

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initMenuHamburguesa();
  cargarCarrito();
  renderizarCarrito();
  actualizarResumen();

  if (_carritoRecuperado) {
    _carritoRecuperado = false;
    setTimeout(() => {
      if (typeof showNotification === 'function') {
        showNotification('<i data-lucide="rotate-ccw"></i> Carrito recuperado de tu visita anterior', 'info');
      }
    }, 600);
  }

  const btnVaciar    = document.getElementById('btn-vaciar-carrito');
  const btnContinuar = document.getElementById('btn-continuar-comprando');
  const btnProceder  = document.getElementById('btn-proceder-pago');

  if (btnVaciar)    btnVaciar.addEventListener('click', confirmarVaciarCarrito);
  if (btnContinuar) btnContinuar.addEventListener('click', () => { window.location.href = '/catalogo'; });
  if (btnProceder)  btnProceder.addEventListener('click', procederAlPago);
});

// ── Carrito (sessionStorage + localStorage backup) ────────────────
function cargarCarrito() {
  try {
    const raw = sessionStorage.getItem('wh_carrito');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Sanitizar cada item al cargar — previene XSS almacenado en sessionStorage
      carritoItems = Array.isArray(parsed) ? parsed.map(sanitizarItem) : [];
      return;
    }
    // Si sessionStorage está vacío (nueva sesión / se cerró el navegador),
    // intentar recuperar desde el backup de localStorage
    const backup = localStorage.getItem('wh_carrito_backup');
    if (backup) {
      const parsed = JSON.parse(backup);
      const items  = Array.isArray(parsed) ? parsed.map(sanitizarItem) : [];
      if (items.length > 0) {
        carritoItems = items;
        sessionStorage.setItem('wh_carrito', JSON.stringify(carritoItems));
        _carritoRecuperado = true;
        return;
      }
    }
  } catch { /* silent */ }
  carritoItems = [];
}

function guardarCarrito() {
  try {
    const data = JSON.stringify(carritoItems);
    sessionStorage.setItem('wh_carrito', data);
    // Respaldo en localStorage para recuperación del carrito en próxima sesión
    if (carritoItems.length > 0) {
      localStorage.setItem('wh_carrito_backup', data);
    } else {
      localStorage.removeItem('wh_carrito_backup');
    }
    if (typeof updateCartBadge === 'function') {
      updateCartBadge(carritoItems.reduce((t, i) => t + i.cantidad, 0));
    }
  } catch { /* silent */ }
}

// ── Sanitización ──────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// previene XSS almacenado en sessionStorage
function sanitizarItem(item) {
  const precio   = parseFloat(item.precio);
  const cantidad = parseInt(item.cantidad);
  const id       = parseInt(item.id);
  return {
    id:       isNaN(id)       ? 0 : id,
    nombre:   String(item.nombre   ?? 'Producto').replace(/<[^>]*>/g, '').substring(0, 150).trim(),
    precio:   isNaN(precio)   ? 0 : Math.max(0, precio),
    cantidad: isNaN(cantidad) ? 1 : Math.min(Math.max(1, cantidad), 99),
    imagen:   sanitizarUrl(item.imagen),
    categoria: String(item.categoria ?? '').replace(/<[^>]*>/g, '').substring(0, 80).trim(),
    material:  String(item.material  ?? '').replace(/<[^>]*>/g, '').substring(0, 80).trim(),
  };
}

// Permite solo rutas relativas seguras; rechaza javascript:, data:, etc.
function sanitizarUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const limpia = url.trim();
  if (/^(javascript|data|vbscript):/i.test(limpia)) return '';
  if (limpia.startsWith('/') || limpia.startsWith('./')) return limpia;
  try {
    const parsed = new URL(limpia);
    if (parsed.origin === window.location.origin) return limpia;
  } catch { /* URL inválida */ }
  return '';
}

// ── Render ────────────────────────────────────────────────────────
function renderizarCarrito() {
  const container  = document.getElementById('carrito-items');
  if (!container) return;
  const accionesEl = document.getElementById('carrito-acciones');
  const resumenEl  = document.getElementById('carrito-resumen');

  if (carritoItems.length === 0) {
    container.innerHTML = `
      <div class="carrito-vacio">
        <div class="empty-cart-icon"><i data-lucide="shopping-cart"></i></div>
        <h3>Tu carrito está vacío</h3>
        <p>Agrega productos desde nuestro catálogo</p>
        <a href="/catalogo" class="btn-primary">Ver Catálogo</a>
      </div>`;
    if (accionesEl) accionesEl.style.display = 'none';
    if (resumenEl)  resumenEl.style.display  = 'none';
    _refreshIcons();
    return;
  }

  if (accionesEl) accionesEl.style.display = 'flex';
  if (resumenEl)  resumenEl.style.display  = 'block';

  container.innerHTML = carritoItems.map(item => `
    <div class="carrito-item" data-producto-id="${item.id}">
      <div class="item-imagen">
        ${item.imagen
          ? `<img src="${item.imagen}" alt="${esc(item.nombre)}">`
          : '<div class="placeholder-imagen"><i data-lucide="package"></i></div>'}
      </div>
      <div class="item-info">
        <h3>${esc(item.nombre)}</h3>
        <p class="item-precio">${formatCurrency(item.precio)} c/u</p>
      </div>
      <div class="item-cantidad">
        <button class="btn-cantidad" data-call="cambiarCantidad" data-args="[${item.id},-1]">-</button>
        <input type="number" value="${item.cantidad}" min="1" max="99" data-item-id="${item.id}">
        <button class="btn-cantidad" data-call="cambiarCantidad" data-args="[${item.id},1]">+</button>
      </div>
      <div class="item-subtotal">
        <p class="subtotal-label">Subtotal:</p>
        <p class="subtotal-precio">${formatCurrency(item.precio * item.cantidad)}</p>
      </div>
      <button class="btn-eliminar" data-call="eliminarItem" data-args="[${item.id}]" title="Eliminar">
        <i data-lucide="trash-2"></i>
      </button>
    </div>
  `).join('');
  _refreshIcons();

  container.querySelectorAll('input[data-item-id]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      actualizarCantidad(parseInt(this.dataset.itemId), this.value);
    });
  });
}

function actualizarResumen() {
  const subtotal = carritoItems.reduce((t, i) => t + (i.precio * i.cantidad), 0);
  const envio    = subtotal > 5000 ? 0 : 200;
  carritoTotal   = subtotal + envio;

  const subtotalEl = document.getElementById('resumen-subtotal');
  const envioEl    = document.getElementById('resumen-envio');
  const totalEl    = document.getElementById('resumen-total');

  if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
  if (envioEl)    envioEl.textContent    = envio === 0 ? 'GRATIS' : formatCurrency(envio);
  if (totalEl)    totalEl.textContent    = formatCurrency(carritoTotal);

  const msgEnvio = document.getElementById('mensaje-envio');
  if (msgEnvio) {
    if (subtotal > 0 && subtotal < 5000) {
      msgEnvio.innerHTML    = `<i data-lucide="lightbulb"></i> Agrega ${formatCurrency(5000 - subtotal)} más para obtener <strong>envío GRATIS</strong>`;
      msgEnvio.style.display = 'block';
      _refreshIcons();
    } else if (subtotal >= 5000) {
      msgEnvio.innerHTML    = `<i data-lucide="circle-check"></i> ¡Felicidades! Tienes <strong>envío GRATIS</strong>`;
      msgEnvio.style.display = 'block';
      _refreshIcons();
    }
  }
}

// ── Acciones de items ─────────────────────────────────────────────
function cambiarCantidad(productoId, delta) {
  const item = carritoItems.find(i => i.id === productoId);
  if (!item) return;
  const nueva = item.cantidad + delta;
  if (nueva <= 0) { eliminarItem(productoId); return; }
  if (nueva <= 99) {
    item.cantidad = nueva;
    guardarCarrito(); renderizarCarrito(); actualizarResumen();
  }
}

function actualizarCantidad(productoId, valor) {
  const cantidad = parseInt(valor);
  if (isNaN(cantidad) || cantidad < 1) {
    showNotification('<i data-lucide="x"></i> Cantidad inválida', 'error');
    renderizarCarrito(); return;
  }
  if (cantidad > 99) {
    showNotification('<i data-lucide="x"></i> Cantidad máxima: 99', 'error');
    renderizarCarrito(); return;
  }
  const item = carritoItems.find(i => i.id === productoId);
  if (item) {
    item.cantidad = cantidad;
    guardarCarrito(); renderizarCarrito(); actualizarResumen();
  }
}

function eliminarItem(productoId) {
  const item = carritoItems.find(i => i.id === productoId);
  if (!item) return;
  if (confirm(`¿Eliminar "${item.nombre}" del carrito?`)) {
    carritoItems = carritoItems.filter(i => i.id !== productoId);
    guardarCarrito(); renderizarCarrito(); actualizarResumen();
    showNotification('<i data-lucide="trash-2"></i> Producto eliminado', 'info');
  }
}

function confirmarVaciarCarrito() {
  if (carritoItems.length === 0) { showNotification('El carrito ya está vacío', 'info'); return; }
  if (confirm('¿Vaciar el carrito? Se eliminarán los productos y los datos del formulario.')) {
    carritoItems = [];

    sessionStorage.removeItem('wh_carrito');
    sessionStorage.removeItem('wh_checkout');

    ['wh_checkout_form', 'wh_delivery', 'wh_cliente', 'wh_descuento', 'wh_carrito_backup'].forEach(k => localStorage.removeItem(k));

    ['clienteNombre','clienteTelefono','clienteCorreo',
     'clienteDireccion','clienteCiudad','clienteCP','clienteNotas']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    const semanaSelec = document.getElementById('semanaSeleccionada');
    const fechaSuger  = document.getElementById('fechaSugerida');
    const fechaBox    = document.getElementById('fechaResumenBox');
    if (semanaSelec) semanaSelec.value = '';
    if (fechaSuger)  fechaSuger.value  = '';
    if (fechaBox)    fechaBox.style.display = 'none';
    document.querySelectorAll('.semana-card.seleccionada, .dia-card.seleccionada')
      .forEach(c => c.classList.remove('seleccionada'));

    if (typeof seleccionarEntrega    === 'function') seleccionarEntrega('recoger', false);
    if (typeof seleccionarInstalacion === 'function') seleccionarInstalacion(false);

    guardarCarrito();
    renderizarCarrito();
    actualizarResumen();
    showNotification('<i data-lucide="trash-2"></i> Carrito y datos vaciados', 'success');
  }
}

async function procederAlPago() {
  if (carritoItems.length === 0) {
    showNotification('<i data-lucide="x"></i> El carrito está vacío', 'error'); return;
  }
  const loader = showLoader('Verificando disponibilidad...');
  try {
    await new Promise(resolve => setTimeout(resolve, 500));
    hideLoader();
    window.location.href = '/pago';
  } catch {
    hideLoader();
    showNotification('<i data-lucide="x"></i> Error al procesar. Intenta nuevamente.', 'error');
  }
}

function obtenerDatosCarrito() {
  const subtotal = carritoItems.reduce((t, i) => t + (i.precio * i.cantidad), 0);
  const envio    = subtotal > 5000 ? 0 : 200;
  return {
    items: carritoItems, subtotal, envio,
    total: subtotal + envio,
    count: carritoItems.reduce((t, i) => t + i.cantidad, 0),
  };
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

// ── Exports ───────────────────────────────────────────────────────
window.cambiarCantidad     = cambiarCantidad;
window.actualizarCantidad  = actualizarCantidad;
window.eliminarItem        = eliminarItem;
window.obtenerDatosCarrito = obtenerDatosCarrito;
