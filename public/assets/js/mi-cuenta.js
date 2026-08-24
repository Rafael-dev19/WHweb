// mi-cuenta.js — Lógica de la página "Mi cuenta"
(function () {
  'use strict';

  const ESTADO_LABELS = {
    pendiente:              'Pendiente',
    anticipo_pagado:        'Anticipo pagado',
    pagado:                 'Pagado',
    listo_para_produccion:  'En preparación',
    en_produccion:          'En producción',
    alistando_pedido:       'Alistando pedido',
    en_camino_instalacion:  'En camino / instalación',
    finalizado:             'Finalizado',
    cancelado:              'Cancelado',
  };

  function fmt(monto) {
    return '$' + parseFloat(monto || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtFecha(iso) {
    if (!iso) return '—';
    return new Date(iso.replace(' ', 'T')).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /* ── Inicialización ────────────────────────────────────────── */
  async function init() {
    const cliente = await AuthModal.verificar();
    document.getElementById('mcLoading').style.display = 'none';

    if (!cliente) {
      document.getElementById('mcNoAuth').style.display = '';
      return;
    }

    document.getElementById('mcContent').style.display = '';
    _renderHeader(cliente);
    _cargarPedidos(cliente.id);
    _rellenarFormPerfil(cliente);
  }

  /* ── Header ────────────────────────────────────────────────── */
  function _renderHeader(c) {
    document.getElementById('mcAvatar').textContent = (c.nombre || 'U')[0].toUpperCase();
    document.getElementById('mcNombre').textContent = c.nombre || '—';
    document.getElementById('mcCorreo').textContent = c.correo || '—';
  }

  /* ── Pedidos ───────────────────────────────────────────────── */
  async function _cargarPedidos() {
    const wrap = document.getElementById('mcPedidosList');
    try {
      const res    = await fetch('/api/clientes.php?action=mis-pedidos', { credentials: 'same-origin' });
      const data   = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar pedidos');
      const pedidos = data.pedidos || [];

      if (pedidos.length === 0) {
        wrap.innerHTML = `<div class="mc-empty"><i class="fa-solid fa-box-open"></i>Aún no tienes pedidos.<br><a href="/catalogo" style="color:var(--color-primary);margin-top:10px;display:inline-block;">Ver catálogo →</a></div>`;
        return;
      }

      const html = `<div class="mc-pedidos-lista">` +
        pedidos.map(p => {
          const clase = `mc-estado-${p.estado}`;
          return `
          <div class="mc-pedido-card">
            <div>
              <div class="mc-pedido-numero">${p.numero_pedido}</div>
              <div class="mc-pedido-meta">
                <span><i class="fa-solid fa-calendar" style="opacity:.6"></i> ${fmtFecha(p.fecha_creacion)}</span>
                <span><i class="fa-solid fa-box" style="opacity:.6"></i> ${p.cantidad_items || 0} producto(s)</span>
                <span><i class="fa-solid fa-truck" style="opacity:.6"></i> ${p.tipo_entrega === 'recoger' ? 'Recojo en tienda' : 'Envío a domicilio'}</span>
              </div>
              <div style="margin-top:8px;">
                <span class="mc-estado-badge ${clase}">${ESTADO_LABELS[p.estado] || p.estado}</span>
              </div>
            </div>
            <div class="mc-pedido-total">${fmt(p.total)}</div>
          </div>`;
        }).join('') + `</div>`;

      wrap.innerHTML = html;
    } catch (e) {
      wrap.innerHTML = `<div class="mc-empty"><i class="fa-solid fa-triangle-exclamation"></i>${e.message}</div>`;
    }
  }

  /* ── Sanitización de campos del perfil ─────────────────────── */
  function _sanitizeName(val) {
    if (typeof val !== 'string') return '';
    return val.replace(/<[^>]*>/g, '').replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9 .,'\-]/g, '').substring(0, 120).trim();
  }
  function _sanitizePhone(val) {
    if (typeof val !== 'string') return '';
    return val.replace(/[^0-9\s+\-().]/g, '').substring(0, 20).trim();
  }
  /* ── Validación en tiempo real del formulario de perfil ─────── */
  function _initValidacionPerfil() {
    const pfNombre = document.getElementById('pfNombre');
    if (pfNombre) pfNombre.addEventListener('input', function () {
      this.value = this.value.replace(/[<>"'`;\\]/g, '');
    });
    const pfTel = document.getElementById('pfTelefono');
    if (pfTel) pfTel.addEventListener('input', function () {
      this.value = this.value.replace(/[^0-9\s+\-().]/g, '');
    });
  }

  /* ── Guardado parcial genérico (nombre/teléfono o dirección) ─── */
  async function _guardarCampos(body) {
    const alert = document.getElementById('mcPerfilAlert');
    if (alert) alert.className = 'mc-alert';

    const cliente = AuthModal.getCliente();
    if (!cliente) {
      if (alert) { alert.textContent = 'No autenticado.'; alert.className = 'mc-alert error'; }
      return false;
    }

    const csrf = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('XSRF-TOKEN='));
    const csrfToken = csrf ? decodeURIComponent(csrf.split('=')[1]) : '';

    try {
      const res  = await fetch(`/api/clientes.php?id=${cliente.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al guardar');
      if (alert) { alert.textContent = '¡Perfil actualizado correctamente!'; alert.className = 'mc-alert success'; }
      await AuthModal.verificar();
      const c = AuthModal.getCliente();
      if (c) _renderHeader(c);
      return true;
    } catch (err) {
      if (alert) { alert.textContent = err.message; alert.className = 'mc-alert error'; }
      return false;
    }
  }

  /* ── Dirección: mapa dentro de un LockedField ────────────────── */
  let _direccionActual = {};

  function _resumenDireccion(v) {
    if (!v || !v.direccion) return '<span style="color:var(--muted,#888);">Sin dirección guardada.</span>';
    const linea2 = [v.colonia ? 'Col. ' + v.colonia : '', v.ciudad || '', v.cp ? 'CP ' + v.cp : ''].filter(Boolean).join(', ');
    return `<strong>📍 ${v.direccion}</strong>${linea2 ? '<br>' + linea2 : ''}`;
  }

  function _initDireccionPicker(c) {
    _direccionActual = {
      lat: c.lat, lng: c.lng, direccion: c.direccion,
      colonia: c.colonia, ciudad: c.ciudad, municipio: c.municipio, cp: c.cp,
    };
    const wrap = document.getElementById('mcDireccionWrap');
    if (!wrap) return;

    LockedField.init(wrap, {
      hasValue: () => !!_direccionActual.direccion,
      renderLocked(el) {
        el.innerHTML = `<div class="locked-field-summary">${_resumenDireccion(_direccionActual)}</div>`;
      },
      renderUnlocked(el) {
        el.innerHTML = '<div id="mcMapPicker"></div>';
        const mapWrap = document.getElementById('mcMapPicker');
        if (window.MapsPicker && mapWrap) {
          window.MapsPicker.init(mapWrap, {
            onConfirm: (vals) => { _direccionActual = { ..._direccionActual, ...vals }; },
          });
          if (_direccionActual.lat && _direccionActual.lng) {
            window.MapsPicker.setValue(_direccionActual);
          }
        }
      },
      onSave: async () => {
        const vals = (window.MapsPicker && window.MapsPicker.getValues()) || {};
        if (!vals.lat || !vals.lng) {
          alert('Selecciona tu dirección en el buscador o el mapa antes de guardar.');
          return false;
        }
        const ok = await _guardarCampos({
          direccion: vals.direccion, colonia: vals.colonia, municipio: vals.municipio,
          ciudad: vals.ciudad, cp: vals.cp, lat: vals.lat, lng: vals.lng,
        });
        if (ok) _direccionActual = { ..._direccionActual, ...vals };
        return ok;
      },
    });
  }

  /* ── Formulario de perfil (nombre/teléfono) ──────────────────── */
  function _rellenarFormPerfil(c) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set('pfNombre',   c.nombre);
    set('pfTelefono', c.telefono);
    _initValidacionPerfil();
    _initDireccionPicker(c);
  }

  window.mcGuardarPerfil = async function (e) {
    e.preventDefault();
    const alert = document.getElementById('mcPerfilAlert');

    const btn    = document.getElementById('btnGuardarPerfil');
    btn._orig    = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="mc-spinner-sm"></span>Guardando…';

    const nombre   = _sanitizeName(document.getElementById('pfNombre')?.value   || '');
    const telefono = _sanitizePhone(document.getElementById('pfTelefono')?.value || '');

    if (!nombre || nombre.length < 2) {
      alert.textContent = 'El nombre debe tener al menos 2 caracteres y solo puede contener letras.';
      alert.className = 'mc-alert error';
      btn.innerHTML = btn._orig; btn.disabled = false; return;
    }
    if (telefono && telefono.replace(/\D/g, '').length > 0 && telefono.replace(/\D/g, '').length < 10) {
      alert.textContent = 'El teléfono debe tener al menos 10 dígitos.';
      alert.className = 'mc-alert error';
      btn.innerHTML = btn._orig; btn.disabled = false; return;
    }

    await _guardarCampos({ nombre, telefono });
    btn.innerHTML = btn._orig;
    btn.disabled  = false;
  };

  /* ── Tabs ──────────────────────────────────────────────────── */
  window.mcShowTab = function (tab) {
    document.querySelectorAll('.mc-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.mc-tab-content').forEach(c => c.style.display = 'none');
    const el = document.getElementById('mcTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
    if (el) el.style.display = '';
  };

  /* ── Start ─────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', init);

  document.addEventListener('DOMContentLoaded', function () {
    const toggle = document.getElementById('menuToggle');
    const nav    = document.getElementById('navLinks');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open);
      });
    }
    const perfilForm = document.getElementById('mcPerfilForm');
    if (perfilForm) {
      perfilForm.addEventListener('submit', function(e) {
        if (typeof window.mcGuardarPerfil === 'function') window.mcGuardarPerfil(e);
      });
    }
  });

})();
