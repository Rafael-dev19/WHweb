// animations.js — scroll-reveal y micro-animaciones globales
(function () {
  'use strict';

  // ── Scroll reveal (IntersectionObserver) ─────────────────────────
  if (!window.IntersectionObserver) return;

  var revealClasses = ['.wh-reveal', '.wh-reveal-left', '.wh-reveal-right', '.wh-reveal-zoom'];

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('wh-animate');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  function observeAll() {
    document.querySelectorAll(revealClasses.join(',')).forEach(function (el) {
      observer.observe(el);
    });
  }

  // Observar al cargar y cuando el DOM cambia (paneles con contenido dinámico)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeAll);
  } else {
    observeAll();
  }

  // Re-observar elementos nuevos si el panel admin/emp carga secciones
  if (window.MutationObserver) {
    var mutObs = new MutationObserver(function (mutations) {
      var hasNew = false;
      mutations.forEach(function (m) {
        if (m.addedNodes.length) hasNew = true;
      });
      if (hasNew) observeAll();
    });
    document.addEventListener('DOMContentLoaded', function () {
      var main = document.querySelector('.main-content') || document.querySelector('main') || document.body;
      mutObs.observe(main, { childList: true, subtree: true });
    });
  }

  // ── Añadir clases reveal automáticamente a elementos clave ───────
  document.addEventListener('DOMContentLoaded', function () {
    // Cards de catálogo, FAQs, contact cards, work cards
    var autoReveal = [
      { selector: '.service-card',     cls: 'wh-reveal-zoom' },
      { selector: '.reason-card',      cls: 'wh-reveal'      },
      { selector: '.process-step',     cls: 'wh-reveal'      },
      { selector: '.contact-card',     cls: 'wh-reveal-zoom' },
      { selector: '.faq-item',         cls: 'wh-reveal'      },
      { selector: '.work-card',        cls: 'wh-reveal-zoom' },
      { selector: '.quick-action-card',cls: 'wh-reveal-zoom' },
      { selector: '.stat-card',        cls: 'wh-reveal-zoom' },
      { selector: '.about-box',        cls: 'wh-reveal'      },
      { selector: '.cta-section',      cls: 'wh-reveal'      },
      { selector: '.social-section',   cls: 'wh-reveal'      },
    ];

    autoReveal.forEach(function (item) {
      document.querySelectorAll(item.selector).forEach(function (el, i) {
        if (!el.classList.contains('wh-reveal') &&
            !el.classList.contains('wh-reveal-left') &&
            !el.classList.contains('wh-reveal-right') &&
            !el.classList.contains('wh-reveal-zoom')) {
          el.classList.add(item.cls);
          observer.observe(el);
        }
      });
    });

    // Añadir wh-lift a botones primarios y tarjetas de productos
    document.querySelectorAll('.btn-primary, .quick-action-card, .product-card, .action-card').forEach(function (el) {
      if (!el.classList.contains('wh-lift') && !el.classList.contains('wh-lift-sm')) {
        el.classList.add('wh-lift-sm');
      }
    });

    // Ripple effect en botones de acción principal
    document.querySelectorAll('.btn-primary, .btn-submit, .btn-pay, .btn-checkout, .btn-track').forEach(function (el) {
      el.classList.add('wh-btn-ripple');
    });

    // Page enter animation en el contenido principal
    var main = document.querySelector('#contenido-principal, .main-content');
    if (main) main.classList.add('wh-page-enter');
  });

})();
