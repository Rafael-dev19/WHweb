/**
 * maps-picker.js — Selector de dirección con mapa embebido (Google Maps)
 *
 * Uso:
 *   const handle = MapsPicker.init(containerEl, { onConfirm: ({lat, lng, direccion, colonia, ciudad, municipio, cp}) => {} })
 *   handle.setValue({ lat, lng, direccion, ... })  // pre-cargar dirección existente
 *   handle.getValues()  // retorna el objeto con todos los campos
 *
 * Multi-instancia: cada init() crea su propia instancia con ids de DOM únicos,
 * así que pueden coexistir varios pickers en la misma página (ej. solicitudes.php
 * tiene uno para cotización y otro para cita). Para páginas con un solo picker,
 * MapsPicker.setValue()/.getValues()/.clear() siguen funcionando directo sobre
 * el módulo — operan sobre la última instancia inicializada.
 */
(function () {
  'use strict';

  let _seq = 0;
  let _lastHandle = null;

  /* ── HTML del picker ───────────────────────────────────────────── */
  function _template(uid) {
    return `
      <div class="maps-picker-wrap" style="display:flex;flex-direction:column;gap:10px;">
        <div style="position:relative;">
          <input id="mpAutocomplete-${uid}"
            type="text"
            placeholder="Escribe tu calle y número..."
            autocomplete="off"
            style="width:100%;padding:10px 14px;border:1px solid var(--color-border);
                   background:var(--color-bg-input);color:var(--color-text-main);
                   border-radius:8px;font-size:14px;box-sizing:border-box;outline:none;">
          <div id="mpStatus-${uid}" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);
               font-size:11px;color:var(--color-text-muted);pointer-events:none;"></div>
        </div>

        <div id="mpMapCanvas-${uid}"
             style="width:100%;height:280px;border-radius:10px;overflow:hidden;
                    border:1px solid var(--color-border);background:var(--color-bg-card);
                    display:flex;align-items:center;justify-content:center;">
          <span style="color:var(--color-text-muted);font-size:13px;">Escribe una dirección para ver el mapa</span>
        </div>

        <div id="mpAddress-${uid}" style="display:none;padding:10px 14px;background:var(--color-bg-input);
             border:1px solid var(--color-border);border-radius:8px;font-size:13px;
             color:var(--color-text-main);line-height:1.7;">
        </div>

        <p style="font-size:11px;color:var(--color-text-muted);margin:0;display:flex;align-items:flex-start;gap:5px;">
          <i data-lucide="info" style="width:12px;height:12px;stroke-width:1.75;flex-shrink:0;margin-top:2px;"></i>
          <span>Puedes arrastrar el marcador para ajustar la ubicación exacta.</span>
        </p>
      </div>`;
  }

  /* ── Estilos del mapa (Google Maps no lee variables CSS) ─────────── */
  const _MAP_STYLES_DARK = [
    { elementType: 'geometry',   stylers: [{ color: '#212121' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
    { elementType: 'labels.text.fill',   stylers: [{ color: '#757575' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#383838' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  ];
  const _MAP_STYLES_LIGHT = [
    { elementType: 'geometry',   stylers: [{ color: '#f7f5f2' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
    { elementType: 'labels.text.fill',   stylers: [{ color: '#6b6255' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8b8072' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c8dae8' }] },
  ];
  function _mapStyles() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? _MAP_STYLES_LIGHT : _MAP_STYLES_DARK;
  }

  /* ── Crea una instancia independiente del picker ─────────────────── */
  function _createInstance(container, opts) {
    const uid = ++_seq;
    const _cb = opts.onConfirm || null;
    let _map, _marker, _autocomplete, _vals = {};

    container.innerHTML = _template(uid);
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();

    function _initMap(lat, lng) {
      const canvas = document.getElementById(`mpMapCanvas-${uid}`);
      canvas.innerHTML = '';

      _map = new google.maps.Map(canvas, {
        center: { lat, lng },
        zoom: 16,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: _mapStyles(),
      });

      _marker = new google.maps.Marker({
        position: { lat, lng },
        map: _map,
        draggable: true,
        title: 'Arrastra para ajustar',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#c9a96e',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });

      _marker.addListener('dragend', () => {
        const pos = _marker.getPosition();
        _reverseGeocode(pos.lat(), pos.lng());
      });
    }

    function _reverseGeocode(lat, lng) {
      const gc = new google.maps.Geocoder();
      gc.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results[0]) {
          _applyResult(results[0], lat, lng);
        }
      });
    }

    function _applyResult(place, lat, lng) {
      const ac = place.address_components || [];
      const get = (type) => (ac.find(c => c.types.includes(type)) || {}).long_name || '';

      const streetNumber = get('street_number');
      const route        = get('route');
      const colonia      = get('sublocality_level_1') || get('neighborhood') || get('sublocality');
      const ciudad       = get('locality') || get('administrative_area_level_2');
      const municipio    = get('administrative_area_level_2') || ciudad;
      const cp           = get('postal_code');
      const direccion    = route ? `${route}${streetNumber ? ' ' + streetNumber : ''}` : place.formatted_address;

      _vals = { lat, lng, direccion, colonia, ciudad, municipio, cp };

      const status = document.getElementById(`mpStatus-${uid}`);
      if (status) status.textContent = '✓ Ubicación confirmada';

      const addrBox = document.getElementById(`mpAddress-${uid}`);
      if (addrBox) {
        addrBox.style.display = 'block';
        addrBox.innerHTML = `
          <strong style="color:var(--accent,#c9a96e);">📍 Ubicación seleccionada</strong><br>
          ${direccion}${colonia ? ', Col. ' + colonia : ''}${ciudad ? ', ' + ciudad : ''}${cp ? ' CP ' + cp : ''}`;
      }

      const inp = document.getElementById(`mpAutocomplete-${uid}`);
      if (inp) inp.value = place.formatted_address || direccion;

      if (_cb) _cb(_vals);
    }

    const ready = () => {
      _autocomplete = new google.maps.places.Autocomplete(
        document.getElementById(`mpAutocomplete-${uid}`),
        { componentRestrictions: { country: 'mx' }, fields: ['address_components','geometry','formatted_address'] }
      );

      _autocomplete.addListener('place_changed', () => {
        const place = _autocomplete.getPlace();
        if (!place.geometry) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        if (!_map) {
          _initMap(lat, lng);
        } else {
          _map.setCenter({ lat, lng });
          _map.setZoom(16);
          _marker.setPosition({ lat, lng });
        }
        _applyResult(place, lat, lng);
      });
    };

    if (window.google?.maps?.places) {
      ready();
    } else {
      document.addEventListener('maps-picker-ready', ready, { once: true });
    }

    return {
      /** Pre-carga una dirección existente (para edición) */
      setValue({ lat, lng, direccion, colonia, ciudad, municipio, cp } = {}) {
        _vals = { lat, lng, direccion, colonia, ciudad, municipio, cp };
        if (lat && lng) {
          if (_map) {
            _map.setCenter({ lat, lng });
            _marker.setPosition({ lat, lng });
          } else {
            const readyLoad = () => _initMap(parseFloat(lat), parseFloat(lng));
            if (window.google?.maps) readyLoad();
            else document.addEventListener('maps-picker-ready', readyLoad, { once: true });
          }
        }
        const inp = document.getElementById(`mpAutocomplete-${uid}`);
        if (inp && direccion) inp.value = [direccion, colonia, ciudad].filter(Boolean).join(', ');
      },

      getValues() { return { ..._vals }; },
      clear() { _vals = {}; _map = null; _marker = null; _autocomplete = null; },
    };
  }

  /* ── API pública ────────────────────────────────────────────────── */
  window.MapsPicker = {
    /**
     * @param {HTMLElement} container  El div donde se monta el picker
     * @param {object}      opts
     * @param {function}    opts.onConfirm  Callback con {lat,lng,direccion,colonia,ciudad,municipio,cp}
     * @returns {object} handle con setValue()/getValues()/clear() propios de esta instancia
     */
    init(container, opts = {}) {
      const handle = _createInstance(container, opts);
      _lastHandle = handle;
      return handle;
    },

    /** Atajos de compatibilidad: operan sobre la última instancia inicializada
        (correcto para páginas con un solo picker, ej. checkout/mi-cuenta). */
    setValue(v) { if (_lastHandle) _lastHandle.setValue(v); },
    getValues() { return _lastHandle ? _lastHandle.getValues() : {}; },
    clear() { if (_lastHandle) _lastHandle.clear(); },
  };

  /* ── Disparar evento cuando la API de Maps cargue (callback=initMapsPickerReady) ── */
  window.initMapsPickerReady = function () {
    document.dispatchEvent(new Event('maps-picker-ready'));
  };
})();
