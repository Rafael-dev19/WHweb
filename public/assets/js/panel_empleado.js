// ================== UTILIDADES ==================
function openModal(id){ document.getElementById(id)?.classList.add('active'); }
function closeModal(id){ document.getElementById(id)?.classList.remove('active'); }

function showNotification(message, type='info'){
  document.querySelectorAll('.notification').forEach(n => n.remove());
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
  const notif = document.createElement('div');
  notif.className = `notification ${type}`;
  notif.innerHTML = `<i class="fa-solid ${icons[type] || 'fa-circle-info'}" style="margin-right:8px;"></i>${message}`;
  document.body.appendChild(notif);
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
  if(section === 'calendario'){
    cargarCitasParaCalendario().then(() => { buildCalendar(); renderNext7(); });
  }
  if(section === 'dashboard'){   refreshKpisFromPedidosTable(); renderActivity(); refreshKpisAPI(); }
  if(section === 'pedidos')      cargarPedidosEmpleadoAPI();
  if(section === 'citas')        cargarCitasAPI();
  if(section === 'cotizaciones') cargarCotizacionesAPI();
}

// ================== MODALES: click fuera ==================
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', function(e){
    if(e.target === this) this.classList.remove('active');
  });
});

// ================== NOTIFICACIONES (PANEL) ==================
const notifBody  = document.getElementById('notifBody');
const notifDot   = document.getElementById('notifDot');
const notifBtn   = document.getElementById('notifBtn');
const notifPanel = document.getElementById('notifPanel');

const NOTIF_KEY        = 'wh_emp_notifs';
const NOTIF_UNREAD_KEY = 'wh_emp_notifs_unread';
const NOTIF_SEEN_KEY   = 'wh_emp_notifs_seen';

const NOTIF_ICONS = {
  pedido:      { icon:'fa-box',          color:'var(--accent)' },
  cita:        { icon:'fa-calendar-days',color:'#4a7c8b' },
  cotizacion:  { icon:'fa-briefcase',    color:'#4a8b5a' },
  pago:        { icon:'fa-credit-card',  color:'#7c5c8b' },
  sistema:     { icon:'fa-gear',         color:'var(--muted2)' },
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
    <i class="fa-solid ${cfg.icon}"></i>
  </div>`;
}

function renderNotifPanel(){
  if (!notifBody) return;
  const list = getNotifs().slice(0, 20);
  if(!list.length){
    notifBody.innerHTML = `<div class="notif-empty">
      <i class="fa-solid fa-bell-slash"></i>
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
    const res = await fetch('/api/notificaciones.php?destino=empleado', { credentials: 'same-origin' });
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
        <div class="t"><i class="fa-solid fa-clipboard-list"></i> Sin actividad reciente</div>
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
function filterTable(filter, ev){
  document.querySelectorAll('#pedidos-section .filter-btn').forEach(btn => btn.classList.remove('active'));
  ev?.target?.classList?.add('active');

  const rows = document.querySelectorAll('#pedidosTable tr');
  rows.forEach(row => {
    row.style.display = (filter === 'all' || row.dataset.status === filter) ? '' : 'none';
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

function timelineStageFromStatus(status){
  if(status === 'pending') return 1;
  if(status === 'progress') return 2;
  if(status === 'install') return 3;
  if(status === 'completed') return 4;
  return 1;
}

function renderPedidoTimeline(stage){
  const steps = [
    { key:1, label:'Recibido' },
    { key:2, label:'En proceso' },
    { key:3, label:'Instalación' },
    { key:4, label:'Completado' }
  ];
  const box = document.getElementById('pTimeline');
  box.innerHTML = steps.map(s => {
    const done = s.key < stage;
    const active = s.key === stage;
    return `
      <div class="step ${done ? 'done' : ''} ${active ? 'active' : ''}">
        <span class="dot"></span>
        ${s.label}
      </div>
    `;
  }).join('');
}

function viewPedidoFromRow(btn){
  const tr = btn.closest('tr');
  if(!tr) return;
  currentPedidoRow = tr;

  const id = tr.dataset.id;
  const cliente = tr.dataset.cliente;
  const producto = tr.dataset.producto;
  const entrega = tr.dataset.entrega;
  const total = tr.dataset.total;
  const status = tr.dataset.status;

  document.getElementById('pDetId').textContent = '#' + id;
  document.getElementById('pDetCliente').textContent = cliente;
  document.getElementById('pDetProducto').textContent = producto;
  document.getElementById('pDetEntrega').textContent = fmtISOtoDMY(entrega);
  document.getElementById('pDetTotal').textContent = fmtMoney(total);

  renderPedidoTimeline(timelineStageFromStatus(status));
  openModal('pedidoModal');
}

function openUpdateFromRow(btn){
  const tr = btn.closest('tr');
  if(!tr) return;
  currentPedidoRow = tr;
  openUpdateWithRow(tr);
}

function openUpdateFromPedidoModal(){
  closeModal('empPedidoDetalleModal');
  if(currentPedidoRow) openUpdateWithRow(currentPedidoRow);
}

function openUpdateWithRow(tr){
  const id = tr.dataset.id;
  const entrega = tr.dataset.entrega || '';
  const status = tr.dataset.status || 'pendiente';

  document.getElementById('uId').textContent = '#' + id;
  document.getElementById('uEntrega').value = entrega;
  document.getElementById('uNotas').value = '';
  document.getElementById('uStatus').value = status;

  openModal('updatePedidoModal');
}

function statusLabel(status){
  const map = { pendiente:'Pendiente', pagado:'Pagado', en_produccion:'En Producción', listo:'Listo', entregado:'Entregado', cancelado:'Cancelado' };
  return map[status] || status;
}

function statusBadgeClass(status){
  if(status === 'pendiente')     return 'status-pending';
  if(status === 'pagado')        return 'status-progress';
  if(status === 'en_produccion') return 'status-progress';
  if(status === 'listo')         return 'status-progress';
  if(status === 'entregado')     return 'status-completed';
  if(status === 'cancelado')     return 'status-disabled';
  return 'status-pending';
}

async function applyPedidoUpdate(){
  if(!currentPedidoRow) return;

  const newStatus  = document.getElementById('uStatus').value;
  const newEntrega = document.getElementById('uEntrega').value;
  const notas      = document.getElementById('uNotas').value.trim();
  const id         = currentPedidoRow.dataset.id;

  closeModal('updatePedidoModal');

  try {
    const payload = { estado: newStatus };
    if(newEntrega) payload.fecha_estimada = newEntrega;
    if(notas)      payload.notas          = notas;

    const data = await apiFetch(`${API_BASE}/pedidos.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    if(data.success){
      showNotification('<i class="fa-solid fa-circle-check"></i> Pedido actualizado', 'success');
      addActivity(`<i class="fa-solid fa-box"></i> Pedido #${id} actualizado`, `Estado: ${statusLabel(newStatus)}`);
      pushNotif(`Pedido #${id} actualizado`, `Estado: ${statusLabel(newStatus)}`);
      cargarPedidosEmpleadoAPI();
    } else {
      showNotification('<i class="fa-solid fa-circle-xmark"></i> ' + (data.error || 'Error al guardar'), 'error');
    }
  } catch(e) {
    showNotification('<i class="fa-solid fa-circle-xmark"></i> Error de conexión', 'error');
  }

  refreshKpisFromPedidosTable();
  renderActivity();
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

  addActivity('<i class="fa-solid fa-cubes"></i> Insumo agregado', `${id} | ${name} | Stock inicial: ${stock}`);
  pushNotif('Insumo agregado', `${id} | ${name}`);

  closeModal('addItemModal');
  renderInventory();
  showNotification('<i class="fa-solid fa-check"></i> Insumo agregado', 'success');
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
    showNotification('<i class="fa-solid fa-check"></i> Ajuste guardado', 'success');

    addActivity('<i class="fa-solid fa-cubes"></i> Ajuste de inventario', `${id} | Δ ${realDelta} | ${reason}`);
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
  showNotification('<i class="fa-solid fa-check"></i> Movimiento guardado', 'success');

  addActivity('<i class="fa-solid fa-cubes"></i> Movimiento de inventario', `${id} | Δ ${realDelta} | ${reason}`);
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
      addActivity('<i class="fa-solid fa-cubes"></i> Auto-actualizar inventario', `${c.id} | Δ ${delta} | ${c.reason || 'auto'}`);
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

function getCalEvents(){ return JSON.parse(localStorage.getItem(CAL_KEY) || '[]'); }
function saveCalEvents(events){ localStorage.setItem(CAL_KEY, JSON.stringify(events)); }

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

  const events = getCalEvents();
  const todayISO = isoDate(new Date());

  for(let i=0; i<42; i++){
    const day = new Date(start);
    day.setDate(start.getDate() + i);

    const cellMonth = day.getMonth();
    const isMuted = cellMonth !== month;

    const dayISO = isoDate(day);
    const dayEvents = events.filter(e => e.date === dayISO).slice(0,3);

    const cell = document.createElement('div');
    cell.className = 'cal-day' + (isMuted ? ' muted' : '');
    cell.innerHTML = `
      <div class="num">${day.getDate()}</div>
      <div class="cal-chip">
        ${dayEvents.map(e => `<div class="chip ${e.type}">${escapeHtml(e.time || '')} ${escapeHtml(e.title)}</div>`).join('')}
      </div>
    `;

    cell.addEventListener('click', () => {
      selectedDateISO = dayISO;
      renderDayEvents(dayISO);
      showNotification(`<i class="fa-solid fa-calendar-days"></i> Día seleccionado: ${dayISO}`, 'info');
    });

    if(!selectedDateISO && dayISO === todayISO) selectedDateISO = todayISO;
    grid.appendChild(cell);
  }

  renderDayEvents(selectedDateISO || isoDate(new Date()));
}

function renderDayEvents(dayISO){
  const list = document.getElementById('dayEventsList');
  const title = document.getElementById('selectedDayTitle');
  title.textContent = `Eventos del día (${dayISO})`;

  const events = getCalEvents()
    .filter(e => e.date === dayISO)
    .sort((a,b) => (a.time||'').localeCompare(b.time||''));

  if(!events.length){
    list.innerHTML = `<div style="color: var(--muted);">No hay eventos para este día.</div>`;
    return;
  }

  list.innerHTML = events.map(e => `
    <div class="cal-item">
      <div class="t">${escapeHtml((e.time ? e.time + ' — ' : '') + e.title)}${e.cliente_id ? ` <span style="background:#e8f5e9;color:#2E7D32;border-radius:8px;padding:1px 7px;font-size:10px;font-weight:700;"><i class="fa-solid fa-user-check"></i> #${e.cliente_id}</span>` : ''}</div>
      <div class="m">${escapeHtml(e.notes || '')}</div>
      <div style="display:flex; gap:8px; margin-top:6px;">
        <button class="btn btn-secondary btn-small" data-call="deleteEvent" data-args='["${e.id}"]'>Eliminar</button>
      </div>
    </div>
  `).join('');
}

function renderNext7(){
  const box = document.getElementById('nextEventsList');
  const events = getCalEvents();

  const now = new Date();
  const startISO = isoDate(now);
  const end = new Date(now); end.setDate(end.getDate()+7);
  const endISO = isoDate(end);

  const next = events
    .filter(e => e.date >= startISO && e.date <= endISO)
    .sort((a,b) => (a.date + (a.time||'')).localeCompare(b.date + (b.time||'')))
    .slice(0, 12);

  if(!next.length){
    box.innerHTML = `<div style="color: var(--muted);">No hay eventos próximos.</div>`;
    return;
  }

  box.innerHTML = next.map(e => `
    <div class="cal-item">
      <div class="t">${escapeHtml(e.date)} ${escapeHtml(e.time || '')}</div>
      <div class="m">${escapeHtml(e.title)}</div>
    </div>
  `).join('');
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
  showNotification('<i class="fa-solid fa-check"></i> Evento guardado', 'success');

  addActivity('<i class="fa-solid fa-calendar-days"></i> Evento agregado', `${date} ${time || ''} | ${title}`);
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
      showNotification(`<i class="fa-solid fa-check"></i> Cita ${data.numero_cita} agendada`, 'success');
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
      showNotification(`<i class="fa-solid fa-check"></i> Cotización ${data.numero_cotizacion} registrada`, 'success');
      cargarCotizacionesAPI();
    } else {
      showNotification(data.error || 'Error al crear cotización', 'error');
    }
  } catch(e) { showNotification('Error de conexión', 'error'); }
}

async function cargarCitasParaCalendario() {
  try {
    const data = await apiFetch(`${API_BASE}/citas.php?limit=50`);
    if (!data.success || !data.citas?.length) return;
    const existentes = getCalEvents();
    const idsExistentes = new Set(existentes.map(e => e.apiId).filter(Boolean));
    const nuevos = data.citas
      .filter(c => !idsExistentes.has(String(c.id)))
      .map(c => ({
        id: 'API-' + c.id,
        apiId: String(c.id),
        date: (c.fecha_cita || '').substring(0, 10),
        time: c.rango_horario || '10:00',
        type: 'cita',
        title: `${c.tipo === 'medicion' ? 'Medición' : 'Instalación'}: ${c.nombre_cliente}`,
        notes: c.notas || '',
        cliente_id: c.cliente_id || null
      }));
    if (nuevos.length) saveCalEvents([...existentes, ...nuevos]);
  } catch(e) { /* silencioso — el calendario muestra lo que tenga en local */ }
}

// ================== INIT (primer DOMContentLoaded) ==================
document.addEventListener('DOMContentLoaded', () => {
  if(document.getElementById('inventoryTable')){
    bootstrapInventoryFromTableIfEmpty();
    renderInventory();
  }

  setUnreadCount(getUnreadCount());
  refreshKpisFromPedidosTable();

  setTimeout(() => showNotification('Bienvenido', 'success'), 400);

  // ── FIX MENSAJE DE DEBUG: Guardar sin iconos en addActivity, el render los pone ──
  // addActivity ya recibe el título con <i> tag y renderActivity lo muestra con innerHTML
  if(!getActivity().length){
    cargarNombreEmpleado();
    addActivity('<i class="fa-solid fa-circle-check"></i> Panel empleado inicializado', 'Acceso limitado: ver/actualizar pedidos y citas.');
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
    if (res.status === 401 || res.status === 403) throw new Error('Sesión expirada. Recarga la página.');
    throw new Error('Error servidor HTTP ' + res.status);
  }
  return res.json();
}

// ── FIX LOGOUT: usar replace() y flag sessionStorage para que login.js no auto-redirija ──
async function logout() {
  if (!confirm('¿Cerrar sesión?')) return;
  if (window._autoRefreshInterval) clearInterval(window._autoRefreshInterval);
  try {
    if (typeof firebaseAuth !== 'undefined') await firebaseAuth.signOut();
  } catch(e) {}
  await fetch('/api/auth.php?action=logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
  sessionStorage.removeItem('wh_firebase_token');
  sessionStorage.removeItem('wh_usuario');
  window.location.replace('/inicio');
}

// ── Pedidos ───────────────────────────────────────────────────
async function cargarPedidosEmpleadoAPI() {
  const tbody = document.getElementById('pedidosTable');
  if (!tbody) return;
  try {
    const data = await apiFetch(`${API_BASE}/pedidos.php?limit=30`);
    if (!data.success) return;

    const labMap = { pendiente:'Pendiente', anticipo_pagado:'Anticipo pagado', pagado:'Pagado', en_produccion:'En Producción', listo:'Listo', entregado:'Entregado', cancelado:'Cancelado' };
    const clsMap = { pendiente:'status-pending', anticipo_pagado:'status-pending', pagado:'status-progress', en_produccion:'status-progress', listo:'status-info', entregado:'status-completed', cancelado:'status-disabled' };

    tbody.innerHTML = (data.pedidos || []).map(p => `
      <tr data-status="${p.estado}" data-id="${p.id}" data-entrega="${p.fecha_estimada||''}">
        <td>${p.numero_pedido}</td>
        <td>${escapeHtml(p.nombre_cliente)}${p.cliente_id?` <span class="status-badge status-active" style="font-size:10px;padding:2px 8px;" title="Cliente registrado #${p.cliente_id}"><i class="fa-solid fa-user-check"></i> #${p.cliente_id}</span>`:''}</td>
        <td>${p.correo_cliente}</td>
        <td>${p.fecha_estimada || '—'}</td>
        <td><span class="status-badge ${clsMap[p.estado] || ''}">${labMap[p.estado] || p.estado}</span></td>
        <td style="color:var(--accent);font-weight:800;">$${parseFloat(p.total||0).toLocaleString('es-MX')}</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <button data-call="verDetallePedidoEmp" data-args="[${p.id}]" style="background:var(--accent);color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;white-space:nowrap;flex-shrink:0;">
            <i class="fa-solid fa-eye"></i> Ver
          </button>
          <select class="form-select" style="width:120px;font-size:12px;" data-onchange="actualizarEstadoPedidoEmp" data-id="${p.id}">
            ${['pendiente','anticipo_pagado','pagado','en_produccion','listo','entregado'].map(s =>
              `<option value="${s}" ${s===p.estado?'selected':''}>${labMap[s]}</option>`
            ).join('')}
          </select>
        </td>
      </tr>
    `).join('');
  } catch(e) { console.error('Pedidos API error:', e); }
}

async function actualizarEstadoPedidoEmp(id, estado) {
  try {
    const data = await apiFetch(`${API_BASE}/pedidos.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ estado }),
    });
    if (data.success) {
      showNotification('<i class="fa-solid fa-circle-check"></i> Estado actualizado', 'success');
      cargarPedidosEmpleadoAPI();
    } else {
      showNotification('<i class="fa-solid fa-circle-xmark"></i> ' + (data.error || 'Error'), 'error');
    }
  } catch(e) { showNotification('<i class="fa-solid fa-circle-xmark"></i> Error de conexión', 'error'); }
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
        <td>${c.cliente_id ? `<span class="status-badge status-active" style="font-size:10px;padding:2px 8px;"><i class="fa-solid fa-user-check"></i> #${c.cliente_id}</span>` : '<span style="color:#aaa;font-size:11px;">—</span>'}</td>
        <td>${c.fecha_cita}</td>
        <td>${c.rango_horario || '—'}</td>
        <td>${c.tipo}</td>
        <td><span class="status-badge ${clsMap[c.estado]||''}">${c.estado}</span></td>
        <td style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
          <button data-call="verDetalleCitaEmp" data-args="[${c.id}]" class="btn btn-primary btn-small" title="Ver detalle"><i class='fa-solid fa-eye'></i> Ver</button>
          <button class="btn btn-secondary btn-small" data-call="confirmarCita" data-args="[${c.id}]" title="Confirmar cita"><i class="fa-solid fa-check"></i></button>
          <button class="btn btn-secondary btn-small" data-call="completarCita" data-args="[${c.id}]" title="Marcar como completada"><i class="fa-solid fa-flag-checkered"></i></button>
        </td>
      </tr>
    `).join('');
  } catch(e) { console.error('Citas API error:', e); }
}

async function confirmarCita(id) {
  const data = await apiFetch(`${API_BASE}/citas.php?id=${id}`, { method:'PUT', body: JSON.stringify({ estado: 'confirmada' }) });
  if (data.success) { showNotification('<i class="fa-solid fa-circle-check"></i> Cita confirmada', 'success'); cargarCitasAPI(); }
}
async function completarCita(id) {
  const data = await apiFetch(`${API_BASE}/citas.php?id=${id}`, { method:'PUT', body: JSON.stringify({ estado: 'completada' }) });
  if (data.success) { showNotification('<i class="fa-solid fa-circle-check"></i> Cita completada', 'success'); cargarCitasAPI(); }
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
        <td>${cid ? `<span class="status-badge status-active" style="font-size:10px;padding:2px 8px;"><i class="fa-solid fa-user-check"></i> #${cid}</span>` : '<span style="color:#aaa;font-size:11px;">—</span>'}</td>
        <td>${escapeHtml(tipo)}</td>
        <td>${c.rango_presupuesto || '—'}</td>
        <td><span class="status-badge ${clsMap[c.estado]||''}">${estadoLabels[c.estado]||c.estado}</span></td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
            <button data-call="verDetalleCotEmp" data-args="[${c.id}]" class="btn btn-primary btn-small" title="Ver detalle"><i class='fa-solid fa-eye'></i> Ver</button>
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
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';

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

    const estadoLabels = { pendiente:'Pendiente',anticipo_pagado:'Anticipo pagado',pagado:'Pagado ✓',en_produccion:'En Producción',listo:'Listo para entrega',entregado:'Entregado',cancelado:'Cancelado' };
    const estadoClass  = { pendiente:'status-pending',anticipo_pagado:'status-pending',pagado:'status-progress',en_produccion:'status-producing',listo:'status-ready',entregado:'status-completed',cancelado:'status-cancelled' };
    const est   = p.estado || 'pendiente';
    const cls   = estadoClass[est]  || 'status-pending';
    const label = estadoLabels[est] || est;

    let entrega;
    if (p.tipo_entrega === 'recoger') {
      entrega = '🏪 Recoge en tienda';
    } else {
      const partesDireccion = [
        p.direccion_envio,
        p.colonia_envio   ? `Col. ${p.colonia_envio}` : '',
        p.ciudad_envio,
        p.municipio_envio ? `Mpio. ${p.municipio_envio}` : '',
        p.cp_envio        ? `CP ${p.cp_envio}` : '',
      ].filter(Boolean).join(', ');
      entrega = `🚚 Envío — ${partesDireccion || 'Sin dirección'}`;
    }
    const instalacion = parseInt(p.incluye_instalacion) ? '✅ Incluye instalación' : '❌ Sin instalación';

    const items = p.items || [];
    const itemsHtml = items.length
      ? `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;">
          <thead><tr style="background:var(--bg);">
            <th style="padding:8px 6px;text-align:left;color:var(--accent);border-bottom:1px solid var(--border);">Producto</th>
            <th style="padding:8px 6px;text-align:center;color:var(--accent);border-bottom:1px solid var(--border);">Cant.</th>
            <th style="padding:8px 6px;text-align:right;color:var(--accent);border-bottom:1px solid var(--border);">P. Unit.</th>
            <th style="padding:8px 6px;text-align:right;color:var(--accent);border-bottom:1px solid var(--border);">Total</th>
          </tr></thead>
          <tbody>${items.map(i=>`
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:8px 6px;color:var(--muted2);">${escapeHtml(i.nombre_producto||i.producto_nombre||'Producto')}</td>
              <td style="padding:8px 6px;text-align:center;color:var(--muted2);">${i.cantidad}</td>
              <td style="padding:8px 6px;text-align:right;color:var(--muted2);">${money(i.precio_unitario)}</td>
              <td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--accent);">${money(i.total_linea||i.precio_unitario*i.cantidad)}</td>
            </tr>`).join('')}
          </tbody>
        </table>`
      : '<p style="color:var(--muted);font-style:italic;font-size:12px;padding:8px 0;">Sin productos registrados</p>';

    const pagos = p.pagos || [];
    const pagosHtml = pagos.length
      ? pagos.map(pg=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid var(--border);color:var(--muted2);">
          <span>${pg.metodo_pago||'Pago'} — ${(pg.fecha_creacion||'').substring(0,10)}</span>
          <span style="font-weight:700;color:var(--ok);">${money(pg.monto||0)}</span>
        </div>`).join('')
      : '<p style="color:var(--muted);font-style:italic;font-size:12px;padding:6px 0;">Sin pagos registrados</p>';

    const saldoPendiente = p.tipo_pago === 'anticipo' ? Math.max(0, (p.total||0) - (p.monto_pagado||0)) : 0;
    const saldoHtml = p.tipo_pago === 'anticipo'
      ? `<div style="background:var(--bg);border-left:3px solid #c9a96e;border-radius:6px;padding:12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-weight:700;color:#c9a96e;margin-bottom:4px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Anticipo (50%)</div>
            <div style="font-size:12px;color:var(--muted2);">Pagado: <strong>${money(p.monto_pagado||0)}</strong>${saldoPendiente>0?` · Saldo pendiente: <strong style="color:#c9a96e;">${money(saldoPendiente)}</strong>`:' · <strong style="color:var(--ok);">Liquidado</strong>'}</div>
          </div>
          ${saldoPendiente>0?`<button class="btn btn-secondary btn-small" data-call="marcarSaldoManualEmp" data-args="[${id}]"><i class="fa-solid fa-hand-holding-dollar"></i> Marcar saldo pagado</button>`:''}
        </div>`
      : '';

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:18px;">
        <span class="status-badge ${cls}">${label}</span>
        <div style="text-align:right;">
          <div style="font-size:22px;font-weight:900;color:var(--accent);">${money(p.total)}</div>
          <div style="font-size:11px;color:var(--muted);">Sub ${money(p.subtotal)} + Envío ${money(p.costo_envio)} + Inst. ${money(p.costo_instalacion)}</div>
        </div>
      </div>

      <div style="background:var(--bg);border-left:3px solid var(--accent);border-radius:6px;padding:12px;margin-bottom:14px;">
        <div style="font-weight:700;color:var(--accent);margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Cliente</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--muted2);">
          <div><span style="color:var(--muted);display:block;font-size:10px;">Nombre</span><strong>${escapeHtml(p.nombre_cliente)}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Teléfono</span><strong>${escapeHtml(p.telefono_cliente||'—')}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Correo</span><strong>${escapeHtml(p.correo_cliente)}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Fecha estimada</span><strong>${p.fecha_estimada||'—'}</strong></div>
          <div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Entrega</span><strong>${entrega}</strong></div>
          <div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Instalación</span><strong>${instalacion}</strong></div>
          ${p.notas?`<div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Notas</span><strong>${escapeHtml(p.notas)}</strong></div>`:''}
          ${p.cliente_id?`<div style="grid-column:1/-1;margin-top:4px;"><span style="background:#2d6a3f20;color:#2d6a3f;border-radius:12px;padding:3px 10px;font-size:11px;font-weight:700;"><i class="fa-solid fa-user-check"></i> Cliente registrado #${p.cliente_id}</span></div>`:''}
        </div>
      </div>

      ${saldoHtml}

      <div style="margin-bottom:14px;">
        <div style="font-weight:700;color:var(--accent);margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Productos del Pedido</div>
        ${itemsHtml}
      </div>

      <div>
        <div style="font-weight:700;color:var(--accent);margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Historial de Pagos</div>
        ${pagosHtml}
      </div>
    `;
  } catch(e) {
    body.innerHTML = `<div style="color:var(--danger);padding:20px;text-align:center;"><i class="fa-solid fa-circle-exclamation"></i> Error: ${e.message}</div>`;
  }
}

async function marcarSaldoManualEmp(id) {
  if (!confirm('¿Confirmas que el saldo restante se cobró en efectivo, transferencia o terminal? Esto marcará el pedido como pagado.')) return;
  try {
    const data = await apiFetch(`${API_BASE}/pagos.php?action=marcar_saldo_manual`, {
      method: 'POST',
      body: JSON.stringify({ pedido_id: id }),
    });
    if (data.success) {
      showNotification('<i class="fa-solid fa-circle-check"></i> Saldo registrado como pagado', 'success');
      verDetallePedidoEmp(id);
      cargarPedidosEmpleadoAPI();
    } else {
      showNotification('<i class="fa-solid fa-circle-xmark"></i> ' + (data.error || 'Error'), 'error');
    }
  } catch(e) {
    showNotification('<i class="fa-solid fa-circle-xmark"></i> Error de conexión', 'error');
  }
}

async function verDetalleCitaEmp(id) {
  const body  = document.getElementById('emp_cita_body');
  const folio = document.getElementById('emp_cita_folio');
  window._empCitaId = id;
  openModal('empCitaDetalleModal');
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';

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

      <div style="background:var(--bg);border-left:3px solid #4a7c8b;border-radius:6px;padding:12px;margin-bottom:14px;">
        <div style="font-weight:700;color:#5b9aad;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Fecha y Tipo</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--muted2);">
          <div><span style="color:var(--muted);display:block;font-size:10px;">📅 Fecha</span><strong style="font-size:15px;">${c.fecha_cita||'—'}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">🕐 Horario</span><strong style="font-size:15px;">${c.rango_horario||'Por confirmar'}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Tipo</span><strong>${tipoLabels[c.tipo]||c.tipo||'—'}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Folio</span><strong>${c.numero_cita}</strong></div>
        </div>
      </div>

      <div style="background:var(--bg);border-left:3px solid var(--accent);border-radius:6px;padding:12px;">
        <div style="font-weight:700;color:var(--accent);margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Cliente</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--muted2);">
          <div><span style="color:var(--muted);display:block;font-size:10px;">Nombre</span><strong>${escapeHtml(c.nombre_cliente)}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Teléfono</span><strong>${escapeHtml(c.telefono_cliente||'—')}</strong></div>
          <div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Correo</span><strong>${escapeHtml(c.correo_cliente)}</strong></div>
          <div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">📍 Dirección</span><strong>${escapeHtml(c.direccion||'Sin especificar')}</strong></div>
          ${c.notas?`<div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Notas</span><strong>${escapeHtml(c.notas)}</strong></div>`:''}
          ${c.cliente_id?`<div style="grid-column:1/-1;margin-top:4px;"><span style="background:#2d6a3f20;color:#2d6a3f;border-radius:12px;padding:3px 10px;font-size:11px;font-weight:700;"><i class="fa-solid fa-user-check"></i> Cliente registrado #${c.cliente_id}</span></div>`:''}
        </div>
      </div>
    `;
  } catch(e) {
    body.innerHTML = `<div style="color:var(--danger);padding:20px;text-align:center;"><i class="fa-solid fa-circle-exclamation"></i> Error: ${e.message}</div>`;
  }
}

async function verDetalleCotEmp(id) {
  const body  = document.getElementById('emp_cot_body');
  const folio = document.getElementById('emp_cot_folio');
  window._empCotId = id;
  openModal('empCotDetalleModal');
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';

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

      <div style="background:var(--bg);border-left:3px solid var(--accent);border-radius:6px;padding:12px;margin-bottom:14px;">
        <div style="font-weight:700;color:var(--accent);margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Cliente</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--muted2);">
          <div><span style="color:var(--muted);display:block;font-size:10px;">Nombre</span><strong>${escapeHtml(cot.nombre_cliente)}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Teléfono</span><strong>${escapeHtml(cot.telefono_cliente||'—')}</strong></div>
          <div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Correo</span><strong>${escapeHtml(cot.correo_cliente)}</strong></div>
          ${cot.cliente_id?`<div style="grid-column:1/-1;margin-top:4px;"><span style="background:#2d6a3f20;color:#2d6a3f;border-radius:12px;padding:3px 10px;font-size:11px;font-weight:700;"><i class="fa-solid fa-user-check"></i> Cliente registrado #${cot.cliente_id}</span></div>`:''}
        </div>
      </div>

      <div style="background:var(--bg);border-left:3px solid var(--ok);border-radius:6px;padding:12px;">
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
    body.innerHTML = `<div style="color:var(--danger);padding:20px;text-align:center;"><i class="fa-solid fa-circle-exclamation"></i> Error: ${e.message}</div>`;
  }
}

async function actualizarCotizacion(id, estado) {
  const data = await apiFetch(`${API_BASE}/cotizaciones.php?id=${id}`, { method:'PUT', body: JSON.stringify({ estado }) });
  if (data.success) showNotification('<i class="fa-solid fa-circle-check"></i> Cotización actualizada', 'success');
}

// ── KPIs dashboard ────────────────────────────────────────────
async function cargarNombreEmpleado() {
  try {
    const data = await apiFetch(`${API_BASE}/auth.php?action=perfil`);
    if (data.success && data.usuario) {
      const el = document.getElementById('empNombreHeader');
      if (el) el.textContent = data.usuario.nombre_completo || data.usuario.correo || 'Empleado';
    }
  } catch(e) { /* silencioso */ }
}

async function refreshKpisAPI() {
  try {
    const data = await apiFetch(`${API_BASE}/reportes.php?tipo=resumen`);
    if (!data.success) { console.warn('[KPI] API error:', data.error); return; }
    const kpiPend = document.getElementById('kpiPendientes');
    if (kpiPend) kpiPend.textContent = data.pedidos_pendientes ?? 0;
    const kpiCitas = document.getElementById('kpiCitasHoy');
    if (kpiCitas) kpiCitas.textContent = data.citas_hoy ?? 0;
    const kpiCot = document.getElementById('kpiCotNuevas');
    if (kpiCot) kpiCot.textContent = data.cotizaciones_nuevas ?? 0;
  } catch(e) { console.error('[KPI] refreshKpisAPI falló:', e.message); }
}

// ── AUTO-POLLING cada 30 segundos ────────────────────────────
// Refresca la sección visible automáticamente sin que el empleado tenga que hacerlo manual
function _autoRefresh() {
  const section = window._currentSection || 'dashboard';
  try {
    if      (section === 'pedidos'       && typeof cargarPedidosEmpleadoAPI === 'function') cargarPedidosEmpleadoAPI();
    else if (section === 'citas'         && typeof cargarCitasAPI === 'function')           cargarCitasAPI();
    else if (section === 'cotizaciones'  && typeof cargarCotizacionesAPI === 'function')    cargarCotizacionesAPI();
    else if (section === 'dashboard'     && typeof refreshKpisAPI === 'function')           refreshKpisAPI();
  } catch(e) { console.warn('[autoRefresh] Error en sección', section, e); }
}

// ── INIT (segundo DOMContentLoaded - API layer) ───────────────
document.addEventListener('DOMContentLoaded', () => {
  if (typeof firebaseAuth !== 'undefined') {
    let initialized = false;
    firebaseAuth.onAuthStateChanged(user => {
      if (!initialized) { initialized = true; return; } // ignorar primer disparo al cargar
      if (!user) window.location.replace('/inicio');
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
  window._autoRefreshInterval = setInterval(_autoRefresh, 8000);
  setInterval(fetchNotificationsFromAPI, 60000);

  // Pausar polling cuando la pestaña no está visible (ahorra requests innecesarios)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(window._autoRefreshInterval);
    } else {
      _autoRefresh();
      window._autoRefreshInterval = setInterval(_autoRefresh, 8000);
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