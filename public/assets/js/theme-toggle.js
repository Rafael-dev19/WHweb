// theme-toggle.js — Tema claro/oscuro con persistencia y detección de preferencia del sistema.
// Se auto-aplica al cargar (antes de DOMContentLoaded) para minimizar el parpadeo,
// y se inyecta un botón sol/luna junto a los controles de cabecera existentes.
(function () {
  'use strict';

  var STORAGE_KEY = 'wh-theme';

  function _getStored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function _setStored(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* modo privado, etc. */ }
  }

  function _systemPrefersLight() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  }

  function _preferredTheme() {
    var stored = _getStored();
    if (stored === 'light' || stored === 'dark') return stored;
    return _systemPrefersLight() ? 'light' : 'dark';
  }

  function _icon(theme) {
    return theme === 'light'
      ? '<i class="fa-solid fa-moon"></i>'
      : '<i class="fa-solid fa-sun"></i>';
  }

  function _apply(theme, userChosen) {
    document.documentElement.setAttribute('data-theme', theme);
    if (userChosen) _setStored(theme);
    var btn = document.getElementById('themeToggleBtn');
    if (btn) {
      btn.innerHTML = _icon(theme);
      btn.setAttribute('aria-label', theme === 'light' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro');
      btn.setAttribute('title', theme === 'light' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro');
    }
  }

  // Aplicar de inmediato (antes de que el resto del <body> se pinte).
  _apply(_preferredTheme(), false);

  function _mountButton() {
    if (document.getElementById('themeToggleBtn')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'themeToggleBtn';
    btn.innerHTML = _icon(document.documentElement.getAttribute('data-theme'));
    btn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      _apply(next, true);
    });

    // Paneles de personal: junto al botón de notificaciones, mismo estilo .icon-btn.
    // El header del panel es siempre visible (no se oculta en móvil), así que
    // este mismo botón ya funciona en cualquier tamaño de pantalla.
    var notifBtn = document.getElementById('notifBtn');
    if (notifBtn && notifBtn.parentElement) {
      btn.className = 'icon-btn theme-toggle-btn';
      notifBtn.parentElement.insertBefore(btn, notifBtn);
      return;
    }

    // Páginas públicas: botón flotante fijo, independiente del menú de nav
    // (que se oculta por completo en móvil) — así queda visible siempre,
    // en cualquier dispositivo, no solo en escritorio.
    btn.className = 'theme-toggle-btn theme-toggle-btn--float';
    document.body.appendChild(btn);
  }

  document.addEventListener('DOMContentLoaded', _mountButton);

  // Si el usuario no ha elegido manualmente, seguir la preferencia del sistema en vivo.
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function (e) {
      if (_getStored()) return;
      _apply(e.matches ? 'light' : 'dark', false);
    });
  }
})();
