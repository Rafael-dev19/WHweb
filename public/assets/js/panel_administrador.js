/* =========================
       ICONOS LUCIDE (auto-refresh)
       El panel reemplaza secciones enteras con innerHTML en decenas de
       puntos; en vez de llamar lucide.createIcons() manualmente en cada
       uno, un MutationObserver sobre <body> reprograma un refresh cada
       vez que el DOM cambia (debounced).
    ========================= */
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
    // Notificaciones guardadas POR CUENTA: antes jefe/ventas (y taller/diseño)
    // compartían el mismo almacén del navegador y en un equipo usado por varias
    // personas se mezclaban los avisos de todos.
    const _NOTIF_UID          = String(window.WH_UID || 'x');
    const NOTIF_KEY_ADM        = 'wh_adm_notifs_' + _NOTIF_UID;
    const NOTIF_UNREAD_KEY_ADM = 'wh_adm_notifs_unread_' + _NOTIF_UID;
    const NOTIF_SEEN_KEY_ADM   = 'wh_adm_notifs_seen_' + _NOTIF_UID;
    try { ['wh_adm_notifs', 'wh_adm_notifs_unread', 'wh_adm_notifs_seen'].forEach(k => localStorage.removeItem(k)); } catch (e) {}

    const NOTIF_ICONS_ADM = {
      pedido:     { icon:'box',           color:'var(--accent)' },
      cita:       { icon:'calendar',      color:'#4a7c8b' },
      cotizacion: { icon:'briefcase',     color:'#4a8b5a' },
      pago:       { icon:'credit-card',   color:'#7c5c8b' },
      sistema:    { icon:'settings',      color:'var(--muted2)' },
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
        <i data-lucide="${cfg.icon}"></i>
      </div>`;
    }
    function renderNotifPanel(){
      const notifBody = document.getElementById('notifBody');
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
        const res = await fetch('/api/notificaciones.php', { credentials:'same-origin' });
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

    // Iniciales de nombre y apellido (no del rol) para el avatar del panel.
    function _iniciales(nombre) {
      const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
      if (partes.length === 0) return '?';
      if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }

    async function cargarNombreAdmin() {
      try {
        const data = await apiFetch(`${API_BASE}/auth.php?action=perfil`);
        if (data.success && data.usuario) {
          const nombre = data.usuario.nombre_completo || data.usuario.correo || 'Usuario';
          const el = document.getElementById('userNombreHeader');
          if (el) el.textContent = nombre;
          const avatar = document.getElementById('userAvatar');
          if (avatar) avatar.textContent = _iniciales(data.usuario.nombre_completo);
        }
      } catch (e) { /* silencioso */ }
    }

    document.addEventListener('DOMContentLoaded', () => {
      cargarNombreAdmin();
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

      if(section === 'citas')        cargarCitasCalendarioAPI();
      if(section === 'catalogo')     cargarProductosAPI().then(() => renderCatalogo());
      if(section === 'reportes')     { cargarReportesAPI(); }
      if(section === 'dashboard')    { setTimeout(refreshKPIsFromAPI, 100); cargarCitasCalendarioAPI(); }
      if(section === 'pedidos')      cargarPedidosAPI();
      if(section === 'cotizaciones') cargarCotizacionesAPI();
      if(section === 'empleados')    cargarEmpleadosAPI();
      if(section === 'financiero')   cargarFinanciero();
      if(section === 'capacidad')  cargarCapacidad();
      refreshKPIs();
    }

    /* =========================
       MODALES
    ========================= */
    function openModal(id){
      $('#'+id).classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    function closeModal(id){
      $('#'+id).classList.remove('active');
      if (!document.querySelector('.modal.active')) document.body.style.overflow = '';
    }

    $$('.modal').forEach(modal => {
      modal.addEventListener('click', function(e){
        if(e.target === this){
          this.classList.remove('active');
          if (!document.querySelector('.modal.active')) document.body.style.overflow = '';
        }
      });
    });

    /* =========================
       NOTIFICACIONES
    ========================= */
    function showNotification(message, type='info'){
      document.querySelectorAll('.notification').forEach(n => n.remove());
      const icons = {
        success: 'circle-check',
        error:   'circle-x',
        warning: 'triangle-alert',
        info:    'info',
      };
      const notif = document.createElement('div');
      notif.className = `notification ${type}`;
      // Si el mensaje ya trae un <i> no agregar ícono extra
      const hasIcon = message.includes('<i ');
      notif.innerHTML = hasIcon
        ? message
        : `<i data-lucide="${icons[type] || 'info'}"></i>${message}`;
      document.body.appendChild(notif);
      window.lucide?.createIcons();
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
        showNotification('<i data-lucide="check"></i> Elemento eliminado', 'success');
      }
    }

    async function logout(){
      if(!confirm('¿Cerrar sesión?')) return;
      // SECURITY: set flag first so login.js won't auto-redirect
      sessionStorage.setItem('wh_just_logged_out', '1');
      sessionStorage.removeItem('wh_firebase_token');
      sessionStorage.removeItem('wh_usuario');
      if (typeof bajaPushDispositivo === 'function') await bajaPushDispositivo();
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
    let _citasCache           = [];
    let _pedidosCalCache      = [];
    let _cotizacionesCalCache = [];
    let _calAdmLastLoaded     = 0;

    // Color fijo por id (no por estado) — así dos pedidos distintos que se
    // cruzan en el calendario se distinguen aunque tengan el mismo estado.
    const _CAL_PALETTE = ['#e07a5f','#3d5a80','#81b29a','#9b5de5','#00bbf9','#f15bb5','#06d6a0','#ef476f','#118ab2','#ffb703','#8338ec','#43aa8b'];
    function colorForId(id) {
      const s = String(id);
      let hash = 0;
      for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
      return _CAL_PALETTE[hash % _CAL_PALETTE.length];
    }

    function _todosEventos() {
      return [..._citasCache, ..._pedidosCalCache, ..._cotizacionesCalCache];
    }

    async function cargarCitasCalendarioAPI() {
      try {
        const hoy  = new Date();
        const anio = hoy.getFullYear();
        const desde = `${anio}-01-01`;
        const hasta  = `${anio + 1}-12-31`;

        // Citas
        const dataCitas = await apiFetch(`${API_BASE}/citas.php?limit=500&fecha_desde=${desde}&fecha_hasta=${hasta}`);
        if (dataCitas.success && dataCitas.citas) {
          _citasCache = dataCitas.citas.map(c => ({
            id:         c.numero_cita || c.id,
            cliente:    c.nombre_cliente || '',
            date:       (c.fecha_cita || '').substring(0, 10),
            time:       c.rango_horario || 'Por confirmar',
            tipo:       c.tipo || 'medicion',
            eventoTipo: 'cita',
            estado:     c.estado || 'nueva',
            datos:      c,
          }));
        }

        // Pedidos (fecha_estimada) — un color fijo por pedido, repetido cada
        // día desde que se creó hasta la fecha de entrega, para que se note
        // a simple vista cuando varios pedidos se cruzan en las mismas fechas.
        const dataPed = await apiFetch(`${API_BASE}/pedidos.php?limit=500&fecha_desde=${desde}&fecha_hasta=${hasta}`);
        if (dataPed.success && dataPed.pedidos) {
          _pedidosCalCache = [];
          dataPed.pedidos.filter(p => p.fecha_estimada).forEach(p => {
            const color  = colorForId(p.id);
            const inicio = new Date(((p.fecha_creacion || p.fecha_estimada).substring(0, 10)) + 'T00:00:00');
            const fin    = new Date(p.fecha_estimada.substring(0, 10) + 'T00:00:00');
            const dias   = Math.max(0, Math.min(60, Math.round((fin - inicio) / 86400000)));
            for (let i = 0; i <= dias; i++) {
              const d = new Date(inicio); d.setDate(d.getDate() + i);
              _pedidosCalCache.push({
                id:         p.numero_pedido || p.id,
                cliente:    p.nombre_cliente || '',
                date:       `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
                time:       p.tipo_entrega === 'envio' ? '🚚 Envío' : '🏪 Recoger',
                tipo:       'pedido',
                eventoTipo: 'pedido',
                estado:     p.estado || 'pendiente',
                color,
                datos:      p,
              });
            }
          });
        }

        // Cotizaciones (fecha_creacion como fecha de la cot)
        const dataCot = await apiFetch(`${API_BASE}/cotizaciones.php?limit=200`);
        if (dataCot.success && dataCot.cotizaciones) {
          _cotizacionesCalCache = dataCot.cotizaciones
            .filter(c => c.fecha_creacion)
            .map(c => ({
              id:         c.numero_cotizacion || c.id,
              cliente:    c.nombre_cliente || '',
              date:       (c.fecha_creacion || '').substring(0, 10),
              time:       c.tipo_mueble || 'Solicitud',
              tipo:       'cot',
              eventoTipo: 'cotizacion',
              estado:     c.estado || 'nueva',
              color:      colorForId(c.id),
              datos:      c,
            }));
        }
      } catch(e) {
        console.warn('Error cargando agenda:', e);
      }
      _calAdmLastLoaded = Date.now();
      renderCalendar();
      renderCitasTable();
    }

    async function refrescarCalendarioAdmin(silencioso = false) {
      const btn = document.getElementById('admCalRefreshBtn');
      if (btn && !silencioso) btn.innerHTML = '<i class="wh-icon-spin" data-lucide="refresh-cw"></i>';
      await cargarCitasCalendarioAPI();
      if (btn) btn.innerHTML = '<i data-lucide="refresh-cw"></i>';
    }
    window.refrescarCalendarioAdmin = refrescarCalendarioAdmin;

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

    function makeDayCell(y, m, d, muted, eventos){
      const dateObj = new Date(y, m, d);
      const yy = dateObj.getFullYear();
      const mm = dateObj.getMonth();
      const dd = dateObj.getDate();
      const iso = `${yy}-${pad(mm+1)}-${pad(dd)}`;
      const _t = new Date();
      const todayISO = `${_t.getFullYear()}-${pad(_t.getMonth()+1)}-${pad(_t.getDate())}`;
      const isToday  = iso === todayISO;

      const dayEvts = eventos.filter(e => e.date === iso);

      const cell = document.createElement('div');
      cell.className = 'cal-day' + (muted ? ' muted' : '') + (isToday ? ' today' : '');
      cell.setAttribute('data-date', iso);
      cell.onclick = () => selectDay(iso);

      const chips = dayEvts.slice(0, 2).map(e => {
        const chipClass = e.eventoTipo || e.tipo;
        const icon = e.eventoTipo === 'pedido' ? '📦' : e.eventoTipo === 'cotizacion' ? '📋' : '📅';
        const estilo = e.color ? ` style="background:${e.color}2a;color:${e.color};"` : '';
        return `<div class="chip ${chipClass}"${estilo}>${icon} ${escapeHtml(e.time)} • ${escapeHtml(e.cliente)}</div>`;
      }).join('');

      const dots = dayEvts.slice(0, 4).map(e => {
        const estilo = e.color ? ` style="background:${e.color};"` : '';
        return `<span class="dot ${e.eventoTipo || e.tipo}"${estilo}></span>`;
      }).join('');

      cell.innerHTML = `
        <div class="num">${dd}</div>
        <div class="cal-chip">${chips}</div>
        <div class="cal-dots">${dots}</div>
      `;
      return cell;
    }

    let _admSelectedDate = null;

    function selectDay(iso){
      _admSelectedDate = iso;
      $$('.cal-day').forEach(x => x.style.outline = 'none');
      const cell = $(`.cal-day[data-date="${iso}"]`);
      if(cell) cell.style.outline = `2px solid ${getComputedStyle(document.documentElement).getPropertyValue('--accent')}`;

      const eventos = _todosEventos().filter(e => e.date === iso).sort((a,b)=>a.time.localeCompare(b.time));
      const headLabel = $('#dayHeadLabel');
      const list = $('#dayList');

      if(headLabel) headLabel.textContent = `Agenda del ${fmtDMY(iso)}`;

      // Mostrar botón Ruta cuando hay pedidos en_camino_instalacion o citas activas
      const rutaBtn = $('#admRutaDiaBtn');
      if (rutaBtn) {
        const tieneParadas = eventos.some(e =>
          (e.eventoTipo === 'pedido' && e.datos?.tipo_entrega === 'envio' && e.datos?.estado === 'en_camino_instalacion') ||
          (e.eventoTipo === 'cita'   && !['cancelada'].includes(e.datos?.estado || ''))
        );
        rutaBtn.style.display = tieneParadas ? '' : 'none';
      }
      if(!list) return;
      list.innerHTML = '';

      if(!eventos.length){
        list.innerHTML = `
          <div class="cal-item">
            <div class="t">Sin eventos</div>
            <div class="m">No hay citas, pedidos ni cotizaciones para este día.</div>
          </div>
        `;
        return;
      }

      eventos.forEach(e => {
        const el = document.createElement('div');
        el.className = 'cal-item';

        if (e.eventoTipo === 'pedido') {
          const estadoLabels = ESTADO_PEDIDO_LABELS;
          const dbId = e.datos?.id || '';
          el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
              <div>
                <div class="t">${e.color?`<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${e.color};margin-right:3px;"></span>`:''}📦 ${escapeHtml(e.cliente)} <span style="background:#c9a96e20;color:var(--accent);border-radius:8px;padding:1px 7px;font-size:10px;font-weight:700;">Pedido</span></div>
                <div class="m">${escapeHtml(e.time)} • ${estadoLabels[e.estado]||e.estado} • ${escapeHtml(e.id)}</div>
              </div>
              ${dbId ? `<button data-call="verDetallePedidoAdmin" data-args="[${dbId}]" class="btn btn-primary btn-small" style="flex-shrink:0;white-space:nowrap;"><i data-lucide='eye'></i> Ver</button>` : ''}
            </div>`;
        } else if (e.eventoTipo === 'cotizacion') {
          const cotEstados = {nueva:'Nueva',en_revision:'En revisión',cotizada:'Cotizada',aceptada:'Aceptada',rechazada:'Rechazada',cancelada:'Cancelada'};
          const dbId = e.datos?.id || '';
          el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
              <div>
                <div class="t">${e.color?`<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${e.color};margin-right:3px;"></span>`:''}📋 ${escapeHtml(e.cliente)} <span style="background:#4a8b5a20;color:#4a8b5a;border-radius:8px;padding:1px 7px;font-size:10px;font-weight:700;">Cotización</span></div>
                <div class="m">${escapeHtml(e.time)} • ${cotEstados[e.estado]||e.estado} • ${escapeHtml(e.id)}</div>
              </div>
              ${dbId ? `<button data-call="verDetalleCotAdmin" data-args="[${dbId}]" class="btn btn-primary btn-small" style="flex-shrink:0;white-space:nowrap;"><i data-lucide='eye'></i> Ver</button>` : ''}
            </div>`;
        } else {
          // Cita
          const estadoTexto = {'nueva':'Nueva','confirmada':'Confirmada','completada':'Completada','cancelada':'Cancelada'}[e.estado] || e.estado;
          const tipoTexto   = {'medicion':'Medición','instalacion':'Instalación','otro':'Otro'}[e.tipo] || e.tipo;
          const dbId = e.datos?.id || '';
          const cid = e.datos?.cliente_id || '';
          el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
              <div>
                <div class="t">📅 ${escapeHtml(e.time)} • ${escapeHtml(e.cliente)}${cid ? ` <span style="background:#2d6a3f20;color:#2d6a3f;border-radius:8px;padding:1px 7px;font-size:10px;font-weight:700;"><i data-lucide="user-check"></i> #${cid}</span>` : ''}</div>
                <div class="m">${tipoTexto} • ${estadoTexto} • ${escapeHtml(e.id)}</div>
              </div>
              ${dbId ? `<button data-call="verDetalleCitaAdmin" data-args="[${dbId}]" class="btn btn-primary btn-small" style="flex-shrink:0;white-space:nowrap;"><i data-lucide='eye'></i> Ver</button>` : ''}
            </div>`;
        }
        list.appendChild(el);
      });
    }

    function renderCalendar(){
      const grid = $('#calendarGrid');
      const title = $('#calTitle');
      if(!grid || !title) return;

      title.textContent = `${monthName(calMonth)} ${calYear}`;

      const eventos = _todosEventos();
      const monthStr = pad(calMonth+1);

      const first = new Date(calYear, calMonth, 1);
      const last = new Date(calYear, calMonth+1, 0);
      const daysInMonth = last.getDate();
      const startDow = (first.getDay() + 6) % 7;

      grid.innerHTML = '';

      const prevLast = new Date(calYear, calMonth, 0).getDate();
      for(let i=0;i<startDow;i++){
        const d = prevLast - (startDow - 1 - i);
        const cell = makeDayCell(calYear, calMonth-1, d, true, eventos);
        grid.appendChild(cell);
      }

      for(let d=1; d<=daysInMonth; d++){
        const cell = makeDayCell(calYear, calMonth, d, false, eventos);
        grid.appendChild(cell);
      }

      while(grid.children.length < 42){
        const idx = grid.children.length - (startDow + daysInMonth);
        const d = idx + 1;
        const cell = makeDayCell(calYear, calMonth+1, d, true, eventos);
        grid.appendChild(cell);
      }

      const nextList = $('#nextList');
      if(nextList){
        const hoy = new Date().toISOString().substring(0,10);
        const next = eventos
          .filter(e => e.date >= hoy)
          .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time))
          .slice(0, 8);

        const iconoTipo = { cita:'📅', pedido:'📦', cotizacion:'📋' };
        const labelTipo = { cita:'Cita', pedido:'Pedido', cotizacion:'Cotización' };

        nextList.innerHTML = '';
        next.forEach(e => {
          const el = document.createElement('div');
          el.className = 'cal-item';
          const esHoy = e.date === hoy;
          const icono = iconoTipo[e.eventoTipo] || '📅';
          const label = labelTipo[e.eventoTipo] || 'Evento';
          el.innerHTML = `
            <div class="t">${icono} ${escapeHtml(e.cliente)}${esHoy ? ' <span style="color:#2E7D32;font-size:11px;">● HOY</span>' : ''}</div>
            <div class="m">${fmtDMY(e.date)} • ${escapeHtml(e.time)} • ${label}</div>
          `;
          nextList.appendChild(el);
        });
        if(!next.length){
          nextList.innerHTML = `<div class="cal-item"><div class="t">Sin eventos</div><div class="m">No hay eventos próximos.</div></div>`;
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
            <td>${cid ? `<span class="status-badge status-active" style="font-size:10px;padding:2px 8px;"><i data-lucide="user-check"></i> #${cid}</span>` : '<span style="color:var(--muted);font-size:11px;">—</span>'}</td>
            <td>${fmtDMY(c.date)}</td>
            <td>${escapeHtml(c.time)}</td>
            <td>${tipoMap[c.tipo] || c.tipo}</td>
            <td><span class="status-badge ${est.cls}">${est.label}</span></td>
            <td>
              ${dbId ? `<button class="btn btn-primary btn-small" data-call="verDetalleCitaAdmin" data-args="[${dbId}]" title="Ver detalle"><i data-lucide="eye"></i> Ver</button>` : '—'}
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
          categoria:'Muebles de baño',
          badge:'Nuevo',
          estado:'activo',
          precio:8500,
          stock:15,
          descCorta:'Diseño minimalista con acabados premium.',
          specsResumen:{
            dimensiones:'120cm x 50cm x 85cm',
            material:'Madera de encino + acabado mate',
            acabado:'', /* <i data-lucide="circle-check"></i> FIX */
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
          categoria:'Muebles de baño',
          badge:'Popular',
          estado:'activo',
          precio:12800,
          stock:8,
          descCorta:'Estilo clásico con detalle artesanal.',
          specsResumen:{
            dimensiones:'140cm x 55cm x 90cm',
            material:'Madera de cedro + barniz satinado',
            acabado:'', /* <i data-lucide="circle-check"></i> FIX */
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
        if (catalogCards) catalogCards.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted);"><i class="wh-icon-spin" data-lucide="loader-circle"></i> Cargando productos...</div>';
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
          catalogCards.innerHTML = '<div style="grid-column:1/-1;color:var(--muted);padding:20px;">No hay productos con esos filtros.</div>';
          return;
        }
        list.forEach(p => {
          const imgHTML = p.imagen_principal
            ? `<img src="${escapeHtml(p.imagen_principal)}" alt="${escapeHtml(p.nombre)}" style="width:100%;height:140px;object-fit:cover;border-radius:8px 8px 0 0;">`
            : `<div style="width:100%;height:140px;background:var(--chip);border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:40px;"><i data-lucide="trees"></i></div>`;
          const badgeHTML = (p.etiqueta || p.badge)
            ? `<span style="background:#8b7355;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;position:absolute;top:10px;right:10px;">${escapeHtml(p.etiqueta || p.badge)}</span>`
            : '';
          const card = document.createElement('div');
          card.className = 'cat-card';
          card.innerHTML = `
            <div style="position:relative;">${imgHTML}${badgeHTML}</div>
            <div class="cat-content">
              <div class="cat-title">${escapeHtml(p.nombre)} <span style="color:var(--muted);font-size:12px;">(${escapeHtml(p.categoria || '')})</span></div>
              <div class="cat-desc" style="color: var(--muted);font-size:13px;margin:6px 0;">${escapeHtml((p.descripcion || p.descLarga || '').substring(0, 80))}${(p.descripcion||'').length > 80 ? '...' : ''}</div>
              <div class="cat-footer">
                <div class="cat-price">${precioCatalogoTexto(p)}</div>
                <div class="cat-actions">
                  <button class="btn btn-secondary btn-small btn-ver-prod">Ver</button>
                  <button class="btn btn-secondary btn-small btn-edit-prod" title="Editar"><i data-lucide="pen"></i></button>
                  <button class="btn btn-danger btn-small btn-del-prod" title="Eliminar"><i data-lucide="trash-2"></i></button>
                </div>
              </div>
              <div style="margin-top:8px;font-size:11px;color:#666;">
                ID: <b style="color: var(--muted);">${escapeHtml(String(p.id))}</b> •
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
          body.innerHTML = '<tr><td colspan="6" style="color:var(--muted);text-align:center;">No hay productos con esos filtros.</td></tr>';
          return;
        }
        list.forEach(p => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${escapeHtml(String(p.id))}</td>
            <td>${escapeHtml(p.nombre)}</td>
            <td>${escapeHtml(p.categoria || '—')}</td>
            <td style="color:var(--accent);font-weight:900;">${precioCatalogoTexto(p)}</td>
            <td><span class="status-badge ${p.estado === 'activo' ? 'status-completed' : 'status-disabled'}">${p.estado === 'activo' ? 'Activo' : 'Inactivo'}</span></td>
            <td>
              <button class="btn btn-secondary btn-small btn-ver-prod">Ver</button>
              <button class="btn btn-secondary btn-small btn-edit-prod" title="Editar"><i data-lucide="pen"></i></button>
              <button class="btn btn-danger btn-small btn-del-prod" title="Eliminar"><i data-lucide="trash-2"></i></button>
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
       'p_imgs_urls'].forEach(fieldId => {
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
              medidas: detalle.producto.medidas || [],
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

        renderFilasMedidas(p.medidas || []);
        renderFilasSpecs(p.especificaciones || []);

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
        // Plantilla del catálogo 2026: los mismos anchos y el mismo paquete
        // base que casi todos los modelos — solo se ajustan precios.
        renderFilasMedidas([60, 70, 80, 90, 100, 120].map(a => ({ ancho_cm: a, precio: '' })));
        renderFilasSpecs([
          { clave: 'Estilo', valor: '' },
          { clave: 'Mueble', valor: 'MDF Arauco 15 mm' },
          { clave: 'Ovalín', valor: 'Cerámica (a elegir)' },
          { clave: 'Monomando', valor: 'A elegir' },
          { clave: 'Incluye', valor: 'Céspol y contracanasta' },
          { clave: 'Herrajes', valor: 'Cierre lento' },
        ]);
      }

      openModal('productoModal');
    }

    // ── Filas editables del modal de producto (anchos y "qué incluye") ──
    function renderFilasMedidas(medidas) {
      const cont = document.getElementById('p_medidas');
      if (!cont) return;
      cont.innerHTML = '';
      medidas.forEach(m => agregarFilaMedida(m.ancho_cm, m.precio));
      actualizarPrecioUnico();
    }
    function agregarFilaMedida(ancho = '', precio = '') {
      const cont = document.getElementById('p_medidas');
      if (!cont) return;
      const fila = document.createElement('div');
      fila.className = 'prod-fila';
      fila.innerHTML = `
        <input type="number" class="form-input" data-ancho min="20" step="1" placeholder="Ancho (cm)" value="${escapeHtml(String(ancho))}" inputmode="numeric">
        <input type="number" class="form-input" data-precio min="1" step="0.01" placeholder="Precio $" value="${escapeHtml(String(precio))}" inputmode="decimal">
        <button type="button" class="btn btn-secondary" title="Quitar ancho" aria-label="Quitar ancho"><i data-lucide="x"></i></button>`;
      fila.querySelector('button').addEventListener('click', () => { fila.remove(); actualizarPrecioUnico(); });
      cont.appendChild(fila);
      actualizarPrecioUnico();
    }
    function actualizarPrecioUnico() {
      const hay = document.querySelectorAll('#p_medidas .prod-fila').length > 0;
      const wrap = document.getElementById('p_precio_wrap');
      if (wrap) wrap.style.display = hay ? 'none' : '';
    }
    function leerFilasMedidas() {
      const out = [];
      for (const f of document.querySelectorAll('#p_medidas .prod-fila')) {
        const ancho = parseInt(f.querySelector('[data-ancho]').value, 10);
        const precio = parseFloat(f.querySelector('[data-precio]').value);
        if (!ancho && !precio) continue;
        if (!ancho || !(precio > 0)) { showNotification('Cada ancho necesita su precio (o quita la fila vacía)', 'error'); return null; }
        out.push({ ancho_cm: ancho, precio });
      }
      return out;
    }
    function renderFilasSpecs(specs) {
      const cont = document.getElementById('p_specs');
      if (!cont) return;
      cont.innerHTML = '';
      specs.forEach(sp => agregarFilaSpec(sp.clave, sp.valor));
    }
    function agregarFilaSpec(clave = '', valor = '') {
      const cont = document.getElementById('p_specs');
      if (!cont) return;
      const fila = document.createElement('div');
      fila.className = 'prod-fila prod-fila--spec';
      fila.innerHTML = `
        <input type="text" class="form-input" data-k placeholder="ej. Ovalín" value="${escapeHtml(clave)}">
        <input type="text" class="form-input" data-v placeholder="ej. Cerámica (a elegir)" value="${escapeHtml(valor)}">
        <button type="button" class="btn btn-secondary" title="Quitar" aria-label="Quitar"><i data-lucide="x"></i></button>`;
      fila.querySelector('button').addEventListener('click', () => fila.remove());
      cont.appendChild(fila);
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
      const medidas = leerFilasMedidas();
      if (medidas === null) return;
      if (!medidas.length && precio <= 0) { showNotification('Pon el precio de cada ancho (o un precio único si no maneja anchos)', 'error'); return; }
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

      const especificaciones = [...document.querySelectorAll('#p_specs .prod-fila')]
        .map(f => ({ clave: f.querySelector('[data-k]').value.trim(), valor: f.querySelector('[data-v]').value.trim() }))
        .filter(x => x.clave && x.valor);

      const apiPayload = {
        nombre,
        descripcion:  descLarga,
        precio_base:  medidas.length ? Math.min(...medidas.map(m => m.precio)) : precio,
        medidas,
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
        if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerHTML = '<i data-lucide="save"></i> Guardar'; }
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
          <img src="${img.src}" style="width:100%;height:80px;object-fit:cover;border-radius:8px;border:2px solid ${i===0?'#8b7355':'var(--border)'};"
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
    // "Desde $5,800 · 60–120 cm" cuando el modelo maneja precio por ancho.
    function precioCatalogoTexto(p) {
      const med = p.medidas || [];
      if (!med.length) return money(p.precio || p.precio_base || 0);
      const rango = med.length > 1 ? `${med[0].ancho_cm}–${med[med.length - 1].ancho_cm} cm` : `${med[0].ancho_cm} cm`;
      return `Desde ${money(Math.min(...med.map(m => m.precio)))} <span style="color:var(--muted);font-size:11px;font-weight:600;">· ${rango}</span>`;
    }

    async function openProductoDetalle(id){
      let p = getProductos().find(x => String(x.id) === String(id));
      if(!p){ showNotification('No se encontró el producto', 'error'); return; }
      // La lista no trae las especificaciones: pedir el detalle completo.
      try {
        const d = await apiFetch(`${API_BASE}/productos.php?id=${id}`);
        if (d.success && d.producto) p = { ...p, especificaciones: d.producto.especificaciones || [], medidas: d.producto.medidas || p.medidas || [] };
      } catch (e) { /* se muestra con lo que haya */ }
      _detailCurrentId = id;

      $('#detalleModalTitle').textContent = `Detalle: ${p.nombre}`;

      const specs      = p.especificaciones || p.specs || [];
      const specsHTML  = specs.length
        ? specs.map(s => `<div class="kv"><span>${escapeHtml(s.clave || s.label || '')}</span><b>${escapeHtml(s.valor || s.value || '')}</b></div>`).join('')
        : `<div class="kv"><span>Sin especificaciones</span><b>—</b></div>`;

      const imgUrl     = p.imagen_principal || (p.imgs && p.imgs[0]) || '';
      const imgHTML    = imgUrl
        ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(p.nombre)}" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;margin-bottom:12px;">`
        : `<div style="width:100%;height:120px;background:var(--chip);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:36px;margin-bottom:12px;"><i data-lucide="trees"></i></div>`;

      $('#detalleBody').innerHTML = `
        <div class="detail-wrap">
          <div class="detail-card">
            <div class="detail-media">${imgHTML}</div>
            <div class="detail-body">
              <div class="detail-title">${escapeHtml(p.nombre)}</div>
              <div class="detail-meta" style="color:var(--accent);margin:4px 0;">
                ${escapeHtml(p.categoria || '')}
                ${p.etiqueta || p.badge ? ` • <span style="background:#8b7355;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">${escapeHtml(p.etiqueta || p.badge)}</span>` : ''}
              </div>
              <div class="detail-price">${precioCatalogoTexto(p)}</div>
              <div class="detail-desc" style="margin-top:10px;color:var(--muted2);font-size:14px;line-height:1.6;">${escapeHtml(p.descripcion || p.descLarga || 'Sin descripción')}</div>
            </div>
          </div>
          <div class="detail-side">
            <h4>Ficha técnica</h4>
            <div class="kv"><span>ID en BD</span><b>${escapeHtml(String(p.id))}</b></div>
            <div class="kv"><span>Categoría</span><b>${escapeHtml(p.categoria || '—')}</b></div>
            <div class="kv"><span>Estado</span><b><span class="status-badge ${p.estado === 'activo' ? 'status-completed' : 'status-disabled'}">${p.estado || 'inactivo'}</span></b></div>
            ${(p.medidas || []).length
              ? `<h4 style="margin-top:14px;">Precio por ancho (sin instalación)</h4>${p.medidas.map(m => `<div class="kv"><span>${m.ancho_cm} cm</span><b style="color:var(--accent);">${money(m.precio)}</b></div>`).join('')}`
              : `<div class="kv"><span>Precio</span><b style="color:var(--accent);">${money(p.precio || p.precio_base || 0)}</b></div>`}
            <div style="margin-top:14px;"></div>
            <h4>Qué incluye el paquete</h4>
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

      showNotification('<i data-lucide="check"></i> Datos de prueba generados para reportes', 'success');
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
      showNotification('<i class="wh-icon-spin" data-lucide="loader-circle"></i> Generando reporte...', 'info');
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

        showNotification('<i data-lucide="check"></i> CSV exportado correctamente (ábrelo con Excel)', 'success');
      } catch(e) {
        showNotification('Error al generar reporte: ' + e.message, 'error');
      }
    }
    async function exportReportXLSX(){
      showNotification('<i class="wh-icon-spin" data-lucide="loader-circle"></i> Generando Excel...', 'info');
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
        showNotification('<i data-lucide="check"></i> Excel (.xlsx) exportado correctamente', 'success');
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
          showNotification('<i data-lucide="file-text"></i> PDF generado correctamente', 'success');
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
      // El dashboard (y estas tarjetas) solo existe para jefe — administrador
      // no lo tiene, así que estos elementos no están en el DOM para él.
      if (!window.WH_ES_JEFE) return;

      const productos = getProductos();
      $('#kpiProductos').textContent = String(productos.length);

      const low = productos.filter(p => Number(p.stock||0) <= 5).length;
      $('#kpiStockLow').innerHTML = low ? `<i data-lucide="triangle-alert"></i> ${low} bajo stock` : 'Stock OK';

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
        const bh = Math.max(0, (h-pad*2) * (v/max));
        if (bh < 1) return;
        const x = pad + i*bw + (bw*0.18);
        const y = h - pad - bh;
        const rw = Math.max(2, bw*0.64);
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
      const rr = Math.max(0, Math.min(r, w/2, h/2));
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

        // tipo=ingresos es Reportes Avanzados (exclusivo de jefe, ver reportes.php) —
        // no pedirlo para administrador/empleado/disenador, el servidor lo rechaza
        // con 403 de cualquier forma y solo ensucia la consola sin dar nada útil.
        const [ingResult, resResult] = await Promise.allSettled([
          window.WH_ES_JEFE
            ? apiFetch(`${API_BASE}/reportes.php?tipo=ingresos&agrupacion=dia&desde=${hace7}&hasta=${hoy}`)
            : Promise.resolve({ success: false }),
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
            if (['pendiente','anticipo_pagado','pagado'].includes(e.estado))                                                                        pendiente += n;
            else if (['listo_para_produccion','en_produccion','alistando_pedido','en_camino_instalacion'].includes(e.estado))                       proceso   += n;
            else if (e.estado === 'finalizado')                                                                                                     completo  += n;
          });
        }
        drawDonut('chartEstados', [pendiente, proceso, completo], ['Pendiente','En Proceso','Completado']);
        const meta2 = document.getElementById('chartEstadosMeta');
        if (meta2) meta2.textContent = `Pendientes: ${pendiente} · Proceso: ${proceso} · Completados: ${completo}`;

      } catch(e) {
        console.warn('Error en dashboard charts:', e);
      }
    }

    async function cargarFinanciero() {
      const fmt = n => '$' + (parseFloat(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      const hoy = new Date().toISOString().slice(0, 10);
      const mes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const ini = '2020-01-01';
      try {
        const [resResult, prodResult, ingTotResult] = await Promise.allSettled([
          apiFetch(`${API_BASE}/reportes.php?tipo=resumen`),
          apiFetch(`${API_BASE}/reportes.php?tipo=productos&desde=${mes}&hasta=${hoy}&limit=10`),
          apiFetch(`${API_BASE}/reportes.php?tipo=ingresos&agrupacion=mes&desde=${ini}&hasta=${hoy}`),
        ]);

        if (resResult.status === 'fulfilled' && resResult.value?.success) {
          const r = resResult.value;
          const el = id => document.getElementById(id);
          if (el('finIngresosMes'))     el('finIngresosMes').textContent     = fmt(r.ingresos_mes);
          if (el('finIngresosMesHint')) el('finIngresosMesHint').textContent  = `${r.pedidos_mes || 0} pedidos este mes`;
          if (el('finPedidosMes'))      el('finPedidosMes').textContent      = r.pedidos_mes || 0;
          if (el('finPedidosMesHint'))  el('finPedidosMesHint').textContent   = `${r.pedidos_pendientes || 0} pendientes`;
          if (el('finClientesMes'))     el('finClientesMes').textContent     = r.clientes_mes || 0;
          if (el('finClientesMesHint')) el('finClientesMesHint').textContent  = `${r.clientes_unicos || 0} clientes únicos total`;
        }
        if (ingTotResult.status === 'fulfilled' && ingTotResult.value?.success) {
          const total = ingTotResult.value.total || 0;
          const cnt   = (ingTotResult.value.datos || []).reduce((a, d) => a + (parseInt(d.pedidos) || 0), 0);
          const el    = document.getElementById('finIngresosTotales');
          const hint  = document.getElementById('finIngresosTotalesHint');
          if (el)   el.textContent   = fmt(total);
          if (hint) hint.textContent = `${cnt} pedidos históricos`;
        }
        if (prodResult.status === 'fulfilled' && prodResult.value?.success) {
          const prods = prodResult.value.productos || [];
          const el = document.getElementById('finProductosBody');
          if (el) {
            if (!prods.length) {
              el.innerHTML = '<span style="color:var(--muted);">Sin ventas registradas este mes.</span>';
            } else {
              const maxU = Math.max(...prods.map(p => parseInt(p.unidades_vendidas) || 0), 1);
              el.innerHTML = prods.map(p => {
                const pct = Math.round(((parseInt(p.unidades_vendidas) || 0) / maxU) * 100);
                return `<div style="margin-bottom:14px;">
                  <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
                    <span style="color:var(--text);font-weight:700;">${p.nombre_producto || '—'}</span>
                    <span style="color:var(--accent);font-weight:900;">${fmt(p.ingresos_generados)}</span>
                  </div>
                  <div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden;">
                    <div style="width:${pct}%;background:var(--accent);height:100%;border-radius:4px;"></div>
                  </div>
                  <div style="font-size:11px;color:var(--muted);margin-top:3px;">${p.unidades_vendidas || 0} unidades · ${p.num_pedidos || 0} pedidos</div>
                </div>`;
              }).join('');
            }
          }
        }
      } catch(e) {
        console.warn('Error cargando análisis financiero:', e);
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
      setTimeout(cargarCitasCalendarioAPI, 600);
      cargarProductosAPI().then(() => {
        renderCatalogo();
      }).catch(e => console.warn('No se pudieron cargar productos:', e));
      // No pisar un aviso ya visible (ej. de push-notifications.js) — "Bienvenido"
      // es decorativo, un aviso real (permisos, errores) importa más y debe leerse.
      setTimeout(() => {
        const bienvenidaRol = { jefe: 'Jefe', administrador: 'Administrador', ventas: 'Ventas' }[window.WH_ROL] || 'Administrador';
        if (!document.querySelector('.notification')) showNotification('Bienvenido, ' + bienvenidaRol, 'success');
      }, 450);
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
    if (res.status === 401) {
      showNotification('Sesión expirada. Recarga la página e inicia sesión.', 'error');
      throw new Error('No autenticado (' + res.status + ')');
    }
    if (res.status === 403) {
      throw new Error('Acceso denegado (403)');
    }
    const txt = await res.text();
    throw new Error('Error del servidor (HTTP ' + res.status + '): ' + txt.substring(0, 300));
  }
  const data = await res.json();
  if (res.status === 401 && !data.success) {
    showNotification('Sesión expirada. Recarga la página.', 'error');
    throw new Error(data.error || 'No autenticado');
  }
  // 403 = autenticado pero sin permiso para esto (rol distinto) — no es un
  // problema de sesión, así que no se anuncia como tal. Silencioso: las
  // llamadas que sí pueden dar 403 por rol ya se filtran antes de pedirse.
  if (res.status === 403 && !data.success) {
    throw new Error(data.error || 'Acceso denegado');
  }
  return data;
}

async function logoutAdmin() {
  if (window._adminRefreshInterval) clearInterval(window._adminRefreshInterval);
  if (!confirm('¿Cerrar sesión?')) return;
  if (typeof bajaPushDispositivo === 'function') await bajaPushDispositivo();
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
      if (r.total_pedidos > 0) items.push(`<p style="margin:0 0 6px;"><i data-lucide="shopping-cart"></i> ${r.total_pedidos} pedidos registrados en el sistema</p>`);
      if (r.pedidos_pendientes > 0) items.push(`<p style="margin:0 0 6px;"><i data-lucide="clock"></i> ${r.pedidos_pendientes} pedido(s) pendientes de atención</p>`);
      if (r.productos_activos > 0) items.push(`<p style="margin:0;"><i data-lucide="box"></i> ${r.productos_activos} producto(s) activos en catálogo</p>`);
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
        medidas:          p.medidas || [],
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
  pendiente:              'Pendiente',
  anticipo_pagado:        'Anticipo pagado',
  pagado:                 'Pagado',
  listo_para_produccion:  'Listo para producción',
  en_produccion:          'En producción',
  alistando_pedido:       'Alistando pedido',
  en_camino_instalacion:  'En camino a instalación',
  finalizado:             'Finalizado',
  cancelado:              'Cancelado',
};
const ESTADO_PEDIDO_CLASS = {
  pendiente:              'status-pending',
  anticipo_pagado:        'status-pending',
  pagado:                 'status-progress',
  listo_para_produccion:  'status-info',
  en_produccion:          'status-producing',
  alistando_pedido:       'status-info',
  en_camino_instalacion:  'status-ready',
  finalizado:             'status-completed',
  cancelado:              'status-cancelled',
};
function estadosSiguientesPedido(estadoActual, montoPagado) {
  const transiciones = {
    pendiente:              ['cancelado'],
    anticipo_pagado:        ['listo_para_produccion', 'cancelado'],
    pagado:                 ['listo_para_produccion', 'cancelado'],
    listo_para_produccion:  ['en_produccion', 'cancelado'],
    en_produccion:          ['alistando_pedido', 'cancelado'],
    alistando_pedido:       ['en_camino_instalacion', 'finalizado', 'cancelado'],
    en_camino_instalacion:  ['finalizado'],
    finalizado:             [],
    cancelado:              [],
  };
  let opciones = transiciones[estadoActual] || [];
  // Requiere al menos anticipo o pago registrado para avanzar a listo_para_produccion
  if (!((montoPagado || 0) > 0)) opciones = opciones.filter(s => s !== 'listo_para_produccion');
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
        <td>${escapeHtml(p.nombre_cliente)}${p.cliente_id?` <span class="status-badge status-active" style="font-size:10px;padding:2px 8px;" title="Cliente registrado #${p.cliente_id}"><i data-lucide="user-check"></i> #${p.cliente_id}</span>`:''}</td>
        <td>${escapeHtml(p.correo_cliente)}</td>
        <td>${p.fecha_estimada || '—'}</td>
        <td><span class="status-badge ${ESTADO_PEDIDO_CLASS[p.estado] || ''}">${ESTADO_PEDIDO_LABELS[p.estado] || p.estado}</span></td>
        <td style="color:var(--accent);font-weight:800;">${window.WH_VE_MONTOS ? money(p.total) : estadoPagoBadge(p.estado_pago)}</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <button data-call="verDetallePedidoAdmin" data-args="[${p.id}]" style="background:var(--accent);color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;white-space:nowrap;flex-shrink:0;">
            <i data-lucide="eye"></i> Ver
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
    if (estado === 'finalizado' || estado === 'cancelado') {
      const detalle = await apiFetch(`${API_BASE}/pedidos.php?id=${id}`);
      const p = detalle?.pedido;

      // Al finalizar un pedido con anticipo y saldo pendiente, resolver el cobro
      // del saldo en el mismo paso — evita tener que presionar "finalizado" y
      // luego acordarse de marcar el saldo por separado.
      // Sin montos (administrador) la API solo manda estado_pago.
      if (estado === 'finalizado' && p && (p.estado_pago ? p.estado_pago !== 'liquidado' : p.tipo_pago === 'anticipo')) {
        const saldo = Math.max(0, (p.total || 0) - (p.monto_pagado || 0));
        if (p.estado_pago ? true : saldo > 0.009) {
          const cobrado = confirm(window.WH_VE_MONTOS
            ? `Este pedido tiene un saldo pendiente de ${money(saldo)}. ¿El cliente ya pagó el resto (efectivo, transferencia o terminal)?`
            : 'Este pedido todavía tiene saldo por pagar. ¿El cliente ya pagó el resto?');
          if (cobrado) {
            const metodo = await elegirMetodoCobro();
            if (!metodo) { cargarPedidosAPI(); return; }
            const r = await apiFetch(`${API_BASE}/pagos.php?action=marcar_saldo_manual`, {
              method: 'POST', body: JSON.stringify({ pedido_id: id, metodo }),
            });
            if (!r.success) {
              showNotification('<i data-lucide="x"></i> ' + (r.error || 'Error al registrar el saldo'), 'error');
              cargarPedidosAPI();
              return;
            }
          } else {
            // No permitir finalizado si el saldo no está liquidado
            showNotification('<i data-lucide="triangle-alert"></i> El pedido no puede marcarse como finalizado con saldo pendiente. Registra el pago primero.', 'warning');
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
      // Sincronizar calendario con el nuevo estado
      refrescarCalendarioAdmin(true);
    } else {
      showNotification('<i data-lucide="x"></i> ' + (data.error || 'Error'), 'error');
    }
  } catch(e) {
    showNotification('<i data-lucide="x"></i> Error de conexión', 'error');
  }
}

// ── EMPLEADOS - API real ──────────────────────────────
const ROL_LABELS = { jefe: 'Jefe', administrador: 'Administrador', empleado: 'Empleado', disenador: 'Diseñador', ventas: 'Ventas' };
const AREA_LABELS = { taller: 'Taller', instalacion: 'Instalación' };

async function cargarEmpleadosAPI() {
  const tbody = document.getElementById('empleadosTable');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px;">Cargando...</td></tr>';

  try {
    const data = await apiFetch(`${API_BASE}/empleados.php`);
    if (!data.success) return;

    const empleados = data.empleados || [];
    if (empleados.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px;">No hay empleados registrados</td></tr>';
      return;
    }

    tbody.innerHTML = empleados.map(e => `
      <tr>
        <td>${e.id}</td>
        <td>${escapeHtml(e.nombre_completo)}</td>
        <td>${escapeHtml(e.correo)}</td>
        <td>${ROL_LABELS[e.rol] || e.rol}${e.area ? ' · ' + (AREA_LABELS[e.area] || e.area) : ''}</td>
        <td><span class="status-badge ${e.activo ? 'status-completed' : 'status-disabled'}">${e.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td>
          <button class="btn btn-secondary btn-small btn-editar-emp"
            data-id="${e.id}"
            data-nombre="${escapeHtml(e.nombre_completo)}"
            data-correo="${escapeHtml(e.correo)}"
            data-rol="${e.rol}"
            data-area="${e.area || ''}">
            <i data-lucide="pen"></i>
          </button>
          <button class="btn btn-danger btn-small" data-call="desactivarEmpleado" data-args="[${e.id}]">
            ${e.activo ? '<i data-lucide="lock"></i>' : '<i data-lucide="lock-open"></i>'}
          </button>
          <button class="btn btn-secondary btn-small" title="Revocar sesiones activas"
            data-call="revocarSesionesEmpleado" data-args="[${e.id}]">
            <i data-lucide="log-out"></i>
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
          this.dataset.rol,
          this.dataset.area
        );
      });
    });
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--danger);padding:20px;">Error al cargar empleados</td></tr>';
    console.error('Empleados API error:', e);
  }
}

async function desactivarEmpleado(id) {
  if (!confirm('¿Cambiar estado del empleado?')) return;
  const data = await apiFetch(`${API_BASE}/empleados.php?id=${id}`, {
    method: 'DELETE',
  });
  if (data.success) {
    showNotification('<i data-lucide="circle-check"></i> Empleado actualizado', 'success');
    cargarEmpleadosAPI();
  }
}

// ── Revocación de sesiones sobre otra cuenta de personal ──
// Reproduce desde el sitio lo que antes solo se podía hacer con un UPDATE
// directo en la base de datos. Exige un token de Firebase recién emitido
// (reautenticación).
async function _accionSeguridadPersonal(id, accion, mensajeExito) {
  try {
    const firebaseToken = await firebase.auth().currentUser?.getIdToken(true);
    if (!firebaseToken) throw new Error('No hay sesión activa en Firebase.');
    const csrf = document.cookie.split(';').find(c => c.trim().startsWith('XSRF-TOKEN='));
    const csrfToken = csrf ? decodeURIComponent(csrf.split('=')[1]) : '';

    const res = await fetch(`${API_BASE}/empleados.php?action=${accion}&id=${id}`, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': csrfToken,
        'Authorization': 'Bearer ' + firebaseToken,
      },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'No se pudo completar la acción.');
    showNotification('<i data-lucide="circle-check"></i> ' + (data.mensaje || mensajeExito), 'success');
  } catch (e) {
    showNotification('<i data-lucide="x"></i> ' + (e.message || 'Error de conexión'), 'error');
  }
}

async function revocarSesionesEmpleado(id) {
  if (!confirm('¿Revocar todas las sesiones activas de este empleado? Deberá iniciar sesión de nuevo.')) return;
  await _accionSeguridadPersonal(id, 'revocar_sesiones', 'Sesiones revocadas.');
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
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);"><i class="wh-icon-spin icon-2x" data-lucide="loader-circle"></i></div>';

  try {
    const data = await apiFetch(`${API_BASE}/pedidos.php?id=${id}`);
    if (!data.success || !data.pedido) throw new Error(data.error || 'No encontrado');
    const p = data.pedido;

    folio.textContent = p.numero_pedido;
    window._admPedId  = id;

    const estadoLabels = ESTADO_PEDIDO_LABELS;
    const estadoClass  = ESTADO_PEDIDO_CLASS;
    const est   = p.estado || 'pendiente';
    const label = estadoLabels[est] || est;
    const cls   = estadoClass[est]  || 'status-pending';

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
      // Si hay coordenadas exactas (mapa picker), usar lat/lng — si no, buscar por texto
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
    const renderSpecs = specs => {
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
            ${window.WH_VE_MONTOS ? `<th style="padding:8px 6px;text-align:right;color:var(--accent);border-bottom:1px solid var(--border);">P. Unit.</th>
            <th style="padding:8px 6px;text-align:right;color:var(--accent);border-bottom:1px solid var(--border);">Total</th>` : ''}
          </tr></thead>
          <tbody>${items.map(i=>`
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:8px 6px;color:var(--muted2);">
                <div>${escapeHtml(i.nombre_producto||i.producto_nombre||'Producto')}</div>
                ${renderSpecs(i.especificaciones)}
                ${detalleLineaHtml(i)}
              </td>
              <td style="padding:8px 6px;text-align:center;color:var(--muted2);">${Number(i.cantidad)}${i.unidad&&i.unidad!=="pza"?" "+escapeHtml(i.unidad):""}</td>
              ${window.WH_VE_MONTOS ? `<td style="padding:8px 6px;text-align:right;color:var(--muted2);">${money(i.precio_unitario)}</td>
              <td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--accent);">${money(i.total_linea||i.precio_unitario*i.cantidad)}</td>` : ''}
            </tr>`).join('')}
          </tbody>
        </table>`
      : '<p style="color:var(--muted);font-style:italic;font-size:12px;padding:8px 0;">Sin productos registrados</p>';

    const esAnticipo     = p.tipo_pago === 'anticipo';
    const saldoPendiente = Math.max(0, (p.total||0) - (p.monto_pagado||0));
    const saldoHtml = !window.WH_VE_MONTOS
      ? `<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:14px;">
          <div style="font-weight:700;color:var(--accent);margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Pago del cliente</div>
          ${estadoPagoBadge(p.estado_pago)}
        </div>`
      : saldoPendiente > 0.009
      ? `<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-weight:700;color:var(--accent);margin-bottom:4px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">${esAnticipo ? `Anticipo (${p.total > 0 ? Math.round((p.monto_pagado || 0) / p.total * 100) : 0}%)` : 'Pago pendiente'}</div>
            <div style="font-size:12px;color:var(--muted2);">Pagado: <strong>${money(p.monto_pagado||0)}</strong> · Saldo pendiente: <strong style="color:var(--accent);">${money(saldoPendiente)}</strong></div>
          </div>
          <button class="btn btn-secondary btn-small" data-call="marcarSaldoManualAdmin" data-args="[${id}]"><i data-lucide="hand-coins"></i> ${p.monto_pagado>0?'Marcar saldo pagado':'Marcar como pagado'}</button>
        </div>`
      : (esAnticipo ? `<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:14px;">
          <div style="font-weight:700;color:var(--ok);font-size:12px;"><i data-lucide="circle-check"></i> Anticipo y saldo liquidados</div>
        </div>` : '');

    const pagos = p.pagos || [];
    const pagosHtml = pagos.length
      ? pagos.map(pg=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid var(--border);color:var(--muted2);">
          <span>${escapeHtml(pg.metodo||pg.metodo_pago||'Pago')} — ${(pg.fecha_creacion||'').substring(0,10)}</span>
          <span style="font-weight:700;color:var(--ok);">${money(pg.monto||0)}</span>
        </div>`).join('')
      : '<p style="color:var(--muted);font-style:italic;font-size:12px;padding:6px 0;">Sin pagos registrados</p>';

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:18px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;"><span class="status-badge ${cls}">${label}</span>${tipoProyectoBadge(p.tipo_proyecto)}
          ${document.getElementById('pedidoManualModal') && !['cancelado', 'finalizado'].includes(p.estado) ? `<button type="button" class="btn btn-secondary btn-small" data-call="abrirModalEditarPedido" data-args="[${id}]" title="Corregir dirección, teléfonos, fecha, muebles…"><i data-lucide="pencil"></i> Editar pedido</button>` : ''}</div>
        ${window.WH_VE_MONTOS ? `<div style="text-align:right;">
          <div style="font-size:22px;font-weight:900;color:var(--accent);">${money(p.total)}</div>
          <div style="font-size:11px;color:var(--muted);">Sub ${money(p.subtotal)} + Envío ${money(p.costo_envio)} + Inst. ${money(p.costo_instalacion)}${Number(p.descuento) ? ` − Desc. ${money(p.descuento)}` : ''}</div>
          ${['cancelado', 'finalizado'].includes(p.estado) ? '' : `<button type="button" class="btn btn-secondary btn-small" style="margin-top:6px;" data-call="editarTotalPedido" data-args="[${id}, ${Number(p.total) || 0}, ${Number(p.monto_pagado) || 0}]"><i data-lucide="pencil"></i> Editar total</button>`}
        </div>` : ''}
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

      <div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
          <div style="font-weight:700;color:var(--accent);font-size:11px;text-transform:uppercase;letter-spacing:.8px;"><i data-lucide="paperclip"></i> Adjuntos del pedido <span class="wh-collapse-count">(${(p.adjuntos||[]).length})</span></div>
          <button class="btn btn-secondary btn-small" data-call="abrirAgregarAdjuntoPedido" data-args="[${id}]"><i data-lucide="image-plus"></i> Agregar foto</button>
        </div>
        <details class="wh-collapse" open>
          <summary>Fotos y notas de voz</summary>
          <div class="wh-collapse-body">
            ${p.adjuntos?.filter(a=>a.tipo==='foto').length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:${p.adjuntos.some(a=>a.tipo==='audio')?'10px':'0'};">
              ${p.adjuntos.filter(a=>a.tipo==='foto').map(a => `<a href="${a.url}" target="_blank" rel="noopener"><img src="${a.url}" alt="Foto de referencia" style="width:84px;height:84px;object-fit:cover;border-radius:6px;border:1px solid var(--border);"></a>`).join('')}
            </div>` : '<div style="font-size:12px;color:var(--muted);">Sin fotos todavía.</div>'}
            ${(p.adjuntos?.filter(a=>a.tipo==='audio')||[]).map(a => `<audio controls src="${a.url}" style="width:100%;height:36px;margin-top:8px;"></audio>`).join('')}
          </div>
        </details>
        <input type="file" id="adjPedidoInput_${id}" accept="image/jpeg,image/jpg,image/png,image/webp" style="display:none">
      </div>

      ${(p.imagenes_diseno?.length || p.mensaje_disenador) ? `
      <details class="wh-collapse" open style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;">
        <summary><i data-lucide="ruler"></i> Diseño <span class="wh-collapse-count">(${(p.imagenes_diseno||[]).length})</span></summary>
        <div class="wh-collapse-body">
        ${htmlArchivosDiseno(p.imagenes_diseno || [], id)}
        ${p.mensaje_disenador ? `<div style="font-size:12px;color:var(--muted2);margin-top:6px;"><strong>Mensaje del diseñador:</strong> ${escapeHtml(p.mensaje_disenador)}</div>` : ''}
        </div>
      </details>
      ` : ''}

      ${p.cotizacion_origen ? `
      <details class="wh-collapse" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;">
        <summary><i data-lucide="receipt"></i> Partidas cotizadas (${escapeHtml(p.cotizacion_origen.numero_cotizacion)}) <span class="wh-collapse-count">— ver historial completo</span></summary>
        <div class="wh-collapse-body">
          ${p.cotizacion_origen.items?.length ? `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px;">
            <tbody>${p.cotizacion_origen.items.map(it => `<tr style="border-bottom:1px solid var(--border);"><td style="padding:5px 4px;color:var(--muted2);">${escapeHtml(it.nombre_item)}</td><td style="padding:5px 4px;text-align:center;color:var(--muted2);">${it.cantidad} ${escapeHtml(it.unidad)}</td><td style="padding:5px 4px;text-align:right;color:var(--accent);font-weight:700;">${money(it.subtotal)}</td></tr>`).join('')}</tbody>
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

      <div style="margin-bottom:14px;${window.WH_VE_MONTOS ? '' : 'display:none;'}">
        <div style="font-weight:700;color:var(--accent);margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Historial de Pagos</div>
        ${pagosHtml}
        ${p.total > p.monto_pagado ? `
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
          <input type="number" id="pagoManualMonto_${id}" class="form-input" placeholder="Monto recibido" style="max-width:140px;font-size:12px;" step="0.01" min="0.01" max="${(p.total - p.monto_pagado).toFixed(2)}">
          <select id="pagoManualMetodo_${id}" class="form-select" style="max-width:150px;font-size:12px;">
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
            <option value="terminal">Terminal</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
          <button class="btn btn-secondary btn-small" data-call="registrarPagoManual" data-args="[${id}]"><i data-lucide="banknote"></i> Registrar pago recibido</button>
        </div>
        <div class="help" style="margin-top:4px;">Saldo pendiente: ${money(p.total - p.monto_pagado)}. Para un anticipo parcial (ej. 60%), pon aquí solo el monto recibido.</div>
        ` : ''}
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
        ${est==='pendiente' && (p.monto_pagado||0)<=0 ? '<p style="color:var(--muted);font-size:11px;margin-top:8px;"><i data-lucide="info"></i> No se puede iniciar producción sin registrar al menos el anticipo o pago.</p>' : ''}
      </div>
    `;
  } catch(e) {
    body.innerHTML = `<div style="color:var(--danger);padding:20px;text-align:center;"><i data-lucide="circle-alert"></i> Error: ${e.message}</div>`;
  }
}

// ── Agregar foto de referencia a un pedido ya existente (ventas/jefe) ──
// Para que el diseñador tenga el panorama completo aunque la info original
// haya llegado incompleta — mismo patrón de subida que pedido-manual.js,
// mismo path de Storage (pedidos/{id}/adjuntos/...) para reusar sus reglas.
function abrirAgregarAdjuntoPedido(id) {
  const input = document.getElementById(`adjPedidoInput_${id}`);
  if (!input) return;
  input.onchange = () => _subirAdjuntoPedido(id, input.files?.[0]);
  input.click();
}

async function _subirAdjuntoPedido(id, file) {
  if (!file) return;
  const TIPOS_VALIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!TIPOS_VALIDOS.includes(file.type)) {
    showNotification('Archivo no válido — usa JPEG, PNG, WEBP o GIF.', 'error');
    return;
  }
  try {
    if (!firebaseStorage && typeof initFirebase === 'function') initFirebase();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const ref = firebaseStorage.ref(`pedidos/${id}/adjuntos/foto-${Date.now()}.${ext}`);
    const snap = await ref.put(file);
    const url = await snap.ref.getDownloadURL();
    const data = await apiFetch(`${API_BASE}/pedidos.php?action=agregar_adjunto&id=${id}`, {
      method: 'POST',
      body: JSON.stringify({ tipo: 'foto', url }),
    });
    if (data.success) {
      showNotification('<i data-lucide="circle-check"></i> Foto agregada', 'success');
      verDetallePedidoAdmin(id);
    } else {
      showNotification(data.error || 'Error al agregar la foto', 'error');
    }
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

async function marcarSaldoManualAdmin(id) {
  const metodo = await elegirMetodoCobro();
  if (!metodo) return;
  try {
    const data = await apiFetch(`${API_BASE}/pagos.php?action=marcar_saldo_manual`, {
      method: 'POST',
      body: JSON.stringify({ pedido_id: id, metodo }),
    });
    if (data.success) {
      showNotification('✅ Saldo registrado como pagado', 'success');
      verDetallePedidoAdmin(id);
      cargarPedidosAPI();
    } else {
      showNotification('<i data-lucide="x"></i> ' + (data.error || 'Error'), 'error');
    }
  } catch(e) {
    showNotification('<i data-lucide="x"></i> Error de conexión', 'error');
  }
}

async function registrarPagoManual(id) {
  const montoInput = document.getElementById(`pagoManualMonto_${id}`);
  const metodoSel  = document.getElementById(`pagoManualMetodo_${id}`);
  const monto = parseFloat(montoInput?.value || '0');
  if (!monto || monto <= 0) {
    showNotification('<i data-lucide="triangle-alert"></i> Ingresa el monto recibido.', 'error');
    return;
  }
  if (!confirm(`¿Confirmas que se recibió ${money(monto)} (${metodoSel?.value || 'transferencia'})? Esto se suma al pedido.`)) return;
  try {
    const data = await apiFetch(`${API_BASE}/pagos.php?action=registrar_pago_manual`, {
      method: 'POST',
      body: JSON.stringify({ pedido_id: id, monto, metodo: metodoSel?.value || 'transferencia' }),
    });
    if (data.success) {
      showNotification('<i data-lucide="circle-check"></i> Pago registrado', 'success');
      verDetallePedidoAdmin(id);
      cargarPedidosAPI();
    } else {
      showNotification('<i data-lucide="circle-x"></i> ' + (data.error || 'Error'), 'error');
    }
  } catch(e) {
    showNotification('<i data-lucide="circle-x"></i> Error de conexión', 'error');
  }
}

// ── Ver detalle de CITA ────────────────────────────────────────
async function verDetalleCitaAdmin(id) {
  const body  = document.getElementById('adm_cita_body');
  const folio = document.getElementById('adm_cita_folio');
  openModal('adminCitaDetalleModal');
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);"><i class="wh-icon-spin icon-2x" data-lucide="loader-circle"></i></div>';
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

    let mapsBtnCita = '';
    const partesDireccionCita = [c.direccion, c.colonia ? `Col. ${c.colonia}` : '', c.ciudad, c.municipio ? `Mpio. ${c.municipio}` : '', c.cp ? `CP ${c.cp}` : ''].filter(Boolean).join(', ');
    if (c.lat && c.lng) {
      mapsBtnCita = `<a href="https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}" target="_blank" rel="noopener" style="color:#4285F4;">📍 Ver ubicación en el mapa</a>`;
    } else if (partesDireccionCita) {
      mapsBtnCita = `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partesDireccionCita)}" target="_blank" rel="noopener" style="color:#4285F4;">📍 Ver dirección en el mapa</a>`;
    }

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
          <div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">📍 Dirección</span><strong>${escapeHtml(c.direccion||'Sin especificar')}</strong>${mapsBtnCita ? ` — ${mapsBtnCita}` : ''}</div>
          ${c.notas?`<div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Notas</span><strong>${escapeHtml(c.notas)}</strong></div>`:''}
          ${c.cliente_id?`<div style="grid-column:1/-1;margin-top:4px;"><span style="background:#2d6a3f20;color:#2d6a3f;border-radius:12px;padding:3px 10px;font-size:11px;font-weight:700;"><i data-lucide="user-check"></i> Cliente registrado #${c.cliente_id}</span></div>`:''}
        </div>
      </div>
    `;
  } catch(e) {
    body.innerHTML = `<div style="color:var(--danger);padding:20px;text-align:center;"><i data-lucide="circle-alert"></i> Error: ${e.message}</div>`;
  }
}


// Flujo alterno: cita agendada directo (sin cotizador rápido) → el jefe la
// confirma, va a la visita con medidas/fotos, y desde aquí genera la
// cotización — abre el mismo cotizador de dos columnas para llenarla.
async function generarCotizacionDesdeCita() {
  const id = window._admCitaId;
  if (!id) return;
  if (!confirm('¿Generar una cotización nueva a partir de esta cita? Se abrirá el cotizador para llenarla.')) return;

  try {
    const data = await apiFetch(`${API_BASE}/citas.php?action=generar_cotizacion&id=${id}`, { method: 'POST' });
    if (!data.success) {
      showNotification('<i data-lucide="x"></i> ' + (data.error || 'Error al generar la cotización'), 'error');
      return;
    }
    showNotification('<i data-lucide="circle-check"></i> Cotización creada, complétala en el cotizador', 'success');
    closeModal('adminCitaDetalleModal');
    verDetalleCotAdmin(data.cotizacion_id);
  } catch (e) {
    showNotification('<i data-lucide="x"></i> Error de conexión', 'error');
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
const COTIZADOR_TIPO_LABELS = { cocina:'Cocina', closet:'Closet', lavamanos:'Mueble de baño', otro:'Otro' };

async function cargarCatalogoCotizador(forzar) {
  if (window._cotizadorCatalogo && !forzar) return window._cotizadorCatalogo;
  try {
    const data = await apiFetch(`${API_BASE}/cotizador_catalogo.php`);
    window._cotizadorCatalogo = (data.success ? data.items : []) || [];
  } catch (e) {
    window._cotizadorCatalogo = [];
  }
  return window._cotizadorCatalogo;
}

// ── Crear cotización desde cero (cliente que llamó, no vino del sitio) ──
// Solo captura datos básicos del cliente; las partidas se llenan después
// en el mismo cotizador de dos columnas (verDetalleCotAdmin) — no duplica
// esa UI, solo crea el registro y brinca directo a él.
function abrirNuevaCotizacion() {
  ['nc_nombre','nc_correo','nc_telefono','nc_direccion','nc_descripcion'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const tipo = document.getElementById('nc_tipo_mueble'); if (tipo) tipo.value = 'otro';
  const err = document.getElementById('nc_error'); if (err) err.style.display = 'none';
  openModal('nuevaCotizacionModal');
}

async function guardarNuevaCotizacion() {
  const nombre      = document.getElementById('nc_nombre')?.value.trim() || '';
  const correo      = document.getElementById('nc_correo')?.value.trim() || '';
  const telefono    = document.getElementById('nc_telefono')?.value.trim() || '';
  const tipoMueble  = document.getElementById('nc_tipo_mueble')?.value || 'otro';
  const direccion   = document.getElementById('nc_direccion')?.value.trim() || '';
  const descripcion = document.getElementById('nc_descripcion')?.value.trim() || '';
  const err = document.getElementById('nc_error');
  const showErr = (msg) => { if (err) { err.textContent = msg; err.style.display = 'block'; } };
  if (err) err.style.display = 'none';

  if (!nombre) { showErr('Falta el nombre del cliente'); return; }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!correo || !emailRe.test(correo)) { showErr('Correo inválido'); return; }
  if (!telefono || telefono.replace(/\D/g,'').length < 10) { showErr('Teléfono inválido (mínimo 10 dígitos)'); return; }
  if (!descripcion || descripcion.length < 5) { showErr('Describe el proyecto'); return; }

  const btn = document.getElementById('nc_btn_guardar');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="wh-icon-spin" data-lucide="loader-circle"></i> Creando...'; }
  try {
    const data = await apiFetch(`${API_BASE}/cotizaciones.php`, {
      method: 'POST',
      body: JSON.stringify({
        nombre_cliente: nombre, correo_cliente: correo, telefono_cliente: telefono,
        tipo_mueble: tipoMueble, direccion,
        descripcion_solicitud: descripcion,
      }),
    });
    if (data.success) {
      showNotification('<i data-lucide="circle-check"></i> Cotización creada', 'success');
      closeModal('nuevaCotizacionModal');
      cargarCotizacionesAPI();
      if (data.cotizacion_id) verDetalleCotAdmin(data.cotizacion_id);
    } else {
      showErr(data.error || 'Error al crear la cotización');
    }
  } catch (e) {
    showErr('Error de conexión');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="arrow-right"></i> Crear y continuar al cotizador'; }
  }
}
window.abrirNuevaCotizacion  = abrirNuevaCotizacion;
window.guardarNuevaCotizacion = guardarNuevaCotizacion;

// ── Catálogo de precios del cotizador — configurar una sola vez ──
async function abrirCatalogoCotizador() {
  openModal('catalogoCotizadorModal');
  await cargarCatalogoCotizador(true);
  renderCatalogoCotizadorBody();
}

function renderCatalogoCotizadorBody() {
  const wrap = document.getElementById('catalogoCotizadorBody');
  if (!wrap) return;
  const items = window._cotizadorCatalogo || [];
  wrap.innerHTML = items.length ? items.map(it => `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
      <span style="flex:1 1 140px;font-size:13px;color:var(--muted2);">${escapeHtml(it.nombre)} <span style="color:var(--muted);font-size:11px;">(${escapeHtml(it.unidad)})</span></span>
      <input type="number" min="0" step="0.01" value="${it.precio_unitario_default}" id="catPrecio_${it.id}"
        style="width:110px;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:6px;color:var(--text);font-size:13px;">
      <button class="btn btn-secondary btn-small" data-call="guardarPrecioCatalogo" data-args="[${it.id}]"><i data-lucide="save"></i></button>
      <button class="btn btn-danger btn-small" data-call="desactivarPartidaCatalogo" data-args="[${it.id}]"><i data-lucide="trash-2"></i></button>
    </div>
  `).join('') : '<p style="color:var(--muted);font-size:12px;">Sin partidas en el catálogo todavía.</p>';
}

async function guardarPrecioCatalogo(itemId) {
  const precio = parseFloat(document.getElementById(`catPrecio_${itemId}`)?.value || 0);
  const data = await apiFetch(`${API_BASE}/cotizador_catalogo.php?id=${itemId}`, {
    method: 'PUT', body: JSON.stringify({ precio_unitario_default: precio }),
  });
  if (data.success) {
    showNotification('<i data-lucide="circle-check"></i> Precio actualizado', 'success');
    await cargarCatalogoCotizador(true);
  } else {
    showNotification('<i data-lucide="x"></i> ' + (data.error || 'Error'), 'error');
  }
}

async function desactivarPartidaCatalogo(itemId) {
  if (!confirm('¿Quitar esta partida del catálogo? Las cotizaciones que ya la usaron no se ven afectadas.')) return;
  const data = await apiFetch(`${API_BASE}/cotizador_catalogo.php?id=${itemId}`, { method: 'DELETE' });
  if (data.success) {
    await cargarCatalogoCotizador(true);
    renderCatalogoCotizadorBody();
  }
}

async function agregarPartidaCatalogoNueva() {
  const nombre = document.getElementById('catNombreNuevo')?.value?.trim();
  const unidad = document.getElementById('catUnidadNuevo')?.value?.trim() || 'pza';
  const precio = parseFloat(document.getElementById('catPrecioNuevo')?.value || 0);
  if (!nombre) { showNotification('<i data-lucide="triangle-alert"></i> Escribe el nombre de la partida', 'error'); return; }

  const data = await apiFetch(`${API_BASE}/cotizador_catalogo.php`, {
    method: 'POST',
    body: JSON.stringify({ clave: nombre, nombre, unidad, precio_unitario_default: precio }),
  });
  if (data.success) {
    document.getElementById('catNombreNuevo').value = '';
    document.getElementById('catPrecioNuevo').value = '';
    showNotification('<i data-lucide="circle-check"></i> Partida agregada', 'success');
    await cargarCatalogoCotizador(true);
    renderCatalogoCotizadorBody();
  } else {
    showNotification('<i data-lucide="x"></i> ' + (data.error || 'Error'), 'error');
  }
}

async function verDetalleCotAdmin(id) {
  const body  = document.getElementById('adm_cot_body');
  const folio = document.getElementById('adm_cot_folio');
  openModal('adminCotDetalleModal');
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);"><i class="wh-icon-spin icon-2x" data-lucide="loader-circle"></i></div>';
  window._admCotId = id;

  try {
    const [data] = await Promise.all([
      apiFetch(`${API_BASE}/cotizaciones.php?id=${id}`),
      cargarCatalogoCotizador(),
    ]);
    if (!data.success || !data.cotizacion) throw new Error(data.error || 'No encontrada');
    const cot = data.cotizacion;
    folio.textContent = cot.numero_cotizacion;

    const estLabels = {
      nueva:'Nueva', en_revision:'En Revisión', respondida:'Propuesta enviada',
      aceptada:'Aceptada — esperando enviar a producción', en_produccion:'En Producción (legado)',
      lista:'Lista (legado)', entregada:'Entregada (legado)', cancelada:'Cancelada',
      convertida_a_pedido:'Convertida a pedido',
    };
    const estClass = {
      nueva:'status-new', en_revision:'status-pending', respondida:'status-replied',
      aceptada:'status-info', en_produccion:'status-producing',
      lista:'status-ready', entregada:'status-completed', cancelada:'status-cancelled',
      convertida_a_pedido:'status-completed',
    };
    const est = cot.estado || 'nueva';

    // Botones de estado simples (la propuesta se envía con el botón del cotizador)
    const acciones = {
      nueva:       [['en_revision','📋 Marcar en revisión','btn-secondary'], ['cancelada','✕ Cancelar','btn-danger']],
      en_revision: [['cancelada','✕ Cancelar','btn-danger']],
      respondida:  [['cancelada','✕ Cancelar','btn-danger']],
      aceptada: [], en_produccion: [], lista: [], entregada: [], cancelada: [], convertida_a_pedido: [],
    };
    const botonesHtml = (acciones[est] || []).map(([estado, label, cls]) =>
      `<button class="btn ${cls} btn-small" data-call="cambiarEstadoCotAdmin" data-args='[${cot.id},"${estado}"]'>${label}</button>`
    ).join(' ') + (est === 'aceptada'
      ? ` <button class="btn btn-primary btn-small" data-call="convertirCotizacionAPedido" data-args="[${cot.id}]"><i data-lucide="factory"></i> Enviar a producción</button>`
      : '') + (est === 'convertida_a_pedido' && cot.numero_pedido
      ? ` <span class="status-badge status-completed"><i data-lucide="check"></i> Pedido ${escapeHtml(cot.numero_pedido)}</span>`
      : '');

    // ── Estado inicial del cotizador (partidas ya guardadas, o vacío) ──
    window._cotizadorItems = (cot.items && cot.items.length)
      ? cot.items.map(it => ({ clave: it.clave_item, nombre: it.nombre_item, unidad: it.unidad, cantidad: parseFloat(it.cantidad), precio_unitario: parseFloat(it.precio_unitario) }))
      : [];
    window._cotizadorImagenesJefe = (cot.imagenes || []).filter(im => im.tipo === 'jefe_propuesta');
    window._cotizadorCotId = id;
    window._cotizadorCot   = cot;

    const imagenesCliente = (cot.imagenes || []).filter(im => im.tipo === 'cliente_espacio' || im.tipo === 'cliente_boceto');

    let mapsBtn = '';
    const partesDireccion = [cot.direccion, cot.colonia ? `Col. ${cot.colonia}` : '', cot.ciudad, cot.municipio ? `Mpio. ${cot.municipio}` : '', cot.cp ? `CP ${cot.cp}` : ''].filter(Boolean).join(', ');
    if (cot.lat && cot.lng) {
      mapsBtn = `<a href="https://www.google.com/maps/search/?api=1&query=${cot.lat},${cot.lng}" target="_blank" rel="noopener" style="color:#4285F4;">📍 Ver ubicación en el mapa</a>`;
    } else if (partesDireccion) {
      mapsBtn = `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partesDireccion)}" target="_blank" rel="noopener" style="color:#4285F4;">📍 Ver dirección en el mapa</a>`;
    }

    const medidasHtml = (cot.ancho_espacio || cot.alto_espacio || cot.fondo_espacio)
      ? `<div><span style="color:var(--muted);display:block;font-size:10px;">Medidas del espacio (ancho × alto × fondo)</span><strong>${cot.ancho_espacio||'—'} × ${cot.alto_espacio||'—'} × ${cot.fondo_espacio||'—'} m</strong></div>`
      : (cot.medidas ? `<div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Medidas</span><strong>${escapeHtml(cot.medidas)}</strong></div>` : '');

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <span class="status-badge ${estClass[est]||'status-new'}">${estLabels[est]||est}</span>
        <span style="font-size:11px;color:var(--muted);">Creada: ${(cot.fecha_creacion||'').substring(0,10)}</span>
      </div>
      ${botonesHtml ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">${botonesHtml}</div>` : ''}

      <div class="row g-3" style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;">
        <!-- ── Columna izquierda: información del proyecto (solo lectura) ── -->
        <div style="flex:1 1 380px;min-width:320px;">
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:12px;">
            <div style="font-weight:700;color:var(--accent);margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Cliente</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--muted2);">
              <div><span style="color:var(--muted);display:block;font-size:10px;">Nombre</span><strong>${escapeHtml(cot.nombre_cliente)}</strong></div>
              <div><span style="color:var(--muted);display:block;font-size:10px;">Teléfono</span><strong>${escapeHtml(cot.telefono_cliente||'—')}</strong></div>
              <div style="grid-column:1/-1;"><span style="color:var(--muted);display:block;font-size:10px;">Correo</span><strong>${escapeHtml(cot.correo_cliente)}</strong></div>
              ${mapsBtn ? `<div style="grid-column:1/-1;font-size:12px;">${mapsBtn}</div>` : ''}
              ${cot.cliente_id?`<div style="grid-column:1/-1;"><span style="background:#2d6a3f20;color:#2d6a3f;border-radius:12px;padding:3px 10px;font-size:11px;font-weight:700;"><i data-lucide="user-check"></i> Cliente registrado #${cot.cliente_id}</span></div>`:''}
              ${cot.cita_id?`<div style="grid-column:1/-1;"><span style="background:#4a7c8b20;color:#5b9aad;border-radius:12px;padding:3px 10px;font-size:11px;font-weight:700;"><i data-lucide="calendar-check"></i> Generada tras visita (cita #${cot.cita_id})</span></div>`:''}
            </div>
          </div>

          <div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:12px;">
            <div style="font-weight:700;color:var(--ok);margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">Proyecto solicitado</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--muted2);">
              <div><span style="color:var(--muted);display:block;font-size:10px;">Tipo</span><strong>${escapeHtml(COTIZADOR_TIPO_LABELS[cot.tipo_mueble] || cot.modelo_mueble || 'No especificado')}</strong></div>
              <div><span style="color:var(--muted);display:block;font-size:10px;">Instalación (la define el jefe tras la visita)</span><strong>${parseInt(cot.requiere_instalacion)?'✅ Sí':'—'}</strong></div>
              ${medidasHtml}
              <div style="grid-column:1/-1;">
                <span style="color:var(--muted);display:block;font-size:10px;margin-bottom:4px;">Cómo visualiza el cliente el proyecto</span>
                <div style="background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:10px;line-height:1.6;color:var(--muted2);">${escapeHtml(cot.descripcion_solicitud||'—')}</div>
              </div>
              ${imagenesCliente.length ? `<div style="grid-column:1/-1;">
                <span style="color:var(--muted);display:block;font-size:10px;margin-bottom:4px;">Fotos del espacio / boceto</span>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  ${imagenesCliente.map(im => `<a href="${im.url_imagen}" target="_blank" rel="noopener"><img src="${im.url_imagen}" alt="Foto del cliente" style="width:70px;height:70px;object-fit:cover;border-radius:6px;border:1px solid var(--border);"></a>`).join('')}
                </div>
              </div>` : ''}
            </div>
          </div>
        </div>

        <!-- ── Columna derecha: cotizador estructurado ── -->
        <div style="flex:1 1 420px;min-width:340px;">
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:14px;">
            <div style="font-weight:700;color:var(--accent);margin-bottom:10px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;">
              Cotizador — partidas del proyecto
            </div>

            <div id="cotizadorPartidasWrap"></div>
            <button class="btn btn-secondary btn-small" data-call="agregarPartidaCotizador" style="margin:8px 0 14px;">
              <i data-lucide="plus"></i> Agregar partida
            </button>

            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:10px 14px;margin-bottom:14px;">
              <strong style="color:var(--muted2);">Total</strong>
              <strong id="cotizadorTotal" style="font-size:18px;color:var(--accent);">$0.00 MXN</strong>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
              <div>
                <label style="color:var(--muted);font-size:10px;display:block;margin-bottom:4px;">FECHA DE VISITA</label>
                <input id="cot_fecha_visita" type="date" value="${cot.fecha_visita || ''}"
                  style="width:100%;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text);font-size:13px;">
              </div>
              <div>
                <label style="color:var(--muted);font-size:10px;display:block;margin-bottom:4px;">HORA</label>
                <input id="cot_hora_visita" type="text" value="${escapeHtml(cot.hora_visita || '')}" placeholder="Ej: 10:00 - 12:00"
                  style="width:100%;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text);font-size:13px;">
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
              <div>
                <label style="color:var(--muted);font-size:10px;display:block;margin-bottom:4px;">¿INCLUYE INSTALACIÓN?</label>
                <select id="cot_requiere_instalacion" style="width:100%;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text);font-size:13px;">
                  <option value="0" ${!parseInt(cot.requiere_instalacion)?'selected':''}>No</option>
                  <option value="1" ${parseInt(cot.requiere_instalacion)?'selected':''}>Sí</option>
                </select>
              </div>
              <div>
                <label style="color:var(--muted);font-size:10px;display:block;margin-bottom:4px;">ENTREGA ESTIMADA</label>
                <input id="cot_fecha_entrega" type="date" value="${cot.fecha_entrega_estimada || ''}"
                  style="width:100%;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text);font-size:13px;">
              </div>
            </div>
            <div style="margin-bottom:10px;">
              <label style="color:var(--muted);font-size:10px;display:block;margin-bottom:4px;">MENSAJE / PROPUESTA AL CLIENTE * (qué se va a fabricar, materiales, acabados)</label>
              <textarea id="cot_desc_respuesta" rows="4"
                style="width:100%;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text);font-size:13px;resize:vertical;"
                placeholder="Ej: Closet de 2.5m x 2m en melamina nogal, 4 cajones, 6 repisas, puertas corredizas con espejo...">${escapeHtml(cot.descripcion_respuesta || '')}</textarea>
            </div>
            <div style="margin-bottom:10px;">
              <label style="color:var(--muted);font-size:10px;display:block;margin-bottom:4px;">NOTA DE VOZ PARA EL DISEÑADOR (opcional)</label>
              <div id="cot_audio_zona" style="display:${cot.audio_respuesta_url ? 'none' : 'block'};">
                <button type="button" class="btn btn-secondary btn-small" id="cot_btn_grabar">
                  <i data-lucide="mic"></i> Grabar nota de voz
                </button>
                <span id="cot_audio_tiempo" style="display:none;margin-left:10px;color:var(--danger,#e57373);font-weight:700;font-size:12px;">● 00:00</span>
              </div>
              <div id="cot_audio_preview" style="display:${cot.audio_respuesta_url ? 'block' : 'none'};margin-top:8px;">
                <audio id="cot_audio_player" controls style="width:100%;height:36px;" src="${cot.audio_respuesta_url || ''}"></audio>
                <button type="button" class="btn btn-secondary btn-small" id="cot_btn_borrar_audio" style="margin-top:6px;">
                  <i data-lucide="trash-2"></i> Eliminar y regrabar
                </button>
              </div>
              <div class="help">Complementa (o reemplaza) el mensaje escrito para que el diseñador la escuche al preparar el pedido — el cliente solo recibe el PDF con el texto.</div>
            </div>
            <div style="margin-bottom:10px;">
              <label style="color:var(--muted);font-size:10px;display:block;margin-bottom:4px;">NOTAS INTERNAS (solo visibles aquí)</label>
              <textarea id="cot_notas" rows="2"
                style="width:100%;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:8px;color:var(--text);font-size:12px;resize:vertical;"
                placeholder="Notas de taller, proveedores, condiciones...">${escapeHtml(cot.notas_admin || '')}</textarea>
            </div>
            <div style="margin-bottom:14px;">
              <label style="color:var(--muted);font-size:10px;display:block;margin-bottom:4px;">IMÁGENES DE REFERENCIA PARA EL CLIENTE</label>
              <input type="file" id="cotizadorImgInput" accept="image/jpeg,image/jpg,image/png,image/webp" multiple class="form-input" style="margin-bottom:8px;">
              <div id="cotizadorImagenesJefeWrap" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
            </div>

            ${cot.pdf_url ? `<p style="font-size:12px;margin-bottom:10px;"><a href="${cot.pdf_url}" target="_blank" rel="noopener" style="color:var(--accent);"><i data-lucide="file-text"></i> Ver el PDF ya enviado</a></p>` : ''}

            <button class="btn btn-secondary btn-small" data-call="guardarCamposCotizacion" data-args="[${cot.id}]">
              <i data-lucide="save"></i> Guardar borrador
            </button>
            <button class="btn btn-primary" id="btnResponderCliente" data-call="generarPDFCotizacion" data-args="[${cot.id}]">
              <i data-lucide="send"></i> Responder al cliente (genera PDF)
            </button>
          </div>
        </div>
      </div>
    `;

    renderCotizadorPartidas();
    renderCotizadorImagenesJefe();
    window._cotGrabador = crearGrabadorAudio({
      btnGrabarId: 'cot_btn_grabar', tiempoId: 'cot_audio_tiempo',
      zonaId: 'cot_audio_zona', previewId: 'cot_audio_preview',
      playerId: 'cot_audio_player', btnBorrarId: 'cot_btn_borrar_audio',
    });
  } catch(e) {
    body.innerHTML = `<div style="color:var(--danger);padding:20px;text-align:center;"><i data-lucide="circle-alert"></i> Error: ${e.message}</div>`;
  }
}

// ── Cotizador: partidas dinámicas ─────────────────────────────
function renderCotizadorPartidas() {
  const wrap = document.getElementById('cotizadorPartidasWrap');
  if (!wrap) return;
  const catalogo = window._cotizadorCatalogo || [];
  const items = window._cotizadorItems || [];

  wrap.innerHTML = items.map((it, idx) => `
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
      <select data-onchange="seleccionarPartidaCatalogo" data-args="[${idx}]" style="flex:1 1 130px;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:6px;color:var(--text);font-size:12px;">
        <option value="">Personalizada…</option>
        ${catalogo.map(c => `<option value="${c.clave}" ${c.clave === it.clave ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('')}
      </select>
      <input type="text" value="${escapeHtml(it.nombre)}" placeholder="Nombre" data-oninput="actualizarPartidaCotizador" data-args='[${idx},"nombre"]'
        style="flex:1 1 110px;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:6px;color:var(--text);font-size:12px;">
      <input type="number" min="0" step="0.01" value="${it.cantidad}" placeholder="Cant." data-oninput="actualizarPartidaCotizador" data-args='[${idx},"cantidad"]'
        style="width:64px;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:6px;color:var(--text);font-size:12px;">
      <input type="text" value="${escapeHtml(it.unidad)}" placeholder="Unidad" data-oninput="actualizarPartidaCotizador" data-args='[${idx},"unidad"]'
        style="width:56px;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:6px;color:var(--text);font-size:12px;">
      <input type="number" min="0" step="0.01" value="${it.precio_unitario}" placeholder="P. unit." data-oninput="actualizarPartidaCotizador" data-args='[${idx},"precio_unitario"]'
        style="width:82px;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:6px;color:var(--text);font-size:12px;">
      <span style="width:82px;text-align:right;font-size:12px;color:var(--muted2);font-weight:700;">${money((it.cantidad||0) * (it.precio_unitario||0))}</span>
      <button type="button" data-call="quitarPartidaCotizador" data-args="[${idx}]" style="background:none;border:none;color:var(--danger);cursor:pointer;padding:4px;"><i data-lucide="trash-2"></i></button>
    </div>
  `).join('') || '<p style="color:var(--muted);font-size:12px;">Sin partidas — agrega al menos una.</p>';

  calcularTotalCotizador();
}

function seleccionarPartidaCatalogo(idx, clave) {
  const catalogo = window._cotizadorCatalogo || [];
  const item = catalogo.find(c => c.clave === clave);
  if (item) {
    window._cotizadorItems[idx] = {
      clave: item.clave, nombre: item.nombre, unidad: item.unidad,
      cantidad: window._cotizadorItems[idx].cantidad || 1,
      precio_unitario: parseFloat(item.precio_unitario_default) || 0,
    };
  } else {
    window._cotizadorItems[idx].clave = '';
  }
  renderCotizadorPartidas();
}

function actualizarPartidaCotizador(idx, campo, valor) {
  if (!window._cotizadorItems[idx]) return;
  if (campo === 'cantidad' || campo === 'precio_unitario') valor = parseFloat(valor) || 0;
  window._cotizadorItems[idx][campo] = valor;
  if (campo === 'nombre') window._cotizadorItems[idx].clave = window._cotizadorItems[idx].clave || valor.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  calcularTotalCotizador();
  // Solo refrescamos el subtotal visible, no todo el DOM (evita perder el foco del input)
  const subtotalEls = document.querySelectorAll('#cotizadorPartidasWrap > div');
  const el = subtotalEls[idx]?.querySelector('span');
  if (el) el.textContent = money((window._cotizadorItems[idx].cantidad||0) * (window._cotizadorItems[idx].precio_unitario||0));
}

function agregarPartidaCotizador() {
  window._cotizadorItems = window._cotizadorItems || [];
  window._cotizadorItems.push({ clave: '', nombre: '', unidad: 'pza', cantidad: 1, precio_unitario: 0 });
  renderCotizadorPartidas();
}

function quitarPartidaCotizador(idx) {
  window._cotizadorItems.splice(idx, 1);
  renderCotizadorPartidas();
}

function calcularTotalCotizador() {
  const total = (window._cotizadorItems || []).reduce((sum, it) => sum + (parseFloat(it.cantidad)||0) * (parseFloat(it.precio_unitario)||0), 0);
  const el = document.getElementById('cotizadorTotal');
  if (el) el.textContent = money(total);
  return total;
}

// ── Cotizador: imágenes de referencia del jefe ────────────────
function renderCotizadorImagenesJefe() {
  const wrap = document.getElementById('cotizadorImagenesJefeWrap');
  if (!wrap) return;
  wrap.innerHTML = (window._cotizadorImagenesJefe || []).map(im =>
    `<a href="${im.url_imagen}" target="_blank" rel="noopener"><img src="${im.url_imagen}" alt="Referencia" style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid var(--border);"></a>`
  ).join('');
}

async function subirImagenesCotizador(files, cotId, carpeta) {
  if (!firebaseStorage && typeof initFirebase === 'function') initFirebase();
  if (!firebaseStorage) throw new Error('Firebase Storage no disponible.');
  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
  const ts = Date.now();
  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!ALLOWED_MIME.includes(file.type)) throw new Error(`Archivo "${file.name}" no es una imagen válida (jpg/png/webp).`);
    const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
    const path = `cotizaciones/${cotId}/${carpeta}/${ts}-${i}.${ext}`;
    const snap = await firebaseStorage.ref(path).put(file);
    urls.push(await snap.ref.getDownloadURL());
  }
  return urls;
}

// ── Sube la nota de voz si se grabó una nueva; si no, decide si hay que
// enviar el campo: undefined = sin cambios (no tocar lo guardado), '' = el
// jefe la borró y no regrabó (limpiar), url = nueva grabación subida. ──
async function _cotObtenerAudioUrl(id) {
  const blob = window._cotGrabador?.getBlob();
  if (blob) {
    if (!firebaseStorage && typeof initFirebase === 'function') initFirebase();
    const ext = (blob.type.split('/')[1] || 'webm').split(';')[0];
    const ref = firebaseStorage.ref(`cotizaciones/${id}/jefe/audio-${Date.now()}.${ext}`);
    const snap = await ref.put(blob);
    return await snap.ref.getDownloadURL();
  }
  const teniaAudio = !!(window._cotizadorCot?.audio_respuesta_url);
  const preview = document.getElementById('cot_audio_preview');
  if (teniaAudio && preview && preview.style.display === 'none') return '';
  return undefined;
}

// ── Guardar borrador (sin cambiar de estado) ──────────────────
async function guardarCamposCotizacion(id) {
  const fechaEnt = document.getElementById('cot_fecha_entrega')?.value || '';
  const notas    = document.getElementById('cot_notas')?.value?.trim() || '';
  const desc     = document.getElementById('cot_desc_respuesta')?.value?.trim() || '';

  const inputImg = document.getElementById('cotizadorImgInput');
  if (inputImg?.files?.length) {
    try {
      const urls = await subirImagenesCotizador(inputImg.files, id, 'jefe');
      for (const url of urls) {
        const r = await apiFetch(`${API_BASE}/cotizaciones.php?action=agregar_imagen&id=${id}`, {
          method: 'POST', body: JSON.stringify({ url_imagen: url, tipo: 'jefe_propuesta' }),
        });
        if (r.success) window._cotizadorImagenesJefe.push({ url_imagen: url, tipo: 'jefe_propuesta' });
      }
      renderCotizadorImagenesJefe();
      inputImg.value = '';
    } catch (e) {
      showNotification('<i data-lucide="x"></i> ' + e.message, 'error');
    }
  }

  // Incluir las partidas actuales del cotizador — así este mismo botón sirve
  // para "perfeccionar" una cotización ya aceptada por el cliente (ajustar
  // partidas/precio) sin cambiar el estado ni volver a notificarlo.
  const items = (window._cotizadorItems || []).filter(it => it.nombre && it.cantidad > 0);
  const audioUrl = await _cotObtenerAudioUrl(id);

  const data = await apiFetch(`${API_BASE}/cotizaciones.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      descripcion_respuesta: desc || null,
      notas_admin: notas || null,
      fecha_entrega_estimada: fechaEnt || null,
      items: items.length ? items.map(it => ({ clave: it.clave || it.nombre, nombre: it.nombre, cantidad: it.cantidad, unidad: it.unidad, precio_unitario: it.precio_unitario })) : undefined,
      audio_respuesta_url: audioUrl,
    }),
  });
  if (data.success) showNotification('<i data-lucide="save"></i> Borrador guardado', 'success');
  else showNotification(data.error || 'Error al guardar', 'error');
}

// ── Generar PDF y responder al cliente ─────────────────────────
async function generarPDFCotizacion(id) {
  const total   = calcularTotalCotizador();
  const items   = (window._cotizadorItems || []).filter(it => it.nombre && it.cantidad > 0);
  const desc    = document.getElementById('cot_desc_respuesta')?.value?.trim() || '';
  const notas   = document.getElementById('cot_notas')?.value?.trim() || '';
  const fechaVisita = document.getElementById('cot_fecha_visita')?.value || '';
  const horaVisita  = document.getElementById('cot_hora_visita')?.value?.trim() || '';
  const instalacion = document.getElementById('cot_requiere_instalacion')?.value === '1';
  const fechaEnt    = document.getElementById('cot_fecha_entrega')?.value || '';
  const cot = window._cotizadorCot || {};

  if (items.length < 1) { showNotification('<i data-lucide="triangle-alert"></i> Agrega al menos una partida.', 'error'); return; }
  if (desc.length < 10)  { showNotification('<i data-lucide="triangle-alert"></i> Escribe el mensaje/propuesta para el cliente.', 'error'); return; }
  if (total <= 0)         { showNotification('<i data-lucide="triangle-alert"></i> El total debe ser mayor a cero.', 'error'); return; }

  const btn = document.getElementById('btnResponderCliente');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="wh-icon-spin" data-lucide="loader-circle"></i> Generando PDF...'; }

  try {
    // Subir imágenes pendientes (si el jefe eligió archivos pero no dio "Guardar borrador")
    const inputImg = document.getElementById('cotizadorImgInput');
    if (inputImg?.files?.length) {
      const urls = await subirImagenesCotizador(inputImg.files, id, 'jefe');
      for (const url of urls) {
        await apiFetch(`${API_BASE}/cotizaciones.php?action=agregar_imagen&id=${id}`, {
          method: 'POST', body: JSON.stringify({ url_imagen: url, tipo: 'jefe_propuesta' }),
        });
      }
    }

    // ── Armar PDF con jsPDF ──
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.setTextColor(139, 105, 20);
    doc.text('Wooden House — Propuesta de Cotización', 14, 18);
    doc.setFontSize(11); doc.setTextColor(60, 60, 60);
    doc.text(`Folio: ${cot.numero_cotizacion || ''}`, 14, 28);
    doc.text(`Cliente: ${cot.nombre_cliente || ''}`, 14, 34);
    doc.text(`Correo: ${cot.correo_cliente || ''}   Tel: ${cot.telefono_cliente || ''}`, 14, 40);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, 14, 46);

    let y = 58;
    doc.setFontSize(12); doc.setTextColor(139, 105, 20);
    doc.text('Partidas cotizadas', 14, y); y += 6;
    doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    doc.text('Concepto', 14, y); doc.text('Cant.', 110, y); doc.text('Unidad', 130, y); doc.text('P. Unit.', 152, y); doc.text('Subtotal', 178, y);
    y += 4; doc.setDrawColor(200); doc.line(14, y, 196, y); y += 6;
    items.forEach(it => {
      const sub = (it.cantidad||0) * (it.precio_unitario||0);
      doc.text(String(it.nombre).substring(0, 42), 14, y);
      doc.text(String(it.cantidad), 110, y);
      doc.text(String(it.unidad), 130, y);
      doc.text(`$${Number(it.precio_unitario).toFixed(2)}`, 152, y);
      doc.text(`$${sub.toFixed(2)}`, 178, y);
      y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    y += 4; doc.setDrawColor(200); doc.line(14, y, 196, y); y += 8;
    doc.setFontSize(13); doc.setTextColor(139, 105, 20);
    doc.text(`TOTAL: $${total.toLocaleString('es-MX', {minimumFractionDigits:2})} MXN`, 14, y); y += 12;

    doc.setFontSize(11); doc.setTextColor(60, 60, 60);
    doc.text('Descripción de la propuesta:', 14, y); y += 6;
    doc.setFontSize(10);
    const descLines = doc.splitTextToSize(desc, 180);
    doc.text(descLines, 14, y); y += descLines.length * 5 + 6;

    if (fechaVisita) { doc.text(`Visita programada: ${fechaVisita}${horaVisita ? ' — ' + horaVisita : ''}`, 14, y); y += 6; }
    doc.text(`Instalación: ${instalacion ? 'Incluida' : 'No incluida'}`, 14, y); y += 6;
    if (fechaEnt) { doc.text(`Entrega estimada: ${fechaEnt}`, 14, y); y += 6; }

    const pdfBlob = doc.output('blob');

    // ── Subir PDF a Storage ──
    if (!firebaseStorage && typeof initFirebase === 'function') initFirebase();
    const path = `cotizaciones/${id}/propuesta_${cot.numero_cotizacion || id}.pdf`;
    const snap = await firebaseStorage.ref(path).put(pdfBlob, { contentType: 'application/pdf' });
    const pdfUrl = await snap.ref.getDownloadURL();
    const audioUrl = await _cotObtenerAudioUrl(id);

    // ── Guardar todo y disparar el email al cliente ──
    const data = await apiFetch(`${API_BASE}/cotizaciones.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        estado: 'respondida',
        items: items.map(it => ({ clave: it.clave || it.nombre, nombre: it.nombre, cantidad: it.cantidad, unidad: it.unidad, precio_unitario: it.precio_unitario })),
        descripcion_respuesta: desc,
        notas_admin: notas || null,
        fecha_visita: fechaVisita || null,
        hora_visita: horaVisita || null,
        requiere_instalacion: instalacion,
        fecha_entrega_estimada: fechaEnt || null,
        pdf_url: pdfUrl,
        audio_respuesta_url: audioUrl,
      }),
    });
    if (data.success) {
      showNotification('<i data-lucide="circle-check"></i> Propuesta enviada al cliente', 'success');
      closeModal('adminCotDetalleModal');
      cargarCotizacionesAPI();
    } else {
      showNotification('<i data-lucide="circle-x"></i> ' + (data.error || 'Error al enviar'), 'error');
    }
  } catch (e) {
    showNotification('<i data-lucide="circle-x"></i> ' + (e.message || 'Error al generar el PDF'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="send"></i> Responder al cliente (genera PDF)'; }
  }
}


// ── Cotizaciones (admin) — datos reales de la API ───────────
async function cargarCotizacionesAPI() {
  const tbody = document.getElementById('cotizacionesAdminBody') ||
                document.querySelector('#cotizaciones-section tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted)"><i class="wh-icon-spin" data-lucide="loader-circle"></i> Cargando...</td></tr>';

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
          <td>${cid ? `<span class="status-badge status-active" style="font-size:10px;padding:2px 8px;"><i data-lucide="user-check"></i> #${cid}</span>` : '<span style="color:var(--muted);font-size:11px;">—</span>'}</td>
          <td>${escapeHtml(c.correo_cliente || '')}</td>
          <td>${escapeHtml(tipo)}</td>
          <td>${escapeHtml(fecha)}</td>
          <td><span class="status-badge ${cls}">${label}</span></td>
          <td>
            <button data-call="verDetalleCotAdmin" data-args="[${c.id}]" class="btn btn-primary btn-small">
              <i data-lucide='eye'></i> Ver y gestionar
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

// El cliente ya confirmó (estado 'aceptada') y el jefe ya perfeccionó lo que
// hiciera falta (guardarCamposCotizacion) — esto crea el pedido real.
async function convertirCotizacionAPedido(id) {
  if (!confirm('¿Enviar esta cotización a producción? Se creará un pedido nuevo como "pendiente".')) return;
  const data = await apiFetch(`${API_BASE}/cotizaciones.php?action=convertir_pedido&id=${id}`, { method: 'POST' });
  if (data.success) {
    showNotification(`<i data-lucide="circle-check"></i> Pedido ${data.numero_pedido} creado`, 'success');
    closeModal('adminCotDetalleModal');
    cargarCotizacionesAPI();
  } else {
    showNotification('<i data-lucide="x"></i> ' + (data.error || 'Error al convertir'), 'error');
  }
}

// Transiciones simples (en_revision, cancelada) — enviar la propuesta al
// cliente (estado 'respondida') se hace desde generarPDFCotizacion(), que
// arma el cotizador completo y no cabe en un cambio de estado suelto.
async function cambiarEstadoCotAdmin(id, estado) {
  const data = await apiFetch(`${API_BASE}/cotizaciones.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ estado }),
  });

  if (data.success) {
    const lbl = {
      nueva:'Nueva', en_revision:'En Revisión', cancelada:'Cancelada',
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
      // Bypass SOLO en dev local (nunca es cierto en el dominio real) — permite
      // probar el panel con una sesión PHP directa, sin Firebase Auth real.
      const _esLocalDev = ['127.0.0.1', 'localhost'].includes(location.hostname);
      if (!user && !_esLocalDev) {
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
  const area   = rol === 'empleado' ? (document.getElementById('emp_area')?.value || '') : '';
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

  if (btn) { btn.disabled = true; btn.innerHTML = isEdit ? '<i class="wh-icon-spin" data-lucide="loader-circle"></i> Guardando...' : '<i class="wh-icon-spin" data-lucide="loader-circle"></i> Enviando...'; }

  try {
    if (isEdit) {
      // Edición: solo nombre y rol (el correo no se cambia para no romper Firebase)
      const data = await apiFetch(`${API_BASE}/empleados.php?id=${empId}`, {
        method: 'PUT',
        body: JSON.stringify({ nombre_completo: nombre, correo, rol, area }),
      });
      if (!data.success) throw new Error(data.error || 'Error al actualizar');
      showNotification('<i data-lucide="circle-check"></i> Empleado actualizado', 'success');
      closeModal('nuevoEmpleado');
      cargarEmpleadosAPI();

    } else {
      // Invitación: el admin NO toca contraseñas — el empleado la crea por su cuenta
      const data = await apiFetch(`${API_BASE}/invitaciones.php?action=crear`, {
        method: 'POST',
        body: JSON.stringify({ nombre_completo: nombre, correo, rol, area }),
      });
      if (!data.success) throw new Error(data.error || 'Error al enviar la invitación');

      if (infoBox) {
        infoBox.innerHTML = `<i data-lucide="circle-check"></i> ${data.mensaje || 'Invitación enviada.'}`;
        infoBox.style.display = '';
      }
      showNotification('<i data-lucide="send"></i> Invitación enviada', 'success');
      // No cerramos el modal de inmediato para que el admin vea la confirmación
      setTimeout(() => { closeModal('nuevoEmpleado'); cargarEmpleadosAPI(); }, 2000);
    }

  } catch(e) {
    showErr(e.message || 'Error desconocido');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = isEdit
        ? '<i data-lucide="save"></i> Guardar cambios'
        : '<i data-lucide="send"></i> Enviar invitación';
    }
  }
}

function sincronizarAreaGroupVisible() {
  const rolSelect = document.getElementById('emp_rol');
  const grupo = document.getElementById('emp_area_group');
  if (!rolSelect || !grupo) return;
  grupo.style.display = rolSelect.value === 'empleado' ? '' : 'none';
}

function abrirEditarEmpleado(id, nombre, correo, rol, area) {
  document.getElementById('emp_mode').value   = 'edit';
  document.getElementById('emp_id').value     = id;
  document.getElementById('emp_nombre').value = nombre;
  document.getElementById('emp_correo').value = correo;
  const rolSelect = document.getElementById('emp_rol');
  rolSelect.querySelectorAll('option[data-temp-admin]').forEach(o => o.remove());
  rolSelect.value = rol;
  const areaSelect = document.getElementById('emp_area');
  if (areaSelect) areaSelect.value = area || '';
  sincronizarAreaGroupVisible();
  // El <select> no trae la opción "administrador" si quien ve el panel no es
  // administrador, ni "jefe" si quien lo ve no es jefe (nadie puede otorgar
  // un rol por encima o igual al suyo salvo esos dos casos) — pero si la
  // cuenta que se edita YA tiene ese rol, hay que poder mostrarla igual sin
  // degradarla por accidente al guardar. Se agrega la opción solo para
  // reflejar el valor actual, deshabilitada (no se puede reasignar desde aquí).
  if (rolSelect.value !== rol && (rol === 'administrador' || rol === 'jefe')) {
    const opt = document.createElement('option');
    opt.value = rol;
    opt.textContent = (rol === 'administrador' ? 'Administrador' : 'Jefe') + ' (no puedes reasignar este rol)';
    opt.disabled = true;
    opt.dataset.tempAdmin = '1';
    rolSelect.appendChild(opt);
    rolSelect.value = rol;
  }
  document.getElementById('empModalTitle').textContent = 'Editar Empleado';
  const help = document.getElementById('emp_correo_help');
  if (help) help.textContent = 'El correo no se puede cambiar aquí (está vinculado a Firebase).';
  document.getElementById('emp_correo').readOnly = true;
  const btn = document.getElementById('emp_btn_guardar');
  if (btn) btn.innerHTML = '<i data-lucide="save"></i> Guardar cambios';
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
  document.getElementById('emp_rol').querySelector('option[data-temp-admin]')?.remove();
  document.getElementById('emp_rol').value    = 'empleado';
  const areaSelect = document.getElementById('emp_area');
  if (areaSelect) areaSelect.value = '';
  sincronizarAreaGroupVisible();
  document.getElementById('empModalTitle').textContent = 'Invitar Empleado';
  const help = document.getElementById('emp_correo_help');
  if (help) help.textContent = 'Se enviará un enlace de activación a este correo.';
  const btn = document.getElementById('emp_btn_guardar');
  if (btn) btn.innerHTML = '<i data-lucide="send"></i> Enviar invitación';
  document.getElementById('emp_error')?.style && (document.getElementById('emp_error').style.display = 'none');
  document.getElementById('emp_info')?.style  && (document.getElementById('emp_info').style.display  = 'none');
  openModal('nuevoEmpleado');
}

window.desactivarEmpleado       = desactivarEmpleado;
window.guardarEmpleado          = guardarEmpleado;
window.abrirEditarEmpleado      = abrirEditarEmpleado;
window.abrirNuevoEmpleado       = abrirNuevoEmpleado;
document.getElementById('emp_rol')?.addEventListener('change', sincronizarAreaGroupVisible);

// ── CAPACIDAD DEL TALLER ─────────────────────────────────────────
const API_DISP = `${API_BASE}/disponibilidad.php`;
const API_BLOQ = `${API_BASE}/dias_bloqueados.php`;

async function cargarCapacidad() {
  const grid = document.getElementById('capacidadGrid');
  if (!grid) return;

  grid.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px;grid-column:1/-1;"><i class="wh-icon-spin" data-lucide="loader-circle"></i> Cargando carga del taller...</div>';

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
        ? 'background:var(--chip);border:2px solid var(--border);'
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
          ? '<div style="font-size:10px;color:var(--muted);"><i data-lucide="lock"></i> Bloqueado</div>'
          : `<div style="height:4px;background:var(--border);border-radius:2px;margin-bottom:4px;overflow:hidden;">
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
      <i data-lucide="circle-alert"></i> Error: ${e.message}</div>`;
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
    const warn  = b.tiene_pedidos ? ' <i data-lucide="triangle-alert" style="color:var(--warn);" title="Tiene pedidos asignados"></i>' : '';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--bg);border-radius:8px;font-size:12px;">
      <div>
        <strong style="color:var(--muted2);">${fecha}</strong>${warn}
        <div style="color:var(--muted);font-size:11px;">${b.motivo}</div>
      </div>
      <button data-call="desbloquearDia" data-args='["${b.fecha}"]'
        style="background:transparent;border:1px solid var(--danger);color:var(--danger);padding:2px 8px;border-radius:6px;font-size:10px;cursor:pointer;">
        <i data-lucide="lock-open"></i>
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
    else showNotification(`<i data-lucide="lock"></i> Día ${fecha} bloqueado`, 'success');
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
    showNotification(`<i data-lucide="lock-open"></i> Día ${fecha} desbloqueado`, 'success');
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
// ── AUTO-POLLING silencioso ──────────────────────────────────────────
// Refresca la sección visible automáticamente, igual que el panel empleado.
// Sin necesidad de que el administrador recargue la página manualmente.
// Se salta el ciclo por completo si hay un modal abierto o el foco está en
// un campo de formulario — un re-render de la tabla en ese momento borraría
// lo que se está escribiendo/editando, que es justo lo que no debe pasar.
function _autoRefreshBloqueado() {
  if (document.querySelector('.modal.active')) return true;
  const activo = document.activeElement;
  if (activo && /^(INPUT|TEXTAREA|SELECT)$/.test(activo.tagName)) return true;
  return false;
}

function _autoRefreshAdmin() {
  if (_autoRefreshBloqueado()) return;
  const section = window._currentSection || 'dashboard';
  try {
    if      (section === 'pedidos'      && typeof cargarPedidosAPI === 'function')          cargarPedidosAPI();
    else if (section === 'cotizaciones' && typeof cargarCotizacionesAPI === 'function')     cargarCotizacionesAPI();
    else if (section === 'citas'        && typeof cargarCitasCalendarioAPI === 'function')  cargarCitasCalendarioAPI();
    else if (section === 'catalogo'     && typeof cargarProductosAPI === 'function')        cargarProductosAPI().then(() => { if(typeof renderCatalogo==='function') renderCatalogo(); });
    else if (section === 'empleados'    && typeof cargarEmpleadosAPI === 'function')        cargarEmpleadosAPI();
    else if (section === 'reportes'     && typeof cargarReportesAPI === 'function')         cargarReportesAPI();
    else if (section === 'dashboard'    && typeof refreshKPIsFromAPI === 'function') {
      refreshKPIsFromAPI();
      // Refresca el calendario cada 90 s mientras el admin está en el dashboard
      if (Date.now() - _calAdmLastLoaded > 90_000) {
        refrescarCalendarioAdmin(true);
      }
    }
  } catch(e) { console.warn('[autoRefresh] Error en sección', section, e); }
}

document.addEventListener('DOMContentLoaded', () => {
  // Sección inicial: dashboard solo existe para jefe; administrador entra
  // directo a Pedidos (ver panel_administrador.php, no tiene Dashboard).
  window._currentSection = window.WH_ES_JEFE ? 'dashboard' : 'pedidos';

  // Iniciar ciclo de auto-polling
  window._adminRefreshInterval = setInterval(_autoRefreshAdmin, 45000);

  // Pausar cuando la pestaña no es visible, reanudar al volver
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(window._adminRefreshInterval);
    } else {
      _autoRefreshAdmin();
      window._adminRefreshInterval = setInterval(_autoRefreshAdmin, 45000);
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
    <i class="wh-icon-spin" data-lucide="loader-circle"></i> Cargando...
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
        <td style="font-weight:700;color:var(--accent);">${window.WH_VE_MONTOS ? money(c.total_gastado) : "—"}</td>
        <td style="font-size:12px;color:var(--muted);">${(c.fecha_registro || '').substring(0, 10)}</td>
        <td>
          <button class="btn btn-secondary btn-small" data-call="verDetalleCliente" data-args="[${c.id}]" title="Ver historial">
            <i data-lucide="eye"></i>
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
        btnPrev.innerHTML = '<i data-lucide="chevron-left"></i> Anterior';
        btnPrev.onclick = () => { _clientesOffset -= _clientesLimit; cargarClientesAdmin(); };
        pagDiv.appendChild(btnPrev);
      }
      if ((_clientesOffset + _clientesLimit) < total) {
        const btnNext = document.createElement('button');
        btnNext.className = 'btn btn-secondary btn-small';
        btnNext.innerHTML = 'Siguiente <i data-lucide="chevron-right"></i>';
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
    body.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--danger);">${escapeHtml(e.message)}</td></tr>`;
  }
}

async function verDetalleCliente(id) {
  openModal('clienteDetalleModal');
  const body = document.getElementById('clienteDetalleBody');
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);"><i class="wh-icon-spin icon-2x" data-lucide="loader-circle"></i></div>';

  try {
    const data = await apiFetch(`${API_BASE}/clientes.php?id=${id}`);
    if (!data.success) throw new Error(data.message || 'Error');
    const c = data.cliente;
    const pedidos = data.pedidos || [];
    const cots    = data.cotizaciones || [];

    const estLabels = ESTADO_PEDIDO_LABELS;
    const estColors = { pendiente:'var(--warn)', anticipo_pagado:'var(--warn)', pagado:'var(--accent)',
                        listo_para_produccion:'#4a7c8b', en_produccion:'#4a7c8b', alistando_pedido:'#2a8e6e',
                        en_camino_instalacion:'#1e7c5a', finalizado:'var(--muted)', cancelado:'var(--danger)' };

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
          <i data-lucide="box"></i> Pedidos (${pedidos.length})
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
              <td style="padding:8px;text-align:right;font-weight:700;color:var(--accent);">${window.WH_VE_MONTOS ? money(p.total) : '—'}</td>
              <td style="padding:8px;color:var(--muted);">${(p.fecha_creacion||'').substring(0,10)}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : '<p style="color:var(--muted);font-size:13px;">Sin pedidos registrados</p>'}
      </div>

      ${cots.length ? `<div style="border-top:1px solid var(--border);padding-top:16px;margin-top:8px;">
        <h4 style="font-size:13px;color:var(--accent);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">
          <i data-lucide="briefcase"></i> Cotizaciones (${cots.length})
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
    body.innerHTML = `<p style="color:var(--danger);padding:20px;">${escapeHtml(e.message)}</p>`;
  }
}

// ════════════════════════════════════════════════════════════════
// MÓDULO: OFERTAS & MARKETING
// ════════════════════════════════════════════════════════════════

async function cargarOfertasAdmin() {
  const body = document.getElementById('ofertasAdminBody');
  if (!body) return;

  body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--muted);">
    <i class="wh-icon-spin" data-lucide="loader-circle"></i> Cargando...
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
            <i data-lucide="pen"></i>
          </button>
          <button class="btn btn-danger btn-small" data-call="eliminarOferta" data-args="[${o.id}]" title="Eliminar">
            <i data-lucide="trash-2"></i>
          </button>
        </td>
      </tr>`;
    }).join('');

  } catch (e) {
    body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--danger);">${escapeHtml(e.message)}</td></tr>`;
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
    if (title) title.innerHTML = '<i data-lucide="tag"></i> Nueva Oferta';
  } else if (mode === 'edit' && id) {
    if (title) title.innerHTML = '<i data-lucide="pen"></i> Editar Oferta';
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
  btn.innerHTML = '<i class="wh-icon-spin" data-lucide="loader-circle"></i> Guardando...';

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
    btn.innerHTML = '<i data-lucide="save"></i> Guardar Oferta';
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

window.openModal              = openModal;
window.closeModal             = closeModal;
window.verDetallePedidoAdmin  = verDetallePedidoAdmin;
window.marcarSaldoManualAdmin = marcarSaldoManualAdmin;
window.verDetalleCitaAdmin    = verDetalleCitaAdmin;
window.cargarPedidosAPI       = cargarPedidosAPI;
window.actualizarEstadoPedido = actualizarEstadoPedido;
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
window.prevMonth              = prevMonth;
window.nextMonth              = nextMonth;
window.generarRutaDiaAdmin    = generarRutaDiaAdmin;

// ── Helpers de ruta (Admin) ───────────────────────────────────────────────────

const _ORIGEN_ADM = {
  label:   'Ignacio Zaragoza 36, La Florida, San Pedro Tlaquepaque, Jal.',
  address: 'Ignacio Zaragoza 36, La Florida, 45236 San Pedro Tlaquepaque, Jal.',
  lat: 20.64531, lng: -103.32675,
};

function _haversineAdm(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function _getPosAdm() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, enableHighAccuracy: false }
    );
  });
}

function _sortDistAdm(stops, oLat, oLng) {
  const w = stops.filter(s => s.lat != null && s.lng != null);
  const n = stops.filter(s => s.lat == null || s.lng == null);
  w.forEach(s => { s._distKm = _haversineAdm(oLat, oLng, s.lat, s.lng); });
  w.sort((a, b) => a._distKm - b._distKm);
  return [...w, ...n];
}

function _buildTimedAdm(stops, oLat, oLng) {
  function parseHoraMs(h) {
    const m = ('' + h).split('-')[0].trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const d = new Date(); d.setHours(+m[1], +m[2], 0, 0); return d.getTime();
  }
  function fmtH(ms) { const d=new Date(ms); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }

  const citasH=[], citasN=[], pGPS=[], sinGPS=[];
  stops.forEach(s => {
    if (s.tipo === 'cita') {
      const t = parseHoraMs(s.hora);
      (t != null ? citasH : citasN).push(t != null ? { ...s, _timeMs: t } : s);
    } else {
      (s.lat != null && s.lng != null ? pGPS : sinGPS).push(s);
    }
  });

  if (!citasH.length) return _sortDistAdm(stops, oLat, oLng);
  citasH.sort((a, b) => a._timeMs - b._timeMs);

  const anchors = [{ lat: oLat, lng: oLng }, ...citasH.map(c => ({ lat: c.lat, lng: c.lng }))];
  const slots = anchors.map(() => []);
  pGPS.forEach(p => {
    let best=0, bestD=Infinity;
    anchors.forEach((a, i) => {
      if (a.lat==null||a.lng==null) return;
      const d = _haversineAdm(a.lat, a.lng, p.lat, p.lng);
      if (d < bestD) { bestD=d; best=i; }
    });
    p._distKm = bestD < Infinity ? bestD : null;
    slots[best].push(p);
  });
  slots.forEach((slot, i) => { const a=anchors[i]; if(a.lat!=null) slot.sort((x,y)=>(x._distKm??999)-(y._distKm??999)); });
  citasH.forEach((c, i) => { const a=anchors[i]; if(a.lat!=null&&c.lat!=null) c._distKm=_haversineAdm(a.lat,a.lng,c.lat,c.lng); });
  const lastA=anchors[anchors.length-1];
  citasN.forEach(c => { if(lastA.lat!=null&&c.lat!=null) c._distKm=_haversineAdm(lastA.lat,lastA.lng,c.lat,c.lng); });
  citasN.sort((a,b)=>(a._distKm??999)-(b._distKm??999));

  const h = label => ({ tipo: '_header', label });
  const route = [];
  if (slots[0].length) { route.push(h(`Antes de las ${fmtH(citasH[0]._timeMs)}`)); route.push(...slots[0]); }
  citasH.forEach((cita, i) => {
    route.push(cita);
    const ns = slots[i+1];
    if (ns.length) {
      route.push(h(i+1 < citasH.length ? `Entre las ${fmtH(cita._timeMs)} y las ${fmtH(citasH[i+1]._timeMs)}` : `Después de las ${fmtH(cita._timeMs)}`));
      route.push(...ns);
    }
  });
  if (citasN.length) { route.push(h('Citas sin horario definido')); route.push(...citasN); }
  route.push(...sinGPS);
  return route;
}

async function generarRutaDiaAdmin(fecha) {
  if (!fecha) fecha = _admSelectedDate || new Date().toISOString().substring(0, 10);

  const label = document.getElementById('admRutaDiaFechaLabel');
  const body  = document.getElementById('admRutaDiaBody');
  const mBtn  = document.getElementById('admRutaDiaMapsBtn');
  if (label) label.textContent = fecha;
  if (body)  body.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);"><i class="wh-icon-spin icon-xl" data-lucide="loader-circle"></i><br><span style="font-size:13px;margin-top:10px;display:block;">Recopilando paradas...</span></div>';
  if (mBtn)  mBtn.style.display = 'none';
  openModal('admRutaDiaModal');

  try {
    const stops = [];

    // Citas del día (no canceladas) — datos ya en caché, incluye lat/lng
    _citasCache.filter(e => e.date === fecha && !['cancelada'].includes(e.datos?.estado || '')).forEach(e => {
      const c = e.datos || {};
      const dir = [c.direccion, c.colonia ? `Col. ${c.colonia}` : '', c.ciudad, c.cp ? `CP ${c.cp}` : ''].filter(Boolean).join(', ');
      if (!dir && !c.lat) return;
      const tipoLabel = c.tipo === 'medicion' ? 'Medición' : c.tipo === 'instalacion' ? 'Instalación' : 'Cita';
      stops.push({
        tipo: 'cita', icon: '📅',
        label: `${tipoLabel}: ${c.nombre_cliente || ''}`,
        hora:  e.time || '',
        address: dir,
        lat: c.lat ? parseFloat(c.lat) : null,
        lng: c.lng ? parseFloat(c.lng) : null,
      });
    });

    // Pedidos en_camino_instalacion con envío — datos ya en caché
    _pedidosCalCache.filter(e => e.date === fecha && e.datos?.estado === 'en_camino_instalacion' && e.datos?.tipo_entrega === 'envio').forEach(e => {
      const p = e.datos || {};
      const dir = [p.direccion_envio, p.colonia_envio ? `Col. ${p.colonia_envio}` : '', p.ciudad_envio, p.cp_envio ? `CP ${p.cp_envio}` : ''].filter(Boolean).join(', ');
      if (!dir && !p.lat) return;
      stops.push({
        tipo: 'pedido', icon: '📦',
        label: `${p.numero_pedido}: ${p.nombre_cliente}`,
        hora: '',
        address: dir,
        lat: p.lat ? parseFloat(p.lat) : null,
        lng: p.lng ? parseFloat(p.lng) : null,
      });
    });

    if (!stops.length) {
      if (body) body.innerHTML = `<div style="padding:28px;text-align:center;color:var(--muted);">
        <i data-lucide="map-pin" style="font-size:2rem;margin-bottom:10px;display:block;opacity:.35;"></i>
        No hay paradas para <strong>${fecha}</strong>.<br>
        <span style="font-size:12px;margin-top:6px;display:block;">Solo se incluyen pedidos "Listo para entrega" y citas con domicilio.</span>
      </div>`;
      return;
    }

    const pos = await _getPosAdm();
    let oLat, oLng, originLabel, originStr;
    if (pos) {
      oLat = pos.lat; oLng = pos.lng;
      originStr   = `${pos.lat},${pos.lng}`;
      originLabel = `<i data-lucide="locate" style="color:var(--ok);"></i> Tu ubicación actual (GPS)`;
    } else {
      oLat = _ORIGEN_ADM.lat; oLng = _ORIGEN_ADM.lng;
      originStr   = _ORIGEN_ADM.address;
      originLabel = `<i data-lucide="store" style="color:var(--accent);"></i> ${_ORIGEN_ADM.label}`;
    }

    const sorted   = _buildTimedAdm(stops, oLat, oLng);
    const realStops = sorted.filter(s => s.tipo !== '_header');

    let stopNum = 0;
    const stopsHtml = sorted.map(s => {
      if (s.tipo === '_header') {
        return `<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.9px;padding:10px 2px 5px;border-top:1px solid var(--border);margin-top:6px;"><i data-lucide="clock" style="margin-right:4px;"></i>${escapeHtml(s.label)}</div>`;
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
              ? `<span style="font-size:10px;background:#1b5e2020;color:#2e7d32;border-radius:10px;padding:1px 8px;"><i data-lucide="map-pin"></i> GPS exacto</span>`
              : `<span style="font-size:10px;background:var(--bg);color:var(--muted);border-radius:10px;padding:1px 8px;"><i data-lucide="search"></i> Búsqueda por dirección</span>`}
            ${distBadge}
          </div>
        </div>
      </div>`;
    }).join('');

    const hasCitasH = stops.some(s => s.tipo === 'cita' && s.hora);
    if (body) body.innerHTML = `
      <div style="padding:10px 12px;background:var(--bg);border-radius:8px;font-size:12px;color:var(--muted2);margin-bottom:12px;">
        <div style="margin-bottom:4px;"><strong>Salida:</strong> ${originLabel}</div>
        ${!pos ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;"><i data-lucide="info"></i> Activa el GPS del dispositivo para partir desde tu ubicación actual.</div>` : ''}
      </div>
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px;padding:0 2px;">
        ${realStops.length} ${realStops.length===1?'parada':'paradas'} · ${hasCitasH ? 'ordenada por horario de citas + proximidad' : 'más cercana a más lejana'}
      </div>
      ${stopsHtml}
      ${realStops.some(s => !s.lat || !s.lng) ? `<div style="margin-top:10px;font-size:11px;color:var(--muted);padding:8px 10px;background:var(--bg);border-radius:6px;"><i data-lucide="info"></i> Google Maps geocodificará las paradas sin coordenadas GPS.</div>` : ''}
    `;

    const waypoints = realStops.map(s => s.lat && s.lng ? `${s.lat},${s.lng}` : s.address).filter(Boolean);
    let mapsUrl;
    if (waypoints.length === 1) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(waypoints[0])}&travelmode=driving`;
    } else {
      const dest = encodeURIComponent(waypoints[waypoints.length - 1]);
      const wpsParam = waypoints.slice(0, -1).length ? '&waypoints=' + waypoints.slice(0, -1).map(encodeURIComponent).join('|') : '';
      mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${dest}${wpsParam}&travelmode=driving`;
    }
    if (mBtn) { mBtn.style.display = ''; mBtn.onclick = () => window.open(mapsUrl, '_blank', 'noopener'); }

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
    ${fotosModeloHtml(i)}`;
}
// Fotos del modelo que trajo el cliente (fuera de catálogo): todas las que
// se subieron; los pedidos viejos solo tienen una (imagen_referencia).
function fotosModeloHtml(i) {
  let fotos = [];
  try { fotos = JSON.parse(i.imagenes_referencia || '[]'); } catch (e) { fotos = []; }
  if (!Array.isArray(fotos) || !fotos.length) fotos = i.imagen_referencia ? [i.imagen_referencia] : [];
  if (!fotos.length) return '';
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">${fotos.map((u, n) =>
    `<a href="${escapeHtml(u)}" target="_blank" rel="noopener"><img src="${escapeHtml(u)}" alt="Foto ${n + 1} del modelo" style="width:84px;height:84px;object-fit:cover;border-radius:6px;border:1px solid var(--border);"></a>`).join('')}</div>`;
}
const _TIPO_PROYECTO_LABELS = { bano: 'Mueble de baño', cocina: 'Cocina a la medida', closet: 'Clóset a la medida' };
function tipoProyectoBadge(tipo) {
  if (!tipo) return '';
  const ico = { bano: 'bath', cocina: 'cooking-pot', closet: 'shirt' }[tipo] || 'box';
  return `<span class="status-badge status-info"><i data-lucide="${ico}"></i> ${escapeHtml(_TIPO_PROYECTO_LABELS[tipo] || tipo)}</span>`;
}

// Estado del pago sin cifras, para quien no ve montos (administrador) —
// mismo criterio que estadoPagoPedido() en includes/auth.php.
function estadoPagoBadge(estado) {
  const map = {
    liquidado:       ['status-completed', 'circle-check', 'Pagado completo'],
    saldo_pendiente: ['status-pending',   'hand-coins',   'Falta pagar una parte'],
    sin_pago:        ['status-cancelled', 'circle-alert', 'Sin pago registrado'],
  };
  const [cls, ico, txt] = map[estado] || map.sin_pago;
  return `<span class="status-badge ${cls}"><i data-lucide="${ico}"></i> ${txt}</span>`;
}

// Corregir el total de un pedido (precio acordado distinto al de los muebles).
// Después, si el cliente ya dejó dinero, se registra con "Registrar pago recibido".
async function editarTotalPedido(id, totalActual, pagado) {
  const nuevo = await pedirMonto({
    titulo: 'Editar total del pedido',
    texto: `Total actual: ${money(totalActual)}${pagado > 0 ? ` · Ya cobrado: ${money(pagado)}` : ''}. Escribe el total acordado con el cliente.`,
    valor: totalActual,
    minimo: Math.max(pagado, 0.01),
  });
  if (nuevo === null) return;
  try {
    const data = await apiFetch(`${API_BASE}/pedidos.php?id=${id}`, { method: 'PUT', body: JSON.stringify({ total: nuevo }) });
    if (data.success) {
      showNotification('Total actualizado', 'success');
      if (typeof verDetallePedidoAdmin === 'function') verDetallePedidoAdmin(id);
      if (typeof cargarPedidosAPI === 'function') cargarPedidosAPI();
    } else {
      showNotification(data.error || 'No se pudo cambiar el total', 'error');
    }
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}
