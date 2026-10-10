const API_BASE = '/api';

function _refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
}

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
  initBusqueda();
  initOrden();
  // Enlaces desde el inicio (/catalogo?categoria=cocinas|closets) abren
  // directo la explicación de diseño a la medida.
  const catUrl = new URLSearchParams(location.search).get('categoria');
  if (catUrl === 'cocinas' || catUrl === 'closets') {
    seleccionarCategoriaPrincipal(catUrl, document.querySelector(`.main-cat-btn[data-main-cat="${catUrl}"]`));
  } else {
    await cargarProductos();
  }
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
  // Catálogo 2026: una sola categoría (Muebles de baño) — los chips de
  // filtro solo estorban; vuelven solos si algún día hay más de una.
  // (d-none y no style.display: el contenedor trae d-flex de Bootstrap con !important)
  container.classList.toggle('d-none', state.categorias.length <= 1);
  if (state.categorias.length <= 1) return;
  container.innerHTML = `
    <button class="filter-btn active" data-cat-filter="">Todos</button>
    ${state.categorias.map(cat => `
      <button class="filter-btn" data-cat-filter="${cat.id}">${escHtml(cat.nombre)}</button>
    `).join('')}
  `;
}

// ---- Categorías principales: Baños / Cocinas / Closets ----
// "Baños" usa el catálogo real. Cocinas y Closets no tienen modelos: se cotizan a la medida.
function seleccionarCategoriaPrincipal(cat, btnEl) {
  document.querySelectorAll('.main-cat-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  const headerFiltros = document.querySelector('.catalog-header');

  if (cat === 'banos') {
    if (headerFiltros) headerFiltros.classList.remove('d-none');
    document.getElementById('accesoriosSeccion')?.classList.remove('d-none');
    state.filtro.categoria = null;
    document.querySelectorAll('#categorias-filtro .filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#categorias-filtro .filter-btn[data-cat-filter=""]')?.classList.add('active');
    cargarProductos(true);
    return;
  }

  if (headerFiltros) headerFiltros.classList.add('d-none'); // d-flex de Bootstrap trae !important
  // Ovalines/monomandos/cubiertas son del catálogo de baño — no aplican aquí.
  document.getElementById('accesoriosSeccion')?.classList.add('d-none');
  const esCocina = cat === 'cocinas';
  const nombre   = esCocina ? 'cocina' : 'clóset';
  const tipo     = esCocina ? 'cocina' : 'closet';

  // Cocinas y clósets no tienen modelos de catálogo: se diseñan 100% a la
  // medida del espacio y de las ideas del cliente, así que solo se piden por
  // cotización (que incluye visita/medidas y diseño 3D).
  const grid = document.getElementById('productos-grid');
  if (grid) {
    grid.innerHTML = `
      <div class="a-medida-box">
        <div class="a-medida-icono"><i data-lucide="${esCocina ? 'cooking-pot' : 'shirt'}"></i></div>
        <h2>Tu ${escHtml(nombre)} se diseña a la medida</h2>
        <p>No vendemos ${esCocina ? 'cocinas' : 'clósets'} de catálogo: cada proyecto se diseña para tu espacio, tus medidas y tus ideas. Así funciona:</p>
        <ol class="a-medida-pasos">
          <li><strong>Pide tu cotización.</strong> Cuéntanos qué buscas y, si puedes, manda medidas aproximadas y fotos del lugar o de ideas que te gusten.</li>
          <li><strong>Te contactamos.</strong> Afinamos medidas, colores y acabados contigo (podemos ir a medir).</li>
          <li><strong>Diseño 3D sin costo</strong> para que veas cómo quedará antes de producir (proyectos confirmados con anticipo).</li>
          <li><strong>Fabricamos e instalamos.</strong></li>
        </ol>
        <a href="/solicitudes?tipo=${tipo}" class="a-medida-cta"><i data-lucide="receipt"></i> Cotizar mi ${escHtml(nombre)}</a>
      </div>`;
    _refreshIcons();
  }

  const contador = document.getElementById('productos-count');
  if (contador) contador.textContent = 'Diseño a la medida · solo por cotización';

  const paginacion = document.getElementById('paginacion-container');
  if (paginacion) paginacion.innerHTML = '';
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
      <p><i data-lucide="triangle-alert"></i> No se pudieron cargar los productos.</p>
      <button data-call="cargarProductos" class="btn-reload">Reintentar</button>
    </div>`;
    _refreshIcons();
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
        <p><i data-lucide="package-search"></i> No se encontraron productos</p>
        <button data-call="limpiarFiltros" class="btn-secondary" style="margin-top:10px;">Limpiar filtros</button>
      </div>`;
    _refreshIcons();
    return;
  }

  grid.innerHTML = state.allProducts.map(p => {
    const imgSrc = p.imagen_principal
      ? `<img src="${escHtml(p.imagen_principal)}" alt="${escHtml(p.nombre)}" loading="lazy" data-lightbox data-img-fallback="ph-${p.id}" class="wh-img-zoom">`
      : '';
    const imgPlaceholder = `<div class="placeholder-imagen" id="ph-${p.id}" ${p.imagen_principal ? 'style="display:none"' : ''}><i data-lucide="tree-pine"></i></div>`;
    const badge = p.etiqueta ? `<div class="product-badge">${escHtml(p.etiqueta)}</div>` : '';
    const medidas = p.medidas || [];
    const precio = (medidas.length ? 'Desde ' : '') + formatCurrency(p.precio);
    const rango = medidas.length
      ? (medidas.length > 1 ? `${medidas[0].ancho_cm} a ${medidas[medidas.length - 1].ancho_cm} cm de ancho` : `${medidas[0].ancho_cm} cm de ancho`)
      : '';
    // Con varios anchos el precio depende de cuál elija: se elige en el
    // detalle, no se agrega a ciegas desde la tarjeta.
    const boton = medidas.length
      ? `<a href="/detalle/${p.id}" class="btn-add-cart" style="text-decoration:none;"><i data-lucide="ruler"></i> Elegir medida</a>`
      : `<button class="btn-add-cart"
              data-id="${p.id}"
              data-nombre="${escHtml(p.nombre)}"
              data-precio="${p.precio}"
              data-imagen="${escHtml(p.imagen_principal || '')}">
              <i data-lucide="shopping-cart"></i> Agregar al carrito
            </button>`;

    return `
      <div class="product-card">
        <div class="product-image">
          ${imgSrc}${imgPlaceholder}
          ${badge}
        </div>
        <div class="product-info">
          <div class="product-name">${escHtml(p.nombre)}</div>
          <div class="product-category">${escHtml(rango || p.categoria_nombre || '')}</div>
          <div class="product-price-section">
            <span class="price">${precio}</span>
          </div>
          <div class="product-actions">
            ${boton}
            <a href="/detalle/${p.id}" class="btn-details">Ver detalles</a>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Bind cart buttons after render
  document.querySelectorAll('.btn-add-cart[data-id]').forEach(btn => {
    btn.addEventListener('click', function () { agregarAlCarritoBtn(this); });
  });
  _refreshIcons();
}

// ---- Paginación ----
function renderPaginacion(pag) {
  const container = document.getElementById('paginacion-container');
  if (!container || !pag || pag.total_paginas <= 1) {
    if (container) container.innerHTML = '';
    return;
  }
  let btns = '';
  if (pag.hay_anterior) btns += `<button data-call="irAPagina" data-args="[${state.page - 1}]"><i data-lucide="chevron-left"></i> Anterior</button>`;
  btns += `<span class="pag-info">Página ${pag.pagina} de ${pag.total_paginas}</span>`;
  if (pag.hay_siguiente) btns += `<button data-call="irAPagina" data-args="[${state.page + 1}]">Siguiente <i data-lucide="chevron-right"></i></button>`;
  container.innerHTML = `<div class="paginacion-btns">${btns}</div>`;
  _refreshIcons();
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

  // Las categorías reales actuales son todas de baños — mantiene sincronizado el botón principal
  document.querySelectorAll('.main-cat-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.main-cat-btn[data-main-cat="banos"]')?.classList.add('active');

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
    showToast('<i data-lucide="triangle-alert"></i> Confirma tu correo antes de agregar al carrito', 'error');
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
  showToast(`<i data-lucide="circle-check"></i> ${nombre} agregado al carrito`);
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
  toast.innerHTML = msg;  // innerHTML para que rendericen los íconos Lucide (data-lucide)
  document.body.appendChild(toast);
  _refreshIcons();
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Exponer globales
window.filtrarPorCategoria = filtrarPorCategoria;
window.seleccionarCategoriaPrincipal = seleccionarCategoriaPrincipal;
window.limpiarFiltros = limpiarFiltros;
window.agregarAlCarrito = agregarAlCarrito;
window.agregarAlCarritoBtn = agregarAlCarritoBtn;
window.irAPagina = irAPagina;
window.cargarProductos = cargarProductos;