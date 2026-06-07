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

    // [data-tab-goto="tabName"] → simula clic en el tab-btn correspondiente
    t = e.target.closest('[data-tab-goto]');
    if (t) {
      var tabBtn = document.querySelector('.tab-btn[data-tab="' + t.dataset.tabGoto + '"]');
      if (tabBtn) tabBtn.click();
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

    // [data-trigger-click="targetId"] → dispara click en otro elemento (ej: input[type=file])
    t = e.target.closest('[data-trigger-click]');
    if (t) {
      var target = document.getElementById(t.dataset.triggerClick);
      if (target) target.click();
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

  // ── Change delegation ─────────────────────────────────────────────
  document.addEventListener('change', function (e) {
    var t = e.target.closest('[data-onchange]');
    if (!t) return;
    var fn = window[t.dataset.onchange];
    // Pasar el valor del elemento como argumento (compatible con onchange="fn(this.value)")
    if (typeof fn === 'function') fn.call(t, t.value);
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
    if (!t || t.tagName !== 'IMG' || !t.dataset.imgFallback) return;
    t.style.display = 'none';
    var fallback = document.getElementById(t.dataset.imgFallback);
    if (fallback) fallback.style.display = 'flex';
  }, true);

})();
