// =====================================================
// Wooden House — Seguimiento de solicitudes
// =====================================================
const API_URL = '/api';

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
  const params = new URLSearchParams(window.location.search);
  const token  = params.get('token');
  const pedido = params.get('pedido');
  if (token && pedido) {
    const trackInput = document.getElementById('trackingNumber');
    if (trackInput) { trackInput.value = pedido; trackOrder(); }
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
      en_produccion:'En producción', listo:'Listo para entrega',
      entregado:'Entregado', cancelado:'Cancelado',
      en_revision:'En revisión', respondida:'Respondida', cerrada:'Cerrada',
      confirmada:'Confirmada', completada:'Completada'
    };
    const est         = item.estado || 'nueva';
    const label       = estadoLabels[est] || est;
    const fechaCreada = (item.fecha_creacion || '').substring(0, 10);

    let timelineHtml = '';
    if (data.pedido && est !== 'cancelado') {
      const stages      = ['pendiente','pagado','en_produccion','listo','entregado'];
      const stageLabels = ['Recibido','Pagado','En fab.','Listo','Entregado'];
      const stageIdx    = stages.indexOf(est === 'anticipo_pagado' ? 'pendiente' : est);
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
            ¿Dudas? Escríbenos a <a href="mailto:ventas@muebleswh.com">ventas@muebleswh.com</a>
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

window.trackOrder = trackOrder;
