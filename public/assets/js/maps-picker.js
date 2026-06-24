/**
 * maps-picker.js — Selector de dirección con mapa embebido (Google Maps)
 *
 * Uso:
 *   MapsPicker.init(containerEl, { onConfirm: ({lat, lng, direccion, colonia, ciudad, municipio, cp}) => {} })
 *   MapsPicker.setValue({ lat, lng, direccion, ... })  // pre-cargar dirección existente
 *   MapsPicker.getValues()  // retorna el objeto con todos los campos
 */
(function () {
  'use strict';

  let _map, _marker, _autocomplete, _container, _cb, _vals = {};

  /* ── HTML del picker ───────────────────────────────────────────── */
  function _template() {
    return `
      <div class="maps-picker-wrap" style="display:flex;flex-direction:column;gap:10px;">
        <div style="position:relative;">
          <input id="mpAutocomplete"
            type="text"
            placeholder="Escribe tu calle y número..."
            autocomplete="off"
            style="width:100%;padding:10px 14px;border:1px solid var(--border,#444);
                   background:var(--input,#1e1e1e);color:var(--muted2,#ddd);
                   border-radius:8px;font-size:14px;box-sizing:border-box;outline:none;">
          <div id="mpStatus" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);
               font-size:11px;color:var(--muted,#888);pointer-events:none;"></div>
        </div>

        <div id="mpMapCanvas"
             style="width:100%;height:280px;border-radius:10px;overflow:hidden;
                    border:1px solid var(--border,#444);background:#2a2a2a;
                    display:flex;align-items:center;justify-content:center;">
          <span style="color:var(--muted,#888);font-size:13px;">Escribe una dirección para ver el mapa</span>
        </div>

        <div id="mpAddress" style="display:none;padding:10px 14px;background:var(--panel2,#1a1a1a);
             border:1px solid var(--border,#444);border-radius:8px;font-size:13px;
             color:var(--muted2,#ddd);line-height:1.7;">
        </div>

        <p style="font-size:11px;color:var(--muted,#888);margin:0;">
          <i class="fa-solid fa-circle-info"></i>
          Puedes arrastrar el marcador para ajustar la ubicación exacta.
        </p>
      </div>`;
  }

  /* ── Inicializar mapa en el canvas ─────────────────────────────── */
  function _initMap(lat, lng) {
    const canvas = document.getElementById('mpMapCanvas');
    canvas.innerHTML = '';

    _map = new google.maps.Map(canvas, {
      center: { lat, lng },
      zoom: 16,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { elementType: 'geometry',   stylers: [{ color: '#212121' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
        { elementType: 'labels.text.fill',   stylers: [{ color: '#757575' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#383838' }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
      ],
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

  /* ── Geocodificación inversa (pin → dirección) ──────────────────── */
  function _reverseGeocode(lat, lng) {
    const gc = new google.maps.Geocoder();
    gc.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        _applyResult(results[0], lat, lng);
      }
    });
  }

  /* ── Aplicar resultado de geocodificación ───────────────────────── */
  function _applyResult(place, lat, lng) {
    const ac = place.address_components || [];
    const get = (type) => (ac.find(c => c.types.includes(type)) || {}).long_name || '';
    const getShort = (type) => (ac.find(c => c.types.includes(type)) || {}).short_name || '';

    const streetNumber = get('street_number');
    const route        = get('route');
    const colonia      = get('sublocality_level_1') || get('neighborhood') || get('sublocality');
    const ciudad       = get('locality') || get('administrative_area_level_2');
    const municipio    = get('administrative_area_level_2') || ciudad;
    const cp           = get('postal_code');
    const direccion    = route ? `${route}${streetNumber ? ' ' + streetNumber : ''}` : place.formatted_address;

    _vals = { lat, lng, direccion, colonia, ciudad, municipio, cp };

    /* actualizar UI */
    const status = document.getElementById('mpStatus');
    if (status) status.textContent = '✓ Ubicación confirmada';

    const addrBox = document.getElementById('mpAddress');
    if (addrBox) {
      addrBox.style.display = 'block';
      addrBox.innerHTML = `
        <strong style="color:var(--accent,#c9a96e);">📍 Ubicación seleccionada</strong><br>
        ${direccion}${colonia ? ', Col. ' + colonia : ''}${ciudad ? ', ' + ciudad : ''}${cp ? ' CP ' + cp : ''}`;
    }

    const inp = document.getElementById('mpAutocomplete');
    if (inp) inp.value = place.formatted_address || direccion;

    if (_cb) _cb(_vals);
  }

  /* ── API pública ────────────────────────────────────────────────── */
  window.MapsPicker = {
    /**
     * @param {HTMLElement} container  El div donde se monta el picker
     * @param {object}      opts
     * @param {function}    opts.onConfirm  Callback con {lat,lng,direccion,colonia,ciudad,municipio,cp}
     */
    init(container, opts = {}) {
      _container = container;
      _cb = opts.onConfirm || null;
      _vals = {};
      container.innerHTML = _template();

      /* Esperar a que Maps esté lista */
      const ready = () => {
        _autocomplete = new google.maps.places.Autocomplete(
          document.getElementById('mpAutocomplete'),
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
    },

    /** Pre-carga una dirección existente (para edición) */
    setValue({ lat, lng, direccion, colonia, ciudad, municipio, cp } = {}) {
      _vals = { lat, lng, direccion, colonia, ciudad, municipio, cp };
      if (lat && lng) {
        if (_map) {
          _map.setCenter({ lat, lng });
          _marker.setPosition({ lat, lng });
        } else {
          const ready = () => _initMap(parseFloat(lat), parseFloat(lng));
          if (window.google?.maps) ready();
          else document.addEventListener('maps-picker-ready', ready, { once: true });
        }
      }
      const inp = document.getElementById('mpAutocomplete');
      if (inp && direccion) inp.value = [direccion, colonia, ciudad].filter(Boolean).join(', ');
    },

    getValues() { return { ..._vals }; },
    clear() { _vals = {}; _map = null; _marker = null; _autocomplete = null; },
  };

  /* ── Disparar evento cuando la API de Maps cargue (callback=initMapsPickerReady) ── */
  window.initMapsPickerReady = function () {
    document.dispatchEvent(new Event('maps-picker-ready'));
  };
})();
