// pedido-manual.js — Modal "Crear pedido" para jefe/diseñador: carga a mano
// un encargo que hoy llega por WhatsApp (sin catálogo/precio), con
// descripción libre y/o nota de voz + fotos de referencia para el diseñador.
// Compartido entre panel_administrador.php (jefe) y panel_empleado.php
// (diseñador) — usa apiFetch/API_BASE/showNotification/openModal/closeModal/
// firebaseStorage/initFirebase/crearGrabadorAudio, ya globales en ambos
// paneles (crearGrabadorAudio viene de voice-recorder.js).

let _pmFotosPendientes = [];
let _pmItems = []; // [{nombre, cantidad, unidad, precio_unitario}]

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
  _pmResetForm();
  openModal('pedidoManualModal');
}

function _pmResetForm() {
  document.getElementById('pm_nombre').value = '';
  document.getElementById('pm_telefono').value = '';
  document.getElementById('pm_direccion').value = '';
  document.getElementById('pm_descripcion').value = '';
  _pmFotosPendientes = [];
  _pmRenderFotosPreview();
  _pmGrabador.borrar();
  const progreso = document.getElementById('pm_progreso');
  if (progreso) progreso.style.display = 'none';
  _pmItems = [];
  const buscarResultados = document.getElementById('pm_buscar_resultados');
  if (buscarResultados) buscarResultados.innerHTML = '';
  const buscarInput = document.getElementById('pm_buscar_producto');
  if (buscarInput) buscarInput.value = '';
  _pmRenderItemsTabla();
}

/* ── Productos del pedido: catálogo o línea personalizada ─────────────── */
async function pmBuscarProducto() {
  const input = document.getElementById('pm_buscar_producto');
  const resultados = document.getElementById('pm_buscar_resultados');
  const q = input?.value?.trim() || '';
  if (!resultados) return;
  if (q.length < 2) {
    resultados.innerHTML = '<div style="font-size:12px;color:var(--muted);">Escribe al menos 2 letras.</div>';
    return;
  }
  resultados.innerHTML = '<div style="font-size:12px;color:var(--muted);"><i class="wh-icon-spin" data-lucide="loader-circle"></i> Buscando...</div>';
  window.lucide?.createIcons();
  try {
    const data = await apiFetch(`${API_BASE}/productos.php?busqueda=${encodeURIComponent(q)}&limit=8`);
    const productos = data?.productos || [];
    if (!productos.length) {
      resultados.innerHTML = '<div style="font-size:12px;color:var(--muted);">Sin resultados en el catálogo — usa "línea personalizada" si es a la medida.</div>';
      return;
    }
    resultados.innerHTML = productos.map(p => `
      <button type="button" class="btn btn-secondary btn-small" style="justify-content:flex-start;text-align:left;"
        data-call="pmSeleccionarProducto" data-args='[${p.id}, ${JSON.stringify(p.nombre)}, ${Number(p.precio)||0}]'>
        <i data-lucide="box"></i> ${escapeHtml(p.nombre)} — ${fmtMoneyPM(p.precio)}
      </button>
    `).join('');
    window.lucide?.createIcons();
  } catch (e) {
    resultados.innerHTML = '<div style="font-size:12px;color:var(--danger,#e57373);">Error al buscar.</div>';
  }
}

function pmSeleccionarProducto(productoId, nombre, precio) {
  // producto_id viaja hasta detalle_pedido — igual que cuando el cliente lo
  // agrega desde el catálogo en el sitio, así se liga a sus especificaciones
  // reales (medidas, material) en vez de quedar como una línea suelta.
  _pmItems.push({ producto_id: productoId, nombre, cantidad: 1, unidad: 'pza', precio_unitario: precio || 0 });
  document.getElementById('pm_buscar_resultados').innerHTML = '';
  document.getElementById('pm_buscar_producto').value = '';
  _pmRenderItemsTabla();
}

function pmAgregarLineaCustom() {
  _pmItems.push({ producto_id: null, nombre: '', cantidad: 1, unidad: 'pza', precio_unitario: 0 });
  _pmRenderItemsTabla();
}

function pmEliminarItem(idx) {
  _pmItems.splice(idx, 1);
  _pmRenderItemsTabla();
}

function pmActualizarItemCampo(idx, campo, valor) {
  if (!_pmItems[idx]) return;
  _pmItems[idx][campo] = (campo === 'cantidad' || campo === 'precio_unitario') ? parseFloat(valor) || 0 : valor;
  _pmRenderItemsTabla(true);
}

function fmtMoneyPM(n) { return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }); }

function _pmRenderItemsTabla(soloTotal) {
  const totalWrap = document.getElementById('pm_items_total_wrap');
  const totalSpan = document.getElementById('pm_items_total');
  const total = _pmItems.reduce((s, it) => s + (it.cantidad || 0) * (it.precio_unitario || 0), 0);
  if (totalWrap) totalWrap.style.display = _pmItems.length ? '' : 'none';
  if (totalSpan) totalSpan.textContent = fmtMoneyPM(total);
  if (soloTotal) return; // el usuario está escribiendo en un input — no reconstruir la tabla y robarle el foco

  const tabla = document.getElementById('pm_items_tabla');
  if (!tabla) return;
  if (!_pmItems.length) { tabla.innerHTML = ''; return; }
  tabla.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:var(--bg);">
        <th style="padding:6px 4px;text-align:left;color:var(--accent);">Producto / descripción</th>
        <th style="padding:6px 4px;width:70px;color:var(--accent);">Cant.</th>
        <th style="padding:6px 4px;width:70px;color:var(--accent);">Unidad</th>
        <th style="padding:6px 4px;width:90px;color:var(--accent);">P. Unit.</th>
        <th style="padding:6px 4px;width:30px;"></th>
      </tr></thead>
      <tbody>
        ${_pmItems.map((it, idx) => `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:4px;"><input type="text" class="form-input" style="font-size:12px;padding:4px 6px;" value="${escapeHtml(it.nombre)}" placeholder="ej: Mueble de baño 280cm" oninput="pmActualizarItemCampo(${idx},'nombre',this.value)"></td>
            <td style="padding:4px;"><input type="number" class="form-input" style="font-size:12px;padding:4px 6px;" value="${it.cantidad}" min="0" step="0.01" oninput="pmActualizarItemCampo(${idx},'cantidad',this.value)"></td>
            <td style="padding:4px;">
              <select class="form-select" style="font-size:12px;padding:4px 6px;" onchange="pmActualizarItemCampo(${idx},'unidad',this.value)">
                ${['pza','ml','m2','juego'].map(u => `<option value="${u}" ${it.unidad===u?'selected':''}>${u}</option>`).join('')}
              </select>
            </td>
            <td style="padding:4px;"><input type="number" class="form-input" style="font-size:12px;padding:4px 6px;" value="${it.precio_unitario}" min="0" step="0.01" oninput="pmActualizarItemCampo(${idx},'precio_unitario',this.value)"></td>
            <td style="padding:4px;text-align:center;">
              <button type="button" class="btn-eliminar-img" data-call="pmEliminarItem" data-args="[${idx}]" style="background:rgba(180,0,0,.85);border:none;color:#fff;border-radius:50%;width:20px;height:20px;font-size:13px;cursor:pointer;line-height:1;">×</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
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

  const totalArchivos = _pmFotosPendientes.length + (audioBlob ? 1 : 0);
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

  marcarProgreso('¡Listo!');
  setTimeout(() => { if (progreso) progreso.style.display = 'none'; }, 1500);
  return { fotos, audioUrl };
}

/* ── Guardar ─────────────────────────────────────────────────────────── */
async function guardarPedidoManual() {
  const nombre      = document.getElementById('pm_nombre').value.trim();
  const telefono    = document.getElementById('pm_telefono').value.trim();
  const direccion   = document.getElementById('pm_direccion').value.trim();
  const descripcion = document.getElementById('pm_descripcion').value.trim();

  const itemsValidos = _pmItems.filter(it => it.nombre.trim() && it.cantidad > 0);

  if (!nombre) { showNotification('Falta el nombre del cliente', 'error'); return; }
  if (!descripcion && !_pmGrabador.tieneBlob() && !itemsValidos.length) {
    showNotification('Describe el proyecto por texto, graba una nota de voz, o agrega al menos un producto', 'error');
    return;
  }

  const btn = document.getElementById('pm_btn_guardar');
  btn.disabled = true;
  btn.innerHTML = '<i class="wh-icon-spin" data-lucide="loader-circle"></i> Guardando...';
  window.lucide?.createIcons();

  try {
    const carpeta = 'manual-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const { fotos, audioUrl } = await _pmSubirAdjuntos(carpeta);

    const payload = {
      nombre_cliente: nombre,
      telefono_cliente: telefono,
      direccion_envio: direccion,
      descripcion,
      fotos,
      audio_url: audioUrl,
      items: itemsValidos,
    };

    const data = await apiFetch(`${API_BASE}/pedidos.php?action=crear_manual`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (data.success) {
      showNotification(`Pedido ${data.numero_pedido} creado`, 'success');
      closeModal('pedidoManualModal');
      if (typeof window.cargarPedidosAPI === 'function') window.cargarPedidosAPI();
      else if (typeof cargarPedidosEmpleadoAPI === 'function') cargarPedidosEmpleadoAPI();
    } else {
      showNotification(data.error || 'Error al crear el pedido', 'error');
    }
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="save"></i> Crear pedido';
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
  const buscarInput = document.getElementById('pm_buscar_producto');
  if (buscarInput) {
    buscarInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); pmBuscarProducto(); }
    });
  }
  const fileInput = document.getElementById('pm_fotos_files');
  if (fileInput) {
    fileInput.addEventListener('change', function () { pmPreviewFotos(this.files); });
  }
});

window.abrirModalCrearPedido  = abrirModalCrearPedido;
window.guardarPedidoManual    = guardarPedidoManual;
window.pmPreviewFotos         = pmPreviewFotos;
window.pmEliminarFoto         = pmEliminarFoto;
window.pmBuscarProducto       = pmBuscarProducto;
window.pmSeleccionarProducto  = pmSeleccionarProducto;
window.pmAgregarLineaCustom   = pmAgregarLineaCustom;
window.pmEliminarItem         = pmEliminarItem;
window.pmActualizarItemCampo  = pmActualizarItemCampo;
