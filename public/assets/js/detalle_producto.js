// =============================================================
// Wooden House - Detalle Producto (conectado a API real)
// =============================================================
const API_BASE = '/api';

let productoActual = null;
let imagenIndex    = 0;

function _refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', () => {
  initNavHamburger();
  initCartBadge();
  initTabs();
  cargarProducto();
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

// ---- Tabs ----
function initTabs() {
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });
}

// ---- Cargar producto desde API ----
async function cargarProducto() {
  const params    = new URLSearchParams(window.location.search);
  let productId = params.get('id');

  // Fallback: leer ID del path (/detalle/123)
  if (!productId) {
    const match = window.location.pathname.match(/\/detalle\/(\d+)/);
    if (match) productId = match[1];
  }

  if (!productId) {
    mostrarError();
    return;
  }

  try {
    const res  = await fetch(`${API_BASE}/productos.php?id=${productId}`);
    const data = await res.json();

    if (!data.success || !data.producto) {
      mostrarError();
      return;
    }

    productoActual = data.producto;
    mostrarProducto();
    cargarRelacionados(productoActual.categoria_id, productoActual.id);

  } catch (e) {
    console.error('Error cargando producto:', e);
    mostrarError();
  }
}

// ---- Mostrar producto ----
function mostrarProducto() {
  const p = productoActual;

  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('page').style.display = 'block';

  document.title = `${p.nombre} - Wooden House`;
  const breadcrumb = document.getElementById('breadcrumbNombre');
  if (breadcrumb) breadcrumb.textContent = p.nombre;

  setText('pNombre', p.nombre);
  const catEl = document.getElementById('pCategoria');
  if (catEl && p.categoria_nombre) {
    catEl.textContent = p.categoria_nombre;
  }

  const etiqEl = document.getElementById('pEtiqueta');
  if (etiqEl && p.etiqueta) {
    etiqEl.textContent = p.etiqueta;
    etiqEl.style.display = 'inline-block';
  }

  setText('pPrecio', formatCurrency(p.precio_base || p.precio));

  // Stock — fabricación bajo pedido, siempre disponible
  const iconEl = document.getElementById('pStockIcon');
  const textEl = document.getElementById('pStockText');
  const btnAdd = document.getElementById('btnAddCart');
  if (iconEl) { iconEl.innerHTML = '<i data-lucide="circle-check"></i>'; iconEl.style.color = '#4caf50'; _refreshIcons(); }
  if (textEl) textEl.innerHTML = '<strong>Disponible</strong> · Fabricación bajo pedido';
  if (btnAdd) { btnAdd.disabled = false; btnAdd.addEventListener('click', agregarAlCarrito); }

  const descEl = document.getElementById('pDesc');
  if (descEl) descEl.textContent = p.descripcion || '';

  const specs = p.especificaciones || [];

  // Catálogo 2026: las especificaciones son "qué incluye tu paquete"
  // (Mueble, Ovalín, Monomando, Herrajes, Cubierta...). Se muestran todas tal
  // cual, más la tabla de precios por ancho.
  const sinAcentos = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const destacados = [
    ['estilo', 'sparkles'], ['mueble', 'layers'], ['cubierta', 'square'], ['ovalin', 'droplets'],
  ].map(([k, icon]) => {
    const s = specs.find(x => sinAcentos(x.clave).includes(k));
    return s ? { icon, label: s.clave, val: s.valor } : null;
  }).filter(Boolean);

  const featuresBox = document.getElementById('featuresBox');
  const pFeatures   = document.getElementById('pFeatures');
  if (featuresBox && pFeatures && destacados.length) {
    featuresBox.style.display = 'block';
    pFeatures.innerHTML = destacados.map(f => `
      <div class="feature-item">
        <span class="feature-key"><i data-lucide="${f.icon}"></i> ${escHtml(f.label)}</span>
        <span class="feature-val">${escHtml(f.val)}</span>
      </div>
    `).join('');
  }

  const specTable = document.getElementById('specTable');
  if (specTable) {
    const medidas = p.medidas || [];
    specTable.innerHTML = `
      ${specs.length ? `
      <div class="spec-section-title"><i data-lucide="package-check"></i> Qué incluye tu paquete</div>
      ${specs.map(s => `
        <div class="spec-row">
          <span class="spec-key">${escHtml(s.clave)}</span>
          <span class="spec-val">${escHtml(s.valor)}</span>
        </div>`).join('')}` : ''}

      ${medidas.length ? `
      <div class="spec-section-title" style="margin-top:18px;"><i data-lucide="ruler"></i> Precio por ancho (sin instalación)</div>
      ${medidas.map(m => `
        <div class="spec-row">
          <span class="spec-key">${m.ancho_cm} cm</span>
          <span class="spec-val">${formatCurrency(m.precio)}</span>
        </div>`).join('')}` : ''}

      <div class="spec-section-title" style="margin-top:18px;"><i data-lucide="wrench"></i> Fabricación</div>
      <div class="spec-row">
        <span class="spec-key">Producción</span>
        <span class="spec-val">8 días hábiles desde que se confirma el anticipo</span>
      </div>
      <div class="spec-row">
        <span class="spec-key">Garantía</span>
        <span class="spec-val">1 año en la estructura del mueble y herrajes</span>
      </div>
    `;
  }
  renderSelectorAncho();
  renderAccesorios();
  _refreshIcons();

  const imagenes = p.imagenes || [];
  const mainImg  = document.getElementById('mainImage');
  const thumbsEl = document.getElementById('thumbs');
  const placeholder = document.getElementById('imgPlaceholder');

  if (imagenes.length > 0) {
    const primera = imagenes[0]?.url_imagen || '';
    if (mainImg && primera) {
      mainImg.src = primera;
      mainImg.alt = p.nombre;
      mainImg.style.display = 'block';
      mainImg.setAttribute('data-lightbox', '');
      mainImg.classList.add('wh-img-zoom');
      if (placeholder) placeholder.style.display = 'none';
    }

    if (thumbsEl && imagenes.length > 1) {
      thumbsEl.innerHTML = imagenes.map((img, idx) => `
        <div class="thumb ${idx === 0 ? 'active' : ''}" data-idx="${idx}" data-url="${escHtml(img.url_imagen)}">
          <img src="${escHtml(img.url_imagen)}" alt="Vista ${idx+1}" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:center top;border-radius:8px;">
        </div>
      `).join('');
    }
  }

  // (btnAddCart ya se enlazó arriba en la sección de stock)
}

// ---- Cambiar imagen ----
function cambiarImagenBtn(el) {
  cambiarImagen(parseInt(el.dataset.idx), el.dataset.url);
}
function cambiarImagen(idx, url) {
  imagenIndex = idx;
  const mainImg = document.getElementById('mainImage');
  const placeholder = document.getElementById('imgPlaceholder');
  if (mainImg && url) {
    mainImg.src = url;
    mainImg.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  }
  document.querySelectorAll('.thumb').forEach((t, i) => t.classList.toggle('active', i === idx));
}

// ---- Cambiar cantidad ----
function cambiarCantidad(delta) {
  const input = document.getElementById('cantidad');
  if (!input) return;
  let val = parseInt(input.value || 1) + delta;
  const max = 99; // Fabricación bajo pedido, sin límite de stock
  val = Math.max(1, Math.min(val, max));
  input.value = val;
}

// ---- Ancho del mueble (catálogo 2026: el precio depende del ancho) ----
let anchoSeleccionado = null;

function renderSelectorAncho() {
  const p = productoActual;
  const cont = document.getElementById('anchoSelector');
  const chips = document.getElementById('anchoChips');
  if (!cont || !chips) return;
  const medidas = p.medidas || [];
  if (!medidas.length) { cont.style.display = 'none'; return; }
  cont.style.display = '';
  // Por defecto el más pedido (80 cm) si existe; si no, el más chico.
  if (!anchoSeleccionado) anchoSeleccionado = (medidas.find(m => m.ancho_cm === 80) || medidas[0]).ancho_cm;
  chips.innerHTML = medidas.map(m => `
    <button type="button" class="ancho-chip ${m.ancho_cm === anchoSeleccionado ? 'active' : ''}"
      data-call="seleccionarAncho" data-args="[${m.ancho_cm}]" aria-pressed="${m.ancho_cm === anchoSeleccionado}">
      <strong>${m.ancho_cm} cm</strong><span>${formatCurrency(m.precio)}</span>
    </button>`).join('');
  actualizarPrecioAncho();
}

function seleccionarAncho(ancho) {
  anchoSeleccionado = ancho;
  renderSelectorAncho();
}

function precioSeleccionado() {
  const p = productoActual;
  const m = (p.medidas || []).find(x => x.ancho_cm === anchoSeleccionado);
  const base = m ? m.precio : Number(p.precio_base || p.precio || 0);
  return base + costoAdicionales();
}

// ---- Accesorios (catálogo 2026, págs. 10-14 — ver includes/accesorios.php) ----
// Ovalín y monomando van incluidos (solo se elige cuál) cuando el paquete
// dice "a elegir"; los modelos premium (París) ya traen los suyos.
function adicionalesElegidos() {
  return [...document.querySelectorAll('#adicionalesLista input:checked')].map(i => i.value);
}
function costoAdicionales() {
  const A = (window.WH_ACCESORIOS || {}).adicionales || {};
  return adicionalesElegidos().reduce((s, k) => s + (A[k]?.precio || 0), 0);
}
function renderAccesorios() {
  const acc = window.WH_ACCESORIOS;
  const p = productoActual;
  if (!acc || !p) return;
  const sinAc = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const spec = k => (p.especificaciones || []).find(s => sinAc(s.clave).includes(k))?.valor || '';
  const eligeOvalin = sinAc(spec('ovalin')).includes('elegir');
  const eligeMono   = sinAc(spec('monomando')).includes('elegir');

  const boxAcc = document.getElementById('accesoriosBox');
  if (boxAcc && (eligeOvalin || eligeMono)) {
    boxAcc.style.display = '';
    const selO = document.getElementById('selOvalin');
    const grupo = (linea, titulo) => `<optgroup label="${titulo}">${acc.ovalines.filter(o => o.linea === linea)
      .map(o => `<option value="${escHtml(o.codigo)}">${escHtml(o.codigo)} — ${escHtml(o.medidas)}</option>`).join('')}</optgroup>`;
    selO.innerHTML = `<option value="">Lo elijo con un asesor</option>${grupo('incluido', 'Incluidos')}${grupo('economica', 'Línea económica')}`;
    selO.closest('.acc-campo').style.display = eligeOvalin ? '' : 'none';
    const selM = document.getElementById('selMonomando');
    const acabados = [...new Set(acc.monomandos.map(m => m.acabado))];
    selM.innerHTML = `<option value="">Lo elijo con un asesor</option>` + acabados.map(a =>
      `<optgroup label="${escHtml(a)}">${acc.monomandos.filter(m => m.acabado === a)
        .map(m => `<option value="${escHtml(m.codigo)}">${escHtml(m.codigo)} (${escHtml(a.toLowerCase())})</option>`).join('')}</optgroup>`).join('');
    selM.closest('.acc-campo').style.display = eligeMono ? '' : 'none';
  }

  const boxAd = document.getElementById('adicionalesBox');
  const lista = document.getElementById('adicionalesLista');
  if (boxAd && lista) {
    boxAd.style.display = '';
    const paso = document.getElementById('adicionalesPaso');
    if (paso) paso.textContent = boxAcc && boxAcc.style.display !== 'none' ? '4' : '3';
    lista.innerHTML = Object.entries(acc.adicionales).map(([k, a]) => `
      <label class="adic-item">
        <input type="checkbox" value="${escHtml(k)}">
        <span><strong>${escHtml(a.nombre)}</strong><small>${escHtml(a.detalle)}</small></span>
        <em>+${formatCurrency(a.precio)}</em>
      </label>`).join('') + `
      <p class="acc-nota">¿Espejo con LED, color especial o cubierta de piedra? Varían según el tamaño: <a href="/solicitudes">pídelos en una cotización</a>.</p>`;
    lista.querySelectorAll('input').forEach(i => i.addEventListener('change', actualizarPrecioAncho));
  }
}

function actualizarPrecioAncho() {
  const el = document.getElementById('pPrecio');
  if (el) el.textContent = formatCurrency(precioSeleccionado());
  const nota = document.getElementById('pPrecioNota');
  if (nota) nota.textContent = anchoSeleccionado ? `Mueble de ${anchoSeleccionado} cm de ancho · sin instalación` : '';
}

// ---- Agregar al carrito ----
function agregarAlCarrito() {
  if (!productoActual) return;
  const cantidad = parseInt(document.getElementById('cantidad')?.value || 1);
  let carrito = JSON.parse(sessionStorage.getItem('wh_carrito') || '[]');
  const tieneMedidas = (productoActual.medidas || []).length > 0;
  const ancho = tieneMedidas ? anchoSeleccionado : null;
  const ovalin = document.getElementById('selOvalin')?.value || '';
  const monomando = document.getElementById('selMonomando')?.value || '';
  const adicionales = adicionalesElegidos();
  const A = (window.WH_ACCESORIOS || {}).adicionales || {};
  const detalle = [
    ovalin ? `Ovalín ${ovalin}` : '', monomando ? `Monomando ${monomando}` : '',
    ...adicionales.map(k => A[k]?.nombre || k),
  ].filter(Boolean).join(' · ');
  const clave = JSON.stringify([ancho, ovalin, monomando, [...adicionales].sort()]);

  // Cada combinación (ancho + accesorios) es un renglón distinto del carrito.
  const exist = carrito.find(i => i.id == productoActual.id && (i.clave || JSON.stringify([i.ancho_cm || null, '', '', []])) === clave);
  if (exist) {
    exist.cantidad += cantidad;
  } else {
    carrito.push({
      id:       productoActual.id,
      nombre:   productoActual.nombre + (ancho ? ` — ${ancho} cm` : ''),
      precio:   precioSeleccionado(),
      ancho_cm: ancho,
      ovalin, monomando, adicionales, detalle, clave,
      imagen:   productoActual.imagenes?.[0]?.url_imagen || '',
      cantidad: cantidad,
    });
  }
  sessionStorage.setItem('wh_carrito', JSON.stringify(carrito));
  initCartBadge();

  const btn = document.getElementById('btnVerCarrito');
  if (btn) btn.style.display = 'inline-block';

  showToast(`${cantidad}x ${escHtml(productoActual.nombre)}${ancho ? ` (${ancho} cm)` : ''} agregado al carrito`);
}

// ---- Cargar productos relacionados ----
async function cargarRelacionados(catId, excludeId) {
  if (!catId) return;
  try {
    const res  = await fetch(`${API_BASE}/productos.php?categoria_id=${catId}&limit=4`);
    const data = await res.json();
    const container = document.getElementById('relacionados');
    if (!container || !data.success) return;

    const items = (data.productos || []).filter(p => p.id != excludeId).slice(0, 4);
    if (!items.length) { container.closest('.related-section').style.display = 'none'; return; }

    container.innerHTML = items.map(p => {
      const img = p.imagen_principal ? `<img src="${escHtml(p.imagen_principal)}" alt="${escHtml(p.nombre)}" loading="lazy">` : '<div class="placeholder-img-small"><i data-lucide="tree-pine"></i></div>';
      return `
        <a href="/detalle/${p.id}" class="related-card">
          <div class="related-img">${img}</div>
          <div class="related-info">
            <div class="related-name">${escHtml(p.nombre)}</div>
            <div class="related-price">${(p.medidas || []).length ? 'Desde ' : ''}${formatCurrency(p.precio)}</div>
          </div>
        </a>
      `;
    }).join('');
    _refreshIcons();
  } catch (e) { console.warn('Relacionados no disponibles:', e); }
}

// ---- Helpers ----
function mostrarError() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorState').style.display = 'block';
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatCurrency(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n || 0));
}

function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.style.cssText = `position:fixed;top:90px;right:20px;padding:14px 20px;background:${type==='success'?'#22c55e':'#ef4444'};color:#fff;border-radius:8px;z-index:10000;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,.25);pointer-events:none;display:flex;align-items:center;gap:8px;`;
  toast.innerHTML = `<i data-lucide="${type === 'success' ? 'circle-check' : 'triangle-alert'}" style="width:18px;height:18px;stroke-width:1.75;flex-shrink:0;"></i><span>${msg}</span>`;
  document.body.appendChild(toast);
  _refreshIcons();
  setTimeout(() => toast.remove(), 3000);
}

// Globales
window.cambiarImagen   = cambiarImagen;
window.cambiarCantidad = cambiarCantidad;

window.seleccionarAncho = seleccionarAncho;
