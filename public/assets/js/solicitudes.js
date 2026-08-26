// =====================================================
// Wooden House — Solicitudes
// Cotización · Cita · Seguimiento
// =====================================================
const API_URL = '/api';

let selectedTime = null;

function _refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('formCotizacion')?.reset();
  document.getElementById('formCita')?.reset();
  selectedTime = null;

  initMenuHamburguesa();
  initCartBadge();
  initTabs();
  initFormCotizacion();
  initFormCita();
  initMapPickerCotizacion();
  initMapPickerCita();
  setMinDate();
  checkURLParams();
  initRealTimeValidation();

  // Pre-llenar datos de contacto si el cliente tiene sesión activa
  prefillContactoSiLogueado();
});

// ── Menú hamburguesa ──────────────────────────────────────────────
function initMenuHamburguesa() {
  const menuToggle = document.getElementById('menuToggle');
  const navLinks   = document.getElementById('navLinks');
  if (!menuToggle || !navLinks) return;
  menuToggle.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    navLinks.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', navLinks.classList.contains('open'));
  });
  document.addEventListener('click', function (e) {
    if (!menuToggle.contains(e.target) && !navLinks.contains(e.target)) {
      navLinks.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// ── Cart badge ────────────────────────────────────────────────────
function initCartBadge() {
  const badge = document.getElementById('cartCount');
  if (!badge) return;
  try {
    const carrito = JSON.parse(sessionStorage.getItem('wh_carrito') || '[]');
    const total   = carrito.reduce((s, i) => s + (i.cantidad || 0), 0);
    badge.textContent   = total;
    badge.style.display = total > 0 ? 'inline-block' : 'none';
  } catch { badge.style.display = 'none'; }
}

// ── URL params: activar tab por ?tab= ────────────────────────────
function checkURLParams() {
  const params = new URLSearchParams(window.location.search);
  const tab    = params.get('tab');
  if (tab) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const target = document.getElementById(`tab-${tab}`);
    if (target) target.classList.add('active');
  }
}

// ── Tabs ──────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      const target = document.getElementById('tab-' + this.dataset.tab);
      if (target) target.classList.add('active');
    });
  });
}

// ── Validación en tiempo real (feedback visual por campo) ─────────
function initRealTimeValidation() {
  document.querySelectorAll('input[type="email"]').forEach(input => {
    input.addEventListener('blur', function () {
      const val = this.value.trim();
      if (!val) return;
      if (!isValidEmail(val)) {
        this.style.borderColor = '#8b4a4a';
        showFieldError(this, 'Correo electrónico inválido. Ejemplo: nombre@dominio.com');
      } else {
        this.style.borderColor = '#3d6b47';
        clearFieldError(this);
      }
    });
    input.addEventListener('input', function () {
      this.value = this.value.replace(/[^a-zA-Z0-9._%+\-@]/g, '');
      clearFieldError(this);
      this.style.borderColor = '';
    });
  });

  document.querySelectorAll('input[type="tel"]').forEach(input => {
    input.addEventListener('input', function () {
      this.value = this.value.replace(/[^0-9\s+\-().]/g, '');
    });
    input.addEventListener('blur', function () {
      const val = this.value.trim();
      if (!val) return;
      if (!isValidPhone(val)) {
        this.style.borderColor = '#8b4a4a';
        showFieldError(this, 'Ingresa al menos 10 dígitos');
      } else {
        this.style.borderColor = '#3d6b47';
        clearFieldError(this);
      }
    });
  });

  document.querySelectorAll('input[name="nombre"]').forEach(input => {
    input.addEventListener('input', function () {
      this.value = this.value.replace(/[<>"'`;\\]/g, '');
    });
  });

  // Dirección y ciudad: bloquear caracteres de inyección
  document.querySelectorAll('input[name="direccion"], input[name="ciudad"]').forEach(input => {
    input.addEventListener('input', function () {
      this.value = this.value.replace(/[<>"'`;\\]/g, '');
    });
  });

  // Confirmar correo: bloquear pegar y verificar coincidencia
  document.querySelectorAll('input[name="emailConfirm"]').forEach(input => {
    input.addEventListener('paste', (e) => e.preventDefault());
    input.addEventListener('input', function () {
      this.value = this.value.replace(/[^a-zA-Z0-9._%+\-@]/g, '');
      clearFieldError(this);
      this.style.borderColor = '';
    });
    input.addEventListener('blur', function () {
      const emailField = this.closest('form')?.querySelector('input[name="email"]');
      const original = emailField?.value.trim().toLowerCase() || '';
      const confirm  = this.value.trim().toLowerCase();
      if (!confirm) return;
      if (confirm !== original) {
        this.style.borderColor = '#8b4a4a';
        showFieldError(this, 'Los correos no coinciden');
      } else {
        this.style.borderColor = '#3d6b47';
        clearFieldError(this);
      }
    });
  });

  document.querySelectorAll('textarea').forEach(area => {
    area.addEventListener('input', function () {
      this.value = this.value
        .replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9 \n\r.,;:!?()\-\/°%@]/g, '');
    });
  });
}

function showFieldError(input, msg) {
  clearFieldError(input);
  input.style.borderColor = '#c0392b';
  input.style.boxShadow   = '0 0 0 2px rgba(192,57,43,0.3)';
  const err = document.createElement('div');
  err.className = 'field-error-msg';
  err.style.cssText = 'color:var(--color-error);font-size:12px;margin-top:5px;font-weight:500;';
  err.textContent = msg;
  input.parentNode.appendChild(err);
}

function clearFieldError(input) {
  input.style.borderColor = '';
  input.style.boxShadow   = '';
  const prev = input.parentNode.querySelector('.field-error-msg');
  if (prev) prev.remove();
}

function resaltarCamposVacios(form) {
  let primerVacio = null;
  form.querySelectorAll('input[required], textarea[required], select[required]').forEach(field => {
    if (!field.value.trim()) {
      showFieldError(field, 'Este campo es obligatorio');
      if (!primerVacio) primerVacio = field;
    } else {
      clearFieldError(field);
    }
  });
  if (primerVacio) primerVacio.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return !!primerVacio;
}

// ── Formulario Cotización ─────────────────────────────────────────
function initFormCotizacion() {
  const form = document.getElementById('formCotizacion');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (resaltarCamposVacios(form)) {
      showAlert('Por favor completa todos los campos obligatorios marcados en rojo', 'error');
      return;
    }
    const fd = new FormData(form);

    const datos = {
      nombre_cliente:        sanitizeName(fd.get('nombre') || ''),
      correo_cliente:        sanitizeEmail(fd.get('email') || ''),
      telefono_cliente:      sanitizePhone(fd.get('telefono') || ''),
      direccion:             sanitizeText(fd.get('direccion') || '', 255),
      colonia:               sanitizeText(fd.get('colonia')   || '', 120),
      municipio:             sanitizeText(fd.get('municipio') || '', 100),
      ciudad:                sanitizeText(fd.get('ciudad')    || '', 100),
      cp:                    sanitizeText(fd.get('cp')        || '', 10),
      lat:                   fd.get('lat') || null,
      lng:                   fd.get('lng') || null,
      tipo_mueble:           sanitizeText(fd.get('tipoMueble') || '', 20),
      descripcion_solicitud: sanitizeDescription(fd.get('descripcion') || ''),
      ancho_espacio:         fd.get('anchoEspacio') || null,
      alto_espacio:          fd.get('altoEspacio')  || null,
      fondo_espacio:         fd.get('fondoEspacio') || null,
      urgencia:              sanitizeText(fd.get('urgencia') || '', 50),
      // Anti-bot honeypot fields (always empty for real users)
      _hp:     fd.get('_hp')      || '',
      website: fd.get('website')  || '',
      url:     fd.get('url')      || '',
    };

    if (!datos.nombre_cliente) {
      showAlert('Por favor ingresa tu nombre completo', 'error'); return;
    }
    if (!datos.correo_cliente) {
      showAlert('Por favor ingresa tu correo electrónico', 'error'); return;
    }
    if (!isValidEmail(datos.correo_cliente)) {
      showAlert('El correo electrónico no es válido. Ejemplo: nombre@dominio.com', 'error'); return;
    }
    const emailConfirmCot = sanitizeEmail(fd.get('emailConfirm') || '');
    if (!emailConfirmCot || emailConfirmCot !== datos.correo_cliente) {
      showAlert('Los correos electrónicos no coinciden. Verifícalos e intenta nuevamente.', 'error');
      document.querySelector('#formCotizacion [name="emailConfirm"]')?.focus();
      return;
    }
    if (!datos.telefono_cliente) {
      showAlert('Por favor ingresa tu teléfono', 'error'); return;
    }
    if (!isValidPhone(datos.telefono_cliente)) {
      showAlert('El teléfono debe tener al menos 10 dígitos', 'error'); return;
    }
    if (!datos.tipo_mueble) {
      showAlert('Selecciona el tipo de proyecto', 'error');
      document.querySelector('#formCotizacion [name="tipoMueble"]')?.focus();
      return;
    }
    if (!datos.descripcion_solicitud || datos.descripcion_solicitud.length < 10) {
      showAlert('Por favor describe tu proyecto con al menos 10 caracteres', 'error');
      document.querySelector('[name="descripcion"]')?.focus();
      return;
    }

    if (window.AuthModal && AuthModal.isAuthenticated() && !AuthModal.isEmailVerified()) {
      showAlert('Confirma tu correo electrónico antes de enviar una cotización. Revisa tu bandeja de entrada.', 'error');
      document.getElementById('whVerifBanner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled    = true;
    btn.innerHTML   = '<span class="auth-spinner" style="border-top-color:#fff;border-color:rgba(255,255,255,.35);"></span> Enviando...';

    try {
      const res  = await fetch(`${API_URL}/cotizaciones.php`, {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(datos),
      });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error('Error de servidor. Intenta nuevamente.');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al enviar cotización');

      // Subir fotos/boceto (opcional) — ya con el id de la cotización recién creada.
      const cotId = data.cotizacion_id;
      if (cotId) {
        btn.innerHTML = '<span class="auth-spinner" style="border-top-color:#fff;border-color:rgba(255,255,255,.35);"></span> Subiendo fotos...';
        await subirImagenesCotizacionCliente(cotId, document.getElementById('cotFotosEspacio')?.files, 'cliente_espacio');
        await subirImagenesCotizacionCliente(cotId, document.getElementById('cotBoceto')?.files, 'cliente_boceto');
      }

      showAlert(
        `<i data-lucide="circle-check"></i> ¡Cotización enviada! Tu número de seguimiento es <strong>${data.numero_cotizacion}</strong>. Recuerda: es un estimado rápido — el jefe la revisará y te responderá por correo con el siguiente paso.`,
        'success'
      );
      form.reset();
      // No se reinicia MapsPicker: es un singleton (ver Fase 9) y "clear()" deja
      // su estado interno inconsistente para una siguiente inicialización. El
      // mapa se queda mostrando la última ubicación confirmada, lo cual es
      // razonable si el cliente va a cotizar otro proyecto en la misma dirección.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      showAlert(err.message || 'Error al enviar cotización. Intenta nuevamente.', 'error');
    } finally {
      btn.disabled  = false;
      btn.innerHTML = '<i data-lucide="send"></i> Enviar Solicitud de Cotización';
      _refreshIcons();
    }
  });
}

// ── Subir fotos del cliente (espacio/boceto) a la cotización recién creada ──
async function subirImagenesCotizacionCliente(cotId, fileList, tipo) {
  if (!fileList || !fileList.length) return;
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
  const ts = Date.now();
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    if (!ALLOWED.includes(file.type)) continue; // el accept del input ya filtra; doble verificación
    const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `cotizaciones/${cotId}/cliente/${tipo}-${ts}-${i}.${ext}`;
    try {
      const url = await uploadFileToStorage(path, file);
      await fetch(`${API_URL}/cotizaciones.php?action=agregar_imagen_cliente&id=${cotId}`, {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ url_imagen: url, tipo }),
      });
    } catch (err) {
      console.warn('[solicitudes] No se pudo subir una imagen:', err);
    }
  }
}

// ── Mapa interactivo de dirección (cotización y cita) ──────────────
// Cada picker guarda su propio handle (setValue/getValues) — ambas formas
// coexisten en la misma página (pestañas), así que no se puede depender del
// atajo MapsPicker.setValue()/getValues() a nivel módulo (solo apunta a la
// última instancia inicializada, pisaría la del otro formulario).
let _mapHandleCotizacion = null;
let _mapHandleCita       = null;

function _initMapPickerGenerico(prefix, setHandle) {
  const container = document.getElementById(`${prefix}MapPickerContainer`);
  if (!container || !window.MapsPicker) return;

  const _mapsLoadTimer = setTimeout(() => {
    if (!window.google?.maps) {
      const editSection = document.getElementById(`${prefix}DireccionDetalleEdit`);
      if (editSection) editSection.style.display = 'block';
      container.innerHTML =
        '<p style="text-align:center;padding:20px 12px;color: var(--color-text-muted);font-size:13px;">' +
        '<i data-lucide="map-pinned" style="width:28px;height:28px;stroke-width:1.5;display:block;margin:0 auto 8px;"></i>' +
        'Mapa no disponible. Ingresa tu dirección en los campos de abajo.</p>';
      _refreshIcons();
    }
  }, 4000);
  document.addEventListener('maps-picker-ready', () => clearTimeout(_mapsLoadTimer), { once: true });

  const handle = MapsPicker.init(container, {
    onConfirm(v) {
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
      set(`${prefix}Direccion`, v.direccion);
      set(`${prefix}Colonia`,   v.colonia);
      set(`${prefix}Ciudad`,    v.ciudad);
      set(`${prefix}Municipio`, v.municipio);
      set(`${prefix}CP`,        v.cp);
      set(`${prefix}Lat`,       v.lat);
      set(`${prefix}Lng`,       v.lng);

      set(`${prefix}DireccionEdit`, v.direccion);
      set(`${prefix}ColoniaEdit`,   v.colonia);
      set(`${prefix}CiudadEdit`,    v.ciudad);
      set(`${prefix}MunicipioEdit`, v.municipio);
      set(`${prefix}CPEdit`,        v.cp);

      const detalle = document.getElementById(`${prefix}DireccionDetalleEdit`);
      if (detalle) detalle.style.display = 'block';
    }
  });
  setHandle(handle);

  // Sincronizar edición manual → hidden inputs
  [
    [`${prefix}DireccionEdit`, `${prefix}Direccion`],
    [`${prefix}ColoniaEdit`,   `${prefix}Colonia`],
    [`${prefix}CiudadEdit`,    `${prefix}Ciudad`],
    [`${prefix}MunicipioEdit`, `${prefix}Municipio`],
    [`${prefix}CPEdit`,        `${prefix}CP`],
  ].forEach(([editId, hiddenId]) => {
    const editEl = document.getElementById(editId);
    if (editEl) editEl.addEventListener('input', () => {
      const hid = document.getElementById(hiddenId);
      if (hid) hid.value = editEl.value;
    });
  });

  const btnSkip = document.getElementById(`${prefix}BtnSkipMapa`);
  if (btnSkip) {
    btnSkip.addEventListener('click', () => {
      const detalle = document.getElementById(`${prefix}DireccionDetalleEdit`);
      if (detalle) detalle.style.display = 'block';
      detalle?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      btnSkip.style.display = 'none';
    });
  }
}

function initMapPickerCotizacion() {
  _initMapPickerGenerico('cot', (h) => { _mapHandleCotizacion = h; });
}

function initMapPickerCita() {
  _initMapPickerGenerico('cit', (h) => { _mapHandleCita = h; });
}

// Precarga el mapa con una dirección ya guardada (perfil del cliente logueado).
function _precargarMapaGenerico(prefix, handle, cliente) {
  if (!cliente?.direccion || !handle) return;
  const intentar = () => {
    if (!window.google?.maps) { setTimeout(intentar, 300); return; }
    handle.setValue({
      lat: cliente.lat ? parseFloat(cliente.lat) : null,
      lng: cliente.lng ? parseFloat(cliente.lng) : null,
      direccion: cliente.direccion, colonia: cliente.colonia,
      ciudad: cliente.ciudad, municipio: cliente.municipio, cp: cliente.cp,
    });
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set(`${prefix}Direccion`, cliente.direccion); set(`${prefix}Colonia`, cliente.colonia);
    set(`${prefix}Ciudad`, cliente.ciudad); set(`${prefix}Municipio`, cliente.municipio); set(`${prefix}CP`, cliente.cp);
    set(`${prefix}DireccionEdit`, cliente.direccion); set(`${prefix}ColoniaEdit`, cliente.colonia);
    set(`${prefix}CiudadEdit`, cliente.ciudad); set(`${prefix}MunicipioEdit`, cliente.municipio); set(`${prefix}CPEdit`, cliente.cp);
    const detalle = document.getElementById(`${prefix}DireccionDetalleEdit`);
    if (detalle) detalle.style.display = 'block';
  };
  intentar();
}

function precargarMapaCotizacion(cliente) { _precargarMapaGenerico('cot', _mapHandleCotizacion, cliente); }
function precargarMapaCita(cliente)       { _precargarMapaGenerico('cit', _mapHandleCita, cliente); }

// ── Formulario Cita ───────────────────────────────────────────────
function initFormCita() {
  const form = document.getElementById('formCita');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (resaltarCamposVacios(form)) {
      showAlert('Por favor completa todos los campos obligatorios marcados en rojo', 'error');
      return;
    }

    if (!selectedTime) {
      showAlert('Por favor selecciona un horario', 'error'); return;
    }

    const fd = new FormData(form);
    const fechaSeleccionada = fd.get('fecha');

    if (!fechaSeleccionada) {
      showAlert('Por favor selecciona una fecha', 'error'); return;
    }

    const datos = {
      nombre_cliente:   sanitizeName(fd.get('nombre') || ''),
      correo_cliente:   sanitizeEmail(fd.get('email') || ''),
      telefono_cliente: sanitizePhone(fd.get('telefono') || ''),
      direccion:        sanitizeText(fd.get('direccion') || '', 255),
      colonia:          sanitizeText(fd.get('colonia')   || '', 120),
      municipio:        sanitizeText(fd.get('municipio') || '', 100),
      ciudad:           sanitizeText(fd.get('ciudad')    || '', 100),
      cp:               sanitizeText(fd.get('cp')        || '', 10),
      fecha_cita:       fechaSeleccionada,
      rango_horario:    selectedTime,
      tipo:             'medicion',
      notas:            sanitizeDescription(fd.get('notas') || '', 500),
      // Anti-bot honeypot fields
      _hp:     fd.get('_hp')      || '',
      website: fd.get('website')  || '',
      url:     fd.get('url')      || '',
    };

    if (!datos.nombre_cliente) {
      showAlert('Por favor ingresa tu nombre completo', 'error'); return;
    }
    if (!datos.correo_cliente) {
      showAlert('Por favor ingresa tu correo electrónico', 'error'); return;
    }
    if (!isValidEmail(datos.correo_cliente)) {
      showAlert('El correo electrónico no es válido. Ejemplo: nombre@dominio.com', 'error'); return;
    }
    const emailConfirmCit = sanitizeEmail(fd.get('emailConfirm') || '');
    if (!emailConfirmCit || emailConfirmCit !== datos.correo_cliente) {
      showAlert('Los correos electrónicos no coinciden. Verifícalos e intenta nuevamente.', 'error');
      document.querySelector('#formCita [name="emailConfirm"]')?.focus();
      return;
    }
    if (!datos.telefono_cliente) {
      showAlert('Por favor ingresa tu teléfono', 'error'); return;
    }
    if (!isValidPhone(datos.telefono_cliente)) {
      showAlert('El teléfono debe tener al menos 10 dígitos', 'error'); return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled    = true;
    btn.innerHTML   = '<span class="auth-spinner" style="border-top-color:#fff;border-color:rgba(255,255,255,.35);"></span> Agendando...';

    try {
      const res  = await fetch(`${API_URL}/citas.php`, {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(datos),
      });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error('Error de servidor. Intenta nuevamente.');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al agendar cita');

      showAlert(
        `<i data-lucide="calendar-check"></i> ¡Cita agendada! Tu número de cita es <strong>${data.numero_cita}</strong>. Recibirás confirmación en tu correo.`,
        'success'
      );
      form.reset();
      selectedTime = null;
      document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      showAlert(err.message || 'Error al agendar. Intenta nuevamente.', 'error');
    } finally {
      btn.disabled  = false;
      btn.innerHTML = '<i data-lucide="calendar-check"></i> Confirmar Cita';
      _refreshIcons();
    }
  });
}

// ── Slots de horario ──────────────────────────────────────────────
const HORARIOS_NEGOCIO = [
  '9:00 AM','10:00 AM','11:00 AM','12:00 PM',
  '2:00 PM','3:00 PM','4:00 PM','5:00 PM'
];

async function cargarSlotsDisponibles(fecha) {
  const container = document.getElementById('timeSlots');
  if (!container || !fecha) return;

  selectedTime = null;
  container.innerHTML = '<div style="color: var(--color-text-muted);font-size:14px;padding:12px;grid-column:1/-1;display:flex;align-items:center;gap:8px;"><span class="auth-spinner" style="border-top-color:var(--color-primary);border-color:rgba(139,115,85,.25);"></span> Verificando disponibilidad...</div>';

  try {
    const res   = await fetch(`${API_URL}/citas.php?fecha=${encodeURIComponent(fecha)}&limit=50`);
    const data  = await res.json();
    const ocupados = new Set(
      (data.citas || [])
        .filter(c => c.estado !== 'cancelada')
        .map(c => c.rango_horario)
    );

    const fechaObj   = new Date(fecha + 'T12:00:00');
    const diaSemana  = fechaObj.getDay();
    const hoy        = new Date(); hoy.setHours(0, 0, 0, 0);
    const fechaSelec = new Date(fecha + 'T00:00:00');

    if (fechaSelec < hoy) {
      container.innerHTML = '<div style="color:#c62828;font-size:14px;padding:12px;grid-column:1/-1;">No puedes agendar en fechas pasadas.</div>';
      return;
    }
    if (diaSemana === 0 || diaSemana === 6) {
      container.innerHTML = '<div style="color:#c62828;font-size:14px;padding:12px;grid-column:1/-1;">Solo atendemos de lunes a viernes.</div>';
      return;
    }

    container.innerHTML = HORARIOS_NEGOCIO.map(hora => {
      const ocupado = ocupados.has(hora);
      return `<div class="time-slot${ocupado ? ' unavailable' : ''}" title="${ocupado ? 'Horario no disponible' : 'Seleccionar'}">${hora}</div>`;
    }).join('');

    if (HORARIOS_NEGOCIO.length === ocupados.size) {
      container.innerHTML += '<div style="color:#c62828;font-size:13px;padding:6px;grid-column:1/-1;display:flex;align-items:center;gap:6px;"><i data-lucide="circle-alert" style="width:14px;height:14px;stroke-width:1.75;"></i> Sin horarios para este día.</div>';
      _refreshIcons();
    }
  } catch (e) {
    console.warn('Error cargando slots:', e);
    container.innerHTML = HORARIOS_NEGOCIO.map(hora =>
      `<div class="time-slot">${hora}</div>`
    ).join('');
  }
}

function selectTime(element) {
  if (element.classList.contains('unavailable')) return;
  document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
  element.classList.add('selected');
  selectedTime = element.textContent.trim().split('\n')[0].trim();
}



// ── Mostrar/ocultar campo medidas ─────────────────────────────────
// ── Fecha mínima cita: mañana ─────────────────────────────────────
function setMinDate() {
  const fechaCita = document.getElementById('fechaCita');
  if (!fechaCita) return;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  fechaCita.min = tomorrow.toISOString().split('T')[0];
}

// ── Alertas ───────────────────────────────────────────────────────
function showAlert(message, type = 'info') {
  const alertDiv = document.getElementById('alertMessage');
  if (alertDiv) {
    alertDiv.className = 'alert ' + type + ' show';
    alertDiv.style.display = 'block';
    alertDiv.innerHTML = message;
    _refreshIcons();
    alertDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (type === 'success' || type === 'warning') {
      setTimeout(() => {
        alertDiv.classList.remove('show');
        alertDiv.style.display = 'none';
      }, 7000);
    }
    return;
  }
  const colors = { success:'#27ae60', error:'#e74c3c', info:'#8b7355', warning:'#f39c12' };
  const toast = document.createElement('div');
  toast.innerHTML = message;
  toast.style.cssText = `position:fixed;top:24px;right:24px;z-index:10000;padding:14px 22px;
    background:${colors[type]||colors.info};color:#fff;border-radius:10px;font-size:14px;
    font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:380px;line-height:1.5;
    font-family:'Segoe UI',Tahoma,sans-serif;`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

// =====================================================
// SANITIZACIÓN Y VALIDACIÓN
// =====================================================

function sanitizeName(val, maxLen = 100) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    .replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9 .,'\-]/g, '')
    .substring(0, maxLen)
    .trim();
}

function sanitizeEmail(val) {
  if (typeof val !== 'string') return '';
  return val
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._%+\-@]/g, '')
    .substring(0, 150);
}

function sanitizePhone(val) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[^0-9\s+\-().]/g, '')
    .substring(0, 20)
    .trim();
}

function sanitizeText(val, maxLen = 300) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/['";`\\]/g, '')
    .substring(0, maxLen)
    .trim();
}

function sanitizeDescription(val, maxLen = 1000) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/['";`\\\\]/g, '')
    .replace(/;\s*(?:DROP|DELETE|INSERT|UPDATE|SELECT|CREATE|ALTER|EXEC)\b/gi, '')
    .substring(0, maxLen)
    .trim();
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  if (/['";`\\]/.test(clean)) return false;
  return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(clean);
}

function isValidPhone(phone) {
  if (typeof phone !== 'string') return false;
  return phone.replace(/\D/g, '').length >= 10;
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Pre-llenado de contacto para clientes con sesión ─────────────
async function prefillContactoSiLogueado() {
  if (typeof AuthModal === 'undefined') return;

  let cliente = AuthModal.getCliente();
  if (!cliente) {
    try { cliente = await AuthModal.verificar(); } catch (_) { /* continuar sin sesión */ }
  }

  // Sin sesión: mostrar sugerencia de login (no bloqueante)
  if (!cliente) {
    _mostrarSugerenciaLogin();
    // Cuando el usuario inicie sesión desde la sugerencia, actualizar el formulario
    document.addEventListener('wh:autenticado', function onAuth(ev) {
      document.removeEventListener('wh:autenticado', onAuth);
      document.querySelectorAll('.login-suggest-card').forEach(c => c.remove());
      prefillContactoSiLogueado();
    }, { once: true });
    return;
  }

  const configs = [
    { formId: 'formCotizacion', sectionTitle: 'Información de Contacto' },
    { formId: 'formCita',       sectionTitle: 'Información de Contacto' },
  ];

  configs.forEach(({ formId }) => {
    const form = document.getElementById(formId);
    if (!form) return;

    const seccion = form.querySelector('.form-section');
    if (!seccion) return;

    const setVal = (name, val) => {
      const el = form.querySelector(`[name="${name}"]`);
      if (el && val) { el.value = val; el.setAttribute('data-prefilled', '1'); }
    };
    setVal('nombre',       cliente.nombre   || '');
    setVal('email',        cliente.correo   || '');
    setVal('emailConfirm', cliente.correo   || '');
    setVal('telefono',     cliente.telefono || '');
    // La dirección de ambas formas vive en el mapa interactivo, no en un
    // input de texto visible — precargarla ahí para que el cliente la VEA
    // confirmada, en vez de solo rellenar el campo oculto en silencio.
    if (formId === 'formCotizacion') {
      precargarMapaCotizacion(cliente);
    } else {
      precargarMapaCita(cliente);
    }

    const _partes   = (cliente.nombre || 'C').trim().split(/\s+/).filter(Boolean);
    const inicial   = _partes.length >= 2
        ? (_partes[0][0] + _partes[1][0]).toUpperCase()
        : (_partes[0]?.[0] || 'C').toUpperCase();
    const tieneTel     = !!(cliente.telefono);
    const tieneDireccion = !!(cliente.direccion);
    const perfilCompleto = tieneTel && tieneDireccion;
    const lineaDireccion = [cliente.direccion, cliente.colonia, cliente.ciudad]
        .filter(Boolean).join(', ');
    const cardHtml  = `
      <div class="sesion-card" id="sesionCard_${formId}">
        <div class="sesion-card-avatar">${escapeHtml(inicial)}</div>
        <div class="sesion-card-info">
          <div class="sesion-card-nombre">${escapeHtml(cliente.nombre || '')}</div>
          <div class="sesion-card-detalle">${escapeHtml(cliente.correo || '')}</div>
          ${tieneTel ? `<div class="sesion-card-detalle">${escapeHtml(cliente.telefono)}</div>` : ''}
          ${lineaDireccion ? `<div class="sesion-card-detalle">${escapeHtml(lineaDireccion)}</div>` : ''}
        </div>
        <button type="button" class="sesion-card-editar"
                data-call="mostrarCamposContacto" data-args='["${formId}"]'>
          <i data-lucide="square-pen"></i> Editar datos
        </button>
      </div>`;

    if (perfilCompleto) {
      seccion.style.display = 'none';
      seccion.insertAdjacentHTML('beforebegin', cardHtml);
    } else {
      seccion.insertAdjacentHTML('beforebegin', cardHtml);
      const card = document.getElementById(`sesionCard_${formId}`);
      if (card) {
        const info = card.querySelector('.sesion-card-info');
        if (info) info.insertAdjacentHTML('beforeend',
          '<div class="sesion-card-aviso"><i data-lucide="circle-alert"></i> Completa tus datos abajo</div>');
      }
    }
  });
  _refreshIcons();
}

function mostrarCamposContacto(formId) {
  const card = document.getElementById(`sesionCard_${formId}`);
  if (card) card.remove();

  const form = document.getElementById(formId);
  if (!form) return;
  const seccion = form.querySelector('.form-section');
  if (seccion) {
    seccion.style.display = '';
    seccion.querySelectorAll('.form-group').forEach(g => { g.style.display = ''; });
  }
}

function _mostrarSugerenciaLogin() {
  ['formCotizacion', 'formCita'].forEach(formId => {
    const form = document.getElementById(formId);
    if (!form) return;
    const seccion = form.querySelector('.form-section');
    if (!seccion || document.getElementById(`loginSuggest_${formId}`)) return;
    const html = `
      <div class="login-suggest-card" id="loginSuggest_${formId}">
        <div class="login-suggest-icon"><i data-lucide="zap"></i></div>
        <div class="login-suggest-text">
          <strong>¿Ya tienes cuenta?</strong>
          Inicia sesión y llenamos tus datos automáticamente.
        </div>
        <button type="button" class="login-suggest-btn"
                data-auth-action="open">Iniciar sesión</button>
        <button type="button" class="login-suggest-close"
                data-remove-id="loginSuggest_${formId}"
                aria-label="Cerrar sugerencia">
          <i data-lucide="x"></i>
        </button>
      </div>`;
    seccion.insertAdjacentHTML('beforebegin', html);
  });
  _refreshIcons();
}

window.selectTime             = selectTime;
window.cargarSlotsDisponibles = cargarSlotsDisponibles;
window.mostrarCamposContacto  = mostrarCamposContacto;
