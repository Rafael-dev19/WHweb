// sse-notificaciones.js — Notificaciones en tiempo real (SSE) para paneles internos
(function () {
  'use strict';

  const ENDPOINT    = '/api/eventos.php';
  const RETRY_MS    = 6000;
  const TOAST_MS    = 9000;

  let es          = null;
  let lastIds     = { lp: 0, lc: 0, lq: 0 };
  let container   = null;
  let retryTimer  = null;

  // ── Contenedor de toasts ──────────────────────────────────────────
  function getContainer() {
    if (container) return container;
    container = document.createElement('div');
    container.id = 'wh-sse-toasts';
    Object.assign(container.style, {
      position:      'fixed',
      top:           '90px',
      right:         '16px',
      zIndex:        '10000',
      display:       'flex',
      flexDirection: 'column',
      gap:           '10px',
      pointerEvents: 'none',
      maxWidth:      '340px',
    });
    document.body.appendChild(container);

    const css = document.createElement('style');
    css.textContent = `
      @keyframes wh-in  { from { transform:translateX(110%); opacity:0 } to { transform:translateX(0); opacity:1 } }
      @keyframes wh-out { from { transform:translateX(0);    opacity:1 } to { transform:translateX(110%); opacity:0 } }
      .wh-toast { animation: wh-in .3s ease; border-radius:12px; padding:14px 16px;
                  box-shadow:0 6px 24px rgba(0,0,0,.18); pointer-events:auto; cursor:pointer; }
      .wh-toast:hover { filter:brightness(1.05); }
    `;
    document.head.appendChild(css);
    return container;
  }

  function showToast(icon, title, body, color) {
    const c     = getContainer();
    const toast = document.createElement('div');
    toast.className = 'wh-toast';
    Object.assign(toast.style, {
      background:   'var(--card, #fff)',
      borderLeft:   `4px solid ${color}`,
      color:        'var(--text, #1a1a1a)',
    });
    toast.innerHTML =
      `<div style="font-size:11px;font-weight:700;color:${color};margin-bottom:5px;">${icon}&nbsp;${title}</div>` +
      `<div style="font-size:13px;line-height:1.4;opacity:.88;">${body}</div>`;

    toast.addEventListener('click', () => dismiss(toast));
    c.appendChild(toast);

    setTimeout(() => dismiss(toast), TOAST_MS);
  }

  function dismiss(el) {
    el.style.animation = 'wh-out .3s ease forwards';
    setTimeout(() => el.remove(), 320);
  }

  // ── Actualizar badge de sección en el menú lateral ────────────────
  function bumpBadge(section) {
    const link = document.querySelector(`[data-section="${section}"]`);
    if (!link) return;
    let badge = link.querySelector('.wh-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'wh-badge';
      Object.assign(badge.style, {
        background:   '#ef4444',
        color:        '#fff',
        borderRadius: '999px',
        fontSize:     '10px',
        fontWeight:   '700',
        padding:      '1px 6px',
        marginLeft:   '6px',
        minWidth:     '18px',
        textAlign:    'center',
        display:      'inline-block',
      });
      badge.textContent = '0';
      link.appendChild(badge);
    }
    badge.textContent = String(parseInt(badge.textContent || '0', 10) + 1);
  }

  // ── Conexión EventSource ──────────────────────────────────────────
  function connect() {
    if (es) { es.close(); es = null; }
    clearTimeout(retryTimer);

    const url = `${ENDPOINT}?lp=${lastIds.lp}&lc=${lastIds.lc}&lq=${lastIds.lq}`;
    es = new EventSource(url);

    es.addEventListener('conectado', e => {
      const d = JSON.parse(e.data);
      // Sincroniza IDs iniciales para no perder eventos pasados ni repetirlos
      if (lastIds.lp === 0) lastIds.lp = d.lp;
      if (lastIds.lc === 0) lastIds.lc = d.lc;
      if (lastIds.lq === 0) lastIds.lq = d.lq;
    });

    es.addEventListener('nuevo_pedido', e => {
      const d = JSON.parse(e.data);
      lastIds.lp = d.id;
      const total = Number(d.total).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
      showToast('🛒', 'Nuevo Pedido', `${escHtml(d.nombre_cliente)}&nbsp;·&nbsp;${total}`, '#22c55e');
      bumpBadge('pedidos');
    });

    es.addEventListener('nueva_cita', e => {
      const d = JSON.parse(e.data);
      lastIds.lc = d.id;
      showToast('📅', 'Nueva Cita', `${escHtml(d.nombre_cliente)}&nbsp;·&nbsp;${d.fecha_cita}`, '#3b82f6');
      bumpBadge('citas');
    });

    es.addEventListener('nueva_cotizacion', e => {
      const d = JSON.parse(e.data);
      lastIds.lq = d.id;
      showToast('📋', 'Nueva Cotización', escHtml(d.nombre_cliente), '#f59e0b');
      bumpBadge('cotizaciones');
    });

    es.onerror = () => {
      es.close();
      es = null;
      retryTimer = setTimeout(connect, RETRY_MS);
    };
  }

  function escHtml(s) {
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Inicio ────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect);
  } else {
    connect();
  }

  // Reconectar al volver de una pestaña en segundo plano
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !es) connect();
  });
})();
