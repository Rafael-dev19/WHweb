// pedido-manual.js — Modal "Crear pedido" para jefe/ventas/diseñador: carga a
// mano un encargo que llega por WhatsApp/teléfono/mostrador, con los mismos
// datos que deja el cliente en el carrito (entrega, instalación, fecha, pago)
// más descripción/nota de voz/fotos para el diseñador. Los montos solo
// existen si window.WH_PM_MONTOS (jefe/ventas — ver _modal_pedido_manual.php).
// Compartido entre panel_administrador.php (jefe) y panel_empleado.php
// (diseñador) — usa apiFetch/API_BASE/showNotification/openModal/closeModal/
// firebaseStorage/initFirebase/crearGrabadorAudio, ya globales en ambos
// paneles (crearGrabadorAudio viene de voice-recorder.js).

let _pmFotosPendientes = [];
// Un elemento por mueble: del catálogo (producto_id) o a la medida (nombre libre).
// medidas_personalizadas = "este modelo pero en otras medidas" — viaja pegado a
// la línea hasta taller/instalación (detalle_pedido.medidas_personalizadas).
// Las claves con "_" son solo estado de la UI, no se envían.
let _pmItems = [];
let _pmTelefonosSec = [];
const _PM_MAX_TELEFONOS = 10;
const _PM_MAX_FOTOS_MODELO = 10;
// Modo edición (abrirModalEditarPedido): el mismo formulario, ya lleno con
// el pedido. null = creando uno nuevo.
//   { id, folio, pagado, dirOriginal, fechaOriginal, adjuntos, quitar:Set, lineaMedidaId }
let _pmEdit = null;

const _pmGrabador = crearGrabadorAudio({
  btnGrabarId: 'pm_btn_grabar',
  tiempoId:    'pm_audio_tiempo',
  zonaId:      'pm_audio_zona',
  previewId:   'pm_audio_preview',
  playerId:    'pm_audio_player',
  btnBorrarId: 'pm_btn_borrar_audio',
});

/* ── Abrir/cerrar ────────────────────────────────────────────────────── */
function abrirModalCrearPedido() {
  _pmEdit = null;
  _pmResetForm();
  _pmTextosModo();
  openModal('pedidoManualModal');
}

// Títulos, botón y sección de pago según se esté creando o editando.
function _pmTextosModo() {
  const editando = !!_pmEdit;
  const titulo = document.getElementById('pm_titulo');
  if (titulo) titulo.innerHTML = editando
    ? `<i data-lucide="pencil"></i> Editar pedido ${escapeHtml(_pmEdit.folio)}`
    : '<i data-lucide="package-plus"></i> Crear pedido';
  const intro = document.getElementById('pm_intro');
  if (intro) intro.innerHTML = editando
    ? 'Corrige lo que haga falta y toca <strong>Guardar cambios</strong>. Los pagos que ya se registraron no cambian; para un pago nuevo usa "Registrar pago recibido" en el detalle del pedido.'
    : 'Llena los pasos en orden, como si el cliente estuviera comprando en el carrito. Lo marcado con <strong>*</strong> es obligatorio; todo lo demás le llega tal cual al diseñador, al taller y al instalador.';
  const btn = document.getElementById('pm_btn_guardar');
  if (btn) btn.innerHTML = editando ? '<i data-lucide="save"></i> Guardar cambios' : '<i data-lucide="save"></i> Crear pedido';
  // Al editar no se captura un pago nuevo aquí: solo se muestra lo ya cobrado.
  document.querySelectorAll('.pm-solo-crear').forEach(el => { el.hidden = editando; });
  const nota = document.getElementById('pm_pago_edit_nota');
  if (nota) {
    nota.hidden = !editando;
    if (editando) nota.innerHTML = `<i data-lucide="info"></i> El cliente ya pagó <strong>${fmtMoneyPM(_pmEdit.pagado)}</strong>. El total no puede quedar por debajo de eso.`;
  }
  _pmRenderAdjuntosExistentes();
  window.lucide?.createIcons();
}

/* ── Editar un pedido existente ──────────────────────────────────────── */
// Los textos se guardan con htmlspecialchars (sanitize() en la API): para
// mostrarlos en un input hay que regresarlos a texto normal, si no "&quot;"
// aparecería tal cual y al guardar se volvería a codificar.
function _pmTexto(s) {
  const t = document.createElement('textarea');
  t.innerHTML = String(s ?? '');
  return t.value;
}

async function abrirModalEditarPedido(id) {
  let p;
  try {
    const data = await apiFetch(`${API_BASE}/pedidos.php?id=${id}`);
    if (!data.success || !data.pedido) throw new Error(data.error || 'No encontrado');
    p = data.pedido;
  } catch (e) {
    showNotification('No se pudo abrir el pedido: ' + e.message, 'error');
    return;
  }
  if (['finalizado', 'cancelado'].includes(p.estado)) {
    showNotification('Este pedido ya está cerrado y no se puede editar.', 'warning');
    return;
  }

  _pmEdit = null;
  _pmResetForm();

  const direccion = [
    _pmTexto(p.direccion_envio),
    p.colonia_envio ? `Col. ${_pmTexto(p.colonia_envio)}` : '',
    _pmTexto(p.ciudad_envio || ''),
    p.municipio_envio ? `Mpio. ${_pmTexto(p.municipio_envio)}` : '',
    p.cp_envio ? `CP ${p.cp_envio}` : '',
  ].filter(Boolean).join(', ');
  _pmEdit = {
    id: p.id,
    folio: p.numero_pedido,
    pagado: Number(p.monto_pagado) || 0,
    dirOriginal: direccion,
    fechaOriginal: p.fecha_estimada || '',
    adjuntos: (p.adjuntos || []).filter(a => a.tipo === 'foto' || a.tipo === 'audio'),
    quitar: new Set(),
    lineaMedidaId: null,
  };

  document.getElementById('pm_nombre').value = _pmTexto(p.nombre_cliente);
  document.getElementById('pm_telefono').value = _pmTexto(p.telefono_cliente);
  try {
    const tels = Array.isArray(p.telefonos_secundarios) ? p.telefonos_secundarios : JSON.parse(p.telefonos_secundarios || '[]');
    _pmTelefonosSec = (Array.isArray(tels) ? tels : []).map(_pmTexto);
  } catch (e) { _pmTelefonosSec = []; }
  _pmRenderTelefonos();

  _pmMarcarRadio('pm_entrega', p.tipo_entrega === 'recoger' ? 'recoger' : (Number(p.incluye_instalacion) ? 'instalacion' : 'envio'));
  document.getElementById('pm_direccion').value = direccion;
  const fecha = document.getElementById('pm_fecha_entrega');
  if (fecha) {
    fecha.value = p.fecha_estimada || '';
    // Una fecha ya pasada se puede dejar como está (no obliga a moverla).
    if (p.fecha_estimada && p.fecha_estimada < fecha.min) fecha.min = p.fecha_estimada;
  }
  document.getElementById('pm_descripcion').value = _pmTexto(p.mensaje_disenador);

  const tipo = ['bano', 'cocina', 'closet'].includes(p.tipo_proyecto) ? p.tipo_proyecto : 'bano';
  _pmMarcarRadio('pm_tipo_proyecto', tipo);
  const lineas = (p.items || []).filter(l => !(l.producto_id == null && /^Pedido personalizado — ver descripción/.test(l.nombre_producto || '')));
  if (tipo === 'bano') {
    _pmItems = await Promise.all(lineas.map(_pmItemDesdeLinea));
  } else if (lineas[0]) {
    _pmLlenarMedida(lineas[0]);
  }

  if (window.WH_PM_MONTOS) {
    const setNum = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = String(Number(v) || 0); };
    setNum('pm_costo_envio', p.costo_envio);
    setNum('pm_costo_instalacion', p.costo_instalacion);
    setNum('pm_descuento', p.descuento);
  }
  pmActualizarTipo();
  pmActualizarEntrega();
  _pmRenderItemsTabla();
  if (window.WH_PM_MONTOS) {
    // Si el total guardado no es la suma de los muebles, fue un total
    // acordado con el cliente: se respeta.
    const { calculado } = _pmTotales();
    const total = Number(p.total) || 0;
    if (Math.abs(calculado - total) > 0.009) document.getElementById('pm_total_acordado').value = total.toFixed(2);
    pmActualizarPago();
  }

  _pmTextosModo();
  // El detalle queda debajo: se cierra para no apilar dos ventanas.
  ['adminPedidoDetalleModal', 'empPedidoDetalleModal'].forEach(m => { if (document.getElementById(m)) closeModal(m); });
  openModal('pedidoManualModal');
}

// Línea guardada → mueble del formulario.
async function _pmItemDesdeLinea(l) {
  const it = _pmNuevoItem(!!l.producto_id);
  const adicCatalogo = (window.WH_ACCESORIOS || {}).adicionales || {};
  const nombresAdic = String(l.adicionales || '').split(',').map(s => s.trim()).filter(Boolean);
  Object.assign(it, {
    id: l.id,
    producto_id: l.producto_id ? Number(l.producto_id) : null,
    nombre: _pmTexto(l.nombre_producto || l.producto_nombre || ''),
    cantidad: Number(l.cantidad) || 1,
    unidad: l.unidad || 'pza',
    precio_unitario: Number(l.precio_unitario) || 0,
    ancho_cm: l.ancho_cm ? Number(l.ancho_cm) : null,
    cubierta: l.cubierta || 'mdf',
    color: l.color || '',
    info_extra: l.info_extra || '',
    ovalin: l.ovalin === 'No lleva' ? 'NO_LLEVA' : (l.ovalin || ''),
    monomando: l.monomando === 'No lleva' ? 'NO_LLEVA' : (l.monomando || ''),
    adicionales: Object.keys(adicCatalogo).filter(k => nombresAdic.includes(adicCatalogo[k].nombre)),
  });
  let fotos = [];
  try { fotos = JSON.parse(l.imagenes_referencia || '[]'); } catch (e) { fotos = []; }
  if (!Array.isArray(fotos) || !fotos.length) fotos = l.imagen_referencia ? [l.imagen_referencia] : [];
  it._fotos = fotos.map(url => ({ url, file: null }));

  const medidas = String(l.medidas_personalizadas || '');
  if (it._catalogo) {
    it.medidas_personalizadas = medidas;
    it._verMedidas = !!medidas.trim();
    try {
      const d = await apiFetch(`${API_BASE}/productos.php?id=${it.producto_id}`);
      it._medidas = d?.producto?.medidas || [];
    } catch (e) { it._medidas = []; }
    if (it.ancho_cm && !it._medidas.some(m => m.ancho_cm === it.ancho_cm)) it._anchoOtro = true;
  } else {
    // Fuera de catálogo: la 1ª línea es "Ancho 60 cm · Alto 80 cm · Fondo 45 cm".
    const [primera, ...resto] = medidas.split('\n');
    const dims = {};
    const esDims = /^(Ancho|Alto|Fondo) [\d.]+ cm( · (Ancho|Alto|Fondo) [\d.]+ cm)*$/.test(primera.trim());
    if (esDims) primera.split(' · ').forEach(parte => { const [k, v] = parte.trim().split(' '); dims[k] = v; });
    if (dims.Ancho && !it.ancho_cm) it.ancho_cm = Number(dims.Ancho);
    it.alto_cm = dims.Alto || '';
    it.fondo_cm = dims.Fondo || '';
    it.medidas_personalizadas = esDims ? resto.join('\n') : medidas;
  }
  return it;
}

// Cocina/clóset: un solo renglón con medidas, colores, info y precio.
function _pmLlenarMedida(l) {
  _pmEdit.lineaMedidaId = l.id;
  const [primera, ...resto] = String(l.medidas_personalizadas || '').split('\n');
  const dims = {};
  const esDims = /^(Ancho|Alto|Fondo) [\d.]+ m( · (Ancho|Alto|Fondo) [\d.]+ m)*$/.test(primera.trim());
  if (esDims) primera.split(' · ').forEach(parte => { const [k, v] = parte.trim().split(' '); dims[k] = v; });
  const set = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v ?? ''; };
  set('pm_med_ancho', dims.Ancho);
  set('pm_med_alto', dims.Alto);
  set('pm_med_fondo', dims.Fondo);
  set('pm_med_notas', esDims ? resto.join('\n') : (l.medidas_personalizadas || ''));
  set('pm_med_colores', l.color || '');
  set('pm_med_info', l.info_extra || '');
  if (window.WH_PM_MONTOS) set('pm_med_precio', Number(l.precio_unitario) ? String(Number(l.precio_unitario)) : '');
}

// Fotos y nota de voz que ya tiene el pedido: se pueden quitar.
function _pmRenderAdjuntosExistentes() {
  const cont = document.getElementById('pm_adjuntos_existentes');
  if (!cont) return;
  const adj = _pmEdit?.adjuntos || [];
  cont.hidden = !adj.length;
  if (!adj.length) { cont.innerHTML = ''; return; }
  const fotos = adj.filter(a => a.tipo === 'foto');
  const audios = adj.filter(a => a.tipo === 'audio');
  const quitada = a => _pmEdit.quitar.has(a.id);
  cont.innerHTML = `
    <div class="pm-hint" style="margin-bottom:6px;">Ya guardado en el pedido — toca <strong>×</strong> para quitar algo:</div>
    ${fotos.length ? `<div class="pm-fotos-grid">${fotos.map(a => `
      <div class="pm-foto-thumb ${quitada(a) ? 'pm-quitada' : ''}">
        <img src="${escapeHtml(a.url)}" alt="Foto guardada">
        <button type="button" class="pm-foto-x" data-call="pmToggleAdjunto" data-args="[${a.id}]"
          title="${quitada(a) ? 'Conservar' : 'Quitar'}" aria-label="${quitada(a) ? 'Conservar foto' : 'Quitar foto'}">${quitada(a) ? '↺' : '×'}</button>
      </div>`).join('')}</div>` : ''}
    ${audios.map(a => `
      <div class="pm-audio-guardado ${quitada(a) ? 'pm-quitada' : ''}">
        <audio controls src="${escapeHtml(a.url)}"></audio>
        <button type="button" class="pm-link" data-call="pmToggleAdjunto" data-args="[${a.id}]">${quitada(a) ? 'Conservar nota de voz' : 'Quitar nota de voz'}</button>
      </div>`).join('')}
    ${_pmEdit.quitar.size ? `<div class="pm-hint" style="color:var(--danger,#e57373);">Se quitará(n) ${_pmEdit.quitar.size} al guardar.</div>` : ''}`;
}

function pmToggleAdjunto(adjId) {
  if (!_pmEdit) return;
  if (_pmEdit.quitar.has(adjId)) _pmEdit.quitar.delete(adjId);
  else _pmEdit.quitar.add(adjId);
  _pmRenderAdjuntosExistentes();
}

function _pmHoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _pmResetForm() {
  document.getElementById('pm_nombre').value = '';
  document.getElementById('pm_telefono').value = '';
  document.getElementById('pm_direccion').value = '';
  document.getElementById('pm_descripcion').value = '';
  const fecha = document.getElementById('pm_fecha_entrega');
  if (fecha) { fecha.value = ''; fecha.min = _pmHoyISO(); }
  _pmMarcarRadio('pm_tipo_proyecto', 'bano');
  ['pm_med_ancho', 'pm_med_alto', 'pm_med_fondo', 'pm_med_notas', 'pm_med_colores', 'pm_med_info', 'pm_med_precio'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  _pmMarcarRadio('pm_entrega', 'instalacion');
  _pmMarcarRadio('pm_tipo_pago', 'completo');
  ['pm_costo_envio', 'pm_costo_instalacion', 'pm_descuento'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '0';
  });
  const acordado = document.getElementById('pm_total_acordado');
  if (acordado) acordado.value = '';
  const monto = document.getElementById('pm_monto_pagado');
  if (monto) { monto.value = ''; delete monto.dataset.editado; }
  const ref = document.getElementById('pm_referencia_pago');
  if (ref) ref.value = '';
  const metodo = document.getElementById('pm_metodo_pago');
  if (metodo) metodo.value = 'efectivo';
  _pmTelefonosSec = [];
  _pmRenderTelefonos();
  _pmFotosPendientes = [];
  _pmRenderFotosPreview();
  _pmGrabador.borrar();
  const progreso = document.getElementById('pm_progreso');
  if (progreso) progreso.style.display = 'none';
  _pmItems.forEach(_pmLiberarFotos);
  _pmItems = [];
  const acordadoReset = document.getElementById('pm_total_acordado');
  if (acordadoReset) acordadoReset.value = '';
  _pmRenderItemsTabla();
  pmActualizarTipo();
  pmActualizarEntrega();
}

function _pmMarcarRadio(nombre, valor) {
  const r = document.querySelector(`input[name="${nombre}"][value="${valor}"]`);
  if (r) r.checked = true;
}
function _pmValorRadio(nombre) {
  return document.querySelector(`input[name="${nombre}"]:checked`)?.value || '';
}
function _pmNum(id) {
  return Math.max(0, parseFloat(document.getElementById(id)?.value) || 0);
}

/* ── Entrega: instalación / solo envío / recoge (igual que el carrito) ── */
const _PM_TEXTOS_FECHA = {
  instalacion: ['Fecha de instalación', 'El día que acordaste con el cliente para instalar. Aparece en el calendario de todos.'],
  envio:       ['Fecha de entrega', 'El día que acordaste para llevarle el mueble.'],
  recoger:     ['Fecha en que pasa a recoger', 'El día que el cliente vendrá al taller por su mueble.'],
};
function pmActualizarEntrega() {
  const tipo = _pmValorRadio('pm_entrega') || 'instalacion';
  const dirWrap = document.getElementById('pm_direccion_wrap');
  if (dirWrap) dirWrap.style.display = tipo === 'recoger' ? 'none' : '';
  const [label, ayuda] = _PM_TEXTOS_FECHA[tipo];
  const l = document.getElementById('pm_fecha_label');
  const h = document.getElementById('pm_fecha_help');
  if (l) l.textContent = label;
  if (h) h.textContent = ayuda;
  // Sin instalación no hay costo de instalación que cobrar.
  const ci = document.getElementById('pm_costo_instalacion');
  if (ci) {
    ci.disabled = tipo !== 'instalacion';
    if (ci.disabled) ci.value = '0';
  }
  const ce = document.getElementById('pm_costo_envio');
  if (ce) {
    ce.disabled = tipo === 'recoger';
    if (ce.disabled) ce.value = '0';
  }
  pmActualizarPago();
}

/* ── Pago (solo jefe/ventas) ─────────────────────────────────────────── */
function _pmTotales() {
  const subtotal = _pmTipoProyecto() === 'bano'
    ? _pmItems.reduce((s, it) => s + (it.cantidad || 0) * (it.precio_unitario || 0), 0)
    : _pmNum('pm_med_precio');
  const calculado = Math.round(Math.max(0, subtotal + _pmNum('pm_costo_envio') + _pmNum('pm_costo_instalacion') - _pmNum('pm_descuento')) * 100) / 100;
  // Ventas puede cerrar un precio distinto a la suma de los muebles (proyecto
  // grande, paquete, ajuste): si escribe un total acordado, ese manda.
  const acordado = _pmNum('pm_total_acordado');
  const total = acordado > 0 ? Math.round(acordado * 100) / 100 : calculado;
  return { subtotal, calculado, acordado, total };
}

function pmActualizarPago() {
  if (!window.WH_PM_MONTOS) return;
  const { total, calculado, acordado } = _pmTotales();
  const hint = document.getElementById('pm_total_hint');
  if (hint) {
    const dif = acordado > 0 ? acordado - calculado : 0;
    hint.innerHTML = acordado > 0
      ? `Calculado (muebles + envío + instalación − descuento): <strong>${fmtMoneyPM(calculado)}</strong> · Diferencia: <strong>${dif >= 0 ? '+' : '−'}${fmtMoneyPM(Math.abs(dif))}</strong>`
      : `Calculado automáticamente: <strong>${fmtMoneyPM(calculado)}</strong>. Si acordaste otro total con el cliente, escríbelo aquí.`;
  }
  if (_pmEdit) {
    // Editando: lo cobrado ya está registrado; solo cambia el total.
    document.getElementById('pm_res_total').textContent  = fmtMoneyPM(total);
    document.getElementById('pm_res_pagado').textContent = fmtMoneyPM(_pmEdit.pagado);
    document.getElementById('pm_res_resta').textContent  = fmtMoneyPM(Math.max(0, total - _pmEdit.pagado));
    return;
  }
  const tipo = _pmValorRadio('pm_tipo_pago') || 'completo';
  const detalle = document.getElementById('pm_pago_detalle');
  const monto = document.getElementById('pm_monto_pagado');
  if (detalle) detalle.style.display = tipo === 'sin_pago' ? 'none' : '';
  // Sugerencia automática (completo = total, anticipo = 50% como en el
  // carrito) hasta que la persona escriba su propio monto.
  if (monto && !monto.dataset.editado) {
    monto.value = tipo === 'completo' ? total.toFixed(2) : tipo === 'anticipo' ? (total * 0.5).toFixed(2) : '';
  }
  if (monto) monto.readOnly = tipo === 'completo';
  const pagado = tipo === 'sin_pago' ? 0 : Math.min(total, _pmNum('pm_monto_pagado'));
  document.getElementById('pm_res_total').textContent  = fmtMoneyPM(total);
  document.getElementById('pm_res_pagado').textContent = fmtMoneyPM(pagado);
  document.getElementById('pm_res_resta').textContent  = fmtMoneyPM(Math.max(0, total - pagado));
}

/* ── Teléfonos secundarios ───────────────────────────────────────────── */
function pmAgregarTelefono() {
  if (_pmTelefonosSec.length >= _PM_MAX_TELEFONOS) {
    showNotification(`Máximo ${_PM_MAX_TELEFONOS} teléfonos adicionales.`, 'warning');
    return;
  }
  _pmTelefonosSec.push('');
  _pmRenderTelefonos();
  const inputs = document.querySelectorAll('#pm_telefonos_sec input');
  inputs[inputs.length - 1]?.focus();
}

function pmEliminarTelefono(idx) {
  _pmTelefonosSec.splice(idx, 1);
  _pmRenderTelefonos();
}

function _pmRenderTelefonos() {
  const cont = document.getElementById('pm_telefonos_sec');
  if (!cont) return;
  cont.innerHTML = _pmTelefonosSec.map((tel, idx) => `
    <div class="pm-tel-row">
      <input type="tel" class="form-input" inputmode="tel" autocomplete="off" placeholder="Otro teléfono ${idx + 1}"
        value="${escapeHtml(tel)}" data-pm-tel="${idx}">
      <button type="button" class="btn btn-secondary pm-icon-btn pm-icon-btn--danger" data-call="pmEliminarTelefono" data-args="[${idx}]"
        title="Quitar teléfono" aria-label="Quitar teléfono"><i data-lucide="x"></i></button>
    </div>
  `).join('');
  window.lucide?.createIcons();
}

/* ── Tipo de proyecto: baño (catálogo) vs cocina/clóset (a la medida) ─── */
// Baño: muebles de catálogo con ancho/cubierta/color. Cocina y clóset no
// tienen modelos: medidas del espacio, colores, fotos e ideas del cliente.
function _pmTipoProyecto() { return _pmValorRadio('pm_tipo_proyecto') || 'bano'; }

function pmActualizarTipo() {
  const tipo = _pmTipoProyecto();
  const esBano = tipo === 'bano';
  const secBano = document.getElementById('pm_seccion_bano');
  const secMed  = document.getElementById('pm_seccion_medida');
  if (secBano) secBano.hidden = !esBano;
  if (secMed)  secMed.hidden = esBano;
  const titulo = document.getElementById('pm_medida_titulo');
  if (titulo) titulo.textContent = tipo === 'cocina' ? 'Detalles de la cocina' : 'Detalles del clóset';
  // Las fotos van con el proyecto (lugar/referencias) en cocina/clóset y con
  // las indicaciones para el diseñador en baño — es el mismo selector, se mueve.
  const fotos = document.getElementById('pm_fotos_bloque');
  const slot  = document.getElementById(esBano ? 'pm_fotos_slot_diseno' : 'pm_fotos_slot_medida');
  if (fotos && slot && fotos.parentElement !== slot) slot.appendChild(fotos);
  const label = document.getElementById('pm_fotos_label');
  if (label) label.textContent = esBano ? 'Fotos de referencia' : 'Fotos del lugar o de referencia';
  pmActualizarPago();
}

/* ── Muebles de baño: modelo del catálogo o modelo fuera de catálogo ──── */
const _PM_CUBIERTAS = [
  ['mdf', 'Tapa de MDF'], ['cuarzo', 'Cuarzo'], ['granito', 'Granito'], ['marmol', 'Mármol'],
];

function _pmNuevoItem(desdeCatalogo) {
  return {
    producto_id: null, nombre: '', cantidad: 1, unidad: 'pza', precio_unitario: 0,
    ancho_cm: null, cubierta: 'mdf', color: '', info_extra: '', medidas_personalizadas: '',
    alto_cm: '', fondo_cm: '', ovalin: '', monomando: '', adicionales: [],
    _catalogo: desdeCatalogo, _medidas: [], _q: '', _resultados: null, _buscando: false,
    _verMedidas: false,
    // Fotos del modelo que trae el cliente: { url, file } — file = null si ya
    // estaba subida (al editar), si no es la vista previa local (blob:).
    _fotos: [],
  };
}

function pmAgregarModelo() {
  _pmItems.push(_pmNuevoItem(true));
  _pmRenderItemsTabla();
  _pmEnfocarItem(_pmItems.length - 1, '[data-pm-buscar]');
}

function pmAgregarLineaCustom() {
  _pmItems.push(_pmNuevoItem(false));
  _pmRenderItemsTabla();
  _pmEnfocarItem(_pmItems.length - 1, '[data-pm-campo="nombre"]');
}

function _pmEnfocarItem(idx, selector) {
  const card = document.querySelector(`#pm_items_tabla [data-pm-item="${idx}"]`);
  card?.querySelector(selector)?.focus();
}

async function pmBuscarProducto(idx) {
  const it = _pmItems[idx];
  if (!it) return;
  const input = document.querySelector(`#pm_items_tabla [data-pm-item="${idx}"] [data-pm-buscar]`);
  const q = input?.value?.trim() || '';
  it._q = q;
  if (q.length < 2) {
    it._resultados = { error: 'Escribe al menos 2 letras.' };
    _pmRenderItemsTabla();
    return;
  }
  it._buscando = true;
  it._resultados = null;
  _pmRenderItemsTabla();
  try {
    const data = await apiFetch(`${API_BASE}/productos.php?busqueda=${encodeURIComponent(q)}&limit=8`);
    const productos = data?.productos || [];
    it._resultados = productos.length
      ? { productos }
      : { error: 'No está en el catálogo — quita este mueble y usa "Modelo que no está en el catálogo".' };
  } catch (e) {
    it._resultados = { error: 'No se pudo buscar. Revisa tu conexión e intenta de nuevo.' };
  } finally {
    it._buscando = false;
    _pmRenderItemsTabla();
  }
}

function pmSeleccionarProducto(idx, resIdx) {
  const it = _pmItems[idx];
  const p = it?._resultados?.productos?.[resIdx];
  if (!p) return;
  // producto_id viaja hasta detalle_pedido — igual que cuando el cliente lo
  // agrega desde el catálogo en el sitio, así se liga a sus especificaciones.
  it.producto_id = p.id;
  it.nombre = p.nombre;
  it._medidas = p.medidas || [];
  // Mismo ancho por defecto que el sitio (80 cm si existe).
  const def = it._medidas.find(m => m.ancho_cm === 80) || it._medidas[0];
  it.ancho_cm = def ? def.ancho_cm : null;
  it.precio_unitario = def ? def.precio : (Number(p.precio) || 0);
  it._resultados = null;
  it._q = '';
  _pmRenderItemsTabla();
}

function pmElegirAncho(idx, ancho) {
  const it = _pmItems[idx];
  if (!it) return;
  const m = it._medidas.find(x => x.ancho_cm === ancho);
  it.ancho_cm = ancho;
  it._anchoOtro = false;
  if (m) it.precio_unitario = m.precio + _pmCostoAdicionales(it);
  _pmRenderItemsTabla();
}

// "Otra medida": anchos que no están en la lista del catálogo (ej. 55 cm).
// El precio lo pone ventas en "Precio c/u"; el ancho queda como dato
// (Ancho: 55 cm) para taller e instalación, igual que uno de la lista.
function pmAnchoOtro(idx) {
  const it = _pmItems[idx];
  if (!it) return;
  it._anchoOtro = true;
  if (it._medidas.some(m => m.ancho_cm === it.ancho_cm)) it.ancho_cm = '';
  _pmRenderItemsTabla();
  _pmEnfocarItem(idx, '[data-pm-campo="ancho_cm"]');
}

// "Sin accesorios": ovalín y monomando = No lleva, y sin adicionales.
function pmSinAccesorios(idx) {
  const it = _pmItems[idx];
  if (!it) return;
  it.precio_unitario = Math.max(0, (it.precio_unitario || 0) - _pmCostoAdicionales(it));
  it.ovalin = 'NO_LLEVA';
  it.monomando = 'NO_LLEVA';
  it.adicionales = [];
  _pmRenderItemsTabla();
}

// Adicionales del catálogo (includes/accesorios.php): suman/restan su precio
// al precio c/u del mueble, sin pisar lo que ventas haya ajustado a mano.
function _pmCostoAdicionales(it) {
  const A = (window.WH_ACCESORIOS || {}).adicionales || {};
  return (it.adicionales || []).reduce((s, k) => s + (A[k]?.precio || 0), 0);
}
function pmToggleAdicional(idx, clave, activo) {
  const it = _pmItems[idx];
  const A = (window.WH_ACCESORIOS || {}).adicionales || {};
  if (!it || !A[clave]) return;
  const ya = it.adicionales.includes(clave);
  if (activo && !ya) { it.adicionales.push(clave); it.precio_unitario = (it.precio_unitario || 0) + A[clave].precio; }
  if (!activo && ya) { it.adicionales = it.adicionales.filter(k => k !== clave); it.precio_unitario = Math.max(0, (it.precio_unitario || 0) - A[clave].precio); }
  _pmRenderItemsTabla();
}

function _pmSelectAccesorios(it, idx) {
  const acc = window.WH_ACCESORIOS;
  if (!acc) return '';
  const ovGrupo = (linea, titulo) => `<optgroup label="${titulo}">${acc.ovalines.filter(o => o.linea === linea)
    .map(o => `<option value="${escapeHtml(o.codigo)}" ${it.ovalin === o.codigo ? 'selected' : ''}>${escapeHtml(o.codigo)} — ${escapeHtml(o.medidas)}</option>`).join('')}</optgroup>`;
  const acabados = [...new Set(acc.monomandos.map(m => m.acabado))];
  return `
      <div class="pm-acc-top">
        <span class="pm-campo" style="margin:0;">Accesorios</span>
        <button type="button" class="pm-link" data-call="pmSinAccesorios" data-args="[${idx}]">No lleva accesorios</button>
      </div>
      <div class="pm-dos">
        <label class="pm-campo">Ovalín
          <select class="form-select" data-pm-campo="ovalin">
            <option value="">Por definir con el cliente</option>
            <option value="NO_LLEVA" ${it.ovalin === 'NO_LLEVA' ? 'selected' : ''}>No lleva</option>
            ${ovGrupo('incluido', 'Incluidos')}${ovGrupo('economica', 'Línea económica')}
          </select>
        </label>
        <label class="pm-campo">Monomando
          <select class="form-select" data-pm-campo="monomando">
            <option value="">Por definir con el cliente</option>
            <option value="NO_LLEVA" ${it.monomando === 'NO_LLEVA' ? 'selected' : ''}>No lleva</option>
            ${acabados.map(a => `<optgroup label="${escapeHtml(a)}">${acc.monomandos.filter(m => m.acabado === a)
              .map(m => `<option value="${escapeHtml(m.codigo)}" ${it.monomando === m.codigo ? 'selected' : ''}>${escapeHtml(m.codigo)}</option>`).join('')}</optgroup>`).join('')}
          </select>
        </label>
      </div>
      <div class="pm-campo">Adicionales
        <div class="pm-adic">
          ${Object.entries(acc.adicionales).map(([k, a]) => `
            <label><input type="checkbox" data-pm-adicional="${escapeHtml(k)}" ${it.adicionales.includes(k) ? 'checked' : ''}>
              ${escapeHtml(a.nombre)}${window.WH_PM_MONTOS ? `<em>+${fmtMoneyPM(a.precio)}</em>` : ''}</label>`).join('')}
        </div>
      </div>`;
}

function pmCambiarModelo(idx) {
  const it = _pmItems[idx];
  if (!it) return;
  Object.assign(it, { producto_id: null, nombre: '', precio_unitario: 0, ancho_cm: null, _medidas: [] });
  _pmRenderItemsTabla();
  _pmEnfocarItem(idx, '[data-pm-buscar]');
}

function pmToggleMedidas(idx) {
  const it = _pmItems[idx];
  if (!it) return;
  it._verMedidas = !it._verMedidas;
  if (!it._verMedidas) it.medidas_personalizadas = '';
  _pmRenderItemsTabla();
  if (it._verMedidas) _pmEnfocarItem(idx, '[data-pm-campo="medidas_personalizadas"]');
}

function pmFotoModelo(idx, files) {
  const it = _pmItems[idx];
  if (!it || !files?.length) return;
  const validas = Array.from(files).filter(f => {
    if (_PM_TIPOS_IMG.includes(f.type)) return true;
    showNotification(`"${f.name}" no es una imagen válida (usa JPG, PNG o WEBP).`, 'warning');
    return false;
  });
  const libres = _PM_MAX_FOTOS_MODELO - it._fotos.length;
  if (validas.length > libres) showNotification(`Máximo ${_PM_MAX_FOTOS_MODELO} fotos por modelo.`, 'warning');
  validas.slice(0, Math.max(0, libres)).forEach(file => it._fotos.push({ file, url: URL.createObjectURL(file) }));
  _pmRenderItemsTabla();
}

function pmQuitarFotoModelo(idx, f) {
  const it = _pmItems[idx];
  const foto = it?._fotos[f];
  if (!foto) return;
  if (foto.file) URL.revokeObjectURL(foto.url);
  it._fotos.splice(f, 1);
  _pmRenderItemsTabla();
}

function _pmLiberarFotos(it) {
  (it?._fotos || []).forEach(f => f.file && URL.revokeObjectURL(f.url));
}

function pmEliminarItem(idx) {
  _pmLiberarFotos(_pmItems[idx]);
  _pmItems.splice(idx, 1);
  _pmRenderItemsTabla();
}

function pmActualizarItemCampo(idx, campo, valor) {
  if (!_pmItems[idx]) return;
  const numericos = ['cantidad', 'precio_unitario'];
  _pmItems[idx][campo] = numericos.includes(campo) ? parseFloat(valor) || 0 : valor;
  // La cubierta cambia lo que se muestra (aviso de piedra); el resto solo el total.
  _pmRenderItemsTabla(campo !== 'cubierta');
}

function fmtMoneyPM(n) { return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }); }

function _pmRenderItemCard(it, idx) {
  const montos = !!window.WH_PM_MONTOS;
  let cabecera;
  if (it._catalogo && !it.producto_id) {
    const res = it._resultados;
    cabecera = `
      <div class="pm-tel-row">
        <input type="search" class="form-input" data-pm-buscar placeholder="Busca el modelo (ej. Valencia, París)" value="${escapeHtml(it._q)}" enterkeyhint="search">
        <button type="button" class="btn btn-secondary pm-icon-btn" data-call="pmBuscarProducto" data-args="[${idx}]" aria-label="Buscar"><i data-lucide="search"></i></button>
      </div>
      ${it._buscando ? '<div class="pm-hint"><i class="wh-icon-spin" data-lucide="loader-circle"></i> Buscando...</div>' : ''}
      ${res?.error ? `<div class="pm-hint">${escapeHtml(res.error)}</div>` : ''}
      ${res?.productos ? `<div class="pm-resultados">${res.productos.map((p, r) => `
        <button type="button" class="btn btn-secondary btn-small" data-call="pmSeleccionarProducto" data-args="[${idx}, ${r}]">
          <i data-lucide="box"></i> <span>${escapeHtml(p.nombre)}${montos ? ` — ${(p.medidas || []).length ? 'desde ' : ''}${fmtMoneyPM(p.precio)}` : ''}</span>
        </button>`).join('')}</div>` : ''}`;
  } else if (it.producto_id) {
    cabecera = `
      <div class="pm-modelo">
        <i data-lucide="box"></i>
        <strong>${escapeHtml(it.nombre)}</strong>
        <button type="button" class="pm-link" data-call="pmCambiarModelo" data-args="[${idx}]">Cambiar</button>
      </div>
      <div class="pm-campo">Ancho del mueble
        ${it._medidas.length ? `<div class="pm-anchos">${it._medidas.map(m => `
          <button type="button" class="pm-ancho ${!it._anchoOtro && m.ancho_cm === it.ancho_cm ? 'activo' : ''}" data-call="pmElegirAncho" data-args="[${idx}, ${m.ancho_cm}]" aria-pressed="${!it._anchoOtro && m.ancho_cm === it.ancho_cm}">
            <strong>${m.ancho_cm} cm</strong>${montos ? `<span>${fmtMoneyPM(m.precio)}</span>` : ''}
          </button>`).join('')}
          <button type="button" class="pm-ancho pm-ancho--otro ${it._anchoOtro ? 'activo' : ''}" data-call="pmAnchoOtro" data-args="[${idx}]" aria-pressed="${!!it._anchoOtro}">
            <strong>Otra medida</strong><span>escríbela</span>
          </button>
        </div>` : ''}
        ${it._anchoOtro || !it._medidas.length ? `
          <div class="pm-ancho-otro">
            <label class="pm-campo">Ancho (cm)
              <input type="number" class="form-input" data-pm-campo="ancho_cm" value="${escapeHtml(String(it.ancho_cm ?? ''))}" min="20" max="400" step="1" inputmode="numeric" placeholder="ej. 55">
            </label>
            ${montos ? '<span class="pm-hint">Pon el precio que acordaste en "Precio c/u".</span>' : ''}
          </div>` : ''}
      </div>`;
  } else {
    // Modelo que el cliente trae (foto de internet, de otra tienda...).
    cabecera = `
      <label class="pm-campo">Nombre o descripción del modelo
        <input type="text" class="form-input" data-pm-campo="nombre" value="${escapeHtml(it.nombre)}" placeholder="ej: Mueble de 3 cajones con repisa (foto del cliente)">
      </label>
      <div class="pm-campo"><span>Fotos del modelo · ${it._fotos.length} de ${_PM_MAX_FOTOS_MODELO}</span>
        ${it._fotos.length ? `<div class="pm-fotos-grid">${it._fotos.map((f, fi) => `
          <div class="pm-foto-thumb">
            <img src="${escapeHtml(f.url)}" alt="Foto ${fi + 1} del modelo">
            <button type="button" class="pm-foto-x" data-call="pmQuitarFotoModelo" data-args="[${idx}, ${fi}]" title="Quitar foto" aria-label="Quitar foto ${fi + 1}">×</button>
          </div>`).join('')}</div>` : ''}
        ${it._fotos.length < _PM_MAX_FOTOS_MODELO ? `
        <label class="btn btn-secondary btn-small" style="cursor:pointer;align-self:flex-start;">
          <i data-lucide="camera"></i> ${it._fotos.length ? 'Agregar más fotos' : 'Subir fotos'}
          <input type="file" accept="image/*" multiple data-pm-foto-modelo style="display:none">
        </label>` : ''}
        <span class="pm-hint">Puedes elegir varias a la vez: de frente, de lado, detalles, la captura que mandó el cliente…</span>
      </div>
      <div class="pm-costos">
        <label>Ancho (cm)<input type="number" class="form-input" data-pm-campo="ancho_cm" value="${it.ancho_cm ?? ''}" min="0" step="1" inputmode="numeric"></label>
        <label>Alto (cm)<input type="number" class="form-input" data-pm-campo="alto_cm" value="${escapeHtml(it.alto_cm)}" min="0" step="1" inputmode="numeric"></label>
        <label>Fondo (cm)<input type="number" class="form-input" data-pm-campo="fondo_cm" value="${escapeHtml(it.fondo_cm)}" min="0" step="1" inputmode="numeric"></label>
      </div>`;
  }

  const listo = !it._catalogo || it.producto_id;
  return `
    <div class="pm-item" data-pm-item="${idx}">
      <div class="pm-item-top">
        <span class="pm-item-num">Mueble ${idx + 1}${it._catalogo ? '' : ' · fuera de catálogo'}</span>
        <button type="button" class="btn btn-secondary pm-icon-btn pm-icon-btn--danger" data-call="pmEliminarItem" data-args="[${idx}]" title="Quitar mueble" aria-label="Quitar mueble"><i data-lucide="trash-2"></i></button>
      </div>
      ${cabecera}
      ${listo ? `
      <div class="pm-dos">
        <label class="pm-campo">Cubierta
          <select class="form-select" data-pm-campo="cubierta">
            ${_PM_CUBIERTAS.map(([v, t]) => `<option value="${v}" ${it.cubierta === v ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </label>
        <label class="pm-campo">Color del modelo
          <input type="text" class="form-input" data-pm-campo="color" value="${escapeHtml(it.color)}" placeholder="ej. Nogal, blanco con roble">
        </label>
      </div>
      <div class="pm-item-grid">
        <label>Cant.<input type="number" class="form-input" data-pm-campo="cantidad" value="${it.cantidad}" min="1" step="1" inputmode="numeric"></label>
        ${montos ? `<label>Precio c/u ($)<input type="number" class="form-input" data-pm-campo="precio_unitario" value="${it.precio_unitario}" min="0" step="0.01" inputmode="decimal"></label>` : ''}
      </div>
      ${montos && it.cubierta !== 'mdf' ? '<div class="pm-hint">La cubierta de piedra se cobra aparte (granito/mármol $3,800 y cuarzo $4,800 por metro lineal): súmala al precio.</div>' : ''}
      ${_pmSelectAccesorios(it, idx)}
      <label class="pm-campo">Información extra
        <textarea class="form-textarea" rows="2" data-pm-campo="info_extra" placeholder="ej. Espejo LED de 60×80, jaladeras negras, lo que pidió el cliente…">${escapeHtml(it.info_extra)}</textarea>
      </label>
      ${it._catalogo ? (it._verMedidas ? `
        <label class="pm-campo">Otras medidas
          <textarea class="form-textarea" rows="2" data-pm-campo="medidas_personalizadas" placeholder='ej: 110 cm de ancho, 50 de fondo'>${escapeHtml(it.medidas_personalizadas)}</textarea>
        </label>
        <button type="button" class="pm-link" data-call="pmToggleMedidas" data-args="[${idx}]">Quitar otras medidas</button>
      ` : `
        <button type="button" class="btn btn-secondary btn-small" data-call="pmToggleMedidas" data-args="[${idx}]">
          <i data-lucide="plus"></i> Lo quiere en otra medida
        </button>
      `) : ''}` : ''}
    </div>`;
}

function _pmRenderItemsTabla(soloTotal) {
  const totalWrap = document.getElementById('pm_items_total_wrap');
  const totalSpan = document.getElementById('pm_items_total');
  const total = _pmItems.reduce((s, it) => s + (it.cantidad || 0) * (it.precio_unitario || 0), 0);
  if (totalWrap) totalWrap.style.display = _pmItems.length ? '' : 'none';
  if (totalSpan) totalSpan.textContent = fmtMoneyPM(total);
  pmActualizarPago();
  if (soloTotal) return; // el usuario está escribiendo en un input — no reconstruir y robarle el foco

  const tabla = document.getElementById('pm_items_tabla');
  if (!tabla) return;
  tabla.innerHTML = _pmItems.length
    ? _pmItems.map(_pmRenderItemCard).join('')
    : '<div class="pm-hint">Todavía no hay muebles. Usa los botones de abajo para agregar cada modelo.</div>';
  window.lucide?.createIcons();
}

/* ── Fotos ───────────────────────────────────────────────────────────── */
const _PM_TIPOS_IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function pmPreviewFotos(files) {
  const validas = Array.from(files).filter(f => {
    if (!_PM_TIPOS_IMG.includes(f.type)) {
      showNotification(`"${f.name}" no es imagen válida y fue omitida.`, 'warning');
      return false;
    }
    return true;
  });
  if (_pmFotosPendientes.length + validas.length > 10) {
    showNotification('Máximo 10 fotos por pedido.', 'warning');
  }
  _pmFotosPendientes = [..._pmFotosPendientes, ...validas].slice(0, 10);
  _pmRenderFotosPreview();
}

function _pmRenderFotosPreview() {
  const grid = document.getElementById('pmFotosPreviewGrid');
  if (!grid) return;
  grid.innerHTML = _pmFotosPendientes.map((f, i) => `
    <div style="position:relative;">
      <img src="${URL.createObjectURL(f)}" style="width:100%;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border);">
      <button type="button" class="btn-eliminar-img" data-call="pmEliminarFoto" data-args="[${i}]"
        style="position:absolute;top:3px;right:3px;background:rgba(180,0,0,.85);border:none;color:#fff;border-radius:50%;width:20px;height:20px;font-size:13px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;">×</button>
    </div>
  `).join('');
}

function pmEliminarFoto(idx) {
  _pmFotosPendientes.splice(idx, 1);
  _pmRenderFotosPreview();
}

/* ── Subida a Firebase Storage ───────────────────────────────────────── */
async function _pmSubirAdjuntos(carpeta) {
  if (!firebaseStorage && typeof initFirebase === 'function') initFirebase();
  if (!firebaseStorage) throw new Error('Firebase Storage no disponible. Verifica que hayas iniciado sesión correctamente.');

  const audioBlob = _pmGrabador.getBlob();
  const progreso = document.getElementById('pm_progreso');
  const bar      = document.getElementById('pm_progreso_bar');
  const label    = document.getElementById('pm_progreso_label');
  if (progreso) progreso.style.display = 'block';

  const fotosModelo = _pmTipoProyecto() === 'bano'
    ? _pmItems.flatMap(it => it._catalogo ? [] : it._fotos.filter(f => f.file))
    : [];
  const totalArchivos = _pmFotosPendientes.length + (audioBlob ? 1 : 0) + fotosModelo.length;
  let subidos = 0;
  const marcarProgreso = (texto) => {
    const pct = totalArchivos ? Math.round((subidos / totalArchivos) * 100) : 100;
    if (bar) bar.style.width = pct + '%';
    if (label) label.textContent = texto;
  };

  const fotos = [];
  for (let i = 0; i < _pmFotosPendientes.length; i++) {
    const file = _pmFotosPendientes[i];
    marcarProgreso(`Subiendo foto ${i + 1} de ${_pmFotosPendientes.length}...`);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const ref = firebaseStorage.ref(`pedidos/${carpeta}/adjuntos/foto-${Date.now()}-${i}.${ext}`);
    const snap = await ref.put(file);
    fotos.push(await snap.ref.getDownloadURL());
    subidos++;
  }

  let audioUrl = '';
  if (audioBlob) {
    marcarProgreso('Subiendo nota de voz...');
    const ext = (audioBlob.type.split('/')[1] || 'webm').split(';')[0];
    const ref = firebaseStorage.ref(`pedidos/${carpeta}/adjuntos/audio-${Date.now()}.${ext}`);
    const snap = await ref.put(audioBlob);
    audioUrl = await snap.ref.getDownloadURL();
    subidos++;
  }

  // Cada foto subida se reemplaza por su URL de Storage (si falla a la
  // mitad y se vuelve a guardar, las ya subidas no se suben otra vez).
  for (let i = 0; i < fotosModelo.length; i++) {
    const foto = fotosModelo[i];
    marcarProgreso(`Subiendo foto del modelo ${i + 1} de ${fotosModelo.length}...`);
    const ext = (foto.file.name.split('.').pop() || 'jpg').toLowerCase();
    const ref = firebaseStorage.ref(`pedidos/${carpeta}/modelos/modelo-${Date.now()}-${i}.${ext}`);
    const snap = await ref.put(foto.file);
    URL.revokeObjectURL(foto.url);
    foto.url = await snap.ref.getDownloadURL();
    foto.file = null;
    subidos++;
  }

  marcarProgreso('¡Listo!');
  setTimeout(() => { if (progreso) progreso.style.display = 'none'; }, 1500);
  return { fotos, audioUrl };
}

/* ── Guardar ─────────────────────────────────────────────────────────── */
function _pmItemsParaEnviar(tipoProyecto) {
  if (tipoProyecto !== 'bano') {
    // Cocina/clóset: un solo renglón con todo lo que dio el cliente.
    const m = id => document.getElementById(id)?.value.trim() || '';
    const dims = [['Ancho', m('pm_med_ancho')], ['Alto', m('pm_med_alto')], ['Fondo', m('pm_med_fondo')]]
      .filter(([, v]) => v).map(([k, v]) => `${k} ${v} m`).join(' · ');
    return [{
      id: _pmEdit?.lineaMedidaId || null,
      producto_id: null,
      nombre: tipoProyecto === 'cocina' ? 'Cocina a la medida' : 'Clóset a la medida',
      cantidad: 1, unidad: 'juego',
      precio_unitario: window.WH_PM_MONTOS ? _pmNum('pm_med_precio') : 0,
      medidas_personalizadas: [dims, m('pm_med_notas')].filter(Boolean).join('\n'),
      color: m('pm_med_colores'),
      info_extra: m('pm_med_info'),
    }];
  }
  return _pmItems
    .filter(it => it.nombre.trim() && it.cantidad > 0)
    .map(it => {
      // Fuera de catálogo: las medidas que dio el cliente van como texto
      // junto a la línea (el ancho también como dato aparte).
      const dimsCustom = it._catalogo ? '' : [['Ancho', it.ancho_cm], ['Alto', it.alto_cm], ['Fondo', it.fondo_cm]]
        .filter(([, v]) => v).map(([k, v]) => `${k} ${v} cm`).join(' · ');
      const fotos = it._catalogo ? [] : it._fotos.filter(f => !f.file).map(f => f.url);
      return {
        id: it.id || null,
        producto_id: it.producto_id,
        nombre: it.nombre.trim(),
        cantidad: it.cantidad,
        unidad: it.unidad || 'pza',
        precio_unitario: it.precio_unitario,
        ancho_cm: it.ancho_cm ? parseInt(it.ancho_cm, 10) : null,
        cubierta: it.cubierta,
        ovalin: it.ovalin || null,
        monomando: it.monomando || null,
        adicionales: it.adicionales,
        color: it.color.trim(),
        info_extra: it.info_extra.trim(),
        medidas_personalizadas: [dimsCustom, it.medidas_personalizadas.trim()].filter(Boolean).join('\n'),
        imagen_referencia: fotos[0] || '',
        imagenes_referencia: fotos,
      };
    });
}

async function guardarPedidoManual() {
  const nombre      = document.getElementById('pm_nombre').value.trim();
  const telefono    = document.getElementById('pm_telefono').value.trim();
  const direccion   = document.getElementById('pm_direccion').value.trim();
  const descripcion = document.getElementById('pm_descripcion').value.trim();

  const fechaEntrega = document.getElementById('pm_fecha_entrega')?.value || '';
  const entrega = _pmValorRadio('pm_entrega') || 'instalacion';
  const telefonosSec = _pmTelefonosSec.map(t => t.trim()).filter(Boolean);

  const tipoProyecto = _pmTipoProyecto();
  if (tipoProyecto === 'bano' && _pmItems.some(it => it._catalogo && !it.producto_id)) {
    showNotification('Hay un mueble del catálogo sin modelo elegido — búscalo o quítalo', 'error');
    return;
  }
  const sinAncho = _pmItems.findIndex(it => it._catalogo && it._anchoOtro && !(parseInt(it.ancho_cm, 10) >= 20));
  if (tipoProyecto === 'bano' && sinAncho >= 0) {
    showNotification(`En el mueble ${sinAncho + 1} elegiste "Otra medida": escribe el ancho en cm (ej. 55).`, 'error');
    _pmEnfocarItem(sinAncho, '[data-pm-campo="ancho_cm"]');
    return;
  }
  if (tipoProyecto === 'bano' && _pmItems.some(it => !it._catalogo && !it.nombre.trim())) {
    showNotification('Ponle nombre o descripción al modelo que no está en el catálogo', 'error');
    return;
  }

  if (!nombre) { showNotification('Falta el nombre del cliente', 'error'); return; }
  if (entrega !== 'recoger' && !direccion) {
    showNotification('Falta la dirección de entrega (o elige "Pasa a recogerlo")', 'error');
    return;
  }
  let pago = {};
  if (window.WH_PM_MONTOS && _pmEdit) {
    const { total } = _pmTotales();
    if (total < _pmEdit.pagado - 0.009) {
      showNotification(`El total (${fmtMoneyPM(total)}) no puede quedar debajo de lo que el cliente ya pagó (${fmtMoneyPM(_pmEdit.pagado)}).`, 'error');
      document.getElementById('pm_total_acordado')?.focus();
      return;
    }
    pago = {
      costo_envio: _pmNum('pm_costo_envio'),
      costo_instalacion: _pmNum('pm_costo_instalacion'),
      descuento: _pmNum('pm_descuento'),
      total_acordado: _pmNum('pm_total_acordado'),
    };
  } else if (window.WH_PM_MONTOS) {
    const { total } = _pmTotales();
    const tipoPago = _pmValorRadio('pm_tipo_pago') || 'completo';
    const monto = tipoPago === 'sin_pago' ? 0 : _pmNum('pm_monto_pagado');
    if (tipoPago === 'anticipo' && monto <= 0) {
      showNotification('Escribe cuánto dejó de anticipo.', 'error');
      return;
    }
    if (tipoPago === 'anticipo' && monto >= total) {
      showNotification(`El anticipo (${fmtMoneyPM(monto)}) no puede ser igual o mayor al total del pedido (${fmtMoneyPM(total)}). Si el cliente acordó otro total, escríbelo en "Total acordado con el cliente"; si ya pagó todo, elige "Pagó completo".`, 'error');
      document.getElementById('pm_total_acordado')?.focus();
      return;
    }
    if (tipoPago === 'completo' && total <= 0) {
      showNotification('Para "Pagó completo" pon el precio de los muebles (el total no puede ser $0).', 'error');
      return;
    }
    pago = {
      costo_envio: _pmNum('pm_costo_envio'),
      costo_instalacion: _pmNum('pm_costo_instalacion'),
      descuento: _pmNum('pm_descuento'),
      tipo_pago: tipoPago,
      monto_pagado: monto,
      total_acordado: _pmNum('pm_total_acordado'),
      metodo_pago: document.getElementById('pm_metodo_pago')?.value || 'efectivo',
      referencia_pago: document.getElementById('pm_referencia_pago')?.value.trim() || '',
    };
  }
  if (fechaEntrega && fechaEntrega < _pmHoyISO() && fechaEntrega !== _pmEdit?.fechaOriginal) {
    showNotification('La fecha de entrega no puede ser anterior a hoy', 'error');
    return;
  }
  if (tipoProyecto !== 'bano' && !document.getElementById('pm_med_info').value.trim() && !descripcion && !_pmGrabador.tieneBlob()) {
    showNotification('Escribe en "Información detallada" qué quiere el cliente (o graba una nota de voz)', 'error');
    return;
  }
  if (tipoProyecto === 'bano' && !descripcion && !_pmGrabador.tieneBlob() && !_pmItems.length && !_pmEdit) {
    showNotification('Agrega al menos un mueble, o describe el proyecto / graba una nota de voz', 'error');
    return;
  }

  const btn = document.getElementById('pm_btn_guardar');
  btn.disabled = true;
  btn.innerHTML = '<i class="wh-icon-spin" data-lucide="loader-circle"></i> Guardando...';
  window.lucide?.createIcons();
  const edit = _pmEdit;

  try {
    const carpeta = (edit ? `editar-${edit.id}-` : 'manual-') + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const { fotos, audioUrl } = await _pmSubirAdjuntos(carpeta);
    const itemsValidos = _pmItemsParaEnviar(tipoProyecto);

    const payload = {
      nombre_cliente: nombre,
      telefono_cliente: telefono,
      telefonos_secundarios: telefonosSec,
      direccion_envio: entrega === 'recoger' ? '' : direccion,
      tipo_entrega: entrega === 'recoger' ? 'recoger' : 'envio',
      incluye_instalacion: entrega === 'instalacion',
      fecha_estimada: fechaEntrega,
      ...pago,
      descripcion,
      fotos,
      audio_url: audioUrl,
      tipo_proyecto: tipoProyecto,
      items: itemsValidos,
    };
    if (edit) {
      payload.direccion_modificada = direccion !== edit.dirOriginal.trim();
      payload.adjuntos_quitar = [...edit.quitar];
    }

    const data = await apiFetch(edit
      ? `${API_BASE}/pedidos.php?action=editar_manual&id=${edit.id}`
      : `${API_BASE}/pedidos.php?action=crear_manual`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (data.success && edit) {
      showNotification(`Pedido ${data.numero_pedido} actualizado`, 'success');
      closeModal('pedidoManualModal');
      _pmEdit = null;
      if (typeof window.cargarPedidosAPI === 'function') window.cargarPedidosAPI();
      else if (typeof cargarPedidosEmpleadoAPI === 'function') cargarPedidosEmpleadoAPI();
      const ver = window.verDetallePedidoAdmin || window.verDetallePedidoEmp;
      if (typeof ver === 'function') ver(edit.id);
    } else if (data.success) {
      showNotification(`Pedido ${data.numero_pedido} creado`, 'success');
      if (data.aviso_capacidad) setTimeout(() => showNotification(data.aviso_capacidad, 'warning'), 600);
      closeModal('pedidoManualModal');
      if (typeof window.cargarPedidosAPI === 'function') window.cargarPedidosAPI();
      else if (typeof cargarPedidosEmpleadoAPI === 'function') cargarPedidosEmpleadoAPI();
    } else {
      showNotification(data.error || (edit ? 'No se pudieron guardar los cambios' : 'Error al crear el pedido'), 'error');
    }
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = _pmEdit ? '<i data-lucide="save"></i> Guardar cambios' : '<i data-lucide="save"></i> Crear pedido';
    window.lucide?.createIcons();
  }
}

/* ── Drag & drop + input de fotos (mismo patrón que productoModal) ───── */
document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('pmImgDropZone');
  if (dropZone) {
    dropZone.addEventListener('dragover', function (e) {
      e.preventDefault(); e.stopPropagation();
      this.style.borderColor = 'var(--accent)';
    });
    dropZone.addEventListener('dragleave', function (e) {
      e.stopPropagation();
      this.style.borderColor = 'var(--border)';
    });
    dropZone.addEventListener('drop', function (e) {
      e.preventDefault(); e.stopPropagation();
      this.style.borderColor = 'var(--border)';
      pmPreviewFotos(e.dataTransfer.files);
    });
  }
  // Campos de cada mueble y teléfonos: delegados, porque se re-renderizan.
  const itemsCont = document.getElementById('pm_items_tabla');
  if (itemsCont) {
    const alCambiar = function (e) {
      const campo = e.target.dataset.pmCampo;
      const card = e.target.closest('[data-pm-item]');
      if (campo && card) pmActualizarItemCampo(Number(card.dataset.pmItem), campo, e.target.value);
    };
    itemsCont.addEventListener('input', alCambiar);
    itemsCont.addEventListener('change', alCambiar);
    itemsCont.addEventListener('change', function (e) {
      if (!e.target.matches('[data-pm-adicional]')) return;
      const card = e.target.closest('[data-pm-item]');
      if (card) pmToggleAdicional(Number(card.dataset.pmItem), e.target.dataset.pmAdicional, e.target.checked);
    });
    itemsCont.addEventListener('change', function (e) {
      if (!e.target.matches('[data-pm-foto-modelo]')) return;
      const card = e.target.closest('[data-pm-item]');
      if (card && e.target.files?.length) pmFotoModelo(Number(card.dataset.pmItem), e.target.files);
    });
    itemsCont.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.matches('[data-pm-buscar]')) {
        e.preventDefault();
        pmBuscarProducto(Number(e.target.closest('[data-pm-item]').dataset.pmItem));
      }
    });
  }
  document.querySelectorAll('input[name="pm_tipo_proyecto"]').forEach(r => r.addEventListener('change', pmActualizarTipo));
  document.getElementById('pm_med_precio')?.addEventListener('input', pmActualizarPago);
  document.querySelectorAll('input[name="pm_entrega"]').forEach(r => r.addEventListener('change', pmActualizarEntrega));
  document.querySelectorAll('input[name="pm_tipo_pago"]').forEach(r => r.addEventListener('change', () => {
    const m = document.getElementById('pm_monto_pagado');
    if (m) delete m.dataset.editado; // al cambiar de opción, volver a sugerir el monto
    pmActualizarPago();
  }));
  ['pm_costo_envio', 'pm_costo_instalacion', 'pm_descuento', 'pm_total_acordado'].forEach(id =>
    document.getElementById(id)?.addEventListener('input', pmActualizarPago));
  document.getElementById('pm_monto_pagado')?.addEventListener('input', function () {
    this.dataset.editado = '1';
    pmActualizarPago();
  });
  const telCont = document.getElementById('pm_telefonos_sec');
  if (telCont) {
    telCont.addEventListener('input', function (e) {
      const idx = e.target.dataset.pmTel;
      if (idx !== undefined) _pmTelefonosSec[Number(idx)] = e.target.value;
    });
  }
  const fileInput = document.getElementById('pm_fotos_files');
  if (fileInput) {
    fileInput.addEventListener('change', function () { pmPreviewFotos(this.files); });
  }
});

window.abrirModalCrearPedido  = abrirModalCrearPedido;
window.abrirModalEditarPedido = abrirModalEditarPedido;
window.pmToggleAdjunto        = pmToggleAdjunto;
window.guardarPedidoManual    = guardarPedidoManual;
window.pmPreviewFotos         = pmPreviewFotos;
window.pmEliminarFoto         = pmEliminarFoto;
window.pmBuscarProducto       = pmBuscarProducto;
window.pmSeleccionarProducto  = pmSeleccionarProducto;
window.pmAgregarLineaCustom   = pmAgregarLineaCustom;
window.pmEliminarItem         = pmEliminarItem;
window.pmAgregarModelo        = pmAgregarModelo;
window.pmCambiarModelo        = pmCambiarModelo;
window.pmToggleMedidas        = pmToggleMedidas;
window.pmElegirAncho          = pmElegirAncho;
window.pmAnchoOtro            = pmAnchoOtro;
window.pmSinAccesorios        = pmSinAccesorios;
window.pmQuitarFotoModelo     = pmQuitarFotoModelo;
window.pmAgregarTelefono      = pmAgregarTelefono;
window.pmEliminarTelefono     = pmEliminarTelefono;
window.pmActualizarItemCampo  = pmActualizarItemCampo;
