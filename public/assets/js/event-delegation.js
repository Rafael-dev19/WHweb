// event-delegation.js — reemplaza todos los onclick/onchange inline de las páginas
(function () {

  // ── Click delegation ──────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var t;

    // [data-open-modal="id"] → agrega clase 'open' al modal guía flotante
    t = e.target.closest('[data-open-modal]');
    if (t) {
      var el = document.getElementById(t.dataset.openModal);
      if (el) el.classList.add('open');
      return;
    }

    // [data-close-modal="id"] → quita clase 'open' del modal guía flotante
    t = e.target.closest('[data-close-modal]');
    if (t) {
      var el2 = document.getElementById(t.dataset.closeModal);
      if (el2) el2.classList.remove('open');
      return;
    }

    // Backdrop de modal guía: clic fuera del contenido cierra el modal
    t = e.target.closest('.wh-guide-modal');
    if (t && e.target === t) {
      t.classList.remove('open');
      return;
    }

    // [data-close-parent] → elimina el elemento padre (alertas flash)
    t = e.target.closest('[data-close-parent]');
    if (t) {
      var parent = t.parentElement;
      if (parent) parent.remove();
      return;
    }

    // [data-dismiss="modalId"] → closeModal() para paneles admin/empleado
    t = e.target.closest('[data-dismiss]');
    if (t) {
      if (typeof window.closeModal === 'function') window.closeModal(t.dataset.dismiss);
      return;
    }

    // .sidebar-item[data-section] → showSection()
    t = e.target.closest('.sidebar-item[data-section]');
    if (t) {
      if (typeof window.showSection === 'function') window.showSection(t.dataset.section, e);
      return;
    }

    // [data-filter] → filterTable() en paneles
    t = e.target.closest('[data-filter]');
    if (t) {
      if (typeof window.filterTable === 'function') window.filterTable(t.dataset.filter, e);
      return;
    }

    // [data-cat-filter] → filtrarPorCategoria() en catálogo
    t = e.target.closest('[data-cat-filter]');
    if (t) {
      if (typeof window.filtrarPorCategoria === 'function') {
        var catId = t.dataset.catFilter === '' ? null : t.dataset.catFilter;
        window.filtrarPorCategoria(catId, t);
      }
      return;
    }

    // .faq-item → toggleFAQ()
    t = e.target.closest('.faq-item');
    if (t) {
      if (typeof window.toggleFAQ === 'function') window.toggleFAQ(t);
      return;
    }

    // [data-auth-action="method"] → AuthModal[method]()
    t = e.target.closest('[data-auth-action]');
    if (t && window.AuthModal) {
      var action = t.dataset.authAction;
      if (action === 'openAndReload' && typeof AuthModal.open === 'function') {
        AuthModal.open(function () { location.reload(); });
      } else if (typeof AuthModal[action] === 'function') {
        AuthModal[action](t);
      }
      return;
    }

    // [data-entrega="tipo"] → seleccionarEntrega() en carrito
    t = e.target.closest('[data-entrega]');
    if (t) {
      if (typeof window.seleccionarEntrega === 'function') window.seleccionarEntrega(t.dataset.entrega);
      return;
    }

    // [data-instalacion="bool"] → seleccionarInstalacion() en carrito
    t = e.target.closest('[data-instalacion]');
    if (t) {
      if (typeof window.seleccionarInstalacion === 'function') {
        window.seleccionarInstalacion(t.dataset.instalacion === 'true');
      }
      return;
    }

    // [data-tipopago="completo|anticipo"] → seleccionarTipoPago() en carrito
    t = e.target.closest('[data-tipopago]');
    if (t) {
      if (typeof window.seleccionarTipoPago === 'function') window.seleccionarTipoPago(t.dataset.tipopago);
      return;
    }

    // [data-tab-goto="tabName"] → activa el tab directamente
    t = e.target.closest('[data-tab-goto]');
    if (t) {
      var targetTab = t.dataset.tabGoto;
      document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
      var tabContent = document.getElementById('tab-' + targetTab);
      if (tabContent) tabContent.classList.add('active');
      return;
    }

    // Admin: botones de cambio de estado de cita
    t = e.target.closest('[data-admin-cita-estado]');
    if (t) {
      if (typeof window.cambiarEstadoCitaAdmin === 'function') {
        window.cambiarEstadoCitaAdmin(window._admCitaId, t.dataset.adminCitaEstado);
      }
      return;
    }

    // Admin: botones de cambio de estado de cotización
    t = e.target.closest('[data-admin-cot-estado]');
    if (t) {
      if (typeof window.cambiarEstadoCotAdmin === 'function') {
        window.cambiarEstadoCotAdmin(window._admCotId, t.dataset.adminCotEstado);
      }
      return;
    }

    // Empleado: confirmar/completar cita (con cadena de acciones)
    t = e.target.closest('[data-emp-cita-action]');
    if (t) {
      var empAction = t.dataset.empCitaAction;
      if (empAction === 'confirmar' && typeof window.confirmarCita === 'function') {
        window.confirmarCita(window._empCitaId);
        if (typeof window.closeModal === 'function') window.closeModal('empCitaDetalleModal');
        if (typeof window.cargarCitasAPI === 'function') window.cargarCitasAPI();
      } else if (empAction === 'completar' && typeof window.completarCita === 'function') {
        window.completarCita(window._empCitaId);
        if (typeof window.closeModal === 'function') window.closeModal('empCitaDetalleModal');
        if (typeof window.cargarCitasAPI === 'function') window.cargarCitasAPI();
      }
      return;
    }

    // Empleado: cambio de estado de cotización
    t = e.target.closest('[data-emp-cot-estado]');
    if (t) {
      if (typeof window.actualizarCotizacion === 'function') {
        window.actualizarCotizacion(window._empCotId, t.dataset.empCotEstado);
        if (typeof window.closeModal === 'function') window.closeModal('empCotDetalleModal');
        if (typeof window.cargarCotizacionesAPI === 'function') window.cargarCotizacionesAPI();
      }
      return;
    }

    // Admin: botones de cambio de estado de pedido en modal detalle
    t = e.target.closest('[data-admin-ped-estado]');
    if (t) {
      if (typeof window.actualizarEstadoPedido === 'function') {
        window.actualizarEstadoPedido(window._admPedId, t.dataset.adminPedEstado);
      }
      if (typeof window.closeModal === 'function') window.closeModal('adminPedidoDetalleModal');
      if (typeof window.cargarPedidosAPI === 'function') window.cargarPedidosAPI();
      return;
    }

    // [data-trigger-click="targetId"] → dispara click en otro elemento (ej: input[type=file])
    t = e.target.closest('[data-trigger-click]');
    if (t) {
      var target = document.getElementById(t.dataset.triggerClick);
      if (target) target.click();
      return;
    }

    // [data-remove-closest="selector"] → elimina el ancestor más cercano que coincida
    t = e.target.closest('[data-remove-closest]');
    if (t) {
      var removeTarget = t.closest(t.dataset.removeClosest);
      if (removeTarget) removeTarget.remove();
      return;
    }

    // [data-remove-id="elementId"] → elimina elemento por ID
    t = e.target.closest('[data-remove-id]');
    if (t) {
      var removeById = document.getElementById(t.dataset.removeId);
      if (removeById) removeById.remove();
      return;
    }

    // .semana-card[data-fecha], .dia-card[data-fecha] → seleccionarDia(el) en checkout
    t = e.target.closest('.semana-card[data-fecha], .dia-card[data-fecha]');
    if (t) {
      if (typeof window.seleccionarDia === 'function') window.seleccionarDia(t);
      return;
    }

    // .time-slot:not(.unavailable) → selectTime(el) en solicitudes
    t = e.target.closest('.time-slot');
    if (t && !t.classList.contains('unavailable')) {
      if (typeof window.selectTime === 'function') window.selectTime(t);
      return;
    }

    // .thumb[data-idx] → cambiarImagen() en detalle_producto
    t = e.target.closest('.thumb[data-idx]');
    if (t) {
      if (typeof window.cambiarImagen === 'function') {
        window.cambiarImagen(parseInt(t.dataset.idx), t.dataset.url);
      }
      return;
    }

    // [data-lightbox] en IMG → abrir lightbox de zoom
    t = e.target.closest('[data-lightbox]');
    if (t && t.tagName === 'IMG' && t.src) {
      _whOpenLightbox(t.src, t.alt || '');
      return;
    }

    // [data-call="funcName"] con [data-args='[...]'] opcional → función global
    t = e.target.closest('[data-call]');
    if (t) {
      var fn = window[t.dataset.call];
      if (typeof fn === 'function') {
        try {
          var args = t.dataset.args ? JSON.parse(t.dataset.args) : [];
          fn.apply(null, args);
        } catch (err) {
          fn();
        }
      }
      return;
    }
  });

  // ── Lightbox ──────────────────────────────────────────────────
  function _whOpenLightbox(src, alt) {
    var existing = document.getElementById('whLightboxOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'whLightboxOverlay';
    overlay.className = 'wh-lightbox';

    var inner = document.createElement('div');
    inner.className = 'wh-lightbox-inner';

    var img = document.createElement('img');
    img.className = 'wh-lightbox-img';
    img.src = src;
    img.alt = alt;

    var closeBtn = document.createElement('button');
    closeBtn.className = 'wh-lightbox-close';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';

    var hint = document.createElement('div');
    hint.className = 'wh-lightbox-hint';
    hint.textContent = 'Scroll para zoom · Clic fuera para cerrar';

    inner.appendChild(img);
    inner.appendChild(closeBtn);
    inner.appendChild(hint);
    overlay.appendChild(inner);
    document.body.appendChild(overlay);

    // Zoom con scroll
    var zoom = 1;
    img.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      zoom += ev.deltaY < 0 ? 0.15 : -0.15;
      zoom = Math.max(0.5, Math.min(4, zoom));
      img.style.transform = 'scale(' + zoom + ')';
    }, { passive: false });

    // Cerrar al hacer clic fuera de la imagen o en el botón X
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay || ev.target === closeBtn || ev.target.closest('.wh-lightbox-close')) {
        _whCloseLightbox(overlay);
      }
    });

    // Cerrar con Escape
    function _escHandler(ev) {
      if (ev.key === 'Escape') { _whCloseLightbox(overlay); document.removeEventListener('keydown', _escHandler); }
    }
    document.addEventListener('keydown', _escHandler);

    requestAnimationFrame(function () { overlay.classList.add('wh-lightbox--visible'); });
  }

  function _whCloseLightbox(overlay) {
    overlay.classList.remove('wh-lightbox--visible');
    setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 250);
  }

  // ── Change delegation ─────────────────────────────────────────────
  document.addEventListener('change', function (e) {
    var t = e.target.closest('[data-onchange]');
    if (!t) return;
    var fn = window[t.dataset.onchange];
    if (typeof fn === 'function') {
      // data-id presente: pasar (id, value) para funciones de dos argumentos
      if (t.dataset.id !== undefined) {
        fn.call(t, t.dataset.id, t.value);
      } else {
        fn.call(t, t.value);
      }
    }
  });

  // ── Input delegation ──────────────────────────────────────────────
  document.addEventListener('input', function (e) {
    var t = e.target.closest('[data-oninput]');
    if (!t) return;
    var fn = window[t.dataset.oninput];
    if (typeof fn === 'function') fn.call(t);
  });

  // ── Image error delegation ────────────────────────────────────────
  // Reemplaza onerror="..." en imágenes — usar capture para atrapar bubbling
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG') return;
    if (t.dataset.imgFallback) {
      t.style.display = 'none';
      var fallback = document.getElementById(t.dataset.imgFallback);
      if (fallback) fallback.style.display = 'flex';
    } else if (t.dataset.imgBgFallback) {
      t.style.background = t.dataset.imgBgFallback;
    }
  }, true);

})();
