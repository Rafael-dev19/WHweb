/* =========================
       UTIL
    ========================= */
    const $ = (sel, root=document) => root.querySelector(sel);
    const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

    function escapeHtml(str){
      return String(str ?? '')
        .replaceAll('&','&amp;')
        .replaceAll('<','&lt;')
        .replaceAll('>','&gt;')
        .replaceAll('"','&quot;')
        .replaceAll("'","&#039;");
    }
    function money(n){
      const num = Number(n || 0);
      return num.toLocaleString('es-MX', { style:'currency', currency:'MXN' });
    }
    function parseLines(text){
      return String(text||'')
        .split('\n')
        .map(x => x.trim())
        .filter(Boolean);
    }
    function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

    /* =========================
       NOTIFICACIONES (PANEL)
    ========================= */
    const NOTIF_KEY_ADM        = 'wh_adm_notifs';
    const NOTIF_UNREAD_KEY_ADM = 'wh_adm_notifs_unread';
    const NOTIF_SEEN_KEY_ADM   = 'wh_adm_notifs_seen';

    const NOTIF_ICONS_ADM = {
      pedido:     { icon:'fa-box',           color:'var(--accent)' },
      cita:       { icon:'fa-calendar-days', color:'#4a7c8b' },
      cotizacion: { icon:'fa-briefcase',     color:'#4a8b5a' },
      pago:       { icon:'fa-credit-card',   color:'#7c5c8b' },
      sistema:    { icon:'fa-gear',          color:'var(--muted2)' },
    };

    function getNotifs(){ return JSON.parse(localStorage.getItem(NOTIF_KEY_ADM) || '[]'); }
    function saveNotifs(list){ localStorage.setItem(NOTIF_KEY_ADM, JSON.stringify(list)); }
    function getUnreadCount(){ return parseInt(localStorage.getItem(NOTIF_UNREAD_KEY_ADM) || '0'); }
    function setUnreadCount(n){
      const count = Math.max(0, n);
      localStorage.setItem(NOTIF_UNREAD_KEY_ADM, String(count));
      const dot = document.getElementById('notifDot');
      const btn = document.getElementById('notifBtn');
      if (!dot) return;
      if (count === 0) {
        dot.classList.remove('on');
        btn?.classList.remove('has-notif');
      } else {
        dot.textContent = count > 9 ? '9+' : count;
        dot.classList.add('on');
        btn?.classList.add('has-notif');
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
      const cfg = NOTIF_ICONS_ADM[key];
      return `<div class="notif-icon" style="color:${cfg.color};border-color:${cfg.color}40;">
        <i class="fa-solid ${cfg.icon}"></i>
      </div>`;
    }
    function renderNotifPanel(){
      const notifBody = document.getElementById('notifBody');
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
      document.getElementById('notifPanel')?.classList.add('open');
    }
    function closeNotifPanel(){
      document.getElementById('notifPanel')?.classList.remove('open');
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
    function _getSeenIds(){ return new Set(JSON.parse(localStorage.getItem(NOTIF_SEEN_KEY_ADM) || '[]')); }
    function _addSeenIds(ids){
      const seen = _getSeenIds();
      ids.forEach(id => seen.add(id));
      localStorage.setItem(NOTIF_SEEN_KEY_ADM, JSON.stringify([...seen].slice(0, 200)));
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
    function pushNotif(title, meta, tipo=''){
      const list = getNotifs();
      const at = new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}) + ' ' + new Date().toLocaleDateString('es-MX');
      list.unshift({ title, meta, tipo, at });
      saveNotifs(list.slice(0, 30));
      setUnreadCount(getUnreadCount() + 1);
      renderNotifPanel();
    }
    async function fetchNotificationsFromAPI(){
      try {
        const res = await fetch('/api/notificaciones.php?destino=admin', { credentials:'same-origin' });
        if (!res.ok) return;
        const json = await res.json();
        const items = json.notificaciones ?? [];
        if (!items.length) return;
        const current  = getNotifs();
        const knownIds = new Set([...current.map(n => n.id), ..._getSeenIds()].filter(Boolean));
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
      } catch(e){ /* silencioso */ }
    }

    // Exponer al scope global para los onclick inline del HTML
    window.markAllNotifRead = markAllNotifRead;
    window.clearAllNotifs   = clearAllNotifs;
    window.openNotifPanel   = openNotifPanel;
    window.closeNotifPanel  = closeNotifPanel;

    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('notifBtn')?.addEventListener('click', e => {
        e.stopPropagation();
        document.getElementById('notifPanel')?.classList.contains('open') ? closeNotifPanel() : openNotifPanel();
      });
      document.addEventListener('click', e => {
        if(document.getElementById('notifPanel')?.classList.contains('open')){
          const inside = e.target.closest('#notifPanel') || e.target.closest('#notifBtn');
          if(!inside) closeNotifPanel();
        }
      });
      setUnreadCount(getUnreadCount());
      setTimeout(fetchNotificationsFromAPI, 1000);
      setInterval(fetchNotificationsFromAPI, 60000);

      // Drag-drop zona de imágenes (reemplaza ondragover/ondragleave/ondrop inline)
      var dropZone = document.getElementById('imgDropZone');
      if (dropZone) {
        dropZone.addEventListener('dragover', function(e) {
          e.preventDefault(); e.stopPropagation();
          this.style.borderColor = 'var(--accent)';
          this.style.background  = 'rgba(139,115,85,0.08)';
        });
        dropZone.addEventListener('dragleave', function(e) {
          e.stopPropagation();
          this.style.borderColor = 'var(--border)';
          this.style.background  = '';
        });
        dropZone.addEventListener('drop', function(e) {
          handleImgDrop(e);
          this.style.background = '';
        });
      }

      // Input de archivos (reemplaza onchange inline)
      var fileInput = document.getElementById('p_imgs_files');
      if (fileInput) {
        fileInput.addEventListener('change', function() {
          if (typeof previewImages === 'function') previewImages(this.files);
        });
      }
    });

    /* =========================
       NAVEGACIÓN / MENÚ
    ========================= */
    const navLinks = $('#navLinks');
    const menuToggle = $('#menuToggle');
    const navClose = $('#navClose');

    function openNav(){
      navLinks.classList.add('open');
      navLinks.setAttribute('aria-hidden','false');
      menuToggle.setAttribute('aria-expanded','true');
    }
    function closeNav(){
      navLinks.classList.remove('open');
      navLinks.setAttribute('aria-hidden','true');
      menuToggle.setAttribute('aria-expanded','false');
    }
    menuToggle.addEventListener('click', () => {
      navLinks.classList.contains('open') ? closeNav() : openNav();
    });
    navClose.addEventListener('click', closeNav);

    navLinks.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-section]');
      if (!a) return;
      e.preventDefault();
      showSection(a.dataset.section, e);
    });

    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape') closeNav();
    });
    document.addEventListener('click', (e) => {
      if(!navLinks.classList.contains('open')) return;
      const inside = navLinks.contains(e.target) || menuToggle.contains(e.target);
      if(!inside) closeNav();
    });

    function showSection(section, ev){
      $$('.content-section').forEach(s => s.classList.add('hidden'));
      const el = $('#' + section + '-section');
      if(el) el.classList.remove('hidden');

      $$('.sidebar-item').forEach(item => item.classList.remove('active'));
      const sid = ev?.target?.closest?.('.sidebar-item');
      if (sid) sid.classList.add('active');
      else {
        const fallback = document.querySelector(`.sidebar-item[data-section="${section}"]`);
        if (fallback) fallback.classList.add('active');
      }

      $$('#navLinks a').forEach(a => a.classList.remove('active'));
      const navA = document.querySelector(`#navLinks a[data-section="${section}"]`);
      if (navA) navA.classList.add('active');

      closeNav();

      window._currentSection = section;

      if(section === 'citas')     cargarCitasCalendarioAPI();
      if(section === 'catalogo')  cargarProductosAPI().then(() => renderCatalogo());
      if(section === 'reportes')  { cargarReportesAPI(); }
      if(section === 'dashboard') setTimeout(refreshKPIsFromAPI, 100);
      if(section === 'pedidos')      cargarPedidosAPI();
      if(section === 'cotizaciones')  cargarCotizacionesAPI();
      if(section === 'empleados')  cargarEmpleadosAPI();
      if(section === 'capacidad')  cargarCapacidad();
      if(section === 'seguridad')  cargarEstado2FA();
      if(section === 'seguridad' && new URLSearchParams(location.search).get('setup_2fa')) {
        // Forzar apertura del flujo de setup si viene de login sin 2FA
        setTimeout(iniciarSetup2FA, 400);
        history.replaceState(null, '', location.pathname);   // limpiar URL
      }
      refreshKPIs();
    }

    /* =========================
       MODALES
    ========================= */
    function openModal(id){ $('#'+id).classList.add('active'); }
    function closeModal(id){ $('#'+id).classList.remove('active'); }

    $$('.modal').forEach(modal => {
      modal.addEventListener('click', function(e){
        if(e.target === this) this.classList.remove('active');
      });
    });

    /* =========================
       NOTIFICACIONES
    ========================= */
    function showNotification(message, type='info'){
      document.querySelectorAll('.notification').forEach(n => n.remove());
      const icons = {
        success: 'fa-circle-check',
        error:   'fa-circle-xmark',
        warning: 'fa-triangle-exclamation',
        info:    'fa-circle-info',
      };
      const notif = document.createElement('div');
      notif.className = `notification ${type}`;
      // Si el mensaje ya trae un <i> no agregar ícono extra
      const hasIcon = message.includes('<i ');
      notif.innerHTML = hasIcon
        ? message
        : `<i class="fa-solid ${icons[type] || 'fa-circle-info'}"></i>${message}`;
      document.body.appendChild(notif);
      const delay = type === 'error' ? 5000 : 3500;
      setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transform = 'translateX(20px)';
        notif.style.transition = 'all .3s ease';
        setTimeout(() => notif.remove(), 300);
      }, delay);
    }

    function confirmDelete(id){
      if(confirm('¿Eliminar este elemento?')){
        showNotification('<i class="fa-solid fa-check"></i> Elemento eliminado', 'success');
      }
    }

    async function logout(){
      if(!confirm('¿Cerrar sesión?')) return;
      // SECURITY: set flag first so login.js won't auto-redirect
      sessionStorage.setItem('wh_just_logged_out', '1');
      sessionStorage.removeItem('wh_firebase_token');
      sessionStorage.removeItem('wh_usuario');
      try { if(typeof firebaseAuth !== 'undefined') await firebaseAuth.signOut(); } catch(e) {}
      await fetch('/api/auth.php?action=logout', { method: 'POST', credentials: 'same-origin' }).catch(()=>{});
      window.location.replace('/login?logout=1');
    }

    /* =========================
       TABLA PEDIDOS (filtros)
    ========================= */
    // Bug corregido: los botones usaban "pending"/"progress"/"completed" pero
    // el estado real es "pendiente"/"en_produccion"/etc. — nunca coincidían.
    const ESTADO_PEDIDO_CATEGORIA = {
      pendiente:       'pending',
      anticipo_pagado:    'pending',
      pagado:             'progress',
      en_produccion:      'progress',
      listo:              'progress',
      listo_para_entrega: 'progress',
      entregado:          'completed',
      cancelado:          null, // solo visible en "Todos"
    };
    function filterTable(filter, ev){
      $$('#pedidos-section .filter-btn').forEach(btn => btn.classList.remove('active'));
      const btnActivo = ev?.target || $(`#pedidos-section .filter-btn[data-filter="${filter}"]`);
      btnActivo?.classList?.add('active');

      const rows = $$('#pedidosTable tr');
      rows.forEach(row => {
        const categoria = ESTADO_PEDIDO_CATEGORIA[row.dataset.status];
        row.style.display = (filter === 'all' || categoria === filter) ? '' : 'none';
      });
    }

    /* =========================
       CALENDARIO
    ========================= */
    let calYear  = new Date().getFullYear();
    let calMonth = new Date().getMonth();
    // Citas cargadas desde la API — sin localStorage, datos reales de MySQL
    let _citasCache = [];

    async function cargarCitasCalendarioAPI() {
      try {
        const hoy = new Date();
        const desde = `${hoy.getFullYear()}-01-01`;
        const hasta = `${hoy.getFullYear()}-12-31`;
        const data = await apiFetch(`${API_BASE}/citas.php?limit=200&fecha_desde=${desde}&fecha_hasta=${hasta}`);
        if (data.success && data.citas) {
          _citasCache = data.citas.map(c => ({
            id:      c.numero_cita || c.id,
            cliente: c.nombre_cliente || '',
            date:    (c.fecha_cita || '').substring(0, 10),
            time:    c.rango_horario || 'Por confirmar',
            tipo:    c.tipo || 'medicion',
            estado:  c.estado || 'nueva',
            datos:   c,
          }));
        }
      } catch(e) {
        console.warn('Error cargando citas:', e);
        _citasCache = [];
      }
      renderCalendar();
      renderCitasTable();
    }

    function getCitas(){ return _citasCache; }
    function pad(n){ return String(n).padStart(2,'0'); }
    function monthName(m){
      return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m] || '';
    }
    function fmtDMY(iso){
      const [y,m,d] = iso.split('-');
      return `${d}/${m}/${y.slice(-2)}`;
    }
    function prevMonth(){
      calMonth--;
      if(calMonth < 0){ calMonth = 11; calYear--; }
      renderCalendar();
    }
    function nextMonth(){
      calMonth++;
      if(calMonth > 11){ calMonth = 0; calYear++; }
      renderCalendar();
    }

    function tipoLabel(t){
      if(t==='medicion')   return 'Medición';
      if(t==='instalacion') return 'Instalación';
      return 'Otro';
    }
    function estadoLabel(e){
      if(e==='confirmada') return 'Confirmada';
      if(e==='completada') return 'Completada';
      if(e==='cancelada')  return 'Cancelada';
      return 'Nueva';
    }

    function makeDayCell(y, m, d, muted, citas){
      const dateObj = new Date(y, m, d);
      const yy = dateObj.getFullYear();
      const mm = dateObj.getMonth();
      const dd = dateObj.getDate();
      const iso = `${yy}-${pad(mm+1)}-${pad(dd)}`;

      const dayCitas = citas.filter(c => c.date === iso);

      const cell = document.createElement('div');
      cell.className = 'cal-day' + (muted ? ' muted' : '');
      cell.setAttribute('data-date', iso);
      cell.onclick = () => selectDay(iso);

      const chips = dayCitas.slice(0, 2).map(c => {
        return `<div class="chip ${c.tipo}">${escapeHtml(c.time)} • ${escapeHtml(c.cliente)}</div>`;
      }).join('');

      const dots = dayCitas.slice(0, 3).map(c => {
        return `<span class="dot ${c.tipo}"></span>`;
      }).join('');

      cell.innerHTML = `
        <div class="num">${dd}</div>
        <div class="cal-chip">${chips}</div>
        <div class="cal-dots">${dots}</div>
      `;
      return cell;
    }

    function selectDay(iso){
      $$('.cal-day').forEach(x => x.style.outline = 'none');
      const cell = $(`.cal-day[data-date="${iso}"]`);
      if(cell) cell.style.outline = `2px solid ${getComputedStyle(document.documentElement).getPropertyValue('--accent')}`;

      const citas = getCitas().filter(c => c.date === iso).sort((a,b)=>a.time.localeCompare(b.time));
      const head = $('#dayHead');
      const list = $('#dayList');

      if(head) head.textContent = `Citas del ${fmtDMY(iso)}`;
      if(!list) return;
      list.innerHTML = '';

      if(!citas.length){
        list.innerHTML = `
          <div class="cal-item">
            <div class="t">Sin citas</div>
            <div class="m">No hay citas programadas para este día.</div>
          </div>
        `;
        return;
      }

      citas.forEach(c => {
        const el = document.createElement('div');
        el.className = 'cal-item';
        const estadoTexto = {'nueva':'Nueva','confirmada':'Confirmada','completada':'Completada','cancelada':'Cancelada'}[c.estado] || c.estado;
        const tipoTexto   = {'medicion':'Medición','instalacion':'Instalación','otro':'Otro'}[c.tipo] || c.tipo;
        const dbId = c.datos?.id || '';
        const cid = c.datos?.cliente_id || '';
        el.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <div class="t">${escapeHtml(c.time)} • ${escapeHtml(c.cliente)}${cid ? ` <span style="background:#2d6a3f20;color:#2d6a3f;border-radius:8px;padding:1px 7px;font-size:10px;font-weight:700;"><i class="fa-solid fa-user-check"></i> #${cid}</span>` : ''}</div>
              <div class="m">${tipoTexto} • ${estadoTexto} • ${escapeHtml(c.id)}</div>
            </div>
            ${dbId ? `<button data-call="verDetalleCitaAdmin" data-args="[${dbId}]" class="btn btn-primary btn-small" style="flex-shrink:0;white-space:nowrap;"><i class='fa-solid fa-eye'></i> Ver</button>` : ''}
          </div>
        `;
        list.appendChild(el);
      });
    }

    function renderCalendar(){
      const grid = $('#calendarGrid');
      const title = $('#calTitle');
      if(!grid || !title) return;

      title.textContent = `${monthName(calMonth)} ${calYear}`;

      const citas = getCitas();
      const monthStr = pad(calMonth+1);

      const first = new Date(calYear, calMonth, 1);
      const last = new Date(calYear, calMonth+1, 0);
      const daysInMonth = last.getDate();
      const startDow = (first.getDay() + 6) % 7;

      grid.innerHTML = '';

      const prevLast = new Date(calYear, calMonth, 0).getDate();
      for(let i=0;i<startDow;i++){
        const d = prevLast - (startDow - 1 - i);
        const cell = makeDayCell(calYear, calMonth-1, d, true, citas);
        grid.appendChild(cell);
      }

      for(let d=1; d<=daysInMonth; d++){
        const cell = makeDayCell(calYear, calMonth, d, false, citas);
        grid.appendChild(cell);
      }

      while(grid.children.length < 42){
        const idx = grid.children.length - (startDow + daysInMonth);
        const d = idx + 1;
        const cell = makeDayCell(calYear, calMonth+1, d, true, citas);
        grid.appendChild(cell);
      }

      const nextList = $('#nextList');
      if(nextList){
        const next = citas
          .slice()
          .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time))
          .slice(0, 8);

        nextList.innerHTML = '';
        next.forEach(c => {
          const el = document.createElement('div');
          el.className = 'cal-item';
          const tipoTexto = {'medicion':'Medición','instalacion':'Instalación','otro':'Otro'}[c.tipo] || c.tipo;
          const hoy = new Date().toISOString().substring(0,10);
          const esHoy = c.date === hoy;
          const cidNext = c.datos?.cliente_id || '';
          el.innerHTML = `
            <div class="t">${escapeHtml(c.cliente)}${esHoy ? ' <span style="color:#2E7D32;font-size:11px;">● HOY</span>' : ''}${cidNext ? ` <span style="background:#2d6a3f20;color:#2d6a3f;border-radius:8px;padding:1px 7px;font-size:10px;font-weight:700;"><i class="fa-solid fa-user-check"></i> #${cidNext}</span>` : ''}</div>
            <div class="m">${fmtDMY(c.date)} • ${escapeHtml(c.time)} • ${tipoTexto}</div>
          `;
          nextList.appendChild(el);
        });
        if(!next.length){
          nextList.innerHTML = `<div class="cal-item"><div class="t">Sin citas</div><div class="m">No hay próximas citas registradas.</div></div>`;
        }
      }

      const today = new Date();
      if(today.getFullYear()===calYear && today.getMonth()===calMonth){
        selectDay(`${calYear}-${monthStr}-${pad(today.getDate())}`);
      }else{
        selectDay(`${calYear}-${monthStr}-01`);
      }
    }

    function renderCitasTable() {
      const tbody = document.getElementById('citasTable');
      if (!tbody) return;

      const estadoMap = {
        nueva:      { label: 'Nueva',      cls: 'status-info'      },
        confirmada: { label: 'Confirmada', cls: 'status-completed'  },
        completada: { label: 'Completada', cls: 'status-progress'   },
        cancelada:  { label: 'Cancelada',  cls: 'status-disabled'   },
      };
      const tipoMap = {
        medicion:   'Medición',
        instalacion:'Instalación',
        otro:       'Otro',
      };

      const citas = _citasCache.slice().sort((a, b) => a.date.localeCompare(b.date));

      if (!citas.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px;">Sin citas registradas</td></tr>`;
        return;
      }

      tbody.innerHTML = citas.map(c => {
        const est = estadoMap[c.estado] || { label: c.estado, cls: '' };
        const dbId = c.datos?.id || '';
        const cid  = c.datos?.cliente_id || '';
        return `
          <tr>
            <td style="font-size:11px;color:var(--muted);">${escapeHtml(c.id)}</td>
            <td>${escapeHtml(c.cliente)}</td>
            <td>${cid ? `<span class="status-badge status-active" style="font-size:10px;padding:2px 8px;"><i class="fa-solid fa-user-check"></i> #${cid}</span>` : '<span style="color:var(--muted);font-size:11px;">—</span>'}</td>
            <td>${fmtDMY(c.date)}</td>
            <td>${escapeHtml(c.time)}</td>
            <td>${tipoMap[c.tipo] || c.tipo}</td>
            <td><span class="status-badge ${est.cls}">${est.label}</span></td>
            <td>
              ${dbId ? `<button class="btn btn-primary btn-small" data-call="verDetalleCitaAdmin" data-args="[${dbId}]" title="Ver detalle"><i class="fa-solid fa-eye"></i> Ver</button>` : '—'}
            </td>
          </tr>`;
      }).join('');
    }

    /* =========================
       CATÁLOGO: DATA + CRUD
    ========================= */
    const PROD_KEY = 'wh_admin_productos';
    const VIEW_KEY = 'wh_admin_viewmode'; // cards|table

    function seedProductosIfEmpty(){
      const raw = localStorage.getItem(PROD_KEY);
      if(raw) return;

      const seed = [
        {
          id:'milano',
          sku:'MLN-001',
          nombre:'Milano',
          categoria:'A Piso',
          badge:'Nuevo',
          estado:'activo',
          precio:8500,
          stock:15,
          descCorta:'Diseño minimalista con acabados premium.',
          specsResumen:{
            dimensiones:'120cm x 50cm x 85cm',
            material:'Madera de encino + acabado mate',
            acabado:'', /* <i class="fa-solid fa-circle-check"></i> FIX */
            lavabo:'Cerámica blanca incluida'
          },
          rating:4.8,
          reviews:124,
          descLarga:'Milano combina un diseño moderno con materiales resistentes. Ideal para baños contemporáneos con un toque elegante.',
          features:[
            'Cajones de cierre suave',
            'Herrajes de alta durabilidad',
            'Protección contra humedad',
            'Fácil instalación'
          ],
          specs:[
            { label:'Material', value:'Madera de encino' },
            { label:'Acabado', value:'Mate' },
            { label:'Lavabo', value:'Incluido (cerámica)' },
            { label:'Instalación', value:'Incluida' }
          ],
          imgs:[
            '/img/milano1.jpg',
            '/img/milano2.jpg'
          ]
        },
        {
          id:'venecia',
          sku:'VNC-002',
          nombre:'Venecia',
          categoria:'Flotados',
          badge:'Popular',
          estado:'activo',
          precio:12800,
          stock:8,
          descCorta:'Estilo clásico con detalle artesanal.',
          specsResumen:{
            dimensiones:'140cm x 55cm x 90cm',
            material:'Madera de cedro + barniz satinado',
            acabado:'', /* <i class="fa-solid fa-circle-check"></i> FIX */
            lavabo:'Piedra natural opcional'
          },
          rating:4.6,
          reviews:77,
          descLarga:'Venecia destaca por su estilo clásico y acabados finos. Perfecto para espacios elegantes.',
          features:[
            'Acabado satinado',
            'Espacio amplio de almacenamiento',
            'Resistente a humedad',
            'Opciones de personalización'
          ],
          specs:[
            { label:'Material', value:'Madera de cedro' },
            { label:'Acabado', value:'Satinado' },
            { label:'Lavabo', value:'Opcional' },
            { label:'Garantía', value:'12 meses' }
          ],
          imgs:[]
        }
      ];
      localStorage.setItem(PROD_KEY, JSON.stringify(seed));
    }

    function getProductos(){
      return window._apiProductos || [];
    }
    function setProductos(list){
      window._apiProductos = list;
    }

    function getViewMode(){
      return localStorage.getItem(VIEW_KEY) || 'cards';
    }
    function setViewMode(mode){
      localStorage.setItem(VIEW_KEY, mode);
    }

    function toggleCatalogView(){
      const current = getViewMode();
      const next = current === 'cards' ? 'table' : 'cards';
      setViewMode(next);
      renderCatalogo();
    }

    function normalizeCategory(cat){
      const x = String(cat||'').trim();
      if(!x) return '';
      return x;
    }

    function renderCatalogo(){
      const mode = getViewMode();
      const viewLabel = document.getElementById('viewModeLabel');
      if (viewLabel) viewLabel.textContent = mode === 'cards' ? 'Tarjetas' : 'Tabla';

      const catalogCards    = document.getElementById('catalogCards');
      const catalogTableWrap = document.getElementById('catalogTableWrap');
      if (catalogCards)     catalogCards.classList.toggle('hidden', mode !== 'cards');
      if (catalogTableWrap) catalogTableWrap.classList.toggle('hidden', mode !== 'table');

      const q  = (document.getElementById('catSearch')?.value   || '').trim().toLowerCase();
      const cat= (document.getElementById('catCategory')?.value || '').trim();
      const st = (document.getElementById('catStatus')?.value   || '').trim();

      let list = getProductos();

      if (list.length === 0) {
        if (catalogCards) catalogCards.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#888;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando productos...</div>';
        return;
      }

      list = list.filter(p => {
        const hay  = [p.id, p.nombre, p.categoria].join(' ').toLowerCase();
        const okQ  = !q   || hay.includes(q);
        const okCat= !cat || p.categoria === cat;
        const okSt = st ? p.estado === st : p.estado === 'activo';
        return okQ && okCat && okSt;
      });

      if (mode === 'cards') {
        if (!catalogCards) return;
        catalogCards.innerHTML = '';
        if (!list.length) {
          catalogCards.innerHTML = '<div style="grid-column:1/-1;color:#888;padding:20px;">No hay productos con esos filtros.</div>';
          return;
        }
        list.forEach(p => {
          const imgHTML = p.imagen_principal
            ? `<img src="${escapeHtml(p.imagen_principal)}" alt="${escapeHtml(p.nombre)}" style="width:100%;height:140px;object-fit:cover;border-radius:8px 8px 0 0;">`
            : `<div style="width:100%;height:140px;background:#2a2a2a;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;color:#555;font-size:40px;"><i class="fa-solid fa-tree"></i></div>`;
          const badgeHTML = (p.etiqueta || p.badge)
            ? `<span style="background:#8b7355;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;position:absolute;top:10px;right:10px;">${escapeHtml(p.etiqueta || p.badge)}</span>`
            : '';
          const card = document.createElement('div');
          card.className = 'cat-card';
          card.innerHTML = `
            <div style="position:relative;">${imgHTML}${badgeHTML}</div>
            <div class="cat-content">
              <div class="cat-title">${escapeHtml(p.nombre)} <span style="color:#888;font-size:12px;">(${escapeHtml(p.categoria || '')})</span></div>
              <div class="cat-desc" style="color:#aaa;font-size:13px;margin:6px 0;">${escapeHtml((p.descripcion || p.descLarga || '').substring(0, 80))}${(p.descripcion||'').length > 80 ? '...' : ''}</div>
              <div class="cat-footer">
                <div class="cat-price">${money(p.precio || p.precio_base || 0)}</div>
                <div class="cat-actions">
                  <button class="btn btn-secondary btn-small btn-ver-prod">Ver</button>
                  <button class="btn btn-secondary btn-small btn-edit-prod" title="Editar"><i class="fa-solid fa-pen"></i></button>
                  <button class="btn btn-danger btn-small btn-del-prod" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                </div>
              </div>
              <div style="margin-top:8px;font-size:11px;color:#666;">
                ID: <b style="color:#aaa;">${escapeHtml(String(p.id))}</b> •
                <span class="status-badge ${p.estado === 'activo' ? 'status-completed' : 'status-disabled'}">${p.estado === 'activo' ? 'Activo' : 'Inactivo'}</span>
              </div>
            </div>
          `;
          card.querySelector('.btn-ver-prod').addEventListener('click', () => openProductoDetalle(String(p.id)));
          card.querySelector('.btn-edit-prod').addEventListener('click', () => openProductoModal('edit', String(p.id)));
          card.querySelector('.btn-del-prod').addEventListener('click', () => deleteProducto(String(p.id)));
          catalogCards.appendChild(card);
        });
      }

      if (mode === 'table') {
        const body = document.getElementById('catalogTableBody');
        if (!body) return;
        body.innerHTML = '';
        if (!list.length) {
          body.innerHTML = '<tr><td colspan="6" style="color:#888;text-align:center;">No hay productos con esos filtros.</td></tr>';
          return;
        }
        list.forEach(p => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${escapeHtml(String(p.id))}</td>
            <td>${escapeHtml(p.nombre)}</td>
            <td>${escapeHtml(p.categoria || '—')}</td>
            <td style="color:var(--accent);font-weight:900;">${money(p.precio || p.precio_base || 0)}</td>
            <td><span class="status-badge ${p.estado === 'activo' ? 'status-completed' : 'status-disabled'}">${p.estado === 'activo' ? 'Activo' : 'Inactivo'}</span></td>
            <td>
              <button class="btn btn-secondary btn-small btn-ver-prod">Ver</button>
              <button class="btn btn-secondary btn-small btn-edit-prod" title="Editar"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-danger btn-small btn-del-prod" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
            </td>
          `;
          tr.querySelector('.btn-ver-prod').addEventListener('click', () => openProductoDetalle(String(p.id)));
          tr.querySelector('.btn-edit-prod').addEventListener('click', () => openProductoModal('edit', String(p.id)));
          tr.querySelector('.btn-del-prod').addEventListener('click', () => deleteProducto(String(p.id)));
          body.appendChild(tr);
        });
      }

      refreshKPIs();
    }

    async function openProductoModal(mode, id=''){
      document.getElementById('p_mode').value = mode;
      document.getElementById('p_key').value = id || '';
      const isEdit = mode === 'edit';
      document.getElementById('productoModalTitle').textContent = isEdit ? 'Editar Producto' : 'Nuevo Producto';

      ['p_nombre','p_categoria','p_badge','p_estado','p_precio','p_descLarga',
       'p_tipo_instalacion','p_largo','p_alto','p_fondo','p_ovalin','p_monomando',
       'p_incluye','p_espejo','p_imgs_urls'].forEach(fieldId => {
        const el = document.getElementById(fieldId);
        if (el) el.value = '';
      });
      window._imgFilesPending = [];
      const previewGrid = document.getElementById('imgPreviewGrid');
      if (previewGrid) previewGrid.innerHTML = '';

      const catSelect = document.getElementById('p_categoria');
      if (catSelect && window._apiCategorias && window._apiCategorias.length) {
        catSelect.innerHTML = window._apiCategorias.map(c =>
          `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`
        ).join('');
      }

      if (isEdit) {
        let p = getProductos().find(x => String(x.id) === String(id));
        if (!p) { showNotification('No se encontro el producto', 'error'); return; }

        // IMPORTANTE: Siempre hacer fetch del detalle completo para tener imágenes y specs reales
        try {
          const detalle = await apiFetch(`${API_BASE}/productos.php?id=${id}`);
          if (detalle.success && detalle.producto) {
            p = {
              ...p,
              imagenes: detalle.producto.imagenes || [],
              especificaciones: detalle.producto.especificaciones || [],
              descripcion: detalle.producto.descripcion || p.descripcion || '',
              activo: detalle.producto.activo ?? p.activo,
              precio: detalle.producto.precio ?? detalle.producto.precio_base ?? p.precio,
            };
          }
        } catch(e) { console.warn('No se pudo cargar detalle del producto', e); }

        const setVal = (elId, val) => {
          const el = document.getElementById(elId);
          if (el && val !== undefined && val !== null) el.value = val;
        };
        setVal('p_nombre',    p.nombre);
        setVal('p_categoria', p.categoria_id);
        setVal('p_badge',     p.etiqueta || '');
        setVal('p_estado',    (p.activo == 1 || p.estado === 'activo') ? 'activo' : 'inactivo');
        setVal('p_precio',    p.precio || p.precio_base || 0);
        setVal('p_descLarga', p.descripcion || '');

        const specs = p.especificaciones || [];
        const getSpec = (keyword) => {
          const s = specs.find(x => x.clave && x.clave.toLowerCase().includes(keyword.toLowerCase()));
          return s ? s.valor : '';
        };
        setVal('p_tipo_instalacion', getSpec('instalacion') || 'Flotado');
        setVal('p_largo',     getSpec('largo'));
        setVal('p_alto',      getSpec('alto'));
        setVal('p_fondo',     getSpec('fondo'));
        setVal('p_ovalin',    getSpec('ovalin'));
        setVal('p_monomando', getSpec('monomando'));
        setVal('p_incluye',   getSpec('incluye') || 'Cespol de PBC - Contra canasta');
        setVal('p_espejo',    getSpec('espejo') || '');

        const imgUrls = p.imagenes
          ? p.imagenes.map(img => img.url_imagen)
          : (p.imagen_principal ? [p.imagen_principal] : []);
        document.getElementById('p_imgs_urls').value = imgUrls.join('\n');
        renderImgPreviews();

      } else {
        if (catSelect && window._apiCategorias?.length) {
          catSelect.value = String(window._apiCategorias[0].id);
        }
        document.getElementById('p_estado').value = 'activo';
        const tipoEl = document.getElementById('p_tipo_instalacion');
        if (tipoEl) tipoEl.value = 'Flotado';
        const incluyeEl = document.getElementById('p_incluye');
        if (incluyeEl) incluyeEl.value = 'Cespol de PBC - Contra canasta';
      }

      openModal('productoModal');
    }

    function validateProductoPayload(payload, isEdit=false){
      if (!payload.nombre || !String(payload.nombre).trim()) return 'Falta Nombre';
      if (!payload.categoria_id) return 'Falta Categoria';
      if (!isFinite(payload.precio_base) || payload.precio_base <= 0) return 'Precio invalido';
      return '';
    }

    async function saveProductoFull(){
      const mode   = document.getElementById('p_mode')?.value || 'create';
      const isEdit = mode === 'edit';
      const oldId  = document.getElementById('p_key')?.value || '';

      const nombre      = (document.getElementById('p_nombre')?.value   || '').trim();
      const categoriaId = parseInt(document.getElementById('p_categoria')?.value || 0);
      const badge       = (document.getElementById('p_badge')?.value    || '').trim();
      const estado      = (document.getElementById('p_estado')?.value   || 'activo').trim();
      const precio      = parseFloat(document.getElementById('p_precio')?.value || 0);
      const descLarga   = (document.getElementById('p_descLarga')?.value || '').trim();

      if (!nombre)      { showNotification('Falta el nombre del producto', 'error'); return; }
      if (!categoriaId) { showNotification('Selecciona una categoria', 'error'); return; }
      if (precio <= 0)  { showNotification('El precio debe ser mayor a 0', 'error'); return; }
      if (!descLarga)   { showNotification('Falta la descripcion del producto', 'error'); return; }

      let imagenesUrls = (document.getElementById('p_imgs_urls')?.value || '')
        .split('\n').map(u => u.trim()).filter(Boolean);

      const filesNew = window._imgFilesPending || [];
      if (filesNew.length > 0) {
        const MAX_SIZE = 5 * 1024 * 1024;
        const oversized = filesNew.filter(f => f.size > MAX_SIZE);
        if (oversized.length > 0) {
          showNotification(`Imagen(s) muy grandes: ${oversized.map(f=>f.name).join(', ')}. Máximo 5MB por imagen.`, 'error');
          return;
        }
        try {
          const nuevasUrls = await subirImagenesFirebase(filesNew, nombre);
          imagenesUrls = [...imagenesUrls, ...nuevasUrls];
        } catch(e) {
          showNotification('Error subiendo imagenes: ' + e.message, 'error');
          return;
        }
      }

      const imagenes = imagenesUrls.map(url => ({ url }));

      const tipoInst  = (document.getElementById('p_tipo_instalacion')?.value || '').trim();
      const largo     = (document.getElementById('p_largo')?.value  || '').trim();
      const alto      = (document.getElementById('p_alto')?.value   || '').trim();
      const fondo     = (document.getElementById('p_fondo')?.value  || '').trim();
      const ovalin    = (document.getElementById('p_ovalin')?.value || '').trim();
      const monomando = (document.getElementById('p_monomando')?.value || '').trim();
      const incluye   = (document.getElementById('p_incluye')?.value  || '').trim();
      const espejo    = (document.getElementById('p_espejo')?.value   || '').trim();

      const especificaciones = [
        { clave: 'Tipo de instalacion', valor: tipoInst },
        { clave: 'Largo',   valor: largo },
        { clave: 'Alto',    valor: alto },
        { clave: 'Fondo',   valor: fondo },
        { clave: 'Ovalin',  valor: ovalin },
        { clave: 'Monomando', valor: monomando },
        { clave: 'Incluye', valor: incluye || 'Cespol de PBC - Contra canasta' },
        { clave: 'Espejo opcional', valor: espejo || 'No incluye' },
      ].filter(s => s.valor);

      const apiPayload = {
        nombre,
        descripcion:  descLarga,
        precio_base:  precio,
        etiqueta:     badge || null,
        categoria_id: categoriaId,
        activo:       estado === 'activo' ? 1 : 0,
        imagenes,
        especificaciones,
      };

      const btnGuardar = document.getElementById('btnGuardarProducto');
      if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = 'Guardando...'; }

      try {
        const method = (isEdit && oldId) ? 'PUT' : 'POST';
        const url    = (isEdit && oldId)
          ? `${API_BASE}/productos.php?id=${oldId}`
          : `${API_BASE}/productos.php`;

        const data = await apiFetch(url, { method, body: JSON.stringify(apiPayload) });

        if (data.success) {
          window._imgFilesPending = [];
          showNotification(`Producto ${(isEdit && oldId) ? 'actualizado' : 'creado'} correctamente`, 'success');
          closeModal('productoModal');
          await cargarProductosAPI();
          renderCatalogo();
        } else {
          showNotification((data.error || 'Error al guardar'), 'error');
        }
      } catch(e) {
        showNotification('Error: ' + e.message, 'error');
      } finally {
        if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar'; }
      }
    }

    // ── Subir imagenes a Firebase Storage ─────────────────────────
    async function subirImagenesFirebase(files, nombreProducto) {
      // Re-intentar inicializar si aún no está listo
      if (!firebaseStorage) {
        if (typeof initFirebase === 'function') initFirebase();
      }
      if (!firebaseStorage) throw new Error('Firebase Storage no disponible. Verifica que hayas iniciado sesión correctamente.');

      const progress = document.getElementById('imgUploadProgress');
      const bar      = document.getElementById('imgProgressBar');
      const label    = document.getElementById('imgProgressLabel');
      const pct      = document.getElementById('imgProgressPct');
      if (progress) progress.style.display = 'block';

      const urls = [];
      const slug = nombreProducto.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .replace(/[^a-z0-9]/g,'-').substring(0, 30);
      const ts = Date.now();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // ── SEGURIDAD: Validar que es imagen real por magic bytes ──
        const ALLOWED_MIME = ['image/jpeg','image/png','image/webp','image/gif'];
        if (!ALLOWED_MIME.includes(file.type)) {
          throw new Error(`Archivo "${file.name}" no es una imagen válida. Solo se permiten JPEG, PNG, WEBP o GIF.`);
        }
        const headerBuf = await file.slice(0, 12).arrayBuffer();
        const hdr = new Uint8Array(headerBuf);
        const isJpeg = hdr[0]===0xFF && hdr[1]===0xD8 && hdr[2]===0xFF;
        const isPng  = hdr[0]===0x89 && hdr[1]===0x50 && hdr[2]===0x4E && hdr[3]===0x47;
        const isWebp = hdr[8]===0x57 && hdr[9]===0x45 && hdr[10]===0x42 && hdr[11]===0x50;
        const isGif  = hdr[0]===0x47 && hdr[1]===0x49 && hdr[2]===0x46;
        if (!isJpeg && !isPng && !isWebp && !isGif) {
          throw new Error(`Archivo "${file.name}" no pasó la validación de imagen real. Asegúrate de subir imágenes auténticas.`);
        }

        const pctVal = Math.round((i / files.length) * 100);
        if (bar)   bar.style.width = pctVal + '%';
        if (pct)   pct.textContent = pctVal + '%';
        if (label) label.textContent = `Subiendo imagen ${i+1} de ${files.length}...`;

        const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
        const path = `productos/${slug}-${ts}-${i}.${ext}`;
        const ref  = firebaseStorage.ref(path);

        const snap = await ref.put(file);
        const url  = await snap.ref.getDownloadURL();
        urls.push(url);
      }

      if (bar)   bar.style.width = '100%';
      if (pct)   pct.textContent = '100%';
      if (label) label.textContent = '¡Listo!';
      setTimeout(() => { if (progress) progress.style.display = 'none'; }, 2000);

      return urls;
    }


    // ── Manejar selección de archivos ──────────────────────────────
    function previewImages(files) {
      handleImgSelect(files);
    }

    function handleImgSelect(files) {
      if (!window._imgFilesPending) window._imgFilesPending = [];
      const ALLOWED_IMG_TYPES = ['image/jpeg','image/png','image/webp','image/gif'];
      const valid = Array.from(files).filter(f => {
        if (!ALLOWED_IMG_TYPES.includes(f.type)) {
          showNotification(`"${f.name}" no es imagen válida y fue omitido (solo JPEG/PNG/WEBP/GIF).`, 'warning');
          return false;
        }
        return true;
      });
      window._imgFilesPending = [...window._imgFilesPending, ...valid];
      renderImgPreviews();
    }

    function handleImgDrop(event) {
      event.preventDefault();
      document.getElementById('imgDropZone').style.borderColor = 'var(--border)';
      handleImgSelect(event.dataTransfer.files);
    }

    function renderImgPreviews() {
      const grid = document.getElementById('imgPreviewGrid');
      if (!grid) return;

      const existentes = (document.getElementById('p_imgs_urls')?.value || '')
        .split('\n').map(u => u.trim()).filter(Boolean);

      const pendientes = (window._imgFilesPending || []).map(f => ({
        src: URL.createObjectURL(f),
        label: f.name,
        tipo: 'nuevo'
      }));

      const todas = [
        ...existentes.map((url, i) => ({ src: url, label: `Imagen ${i+1}`, tipo: 'guardada', url })),
        ...pendientes
      ];

      if (todas.length === 0) { grid.innerHTML = ''; return; }

      grid.innerHTML = todas.map((img, i) => `
        <div style="position:relative;">
          <img src="${img.src}" style="width:100%;height:80px;object-fit:cover;border-radius:8px;border:2px solid ${i===0?'#8b7355':'#333'};"
               data-img-bg-fallback="#2a2a2a" title="${i===0?'Principal (primera imagen)':img.label}">
          ${i===0?'<span style="position:absolute;bottom:3px;left:3px;background:#8b7355;color:#fff;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:700;">Principal</span>':''}
          <button class="btn-eliminar-img" data-img-tipo="${img.tipo}" data-img-idx="${i}" data-existentes="${existentes.length}"
            style="position:absolute;top:3px;right:3px;background:rgba(180,0,0,.85);border:none;color:#fff;border-radius:50%;width:20px;height:20px;font-size:13px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
      `).join('');
      grid.querySelectorAll('.btn-eliminar-img').forEach(function(btn) {
        btn.addEventListener('click', function() {
          const tipo = this.dataset.imgTipo;
          const idx  = parseInt(this.dataset.imgIdx);
          const existentesLen = parseInt(this.dataset.existentes);
          if (tipo === 'guardada') { eliminarImgGuardada(idx); }
          else { eliminarImgPendiente(idx - existentesLen); }
        });
      });
    }

    function eliminarImgGuardada(idx) {
      const urls = (document.getElementById('p_imgs_urls')?.value || '')
        .split('\n').map(u => u.trim()).filter(Boolean);
      urls.splice(idx, 1);
      document.getElementById('p_imgs_urls').value = urls.join('\n');
      renderImgPreviews();
    }

    function eliminarImgPendiente(idx) {
      if (window._imgFilesPending) window._imgFilesPending.splice(idx, 1);
      renderImgPreviews();
    }

    async function deleteProducto(id){
      if(!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return;
      try {
        const data = await apiFetch(`${API_BASE}/productos.php?id=${id}`, { method: 'DELETE' });
        if (data.success) {
          showNotification('Producto eliminado', 'success');
          await cargarProductosAPI();
          renderCatalogo();
        } else {
          showNotification((data.error || 'Error al eliminar'), 'error');
        }
      } catch(e) {
        showNotification('Error de conexión: ' + e.message, 'error');
      }
    }

    let _detailCurrentId = '';
    function openProductoDetalle(id){
      const p = getProductos().find(x => String(x.id) === String(id));
      if(!p){ showNotification('No se encontró el producto', 'error'); return; }
      _detailCurrentId = id;

      $('#detalleModalTitle').textContent = `Detalle: ${p.nombre}`;

      const specs      = p.especificaciones || p.specs || [];
      const specsHTML  = specs.length
        ? specs.map(s => `<div class="kv"><span>${escapeHtml(s.clave || s.label || '')}</span><b>${escapeHtml(s.valor || s.value || '')}</b></div>`).join('')
        : `<div class="kv"><span>Sin especificaciones</span><b>—</b></div>`;

      const imgUrl     = p.imagen_principal || (p.imgs && p.imgs[0]) || '';
      const imgHTML    = imgUrl
        ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(p.nombre)}" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;margin-bottom:12px;">`
        : `<div style="width:100%;height:120px;background:#2a2a2a;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#666;font-size:36px;margin-bottom:12px;"><i class="fa-solid fa-tree"></i></div>`;

      $('#detalleBody').innerHTML = `
        <div class="detail-wrap">
          <div class="detail-card">
            <div class="detail-media">${imgHTML}</div>
            <div class="detail-body">
              <div class="detail-title">${escapeHtml(p.nombre)}</div>
              <div class="detail-meta" style="color:#8b7355;margin:4px 0;">
                ${escapeHtml(p.categoria || '')}
                ${p.etiqueta || p.badge ? ` • <span style="background:#8b7355;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">${escapeHtml(p.etiqueta || p.badge)}</span>` : ''}
              </div>
              <div class="detail-price">${money(p.precio || p.precio_base || 0)}</div>
              <div class="detail-desc" style="margin-top:10px;color:#ccc;font-size:14px;line-height:1.6;">${escapeHtml(p.descripcion || p.descLarga || 'Sin descripción')}</div>
            </div>
          </div>
          <div class="detail-side">
            <h4>Ficha técnica</h4>
            <div class="kv"><span>ID en BD</span><b>${escapeHtml(String(p.id))}</b></div>
            <div class="kv"><span>Categoría</span><b>${escapeHtml(p.categoria || '—')}</b></div>
            <div class="kv"><span>Estado</span><b><span class="status-badge ${p.estado === 'activo' ? 'status-completed' : 'status-disabled'}">${p.estado || 'inactivo'}</span></b></div>
            <div class="kv"><span>Precio</span><b style="color:#8b7355;">${money(p.precio || p.precio_base || 0)}</b></div>
            <div style="margin-top:14px;"></div>
            <h4>Especificaciones</h4>
            ${specsHTML}
          </div>
        </div>
      `;
      openModal('productoDetalleModal');
    }

    function detailEditFromModal(){
      closeModal('productoDetalleModal');
      if(_detailCurrentId) openProductoModal('edit', _detailCurrentId);
    }

    /* =========================
       REPORTES
    ========================= */
    const SALES_KEY = 'wh_admin_sales';
    const QUOTES_KEY = 'wh_admin_quotes';

    function seedDemoSales(){
      const productos = getProductos();
      if(!productos.length){
        showNotification('Primero crea productos', 'error');
        return;
      }

      const randomPick = () => productos[Math.floor(Math.random()*productos.length)];
      const now = new Date();
      const sales = [];
      for(let i=0;i<18;i++){
        const d = new Date(now.getFullYear(), now.getMonth(), clamp(now.getDate()-Math.floor(Math.random()*25), 1, 28));
        const itemsCount = 1 + Math.floor(Math.random()*3);
        const items = [];
        let total = 0;
        for(let k=0;k<itemsCount;k++){
          const p = randomPick();
          const qty = 1 + Math.floor(Math.random()*2);
          const price = Number(p.precio || 0);
          total += qty*price;
          items.push({ productId:p.id, qty, price });
        }
        sales.push({ idVenta:'V-'+String(Date.now()+i).slice(-6), date:d.toISOString().slice(0,10), items, total:Math.round(total) });
      }
      localStorage.setItem(SALES_KEY, JSON.stringify(sales));

      const quotes = [];
      for(let i=0;i<22;i++){
        const r = Math.random();
        const status = r < .45 ? 'pendiente' : (r < .75 ? 'convertida' : 'cancelada');
        quotes.push({ idCot:'COT-'+String(100+i), status });
      }
      localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));

      showNotification('<i class="fa-solid fa-check"></i> Datos de prueba generados para reportes', 'success');
      renderReportes();
      refreshKPIs();
    }

    function getSales(){
      try{ return JSON.parse(localStorage.getItem(SALES_KEY) || '[]'); } catch { return []; }
    }
    function getQuotes(){
      try{ return JSON.parse(localStorage.getItem(QUOTES_KEY) || '[]'); } catch { return []; }
    }

    function computeTopProducts(){
      const productos = getProductos();
      const index = Object.fromEntries(productos.map(p => [p.id, p]));
      const agg = {};
      getSales().forEach(s => {
        (s.items||[]).forEach(it => {
          const id = it.productId;
          if(!agg[id]) agg[id] = { productId:id, units:0, revenue:0 };
          agg[id].units += Number(it.qty||0);
          agg[id].revenue += Number(it.qty||0)*Number(it.price||0);
        });
      });
      return Object.values(agg)
        .sort((a,b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map(x => ({...x, name: index[x.productId]?.nombre || x.productId}));
    }

    function computeKpis(){
      const sales = getSales();
      const total = sales.reduce((sum,s)=>sum+Number(s.total||0),0);
      const orders = sales.length;
      const ticket = orders ? total/orders : 0;

      const quotes = getQuotes();
      const qTotal = quotes.length;
      const qConv = quotes.filter(q=>q.status==='convertida').length;
      const conv = qTotal ? (qConv/qTotal)*100 : 0;

      const citas = getCitas();
      const counts = { inst:0, cot:0, cita:0 };
      citas.forEach(c => { counts[c.tipo] = (counts[c.tipo]||0)+1; });
      const max = Math.max(1, counts.inst+counts.cot+counts.cita);
      const pct = {
        inst: (counts.inst/max)*100,
        cot: (counts.cot/max)*100,
        cita: (counts.cita/max)*100,
      };

      return { total, orders, ticket, conv, counts, pct };
    }

    function renderReportes(){
      const k = computeKpis();
      $('#repVentas').textContent = money(k.total);
      $('#repOrdenes').textContent = String(k.orders);
      $('#repTicket').textContent = money(k.ticket);
      $('#repConv').textContent = `${k.conv.toFixed(0)}%`;

      $('#barInst').style.width = `${k.pct.inst.toFixed(0)}%`;
      $('#barCot').style.width = `${k.pct.cot.toFixed(0)}%`;
      $('#barCita').style.width = `${k.pct.cita.toFixed(0)}%`;

      const top = computeTopProducts();
      const body = $('#repTopBody');
      body.innerHTML = '';

      if(!top.length){
        body.innerHTML = `<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:16px;">Sin ventas registradas en este período</td></tr>`;
        return;
      }

      top.forEach(x => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(x.name)}</td>
          <td>${escapeHtml(x.productId)}</td>
          <td>${escapeHtml(x.units)}</td>
          <td style="color:var(--accent); font-weight:900;">${money(x.revenue)}</td>
        `;
        body.appendChild(tr);
      });
    }

    async function exportReportCSV(){
      showNotification('<i class="fa-solid fa-spinner fa-spin"></i> Generando reporte...', 'info');
      try {
        const hoy   = new Date().toISOString().slice(0, 10);
        const desde = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

        const [resResult, prodResult, cotResult, citasResult] = await Promise.allSettled([
          apiFetch(`${API_BASE}/reportes.php?tipo=resumen`),
          apiFetch(`${API_BASE}/reportes.php?tipo=productos&desde=${desde}&hasta=${hoy}&limit=50`),
          apiFetch(`${API_BASE}/reportes.php?tipo=cotizaciones&desde=${desde}&hasta=${hoy}`),
          apiFetch(`${API_BASE}/reportes.php?tipo=citas&desde=${desde}&hasta=${hoy}`),
        ]);

        const lines = [];
        const esc = s => `"${String(s ?? '').replaceAll('"','""')}"`;
        const fecha = new Date().toLocaleDateString('es-MX');

        lines.push(esc('Reporte Wooden House') + ',' + esc(fecha));
        lines.push('');

        // ── KPIs generales ────────────────────────────────────────
        lines.push(esc('RESUMEN GENERAL') + ',Valor');
        if (resResult.status === 'fulfilled' && resResult.value?.success) {
          const r = resResult.value;
          lines.push(esc('Ventas del mes (MXN)') + ',' + (r.ingresos_mes || 0));
          lines.push(esc('Pedidos del mes')       + ',' + (r.pedidos_mes || 0));
          lines.push(esc('Total pedidos histórico')+ ',' + (r.total_pedidos || 0));
          lines.push(esc('Pedidos pendientes')     + ',' + (r.pedidos_pendientes || 0));
          lines.push(esc('Cotizaciones nuevas')    + ',' + (r.cotizaciones_nuevas || 0));
          lines.push(esc('Productos activos')      + ',' + (r.productos_activos || 0));
          lines.push(esc('Citas hoy')              + ',' + (r.citas_hoy || 0));
        }
        lines.push('');

        // ── Productos más vendidos ────────────────────────────────
        lines.push(esc('PRODUCTOS MÁS VENDIDOS') + ',' + esc('Unidades') + ',' + esc('Ingresos MXN') + ',' + esc('# Pedidos'));
        if (prodResult.status === 'fulfilled' && prodResult.value?.success) {
          (prodResult.value.productos || []).forEach(p => {
            lines.push([
              esc(p.nombre_producto),
              p.unidades_vendidas  || 0,
              p.ingresos_generados || 0,
              p.num_pedidos        || 0,
            ].join(','));
          });
        }
        lines.push('');

        // ── Cotizaciones ──────────────────────────────────────────
        lines.push(esc('ANÁLISIS COTIZACIONES') + ',Valor');
        if (cotResult.status === 'fulfilled' && cotResult.value?.success) {
          const c = cotResult.value;
          lines.push(esc('Conversión histórica %') + ',' + (c.conversion_pct || 0) + '%');
          lines.push(esc('Total histórico')         + ',' + (c.total_historico || 0));
          lines.push(esc('Respondidas / cerradas')  + ',' + (c.respondidas || 0));
          if (c.funnel) {
            lines.push(esc('Nuevas (período)')      + ',' + (c.funnel.nueva || 0));
            lines.push(esc('En revisión (período)') + ',' + (c.funnel.en_revision || 0));
            lines.push(esc('Respondidas (período)') + ',' + (c.funnel.respondida || 0));
            lines.push(esc('Cerradas (período)')    + ',' + (c.funnel.cerrada || 0));
          }
        }
        lines.push('');

        // ── Citas ─────────────────────────────────────────────────
        lines.push(esc('ANÁLISIS CITAS') + ',Valor');
        if (citasResult.status === 'fulfilled' && citasResult.value?.success) {
          const s = citasResult.value.resumen || {};
          lines.push(esc('Total citas (período)')   + ',' + (s.total || 0));
          lines.push(esc('Mediciones')              + ',' + (s.mediciones || 0));
          lines.push(esc('Instalaciones')           + ',' + (s.instalaciones || 0));
          lines.push(esc('Confirmadas')             + ',' + (s.confirmadas || 0));
          lines.push(esc('Completadas')             + ',' + (s.completadas || 0));
          lines.push(esc('Canceladas')              + ',' + (s.canceladas || 0));
        }

        const csv = lines.join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_wooden_house_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        showNotification('<i class="fa-solid fa-check"></i> CSV exportado correctamente (ábrelo con Excel)', 'success');
      } catch(e) {
        showNotification('Error al generar reporte: ' + e.message, 'error');
      }
    }
    async function exportReportXLSX(){
      showNotification('<i class="fa-solid fa-spinner fa-spin"></i> Generando Excel...', 'info');
      try {
        const hoy   = new Date().toISOString().slice(0, 10);
        const desde = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

        const [resResult, prodResult, cotResult, citasResult] = await Promise.allSettled([
          apiFetch(`${API_BASE}/reportes.php?tipo=resumen`),
          apiFetch(`${API_BASE}/reportes.php?tipo=productos&desde=${desde}&hasta=${hoy}&limit=50`),
          apiFetch(`${API_BASE}/reportes.php?tipo=cotizaciones&desde=${desde}&hasta=${hoy}`),
          apiFetch(`${API_BASE}/reportes.php?tipo=citas&desde=${desde}&hasta=${hoy}`),
        ]);

        if (typeof XLSX === 'undefined') {
          showNotification('Librería XLSX no disponible. Intenta recargar la página.', 'error');
          return;
        }

        const wb = XLSX.utils.book_new();
        const fecha = new Date().toLocaleDateString('es-MX');

        // Hoja 1: Resumen general
        const resumenData = [
          ['Reporte Wooden House', fecha],
          [],
          ['RESUMEN GENERAL', 'Valor'],
        ];
        if (resResult.status === 'fulfilled' && resResult.value?.success) {
          const r = resResult.value;
          resumenData.push(['Ventas del mes (MXN)',     r.ingresos_mes       || 0]);
          resumenData.push(['Pedidos del mes',           r.pedidos_mes        || 0]);
          resumenData.push(['Total pedidos historico',   r.total_pedidos      || 0]);
          resumenData.push(['Pedidos pendientes',        r.pedidos_pendientes || 0]);
          resumenData.push(['Cotizaciones nuevas',       r.cotizaciones_nuevas|| 0]);
          resumenData.push(['Productos activos',         r.productos_activos  || 0]);
          resumenData.push(['Citas hoy',                 r.citas_hoy          || 0]);
        }
        const ws1 = XLSX.utils.aoa_to_sheet(resumenData);
        ws1['!cols'] = [{wch: 30}, {wch: 18}];
        XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

        // Hoja 2: Productos mas vendidos
        const prodData = [['Producto', 'Unidades vendidas', 'Ingresos (MXN)', '# Pedidos']];
        if (prodResult.status === 'fulfilled' && prodResult.value?.success) {
          (prodResult.value.productos || []).forEach(p => {
            prodData.push([
              p.nombre_producto,
              p.unidades_vendidas  || 0,
              p.ingresos_generados || 0,
              p.num_pedidos        || 0,
            ]);
          });
        }
        const ws2 = XLSX.utils.aoa_to_sheet(prodData);
        ws2['!cols'] = [{wch: 36}, {wch: 18}, {wch: 18}, {wch: 12}];
        XLSX.utils.book_append_sheet(wb, ws2, 'Productos');

        // Hoja 3: Cotizaciones
        const cotData = [['Metrica', 'Valor']];
        if (cotResult.status === 'fulfilled' && cotResult.value?.success) {
          const c = cotResult.value;
          cotData.push(['Conversion historica %',  String(c.conversion_pct || 0) + '%']);
          cotData.push(['Total historico',          c.total_historico || 0]);
          cotData.push(['Respondidas / cerradas',   c.respondidas     || 0]);
          if (c.funnel) {
            cotData.push(['Nuevas (periodo)',        c.funnel.nueva       || 0]);
            cotData.push(['En revision (periodo)',   c.funnel.en_revision || 0]);
            cotData.push(['Respondidas (periodo)',   c.funnel.respondida  || 0]);
            cotData.push(['Cerradas (periodo)',      c.funnel.cerrada     || 0]);
          }
        }
        const ws3 = XLSX.utils.aoa_to_sheet(cotData);
        ws3['!cols'] = [{wch: 28}, {wch: 14}];
        XLSX.utils.book_append_sheet(wb, ws3, 'Cotizaciones');

        // Hoja 4: Citas
        const citasData = [['Metrica', 'Valor']];
        if (citasResult.status === 'fulfilled' && citasResult.value?.success) {
          const s = citasResult.value.resumen || {};
          citasData.push(['Total citas (periodo)', s.total         || 0]);
          citasData.push(['Mediciones',             s.mediciones    || 0]);
          citasData.push(['Instalaciones',          s.instalaciones || 0]);
          citasData.push(['Confirmadas',            s.confirmadas   || 0]);
          citasData.push(['Completadas',            s.completadas   || 0]);
          citasData.push(['Canceladas',             s.canceladas    || 0]);
        }
        const ws4 = XLSX.utils.aoa_to_sheet(citasData);
        ws4['!cols'] = [{wch: 26}, {wch: 14}];
        XLSX.utils.book_append_sheet(wb, ws4, 'Citas');

        XLSX.writeFile(wb, `reporte_wooden_house_${hoy}.xlsx`);
        showNotification('<i class="fa-solid fa-check"></i> Excel (.xlsx) exportado correctamente', 'success');
      } catch(e) {
        showNotification('Error al generar Excel: ' + e.message, 'error');
      }
    }

    function printReportPDF(){
      try {
        if (typeof window.jspdf !== 'undefined' || typeof window.jsPDF !== 'undefined') {
          const { jsPDF } = window.jspdf || window;
          const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const hoy = new Date().toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' });
          const W = doc.internal.pageSize.getWidth();

          doc.setFillColor(26, 26, 26);
          doc.rect(0, 0, W, 28, 'F');
          doc.setTextColor(139, 115, 85);
          doc.setFontSize(18); doc.setFont('helvetica', 'bold');
          doc.text('Wooden House', 14, 12);
          doc.setTextColor(180, 180, 180);
          doc.setFontSize(10); doc.setFont('helvetica', 'normal');
          doc.text('Reporte de Ventas y Actividad', 14, 20);
          doc.setTextColor(120, 120, 120);
          doc.text('Generado: ' + hoy, W - 14, 20, { align: 'right' });

          let y = 36;

          const kpis = [
            { label: 'Ventas del Mes',   id: 'kpiVentasMes'    },
            { label: 'Pedidos del Mes',  id: 'kpiPedidosMes'   },
            { label: 'Ticket Promedio',  id: 'kpiTicketProm'   },
            { label: 'Cotizaciones',     id: 'kpiCotizaciones' },
          ];
          doc.setFontSize(13); doc.setFont('helvetica', 'bold');
          doc.setTextColor(139, 115, 85);
          doc.text('Resumen del Periodo', 14, y); y += 6;
          doc.setDrawColor(139, 115, 85); doc.setLineWidth(0.4);
          doc.line(14, y, W - 14, y); y += 8;

          const colW = (W - 32) / 2;
          kpis.forEach((k, i) => {
            const x   = 14 + (i % 2) * (colW + 4);
            const val = document.getElementById(k.id)?.textContent?.trim() || '-';
            doc.setFillColor(42, 42, 42);
            doc.roundedRect(x, y, colW, 16, 2, 2, 'F');
            doc.setFontSize(8); doc.setFont('helvetica', 'normal');
            doc.setTextColor(160, 160, 160);
            doc.text(k.label.toUpperCase(), x + 4, y + 5);
            doc.setFontSize(13); doc.setFont('helvetica', 'bold');
            doc.setTextColor(224, 224, 224);
            doc.text(val, x + 4, y + 13);
            if (i % 2 === 1) y += 20;
          });
          if (kpis.length % 2 !== 0) y += 20;
          y += 6;

          const rows = document.querySelectorAll('#tablaPedidos tbody tr');
          if (rows.length > 0) {
            doc.setFontSize(13); doc.setFont('helvetica', 'bold');
            doc.setTextColor(139, 115, 85);
            doc.text('Pedidos Recientes', 14, y); y += 6;
            doc.line(14, y, W - 14, y); y += 7;

            const cols   = ['Folio', 'Cliente', 'Total', 'Estado', 'Fecha'];
            const widths = [28, 68, 24, 30, 28];
            let x = 14;
            doc.setFillColor(50, 50, 50);
            doc.rect(14, y - 4, W - 28, 8, 'F');
            doc.setFontSize(8); doc.setFont('helvetica', 'bold');
            doc.setTextColor(139, 115, 85);
            cols.forEach((col, i) => { doc.text(col, x + 2, y + 1); x += widths[i]; });
            y += 8;

            let count = 0;
            rows.forEach(row => {
              if (count >= 20) return;
              const cells = row.querySelectorAll('td');
              if (cells.length < 5) return;
              const data = [
                (cells[0]?.textContent?.trim() || '').slice(0,12),
                (cells[1]?.textContent?.trim() || '').slice(0,28),
                (cells[2]?.textContent?.trim() || '').slice(0,12),
                (cells[3]?.textContent?.trim() || '').slice(0,14),
                (cells[4]?.textContent?.trim() || '').slice(0,12),
              ];
              if (count % 2 === 0) { doc.setFillColor(34,34,34); doc.rect(14, y-4, W-28, 7, 'F'); }
              doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
              doc.setTextColor(200, 200, 200);
              x = 14;
              data.forEach((cell, i) => { doc.text(cell, x+2, y+1); x += widths[i]; });
              y += 7; count++;
              if (y > 270) { doc.addPage(); y = 20; }
            });
          }

          doc.setFontSize(8); doc.setTextColor(100, 100, 100);
          doc.text('Wooden House - muebleswh.com', 14, 290);
          doc.text('Pagina 1', W - 14, 290, { align: 'right' });

          doc.save('reporte-wooden-house-' + new Date().toISOString().slice(0,10) + '.pdf');
          showNotification('<i class="fa-solid fa-file-pdf"></i> PDF generado correctamente', 'success');
        } else {
          window.print();
          showNotification('Tip: en imprimir elige Guardar como PDF', 'info');
        }
      } catch(e) {
        console.error('Error generando PDF:', e);
        window.print();
      }
    }

    /* =========================
       KPIs DASHBOARD
    ========================= */
    function refreshKPIs(){
      const productos = getProductos();
      $('#kpiProductos').textContent = String(productos.length);

      const low = productos.filter(p => Number(p.stock||0) <= 5).length;
      $('#kpiStockLow').textContent = low ? `<i class="fa-solid fa-triangle-exclamation"></i> ${low} bajo stock` : 'Stock OK';

      const k = computeKpis();
      $('#kpiVentasMes').textContent = money(k.total);
      $('#kpiVentasHint').textContent = k.orders ? `Órdenes: ${k.orders} • Ticket: ${money(k.ticket)}` : 'Sin ventas registradas';

      // kpiPedidos y kpiClientes se llenan desde refreshKPIsFromAPI()
    }

    // ── Charts (Canvas) ────────────────────────────────────
    function drawBars(canvasId, values, labels){
      const c = document.getElementById(canvasId);
      if(!c) return;
      const ctx = c.getContext('2d');
      const w = c.width = c.clientWidth * (window.devicePixelRatio || 1);
      const h = c.height = (Number(c.getAttribute('height')) || 120) * (window.devicePixelRatio || 1);
      ctx.clearRect(0,0,w,h);

      const pad = 18*(window.devicePixelRatio||1);
      const max = Math.max(...values, 1);
      const bw = (w - pad*2) / values.length;

      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1*(window.devicePixelRatio||1);
      for(let i=0;i<4;i++){
        const y = pad + (h-pad*2)*(i/3);
        ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(w-pad,y); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8b7355';
      ctx.fillStyle = accent;

      values.forEach((v,i)=>{
        const bh = (h-pad*2) * (v/max);
        const x = pad + i*bw + (bw*0.18);
        const y = h - pad - bh;
        const rw = bw*0.64;
        ctx.globalAlpha = 0.9;
        roundRect(ctx, x, y, rw, bh, 10*(window.devicePixelRatio||1));
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#cfcfcf';
      ctx.font = `${12*(window.devicePixelRatio||1)}px system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.textAlign = 'center';
      labels.forEach((t,i)=>{
        const x = pad + i*bw + bw/2;
        ctx.fillText(t, x, h - (4*(window.devicePixelRatio||1)));
      });
    }

    function drawDonut(canvasId, parts, labels){
      const c = document.getElementById(canvasId);
      if(!c) return;
      const ctx = c.getContext('2d');
      const w = c.width = c.clientWidth * (window.devicePixelRatio || 1);
      const h = c.height = (Number(c.getAttribute('height')) || 120) * (window.devicePixelRatio || 1);
      ctx.clearRect(0,0,w,h);

      const cx = w/2, cy = h/2;
      const r = Math.min(w,h)*0.33;
      const lw = r*0.55;
      const total = parts.reduce((a,b)=>a+b,0) || 1;

      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8b7355';
      const muted = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#3c3c3c';

      const colors = [accent, muted, '#6f6f6f', '#9a9a9a'];
      let ang = -Math.PI/2;

      parts.forEach((p,i)=>{
        const a = (p/total) * Math.PI*2;
        ctx.beginPath();
        ctx.strokeStyle = colors[i % colors.length];
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.arc(cx, cy, r, ang, ang+a);
        ctx.stroke();
        ang += a;
      });

      ctx.fillStyle = '#e0e0e0';
      ctx.font = `${16*(window.devicePixelRatio||1)}px system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${total} pedidos`, cx, cy);
    }

    function roundRect(ctx, x, y, w, h, r){
      const rr = Math.min(r, w/2, h/2);
      ctx.beginPath();
      ctx.moveTo(x+rr, y);
      ctx.arcTo(x+w, y, x+w, y+h, rr);
      ctx.arcTo(x+w, y+h, x, y+h, rr);
      ctx.arcTo(x, y+h, x, y, rr);
      ctx.arcTo(x, y, x+w, y, rr);
      ctx.closePath();
    }

    async function drawDashboardCharts(){
      try {
        const hoy   = new Date().toISOString().slice(0, 10);
        const hace7 = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

        const [ingResult, resResult] = await Promise.allSettled([
          apiFetch(`${API_BASE}/reportes.php?tipo=ingresos&agrupacion=dia&desde=${hace7}&hasta=${hoy}`),
          apiFetch(`${API_BASE}/reportes.php?tipo=resumen`),
        ]);

        // ── Barras: ventas de los últimos 7 días ──────────────────
        const ventas = [0,0,0,0,0,0,0];
        const labels = [];
        const diasMap = {};
        for (let i = 0; i < 7; i++) {
          const d   = new Date(Date.now() - (6 - i) * 86400000);
          const ymd = d.toISOString().slice(0, 10);
          const dow = ['D','L','M','M','J','V','S'][d.getDay()];
          diasMap[ymd] = i;
          labels.push(dow);
        }
        if (ingResult.status === 'fulfilled' && ingResult.value?.success) {
          (ingResult.value.datos || []).forEach(d => {
            const idx = diasMap[d.periodo];
            if (idx !== undefined) ventas[idx] = parseFloat(d.ingresos) || 0;
          });
        }
        drawBars('chartVentas', ventas, labels);
        const totalSem = ventas.reduce((a,b)=>a+b,0);
        const meta1 = document.getElementById('chartVentasMeta');
        if (meta1) meta1.textContent = `Total semana: $${totalSem.toLocaleString('es-MX')}`;

        // ── Dona: distribución de estados de pedidos ──────────────
        let pendiente = 0, proceso = 0, completo = 0;
        if (resResult.status === 'fulfilled' && resResult.value?.success) {
          const ep = resResult.value.estados_pedidos || [];
          ep.forEach(e => {
            const n = parseInt(e.total) || 0;
            if (['pendiente','anticipo_pagado','pagado'].includes(e.estado))                       pendiente += n;
            else if (['en_produccion','listo','listo_para_entrega'].includes(e.estado))        proceso   += n;
            else if (e.estado === 'entregado')                                                 completo  += n;
          });
        }
        drawDonut('chartEstados', [pendiente, proceso, completo], ['Pendiente','En Proceso','Completado']);
        const meta2 = document.getElementById('chartEstadosMeta');
        if (meta2) meta2.textContent = `Pendientes: ${pendiente} · Proceso: ${proceso} · Completados: ${completo}`;

      } catch(e) {
        console.warn('Error en dashboard charts:', e);
      }
    }

    window.addEventListener('resize', () => {
      clearTimeout(window.__whChartTimer);
      window.__whChartTimer = setTimeout(drawDashboardCharts, 120);
    });

    document.addEventListener('DOMContentLoaded', () => {
      renderCalendar();
      refreshKPIs();
      drawDashboardCharts();
      cargarProductosAPI().then(() => {
        renderCatalogo();
      }).catch(e => console.warn('No se pudieron cargar productos:', e));
      // Si viene de login sin 2FA configurado, forzar sección Seguridad
      if (new URLSearchParams(location.search).get('setup_2fa')) {
        showSection('seguridad');
      }
      setTimeout(() => showNotification('Bienvenido, Administrador', 'success'), 450);
      if (typeof firebaseAuth !== 'undefined') {
        firebaseAuth.onAuthStateChanged(async (user) => {
          if (user) {
            await refreshKPIsFromAPI();
            await cargarPedidosAPI();
          }
        });
      }
    });
  
// ── API LAYER - Conexión real al backend PHP ──────────

const API_BASE = '/api';

async function getAuthToken() {
  try {
    if (typeof firebaseAuth !== 'undefined' && firebaseAuth?.currentUser) {
      return await firebaseAuth.currentUser.getIdToken(false);
    }
    return sessionStorage.getItem('wh_firebase_token') || '';
  } catch (e) { return ''; }
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
    if (res.status === 401 || res.status === 403) {
      showNotification('Sesión expirada. Recarga la página e inicia sesión.', 'error');
      throw new Error('No autenticado (' + res.status + ')');
    }
    const txt = await res.text();
    throw new Error('Error del servidor (HTTP ' + res.status + '): ' + txt.substring(0, 300));
  }
  const data = await res.json();
  if ((res.status === 401 || res.status === 403) && !data.success) {
    showNotification('Sesión expirada. Recarga la página.', 'error');
    throw new Error(data.error || 'No autenticado');
  }
  return data;
}

async function logoutAdmin() {
  if (window._adminRefreshInterval) clearInterval(window._adminRefreshInterval);
  if (!confirm('¿Cerrar sesión?')) return;
  try {
    if (typeof logoutFirebase === 'function') await logoutFirebase();
    else if (typeof firebaseAuth !== 'undefined') await firebaseAuth.signOut();
  } catch(e) {}
  await fetch('/api/auth.php?action=logout', { method: 'POST', credentials: 'same-origin' });
  sessionStorage.removeItem('wh_firebase_token');
  sessionStorage.removeItem('wh_usuario');
  window.location.replace('/inicio');
}

// ── KPIs - Cargar desde API real ──────────────────────
async function refreshKPIsFromAPI() {
  try {
    const data = await apiFetch(`${API_BASE}/reportes.php?tipo=resumen`);
    if (!data.success) return;

    const r = data;
    const fmt = v => new Intl.NumberFormat('es-MX', {style:'currency',currency:'MXN'}).format(v || 0);

    const ventasEl = document.getElementById('kpiVentasMes');
    if (ventasEl) ventasEl.textContent = fmt(r.ingresos_mes);

    const hintVentas = document.getElementById('kpiVentasHint');
    if (hintVentas) hintVentas.textContent = `${r.pedidos_mes || 0} pedidos este mes`;

    const pedEl = document.getElementById('kpiPedidos');
    if (pedEl) pedEl.textContent = r.total_pedidos || 0;

    const pedHint = document.getElementById('kpiPedidosHint');
    if (pedHint) pedHint.textContent = `${r.pedidos_pendientes || 0} pendientes`;

    const cliEl = document.getElementById('kpiClientes');
    if (cliEl) cliEl.textContent = r.clientes_unicos || 0;

    const cliHint = document.getElementById('kpiClientesHint');
    if (cliHint) cliHint.textContent = `${r.clientes_mes || 0} nuevos este mes`;

    const prodEl = document.getElementById('kpiProductos');
    if (prodEl) prodEl.textContent = r.productos_activos || 0;

    const stockEl = document.getElementById('kpiStockLow');
    if (stockEl) stockEl.textContent = `${r.cotizaciones_nuevas || 0} cotizaciones sin atender`;

    // Actividad reciente
    const actEl = document.getElementById('actividadReciente');
    if (actEl) {
      const items = [];
      if (r.total_pedidos > 0) items.push(`<p style="margin:0 0 6px;"><i class="fa-solid fa-cart-shopping"></i> ${r.total_pedidos} pedidos registrados en el sistema</p>`);
      if (r.pedidos_pendientes > 0) items.push(`<p style="margin:0 0 6px;"><i class="fa-solid fa-clock"></i> ${r.pedidos_pendientes} pedido(s) pendientes de atención</p>`);
      if (r.productos_activos > 0) items.push(`<p style="margin:0;"><i class="fa-solid fa-box"></i> ${r.productos_activos} producto(s) activos en catálogo</p>`);
      actEl.innerHTML = items.length ? items.join('') : '<p style="margin:0;">Sin actividad reciente.</p>';
    }

  } catch (e) { console.warn('KPIs API error:', e); }
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(refreshKPIsFromAPI, 500);
});

// ── CATÁLOGO - Conectar a API real ────────────────────
let apiProductos = [];
let apiCategorias = [];

async function cargarProductosAPI() {
  try {
    const [prodData, catData] = await Promise.all([
      apiFetch(`${API_BASE}/productos.php?limit=200&activo=todos`),
      apiFetch(`${API_BASE}/categorias.php`),
    ]);

    if (prodData.success) {
      apiProductos = (prodData.productos || []).map(p => ({
        id:               String(p.id),
        nombre:           p.nombre,
        descripcion:      p.descripcion || '',
        precio:           parseFloat(p.precio || 0),
        precio_base:      parseFloat(p.precio || 0),
        categoria:        p.categoria_nombre || '',
        categoria_id:     p.categoria_id,
        etiqueta:         p.etiqueta || '',
        badge:            p.etiqueta || '',
        estado:           p.activo ? 'activo' : 'inactivo',
        imagen_principal: p.imagen_principal || '',
        imgs:             p.imagen_principal ? [p.imagen_principal] : [],
        especificaciones: [],  // se cargan en detalle si se necesitan
        descLarga:        p.descripcion || '',
      }));
      window._apiProductos = apiProductos;
    }

    if (catData.success) {
      apiCategorias = catData.categorias || [];
      window._apiCategorias = apiCategorias;
      const catSelect = document.getElementById('p_categoria');
      if (catSelect) {
        catSelect.innerHTML = apiCategorias.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
      }
      const catFilter = document.getElementById('catCategory');
      if (catFilter) {
        const currentVal = catFilter.value;
        catFilter.innerHTML = `<option value="">Todas</option>` +
          apiCategorias.map(c => `<option value="${escapeHtml(c.nombre)}">${escapeHtml(c.nombre)}</option>`).join('');
        catFilter.value = currentVal;
      }
    }

    return apiProductos;
  } catch (e) {
    console.error('Error cargando productos API:', e);
    return [];
  }
}

// ── PEDIDOS - Cargar y gestionar desde API ────────────
// ── Máquina de estados estricta (espejo de la validación en api/pedidos.php) ──
const ESTADO_PEDIDO_LABELS = {
  pendiente:          'Pendiente',
  anticipo_pagado:    'Anticipo pagado',
  pagado:             'Pagado',
  en_produccion:      'En Producción',
  listo:              'Listo',
  listo_para_entrega: 'Listo para entrega',
  entregado:          'Entregado',
  cancelado:          'Cancelado',
};
const ESTADO_PEDIDO_CLASS = {
  pendiente:          'status-pending',
  anticipo_pagado:    'status-pending',
  pagado:             'status-progress',
  en_produccion:      'status-producing',
  listo:              'status-info',
  listo_para_entrega: 'status-ready',
  entregado:          'status-completed',
  cancelado:          'status-cancelled',
};
function estadosSiguientesPedido(estadoActual, montoPagado) {
  const transiciones = {
    pendiente:          ['listo', 'cancelado'],
    anticipo_pagado:    ['pendiente', 'cancelado'],
    pagado:             ['pendiente', 'cancelado'],
    en_produccion:      ['listo', 'cancelado'],      // compatibilidad pedidos anteriores
    listo:              ['listo_para_entrega', 'cancelado'],
    listo_para_entrega: ['entregado'],
    entregado:          [],
    cancelado:          [],
  };
  let opciones = transiciones[estadoActual] || [];
  // Requiere al menos anticipo o pago registrado para avanzar a listo
  if (!((montoPagado || 0) > 0)) opciones = opciones.filter(s => s !== 'listo');
  return opciones;
}

async function cargarPedidosAPI() {
  const tbody = document.getElementById('pedidosTable');
  if (!tbody) return;

  try {
    const data = await apiFetch(`${API_BASE}/pedidos.php?limit=30`);
    if (!data.success) return;

    tbody.innerHTML = (data.pedidos || []).map(p => {
      const siguientes = estadosSiguientesPedido(p.estado, p.monto_pagado);
      const opciones = [p.estado, ...siguientes];
      return `
      <tr data-status="${p.estado}" data-id="${p.id}">
        <td>${p.numero_pedido}</td>
        <td>${escapeHtml(p.nombre_cliente)}${p.cliente_id?` <span class="status-badge status-active" style="font-size:10px;padding:2px 8px;" title="Cliente registrado #${p.cliente_id}"><i class="fa-solid fa-user-check"></i> #${p.cliente_id}</span>`:''}</td>
        <td>${escapeHtml(p.correo_cliente)}</td>
        <td>${p.fecha_estimada || '—'}</td>
        <td><span class="status-badge ${ESTADO_PEDIDO_CLASS[p.estado] || ''}">${ESTADO_PEDIDO_LABELS[p.estado] || p.estado}</span></td>
        <td style="color:var(--accent);font-weight:800;">${money(p.total)}</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <button data-call="verDetallePedidoAdmin" data-args="[${p.id}]" style="background:var(--accent);color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;white-space:nowrap;flex-shrink:0;">
            <i class="fa-solid fa-eye"></i> Ver
          </button>
          <select class="form-select" style="width:130px;font-size:12px;" data-onchange="actualizarEstadoPedido" data-id="${p.id}" ${siguientes.length===0?'disabled':''}>
            ${opciones.map(s =>
              `<option value="${s}" ${s === p.estado ? 'selected' : ''}>${ESTADO_PEDIDO_LABELS[s] || s}</option>`
            ).join('')}
          </select>
        </td>
      </tr>
    `;
    }).join('');

    // La tabla se reconstruye por completo — reaplicar el filtro que estaba activo
    const filtroActivo = $('#pedidos-section .filter-btn.active')?.dataset.filter || 'all';
    filterTable(filtroActivo);

  } catch(e) { console.error('Pedidos API error:', e); }
}

async function actualizarEstadoPedido(id, estado) {
  try {
    if (estado === 'entregado' || estado === 'cancelado') {
      const detalle = await apiFetch(`${API_BASE}/pedidos.php?id=${id}`);
      const p = detalle?.pedido;

      // Al entregar un pedido con anticipo y saldo pendiente, resolver el cobro
      // del saldo en el mismo paso — evita tener que presionar "entregado" y
      // luego acordarse de marcar el saldo por separado.
      if (estado === 'entregado' && p && p.tipo_pago === 'anticipo') {
        const saldo = Math.max(0, (p.total || 0) - (p.monto_pagado || 0));
        if (saldo > 0.009) {
          const cobrado = confirm(`Este pedido tiene un saldo pendiente de ${money(saldo)} (anticipo). ¿Se cobró el saldo en efectivo/en persona al momento de la entrega?`);
          if (cobrado) {
            const r = await apiFetch(`${API_BASE}/pagos.php?action=marcar_saldo_manual`, {
              method: 'POST', body: JSON.stringify({ pedido_id: id }),
            });
            if (!r.success) {
              showNotification('<i class="fa-solid fa-xmark"></i> ' + (r.error || 'Error al registrar el saldo'), 'error');
              cargarPedidosAPI();
              return;
            }
          } else {
            // No permitir entregado si el saldo no está liquidado
            showNotification('<i class="fa-solid fa-triangle-exclamation"></i> El pedido no puede marcarse como entregado con saldo pendiente. Registra el pago primero.', 'warning');
            cargarPedidosAPI();
            return;
          }
        }
      }

      // Cancelar NO reembolsa automáticamente — Stripe/PayPal no se conectan
      // aquí. Advertir explícitamente si ya hay dinero cobrado en este pedido.
      if (estado === 'cancelado' && p && (p.monto_pagado || 0) > 0.009) {
        const continuar = confirm(`Este pedido ya tiene ${money(p.monto_pagado)} cobrado. Cancelar NO genera un reembolso automático — el dinero seguirá cobrado hasta que lo reembolses manualmente desde Stripe o PayPal. ¿Continuar con la cancelación?`);
        if (!continuar) { cargarPedidosAPI(); return; }
      }
    }

    const data = await apiFetch(`${API_BASE}/pedidos.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ estado }),
    });
    if (data.success) {
      showNotification('✅ Estado del pedido actualizado', 'success');
      cargarPedidosAPI();
      if (window._admPedId === id) verDetallePedidoAdmin(id);
    } else {
      showNotification('<i class="fa-solid fa-xmark"></i> ' + (data.error || 'Error'), 'error');
    }
  } catch(e) {
    showNotification('<i class="fa-solid fa-xmark"></i> Error de conexión', 'error');
  }
}

// ── EMPLEADOS - API real ──────────────────────────────
async function cargarEmpleadosAPI() {
  const tbody = document.getElementById('empleadosTable');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">Cargando...</td></tr>';

  try {
    const data = await apiFetch(`${API_BASE}/empleados.php`);
    if (!data.success) return;

    const empleados = data.empleados || [];
    if (empleados.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">No hay empleados registrados</td></tr>';
      return;
    }

    tbody.innerHTML = empleados.map(e => `
      <tr>
        <td>${e.id}</td>
        <td>${escapeHtml(e.nombre_completo)}</td>
        <td>${escapeHtml(e.correo)}</td>
        <td>${e.rol === 'administrador' ? 'Administrador' : 'Empleado'}</td>
        <td><span class="status-badge ${e.activo ? 'status-completed' : 'status-disabled'}">${e.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td>
          <button class="btn btn-secondary btn-small btn-editar-emp"
            data-id="${e.id}"
            data-nombre="${escapeHtml(e.nombre_completo)}"
            data-correo="${escapeHtml(e.correo)}"
            data-rol="${e.rol}">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-danger btn-small" data-call="desactivarEmpleado" data-args="[${e.id}]">
            ${e.activo ? '<i class="fa-solid fa-lock"></i>' : '<i class="fa-solid fa-lock-open"></i>'}
          </button>
        </td>
      </tr>
    `).join('');
    tbody.querySelectorAll('.btn-editar-emp').forEach(function(btn) {
      btn.addEventListener('click', function() {
        abrirEditarEmpleado(
          parseInt(this.dataset.id),
          this.dataset.nombre,
          this.dataset.correo,
          this.dataset.rol
        );
      });
    });
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#e05;padding:20px;">Error al cargar empleados</td></tr>';
    console.error('Empleados API error:', e);
  }
}

async function desactivarEmpleado(id) {
  if (!confirm('¿Cambiar estado del empleado?')) return;
  const data = await apiFetch(`${API_BASE}/empleados.php?id=${id}`, {
    method: 'DELETE',
  });
  if (data.success) {
    showNotification('<i class="fa-solid fa-circle-check"></i> Empleado actualizado', 'success');
    cargarEmpleadosAPI();
  }
}

// ── REPORTES - API real ───────────────────────────────
// ════════════════════════════════════════════════════════════════
// MODALES DE DETALLE — Pedido, Cita, Cotización (admin)
// ════════════════════════════════════════════════════════════════

// ── Ver detalle de PEDIDO ──────────────────────────────────────
async function verDetallePedidoAdmin(id) {
  const body  = document.getElementById('adm_ped_body');
  const folio = document.getElementById('adm_ped_folio');
  openModal('adminPedidoDetalleModal');
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';

  try {
    const data = await apiFetch(`${API_BASE}/pedidos.php?id=${id}`);
    if (!data.success || !data.pedido) throw new Error(data.error || 'No encontrado');
    const p = data.pedido;

    folio.textContent = p.numero_pedido;
    window._admPedId  = id;

    const estadoLabels = { pendiente:'Pendiente',anticipo_pagado:'Anticipo pagado',pagado:'Pagado ✓',en_produccion:'En Producción',listo:'Listo',listo_para_entrega:'Listo para entrega',entregado:'Entregado',cancelado:'Cancelado' };
    const estadoClass  = { pendiente:'status-pending',anticipo_pagado:'status-pending',pagado:'status-progress',en_produccion:'status-producing',listo:'status-info',listo_para_entrega:'status-ready',entregado:'status-completed',cancelado:'status-cancelled' };
    const est   = p.estado || 'pendiente';
    const label = estadoLabels[est] || est;
    const cls   = estadoClass[est]  || 'status-pending';

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
              <td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--accent);">${money(i.total||i.precio_unitario*i.cantidad)}</td>
            </tr>`).join('')}
          </tbody>
        </table>`
      : '<p style="color:var(--muted);font-style:italic;font-size:12px;padding:8px 0;">Sin productos registrados</p>';

    const esAnticipo     = p.tipo_pago === 'anticipo';
    const saldoPendiente = Math.max(0, (p.total||0) - (p.monto_pagado||0));
    const saldoHtml = saldoPendiente > 0.009
      ? `<div style="background:var(--bg);border-left:3px solid #c9a96e;border-radius:6px;padding:12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-weight:700;color:#c9a96e;margin-bottom:4px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">${esAnticipo ? 'Anticipo (50%)' : 'Pago pendiente'}</div>
            <div style="font-size:12px;color:var(--muted2);">Pagado: <strong>${money(p.monto_pagado||0)}</strong> · Saldo pendiente: <strong style="color:#c9a96e;">${money(saldoPendiente)}</strong></div>
          </div>
          <button class="btn btn-secondary btn-small" data-call="marcarSaldoManualAdmin" data-args="[${id}]"><i class="fa-solid fa-hand-holding-dollar"></i> ${p.monto_pagado>0?'Marcar saldo pagado':'Marcar como pagado'}</button>
        </div>`
      : (esAnticipo ? `<div style="background:var(--bg);border-left:3px solid var(--ok);border-radius:6px;padding:12px;margin-bottom:14px;">
          <div style="font-weight:700;color:var(--ok);font-size:12px;"><i class="fa-solid fa-circle-check"></i> Anticipo y saldo liquidados</div>
        </div>` : '');

    const pagos = p.pagos || [];
    const pagosHtml = pagos.length
      ? pagos.map(pg=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid var(--border);color:var(--muted2);">
          <span>${pg.metodo_pago||'Pago'} — ${(pg.fecha_creacion||'').substring(0,10)}</span>
          <span style="font-weight:700;color:var(--ok);">${money(pg.monto||0)}</span>
        </div>`).join('')
      : '<p style="color:var(--muted);font-style:italic;font-size:12px;padding:6px 0;">Sin pagos registrados</p>';

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

      <div style="margin-bottom:14px;">
        <div style="font-weight:700;color:var(--accent);margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Historial de Pagos</div>
        ${pagosHtml}
      </div>

      <div style="padding-top:14px;border-top:1px solid var(--border);">
        <div style="font-weight:700;color:var(--accent);margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Cambiar Estado</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <span class="status-badge ${cls}" style="opacity:1;">${label} (actual)</span>
          ${estadosSiguientesPedido(est, p.monto_pagado).map(s=>{
            const l2=estadoLabels[s]||s;
            const c2=estadoClass[s]||'status-pending';
            return `<button type="button" data-admin-ped-estado="${s}"
              class="status-badge ${c2}" style="cursor:pointer;border:none;opacity:0.85;">→ ${l2}</button>`;
          }).join('') || '<span style="color:var(--muted);font-size:12px;">Estado final — sin más transiciones</span>'}
        </div>
        ${est==='pendiente' && (p.monto_pagado||0)<=0 ? '<p style="color:var(--muted);font-size:11px;margin-top:8px;"><i class="fa-solid fa-circle-info"></i> No se puede iniciar producción sin registrar al menos el anticipo o pago.</p>' : ''}
      </div>
    `;
  } catch(e) {
    body.innerHTML = `<div style="color:var(--danger);padding:20px;text-align:center;"><i class="fa-solid fa-circle-exclamation"></i> Error: ${e.message}</div>`;
  }
}

async function marcarSaldoManualAdmin(id) {
  if (!confirm('¿Confirmas que el saldo restante se cobró en efectivo, transferencia o terminal? Esto marcará el pedido como pagado.')) return;
  try {
    const data = await apiFetch(`${API_BASE}/pagos.php?action=marcar_saldo_manual`, {
      method: 'POST',
      body: JSON.stringify({ pedido_id: id }),
    });
    if (data.success) {
      showNotification('✅ Saldo registrado como pagado', 'success');
      verDetallePedidoAdmin(id);
      cargarPedidosAPI();
    } else {
      showNotification('<i class="fa-solid fa-xmark"></i> ' + (data.error || 'Error'), 'error');
    }
  } catch(e) {
    showNotification('<i class="fa-solid fa-xmark"></i> Error de conexión', 'error');
  }
}


// ── Ver detalle de CITA ────────────────────────────────────────
async function verDetalleCitaAdmin(id) {
  const body  = document.getElementById('adm_cita_body');
  const folio = document.getElementById('adm_cita_folio');
  openModal('adminCitaDetalleModal');
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';
  window._admCitaId = id;

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


async function cambiarEstadoCitaAdmin(id, estado) {
  if (!id) return;
  try {
    const data = await apiFetch(`${API_BASE}/citas.php?id=${id}`, {
      method: 'PUT', body: JSON.stringify({ estado })
    });
    if (data.success) {
      showNotification('Estado de cita actualizado', 'success');
      closeModal('adminCitaDetalleModal');
      cargarCitasCalendarioAPI();
    }
  } catch(e) { console.error(e); }
}

// ── Ver detalle de COTIZACIÓN ──────────────────────────────────
async function verDetalleCotAdmin(id) {
  const body  = document.getElementById('adm_cot_body');
  const folio = document.getElementById('adm_cot_folio');
  openModal('adminCotDetalleModal');
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';
  window._admCotId = id;

  try {
    const data = await apiFetch(`${API_BASE}/cotizaciones.php?id=${id}`);
    if (!data.success || !data.cotizacion) throw new Error(data.error || 'No encontrada');
    const cot = data.cotizacion;
    folio.textContent = cot.numero_cotizacion;

    const estLabels = {
      nueva:'Nueva', en_revision:'En Revisión', respondida:'Propuesta enviada',
      aceptada:'Aceptada', en_produccion:'En Producción',
      lista:'Lista para entrega', entregada:'Entregada', cancelada:'Cancelada'
    };
    const estClass = {
      nueva:'status-new', en_revision:'status-pending', respondida:'status-replied',
      aceptada:'status-info', en_produccion:'status-producing',
      lista:'status-ready', entregada:'status-completed', cancelada:'status-cancelled'
    };
    const est = cot.estado || 'nueva';
    const fmt = (n) => n > 0 ? `$${Number(n).toLocaleString('es-MX',{minimumFractionDigits:2})} MXN` : '—';

    // Botones de acción según el estado actual
    const acciones = {
      nueva:        [['en_revision','📋 Marcar en revisión','btn-secondary']],
      en_revision:  [['respondida','📨 Enviar propuesta al cliente','btn-primary'], ['cancelada','✕ Cancelar','btn-danger']],
      respondida:   [['aceptada','✅ Cliente aceptó','btn-primary'], ['cancelada','✕ Cancelar','btn-danger']],
      aceptada:     [['en_produccion','🔨 Mandar a producción','btn-primary'], ['cancelada','✕ Cancelar','btn-danger']],
      en_produccion:[['lista','✅ Marcar como lista','btn-primary']],
      lista:        [['entregada','🎉 Marcar como entregada','btn-primary']],
      entregada:    [],
      cancelada:    [],
    };

    const botonesHtml = (acciones[est] || []).map(([estado, label, cls]) =>
      `<button class="btn ${cls} btn-small" onclick="cambiarEstadoCotAdmin(${cot.id},'${estado}')">${label}</button>`
    ).join(' ');

    // Formulario de propuesta (visible solo cuando está en revisión)
    const showProposal = ['en_revision','respondida','aceptada','en_produccion','lista','entregada'].includes(est);
    const proposalFields = showProposal ? `
      <div style="background:var(--bg);border-left:3px solid #c9a96e;border-radius:6px;padding:14px;margin-top:14px;">
        <div style="font-weight:700;color:#c9a96e;margin-bottom:10px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">
          Propuesta del admin ${est === 'en_revision' ? '— rellena antes de enviar al cliente' : ''}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div>
            <label style="color:var(--muted);font-size:10px;display:block;margin-bottom:4px;">PRECIO COTIZADO (MXN) *</label>
            <input id="cot_precio" type="number" min="0" step="0.01"
              value="${cot.precio_cotizado || ''}"
              style="width:100%;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text);font-size:13px;"
              placeholder="Ej: 15000">
          </div>
          <div>
            <label style="color:var(--muted);font-size:10px;display:block;margin-bottom:4px;">ENTREGA ESTIMADA</label>
            <input id="cot_fecha_entrega" type="date"
              value="${cot.fecha_entrega_estimada || ''}"
              style="width:100%;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text);font-size:13px;">
          </div>
        </div>
        <div style="margin-bottom:10px;">
          <label style="color:var(--muted);font-size:10px;display:block;margin-bottom:4px;">DESCRIPCIÓN DE LA PROPUESTA * (qué se va a fabricar, materiales, acabados)</label>
          <textarea id="cot_desc_respuesta" rows="4"
            style="width:100%;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text);font-size:13px;resize:vertical;"
            placeholder="Ej: Closet de 2.5m x 2m en melamina nogal, 4 cajones, 6 repisas, puertas corredizas con espejo...">${escapeHtml(cot.descripcion_respuesta || '')}</textarea>
        </div>
        <div style="margin-bottom:10px;">
          <label style="color:var(--muted);font-size:10px;display:block;margin-bottom:4px;">NOTAS INTERNAS (solo visibles aquí)</label>
          <textarea id="cot_notas" rows="2"
            style="width:100%;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text);font-size:12px;resize:vertical;"
            placeholder="Notas de taller, proveedores, condiciones...">${escapeHtml(cot.notas_admin || '')}</textarea>
        </div>
        <button class="btn btn-secondary btn-small" onclick="guardarCamposCotizacion(${cot.id})">
          <i class="fa-solid fa-floppy-disk"></i> Guardar cambios
        </button>
      </div>` : '';

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <span class="status-badge ${estClass[est]||'status-new'}">${estLabels[est]||est}</span>
        <span style="font-size:11px;color:var(--muted);">Creada: ${(cot.fecha_creacion||'').substring(0,10)}</span>
      </div>

      ${botonesHtml ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">${botonesHtml}</div>` : ''}

      <div style="background:var(--bg);border-left:3px solid var(--accent);border-radius:6px;padding:12px;margin-bottom:12px;">
        <div style="font-weight:700;color:var(--accent);margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Cliente</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--muted2);">
          <div><span style="color:var(--muted);display:block;font-size:10px;">Nombre</span><strong>${escapeHtml(cot.nombre_cliente)}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Teléfono</span><strong>${escapeHtml(cot.telefono_cliente||'—')}</strong></div>
          <div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Correo</span><strong>${escapeHtml(cot.correo_cliente)}</strong></div>
          ${cot.cliente_id?`<div style="grid-column:1/-1;margin-top:4px;"><span style="background:#2d6a3f20;color:#2d6a3f;border-radius:12px;padding:3px 10px;font-size:11px;font-weight:700;"><i class="fa-solid fa-user-check"></i> Cliente registrado #${cot.cliente_id}</span></div>`:''}
        </div>
      </div>

      <div style="background:var(--bg);border-left:3px solid var(--ok);border-radius:6px;padding:12px;margin-bottom:2px;">
        <div style="font-weight:700;color:var(--ok);margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Solicitud del cliente</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--muted2);">
          <div><span style="color:var(--muted);display:block;font-size:10px;">Modelo</span><strong>${escapeHtml(cot.modelo_mueble||'No especificado')}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Presupuesto cliente</span><strong>${escapeHtml(cot.rango_presupuesto||'—')}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Tiene medidas</span><strong>${parseInt(cot.tiene_medidas)?'✅ Sí':'❌ No'}</strong></div>
          <div><span style="color:var(--muted);display:block;font-size:10px;">Requiere instalación</span><strong>${parseInt(cot.requiere_instalacion)?'✅ Sí':'❌ No'}</strong></div>
          ${cot.medidas?`<div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Medidas</span><strong>${escapeHtml(cot.medidas)}</strong></div>`:''}
          <div style="grid-column:1/-1;">
            <span style="color:var(--muted);display:block;font-size:10px;margin-bottom:4px;">Descripción</span>
            <div style="background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:10px;line-height:1.6;color:var(--muted2);">${escapeHtml(cot.descripcion_solicitud||'—')}</div>
          </div>
        </div>
      </div>

      ${proposalFields}
    `;
  } catch(e) {
    body.innerHTML = `<div style="color:var(--danger);padding:20px;text-align:center;"><i class="fa-solid fa-circle-exclamation"></i> Error: ${e.message}</div>`;
  }
}


// ── Cotizaciones (admin) — datos reales de la API ───────────
async function cargarCotizacionesAPI() {
  const tbody = document.getElementById('cotizacionesAdminBody') ||
                document.querySelector('#cotizaciones-section tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted)"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</td></tr>';

  try {
    const data = await apiFetch(`${API_BASE}/cotizaciones.php?limit=50`);
    if (!data.success) { throw new Error(data.error || 'Error'); }
    const cots = data.cotizaciones || [];

    if (tbody) {
      if (!cots.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted)">Sin cotizaciones registradas</td></tr>';
        return;
      }
      const estadoCotClass  = {
        nueva:'status-new', en_revision:'status-pending', respondida:'status-replied',
        aceptada:'status-info', en_produccion:'status-producing',
        lista:'status-ready', entregada:'status-completed', cancelada:'status-cancelled'
      };
      const estadoCotLabels = {
        nueva:'Nueva', en_revision:'En revisión', respondida:'Propuesta enviada',
        aceptada:'Aceptada', en_produccion:'En Producción',
        lista:'Lista', entregada:'Entregada', cancelada:'Cancelada'
      };
      tbody.innerHTML = cots.map(c => {
        const est   = c.estado || 'nueva';
        const cls   = estadoCotClass[est]  || 'status-new';
        const label = estadoCotLabels[est] || est;
        const fecha = (c.fecha_creacion || '').substring(0, 10);
        const modeloLabels = {
          sevilla:'Modelo Sevilla', roma:'Modelo Roma', edinburgo:'Modelo Edinburgo',
          singapur:'Modelo Singapur', sydney:'Modelo Sydney', palermo:'Modelo Palermo',
          budapest:'Modelo Budapest', quebec:'Modelo Quebec', toronto:'Modelo Toronto',
          amsterdam:'Modelo Amsterdam', oslo:'Mueble Oslo', paris:'Muebles Paris',
          tokio:'Mueble Tokio', personalizado:'Personalizado',
          // legacy
          baño:'Baño', sala:'Sala', recamara:'Recámara', estudio:'Estudio',
          cocina:'Cocina', closet:'Closet',
        };
        const tipo = modeloLabels[c.modelo_mueble] || (c.modelo_mueble || 'Sin modelo');
        const cid  = c.cliente_id || '';
        return `<tr>
          <td><strong>${escapeHtml(c.numero_cotizacion || '')}</strong></td>
          <td>${escapeHtml(c.nombre_cliente || '')}</td>
          <td>${cid ? `<span class="status-badge status-active" style="font-size:10px;padding:2px 8px;"><i class="fa-solid fa-user-check"></i> #${cid}</span>` : '<span style="color:var(--muted);font-size:11px;">—</span>'}</td>
          <td>${escapeHtml(c.correo_cliente || '')}</td>
          <td>${escapeHtml(tipo)}</td>
          <td>${escapeHtml(fecha)}</td>
          <td><span class="status-badge ${cls}">${label}</span></td>
          <td>
            <button data-call="verDetalleCotAdmin" data-args="[${c.id}]" class="btn btn-primary btn-small">
              <i class='fa-solid fa-eye'></i> Ver y gestionar
            </button>
          </td>
        </tr>`;
      }).join('');
    }
  } catch(e) {
    console.error('Error cargando cotizaciones:', e);
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#c62828">Error al cargar cotizaciones. Verifica tu conexión.</td></tr>';
  }
}

async function guardarCamposCotizacion(id) {
  const precio     = parseFloat(document.getElementById('cot_precio')?.value || 0);
  const desc       = document.getElementById('cot_desc_respuesta')?.value?.trim() || '';
  const notas      = document.getElementById('cot_notas')?.value?.trim() || '';
  const fechaEnt   = document.getElementById('cot_fecha_entrega')?.value || '';

  const data = await apiFetch(`${API_BASE}/cotizaciones.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      precio_cotizado:       precio || null,
      descripcion_respuesta: desc   || null,
      notas_admin:           notas  || null,
      fecha_entrega_estimada:fechaEnt || null,
    }),
  });
  if (data.success) showNotification('<i class="fa-solid fa-floppy-disk"></i> Guardado', 'success');
  else showNotification(data.error || 'Error al guardar', 'error');
}

async function cambiarEstadoCotAdmin(id, estado) {
  // Al enviar propuesta, incluir precio y descripción en el mismo request
  const body = { estado };
  if (estado === 'respondida') {
    body.precio_cotizado        = parseFloat(document.getElementById('cot_precio')?.value || 0);
    body.descripcion_respuesta  = document.getElementById('cot_desc_respuesta')?.value?.trim() || '';
    body.notas_admin            = document.getElementById('cot_notas')?.value?.trim() || '';
    body.fecha_entrega_estimada = document.getElementById('cot_fecha_entrega')?.value || '';
  }

  const data = await apiFetch(`${API_BASE}/cotizaciones.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

  if (data.success) {
    const lbl = {
      nueva:'Nueva', en_revision:'En Revisión', respondida:'Propuesta enviada al cliente',
      aceptada:'Aceptada', en_produccion:'Enviada a producción',
      lista:'Lista para entrega', entregada:'Entregada', cancelada:'Cancelada',
    }[estado] || estado;
    showNotification(`✅ ${lbl}`, 'success');
    closeModal('adminCotDetalleModal');
    cargarCotizacionesAPI();
  } else {
    showNotification(data.error || 'Error al cambiar estado', 'error');
  }
}

window.guardarCamposCotizacion = guardarCamposCotizacion;

async function cargarReportesAPI() {
  try {
    const hoy   = new Date().toISOString().slice(0, 10);
    const desde = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    // Promise.allSettled: si uno falla el otro sigue funcionando
    const [resumenResult, productosResult, cotResult, citasResult] = await Promise.allSettled([
      apiFetch(`${API_BASE}/reportes.php?tipo=resumen`),
      apiFetch(`${API_BASE}/reportes.php?tipo=productos&desde=${desde}&hasta=${hoy}`),
      apiFetch(`${API_BASE}/reportes.php?tipo=cotizaciones&desde=${desde}&hasta=${hoy}`),
      apiFetch(`${API_BASE}/reportes.php?tipo=citas&desde=${desde}&hasta=${hoy}`),
    ]);

    // ── KPIs del resumen ─────────────────────────────────
    if (resumenResult.status === 'fulfilled' && resumenResult.value?.success) {
      const r = resumenResult.value;
      setText('repVentas',  money(r.ingresos_mes || 0));
      setText('repOrdenes', r.pedidos_mes || 0);
      const ticket = (r.pedidos_mes > 0) ? (r.ingresos_mes / r.pedidos_mes) : 0;
      setText('repTicket', money(ticket));

      // Actualizar KPIs del dashboard también
      const ventasEl = document.getElementById('kpiVentasMes');
      if (ventasEl) ventasEl.textContent = money(r.ingresos_mes || 0);
      const hintEl = document.getElementById('kpiVentasHint');
      if (hintEl) hintEl.textContent = `${r.pedidos_mes || 0} pedidos este mes`;
      const pedEl = document.getElementById('kpiPedidos');
      if (pedEl) pedEl.textContent = r.total_pedidos || 0;
      const pedHint = document.getElementById('kpiPedidosHint');
      if (pedHint) pedHint.textContent = `${r.pedidos_pendientes || 0} pendientes`;
      const cliEl = document.getElementById('kpiClientes');
      if (cliEl) cliEl.textContent = r.clientes_unicos || 0;
      const cliHint = document.getElementById('kpiClientesHint');
      if (cliHint) cliHint.textContent = `${r.clientes_mes || 0} nuevos este mes`;
      const prodEl = document.getElementById('kpiProductos');
      if (prodEl) prodEl.textContent = r.productos_activos || 0;
      const stockEl = document.getElementById('kpiStockLow');
      if (stockEl) stockEl.textContent = `${r.cotizaciones_nuevas || 0} cotizaciones sin atender`;
    }

    // ── Conversión de cotizaciones ────────────────────────
    if (cotResult.status === 'fulfilled' && cotResult.value?.success) {
      const c = cotResult.value;
      setText('repConv', (c.conversion_pct || 0) + '%');
      setText('repCotRespondidas', (c.respondidas || 0) + ' / ' + (c.total_historico || 0));
    }

    // ── Análisis de citas (barras) ────────────────────────
    if (citasResult.status === 'fulfilled' && citasResult.value?.success) {
      const s = citasResult.value.resumen || {};
      const total = Math.max(1, parseInt(s.total) || 0);
      const med   = parseInt(s.mediciones)   || 0;
      const inst  = parseInt(s.instalaciones)|| 0;
      const otros = parseInt(s.otros)        || 0;

      const barInst = document.getElementById('barInst');
      const barCot  = document.getElementById('barCot');
      const barCita = document.getElementById('barCita');
      if (barInst) barInst.style.width = Math.round((med  / total) * 100) + '%';
      if (barCot)  barCot.style.width  = Math.round((inst / total) * 100) + '%';
      if (barCita) barCita.style.width = Math.round((otros/ total) * 100) + '%';

      setText('repCitasMedicion',   med);
      setText('repCitasInstalacion',inst);
      setText('repCitasOtros',      otros);
    }

    // ── Top productos ─────────────────────────────────────
    const tbody = document.getElementById('repTopBody') ||
                  document.querySelector('#reportes-section table tbody');
    if (tbody) {
      if (productosResult.status === 'fulfilled' && productosResult.value?.success) {
        const prods = productosResult.value.productos || [];
        if (prods.length > 0) {
          tbody.innerHTML = prods.map(p => `
            <tr>
              <td>${escapeHtml(p.nombre_producto || '')}</td>
              <td>${p.unidades_vendidas || 0}</td>
              <td style="color:var(--accent);font-weight:800;">${money(p.ingresos_generados || 0)}</td>
              <td>${p.num_pedidos || 0}</td>
            </tr>
          `).join('');
        } else {
          tbody.innerHTML = `<tr><td colspan="4" style="color:var(--muted);text-align:center;">Sin ventas en el período seleccionado</td></tr>`;
        }
      } else {
        tbody.innerHTML = `<tr><td colspan="4" style="color:var(--muted);text-align:center;">Sin datos disponibles aún</td></tr>`;
      }
    }
  } catch(e) { console.error('Reportes API error:', e); }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// Cargar al inicio si ya estamos en dashboard
document.addEventListener('DOMContentLoaded', () => {
  if (typeof firebaseAuth !== 'undefined') {
    firebaseAuth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.replace('/inicio');
      }
    });
  }
  setTimeout(refreshKPIsFromAPI, 300);

  const empCorreo = document.getElementById('emp_correo');
  if (empCorreo) {
    empCorreo.addEventListener('input', function () {
      this.value = this.value.replace(/[^a-zA-Z0-9._%+\-@]/g, '');
    });
    empCorreo.addEventListener('blur', function () {
      const val = this.value.trim();
      const errBox = document.getElementById('emp_error');
      if (!val) return;
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(val)) {
        this.style.borderColor = '#8b4a4a';
        if (errBox) { errBox.textContent = 'Correo electrónico inválido. Ejemplo: nombre@dominio.com'; errBox.style.display = 'block'; }
      } else {
        this.style.borderColor = '#3d6b47';
        if (errBox) errBox.style.display = 'none';
      }
    });
    empCorreo.addEventListener('focus', function () {
      const errBox = document.getElementById('emp_error');
      this.style.borderColor = '';
      if (errBox) errBox.style.display = 'none';
    });
  }
});

window.logoutAdmin              = logoutAdmin;
window.actualizarEstadoPedido   = actualizarEstadoPedido;

// ── EMPLEADOS - Invitar (nuevo) o editar (existente) ──────────────

async function guardarEmpleado() {
  const mode   = document.getElementById('emp_mode')?.value || 'invite';
  const isEdit = mode === 'edit';
  const empId  = document.getElementById('emp_id')?.value || '';
  const nombre = document.getElementById('emp_nombre')?.value.trim() || '';
  const correo = document.getElementById('emp_correo')?.value.trim().toLowerCase() || '';
  const rol    = document.getElementById('emp_rol')?.value || 'empleado';
  const errBox = document.getElementById('emp_error');
  const infoBox= document.getElementById('emp_info');
  const btn    = document.getElementById('emp_btn_guardar');

  const showErr = (msg) => {
    if (errBox)  { errBox.textContent = msg; errBox.style.display = 'block'; }
    if (infoBox) infoBox.style.display = 'none';
  };
  if (errBox)  errBox.style.display  = 'none';
  if (infoBox) infoBox.style.display = 'none';

  if (!nombre) { showErr('Ingresa el nombre completo'); return; }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!correo || !emailRe.test(correo)) { showErr('Correo electrónico inválido.'); return; }

  if (btn) { btn.disabled = true; btn.innerHTML = isEdit ? '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...' : '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...'; }

  try {
    if (isEdit) {
      // Edición: solo nombre y rol (el correo no se cambia para no romper Firebase)
      const data = await apiFetch(`${API_BASE}/empleados.php?id=${empId}`, {
        method: 'PUT',
        body: JSON.stringify({ nombre_completo: nombre, correo, rol }),
      });
      if (!data.success) throw new Error(data.error || 'Error al actualizar');
      showNotification('<i class="fa-solid fa-circle-check"></i> Empleado actualizado', 'success');
      closeModal('nuevoEmpleado');
      cargarEmpleadosAPI();

    } else {
      // Invitación: el admin NO toca contraseñas — el empleado la crea por su cuenta
      const data = await apiFetch(`${API_BASE}/invitaciones.php?action=crear`, {
        method: 'POST',
        body: JSON.stringify({ nombre_completo: nombre, correo, rol }),
      });
      if (!data.success) throw new Error(data.error || 'Error al enviar la invitación');

      if (infoBox) {
        infoBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${data.mensaje || 'Invitación enviada.'}`;
        infoBox.style.display = '';
      }
      showNotification('<i class="fa-solid fa-paper-plane"></i> Invitación enviada', 'success');
      // No cerramos el modal de inmediato para que el admin vea la confirmación
      setTimeout(() => { closeModal('nuevoEmpleado'); cargarEmpleadosAPI(); }, 2000);
    }

  } catch(e) {
    showErr(e.message || 'Error desconocido');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = isEdit
        ? '<i class="fa-solid fa-floppy-disk"></i> Guardar cambios'
        : '<i class="fa-solid fa-paper-plane"></i> Enviar invitación';
    }
  }
}

function abrirEditarEmpleado(id, nombre, correo, rol) {
  document.getElementById('emp_mode').value   = 'edit';
  document.getElementById('emp_id').value     = id;
  document.getElementById('emp_nombre').value = nombre;
  document.getElementById('emp_correo').value = correo;
  document.getElementById('emp_rol').value    = rol;
  document.getElementById('empModalTitle').textContent = 'Editar Empleado';
  const help = document.getElementById('emp_correo_help');
  if (help) help.textContent = 'El correo no se puede cambiar aquí (está vinculado a Firebase).';
  document.getElementById('emp_correo').readOnly = true;
  const btn = document.getElementById('emp_btn_guardar');
  if (btn) btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar cambios';
  document.getElementById('emp_error')?.style && (document.getElementById('emp_error').style.display = 'none');
  document.getElementById('emp_info')?.style  && (document.getElementById('emp_info').style.display  = 'none');
  openModal('nuevoEmpleado');
}

function abrirNuevoEmpleado() {
  document.getElementById('emp_mode').value   = 'invite';
  document.getElementById('emp_id').value     = '';
  document.getElementById('emp_nombre').value = '';
  document.getElementById('emp_correo').value = '';
  document.getElementById('emp_correo').readOnly = false;
  document.getElementById('emp_rol').value    = 'empleado';
  document.getElementById('empModalTitle').textContent = 'Invitar Empleado';
  const help = document.getElementById('emp_correo_help');
  if (help) help.textContent = 'Se enviará un enlace de activación a este correo.';
  const btn = document.getElementById('emp_btn_guardar');
  if (btn) btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar invitación';
  document.getElementById('emp_error')?.style && (document.getElementById('emp_error').style.display = 'none');
  document.getElementById('emp_info')?.style  && (document.getElementById('emp_info').style.display  = 'none');
  openModal('nuevoEmpleado');
}

window.desactivarEmpleado       = desactivarEmpleado;
window.guardarEmpleado          = guardarEmpleado;
window.abrirEditarEmpleado      = abrirEditarEmpleado;
window.abrirNuevoEmpleado       = abrirNuevoEmpleado;

// ── CAPACIDAD DEL TALLER ─────────────────────────────────────────
const API_DISP = `${API_BASE}/disponibilidad.php`;
const API_BLOQ = `${API_BASE}/dias_bloqueados.php`;

async function cargarCapacidad() {
  const grid = document.getElementById('capacidadGrid');
  if (!grid) return;

  grid.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px;grid-column:1/-1;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando carga del taller...</div>';

  try {
    // Llamar a dias_bloqueados para obtener carga + bloqueados en un solo request
    const desde = new Date().toISOString().slice(0, 10);
    const hasta = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
    const data  = await apiFetch(`${API_BLOQ}?desde=${desde}&hasta=${hasta}`);
    if (!data.success) throw new Error(data.error || 'Error');

    const bloqueadosSet = new Set((data.bloqueados || []).map(b => b.fecha));
    const carga         = data.carga_por_dia || {};
    const limite        = data.limite_dia || 10;

    // Actualizar KPIs
    document.getElementById('capLimiteDia').textContent = limite;

    let diasLlenos = 0, proximaLibre = null;
    const hoy = new Date();

    // Generar los próximos 30 días hábiles
    const dias = [];
    let d = new Date(hoy); d.setDate(d.getDate() + 1);
    while (dias.length < 30) {
      const dow = d.getDay(); // 0=dom, 6=sab
      if (dow !== 0 && dow !== 6) {
        const ymd = d.toISOString().slice(0, 10);
        const bloqueado = bloqueadosSet.has(ymd);
        const c = carga[ymd] || { total_productos: 0, num_pedidos: 0, porcentaje: 0, lleno: false };
        const pct = bloqueado ? 100 : Math.round((c.total_productos / limite) * 100);
        const lleno = bloqueado || c.total_productos >= limite;

        if (lleno && !bloqueado) diasLlenos++;
        if (!lleno && !bloqueado && proximaLibre === null) proximaLibre = ymd;

        dias.push({ ymd, bloqueado, pct, lleno, productos: c.total_productos, pedidos: c.num_pedidos, limite });
      }
      d.setDate(d.getDate() + 1);
    }

    document.getElementById('capDiasLlenos').textContent    = diasLlenos;
    document.getElementById('capDiasBloqueados').textContent = data.bloqueados.length;
    document.getElementById('capProximaLibre').textContent   = proximaLibre
      ? new Date(proximaLibre + 'T12:00:00').toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'short' })
      : 'Sin disponibilidad';

    // Renderizar grid
    grid.innerHTML = dias.map(d => {
      const colorBg = d.bloqueado
        ? 'background:#242424;border:2px solid #444;'
        : d.pct >= 80 ? 'background:rgba(139,74,74,.25);border:1px solid rgba(139,74,74,.5);'
        : d.pct >= 40 ? 'background:rgba(139,115,85,.2);border:1px solid rgba(139,115,85,.4);'
        : 'background:rgba(74,139,90,.15);border:1px solid rgba(74,139,90,.35);';

      const colorText = d.bloqueado ? '#555'
        : d.pct >= 80 ? '#c07070' : d.pct >= 40 ? '#b09060' : '#70a880';

      const fecha = new Date(d.ymd + 'T12:00:00');
      const label = fecha.toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'short' });

      // Barra de progreso
      const barColor = d.bloqueado ? '#333' : d.pct >= 80 ? '#8b4a4a' : d.pct >= 40 ? '#8b7355' : '#4a8b5a';

      return `<div style="padding:10px 12px;border-radius:10px;${colorBg}cursor:pointer;transition:opacity .2s;"
               title="${d.bloqueado ? '🔒 Día bloqueado' : d.productos + ' de ' + d.limite + ' productos · ' + d.pedidos + ' pedido(s)'}"
               data-call="toggleBloqueoDia" data-args='["${d.ymd}",${d.bloqueado}]'>
        <div style="font-size:11px;color:${colorText};font-weight:700;margin-bottom:4px;">${label}</div>
        ${d.bloqueado
          ? '<div style="font-size:10px;color:#555;"><i class="fa-solid fa-lock"></i> Bloqueado</div>'
          : `<div style="height:4px;background:#333;border-radius:2px;margin-bottom:4px;overflow:hidden;">
               <div style="height:100%;width:${d.pct}%;background:${barColor};transition:width .5s;border-radius:2px;"></div>
             </div>
             <div style="font-size:10px;color:${colorText};">${d.productos}/${d.limite} prod.</div>`
        }
      </div>`;
    }).join('');

    // Actualizar lista de bloqueados próximos
    renderListaBloqueados(data.bloqueados);

  } catch(e) {
    grid.innerHTML = `<div style="color:var(--danger);text-align:center;padding:20px;grid-column:1/-1;">
      <i class="fa-solid fa-circle-exclamation"></i> Error: ${e.message}</div>`;
  }
}

function renderListaBloqueados(bloqueados) {
  const cont = document.getElementById('listaBloqueados');
  if (!cont) return;
  const proximos = bloqueados.filter(b => b.fecha >= new Date().toISOString().slice(0, 10)).slice(0, 8);
  if (!proximos.length) {
    cont.innerHTML = '<span style="color:var(--muted);font-size:12px;">Ningún día bloqueado próximo</span>';
    return;
  }
  cont.innerHTML = proximos.map(b => {
    const fecha = new Date(b.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'short' });
    const warn  = b.tiene_pedidos ? ' <i class="fa-solid fa-triangle-exclamation" style="color:var(--warn);" title="Tiene pedidos asignados"></i>' : '';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--bg);border-radius:8px;font-size:12px;">
      <div>
        <strong style="color:var(--muted2);">${fecha}</strong>${warn}
        <div style="color:var(--muted);font-size:11px;">${b.motivo}</div>
      </div>
      <button data-call="desbloquearDia" data-args='["${b.fecha}"]'
        style="background:transparent;border:1px solid var(--danger);color:var(--danger);padding:2px 8px;border-radius:6px;font-size:10px;cursor:pointer;">
        <i class="fa-solid fa-lock-open"></i>
      </button>
    </div>`;
  }).join('');
}

async function bloquearDia() {
  const fecha  = document.getElementById('capFechaBloquear')?.value;
  const motivo = document.getElementById('capMotivoBloquear')?.value.trim() || 'Día no hábil';
  if (!fecha) { showNotification('Selecciona una fecha', 'warning'); return; }

  try {
    const data = await apiFetch(API_BLOQ, 'POST', { fecha, motivo });
    if (!data.success) throw new Error(data.error);
    if (data.advertencia) showNotification(data.advertencia, 'warning');
    else showNotification(`<i class="fa-solid fa-lock"></i> Día ${fecha} bloqueado`, 'success');
    document.getElementById('capFechaBloquear').value = '';
    document.getElementById('capMotivoBloquear').value = '';
    cargarCapacidad();
  } catch(e) {
    showNotification(`Error: ${e.message}`, 'error');
  }
}

async function desbloquearDia(fecha) {
  if (!confirm(`¿Desbloquear el día ${fecha}?`)) return;
  try {
    const data = await apiFetch(`${API_BLOQ}?fecha=${fecha}`, 'DELETE');
    if (!data.success) throw new Error(data.error);
    showNotification(`<i class="fa-solid fa-lock-open"></i> Día ${fecha} desbloqueado`, 'success');
    cargarCapacidad();
  } catch(e) {
    showNotification(`Error: ${e.message}`, 'error');
  }
}

async function toggleBloqueoDia(fecha, estaBloqueado) {
  if (estaBloqueado) {
    await desbloquearDia(fecha);
  } else {
    // Pre-llenar la fecha en el formulario y hacer scroll
    const inp = document.getElementById('capFechaBloquear');
    if (inp) { inp.value = fecha; inp.focus(); }
    showNotification('Fecha seleccionada. Agrega un motivo y haz clic en Bloquear.', 'info');
  }
}

// Cargar capacidad cuando se activa la sección
// ── AUTO-POLLING cada 30 segundos ──────────────────────────────────────
// Refresca la sección visible automáticamente, igual que el panel empleado.
// Sin necesidad de que el administrador recargue la página manualmente.
function _autoRefreshAdmin() {
  const section = window._currentSection || 'dashboard';
  try {
    if      (section === 'pedidos'      && typeof cargarPedidosAPI === 'function')          cargarPedidosAPI();
    else if (section === 'cotizaciones' && typeof cargarCotizacionesAPI === 'function')     cargarCotizacionesAPI();
    else if (section === 'citas'        && typeof cargarCitasCalendarioAPI === 'function')  cargarCitasCalendarioAPI();
    else if (section === 'catalogo'     && typeof cargarProductosAPI === 'function')        cargarProductosAPI().then(() => { if(typeof renderCatalogo==='function') renderCatalogo(); });
    else if (section === 'empleados'    && typeof cargarEmpleadosAPI === 'function')        cargarEmpleadosAPI();
    else if (section === 'reportes'     && typeof cargarReportesAPI === 'function')         cargarReportesAPI();
    else if (section === 'dashboard'    && typeof refreshKPIsFromAPI === 'function')        refreshKPIsFromAPI();
  } catch(e) { console.warn('[autoRefresh] Error en sección', section, e); }
}

document.addEventListener('DOMContentLoaded', () => {
  // Sección inicial
  window._currentSection = 'dashboard';

  // Iniciar ciclo de auto-polling
  window._adminRefreshInterval = setInterval(_autoRefreshAdmin, 8000);

  // Pausar cuando la pestaña no es visible, reanudar al volver
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(window._adminRefreshInterval);
    } else {
      _autoRefreshAdmin();
      window._adminRefreshInterval = setInterval(_autoRefreshAdmin, 8000);
    }
  });
});

// ════════════════════════════════════════════════════════════════
// MÓDULO: CLIENTES REGISTRADOS
// ════════════════════════════════════════════════════════════════

let _clientesOffset = 0;
const _clientesLimit = 25;

async function cargarClientesAdmin() {
  const q    = document.getElementById('clientesSearch')?.value.trim() || '';
  const body = document.getElementById('clientesAdminBody');
  if (!body) return;

  body.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--muted);">
    <i class="fa-solid fa-spinner fa-spin"></i> Cargando...
  </td></tr>`;

  try {
    const url = `${API_BASE}/clientes.php?limit=${_clientesLimit}&offset=${_clientesOffset}${q ? '&q=' + encodeURIComponent(q) : ''}`;
    const data = await apiFetch(url);
    if (!data.success) throw new Error(data.message || 'Error');

    const clientes = data.clientes || [];
    const total    = data.total || 0;

    // Stats
    const conPedidos = clientes.filter(c => c.total_pedidos > 0).length;
    const stTotal    = document.getElementById('statTotalClientes');
    const stConPed   = document.getElementById('statClientesConPedidos');
    if (stTotal)  stTotal.textContent  = total;
    if (stConPed) stConPed.textContent = conPedidos + (total > _clientesLimit ? '+' : '');

    if (!clientes.length) {
      body.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--muted);">
        Sin clientes registrados aún
      </td></tr>`;
      return;
    }

    body.innerHTML = clientes.map(c => `
      <tr>
        <td style="color:var(--muted);font-size:12px;">#${c.id}</td>
        <td style="font-weight:600;">${escapeHtml(c.nombre)}</td>
        <td style="font-size:13px;">${escapeHtml(c.correo)}</td>
        <td style="font-size:13px;">${escapeHtml(c.telefono || '—')}</td>
        <td style="font-size:13px;">${escapeHtml(c.ciudad || '—')}</td>
        <td style="text-align:center;font-weight:700;color:${c.total_pedidos > 0 ? 'var(--accent)' : 'var(--muted)'};">${c.total_pedidos}</td>
        <td style="font-weight:700;color:var(--accent);">${money(c.total_gastado)}</td>
        <td style="font-size:12px;color:var(--muted);">${(c.fecha_registro || '').substring(0, 10)}</td>
        <td>
          <button class="btn btn-secondary btn-small" data-call="verDetalleCliente" data-args="[${c.id}]" title="Ver historial">
            <i class="fa-solid fa-eye"></i>
          </button>
        </td>
      </tr>
    `).join('');

    // Paginacion
    const pagDiv = document.getElementById('clientesPaginacion');
    if (pagDiv) {
      pagDiv.innerHTML = '';
      if (_clientesOffset > 0) {
        const btnPrev = document.createElement('button');
        btnPrev.className = 'btn btn-secondary btn-small';
        btnPrev.innerHTML = '<i class="fa-solid fa-chevron-left"></i> Anterior';
        btnPrev.onclick = () => { _clientesOffset -= _clientesLimit; cargarClientesAdmin(); };
        pagDiv.appendChild(btnPrev);
      }
      if ((_clientesOffset + _clientesLimit) < total) {
        const btnNext = document.createElement('button');
        btnNext.className = 'btn btn-secondary btn-small';
        btnNext.innerHTML = 'Siguiente <i class="fa-solid fa-chevron-right"></i>';
        btnNext.onclick = () => { _clientesOffset += _clientesLimit; cargarClientesAdmin(); };
        pagDiv.appendChild(btnNext);
      }
      if (total > 0) {
        const info = document.createElement('span');
        info.style.cssText = 'font-size:12px;color:var(--muted);align-self:center;';
        info.textContent = `${_clientesOffset + 1}–${Math.min(_clientesOffset + clientes.length, total)} de ${total}`;
        pagDiv.appendChild(info);
      }
    }
  } catch (e) {
    body.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:#e05;">${escapeHtml(e.message)}</td></tr>`;
  }
}

async function verDetalleCliente(id) {
  openModal('clienteDetalleModal');
  const body = document.getElementById('clienteDetalleBody');
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';

  try {
    const data = await apiFetch(`${API_BASE}/clientes.php?id=${id}`);
    if (!data.success) throw new Error(data.message || 'Error');
    const c = data.cliente;
    const pedidos = data.pedidos || [];
    const cots    = data.cotizaciones || [];

    const estLabels = { pendiente:'Pendiente', anticipo_pagado:'Anticipo pagado', pagado:'Pagado',
                        en_produccion:'En producción', listo:'Listo',
                        listo_para_entrega:'Listo para entrega', entregado:'Entregado', cancelado:'Cancelado' };
    const estColors = { pendiente:'var(--warn)', anticipo_pagado:'var(--warn)', pagado:'var(--accent)',
                        en_produccion:'#4a7c8b', listo:'#2a8e6e',
                        listo_para_entrega:'#1e7c5a', entregado:'var(--muted)', cancelado:'var(--danger)' };

    body.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">
        <div>
          <div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">Nombre</div>
          <div style="font-weight:700;">${escapeHtml(c.nombre)}</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">Correo</div>
          <div>${escapeHtml(c.correo)}</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">Teléfono</div>
          <div>${escapeHtml(c.telefono || '—')}</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">Ciudad</div>
          <div>${escapeHtml(c.ciudad || '—')}</div>
        </div>
        <div style="grid-column:span 2;">
          <div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">Dirección</div>
          <div>${escapeHtml(c.direccion || '—')}</div>
        </div>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:16px;margin-bottom:8px;">
        <h4 style="font-size:13px;color:var(--accent);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">
          <i class="fa-solid fa-box"></i> Pedidos (${pedidos.length})
        </h4>
        ${pedidos.length ? `<table style="width:100%;font-size:13px;">
          <thead><tr style="color:var(--muted);">
            <th style="text-align:left;padding:6px 8px;">Folio</th>
            <th style="text-align:left;padding:6px 8px;">Estado</th>
            <th style="text-align:right;padding:6px 8px;">Total</th>
            <th style="text-align:left;padding:6px 8px;">Fecha</th>
          </tr></thead>
          <tbody>
            ${pedidos.map(p => `<tr style="border-bottom:1px solid var(--border);">
              <td style="padding:8px;font-weight:600;">${escapeHtml(p.numero_pedido)}</td>
              <td style="padding:8px;"><span style="color:${estColors[p.estado]||'var(--muted)'};font-weight:600;font-size:12px;">${estLabels[p.estado]||p.estado}</span></td>
              <td style="padding:8px;text-align:right;font-weight:700;color:var(--accent);">${money(p.total)}</td>
              <td style="padding:8px;color:var(--muted);">${(p.fecha_creacion||'').substring(0,10)}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : '<p style="color:var(--muted);font-size:13px;">Sin pedidos registrados</p>'}
      </div>

      ${cots.length ? `<div style="border-top:1px solid var(--border);padding-top:16px;margin-top:8px;">
        <h4 style="font-size:13px;color:var(--accent);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">
          <i class="fa-solid fa-briefcase"></i> Cotizaciones (${cots.length})
        </h4>
        ${cots.map(co => `<div style="padding:8px;border-bottom:1px solid var(--border);font-size:13px;">
          <span style="font-weight:600;">${escapeHtml(co.numero_cotizacion)}</span>
          <span style="margin:0 8px;color:var(--muted);">${escapeHtml(co.modelo_mueble||'—')}</span>
          <span style="color:var(--accent);">${co.estado}</span>
          <span style="float:right;color:var(--muted);">${(co.fecha_creacion||'').substring(0,10)}</span>
        </div>`).join('')}
      </div>` : ''}
    `;
  } catch (e) {
    body.innerHTML = `<p style="color:#e05;padding:20px;">${escapeHtml(e.message)}</p>`;
  }
}

// ════════════════════════════════════════════════════════════════
// MÓDULO: OFERTAS & MARKETING
// ════════════════════════════════════════════════════════════════

async function cargarOfertasAdmin() {
  const body = document.getElementById('ofertasAdminBody');
  if (!body) return;

  body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--muted);">
    <i class="fa-solid fa-spinner fa-spin"></i> Cargando...
  </td></tr>`;

  try {
    const data = await apiFetch(`${API_BASE}/ofertas.php`);
    if (!data.success) throw new Error(data.message || 'Error');

    const ofertas = data.ofertas || [];

    if (!ofertas.length) {
      body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--muted);">
        Sin ofertas creadas. ¡Crea la primera!
      </td></tr>`;
      return;
    }

    const tipoLabels = { porcentaje: 'Porcentaje', monto_fijo: 'Monto fijo', envio_gratis: 'Envío gratis' };

    body.innerHTML = ofertas.map(o => {
      const vigente   = parseInt(o.vigente);
      const estadoBadge = o.activo == 1
        ? (vigente ? '<span class="status-badge status-completed">Activa</span>' : '<span class="status-badge status-pending">Inactiva (fuera de rango)</span>')
        : '<span class="status-badge status-cancelled">Desactivada</span>';

      const valorStr = o.tipo === 'porcentaje' ? `${o.valor}%`
                     : o.tipo === 'monto_fijo' ? money(o.valor)
                     : 'Sin costo envío';

      const vigenciaStr = (o.fecha_inicio || o.fecha_fin)
        ? `${o.fecha_inicio || '∞'} – ${o.fecha_fin || '∞'}`
        : 'Sin límite';

      const usosStr = o.usos_maximos
        ? `${o.usos_actuales} / ${o.usos_maximos}`
        : `${o.usos_actuales} (ilimitado)`;

      return `<tr>
        <td style="font-weight:600;">${escapeHtml(o.nombre)}</td>
        <td style="font-size:13px;color:var(--muted);">${tipoLabels[o.tipo] || o.tipo}</td>
        <td style="font-weight:700;color:var(--accent);">${valorStr}</td>
        <td>${o.codigo ? `<code style="background:var(--bg);padding:3px 8px;border-radius:5px;font-size:12px;color:var(--accent);border:1px solid var(--border);">${escapeHtml(o.codigo)}</code>` : '<span style="color:var(--muted);font-size:12px;">Sin código</span>'}</td>
        <td style="font-size:12px;color:var(--muted);">${vigenciaStr}</td>
        <td style="font-size:13px;">${usosStr}</td>
        <td>${estadoBadge}</td>
        <td>
          <button class="btn btn-secondary btn-small" data-call="abrirOfertaModal" data-args='["edit",${o.id}]' title="Editar">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-danger btn-small" data-call="eliminarOferta" data-args="[${o.id}]" title="Eliminar">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>`;
    }).join('');

  } catch (e) {
    body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:#e05;">${escapeHtml(e.message)}</td></tr>`;
  }
}

function actualizarValorLabel() {
  const tipo  = document.getElementById('of_tipo')?.value;
  const label = document.getElementById('of_valor_label');
  const input = document.getElementById('of_valor');
  if (!label || !input) return;
  if (tipo === 'porcentaje') { label.textContent = 'Porcentaje (%) *'; input.placeholder = '20'; input.disabled = false; }
  else if (tipo === 'monto_fijo') { label.textContent = 'Monto fijo ($) *'; input.placeholder = '500'; input.disabled = false; }
  else { label.textContent = 'Valor (no aplica)'; input.value = '0'; input.disabled = true; }
}

async function abrirOfertaModal(mode, id = null) {
  // Limpiar
  document.getElementById('of_id').value     = '';
  document.getElementById('of_mode').value   = mode;
  document.getElementById('of_nombre').value = '';
  document.getElementById('of_descripcion').value = '';
  document.getElementById('of_tipo').value   = 'porcentaje';
  document.getElementById('of_valor').value  = '';
  document.getElementById('of_codigo').value = '';
  document.getElementById('of_usos_max').value = '';
  document.getElementById('of_fecha_inicio').value = '';
  document.getElementById('of_fecha_fin').value = '';
  document.getElementById('of_activo').checked = true;
  document.getElementById('of_error').style.display = 'none';
  actualizarValorLabel();

  const title = document.getElementById('ofertaModalTitle');
  if (mode === 'create') {
    if (title) title.innerHTML = '<i class="fa-solid fa-tag"></i> Nueva Oferta';
  } else if (mode === 'edit' && id) {
    if (title) title.innerHTML = '<i class="fa-solid fa-pen"></i> Editar Oferta';
    try {
      const data = await apiFetch(`${API_BASE}/ofertas.php?id=${id}`);
      if (!data.success) throw new Error();
      const o = data.oferta;
      document.getElementById('of_id').value     = o.id;
      document.getElementById('of_nombre').value = o.nombre;
      document.getElementById('of_descripcion').value = o.descripcion || '';
      document.getElementById('of_tipo').value   = o.tipo;
      document.getElementById('of_valor').value  = o.valor;
      document.getElementById('of_codigo').value = o.codigo || '';
      document.getElementById('of_usos_max').value = o.usos_maximos || '';
      document.getElementById('of_fecha_inicio').value = o.fecha_inicio || '';
      document.getElementById('of_fecha_fin').value    = o.fecha_fin    || '';
      document.getElementById('of_activo').checked = o.activo == 1;
      actualizarValorLabel();
    } catch { showNotification('Error al cargar la oferta', 'error'); return; }
  }

  openModal('ofertaModal');
}

async function guardarOferta() {
  const errEl = document.getElementById('of_error');
  errEl.style.display = 'none';

  const mode = document.getElementById('of_mode').value;
  const id   = document.getElementById('of_id').value;
  const body = {
    nombre:       document.getElementById('of_nombre')?.value.trim(),
    descripcion:  document.getElementById('of_descripcion')?.value.trim(),
    tipo:         document.getElementById('of_tipo')?.value,
    valor:        document.getElementById('of_valor')?.value,
    codigo:       document.getElementById('of_codigo')?.value.trim().toUpperCase() || null,
    usos_maximos: document.getElementById('of_usos_max')?.value || null,
    fecha_inicio: document.getElementById('of_fecha_inicio')?.value || null,
    fecha_fin:    document.getElementById('of_fecha_fin')?.value || null,
    activo:       document.getElementById('of_activo')?.checked,
  };

  if (!body.nombre) { errEl.textContent = 'El nombre de la oferta es requerido.'; errEl.style.display = 'block'; return; }

  const btn = document.getElementById('of_btn_guardar');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

  try {
    let data;
    if (mode === 'create') {
      data = await apiFetch(`${API_BASE}/ofertas.php`, { method: 'POST', body });
    } else {
      data = await apiFetch(`${API_BASE}/ofertas.php?id=${id}`, { method: 'PUT', body });
    }

    if (!data.success) throw new Error(data.message || 'Error');

    closeModal('ofertaModal');
    showNotification(data.mensaje || 'Oferta guardada', 'success');
    cargarOfertasAdmin();

  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Oferta';
  }
}

async function eliminarOferta(id) {
  if (!confirm('¿Eliminar esta oferta? Esta acción no se puede deshacer.')) return;
  try {
    const data = await apiFetch(`${API_BASE}/ofertas.php?id=${id}`, { method: 'DELETE' });
    if (!data.success) throw new Error(data.message);
    showNotification('Oferta eliminada', 'success');
    cargarOfertasAdmin();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ── Cargar módulos al mostrar sus secciones ────────────────────
const _origShowSection = window.showSection;
window.showSection = function(section, ev) {
  _origShowSection?.(section, ev);
  if (section === 'clientes') { _clientesOffset = 0; cargarClientesAdmin(); }
  if (section === 'ofertas')  cargarOfertasAdmin();
};

// ═══════════════════════════════════════════════════════════
// SEGURIDAD — 2FA TOTP
// ═══════════════════════════════════════════════════════════

async function cargarEstado2FA() {
  const csrf = document.cookie.split(';').find(c => c.trim().startsWith('XSRF-TOKEN='));
  const csrfToken = csrf ? decodeURIComponent(csrf.split('=')[1]) : '';

  try {
    const res  = await fetch('/api/auth.php?action=verificar', {
      headers: { 'X-CSRF-Token': csrfToken }
    });
    const data = await res.json();

    const activo = data?.usuario?.totp_activo == 1;
    _renderEstado2FA(activo);
  } catch {
    _renderEstado2FA(null);
  }
}

function _renderEstado2FA(activo) {
  const icono  = document.getElementById('seg-2fa-icono');
  const texto  = document.getElementById('seg-2fa-estado-texto');
  const badge  = document.getElementById('seg-2fa-badge');
  const btnAct = document.getElementById('seg-btn-activar');
  const btnDes = document.getElementById('seg-btn-desactivar');

  if (activo === null) {
    texto.textContent = 'No se pudo cargar el estado.';
    return;
  }

  if (activo) {
    icono.innerHTML  = '<i class="fa-solid fa-shield-halved" style="color:#4caf50;"></i>';
    texto.textContent = 'El segundo factor está activo. Tu cuenta requiere un código TOTP al iniciar sesión.';
    badge.textContent = 'ACTIVO';
    badge.style.cssText += 'background:#1a3a1a;color:#4caf50;';
    btnAct.style.display = 'none';
    btnDes.style.display = '';
  } else {
    icono.innerHTML  = '<i class="fa-solid fa-lock-open" style="color:var(--muted);"></i>';
    texto.textContent = 'El segundo factor está desactivado. Tu cuenta solo requiere contraseña.';
    badge.textContent = 'INACTIVO';
    badge.style.cssText += 'background:#2a2a2a;color:var(--muted);';
    btnAct.style.display = '';
    btnDes.style.display = 'none';
  }

  // Ocultar flujo de setup si estaba abierto
  document.getElementById('seg-setup-flow').style.display = 'none';
}

async function iniciarSetup2FA() {
  const csrf = document.cookie.split(';').find(c => c.trim().startsWith('XSRF-TOKEN='));
  const csrfToken = csrf ? decodeURIComponent(csrf.split('=')[1]) : '';

  const btnAct = document.getElementById('seg-btn-activar');
  btnAct.disabled = true;
  btnAct.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';

  try {
    // Obtener token Firebase fresco para reautenticación
    const firebaseToken = await firebase.auth().currentUser?.getIdToken(true);
    if (!firebaseToken) throw new Error('No hay sesión activa en Firebase.');

    const res  = await fetch('/api/auth.php?action=2fa-setup', {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Authorization': 'Bearer ' + firebaseToken
      }
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Error al generar configuración 2FA.');

    // Mostrar secreto en texto
    document.getElementById('seg-secreto-texto').textContent = data.secreto;

    // Mostrar QR como imagen (sin dependencia de librería externa)
    const canvas = document.getElementById('seg-qr-canvas');
    canvas.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data='
      + encodeURIComponent(data.qr_url);
    canvas.style.display = '';

    // Limpiar campo de código y error
    document.getElementById('seg-codigo-input').value = '';
    document.getElementById('seg-setup-error').style.display = 'none';

    // Mostrar flujo
    document.getElementById('seg-setup-flow').style.display = '';
    document.getElementById('seg-codigo-input').focus();

  } catch(err) {
    alert('Error: ' + err.message);
  } finally {
    btnAct.disabled = false;
    btnAct.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Activar 2FA';
  }
}

async function confirmarActivar2FA() {
  const codigo = document.getElementById('seg-codigo-input').value.replace(/\D/g,'');
  const errBox = document.getElementById('seg-setup-error');

  if (codigo.length !== 6) {
    errBox.textContent = 'Ingresa los 6 dígitos del código.';
    errBox.style.display = '';
    return;
  }

  const csrf = document.cookie.split(';').find(c => c.trim().startsWith('XSRF-TOKEN='));
  const csrfToken = csrf ? decodeURIComponent(csrf.split('=')[1]) : '';
  const firebaseToken = await firebase.auth().currentUser?.getIdToken(false);

  try {
    const res  = await fetch('/api/auth.php?action=2fa-activar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Authorization': 'Bearer ' + firebaseToken
      },
      body: JSON.stringify({ codigo })
    });
    const data = await res.json();

    if (!data.success) {
      errBox.textContent = data.error || 'Código incorrecto. Verifica la hora de tu dispositivo.';
      errBox.style.display = '';
      document.getElementById('seg-codigo-input').value = '';
      document.getElementById('seg-codigo-input').focus();
      return;
    }

    errBox.style.display = 'none';
    document.getElementById('seg-setup-flow').style.display = 'none';
    _renderEstado2FA(true);

  } catch {
    errBox.textContent = 'Error de red. Intenta nuevamente.';
    errBox.style.display = '';
  }
}

function cancelarSetup2FA() {
  document.getElementById('seg-setup-flow').style.display = 'none';
  document.getElementById('seg-codigo-input').value = '';
  document.getElementById('seg-setup-error').style.display = 'none';
}

async function confirmarDesactivar2FA() {
  const ok = confirm(
    '¿Desactivar la verificación en dos pasos?\n\n' +
    'Tu cuenta quedará protegida solo por contraseña.'
  );
  if (!ok) return;

  const csrf = document.cookie.split(';').find(c => c.trim().startsWith('XSRF-TOKEN='));
  const csrfToken = csrf ? decodeURIComponent(csrf.split('=')[1]) : '';
  const firebaseToken = await firebase.auth().currentUser?.getIdToken(true);

  try {
    const res  = await fetch('/api/auth.php?action=2fa-desactivar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Authorization': 'Bearer ' + firebaseToken
      },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'No se pudo desactivar el 2FA.');
    _renderEstado2FA(false);
  } catch(err) {
    alert('Error: ' + err.message);
  }
}

// ── Exponer funciones para event-delegation.js (data-call) ────
window.verDetallePedidoAdmin  = verDetallePedidoAdmin;
window.marcarSaldoManualAdmin = marcarSaldoManualAdmin;
window.verDetalleCitaAdmin    = verDetalleCitaAdmin;
window.cargarPedidosAPI       = cargarPedidosAPI;
window.cambiarEstadoCotAdmin  = cambiarEstadoCotAdmin;
window.verDetalleCotAdmin     = verDetalleCotAdmin;
window.cargarCotizacionesAPI  = cargarCotizacionesAPI;
window.toggleBloqueoDia       = toggleBloqueoDia;
window.desbloquearDia         = desbloquearDia;
window.verDetalleCliente      = verDetalleCliente;
window.cargarClientesAdmin    = cargarClientesAdmin;
window.abrirOfertaModal       = abrirOfertaModal;
window.eliminarOferta         = eliminarOferta;
window.actualizarValorLabel   = actualizarValorLabel;
window.cargarEstado2FA        = cargarEstado2FA;
window.iniciarSetup2FA        = iniciarSetup2FA;
window.confirmarActivar2FA    = confirmarActivar2FA;
window.cancelarSetup2FA       = cancelarSetup2FA;
window.confirmarDesactivar2FA = confirmarDesactivar2FA;
