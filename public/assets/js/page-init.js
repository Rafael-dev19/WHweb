// page-init.js — lógica de inicialización trasladada desde bloques <script> inline
(function () {

  // Auto-dismiss flash alert (#whAlerta)
  var alerta = document.getElementById('whAlerta');
  if (alerta) {
    setTimeout(function () {
      alerta.style.transition = 'opacity .4s';
      alerta.style.opacity = '0';
      setTimeout(function () { if (alerta.parentNode) alerta.remove(); }, 400);
    }, 6000);
  }

  // Cerrar modales guía con Escape
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    ['whGuideModal', 'whGuideCatModal'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('open');
    });
  });

  // Abrir modal de auth según parámetro URL (?registro=1 o ?auth=1)
  var params       = new URLSearchParams(location.search);
  var openRegistro = params.get('registro') === '1';
  var openAuth     = params.get('auth') === '1';
  if (openRegistro || openAuth) {
    window.addEventListener('load', function () {
      setTimeout(function () {
        if (!window.AuthModal) return;
        if (openRegistro && typeof AuthModal.openRegistro === 'function') {
          AuthModal.openRegistro();
        } else if (typeof AuthModal.open === 'function') {
          AuthModal.open();
        }
      }, 400);
    });
  }

})();
