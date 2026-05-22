const API_BASE = '/api';

let state = {
  productos: [],
  allProducts: [],
  categorias: [],
  page: 1,
  limit: 12,
  totalPaginas: 1,
  filtro: {
    categoria: null,
    busqueda: '',
    orden: 'recientes',

  },
  loading: false,
};

// ---- Inicializar ----
document.addEventListener('DOMContentLoaded', async () => {
  initNavHamburger();
  initCartBadge();
  await cargarCategorias();
  await cargarProductos();
  initBusqueda();
  initOrden();
});

// ---- Nav hamburger ----
function initNavHamburger() {
  const toggle = document.getElementById('menuToggle');
  const nav    = document.getElementById('navLinks');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !nav.contains(e.target)) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// ---- Cart badge ----
function initCartBadge() {
  const badge = document.getElementById('cartCount');
  if (!badge) return;
  const carrito = JSON.parse(sessionStorage.getItem('wh_carrito') || '[]');
  const total = carrito.reduce((s, i) => s + (i.cantidad || 0), 0);
  badge.textContent = total;
  badge.style.display = total > 0 ? 'inline-block' : 'none';
}

// ---- Cargar categorías ----
async function cargarCategorias() {
  try {
    const res  = await fetch(`${API_BASE}/categorias.php`);
    const data = await res.json();
    if (data.success) {
      state.categorias = data.categorias || [];
      renderCategorias();
    }
  } catch (e) { console.warn('Categorías no disponibles:', e); }
}

function renderCategorias() {
  const container = document.getElementById('categorias-filtro');
  if (!container) return;
  container.innerHTML = `
    <button class="filter-btn active" onclick="filtrarPorCategoria(null, this)">Todos</button>
    ${state.categorias.map(cat => `
      <button class="filter-btn" onclick="filtrarPorCategoria(${cat.id}, this)">${escHtml(cat.nombre)}</button>
    `).join('')}
  `;
}

// ---- Cargar productos desde API ----
async function cargarProductos(resetPage = false) {
  if (state.loading) return;
  state.loading = true;
  if (resetPage) state.page = 1;

  const grid = document.getElementById('productos-grid');
  grid.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando productos...</p></div>`;

  let url = `${API_BASE}/productos.php?page=${state.page}&limit=${state.limit}&orden=${state.filtro.orden}`;
  if (state.filtro.categoria)  url += `&categoria_id=${state.filtro.categoria}`;
  if (state.filtro.busqueda)   url += `&busqueda=${encodeURIComponent(state.filtro.busqueda)}`;


  try {
    const res  = await fetch(url);
    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'Error de API');

    state.allProducts = data.productos || [];
    state.totalPaginas = data.paginacion?.total_paginas || 1;

    renderProductos();
    renderPaginacion(data.paginacion);

    const contador = document.getElementById('productos-count');
    if (contador) {
      const n = data.paginacion?.total || state.allProducts.length;
      contador.textContent = `${n} producto${n !== 1 ? 's' : ''} encontrado${n !== 1 ? 's' : ''}`;
    }
  } catch (e) {
    console.error('Error cargando productos:', e);
    grid.innerHTML = `<div class="error-state">
      <p><i class="fa-solid fa-triangle-exclamation"></i> No se pudieron cargar los productos.</p>
      <button onclick="cargarProductos()" class="btn-reload">Reintentar</button>
    </div>`;
  } finally {
    state.loading = false;
  }
}

// ---- Render productos ----
function renderProductos() {
  const grid = document.getElementById('productos-grid');
  if (!grid) return;

  if (!state.allProducts.length) {
    grid.innerHTML = `
      <div class="no-productos" style="grid-column:1/-1; text-align:center; padding:40px;">
        <p><i class="fa-solid fa-box"></i> No se encontraron productos</p>
        <button onclick="limpiarFiltros()" class="btn-secondary" style="margin-top:10px;">Limpiar filtros</button>
      </div>`;
    return;
  }

  grid.innerHTML = state.allProducts.map(p => {
    const imgSrc = p.imagen_principal
      ? `<img src="${escHtml(p.imagen_principal)}" alt="${escHtml(p.nombre)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const imgPlaceholder = `<div class="placeholder-imagen" ${p.imagen_principal ? 'style="display:none"' : ''}><i class="fa-solid fa-tree"></i></div>`;
    const badge = p.etiqueta ? `<div class="product-badge">${escHtml(p.etiqueta)}</div>` : '';
    const stockBadge = '';
    const precio = formatCurrency(p.precio);

    return `
      <div class="product-card">
        <div class="product-image">
          ${imgSrc}${imgPlaceholder}
          ${badge}
          ${stockBadge}
        </div>
        <div class="product-info">
          <div class="product-name">${escHtml(p.nombre)}</div>
          <div class="product-category">${escHtml(p.categoria_nombre || '')}</div>
          <div class="product-price-section">
            <span class="price">${precio}</span>
          </div>
          <div class="product-actions">
<button class="btn-add-cart" onclick="agregarAlCarrito(${p.id}, '${escHtml(p.nombre).replace(/'/g,"\\'")}', ${p.precio}, '${escHtml(p.imagen_principal || '')}')">
                   <i class="fa-solid fa-cart-shopping"></i> Agregar al carrito
                 </button>
            <a href="/detalle/${p.id}" class="btn-details">Ver detalles</a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ---- Paginación ----
function renderPaginacion(pag) {
  const container = document.getElementById('paginacion-container');
  if (!container || !pag || pag.total_paginas <= 1) {
    if (container) container.innerHTML = '';
    return;
  }
  let btns = '';
  if (pag.hay_anterior) btns += `<button onclick="irAPagina(${state.page - 1})"><i class="fa-solid fa-chevron-left"></i> Anterior</button>`;
  btns += `<span class="pag-info">Página ${pag.pagina} de ${pag.total_paginas}</span>`;
  if (pag.hay_siguiente) btns += `<button onclick="irAPagina(${state.page + 1})">Siguiente <i class="fa-solid fa-chevron-right"></i></button>`;
  container.innerHTML = `<div class="paginacion-btns">${btns}</div>`;
}

function irAPagina(n) {
  state.page = n;
  cargarProductos(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- Filtros ----
function filtrarPorCategoria(catId, btnEl) {
  state.filtro.categoria = catId;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  cargarProductos(true);
}

function initBusqueda() {
  const input = document.getElementById('buscar-producto');
  const btn   = document.getElementById('btn-buscar');
  if (input) {
    // Bloquear caracteres especiales peligrosos en tiempo real
    input.addEventListener('input', function () {
      this.value = this.value.replace(/[<>"'&;{}()[\]\\`]/g, '');
      const val = this.value.trim();
      if (val.length === 0 || val.length >= 2) debounce(ejecutarBusqueda, 500)();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') ejecutarBusqueda();
    });
  }
  if (btn) btn.addEventListener('click', ejecutarBusqueda);
}

function ejecutarBusqueda() {
  const input = document.getElementById('buscar-producto');
  // Sanitizar: eliminar caracteres especiales y limitar longitud
  const valor = (input?.value || '')
    .replace(/[<>"'&;{}()[\]\\`]/g, '')
    .trim()
    .substring(0, 100);
  if (input) input.value = valor;
  state.filtro.busqueda = valor;
  cargarProductos(true);
}

function initOrden() {
  const sel = document.getElementById('ordenar-por');
  if (sel) sel.addEventListener('change', (e) => {
    state.filtro.orden = e.target.value;
    cargarProductos(true);
  });
}

function limpiarFiltros() {
  state.filtro = { categoria: null, busqueda: '', orden: 'recientes' };
  const input = document.getElementById('buscar-producto');
  const sel   = document.getElementById('ordenar-por');
  if (input) input.value = '';
  if (sel)   sel.value   = 'recientes';
  document.querySelectorAll('.filter-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  cargarProductos(true);
}

// ---- Carrito ----
function agregarAlCarritoBtn(btn) {
  const id     = parseInt(btn.dataset.id);
  const nombre = btn.dataset.nombre;
  const precio = parseFloat(btn.dataset.precio);
  const imagen = btn.dataset.imagen || '';
  agregarAlCarrito(id, nombre, precio, imagen);
}

function agregarAlCarrito(id, nombre, precio, imagen) {
  // Bloquear si el cliente está autenticado pero su correo no está verificado
  if (typeof AuthModal !== 'undefined' && AuthModal.isAuthenticated() && !AuthModal.isEmailVerified()) {
    showToast('<i class="fa-solid fa-triangle-exclamation"></i> Confirma tu correo antes de agregar al carrito', 'error');
    return;
  }

  let carrito = JSON.parse(sessionStorage.getItem('wh_carrito') || '[]');
  const exist = carrito.find(i => i.id === id);
  if (exist) {
    exist.cantidad += 1;
  } else {
    carrito.push({ id, nombre, precio, imagen, cantidad: 1 });
  }
  sessionStorage.setItem('wh_carrito', JSON.stringify(carrito));
  const badge = document.getElementById('cartCount');
  if (badge) {
    const total = carrito.reduce((s, i) => s + i.cantidad, 0);
    badge.textContent = total;
    badge.style.display = 'inline-block';
  }
  showToast(`<i class="fa-solid fa-circle-check"></i> ${nombre} agregado al carrito`);
}

// ---- Utilidades ----
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatCurrency(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n || 0));
}

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `wh-toast ${type}`;
  toast.innerHTML = msg;  // innerHTML para que rendericen los íconos de Font Awesome
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Exponer globales
window.filtrarPorCategoria = filtrarPorCategoria;
window.limpiarFiltros = limpiarFiltros;
window.agregarAlCarrito = agregarAlCarrito;
window.agregarAlCarritoBtn = agregarAlCarritoBtn;
window.irAPagina = irAPagina;