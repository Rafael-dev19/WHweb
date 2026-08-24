// =====================================================
// Wooden House — Seguimiento de solicitudes
// =====================================================
const API_URL = '/api';
const siteEmail = document.body.dataset.siteEmail || 'woodenhouse250@gmail.com';

document.addEventListener('DOMContentLoaded', function () {
  initCartBadge();
  initSeguimiento();
  checkURLParams();
});

function initCartBadge() {
  const badge = document.getElementById('cartCount');
  if (!badge) return;
  try {
    const c = JSON.parse(sessionStorage.getItem('carrito') || '[]');
    const total = c.reduce((s, i) => s + (i.cantidad || 0), 0);
    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-block' : 'none';
  } catch { badge.style.display = 'none'; }
}

function checkURLParams() {
  const params      = new URLSearchParams(window.location.search);
  const token       = params.get('token');
  const pedido      = params.get('pedido');
  const cotizacion  = params.get('cotizacion');
  if (token && pedido) {
    const trackInput = document.getElementById('trackingNumber');
    if (trackInput) { trackInput.value = pedido; trackOrder(); }
    return;
  }
  // Enlace de confirmación de cotización (viene del correo de la propuesta) —
  // usa el token secreto, no el folio público, para poder mostrar precio/PDF.
  if (token && cotizacion) {
    trackCotizacionPorToken(token);
  }
}

function initSeguimiento() {
  const resultBox = document.getElementById('trackingResult');
  if (resultBox) {
    resultBox.style.display = 'none';
    resultBox.innerHTML = '';
  }
  const input = document.getElementById('trackingNumber');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); trackOrder(); }
    });
    input.addEventListener('input', function () {
      this.value = this.value.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
    });
  }
}

async function trackOrder() {
  const input          = document.getElementById('trackingNumber');
  const trackingNumber = (input?.value || '').trim().toUpperCase();
  const resultBox      = document.getElementById('trackingResult');
  const btn            = document.querySelector('.btn-track');

  if (!trackingNumber) {
    showAlert('Por favor ingresa un número de seguimiento', 'error'); return;
  }

  const regexPedido = /^WH-\d{4}-\d{6}$/;
  const regexCita   = /^CIT-\d{4}-\d{6}$/;
  const regexCot    = /^COT-\d{4,}-\d+$/;
  const esPedido    = regexPedido.test(trackingNumber);
  const esCita      = regexCita.test(trackingNumber);
  const esCot       = regexCot.test(trackingNumber);

  if (!esPedido && !esCita && !esCot) {
    showAlert('Formato inválido. Ejemplos: WH-2026-000001 · CIT-2026-000001 · COT-2026-1', 'error');
    return;
  }

  if (btn) {
    btn.disabled  = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Buscando...';
  }
  if (resultBox) {
    resultBox.style.display = 'none';
    resultBox.innerHTML = '';
  }

  try {
    let endpoint = '';
    if (esPedido)    endpoint = `${API_URL}/pedidos.php?numero=${encodeURIComponent(trackingNumber)}`;
    else if (esCita) endpoint = `${API_URL}/citas.php?numero_cita=${encodeURIComponent(trackingNumber)}`;
    else             endpoint = `${API_URL}/cotizaciones.php?numero=${encodeURIComponent(trackingNumber)}`;

    const res = await fetch(endpoint);

    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      throw new Error('El servidor no respondió correctamente. Intenta más tarde.');
    }

    const data = await res.json();

    if (!data.success || (!data.pedido && !data.cotizacion && !data.cita)) {
      showAlert('No se encontró ninguna solicitud con ese número. Verifica que esté escrito correctamente.', 'error');
      return;
    }

    const item  = data.pedido || data.cotizacion || data.cita;
    const tipo  = data.pedido ? 'Pedido' : data.cita ? 'Cita' : 'Cotización';
    const folio = item.numero_pedido || item.numero_cita || item.numero_cotizacion || trackingNumber;

    const estadoLabels = {
      nueva:'Nueva', pendiente:'Pendiente', anticipo_pagado:'Anticipo pagado', pagado:'Pago confirmado',
      listo_para_produccion:'En diseño', en_produccion:'En producción',
      alistando_pedido:'Alistando pedido', en_camino_instalacion:'En camino a instalación',
      finalizado:'Finalizado', cancelado:'Cancelado',
      en_revision:'En revisión', respondida:'Respondida', cerrada:'Cerrada',
      confirmada:'Confirmada', completada:'Completada'
    };
    const est         = item.estado || 'nueva';
    const label       = estadoLabels[est] || est;
    const fechaCreada = (item.fecha_creacion || '').substring(0, 10);

    let timelineHtml = '';
    if (data.pedido && est !== 'cancelado') {
      const stages      = ['pendiente','en_produccion','alistando_pedido','en_camino_instalacion','finalizado'];
      const stageLabels = ['Recibido','En fabricación','Alistando','En camino','Finalizado'];
      // anticipo_pagado/pagado/listo_para_produccion todavía no entran a fabricación —
      // se muestran en la misma posición que "Recibido".
      const stageAlias = { anticipo_pagado:'pendiente', pagado:'pendiente', listo_para_produccion:'pendiente' };
      const stageIdx    = stages.indexOf(stageAlias[est] || est);
      timelineHtml = `
        <div class="track-timeline">
          <div class="track-timeline-label">Progreso del pedido</div>
          <div class="track-timeline-steps">
            ${stages.map((_s, i) => {
              const done    = i < stageIdx;
              const current = i === stageIdx;
              return `<div class="track-step">
                ${i > 0 ? `<div class="track-step-connector${done || current ? ' done' : ''}"></div>` : ''}
                <div class="track-step-dot${current ? ' current' : done ? ' done' : ''}">
                  ${done ? '✓' : current ? '●' : ''}
                </div>
                <div class="track-step-name${current || done ? ' active' : ''}">${stageLabels[i]}</div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    }

    let infoItems = `
      <div class="track-info-item">
        <div class="track-info-label">Cliente</div>
        <div class="track-info-value">${escapeHtml(item.nombre_cliente || '—')}</div>
      </div>
      <div class="track-info-item">
        <div class="track-info-label">Registrado</div>
        <div class="track-info-value">${fechaCreada}</div>
      </div>`;

    if (data.pedido) {
      if (item.fecha_estimada) infoItems += `
        <div class="track-info-item">
          <div class="track-info-label">Entrega estimada</div>
          <div class="track-info-value">${item.fecha_estimada}</div>
        </div>`;
      if (item.total) infoItems += `
        <div class="track-info-item">
          <div class="track-info-label">Total</div>
          <div class="track-info-value" style="color:#8b7355;font-size:16px;">
            ${new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(item.total)}
          </div>
        </div>`;

      if (item.tipo_pago === 'anticipo') {
        const saldoPendiente = Math.max(0, (item.total || 0) - (item.monto_pagado || 0));
        infoItems += `
          <div class="track-info-item">
            <div class="track-info-label">Pagado</div>
            <div class="track-info-value">${new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(item.monto_pagado || 0)}</div>
          </div>`;
        if (saldoPendiente > 0.009) infoItems += `
          <div class="track-info-item">
            <div class="track-info-label">Saldo pendiente</div>
            <div class="track-info-value" style="color:#e0a050;font-size:16px;">
              ${new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(saldoPendiente)}
            </div>
          </div>`;
      }
    }

    if (data.cita) {
      if (item.fecha_cita) infoItems += `
        <div class="track-info-item">
          <div class="track-info-label">Fecha de cita</div>
          <div class="track-info-value">${item.fecha_cita}</div>
        </div>`;
      if (item.rango_horario) infoItems += `
        <div class="track-info-item">
          <div class="track-info-label">Horario</div>
          <div class="track-info-value">${escapeHtml(item.rango_horario)}</div>
        </div>`;
      const tipoLabels = { medicion:'Medición', instalacion:'Instalación', otro:'Otro' };
      infoItems += `
        <div class="track-info-item">
          <div class="track-info-label">Tipo</div>
          <div class="track-info-value">${tipoLabels[item.tipo] || escapeHtml(item.tipo) || '—'}</div>
        </div>`;
    }

    if (data.cotizacion) {
      if (item.modelo_mueble) infoItems += `
        <div class="track-info-item">
          <div class="track-info-label">Tipo de mueble</div>
          <div class="track-info-value">${escapeHtml(item.modelo_mueble)}</div>
        </div>`;
    }

    const saldoPendienteBtn = (data.pedido && item.tipo_pago === 'anticipo' && Math.max(0, (item.total || 0) - (item.monto_pagado || 0)) > 0.009)
      ? `<div style="text-align:center;margin-top:16px;">
           <a href="/pago?modo=saldo&numero=${encodeURIComponent(item.numero_pedido)}" class="btn-track" style="display:inline-flex;text-decoration:none;">
             <i class="fa-solid fa-credit-card"></i> Pagar saldo pendiente
           </a>
         </div>`
      : '';

    if (resultBox) {
      resultBox.innerHTML = `
        <div class="track-result-card">
          <div class="track-result-header">
            <div>
              <div class="track-tipo">${tipo}</div>
              <div class="track-folio">${escapeHtml(folio)}</div>
            </div>
            <span class="track-status-badge st-${est}">
              ${escapeHtml(label)}
            </span>
          </div>
          <div class="track-result-body">
            ${timelineHtml}
            <div class="track-info-grid">${infoItems}</div>
            ${saldoPendienteBtn}
          </div>
          <div class="track-result-footer">
            <i class="fa-solid fa-envelope"></i>
            ¿Dudas? Escríbenos a <a href="mailto:${siteEmail}">${siteEmail}</a>
          </div>
        </div>`;
      resultBox.style.display = 'block';
      resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

  } catch (err) {
    console.error('[seguimiento]', err);
    if (resultBox) { resultBox.innerHTML = ''; resultBox.style.display = 'none'; }
    showAlert(err.message || 'Error al consultar. Por favor intenta más tarde.', 'error');
  } finally {
    if (btn) {
      btn.disabled  = false;
      btn.innerHTML = '<i class="fa-solid fa-search"></i> Buscar';
    }
  }
}

// ── Cotización por token (enlace del correo de la propuesta) ──────
// A diferencia de trackOrder() (búsqueda pública por folio, datos limitados),
// esta vista es la única que muestra precio/partidas/PDF y el botón de
// confirmar — solo alcanzable con el token secreto que llega por correo.
async function trackCotizacionPorToken(token) {
  const resultBox = document.getElementById('trackingResult');
  const input     = document.getElementById('trackingNumber');
  if (resultBox) { resultBox.style.display = 'none'; resultBox.innerHTML = ''; }

  try {
    const res  = await fetch(`${API_URL}/cotizaciones.php?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!data.success || !data.cotizacion) {
      showAlert('No se encontró tu cotización. Verifica el enlace de tu correo.', 'error');
      return;
    }
    const cot = data.cotizacion;
    if (input) input.value = cot.numero_cotizacion || '';
    renderCotizacionToken(cot, token);
  } catch (err) {
    console.error('[seguimiento token]', err);
    showAlert('Error al consultar tu cotización. Intenta de nuevo más tarde.', 'error');
  }
}

function renderCotizacionToken(cot, token) {
  const resultBox = document.getElementById('trackingResult');
  if (!resultBox) return;

  const estadoLabels = {
    en_revision:'En revisión', respondida:'Propuesta lista', aceptada:'Confirmada',
    convertida_a_pedido:'En producción', cancelada:'Cancelada',
  };
  const est   = cot.estado || 'en_revision';
  const label = estadoLabels[est] || est;
  const money = (n) => new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(n || 0);

  const itemsRows = (cot.items || []).map(it => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5ddd4;">${escapeHtml(it.nombre_item)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5ddd4;text-align:center;">${it.cantidad} ${escapeHtml(it.unidad)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5ddd4;text-align:right;">${money(it.subtotal)}</td>
    </tr>`).join('');

  let accionHtml = '';
  if (est === 'respondida') {
    accionHtml = `
      <div style="text-align:center;margin-top:18px;">
        <button class="btn-track" onclick="confirmarCotizacion('${token}')"><i class="fa-solid fa-check"></i> Confirmar y continuar con mi proyecto</button>
      </div>`;
  } else if (est === 'aceptada') {
    accionHtml = `<p style="text-align:center;color:#4a8b5a;font-weight:600;margin-top:14px;"><i class="fa-solid fa-circle-check"></i> Confirmado — en espera de que agendemos tu producción.</p>`;
  } else if (est === 'convertida_a_pedido' && cot.numero_pedido) {
    accionHtml = `
      <div style="text-align:center;margin-top:18px;">
        <a href="/seguimiento?pedido=${encodeURIComponent(cot.numero_pedido)}" class="btn-track" style="display:inline-flex;text-decoration:none;">
          <i class="fa-solid fa-box"></i> Ver seguimiento de tu pedido ${escapeHtml(cot.numero_pedido)}
        </a>
      </div>`;
  }

  resultBox.innerHTML = `
    <div style="background:#fff8f0;border:2px solid #c9a96e;border-radius:10px;padding:6px 0;margin-bottom:16px;text-align:center;">
      <p style="margin:10px 0;color:#7a5a1a;font-size:12px;">Este cotizador es solo un estimado — esta es tu <strong>propuesta final</strong> ya confirmada por el jefe tras revisar tu proyecto.</p>
    </div>
    <div class="track-result-card">
      <div class="track-result-header">
        <div>
          <div class="track-tipo">Cotización</div>
          <div class="track-folio">${escapeHtml(cot.numero_cotizacion)}</div>
        </div>
        <span class="track-status-badge st-${est}">${escapeHtml(label)}</span>
      </div>
      <div class="track-result-body">
        <div style="text-align:center;background:#fff;border:1px solid #e5ddd4;border-radius:8px;padding:16px;margin-bottom:16px;">
          <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Precio total</div>
          <div style="font-size:28px;font-weight:700;color:#5C3D11;">${money(cot.precio_cotizado)}</div>
          ${cot.fecha_visita ? `<div style="color:#888;font-size:12px;margin-top:6px;">📍 Visita: ${escapeHtml(cot.fecha_visita)}${cot.hora_visita ? ' — ' + escapeHtml(cot.hora_visita) : ''}</div>` : ''}
          <div style="color:#888;font-size:12px;margin-top:4px;">${parseInt(cot.requiere_instalacion) ? '✅ Incluye instalación' : '— Sin instalación'}</div>
        </div>

        ${itemsRows ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
          <thead><tr style="background:#f8f4ef;"><th style="padding:6px 8px;text-align:left;">Concepto</th><th style="padding:6px 8px;">Cant.</th><th style="padding:6px 8px;text-align:right;">Subtotal</th></tr></thead>
          <tbody>${itemsRows}</tbody>
        </table>` : ''}

        ${cot.descripcion_respuesta ? `<div style="background:#fff;border:1px solid #e5ddd4;border-radius:6px;padding:14px;line-height:1.7;color:#3a3a3a;margin-bottom:12px;">${escapeHtml(cot.descripcion_respuesta).replace(/\n/g,'<br>')}</div>` : ''}

        ${cot.pdf_url ? `<p style="text-align:center;"><a href="${cot.pdf_url}" target="_blank" rel="noopener" style="color:#8b7355;font-weight:600;"><i class="fa-solid fa-file-pdf"></i> Descargar propuesta en PDF</a></p>` : ''}

        ${accionHtml}
      </div>
      <div class="track-result-footer">
        <i class="fa-solid fa-envelope"></i>
        ¿Dudas? Escríbenos a <a href="mailto:${siteEmail}">${siteEmail}</a>
      </div>
    </div>`;
  resultBox.style.display = 'block';
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function confirmarCotizacion(token) {
  if (!confirm('¿Confirmas que quieres continuar con tu proyecto bajo esta propuesta?')) return;
  try {
    const res = await fetch(`${API_URL}/cotizaciones.php?action=confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (data.success) {
      showAlert(data.mensaje || '¡Confirmado!', 'success');
      trackCotizacionPorToken(token);
    } else {
      showAlert(data.error || 'No se pudo confirmar. Intenta de nuevo.', 'error');
    }
  } catch (e) {
    showAlert('Error de conexión al confirmar.', 'error');
  }
}

function showAlert(message, type = 'info') {
  const alertDiv = document.getElementById('alertMessage');
  if (alertDiv) {
    alertDiv.className = 'alert ' + type + ' show';
    alertDiv.style.display = 'block';
    alertDiv.innerHTML = message;
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
    font-family:'Segoe UI',Tahoma,sans-serif;border-left:4px solid rgba(255,255,255,.4);`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
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

window.trackOrder            = trackOrder;
window.confirmarCotizacion   = confirmarCotizacion;
window.trackCotizacionPorToken = trackCotizacionPorToken;
