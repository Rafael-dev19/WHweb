// ================== ICONOS LUCIDE (auto-refresh) ==================
// El panel reemplaza secciones enteras con innerHTML en decenas de puntos;
// en vez de llamar lucide.createIcons() manualmente en cada uno, un
// MutationObserver sobre <body> reprograma un refresh cada vez que el DOM
// cambia (debounced para no llamarlo cientos de veces por segundo).
(function(){
  let _iconRefreshTimer = null;
  function _scheduleIconRefresh(){
    clearTimeout(_iconRefreshTimer);
    _iconRefreshTimer = setTimeout(() => window.lucide?.createIcons(), 30);
  }
  const _iconObserver = new MutationObserver(_scheduleIconRefresh);
  document.addEventListener('DOMContentLoaded', () => {
    window.lucide?.createIcons();
    _iconObserver.observe(document.body, { childList: true, subtree: true });
  });
})();

// ================== UTILIDADES ==================
function openModal(id){
  document.getElementById(id)?.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeModal(id){
  document.getElementById(id)?.classList.remove('active');
  if (!document.querySelector('.modal.active')) document.body.style.overflow = '';
}

function showNotification(message, type='info'){
  document.querySelectorAll('.notification').forEach(n => n.remove());
  const icons = { success: 'circle-check', error: 'circle-x', info: 'info', warning: 'triangle-alert' };
  const notif = document.createElement('div');
  notif.className = `notification ${type}`;
  notif.innerHTML = `<i data-lucide="${icons[type] || 'info'}" style="margin-right:8px;"></i>${message}`;
  document.body.appendChild(notif);
  window.lucide?.createIcons();
  const delay = type === 'error' ? 5000 : 3500;
  setTimeout(() => {
    notif.style.cssText += ';opacity:0;transform:translateX(120%);transition:all .3s ease';
    setTimeout(() => notif.remove(), 350);
  }, delay);
}

function escapeHtml(str){
  return String(str || '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

function money(n){
  return Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
}

// ================== MENÚ HAMBURGUESA (MÓVIL) ==================
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');
const navClose = document.getElementById('navClose');

function setMenuOpen(open){
  navLinks.classList.toggle('open', open);
  menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}

menuToggle?.addEventListener('click', () => {
  setMenuOpen(!navLinks.classList.contains('open'));
});

navClose?.addEventListener('click', () => setMenuOpen(false));

document.addEventListener('click', (e) => {
  if (navLinks.classList.contains('open')) {
    const inside = e.target.closest('#navLinks') || e.target.closest('#menuToggle');
    if (!inside) setMenuOpen(false);
  }
  if (document.getElementById('notifPanel')?.classList.contains('open')) {
    const insideN = e.target.closest('#notifPanel') || e.target.closest('#notifBtn');
    if (!insideN) closeNotifPanel();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    setMenuOpen(false);
    closeNotifPanel();
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
  }
});

navLinks?.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-section]');
  if(!a) return;
  e.preventDefault();
  const section = a.dataset.section;
  showSection(section);
  setMenuOpen(false);
  navLinks.querySelectorAll('a').forEach(x => x.classList.remove('active'));
  a.classList.add('active');
});

// ================== NAVEGACIÓN ==================
function showSection(section){
  document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(section + '-section');
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(item => {
    if (item.dataset.section === section) item.classList.add('active');
  });

  window._currentSection = section;

  if(section === 'inventario'){  bootstrapInventoryFromTableIfEmpty(); renderInventory(); }
  if(section === 'dashboard'){
    refreshKpisFromPedidosTable(); renderActivity(); refreshKpisAPI();
    cargarCitasParaCalendario().then(() => { buildCalendar(); renderNext7(); });
  }
  if(section === 'pedidos')      cargarPedidosEmpleadoAPI();
  if(section === 'citas')        cargarCitasAPI();
  if(section === 'cotizaciones') cargarCotizacionesAPI();
}

// ================== MODALES: click fuera ==================
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', function(e){
    if(e.target === this){
      this.classList.remove('active');
      if (!document.querySelector('.modal.active')) document.body.style.overflow = '';
    }
  });
});

// ================== NOTIFICACIONES (PANEL) ==================
const notifBody  = document.getElementById('notifBody');
const notifDot   = document.getElementById('notifDot');
const notifBtn   = document.getElementById('notifBtn');
const notifPanel = document.getElementById('notifPanel');

// Notificaciones guardadas POR CUENTA: antes jefe/ventas (y taller/diseño)
// compartían el mismo almacén del navegador y en un equipo usado por varias
// personas se mezclaban los avisos de todos.
const _NOTIF_UID          = String(window.WH_UID || 'x');
const NOTIF_KEY        = 'wh_emp_notifs_' + _NOTIF_UID;
const NOTIF_UNREAD_KEY = 'wh_emp_notifs_unread_' + _NOTIF_UID;
const NOTIF_SEEN_KEY   = 'wh_emp_notifs_seen_' + _NOTIF_UID;
try { ['wh_emp_notifs', 'wh_emp_notifs_unread', 'wh_emp_notifs_seen'].forEach(k => localStorage.removeItem(k)); } catch (e) {}

const NOTIF_ICONS = {
  pedido:      { icon:'box',          color:'var(--accent)' },
  cita:        { icon:'calendar',     color:'#4a7c8b' },
  cotizacion:  { icon:'briefcase',    color:'#4a8b5a' },
  pago:        { icon:'credit-card',  color:'#7c5c8b' },
  sistema:     { icon:'settings',     color:'var(--muted2)' },
};

function getNotifs(){ return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); }
function saveNotifs(list){ localStorage.setItem(NOTIF_KEY, JSON.stringify(list)); }
function getUnreadCount(){ return parseInt(localStorage.getItem(NOTIF_UNREAD_KEY) || '0'); }
function setUnreadCount(n){
  const count = Math.max(0, n);
  localStorage.setItem(NOTIF_UNREAD_KEY, String(count));
  if (!notifDot) return;
  if (count === 0) {
    notifDot.classList.remove('on');
    notifBtn?.classList.remove('has-notif');
  } else {
    notifDot.textContent = count > 9 ? '9+' : count;
    notifDot.classList.add('on');
    notifBtn?.classList.add('has-notif');
  }
}

function _notifTypeClass(tipo){
  const t = (tipo||'').toLowerCase();
  if(t.includes('pedido')) return 'type-pedido';
  if(t.includes('cita'))   return 'type-cita';
  if(t.includes('cotiz'))  return 'type-cotizacion';
  if(t.includes('pago'))   return 'type-pago';
  return '';
}
function _notifIconHtml(tipo){
  const t = (tipo||'').toLowerCase();
  let key = 'sistema';
  if(t.includes('pedido')) key='pedido';
  else if(t.includes('cita'))  key='cita';
  else if(t.includes('cotiz')) key='cotizacion';
  else if(t.includes('pago'))  key='pago';
  const cfg = NOTIF_ICONS[key];
  return `<div class="notif-icon" style="color:${cfg.color};border-color:${cfg.color}40;">
    <i data-lucide="${cfg.icon}"></i>
  </div>`;
}

function renderNotifPanel(){
  if (!notifBody) return;
  const list = getNotifs().slice(0, 20);
  if(!list.length){
    notifBody.innerHTML = `<div class="notif-empty">
      <i data-lucide="bell-off"></i>
      <span>Sin notificaciones</span>
    </div>`;
    return;
  }
  const unreadCount = getUnreadCount();
  notifBody.innerHTML = list.map((n, i) => {
    const isUnread = i < unreadCount;
    const typeClass = _notifTypeClass(n.tipo || n.title);
    return `<div class="notif-item ${typeClass}${isUnread?' unread':''}">
      ${_notifIconHtml(n.tipo || n.title)}
      <div class="notif-content">
        <div class="t">${escapeHtml(n.title)}</div>
        ${n.meta ? `<div class="m">${escapeHtml(n.meta)}</div>` : ''}
        <div class="notif-item-foot">
          <span class="at">${escapeHtml(n.at)}</span>
          ${isUnread ? '<span class="notif-nueva">Nueva</span>' : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function openNotifPanel(){
  fetchNotificationsFromAPI().then(() => renderNotifPanel());
  notifPanel?.classList.add('open');
}
function closeNotifPanel(){
  notifPanel?.classList.remove('open');
}

notifBtn?.addEventListener('click', e => {
  e.stopPropagation();
  notifPanel?.classList.contains('open') ? closeNotifPanel() : openNotifPanel();
});

function pushNotif(title, meta, tipo=''){
  const list = getNotifs();
  list.unshift({ title, meta, tipo, at: new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}) + ' ' + new Date().toLocaleDateString('es-MX') });
  saveNotifs(list.slice(0,30));
  setUnreadCount(getUnreadCount() + 1);
  renderNotifPanel();
}

function markAllNotifRead(){
  const ids = getNotifs().map(n => n.id).filter(Boolean);
  if (ids.length) _addSeenIds(ids);
  saveNotifs([]);
  setUnreadCount(0);
  renderNotifPanel();
  ids.forEach(id => {
    fetch('/api/notificaciones.php?id=' + encodeURIComponent(id), { method: 'PUT', credentials: 'same-origin' }).catch(() => {});
  });
}

function _getSeenIds(){ return new Set(JSON.parse(localStorage.getItem(NOTIF_SEEN_KEY) || '[]')); }
function _addSeenIds(ids){
  const seen = _getSeenIds();
  ids.forEach(id => seen.add(id));
  localStorage.setItem(NOTIF_SEEN_KEY, JSON.stringify([...seen].slice(0, 200)));
}

function clearAllNotifs(){
  const ids = getNotifs().map(n => n.id).filter(Boolean);
  if(ids.length) _addSeenIds(ids);
  saveNotifs([]);
  setUnreadCount(0);
  renderNotifPanel();
  ids.forEach(id => {
    fetch('/api/notificaciones.php?id=' + encodeURIComponent(id), { method: 'PUT', credentials: 'same-origin' }).catch(() => {});
  });
}

// ── Cargar notificaciones desde la API (Firestore) ─────────────
async function fetchNotificationsFromAPI() {
  try {
    const res = await fetch('/api/notificaciones.php', { credentials: 'same-origin' });
    if (!res.ok) return;
    const json = await res.json();
    const items = json.notificaciones ?? [];
    if (!items.length) return;

    const current   = getNotifs();
    const knownIds  = new Set([...current.map(n => n.id), ..._getSeenIds()].filter(Boolean));
    let newCount = 0;

    items.slice(0, 20).forEach(n => {
      if (n.id && knownIds.has(n.id)) return;
      const d = n.fecha ? new Date(n.fecha) : new Date();
      const at = d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}) + ' ' + d.toLocaleDateString('es-MX');
      current.unshift({ id: n.id, title: n.titulo, meta: n.mensaje, tipo: n.tipo||'', at });
      newCount++;
    });

    if (newCount > 0) {
      saveNotifs(current.slice(0, 30));
      setUnreadCount(getUnreadCount() + newCount);
    }
  } catch (e) { /* silencioso */ }
}

// Exponer al scope global para onclick inline del HTML
window.markAllNotifRead = markAllNotifRead;
window.clearAllNotifs   = clearAllNotifs;
window.openNotifPanel   = openNotifPanel;
window.closeNotifPanel  = closeNotifPanel;

// ================== DASH: ACTIVIDAD RECIENTE ==================
const ACT_KEY = 'wh_emp_activity';
function getActivity(){ return JSON.parse(localStorage.getItem(ACT_KEY) || '[]'); }
function saveActivity(list){ localStorage.setItem(ACT_KEY, JSON.stringify(list)); }

function addActivity(title, meta){
  const list = getActivity();
  list.unshift({ title, meta, at: new Date().toLocaleString('es-MX') });
  saveActivity(list.slice(0, 20));
}

// ── FIX ICONOS: usar innerHTML para el título (permite <i> tags) ──
function renderActivity(){
  const box = document.getElementById('activityList');
  if(!box) return;

  const list = getActivity();
  if(!list.length){
    box.innerHTML = `
      <div class="activity-item">
        <div class="t"><i data-lucide="clipboard-list"></i> Sin actividad reciente</div>
        <div class="m">Cuando actualices pedidos/inventario aparecerán aquí.</div>
      </div>`;
    return;
  }

  // title usa innerHTML directamente (contiene <i> de FontAwesome)
  // meta y at sí se escapan porque son datos del usuario
  box.innerHTML = list.slice(0, 8).map(a => `
    <div class="activity-item">
      <div class="t">${a.title}</div>
      <div class="m">${escapeHtml(a.meta || '')}</div>
      <div class="m" style="color:var(--muted);font-size:11px;">${escapeHtml(a.at)}</div>
    </div>
  `).join('');
}


// ================== KPIs desde tabla pedidos ==================
function refreshKpisFromPedidosTable(){
  const rows = document.querySelectorAll('#pedidosTable tr');
  let pendientes = 0;
  rows.forEach(r => { if(r.dataset.status === 'pendiente') pendientes++; });
  const el = document.getElementById('kpiPendientes');
  // Solo actualizar si hay filas cargadas para no sobreescribir con 0
  if(el && rows.length > 0) el.textContent = String(pendientes);
}

// ================== PEDIDOS: FILTROS ==================
// Bug corregido: los botones usaban "pending"/"progress"/"completed" pero
// el estado real es "pendiente"/"en_produccion"/etc. — nunca coincidían.
const ESTADO_PEDIDO_CATEGORIA = {
  pendiente:              'pending',
  anticipo_pagado:        'pending',
  pagado:                 'pending',
  listo_para_produccion:  'progress',
  en_produccion:          'progress',
  alistando_pedido:       'progress',
  en_camino_instalacion:  'progress',
  finalizado:             'completed',
  cancelado:              null, // solo visible en "Todos"
};
// Estados que le "tocan" a cada área dentro del rol empleado — taller corta/
// arma (hasta dejarlo listo), instalación entrega/instala desde ahí. No es
// una restricción de permisos (la API sigue regresando todos los pedidos),
// es solo el filtro por defecto para que cada quien aterrice en lo suyo.
const AREA_ESTADOS = {
  taller:      ['listo_para_produccion', 'en_produccion', 'alistando_pedido'],
  instalacion: ['alistando_pedido', 'en_camino_instalacion', 'finalizado'],
};

function filterTable(filter, ev){
  document.querySelectorAll('#pedidos-section .filter-btn').forEach(btn => btn.classList.remove('active'));
  const btnActivo = ev?.target || document.querySelector(`#pedidos-section .filter-btn[data-filter="${filter}"]`);
  btnActivo?.classList?.add('active');

  const rows = document.querySelectorAll('#pedidosTable tr');
  if (filter === 'mia') {
    const estadosMios = AREA_ESTADOS[window.WH_AREA] || [];
    rows.forEach(row => {
      row.style.display = estadosMios.includes(row.dataset.status) ? '' : 'none';
    });
    return;
  }
  rows.forEach(row => {
    const categoria = ESTADO_PEDIDO_CATEGORIA[row.dataset.status];
    row.style.display = (filter === 'all' || categoria === filter) ? '' : 'none';
  });
}

// ================== PEDIDOS: DETALLE + TIMELINE ==================
let currentPedidoRow = null;

function fmtMoney(n){
  const num = Number(n || 0);
  return '$' + num.toLocaleString('es-MX');
}
function fmtISOtoDMY(iso){
  if(!iso) return '—';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${String(y).slice(-2)}`;
}

// ================== INVENTARIO ==================
const INV_ITEMS_KEY = 'wh_raw_inventory_items';
const INV_LOG_KEY = 'wh_raw_inventory_log';
let invFilterMode = 'all';

function bootstrapInventoryFromTableIfEmpty(){
  const saved = JSON.parse(localStorage.getItem(INV_ITEMS_KEY) || 'null');
  if(saved && Array.isArray(saved) && saved.length) return;

  const items = [];
  document.querySelectorAll('#inventoryTable tr').forEach(tr => items.push(rowToItem(tr)));
  localStorage.setItem(INV_ITEMS_KEY, JSON.stringify(items));
  localStorage.setItem(INV_LOG_KEY, JSON.stringify([]));
}

function rowToItem(tr){
  const tds = tr.querySelectorAll('td');
  return {
    id: tr.dataset.id,
    name: tds[0].textContent.trim(),
    category: tds[1].textContent.trim(),
    unit: tds[2].textContent.trim(),
    stock: parseInt(tr.querySelector('.stock-cell')?.textContent,10) || 0,
    min: parseInt(tr.querySelector('.min-cell')?.textContent,10) || 0,
    location: tr.querySelector('.loc-cell')?.textContent.trim() || '-',
    supplier: tr.querySelector('.sup-cell')?.textContent.trim() || '-',
    cost: parseFloat((tr.querySelector('.cost-cell')?.textContent || '0').replace(/[^\d.]/g,'')) || 0
  };
}

function getItems(){ return JSON.parse(localStorage.getItem(INV_ITEMS_KEY) || '[]'); }
function saveItems(items){ localStorage.setItem(INV_ITEMS_KEY, JSON.stringify(items)); }

function logMovement(entry){
  const log = JSON.parse(localStorage.getItem(INV_LOG_KEY) || '[]');
  log.unshift({ ...entry, at: new Date().toLocaleString('es-MX') });
  localStorage.setItem(INV_LOG_KEY, JSON.stringify(log));
}

function renderInventory(){
  const tbody = document.getElementById('inventoryTable');
  if(!tbody) return;

  const search = (document.getElementById('invSearch')?.value || '').trim().toLowerCase();
  const items = getItems();

  tbody.innerHTML = '';

  items.forEach(item => {
    const isLow = item.stock <= item.min;

    if(invFilterMode === 'low' && !isLow) return;
    if(invFilterMode === 'ok' && isLow) return;

    const searchable = `${item.name} ${item.category} ${item.id} ${item.supplier}`.toLowerCase();
    if(search && !searchable.includes(search)) return;

    const statusText = isLow ? 'Bajo' : 'OK';
    const statusClass = isLow ? 'status-pending' : 'status-completed';

    const tr = document.createElement('tr');
    tr.dataset.id = item.id;
    tr.innerHTML = `
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td>${escapeHtml(item.unit)}</td>
      <td class="stock-cell">${item.stock}</td>
      <td class="min-cell">${item.min}</td>
      <td class="loc-cell">${escapeHtml(item.location)}</td>
      <td class="sup-cell">${escapeHtml(item.supplier)}</td>
      <td class="cost-cell">$${Number(item.cost).toLocaleString('es-MX')}</td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td><button class="btn btn-secondary btn-small" data-call="openStockModal" data-args='["${item.id}"]'>Actualizar</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function setInvFilter(mode, ev){
  invFilterMode = mode;
  document.querySelectorAll('#inventario-section .filter-btn').forEach(btn => btn.classList.remove('active'));
  ev?.target?.classList?.add('active');
  renderInventory();
}
function filterInventory(){ renderInventory(); }

function openAddItemModal(){
  const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.value=val; };
  set('newName',''); set('newUnit',''); set('newLocation',''); set('newSupplier',''); set('newCost','');
  set('newStock',0); set('newMin',0);
  document.getElementById('newCategory').value = 'Tableros';
  openModal('addItemModal');
}

function addInventoryItem(){
  const name = document.getElementById('newName').value.trim();
  const category = document.getElementById('newCategory').value.trim();
  const unit = document.getElementById('newUnit').value.trim();
  const stock = parseInt(document.getElementById('newStock').value,10) || 0;
  const min = parseInt(document.getElementById('newMin').value,10) || 0;
  const location = document.getElementById('newLocation').value.trim() || '-';
  const supplier = document.getElementById('newSupplier').value.trim() || '-';
  const cost = parseFloat(document.getElementById('newCost').value) || 0;

  if(!name || !unit){
    showNotification('Falta nombre y/o unidad del insumo', 'error');
    return;
  }

  const items = getItems();
  const id = 'MAT-' + String(Date.now()).slice(-6);

  items.unshift({ id, name, category, unit, stock, min, location, supplier, cost });
  saveItems(items);
  logMovement({ type:'alta_insumo', id, name, delta: stock, reason:'alta_inicial' });

  addActivity('<i data-lucide="boxes"></i> Insumo agregado', `${id} | ${name} | Stock inicial: ${stock}`);
  pushNotif('Insumo agregado', `${id} | ${name}`);

  closeModal('addItemModal');
  renderInventory();
  showNotification('<i data-lucide="check"></i> Insumo agregado', 'success');
  renderActivity();
}

function openStockModal(id){
  const items = getItems();
  const item = items.find(x => x.id === id);
  if(!item) return;

  document.getElementById('stockId').value = item.id;
  document.getElementById('stockName').value = item.name;
  document.getElementById('stockCurrent').value = item.stock;
  document.getElementById('stockMovement').value = 'entrada';
  document.getElementById('stockQty').value = '';
  document.getElementById('stockReason').value = 'compra_proveedor';
  openModal('stockModal');
}

function applyStockChange(){
  const id = document.getElementById('stockId').value.trim();
  const movement = document.getElementById('stockMovement').value;
  const qty = parseInt(document.getElementById('stockQty').value,10);
  const reason = document.getElementById('stockReason').value;

  if(!id) return;
  if(!qty || qty <= 0){
    showNotification('Pon una cantidad válida', 'error');
    return;
  }

  const items = getItems();
  const idx = items.findIndex(x => x.id === id);
  if(idx < 0) return;

  const current = items[idx].stock;

  if(movement === 'ajuste'){
    const nextAdj = Math.max(0, qty);
    const realDelta = nextAdj - current;
    items[idx].stock = nextAdj;
    saveItems(items);
    logMovement({ type:'ajuste', id, name: items[idx].name, delta: realDelta, reason });

    closeModal('stockModal');
    renderInventory();
    showNotification('<i data-lucide="check"></i> Ajuste guardado', 'success');

    addActivity('<i data-lucide="boxes"></i> Ajuste de inventario', `${id} | Δ ${realDelta} | ${reason}`);
    pushNotif('Ajuste inventario', `${id} | Δ ${realDelta} | ${reason}`);
    renderActivity();
    return;
  }

  let delta = qty;
  if(movement === 'salida') delta = -qty;

  const next = Math.max(0, current + delta);
  const realDelta = next - current;

  items[idx].stock = next;
  saveItems(items);
  logMovement({ type:'movimiento', id, name: items[idx].name, delta: realDelta, reason });

  closeModal('stockModal');
  renderInventory();
  showNotification('<i data-lucide="check"></i> Movimiento guardado', 'success');

  addActivity('<i data-lucide="boxes"></i> Movimiento de inventario', `${id} | Δ ${realDelta} | ${reason}`);
  pushNotif('Movimiento inventario', `${id} | Δ ${realDelta} | ${reason}`);
  renderActivity();
}

function syncAutoInventory(){
  const items = getItems();
  const queue = JSON.parse(localStorage.getItem('wh_material_consumption_queue') || '[]');

  if(!queue.length){
    const sample = [
      { id:'MAT-001', qty:1, reason:'auto:orden_produccion' },
      { id:'MAT-002', qty:4, reason:'auto:orden_produccion' }
    ];
    localStorage.setItem('wh_material_consumption_queue', JSON.stringify(sample));
    showNotification('Cola de consumo creada.\nVuelve a presionar Auto-actualizar.', 'info');
    return;
  }

  queue.forEach(c => {
    const idx = items.findIndex(x => x.id === c.id);
    if(idx >= 0){
      const cur = items[idx].stock;
      const next = Math.max(0, cur - (c.qty || 0));
      const delta = next - cur;
      items[idx].stock = next;
      logMovement({ type:'auto', id:c.id, name: items[idx].name, delta, reason: c.reason || 'auto' });
      addActivity('<i data-lucide="boxes"></i> Auto-actualizar inventario', `${c.id} | Δ ${delta} | ${c.reason || 'auto'}`);
    }
  });

  saveItems(items);
  localStorage.setItem('wh_material_consumption_queue', JSON.stringify([]));
  renderInventory();
  showNotification('↻ Inventario auto-actualizado', 'success');
  pushNotif('Inventario auto-actualizado', 'Se aplicaron los consumos de la cola');
  renderActivity();
}

function viewInventoryLog(){
  const log = JSON.parse(localStorage.getItem(INV_LOG_KEY) || '[]');
  if(!log.length){
    showNotification('No hay movimientos todavía', 'info');
    return;
  }
  const preview = log.slice(0, 10).map(x => {
    const d = x.delta ?? 0;
    const sign = d > 0 ? '+' : '';
    return `${x.at} | ${x.id} | ${sign}${d} | ${x.reason || x.type}`;
  }).join('\n');
  alert('Historial de inventario (últimos 10 movimientos):\n\n' + preview);
}

// ================== CALENDARIO ==================
const CAL_KEY = 'wh_emp_calendar_events';
const DOW = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

let calCursor = new Date();
let selectedDateISO = null;

// Caches de API — no se persisten en localStorage
let _empCitasApiCache   = [];
let _empPedidosApiCache = [];

function getCalEvents(){ return JSON.parse(localStorage.getItem(CAL_KEY) || '[]'); }
function saveCalEvents(events){ localStorage.setItem(CAL_KEY, JSON.stringify(events)); }

function _getAllEmpEvents(){
  return [...getCalEvents(), ..._empCitasApiCache, ..._empPedidosApiCache];
}

function isoDate(d){
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth()+1).padStart(2,'0');
  const day = String(x.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function fmtMonthTitle(d){
  const m = d.toLocaleString('es-MX', { month:'long' });
  return m.charAt(0).toUpperCase() + m.slice(1) + ' ' + d.getFullYear();
}

function mondayIndex(jsDay){ return (jsDay + 6) % 7; }

// Color fijo por id (no por estado) — así dos pedidos distintos que se
// cruzan en el calendario se distinguen aunque tengan el mismo estado.
const _CAL_PALETTE = ['#e07a5f','#3d5a80','#81b29a','#9b5de5','#00bbf9','#f15bb5','#06d6a0','#ef476f','#118ab2','#ffb703','#8338ec','#43aa8b'];
function colorForId(id) {
  const s = String(id);
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return _CAL_PALETTE[hash % _CAL_PALETTE.length];
}

function buildCalendar(){
  document.getElementById('calTitle').textContent = fmtMonthTitle(calCursor);

  const calDow = document.getElementById('calDow');
  calDow.innerHTML = '';
  DOW.forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-dow';
    el.textContent = d;
    calDow.appendChild(el);
  });

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  const year = calCursor.getFullYear();
  const month = calCursor.getMonth();

  const first = new Date(year, month, 1);
  const startOffset = mondayIndex(first.getDay());
  const start = new Date(year, month, 1 - startOffset);

  const events = _getAllEmpEvents();
  const todayISO = isoDate(new Date());

  for(let i=0; i<42; i++){
    const day = new Date(start);
    day.setDate(start.getDate() + i);

    const cellMonth = day.getMonth();
    const isMuted = cellMonth !== month;

    const dayISO = isoDate(day);
    const dayEvents = events.filter(e => e.date === dayISO).slice(0,3);

    const cell = document.createElement('div');
    const isToday = dayISO === todayISO;
    cell.className = 'cal-day' + (isMuted ? ' muted' : '') + (isToday ? ' today' : '');
    cell.innerHTML = `
      <div class="num">${day.getDate()}</div>
      <div class="cal-chip">
        ${dayEvents.map(e => {
          const chipClass = e.eventoTipo || e.type || 'cita';
          const icon = e.eventoTipo === 'pedido' ? '📦' : e.eventoTipo === 'cita' ? '📅' : '';
          const estilo = e.color ? ` style="background:${e.color}2a;color:${e.color};"` : '';
          return `<div class="chip ${chipClass}"${estilo}>${icon} ${escapeHtml(e.time || '')} ${escapeHtml(e.title)}</div>`;
        }).join('')}
      </div>
    `;

    cell.addEventListener('click', () => {
      selectedDateISO = dayISO;
      renderDayEvents(dayISO);
      showNotification(`<i data-lucide="calendar"></i> Día seleccionado: ${dayISO}`, 'info');
    });

    if(!selectedDateISO && dayISO === todayISO) selectedDateISO = todayISO;
    grid.appendChild(cell);
  }

  renderDayEvents(selectedDateISO || isoDate(new Date()));
}

function renderDayEvents(dayISO){
  const list  = document.getElementById('dayEventsList');
  const title = document.getElementById('selectedDayTitle');
  const rutaBtn = document.getElementById('rutaDiaCal');

  // Actualizar título del panel
  if (title) {
    const titleSpan = title.querySelector('span');
    if (titleSpan) titleSpan.textContent = `Eventos del día (${dayISO})`;
    else title.textContent = `Eventos del día (${dayISO})`;
  }

  const events = _getAllEmpEvents()
    .filter(e => e.date === dayISO)
    .sort((a,b) => (a.time||'').localeCompare(b.time||''));

  // Mostrar el botón de ruta cuando hay pedidos "en_camino_instalacion" o citas activas
  const tieneParadas = events.some(e =>
    (e.eventoTipo === 'pedido' && e.datos?.tipo_entrega === 'envio' && e.datos?.estado === 'en_camino_instalacion') ||
    (e.eventoTipo === 'cita'   && !['cancelada'].includes(e.datos?.estado || ''))
  );
  if (rutaBtn) rutaBtn.style.display = tieneParadas ? '' : 'none';

  if(!events.length){
    list.innerHTML = `<div style="color: var(--muted);">No hay eventos para este día.</div>`;
    return;
  }

  list.innerHTML = events.map(e => {
    const esApi = !!e.eventoTipo;
    const esManual = !esApi;
    const icon = e.eventoTipo === 'pedido' ? '📦' : e.eventoTipo === 'cita' ? '📅' : '';
    const badge = e.eventoTipo === 'pedido'
      ? `<span style="background:rgba(201,169,110,.2);color:var(--accent);border-radius:8px;padding:1px 7px;font-size:10px;font-weight:700;">Pedido</span>`
      : e.eventoTipo === 'cita'
      ? `<span style="background:rgba(74,124,139,.2);color:#4a7c8b;border-radius:8px;padding:1px 7px;font-size:10px;font-weight:700;">Cita</span>`
      : '';
    const verBtn = e.eventoTipo === 'pedido' && e.datos?.id
      ? `<button class="btn btn-primary btn-small" data-call="verDetallePedidoEmp" data-args="[${e.datos.id}]"><i data-lucide="eye"></i> Ver</button>`
      : e.eventoTipo === 'cita' && e.datos?.id
      ? `<button class="btn btn-primary btn-small" data-call="verDetalleCitaEmp" data-args="[${e.datos.id}]"><i data-lucide="eye"></i> Ver</button>`
      : '';
    const elimBtn = esManual
      ? `<button class="btn btn-secondary btn-small" data-call="deleteEvent" data-args='["${e.id}"]'>Eliminar</button>`
      : '';
    return `
    <div class="cal-item">
      <div class="t">${icon} ${escapeHtml((e.time ? e.time + ' — ' : '') + e.title)} ${badge}${e.cliente_id ? ` <span style="background:#2d6a3f20;color:#2d6a3f;border-radius:8px;padding:1px 7px;font-size:10px;font-weight:700;"><i data-lucide="user-check"></i> #${e.cliente_id}</span>` : ''}</div>
      <div class="m">${escapeHtml(e.notes || '')}</div>
      <div style="display:flex; gap:8px; margin-top:6px;">${verBtn}${elimBtn}</div>
    </div>`;
  }).join('');
}

function renderNext7(){
  const box = document.getElementById('nextEventsList');
  const events = _getAllEmpEvents();

  const now = new Date();
  const startISO = isoDate(now);
  const end = new Date(now); end.setDate(end.getDate()+7);
  const endISO = isoDate(end);

  const iconTipo = { pedido:'📦', cita:'📅' };
  const next = events
    .filter(e => e.date >= startISO && e.date <= endISO)
    .sort((a,b) => (a.date + (a.time||'')).localeCompare(b.date + (b.time||'')))
    .slice(0, 12);

  if(!next.length){
    box.innerHTML = `<div style="color: var(--muted);">No hay eventos próximos.</div>`;
    return;
  }

  box.innerHTML = next.map(e => {
    const icon = iconTipo[e.eventoTipo] || '';
    return `
    <div class="cal-item">
      <div class="t">${icon} ${escapeHtml(e.date)} ${escapeHtml(e.time || '')}</div>
      <div class="m">${escapeHtml(e.title)}</div>
    </div>`;
  }).join('');
}

function prevMonth(){
  calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth()-1, 1);
  buildCalendar(); renderNext7();
}
function nextMonth(){
  calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth()+1, 1);
  buildCalendar(); renderNext7();
}
function goToday(){
  calCursor = new Date();
  calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth(), 1);
  selectedDateISO = isoDate(new Date());
  buildCalendar(); renderNext7();
}

function openAddEventModal(){
  const d = selectedDateISO || isoDate(new Date());
  document.getElementById('evDate').value = d;
  document.getElementById('evTime').value = '';
  document.getElementById('evType').value = 'cita';
  document.getElementById('evTitle').value = '';
  document.getElementById('evNotes').value = '';
  openModal('addEventModal');
}

function saveCalendarEvent(){
  const date = document.getElementById('evDate').value;
  const time = document.getElementById('evTime').value;
  const type = document.getElementById('evType').value;
  const title = document.getElementById('evTitle').value.trim();
  const notes = document.getElementById('evNotes').value.trim();

  if(!date || !title){
    showNotification('Falta fecha y/o título del evento', 'error');
    return;
  }

  const events = getCalEvents();
  const id = 'EV-' + String(Date.now()).slice(-8);

  events.push({ id, date, time, type, title, notes });
  saveCalEvents(events);

  closeModal('addEventModal');
  selectedDateISO = date;
  buildCalendar();
  renderNext7();
  showNotification('<i data-lucide="check"></i> Evento guardado', 'success');

  addActivity('<i data-lucide="calendar"></i> Evento agregado', `${date} ${time || ''} | ${title}`);
  pushNotif('Evento agregado', `${date} ${time || ''} | ${title}`);
  renderActivity();
}

function deleteEvent(id){
  const events = getCalEvents().filter(e => e.id !== id);
  saveCalEvents(events);
  buildCalendar();
  renderNext7();
  showNotification('Evento eliminado', 'info');
}

// ================== FORM HANDLERS — conectados a la API ==================
async function saveCita() {
  const nombre   = document.getElementById('citaNombre')?.value?.trim();
  const correo   = document.getElementById('citaCorreo')?.value?.trim();
  const telefono = document.getElementById('citaTelefono')?.value?.trim();
  const fecha    = document.getElementById('citaFecha')?.value;
  const horario  = document.getElementById('citaHorario')?.value || 'Por confirmar';
  const tipo     = document.getElementById('citaTipo')?.value || 'medicion';
  const notas    = document.getElementById('citaNotas')?.value?.trim() || '';
  if (!nombre || !correo || !fecha) {
    showNotification('Completa nombre, correo y fecha', 'error'); return;
  }

  try {
    const data = await apiFetch(`${API_BASE}/citas.php`, {
      method: 'POST',
      body: JSON.stringify({
        nombre_cliente: nombre, correo_cliente: correo, telefono_cliente: telefono || 'N/A',
        fecha_cita: fecha, rango_horario: horario, tipo, notas, direccion: 'Por confirmar'
      })
    });
    if (data.success) {
      closeModal('nuevaCita');
      showNotification(`<i data-lucide="check"></i> Cita ${data.numero_cita} agendada`, 'success');
      cargarCitasAPI();
    } else {
      showNotification(data.error || 'Error al agendar cita', 'error');
    }
  } catch(e) { showNotification('Error de conexión', 'error'); }
}

async function saveCotizacion() {
  const nombre      = document.getElementById('cotNombre')?.value?.trim();
  const correo      = document.getElementById('cotCorreo')?.value?.trim();
  const telefono    = document.getElementById('cotTelefono')?.value?.trim();
  const tipo        = document.getElementById('cotTipo')?.value || '';
  const descripcion = document.getElementById('cotDescripcion')?.value?.trim();

  if (!nombre || !correo || !descripcion) {
    showNotification('Completa nombre, correo y descripción', 'error'); return;
  }

  try {
    const data = await apiFetch(`${API_BASE}/cotizaciones.php`, {
      method: 'POST',
      body: JSON.stringify({
        nombre_cliente: nombre, correo_cliente: correo, telefono_cliente: telefono || 'N/A',
        modelo_mueble: tipo, descripcion_solicitud: descripcion
      })
    });
    if (data.success) {
      closeModal('nuevaCotizacion');
      showNotification(`<i data-lucide="check"></i> Cotización ${data.numero_cotizacion} registrada`, 'success');
      cargarCotizacionesAPI();
    } else {
      showNotification(data.error || 'Error al crear cotización', 'error');
    }
  } catch(e) { showNotification('Error de conexión', 'error'); }
}

let _calEmpLastLoaded = 0; // timestamp ms de la última carga

async function cargarCitasParaCalendario(silencioso = false) {
  const btn = document.getElementById('calRefreshBtn');
  if (btn && !silencioso) btn.innerHTML = '<i class="wh-icon-spin" data-lucide="refresh-cw"></i>';

  try {
    const hoy  = new Date();
    const anio = hoy.getFullYear();
    // Cargar año actual + siguiente para que eventos futuros sean visibles
    const desde = `${anio}-01-01`;
    const hasta  = `${anio + 1}-12-31`;

    // El calendario (citas + pedidos) es visible para todo el personal —
    // calendario.php ya no filtra por rol ni por tipo de cita.
    const [dataCitas, dataPedidos] = await Promise.allSettled([
      apiFetch(`${API_BASE}/calendario.php?desde=${desde}&hasta=${hasta}`),
      apiFetch(`${API_BASE}/pedidos.php?limit=500&fecha_desde=${desde}&fecha_hasta=${hasta}`)
    ]);

    if (dataCitas.status === 'fulfilled' && dataCitas.value?.success) {
      _empCitasApiCache = (dataCitas.value.eventos || [])
        .filter(ev => ev.extendedProps?.tipo === 'cita')
        .map(ev => {
          const p = ev.extendedProps;
          return {
            id: 'ACITA-' + ev.id,
            eventoTipo: 'cita',
            date: (ev.start || '').substring(0, 10),
            time: p.rango_horario || '',
            type: 'cita',
            title: `${p.cita_tipo === 'medicion' ? 'Medición' : p.cita_tipo === 'instalacion' ? 'Instalación' : 'Cita'}: ${p.cliente}`,
            notes: p.direccion || '',
            cliente_id: null,
            datos: {
              id: parseInt(String(ev.id).replace('cita_', ''), 10),
              numero_cita: p.numero,
              nombre_cliente: p.cliente,
              telefono_cliente: p.telefono,
              fecha_cita: ev.start,
              rango_horario: p.rango_horario,
              tipo: p.cita_tipo,
              estado: p.estado,
              direccion: p.direccion,
            },
          };
        });
    }

    if (dataPedidos.status === 'fulfilled' && dataPedidos.value?.success) {
      // Un color fijo por pedido, repetido cada día desde que se creó hasta
      // la entrega, para distinguir a simple vista pedidos que se cruzan.
      _empPedidosApiCache = [];
      (dataPedidos.value.pedidos || []).filter(p => p.fecha_estimada).forEach(p => {
        const color  = colorForId(p.id);
        const inicio = new Date(((p.fecha_creacion || p.fecha_estimada).substring(0, 10)) + 'T00:00:00');
        const fin    = new Date(p.fecha_estimada.substring(0, 10) + 'T00:00:00');
        const dias   = Math.max(0, Math.min(60, Math.round((fin - inicio) / 86400000)));
        for (let i = 0; i <= dias; i++) {
          const d = new Date(inicio); d.setDate(d.getDate() + i);
          _empPedidosApiCache.push({
            id: 'APED-' + p.id,
            eventoTipo: 'pedido',
            date: isoDate(d),
            time: '',
            type: 'pedido',
            title: `Entrega: ${p.nombre_cliente}`,
            notes: `Pedido ${p.numero_pedido} • ${p.tipo_entrega === 'envio' ? 'Envío' : 'Recoger'}`,
            cliente_id: p.cliente_id || null,
            color,
            datos: p
          });
        }
      });
    }

    _calEmpLastLoaded = Date.now();
  } catch(e) { /* silencioso — el calendario muestra eventos de localStorage */ }
  finally {
    if (btn) btn.innerHTML = '<i data-lucide="refresh-cw"></i>';
  }
}

// ================== INIT (primer DOMContentLoaded) ==================
document.addEventListener('DOMContentLoaded', () => {
  if(document.getElementById('inventoryTable')){
    bootstrapInventoryFromTableIfEmpty();
    renderInventory();
  }

  setUnreadCount(getUnreadCount());
  refreshKpisFromPedidosTable();

  // No pisar un aviso ya visible (ej. de push-notifications.js) — "Bienvenido"
  // es decorativo, un aviso real (permisos, errores) importa más y debe leerse.
  setTimeout(() => {
    if (!document.querySelector('.notification')) showNotification(window.WH_ROL === 'disenador' ? 'Bienvenido, Diseñador' : 'Bienvenido, Empleado', 'success');
  }, 400);

  // ── FIX MENSAJE DE DEBUG: Guardar sin iconos en addActivity, el render los pone ──
  // addActivity ya recibe el título con <i> tag y renderActivity lo muestra con innerHTML
  if(!getActivity().length){
    cargarNombreEmpleado();
    addActivity('<i data-lucide="circle-check"></i> Panel empleado inicializado', 'Acceso limitado: ver/actualizar pedidos y citas.');
  }
  renderActivity();
});

// =============================================================
// API LAYER - Empleado (conexión real a backend)
// =============================================================

const API_BASE = '/api';

async function getAuthToken() {
  try {
    if (typeof firebaseAuth !== 'undefined' && firebaseAuth?.currentUser) {
      return await firebaseAuth.currentUser.getIdToken(false);
    }
    return sessionStorage.getItem('wh_firebase_token') || '';
  } catch(e) { return ''; }
}

async function apiFetch(url, options = {}) {
  options.headers = options.headers || {};
  options.credentials = 'same-origin';
  const token = await getAuthToken();
  if (token) options.headers['Authorization'] = 'Bearer ' + token;
  options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';
  const res = await fetch(url, options);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    if (res.status === 401) throw new Error('Sesión expirada. Recarga la página.');
    if (res.status === 403) throw new Error('Acceso denegado (403)');
    throw new Error('Error servidor HTTP ' + res.status);
  }
  return res.json();
}

// ── FIX LOGOUT: usar replace() y flag sessionStorage para que login.js no auto-redirija ──
async function logout() {
  if (!confirm('¿Cerrar sesión?')) return;
  if (window._autoRefreshInterval) clearInterval(window._autoRefreshInterval);
  if (typeof bajaPushDispositivo === 'function') await bajaPushDispositivo();
  try {
    if (typeof firebaseAuth !== 'undefined') await firebaseAuth.signOut();
  } catch(e) {}
  await fetch('/api/auth.php?action=logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
  sessionStorage.removeItem('wh_firebase_token');
  sessionStorage.removeItem('wh_usuario');
  window.location.replace('/inicio');
}

// ── Pedidos ───────────────────────────────────────────────────
// ── Máquina de estados estricta (espejo de api/pedidos.php) ──────
// El empleado no puede cancelar pedidos — esa transición es solo para admin.
const ESTADO_PEDIDO_LABELS = {
  pendiente:'Pendiente', anticipo_pagado:'Anticipo pagado', pagado:'Pagado',
  listo_para_produccion:'Listo para producción', en_produccion:'En producción',
  alistando_pedido:'Alistando pedido', en_camino_instalacion:'En camino a instalación',
  finalizado:'Finalizado', cancelado:'Cancelado',
};
const ESTADO_PEDIDO_CLASS  = {
  pendiente:'status-pending', anticipo_pagado:'status-pending', pagado:'status-progress',
  listo_para_produccion:'status-info', en_produccion:'status-producing',
  alistando_pedido:'status-info', en_camino_instalacion:'status-ready',
  finalizado:'status-completed', cancelado:'status-cancelled',
};
// El empleado solo puede avanzar pedidos que YA fueron liberados por el diseñador
// (listo_para_produccion en adelante) — no puede tocar nada antes de eso, ni cancelar.
function estadosSiguientesPedidoEmp(estadoActual) {
  const transiciones = {
    pendiente:             [],
    anticipo_pagado:       [],
    pagado:                [],
    listo_para_produccion: ['en_produccion'],
    en_produccion:         ['alistando_pedido'],
    alistando_pedido:      ['en_camino_instalacion', 'finalizado'],
    en_camino_instalacion: ['finalizado'],
    finalizado:            [],
    cancelado:             [],
  };
  return transiciones[estadoActual] || [];
}

async function cargarPedidosEmpleadoAPI() {
  const tbody = document.getElementById('pedidosTable');
  if (!tbody) return;
  try {
    const data = await apiFetch(`${API_BASE}/pedidos.php?limit=30`);
    if (!data.success) return;

    tbody.innerHTML = (data.pedidos || []).map(p => {
      const siguientes = estadosSiguientesPedidoEmp(p.estado);
      const opciones = [p.estado, ...siguientes];
      return `
      <tr data-status="${p.estado}" data-id="${p.id}" data-entrega="${p.fecha_estimada||''}">
        <td>${p.numero_pedido}</td>
        <td>${escapeHtml(p.nombre_cliente)}${p.cliente_id?` <span class="status-badge status-active" style="font-size:10px;padding:2px 8px;" title="Cliente registrado #${p.cliente_id}"><i data-lucide="user-check"></i> #${p.cliente_id}</span>`:''}</td>
        <td>${p.correo_cliente}</td>
        <td>${p.fecha_estimada || '—'}</td>
        <td><span class="status-badge ${ESTADO_PEDIDO_CLASS[p.estado] || ''}">${ESTADO_PEDIDO_LABELS[p.estado] || p.estado}</span></td>
        <td>${estadoPagoBadge(p.estado_pago)}</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <button data-call="verDetallePedidoEmp" data-args="[${p.id}]" style="background:var(--accent);color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;white-space:nowrap;flex-shrink:0;">
            <i data-lucide="eye"></i> Ver
          </button>
          <select class="form-select" style="width:120px;font-size:12px;" data-onchange="actualizarEstadoPedidoEmp" data-id="${p.id}" ${siguientes.length===0?'disabled':''}>
            ${opciones.map(s =>
              `<option value="${s}" ${s===p.estado?'selected':''}>${ESTADO_PEDIDO_LABELS[s]||s}</option>`
            ).join('')}
          </select>
        </td>
      </tr>
    `;
    }).join('');

    // La tabla se reconstruye por completo — reaplicar el filtro que estaba activo
    const filtroActivo = document.querySelector('#pedidos-section .filter-btn.active')?.dataset.filter || 'all';
    filterTable(filtroActivo);
  } catch(e) { console.error('Pedidos API error:', e); }
}

async function actualizarEstadoPedidoEmp(id, estado) {
  try {
    // Al finalizar un pedido con anticipo y saldo pendiente, resolver el cobro
    // del saldo en el mismo paso — evita el doble clic (finalizado + pagado).
    if (estado === 'finalizado') {
      const detalle = await apiFetch(`${API_BASE}/pedidos.php?id=${id}`);
      const p = detalle?.pedido;
      if (p && p.estado_pago !== 'liquidado') {
        const cobrado = confirm('Este pedido todavía tiene saldo por pagar.\n\n¿El cliente ya pagó el resto (efectivo, transferencia o terminal)?\n\nAcepta solo si ya lo pagó: el pedido quedará como liquidado y terminado.');
        if (!cobrado) {
          showNotification('<i data-lucide="triangle-alert"></i> El pedido se puede terminar hasta que el cliente pague el resto. Si no pudo pagar, avisa a ventas o al jefe.', 'warning');
          cargarPedidosEmpleadoAPI();
          return;
        }
        const metodo = await elegirMetodoCobro();
        if (!metodo) { cargarPedidosEmpleadoAPI(); return; }
        const r = await apiFetch(`${API_BASE}/pagos.php?action=marcar_saldo_manual`, {
          method: 'POST', body: JSON.stringify({ pedido_id: id, metodo }),
        });
        if (!r.success) {
          showNotification('<i data-lucide="circle-x"></i> ' + (r.error || 'Error al registrar el pago'), 'error');
          cargarPedidosEmpleadoAPI();
          return;
        }
      }
    }

    const data = await apiFetch(`${API_BASE}/pedidos.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ estado }),
    });
    if (data.success) {
      showNotification('<i data-lucide="circle-check"></i> Estado actualizado', 'success');
      cargarPedidosEmpleadoAPI();
      if (window._empPedId === id) verDetallePedidoEmp(id);
      // Sincronizar calendario con el nuevo estado del pedido
      cargarCitasParaCalendario(true).then(() => { buildCalendar(); renderNext7(); if (selectedDateISO) renderDayEvents(selectedDateISO); });
    } else {
      showNotification('<i data-lucide="circle-x"></i> ' + (data.error || 'Error'), 'error');
    }
  } catch(e) { showNotification('<i data-lucide="circle-x"></i> Error de conexión', 'error'); }
}

// ── Citas ─────────────────────────────────────────────────────
async function cargarCitasAPI() {
  const tbody = document.querySelector('#citas-section table tbody');
  if (!tbody) return;
  try {
    const data = await apiFetch(`${API_BASE}/citas.php?limit=30`);
    if (!data.success) return;

    const clsMap = { nueva:'status-pending', confirmada:'status-progress', completada:'status-completed', cancelada:'status-disabled' };
    tbody.innerHTML = (data.citas || []).map(c => `
      <tr>
        <td>${c.numero_cita}</td>
        <td>${escapeHtml(c.nombre_cliente)}</td>
        <td>${c.cliente_id ? `<span class="status-badge status-active" style="font-size:10px;padding:2px 8px;"><i data-lucide="user-check"></i> #${c.cliente_id}</span>` : '<span style="color: var(--muted);font-size:11px;">—</span>'}</td>
        <td>${c.fecha_cita}</td>
        <td>${c.rango_horario || '—'}</td>
        <td>${c.tipo}</td>
        <td><span class="status-badge ${clsMap[c.estado]||''}">${c.estado}</span></td>
        <td style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
          <button data-call="verDetalleCitaEmp" data-args="[${c.id}]" class="btn btn-primary btn-small" title="Ver detalle"><i data-lucide='eye'></i> Ver</button>
          <button class="btn btn-secondary btn-small" data-call="confirmarCita" data-args="[${c.id}]" title="Confirmar cita"><i data-lucide="check"></i></button>
          <button class="btn btn-secondary btn-small" data-call="completarCita" data-args="[${c.id}]" title="Marcar como completada"><i data-lucide="flag"></i></button>
        </td>
      </tr>
    `).join('');
  } catch(e) { console.error('Citas API error:', e); }
}

async function confirmarCita(id) {
  const data = await apiFetch(`${API_BASE}/citas.php?id=${id}`, { method:'PUT', body: JSON.stringify({ estado: 'confirmada' }) });
  if (data.success) {
    showNotification('<i data-lucide="circle-check"></i> Cita confirmada', 'success');
    cargarCitasAPI();
    cargarCitasParaCalendario(true).then(() => { buildCalendar(); renderNext7(); if (selectedDateISO) renderDayEvents(selectedDateISO); });
  }
}
async function completarCita(id) {
  const data = await apiFetch(`${API_BASE}/citas.php?id=${id}`, { method:'PUT', body: JSON.stringify({ estado: 'completada' }) });
  if (data.success) {
    showNotification('<i data-lucide="circle-check"></i> Cita completada', 'success');
    cargarCitasAPI();
    cargarCitasParaCalendario(true).then(() => { buildCalendar(); renderNext7(); if (selectedDateISO) renderDayEvents(selectedDateISO); });
  }
}

// ── Cotizaciones ──────────────────────────────────────────────
async function cargarCotizacionesAPI() {
  const tbody = document.querySelector('#cotizaciones-section table tbody');
  if (!tbody) return;
  try {
    const data = await apiFetch(`${API_BASE}/cotizaciones.php?limit=30`);
    if (!data.success) return;
    const clsMap = { nueva:'status-pending', en_revision:'status-progress', respondida:'status-completed', cerrada:'status-disabled' };
    const estadoLabels = { nueva:'Nueva', en_revision:'En revisión', respondida:'Respondida', cerrada:'Cerrada' };
    const modeloLabels = {
      sevilla:'Modelo Sevilla', roma:'Modelo Roma', edinburgo:'Modelo Edinburgo',
      singapur:'Modelo Singapur', sydney:'Modelo Sydney', palermo:'Modelo Palermo',
      budapest:'Modelo Budapest', quebec:'Modelo Quebec', toronto:'Modelo Toronto',
      amsterdam:'Modelo Amsterdam', oslo:'Mueble Oslo', paris:'Muebles Paris',
      tokio:'Mueble Tokio', personalizado:'Personalizado',
      baño:'Baño', sala:'Sala', recamara:'Recámara', estudio:'Estudio', cocina:'Cocina', closet:'Closet',
    };
    tbody.innerHTML = (data.cotizaciones || []).map(c => {
      const cid  = c.cliente_id || '';
      const tipo = modeloLabels[c.modelo_mueble] || (c.modelo_mueble || '—');
      return `
      <tr>
        <td>${c.numero_cotizacion}</td>
        <td>${escapeHtml(c.nombre_cliente)}</td>
        <td>${cid ? `<span class="status-badge status-active" style="font-size:10px;padding:2px 8px;"><i data-lucide="user-check"></i> #${cid}</span>` : '<span style="color: var(--muted);font-size:11px;">—</span>'}</td>
        <td>${escapeHtml(tipo)}</td>
        <td>${c.rango_presupuesto || '—'}</td>
        <td><span class="status-badge ${clsMap[c.estado]||''}">${estadoLabels[c.estado]||c.estado}</span></td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
            <button data-call="verDetalleCotEmp" data-args="[${c.id}]" class="btn btn-primary btn-small" title="Ver detalle"><i data-lucide='eye'></i> Ver</button>
            <select class="form-select" style="width:115px;font-size:11px;" data-onchange="actualizarCotizacion" data-id="${c.id}">
              ${['nueva','en_revision','respondida','cerrada'].map(s =>
                `<option value="${s}" ${s===c.estado?'selected':''}>${estadoLabels[s]||s}</option>`
              ).join('')}
            </select>
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch(e) { console.error('Cotizaciones API error:', e); }
}

// ════════════════════════════════════════════════════════════════
// MODALES DE DETALLE — Pedido, Cita, Cotización (empleado)
// ════════════════════════════════════════════════════════════════

async function verDetallePedidoEmp(id) {
  const body  = document.getElementById('emp_ped_body');
  const folio = document.getElementById('emp_ped_folio');
  openModal('empPedidoDetalleModal');
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);"><i class="wh-icon-spin icon-2x" data-lucide="loader-circle"></i></div>';
  window._empPedId = id;

  const tr = document.querySelector(`tr[data-id="${id}"]`);
  if (tr) currentPedidoRow = tr;

  try {
    const data = await apiFetch(`${API_BASE}/pedidos.php?id=${id}`);
    if (!data.success || !data.pedido) throw new Error(data.error || 'No encontrado');
    const p = data.pedido;

    folio.textContent = p.numero_pedido;

    if (currentPedidoRow) {
      currentPedidoRow.dataset.status  = p.estado;
      currentPedidoRow.dataset.entrega = p.tipo_entrega || '';
    }

    const estadoLabels = ESTADO_PEDIDO_LABELS;
    const estadoClass  = ESTADO_PEDIDO_CLASS;
    const est   = p.estado || 'pendiente';
    const cls   = estadoClass[est]  || 'status-pending';
    const label = estadoLabels[est] || est;

    let entrega;
    if (p.tipo_entrega === 'recoger') {
      entrega = '🏪 Pasa a recogerlo al taller';
    } else {
      // Pedidos cargados a mano (ver pedido-manual.js) suelen traer un link de
      // ubicación pegado directo en direccion_envio en vez de texto — usarlo
      // tal cual como link del mapa en lugar de re-envolverlo en una búsqueda.
      const esLinkDireccion = /^https?:\/\//i.test((p.direccion_envio || '').trim());
      const partesDireccion = [
        p.direccion_envio,
        p.colonia_envio   ? `Col. ${p.colonia_envio}` : '',
        p.ciudad_envio,
        p.municipio_envio ? `Mpio. ${p.municipio_envio}` : '',
        p.cp_envio        ? `CP ${p.cp_envio}` : '',
      ].filter(Boolean).join(', ');
      let mapsUrl;
      if (p.lat && p.lng) {
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
      } else if (esLinkDireccion) {
        mapsUrl = p.direccion_envio.trim();
      } else if (partesDireccion) {
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partesDireccion)}`;
      }
      const mapsBtn = mapsUrl
        ? ` <a href="${mapsUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;margin-left:8px;padding:3px 10px;background:#4285F420;border:1px solid #4285F460;border-radius:6px;color:#4285F4;font-size:11px;text-decoration:none;vertical-align:middle;"><i data-lucide="map-pinned"></i> Ver en mapa${p.lat ? ' 📍' : ''}</a>`
        : '';
      entrega = esLinkDireccion
        ? `🚚 Envío${mapsBtn}`
        : `🚚 Envío — ${partesDireccion || 'Sin dirección'}${mapsBtn}`;
    }
    const instalacion = parseInt(p.incluye_instalacion) ? '✅ Incluye instalación' : '❌ Sin instalación';

    const items = p.items || [];
    const renderSpecsEmp = specs => {
      if (!specs?.length) return '';
      return `<div style="margin-top:4px;padding:6px 8px;background:var(--bg);border-radius:6px;font-size:11px;color:var(--muted);line-height:1.8;">
        ${specs.map(s => `<span style="margin-right:12px;"><strong style="color:var(--muted2);">${escapeHtml(s.clave)}:</strong> ${escapeHtml(s.valor)}</span>`).join('')}
      </div>`;
    };
    const itemsHtml = items.length
      ? `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;">
          <thead><tr style="background:var(--bg);">
            <th style="padding:8px 6px;text-align:left;color:var(--accent);border-bottom:1px solid var(--border);">Producto</th>
            <th style="padding:8px 6px;text-align:center;color:var(--accent);border-bottom:1px solid var(--border);">Cant.</th>
          </tr></thead>
          <tbody>${items.map(i=>`
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:8px 6px;color:var(--muted2);">
                <div>${escapeHtml(i.nombre_producto||i.producto_nombre||'Producto')}</div>
                ${renderSpecsEmp(i.especificaciones)}
                ${detalleLineaHtml(i)}
              </td>
              <td style="padding:8px 6px;text-align:center;color:var(--muted2);">${Number(i.cantidad)}${i.unidad&&i.unidad!=="pza"?" "+escapeHtml(i.unidad):""}</td>
            </tr>`).join('')}
          </tbody>
        </table>`
      : '<p style="color:var(--muted);font-style:italic;font-size:12px;padding:8px 0;">Sin productos registrados</p>';

    // Sin cifras (la API ya no las manda a taller/instalación/diseño): solo
    // si el cliente ya pagó todo, para saber si hay que cobrar al entregar.
    const saldoHtml = `<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:14px;">
        <div style="font-weight:700;color:var(--accent);margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Pago del cliente</div>
        ${estadoPagoBadge(p.estado_pago)}
        <div style="font-size:12px;color:var(--muted2);margin-top:6px;line-height:1.5;">${
          p.estado_pago === 'liquidado'
            ? 'El cliente ya pagó todo. Al terminar, solo marca el pedido como <strong>Finalizado</strong>.'
            : 'El cliente <strong>todavía debe una parte</strong>. Al terminar la entrega/instalación, confirma que pagó el resto y marca el pedido como <strong>Finalizado</strong> — el sistema te lo pregunta en ese paso.'
        }</div>
      </div>`;

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:18px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;"><span class="status-badge ${cls}">${label}</span>${tipoProyectoBadge(p.tipo_proyecto)}</div>
      </div>

      <div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:14px;">
        <div style="font-weight:700;color:var(--accent);margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Cliente</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--muted2);">
          <div><span style="color:var(--muted);display:block;font-size:10px;">Nombre</span><strong>${escapeHtml(p.nombre_cliente)}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Teléfono</span><strong>${escapeHtml(p.telefono_cliente||'—')}${telefonosSecundariosHtml(p.telefonos_secundarios)}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Correo</span><strong>${escapeHtml(p.correo_cliente)}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Fecha de entrega / instalación</span><strong>${p.fecha_estimada||'—'}</strong></div>
          <div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Entrega</span><strong>${entrega}</strong></div>
          <div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Instalación</span><strong>${instalacion}</strong></div>
          ${p.notas?`<div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Notas</span><strong style="white-space:pre-line;">${escapeHtml(p.notas)}</strong></div>`:''}
          ${p.cliente_id?`<div style="grid-column:1/-1;margin-top:4px;"><span style="background:#2d6a3f20;color:#2d6a3f;border-radius:12px;padding:3px 10px;font-size:11px;font-weight:700;"><i data-lucide="user-check"></i> Cliente registrado #${p.cliente_id}</span></div>`:''}
        </div>
      </div>

      ${saldoHtml}

      ${p.adjuntos?.length ? `
      <details class="wh-collapse" open style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;">
        <summary><i data-lucide="paperclip"></i> Adjuntos del pedido <span class="wh-collapse-count">(${p.adjuntos.length})</span></summary>
        <div class="wh-collapse-body">
          ${p.adjuntos.filter(a=>a.tipo==='foto').length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:${p.adjuntos.some(a=>a.tipo==='audio')?'10px':'0'};">
            ${p.adjuntos.filter(a=>a.tipo==='foto').map(a => `<a href="${a.url}" target="_blank" rel="noopener"><img src="${a.url}" alt="Foto de referencia" style="width:84px;height:84px;object-fit:cover;border-radius:6px;border:1px solid var(--border);"></a>`).join('')}
          </div>` : ''}
          ${p.adjuntos.filter(a=>a.tipo==='audio').map(a => `<audio controls src="${a.url}" style="width:100%;height:36px;"></audio>`).join('')}
        </div>
      </details>
      ` : ''}

      ${(p.imagenes_diseno?.length || p.mensaje_disenador) ? `
      <details class="wh-collapse" open style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;">
        <summary><i data-lucide="ruler"></i> Diseño <span class="wh-collapse-count">(${(p.imagenes_diseno||[]).length})</span></summary>
        <div class="wh-collapse-body">
        ${(() => {
          const diseno = p.imagenes_diseno || [];
          const renders = diseno.filter(i => i.tipo === 'sketchup');
          const skp     = diseno.filter(i => i.tipo === 'skp');
          const cortes  = diseno.filter(i => i.tipo === 'vcarve');
          const otros   = diseno.filter(i => !['sketchup','skp','vcarve'].includes(i.tipo));
          let html = '';
          if (renders.length) html += `<div style="margin-bottom:8px;"><div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Render (SketchUp)</div><div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${renders.map(img => `<a href="${img.url_imagen}" target="_blank" rel="noopener"><img src="${img.url_imagen}" alt="Render" style="width:84px;height:84px;object-fit:cover;border-radius:6px;border:1px solid var(--border);"></a>`).join('')}
          </div></div>`;
          if (skp.length) html += `<div style="margin-bottom:8px;"><div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Proyecto SketchUp (.skp)</div><div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${skp.map((f,i) => `<a href="${f.url_imagen}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:6px;background:var(--surface,#1a1a1a);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:12px;color:var(--accent);"><i data-lucide="box"></i> Proyecto .skp ${skp.length>1?(i+1):''}</a>`).join('')}
          </div></div>`;
          if (cortes.length) {
            const grupos = {};
            cortes.forEach(c => { const g = c.grupo || 'Sin variante'; (grupos[g] = grupos[g] || []).push(c); });
            html += `<div style="margin-bottom:8px;"><div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Cortes para CNC (DXF / VCarve)</div>`
              + Object.entries(grupos).map(([g, files]) => `
                <details class="wh-subcollapse" open>
                  <summary><i data-lucide="folder"></i> ${escapeHtml(g)} <span class="wh-collapse-count">(${files.length})</span></summary>
                  <div class="wh-collapse-body" style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${files.map((f,i) => `<a href="${f.url_imagen}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:6px;background:var(--surface,#1a1a1a);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:12px;color:var(--accent);"><i data-lucide="file-text"></i> Corte ${i+1}</a>`).join('')}
                  </div>
                </details>
              `).join('') + `</div>`;
          }
          if (otros.length) html += `<div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${otros.map(img => `<a href="${img.url_imagen}" target="_blank" rel="noopener"><img src="${img.url_imagen}" alt="Referencia" style="width:84px;height:84px;object-fit:cover;border-radius:6px;border:1px solid var(--border);"></a>`).join('')}
          </div>`;
          return html;
        })()}
        ${p.mensaje_disenador ? `<div style="font-size:12px;color:var(--muted2);margin-top:6px;"><strong>Mensaje del diseñador:</strong> ${escapeHtml(p.mensaje_disenador)}</div>` : ''}
        </div>
      </details>
      ` : ''}

      ${p.cotizacion_origen ? `
      <details class="wh-collapse" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;">
        <summary><i data-lucide="receipt"></i> Partidas cotizadas (${escapeHtml(p.cotizacion_origen.numero_cotizacion)}) <span class="wh-collapse-count">— ver historial completo</span></summary>
        <div class="wh-collapse-body">
          ${p.cotizacion_origen.items?.length ? `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px;">
            <tbody>${p.cotizacion_origen.items.map(it => `<tr style="border-bottom:1px solid var(--border);"><td style="padding:5px 4px;color:var(--muted2);">${escapeHtml(it.nombre_item)}</td><td style="padding:5px 4px;text-align:center;color:var(--muted2);">${it.cantidad} ${escapeHtml(it.unidad)}</td></tr>`).join('')}</tbody>
          </table>` : ''}
          ${p.cotizacion_origen.descripcion_respuesta ? `<div style="font-size:12px;color:var(--muted2);margin-bottom:8px;">${escapeHtml(p.cotizacion_origen.descripcion_respuesta)}</div>` : ''}
          ${p.cotizacion_origen.audio_respuesta_url ? `<audio controls src="${p.cotizacion_origen.audio_respuesta_url}" style="width:100%;height:36px;margin-bottom:8px;"></audio>` : ''}
          ${p.cotizacion_origen.imagenes?.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;">${p.cotizacion_origen.imagenes.map(im => `<a href="${im.url_imagen}" target="_blank" rel="noopener"><img src="${im.url_imagen}" alt="Referencia" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid var(--border);"></a>`).join('')}</div>` : ''}
          ${p.cotizacion_origen.pdf_url ? `<p style="margin-top:8px;"><a href="${p.cotizacion_origen.pdf_url}" target="_blank" rel="noopener" style="color:var(--accent);font-size:12px;"><i data-lucide="file-text"></i> Ver PDF de la propuesta</a></p>` : ''}
        </div>
      </details>
      ` : ''}

      <div style="margin-bottom:14px;">
        <div style="font-weight:700;color:var(--accent);margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Productos del Pedido</div>
        ${itemsHtml}
      </div>


      ${window.WH_ROL === 'disenador' && ['anticipo_pagado','pagado'].includes(est) ? `
      <div style="padding-top:14px;border-top:1px solid var(--border);margin-bottom:14px;">
        <div style="font-weight:700;color:var(--accent);margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;"><i data-lucide="ruler"></i> Diseñar — marcar listo para producción</div>
        <div class="form-group" style="margin-bottom:8px;">
          <label class="form-label" style="font-size:11px;">Render (SketchUp) — imagen *</label>
          <input type="file" id="disenoRenderInput" accept="image/jpeg,image/jpg,image/png,image/webp" multiple class="form-input">
          <div class="help">Para que taller/instalación vean cómo debe quedar.</div>
        </div>
        <div class="form-group" style="margin-bottom:8px;">
          <label class="form-label" style="font-size:11px;">Corte para CNC (VCarve) — archivo .dxf *</label>
          <input type="file" id="disenoDxfInput" accept=".dxf" multiple class="form-input">
          <div class="help">El archivo que taller manda a la CNC para cortar.</div>
        </div>
        <div class="form-group" style="margin-bottom:8px;">
          <label class="form-label" style="font-size:11px;">Mensaje para instaladores/taller (opcional)</label>
          <textarea id="disenoMensajeInput" class="form-input" rows="2" placeholder="Ej: cuidado con la veta en el panel frontal..."></textarea>
        </div>
        <button class="btn btn-primary btn-small" id="btnMarcarListoProduccion" data-call="marcarListoParaProduccion" data-args="[${id}]">
          <i data-lucide="check"></i> Marcar listo para producción
        </button>
      </div>` : ''}

      <div style="padding-top:14px;border-top:1px solid var(--border);">
        <div style="font-weight:700;color:var(--accent);margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Cambiar Estado</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <span class="status-badge ${cls}" style="opacity:1;">${label} (actual)</span>
          ${estadosSiguientesPedidoEmp(est).map(s=>{
            const l2=estadoLabels[s]||s;
            const c2=estadoClass[s]||'status-pending';
            return `<button type="button" data-emp-ped-estado="${s}"
              class="status-badge ${c2}" style="cursor:pointer;border:none;opacity:0.85;">→ ${l2}</button>`;
          }).join('') || '<span style="color:var(--muted);font-size:12px;">Estado final — sin más transiciones</span>'}
        </div>
        ${['pendiente','anticipo_pagado','pagado'].includes(est) ? '<p style="color:var(--muted);font-size:11px;margin-top:8px;"><i data-lucide="info"></i> Este pedido pasará a producción cuando el diseñador termine el diseño y lo marque como listo.</p>' : ''}
      </div>
    `;
  } catch(e) {
    body.innerHTML = `<div style="color:var(--danger);padding:20px;text-align:center;"><i data-lucide="circle-alert"></i> Error: ${e.message}</div>`;
  }
}

// ── Diseñador: subir imágenes de diseño y marcar listo para producción ──
// Sube renders (imágenes) — validación real por magic bytes, igual que antes.
async function subirImagenesDiseno(files, pedidoId) {
  if (!window.firebaseStorage && typeof initFirebase === 'function') initFirebase();
  if (!window.firebaseStorage) throw new Error('Firebase Storage no disponible. Verifica que hayas iniciado sesión correctamente.');

  const resultados = [];
  const ts = Date.now();
  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!ALLOWED_MIME.includes(file.type)) {
      throw new Error(`Archivo "${file.name}" no es una imagen válida. Solo se permiten JPEG, PNG o WEBP.`);
    }
    const headerBuf = await file.slice(0, 12).arrayBuffer();
    const hdr = new Uint8Array(headerBuf);
    const isJpeg = hdr[0]===0xFF && hdr[1]===0xD8 && hdr[2]===0xFF;
    const isPng  = hdr[0]===0x89 && hdr[1]===0x50 && hdr[2]===0x4E && hdr[3]===0x47;
    const isWebp = hdr[8]===0x57 && hdr[9]===0x45 && hdr[10]===0x42 && hdr[11]===0x50;
    if (!isJpeg && !isPng && !isWebp) {
      throw new Error(`Archivo "${file.name}" no pasó la validación de imagen real.`);
    }
    const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
    const path = `proyectos/pedidos/${pedidoId}/render-${ts}-${i}.${ext}`;
    const ref  = window.firebaseStorage.ref(path);
    const snap = await ref.put(file);
    resultados.push({ url: await snap.ref.getDownloadURL(), tipo: 'sketchup' });
  }
  return resultados;
}

// Sube archivos de corte DXF (VCarve → CNC) — no son imágenes, se validan por
// extensión (.dxf) y un límite de tamaño razonable, no por magic bytes.
async function subirDxfDiseno(files, pedidoId) {
  if (!window.firebaseStorage && typeof initFirebase === 'function') initFirebase();
  if (!window.firebaseStorage) throw new Error('Firebase Storage no disponible. Verifica que hayas iniciado sesión correctamente.');

  const resultados = [];
  const ts = Date.now();
  const MAX_BYTES = 25 * 1024 * 1024; // 25MB

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!/\.dxf$/i.test(file.name)) {
      throw new Error(`Archivo "${file.name}" no es un .dxf.`);
    }
    if (file.size > MAX_BYTES) {
      throw new Error(`Archivo "${file.name}" supera el tamaño máximo (25MB).`);
    }
    const path = `proyectos/pedidos/${pedidoId}/corte-${ts}-${i}.dxf`;
    const ref  = window.firebaseStorage.ref(path);
    const snap = await ref.put(file);
    resultados.push({ url: await snap.ref.getDownloadURL(), tipo: 'vcarve' });
  }
  return resultados;
}

async function marcarListoParaProduccion(id) {
  const renderInput = document.getElementById('disenoRenderInput');
  const dxfInput     = document.getElementById('disenoDxfInput');
  const renderFiles  = renderInput?.files;
  const dxfFiles     = dxfInput?.files;
  const mensaje      = document.getElementById('disenoMensajeInput')?.value?.trim() || '';
  if (!renderFiles || renderFiles.length === 0) {
    showNotification('<i data-lucide="triangle-alert"></i> Adjunta al menos un render (SketchUp).', 'error');
    return;
  }
  if (!dxfFiles || dxfFiles.length === 0) {
    showNotification('<i data-lucide="triangle-alert"></i> Adjunta al menos un archivo de corte (.dxf) para VCarve/CNC.', 'error');
    return;
  }
  const btn = document.getElementById('btnMarcarListoProduccion');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="wh-icon-spin" data-lucide="loader-circle"></i> Subiendo...'; }
  try {
    const [renders, cortes] = await Promise.all([
      subirImagenesDiseno(renderFiles, id),
      subirDxfDiseno(dxfFiles, id),
    ]);
    const data = await apiFetch(`${API_BASE}/pedidos.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        estado: 'listo_para_produccion',
        imagenes: [...renders, ...cortes],
        mensaje_disenador: mensaje,
      }),
    });
    if (data.success) {
      showNotification('<i data-lucide="circle-check"></i> Pedido marcado listo para producción.', 'success');
      cargarPedidosEmpleadoAPI();
      verDetallePedidoEmp(id);
    } else {
      showNotification('<i data-lucide="circle-x"></i> ' + (data.error || 'Error'), 'error');
    }
  } catch (e) {
    showNotification('<i data-lucide="circle-x"></i> ' + (e.message || 'Error al subir los archivos'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="check"></i> Marcar listo para producción'; }
  }
}

async function marcarSaldoManualEmp(id) {
  const metodo = await elegirMetodoCobro();
  if (!metodo) return;
  try {
    const data = await apiFetch(`${API_BASE}/pagos.php?action=marcar_saldo_manual`, {
      method: 'POST',
      body: JSON.stringify({ pedido_id: id, metodo }),
    });
    if (data.success) {
      showNotification('<i data-lucide="circle-check"></i> Saldo registrado como pagado', 'success');
      verDetallePedidoEmp(id);
      cargarPedidosEmpleadoAPI();
    } else {
      showNotification('<i data-lucide="circle-x"></i> ' + (data.error || 'Error'), 'error');
    }
  } catch(e) {
    showNotification('<i data-lucide="circle-x"></i> Error de conexión', 'error');
  }
}

async function verDetalleCitaEmp(id) {
  const body  = document.getElementById('emp_cita_body');
  const folio = document.getElementById('emp_cita_folio');
  window._empCitaId = id;
  openModal('empCitaDetalleModal');
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);"><i class="wh-icon-spin icon-2x" data-lucide="loader-circle"></i></div>';

  try {
    const data = await apiFetch(`${API_BASE}/citas.php?id=${id}`);
    if (!data.success || !data.cita) throw new Error(data.error || 'No encontrada');
    const c = data.cita;
    folio.textContent = c.numero_cita;

    const estLabels = { nueva:'Nueva',confirmada:'Confirmada',completada:'Completada',cancelada:'Cancelada' };
    const estClass  = { nueva:'status-new',confirmada:'status-progress',completada:'status-completed',cancelada:'status-cancelled' };
    const tipoLabels = { medicion:'Medición 📐',instalacion:'Instalación 🔧',otro:'Otro' };
    const est = c.estado || 'nueva';

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:18px;">
        <span class="status-badge ${estClass[est]||'status-new'}">${estLabels[est]||est}</span>
        <span style="font-size:11px;color:var(--muted);">Registrada: ${(c.fecha_creacion||'').substring(0,10)}</span>
      </div>

      <div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:14px;">
        <div style="font-weight:700;color:var(--accent);margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Fecha y Tipo</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--muted2);">
          <div><span style="color:var(--muted);display:block;font-size:10px;">📅 Fecha</span><strong style="font-size:15px;">${c.fecha_cita||'—'}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">🕐 Horario</span><strong style="font-size:15px;">${c.rango_horario||'Por confirmar'}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Tipo</span><strong>${tipoLabels[c.tipo]||c.tipo||'—'}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Folio</span><strong>${c.numero_cita}</strong></div>
        </div>
      </div>

      <div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;">
        <div style="font-weight:700;color:var(--accent);margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Cliente</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--muted2);">
          <div><span style="color:var(--muted);display:block;font-size:10px;">Nombre</span><strong>${escapeHtml(c.nombre_cliente)}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Teléfono</span><strong>${escapeHtml(c.telefono_cliente||'—')}</strong></div>
          <div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Correo</span><strong>${escapeHtml(c.correo_cliente)}</strong></div>
          <div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">📍 Dirección</span><strong>${escapeHtml(c.direccion||'Sin especificar')}</strong></div>
          ${c.notas?`<div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Notas</span><strong>${escapeHtml(c.notas)}</strong></div>`:''}
          ${c.cliente_id?`<div style="grid-column:1/-1;margin-top:4px;"><span style="background:#2d6a3f20;color:#2d6a3f;border-radius:12px;padding:3px 10px;font-size:11px;font-weight:700;"><i data-lucide="user-check"></i> Cliente registrado #${c.cliente_id}</span></div>`:''}
        </div>
      </div>
    `;
  } catch(e) {
    body.innerHTML = `<div style="color:var(--danger);padding:20px;text-align:center;"><i data-lucide="circle-alert"></i> Error: ${e.message}</div>`;
  }
}

async function verDetalleCotEmp(id) {
  const body  = document.getElementById('emp_cot_body');
  const folio = document.getElementById('emp_cot_folio');
  window._empCotId = id;
  openModal('empCotDetalleModal');
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);"><i class="wh-icon-spin icon-2x" data-lucide="loader-circle"></i></div>';

  try {
    const data = await apiFetch(`${API_BASE}/cotizaciones.php?id=${id}`);
    if (!data.success || !data.cotizacion) throw new Error(data.error || 'No encontrada');
    const cot = data.cotizacion;
    folio.textContent = cot.numero_cotizacion;

    const estLabels = { nueva:'Nueva',en_revision:'En Revisión',respondida:'Respondida',cerrada:'Cerrada' };
    const estClass  = { nueva:'status-new',en_revision:'status-pending',respondida:'status-replied',cerrada:'status-disabled' };
    const est = cot.estado || 'nueva';

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:18px;">
        <span class="status-badge ${estClass[est]||'status-new'}">${estLabels[est]||est}</span>
        <span style="font-size:11px;color:var(--muted);">Creada: ${(cot.fecha_creacion||'').substring(0,10)}</span>
      </div>

      <div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:14px;">
        <div style="font-weight:700;color:var(--accent);margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Cliente</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--muted2);">
          <div><span style="color:var(--muted);display:block;font-size:10px;">Nombre</span><strong>${escapeHtml(cot.nombre_cliente)}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Teléfono</span><strong>${escapeHtml(cot.telefono_cliente||'—')}</strong></div>
          <div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Correo</span><strong>${escapeHtml(cot.correo_cliente)}</strong></div>
          ${cot.cliente_id?`<div style="grid-column:1/-1;margin-top:4px;"><span style="background:#2d6a3f20;color:#2d6a3f;border-radius:12px;padding:3px 10px;font-size:11px;font-weight:700;"><i data-lucide="user-check"></i> Cliente registrado #${cot.cliente_id}</span></div>`:''}
        </div>
      </div>

      <div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;">
        <div style="font-weight:700;color:var(--ok);margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Especificaciones</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--muted2);">
          <div><span style="color:var(--muted);display:block;font-size:10px;">Modelo de mueble</span><strong>${escapeHtml(cot.modelo_mueble||'No especificado')}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Presupuesto</span><strong>${escapeHtml(cot.rango_presupuesto||'No especificado')}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Tiene medidas</span><strong>${parseInt(cot.tiene_medidas)?'✅ Sí':'❌ No'}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Requiere instalación</span><strong>${parseInt(cot.requiere_instalacion)?'✅ Sí':'❌ No'}</strong></div>
          ${cot.medidas?`<div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Medidas</span><strong>${escapeHtml(cot.medidas)}</strong></div>`:''}
          <div style="grid-column:1/-1;">
            <span style="color:var(--muted);display:block;font-size:10px;margin-bottom:4px;">Descripción de la solicitud</span>
            <div style="background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:10px;line-height:1.6;color:var(--muted2);">${escapeHtml(cot.descripcion_solicitud||'—')}</div>
          </div>
          ${cot.notas_admin?`<div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;margin-bottom:4px;">Notas internas</span><div style="background:var(--panel);border:1px solid var(--warn);border-radius:6px;padding:10px;color:var(--muted2);">${escapeHtml(cot.notas_admin)}</div></div>`:''}
        </div>
      </div>
    `;
  } catch(e) {
    body.innerHTML = `<div style="color:var(--danger);padding:20px;text-align:center;"><i data-lucide="circle-alert"></i> Error: ${e.message}</div>`;
  }
}

async function actualizarCotizacion(id, estado) {
  const data = await apiFetch(`${API_BASE}/cotizaciones.php?id=${id}`, { method:'PUT', body: JSON.stringify({ estado }) });
  if (data.success) showNotification('<i data-lucide="circle-check"></i> Cotización actualizada', 'success');
}

// ── KPIs dashboard ────────────────────────────────────────────
// Iniciales de nombre y apellido (no del rol) para el avatar del panel.
function _iniciales(nombre) {
  const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

async function cargarNombreEmpleado() {
  try {
    const data = await apiFetch(`${API_BASE}/auth.php?action=perfil`);
    if (data.success && data.usuario) {
      const nombre = data.usuario.nombre_completo || data.usuario.correo || 'Empleado';
      const el = document.getElementById('empNombreHeader');
      if (el) el.textContent = nombre;
      const avatar = document.getElementById('userAvatar');
      if (avatar) avatar.textContent = _iniciales(data.usuario.nombre_completo);
    }
  } catch(e) { /* silencioso */ }
}

async function refreshKpisAPI() {
  try {
    const data = await apiFetch(`${API_BASE}/reportes.php?tipo=resumen`);
    if (!data.success) { console.warn('[KPI] API error:', data.error); return; }
    const kpiPend = document.getElementById('kpiPendientes');
    if (kpiPend) kpiPend.textContent = data.pedidos_pendientes ?? 0;
  } catch(e) { console.error('[KPI] refreshKpisAPI falló:', e.message); }
}

// ── AUTO-POLLING cada 30 segundos ────────────────────────────
// Refresca la sección visible automáticamente sin que el empleado tenga que hacerlo manual
async function refrescarCalendarioEmp() {
  await cargarCitasParaCalendario(false);
  buildCalendar();
  renderNext7();
  if (selectedDateISO) renderDayEvents(selectedDateISO);
}
window.refrescarCalendarioEmp = refrescarCalendarioEmp;

const _CAL_REFRESH_MS = 90_000; // 90 s entre recargas silenciosas del calendario

// Se salta el ciclo por completo si hay un modal abierto o el foco está en un
// campo de formulario — evita que un re-render borre lo que se está escribiendo.
function _autoRefreshBloqueado() {
  if (document.querySelector('.modal.active')) return true;
  const activo = document.activeElement;
  if (activo && /^(INPUT|TEXTAREA|SELECT)$/.test(activo.tagName)) return true;
  return false;
}

function _autoRefresh() {
  if (_autoRefreshBloqueado()) return;
  const section = window._currentSection || 'dashboard';
  try {
    if      (section === 'pedidos'       && typeof cargarPedidosEmpleadoAPI === 'function') cargarPedidosEmpleadoAPI();
    else if (section === 'citas'         && typeof cargarCitasAPI === 'function')           cargarCitasAPI();
    else if (section === 'cotizaciones'  && typeof cargarCotizacionesAPI === 'function')    cargarCotizacionesAPI();
    else if (section === 'dashboard') {
      if (typeof refreshKpisAPI === 'function') refreshKpisAPI();
      // Refresca el calendario cada 90 s mientras el usuario está en el dashboard
      if (Date.now() - _calEmpLastLoaded > _CAL_REFRESH_MS) {
        cargarCitasParaCalendario(true).then(() => { buildCalendar(); renderNext7(); if (selectedDateISO) renderDayEvents(selectedDateISO); });
      }
    }
  } catch(e) { console.warn('[autoRefresh] Error en sección', section, e); }
}

// ── INIT (segundo DOMContentLoaded - API layer) ───────────────
document.addEventListener('DOMContentLoaded', () => {
  if (typeof firebaseAuth !== 'undefined') {
    let initialized = false;
    firebaseAuth.onAuthStateChanged(user => {
      if (!initialized) { initialized = true; return; } // ignorar primer disparo al cargar
      const _esLocalDev = ['127.0.0.1', 'localhost'].includes(location.hostname);
      if (!user && !_esLocalDev) window.location.replace('/inicio');
    });
  }

  (function limpiarActividadVieja() {
    const limite = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const act = getActivity().filter(a => {
      try { return new Date(a.at).getTime() > limite; } catch(e) { return false; }
    });
    saveActivity(act);
    const notifs = getNotifs().filter(n => {
      try { return new Date(n.at).getTime() > limite; } catch(e) { return false; }
    });
    saveNotifs(notifs);
  })();

  setTimeout(cargarNombreEmpleado, 200);
  setTimeout(refreshKpisAPI, 400);
  setTimeout(fetchNotificationsFromAPI, 800);
  showSection('dashboard');

  window._currentSection = 'dashboard';
  window._autoRefreshInterval = setInterval(_autoRefresh, 45000);
  setInterval(fetchNotificationsFromAPI, 60000);

  // Pausar polling cuando la pestaña no está visible (ahorra requests innecesarios)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(window._autoRefreshInterval);
    } else {
      _autoRefresh();
      window._autoRefreshInterval = setInterval(_autoRefresh, 45000);
    }
  });
});

window.actualizarEstadoPedidoEmp = actualizarEstadoPedidoEmp;
window.confirmarCita      = confirmarCita;
window.completarCita      = completarCita;
window.actualizarCotizacion = actualizarCotizacion;
window.openStockModal     = openStockModal;
window.deleteEvent        = deleteEvent;
window.verDetallePedidoEmp = verDetallePedidoEmp;
window.marcarSaldoManualEmp = marcarSaldoManualEmp;
window.verDetalleCitaEmp  = verDetalleCitaEmp;
window.verDetalleCotEmp   = verDetalleCotEmp;
window.abrirRutaDiaEmp    = abrirRutaDiaEmp;
window.generarRutaDia     = generarRutaDia;

// Backwards-compat: el botón de "Generar ruta" en pedidos usa la nueva función
function abrirRutaDiaEmp() {
  const fecha = document.getElementById('rutaFechaEmp')?.value;
  if (!fecha) { showNotification('Selecciona una fecha para la ruta', 'warning'); return; }
  generarRutaDia(fecha);
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO RUTA DEL DÍA — pedidos + citas, ordenados por distancia
// ═══════════════════════════════════════════════════════════════

// Punto de partida fijo (tienda). Coordenadas de Ignacio Zaragoza 36, La Florida, Tlaquepaque.
const ORIGEN_TIENDA = {
  label:   'Ignacio Zaragoza 36, La Florida, San Pedro Tlaquepaque, Jal.',
  address: 'Ignacio Zaragoza 36, La Florida, 45236 San Pedro Tlaquepaque, Jal.',
  lat: 20.64531,
  lng: -103.32675,
};

function _haversineDist(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function _getCurrentPos() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, enableHighAccuracy: false }
    );
  });
}

// Ordena por distancia ascendente desde (oLat, oLng). Fallback sin citas con hora.
function _sortByDistFromOrigin(stops, oLat, oLng) {
  const withGPS    = stops.filter(s => s.lat != null && s.lng != null);
  const withoutGPS = stops.filter(s => s.lat == null || s.lng == null);
  withGPS.forEach(s => { s._distKm = _haversineDist(oLat, oLng, s.lat, s.lng); });
  withGPS.sort((a, b) => a._distKm - b._distKm);
  return [...withGPS, ...withoutGPS];
}

// Ruta con anclaje horario:
//  • Citas con hora = anclas fijas (ordenadas por tiempo).
//  • Pedidos = flexibles: se asignan al slot cuyo ancla (origen o cita previa)
//    es geográficamente más cercana, y se ordenan dentro del slot por distancia.
// Devuelve array que puede incluir objetos { tipo:'_header' } (separadores visuales).
function _buildTimedRoute(stops, oLat, oLng) {
  function parseHoraMs(horaStr) {
    if (!horaStr) return null;
    const m = ('' + horaStr).split('-')[0].trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const d = new Date();
    d.setHours(+m[1], +m[2], 0, 0);
    return d.getTime();
  }
  function fmtH(ms) {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  const citasConHora = [], citasSinHora = [], pedidosGPS = [], sinGPS = [];
  stops.forEach(s => {
    if (s.tipo === 'cita') {
      const t = parseHoraMs(s.hora);
      if (t != null) citasConHora.push({ ...s, _timeMs: t });
      else            citasSinHora.push(s);
    } else {
      (s.lat != null && s.lng != null ? pedidosGPS : sinGPS).push(s);
    }
  });

  // Sin citas con hora → ordenamiento simple por distancia
  if (!citasConHora.length) return _sortByDistFromOrigin(stops, oLat, oLng);

  citasConHora.sort((a, b) => a._timeMs - b._timeMs);

  // Anclas: [origen, cita0, cita1, ...]
  const anchors = [
    { lat: oLat, lng: oLng },
    ...citasConHora.map(c => ({ lat: c.lat, lng: c.lng })),
  ];

  // Asignar cada pedido al ancla más cercana
  const slots = anchors.map(() => []);
  pedidosGPS.forEach(p => {
    let best = 0, bestD = Infinity;
    anchors.forEach((a, i) => {
      if (a.lat == null || a.lng == null) return;
      const d = _haversineDist(a.lat, a.lng, p.lat, p.lng);
      if (d < bestD) { bestD = d; best = i; }
    });
    p._distKm    = bestD < Infinity ? bestD : null;
    p._distRef   = best === 0 ? 'origen' : `cita ${best}`;
    slots[best].push(p);
  });

  // Ordenar pedidos dentro de cada slot: más cercano al ancla primero
  slots.forEach((slot, i) => {
    const a = anchors[i];
    if (a.lat != null && a.lng != null)
      slot.sort((x, y) => (x._distKm ?? 999) - (y._distKm ?? 999));
  });

  // _distKm de las citas (desde su ancla previa)
  citasConHora.forEach((c, i) => {
    const a = anchors[i];
    if (a.lat != null && a.lng != null && c.lat != null && c.lng != null)
      c._distKm = _haversineDist(a.lat, a.lng, c.lat, c.lng);
    c._distRef = 'anterior';
  });

  // Citas sin hora → al final, por dist desde última ancla
  const lastA = anchors[anchors.length - 1];
  citasSinHora.forEach(c => {
    if (lastA.lat != null && lastA.lng != null && c.lat != null && c.lng != null)
      c._distKm = _haversineDist(lastA.lat, lastA.lng, c.lat, c.lng);
    c._distRef = 'anterior';
  });
  citasSinHora.sort((a, b) => (a._distKm ?? 999) - (b._distKm ?? 999));

  // Construir ruta con separadores visuales
  const route = [];
  const h = label => ({ tipo: '_header', label });

  if (slots[0].length || !citasConHora.length) {
    route.push(h(`Antes de las ${fmtH(citasConHora[0]._timeMs)}`));
    route.push(...slots[0]);
  }

  citasConHora.forEach((cita, i) => {
    route.push(cita);
    const nextSlot = slots[i + 1];
    if (nextSlot.length) {
      const rangeLabel = i + 1 < citasConHora.length
        ? `Entre las ${fmtH(cita._timeMs)} y las ${fmtH(citasConHora[i + 1]._timeMs)}`
        : `Después de las ${fmtH(cita._timeMs)}`;
      route.push(h(rangeLabel));
      route.push(...nextSlot);
    }
  });

  if (citasSinHora.length) {
    route.push(h('Citas sin horario definido'));
    route.push(...citasSinHora);
  }
  route.push(...sinGPS); // sin GPS siempre al final, sin header

  return route;
}

async function generarRutaDia(fecha) {
  if (!fecha) fecha = selectedDateISO || isoDate(new Date());

  const label = document.getElementById('rutaDiaFechaLabel');
  const body  = document.getElementById('rutaDiaBody');
  const mBtn  = document.getElementById('rutaDiaMapsBtn');
  if (label) label.textContent = fecha;
  if (body)  body.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);"><i class="wh-icon-spin icon-xl" data-lucide="loader-circle"></i><br><span style="font-size:13px;margin-top:10px;display:block;">Recopilando paradas...</span></div>';
  if (mBtn)  mBtn.style.display = 'none';
  openModal('rutaDiaModal');

  try {
    // ── 1. Citas del día desde caché ─────────────────────────
    const citasDia = _empCitasApiCache.filter(e =>
      e.date === fecha && !['cancelada'].includes(e.datos?.estado || '')
    );

    // ── 2. Pedidos del día en camino a instalación/entrega (domicilio) ─
    // Solo se incluyen en la ruta pedidos con estado 'en_camino_instalacion'.
    const pedidosEvts = _empPedidosApiCache.filter(e =>
      e.date === fecha && e.datos?.estado === 'en_camino_instalacion'
    );

    // ── 3. Fetch detalle de cada pedido para obtener dirección/GPS ─
    const pedRes = await Promise.allSettled(
      pedidosEvts.map(e => apiFetch(`${API_BASE}/pedidos.php?id=${e.datos.id}`))
    );

    // ── 4. Construir paradas ──────────────────────────────────
    const stops = [];

    citasDia.forEach(e => {
      const c = e.datos || {};
      const dir = [c.direccion, c.colonia ? `Col. ${c.colonia}` : '', c.ciudad, c.cp ? `CP ${c.cp}` : ''].filter(Boolean).join(', ');
      if (!dir && !c.lat) return;
      const tipoLabel = c.tipo === 'medicion' ? 'Medición' : c.tipo === 'instalacion' ? 'Instalación' : 'Cita';
      stops.push({
        tipo: 'cita', icon: '📅',
        label: `${tipoLabel}: ${c.nombre_cliente || ''}`,
        hora: e.time || '',
        address: dir,
        lat: c.lat ? parseFloat(c.lat) : null,
        lng: c.lng ? parseFloat(c.lng) : null,
        id: c.id,
      });
    });

    pedRes.forEach(r => {
      if (r.status !== 'fulfilled' || !r.value?.success || !r.value.pedido) return;
      const p = r.value.pedido;
      if (p.tipo_entrega !== 'envio') return;
      const dir = [p.direccion_envio, p.colonia_envio ? `Col. ${p.colonia_envio}` : '', p.ciudad_envio, p.cp_envio ? `CP ${p.cp_envio}` : ''].filter(Boolean).join(', ');
      if (!dir && !p.lat) return;
      stops.push({
        tipo: 'pedido', icon: '📦',
        label: `${p.numero_pedido}: ${p.nombre_cliente}`,
        hora: '',
        address: dir,
        lat: p.lat ? parseFloat(p.lat) : null,
        lng: p.lng ? parseFloat(p.lng) : null,
        id: p.id,
      });
    });

    if (!stops.length) {
      if (body) body.innerHTML = `<div style="padding:28px;text-align:center;color:var(--muted);">
        <i data-lucide="map-pin" style="font-size:2rem;margin-bottom:10px;display:block;opacity:.35;"></i>
        No hay paradas para <strong>${fecha}</strong>.<br>
        <span style="font-size:12px;margin-top:6px;display:block;">Solo se incluyen pedidos con estado "Listo para entrega" y citas con domicilio programadas para ese día.</span>
      </div>`;
      return;
    }

    // ── 5. Determinar origen ──────────────────────────────────
    // Prioridad: GPS del empleado → tienda (Ignacio Zaragoza 36)
    const pos = await _getCurrentPos();
    let oLat, oLng, originLabel, originStr;
    if (pos) {
      oLat = pos.lat;
      oLng = pos.lng;
      originStr   = `${pos.lat},${pos.lng}`;
      originLabel = `<i data-lucide="locate" style="color:var(--ok);"></i> Tu ubicación actual (GPS)`;
    } else {
      oLat = ORIGEN_TIENDA.lat;
      oLng = ORIGEN_TIENDA.lng;
      originStr   = ORIGEN_TIENDA.address;
      originLabel = `<i data-lucide="store" style="color:var(--accent);"></i> ${ORIGEN_TIENDA.label}`;
    }

    // ── 6. Ordenar: citas como anclas horarias, pedidos entre ellas ──
    const sorted = _buildTimedRoute(stops, oLat, oLng);
    const realStops = sorted.filter(s => s.tipo !== '_header');

    // ── 7. Renderizar lista en modal ──────────────────────────
    let stopNum = 0;
    const stopsHtml = sorted.map(s => {
      // Separador de sección horaria
      if (s.tipo === '_header') {
        return `<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.9px;padding:10px 2px 5px;border-top:1px solid var(--border);margin-top:6px;">
          <i data-lucide="clock" style="margin-right:4px;"></i>${escapeHtml(s.label)}
        </div>`;
      }
      stopNum++;
      const isCita = s.tipo === 'cita';
      const distBadge = s._distKm != null
        ? `<span style="font-size:10px;color:var(--muted);"><i data-lucide="arrow-left-right"></i> ~${s._distKm < 1 ? (s._distKm*1000).toFixed(0)+' m' : s._distKm.toFixed(1)+' km'}</span>`
        : '';
      return `
      <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:${isCita?'#3d5a80':'var(--accent)'};color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;">${stopNum}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:13px;color:var(--text);">${s.icon} ${escapeHtml(s.label)}</div>
          ${s.hora ? `<div style="font-size:11px;color:var(--ok);margin-top:2px;font-weight:700;"><i data-lucide="clock"></i> Cita a las ${escapeHtml(s.hora)}</div>` : ''}
          <div style="font-size:12px;color:var(--muted2);margin-top:4px;word-break:break-word;">${escapeHtml(s.address || '(sin dirección registrada)')}</div>
          <div style="display:flex;gap:6px;margin-top:5px;flex-wrap:wrap;">
            ${s.lat && s.lng
              ? `<span style="font-size:10px;background:#2d6a3f20;color:#2d6a3f;border-radius:10px;padding:1px 8px;"><i data-lucide="map-pin"></i> GPS exacto</span>`
              : `<span style="font-size:10px;background:var(--bg);color:var(--muted);border-radius:10px;padding:1px 8px;"><i data-lucide="search"></i> Búsqueda por dirección</span>`}
            ${distBadge}
          </div>
        </div>
      </div>`;
    }).join('');

    const origenDesde = pos ? 'tu ubicación' : 'la tienda';
    const hasCitasConHora = stops.some(s => s.tipo === 'cita' && s.hora);
    if (body) body.innerHTML = `
      <div style="padding:10px 12px;background:var(--bg);border-radius:8px;font-size:12px;color:var(--muted2);margin-bottom:12px;">
        <div style="margin-bottom:4px;"><strong>Salida:</strong> ${originLabel}</div>
        ${!pos ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;"><i data-lucide="info"></i> Activa el GPS del dispositivo para partir desde tu ubicación actual.</div>` : ''}
      </div>
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px;padding:0 2px;">
        ${realStops.length} ${realStops.length===1?'parada':'paradas'} ·
        ${hasCitasConHora ? 'ordenada por horario de citas + proximidad' : `más cercana a más lejana desde ${origenDesde}`}
      </div>
      ${stopsHtml}
      ${realStops.some(s => !s.lat || !s.lng)
        ? `<div style="margin-top:10px;font-size:11px;color:var(--muted);padding:8px 10px;background:var(--bg);border-radius:6px;"><i data-lucide="info"></i> Google Maps geocodificará las paradas sin coordenadas GPS.</div>`
        : ''}
    `;

    // ── 8. Construir URL de Google Maps (excluye separadores) ────
    const waypoints = realStops.map(s => s.lat && s.lng ? `${s.lat},${s.lng}` : s.address).filter(Boolean);
    let mapsUrl;
    if (waypoints.length === 1) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(waypoints[0])}&travelmode=driving`;
    } else {
      const dest     = encodeURIComponent(waypoints[waypoints.length - 1]);
      const middle   = waypoints.slice(0, -1);
      const wpsParam = middle.length ? '&waypoints=' + middle.map(encodeURIComponent).join('|') : '';
      mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${dest}${wpsParam}&travelmode=driving`;
    }

    if (mBtn) {
      mBtn.style.display = '';
      mBtn.onclick = () => window.open(mapsUrl, '_blank', 'noopener');
    }

  } catch(e) {
    if (body) body.innerHTML = `<div style="color:var(--danger);padding:24px;text-align:center;"><i data-lucide="circle-alert"></i> Error: ${escapeHtml(e.message)}</div>`;
  }
}


/* ── Datos extra de pedidos cargados a mano (ver pedido-manual.js) ──────
   Teléfonos adicionales del cliente y "medidas personalizadas" por mueble:
   tienen que llegarle tal cual a quien instala, no quedarse en ventas. */
function telefonosSecundariosHtml(raw) {
  let tels = [];
  try { tels = Array.isArray(raw) ? raw : JSON.parse(raw || '[]'); } catch (e) { tels = []; }
  if (!Array.isArray(tels) || !tels.length) return '';
  return tels.map(t => `<div style="margin-top:2px;"><a href="tel:${encodeURIComponent(String(t).replace(/[^\d+]/g, ''))}" style="color:inherit;">${escapeHtml(t)}</a></div>`).join('');
}
function medidasPersonalizadasHtml(txt) {
  if (!txt || !String(txt).trim()) return '';
  return `<div style="margin-top:4px;padding:6px 8px;border:1px dashed var(--accent);border-radius:6px;font-size:11px;line-height:1.5;color:var(--text);white-space:pre-line;"><strong style="color:var(--accent);">Medidas personalizadas:</strong> ${escapeHtml(txt)}</div>`;
}
// Todo lo que se eligió para ese mueble: ancho, cubierta, color, ovalín,
// monomando, adicionales,
// información extra, medidas y la foto del modelo si no es de catálogo.
const _CUBIERTA_LABELS = { mdf: 'Tapa de MDF', cuarzo: 'Cuarzo', granito: 'Granito', marmol: 'Mármol' };
function detalleLineaHtml(i) {
  const chips = [
    i.ancho_cm ? `Ancho: <strong>${escapeHtml(String(i.ancho_cm))} cm</strong>` : '',
    i.cubierta ? `Cubierta: <strong>${escapeHtml(_CUBIERTA_LABELS[i.cubierta] || i.cubierta)}</strong>` : '',
    i.color ? `Color: <strong>${escapeHtml(i.color)}</strong>` : '',
    i.ovalin ? `Ovalín: <strong>${escapeHtml(i.ovalin)}</strong>` : '',
    i.monomando ? `Monomando: <strong>${escapeHtml(i.monomando)}</strong>` : '',
    i.adicionales ? `Adicionales: <strong>${escapeHtml(i.adicionales)}</strong>` : '',
  ].filter(Boolean);
  return `
    ${chips.length ? `<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11px;color:var(--muted2);">${chips.map(c => `<span>${c}</span>`).join('')}</div>` : ''}
    ${medidasPersonalizadasHtml(i.medidas_personalizadas)}
    ${i.info_extra ? `<div style="margin-top:4px;font-size:11px;line-height:1.5;color:var(--text);white-space:pre-line;"><strong style="color:var(--accent);">Información extra:</strong> ${escapeHtml(i.info_extra)}</div>` : ''}
    ${i.imagen_referencia ? `<a href="${escapeHtml(i.imagen_referencia)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;"><img src="${escapeHtml(i.imagen_referencia)}" alt="Foto del modelo" style="width:84px;height:84px;object-fit:cover;border-radius:6px;border:1px solid var(--border);"></a>` : ''}`;
}
const _TIPO_PROYECTO_LABELS = { bano: 'Mueble de baño', cocina: 'Cocina a la medida', closet: 'Clóset a la medida' };
function tipoProyectoBadge(tipo) {
  if (!tipo) return '';
  const ico = { bano: 'bath', cocina: 'cooking-pot', closet: 'shirt' }[tipo] || 'box';
  return `<span class="status-badge status-info"><i data-lucide="${ico}"></i> ${escapeHtml(_TIPO_PROYECTO_LABELS[tipo] || tipo)}</span>`;
}

// Estado del pago sin cifras (ver estadoPagoPedido en includes/auth.php).
function estadoPagoBadge(estado) {
  const map = {
    liquidado:       ['status-completed', 'circle-check', 'Pagado completo'],
    saldo_pendiente: ['status-pending',   'hand-coins',   'Falta pagar una parte'],
    sin_pago:        ['status-cancelled', 'circle-alert', 'Sin pago registrado'],
  };
  const [cls, ico, txt] = map[estado] || map.sin_pago;
  return `<span class="status-badge ${cls}"><i data-lucide="${ico}"></i> ${txt}</span>`;
}
