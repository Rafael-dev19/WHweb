// firebase/functions/index.js — Email triggers via Brevo para pedidos, cotizaciones y citas

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule }        = require('firebase-functions/v2/scheduler');
const { initializeApp }     = require('firebase-admin/app');
const { getFirestore }      = require('firebase-admin/firestore');
const https                 = require('https');

initializeApp();
const db = getFirestore();

const SECRETS = [
  'BREVO_API_KEY',
  'EMAIL_GENERAL', 'REPLY_TO', 'ADMIN_EMAIL',
  'APP_URL',
];

function getEmails() {
  const general = process.env.EMAIL_GENERAL || 'woodenhouse@muebleswh.com';
  const replyTo = process.env.REPLY_TO      || process.env.ADMIN_EMAIL || 'woodenhouse250@gmail.com';
  return {
    pedidos:      general,
    citas:        general,
    cotizaciones: general,
    ventas:       general,
    admin:        process.env.ADMIN_EMAIL || 'woodenhouse250@gmail.com',
    replyTo,
  };
}

function getPanelUrl() {
  const base = (process.env.APP_URL || 'https://muebleswh.com').replace(/\/$/, '');
  return base + '/admin';
}

// ── Brevo HTTP API ────────────────────────────────────────────────
function sendEmail({ from, fromName, to, subject, html, text, replyTo, bcc }) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) { reject(new Error('BREVO_API_KEY no configurado')); return; }

    const payload = {
      sender:      { name: fromName, email: from },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text || '',
    };

    // BCC: copia oculta al administrador (todos los correos llegan a la cuenta real)
    if (bcc) payload.bcc = Array.isArray(bcc) ? bcc.map(e => ({ email: e })) : [{ email: bcc }];

    // Reply-To: el cliente puede responder directamente al remitente correcto
    if (replyTo) payload.replyTo = { email: replyTo };

    const body = JSON.stringify(payload);

    const options = {
      hostname: 'api.brevo.com',
      path:     '/v3/smtp/email',
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'api-key':        apiKey,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve({ statusCode: res.statusCode });
        else reject(new Error(`Brevo ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ================================================================
// PLANTILLAS — Idénticas al _emailWrapper original
// ================================================================
function emailWrapper(titulo, contenido) {
  const year = new Date().getFullYear();
  const gold = '#8B6914';
  const bg   = '#f0ebe3';
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
  <style>
    body,table,td,p,a,li,blockquote{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    body{margin:0;padding:0;background-color:${bg};}
    table{border-spacing:0;}
    td{padding:0;}
    img{border:0;outline:none;text-decoration:none;display:block;}
  </style>
</head>
<body style="margin:0;padding:0;background-color:${bg};">
<div style="display:none;max-height:0;overflow:hidden;">${titulo} — Wooden House</div>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
       style="background-color:${bg};padding:32px 0;">
  <tr><td align="center" style="padding:0 16px;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600"
           style="width:600px;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12);">
      <tr>
        <td align="center" bgcolor="${gold}" style="background-color:${gold};padding:28px 40px;">
          <p style="margin:0;font-size:11px;letter-spacing:3px;color:rgba(255,255,255,.70);font-family:Arial,sans-serif;text-transform:uppercase;">WOODEN HOUSE</p>
          <div style="width:48px;height:2px;background:rgba(255,255,255,.40);margin:10px auto;"></div>
          <h1 style="margin:0;color:#ffffff;font-size:22px;letter-spacing:1px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;">${titulo}</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,.75);font-size:12px;font-family:Arial,sans-serif;letter-spacing:.5px;">Muebles de madera a medida • Guadalajara, México</p>
        </td>
      </tr>
      <tr>
        <td valign="top" style="padding:40px 48px;background:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.75;color:#3a3a3a;">
          ${contenido}
        </td>
      </tr>
      <tr>
        <td align="center" bgcolor="#f8f4ef" style="background-color:#f8f4ef;padding:24px 40px;border-top:1px solid #e5ddd4;">
          <p style="margin:0 0 4px;color:#aaa;font-size:11px;font-family:Arial,sans-serif;line-height:1.7;">
            © ${year} Wooden House — Guadalajara, Jalisco, México
          </p>
          <p style="margin:0;color:#bbb;font-size:11px;font-family:Arial,sans-serif;">
            Este correo fue generado automáticamente, por favor no respondas a él.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── emailPedidoConfirmado ─────────────────────────────────────────
function emailPedidoConfirmado(pedido) {
  const folio    = pedido.numero_pedido  || '';
  const nombre   = pedido.nombre_cliente || '';
  const fecha    = pedido.fecha_estimada || 'Por confirmar';
  const tracking = pedido.token_seguimiento || '';
  const trackUrl = `https://muebleswh.com/seguimiento?token=${tracking}&pedido=${folio}`;

  const fmt = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  const tipoEntrega     = pedido.tipo_entrega || 'envio';
  const costoEnvio      = Number(pedido.costo_envio || 0);
  const etiquetaEntrega = tipoEntrega === 'recoger' ? '🏠 Recoger en tienda' : '🚚 Envío a domicilio';
  const direccion = pedido.direccion_envio || '';
  const coloniaDireccion = [
    pedido.colonia_envio   ? `Col. ${pedido.colonia_envio}` : '',
    pedido.ciudad_envio    || '',
    pedido.municipio_envio ? `Mpio. ${pedido.municipio_envio}` : '',
    pedido.cp_envio        ? `CP ${pedido.cp_envio}` : '',
  ].filter(Boolean).join(', ');
  const entregaDetalle  = tipoEntrega === 'envio' && direccion
    ? `<p style="margin:4px 0 0;font-size:13px;color:#777;">📍 ${[direccion, coloniaDireccion].filter(Boolean).join(', ')}</p>` : '';
  const entregaCosto    = tipoEntrega === 'recoger'
    ? `<span style="color:#3d8b3d;font-weight:600;">Sin costo</span>`
    : `<span style="font-weight:600;">${fmt(costoEnvio)}</span>`;

  const incluyeInstalacion = pedido.incluye_instalacion;
  const costoInstalacion   = Number(pedido.costo_instalacion || 0);
  const instalacionRow     = incluyeInstalacion
    ? `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0e8d8;">🔧 Instalación profesional</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0e8d8;text-align:right;font-weight:600;">${fmt(costoInstalacion)}</td>
       </tr>`
    : `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0e8d8;color:#888;">🔧 Instalación</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0e8d8;text-align:right;color:#888;">No incluida</td>
       </tr>`;

  const subtotal  = Number(pedido.subtotal  || 0);
  const descuento = Number(pedido.descuento || 0);
  const total     = Number(pedido.total     || 0);
  const esAnticipo    = pedido.tipo_pago === 'anticipo';
  const montoPagado   = Number(pedido.monto_pagado || 0);
  const saldoPendiente = Math.max(0, total - montoPagado);

  const itemsHtml = (pedido.items || []).map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0e8d8;">${item.nombre_producto || item.nombre || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0e8d8;text-align:center;">${item.cantidad || 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0e8d8;text-align:right;">${fmt(item.precio_unitario || item.precio || 0)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0e8d8;text-align:right;font-weight:500;">${fmt((item.precio_unitario || item.precio || 0) * (item.cantidad || 1))}</td>
    </tr>`).join('');

  const descuentoRow = descuento > 0
    ? `<tr><td colspan="3" style="padding:8px 12px;text-align:right;color:#3d8b3d;">Descuento:</td><td style="padding:8px 12px;text-align:right;color:#3d8b3d;font-weight:600;">-${fmt(descuento)}</td></tr>` : '';

  const contenido = `
<h2 style="color:#8B6914;margin-top:0;">¡Pedido confirmado, ${nombre}! 🎉</h2>
<p style="color:#555;line-height:1.7;">Hemos recibido tu pedido. Nos pondremos en contacto para coordinar los detalles de entrega.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:25px 0;">
  <tr>
    <td style="background:#faf6f0;border-left:4px solid #8B6914;padding:18px 20px;border-radius:4px;">
      <strong style="font-size:18px;color:#5C3D11;display:block;margin-bottom:4px;">${folio}</strong>
      <span style="color:#888;font-size:13px;">Número de pedido — guárdalo para rastrear tu pedido</span>
    </td>
  </tr>
</table>

<!-- Productos -->
<h3 style="color:#5C3D11;font-size:15px;margin:24px 0 8px;">📦 Productos</h3>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;">
  <tr style="background:#f0e8d8;">
    <th style="padding:10px 12px;text-align:left;color:#5C3D11;">Producto</th>
    <th style="padding:10px 12px;text-align:center;color:#5C3D11;">Cant.</th>
    <th style="padding:10px 12px;text-align:right;color:#5C3D11;">Precio unit.</th>
    <th style="padding:10px 12px;text-align:right;color:#5C3D11;">Subtotal</th>
  </tr>
  ${itemsHtml}
</table>

<!-- Entrega e Instalación -->
<h3 style="color:#5C3D11;font-size:15px;margin:24px 0 8px;">🚚 Entrega e Instalación</h3>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;background:#faf6f0;border-radius:6px;">
  <tr>
    <td style="padding:12px;border-bottom:1px solid #f0e8d8;">
      <strong>${etiquetaEntrega}</strong>${entregaDetalle}
    </td>
    <td style="padding:12px;border-bottom:1px solid #f0e8d8;text-align:right;">${entregaCosto}</td>
  </tr>
  ${instalacionRow}
</table>

<!-- Resumen de costos -->
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:20px 0;">
  <tr>
    <td colspan="3" style="padding:8px 12px;text-align:right;color:#666;">Subtotal productos:</td>
    <td style="padding:8px 12px;text-align:right;">${fmt(subtotal)}</td>
  </tr>
  <tr>
    <td colspan="3" style="padding:8px 12px;text-align:right;color:#666;">Envío:</td>
    <td style="padding:8px 12px;text-align:right;">${tipoEntrega === 'recoger' ? '<span style="color:#3d8b3d;">Sin costo</span>' : fmt(costoEnvio)}</td>
  </tr>
  <tr>
    <td colspan="3" style="padding:8px 12px;text-align:right;color:#666;">Instalación:</td>
    <td style="padding:8px 12px;text-align:right;">${incluyeInstalacion ? fmt(costoInstalacion) : '<span style="color:#888;">No incluida</span>'}</td>
  </tr>
  ${descuentoRow}
  <tr style="background:#f0e8d8;">
    <td colspan="3" style="padding:12px;text-align:right;font-weight:bold;color:#5C3D11;">TOTAL:</td>
    <td style="padding:12px;text-align:right;font-weight:bold;font-size:20px;color:#8B6914;">${fmt(total)}</td>
  </tr>
</table>

${esAnticipo ? `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;background:#faf6f0;border-left:4px solid #8B6914;border-radius:4px;">
  <tr>
    <td style="padding:14px 18px;">
      <strong style="color:#5C3D11;">💳 Pagaste un anticipo del 50%</strong><br>
      <span style="color:#666;font-size:13px;">Pagado ahora: <strong>${fmt(montoPagado)}</strong> · Saldo pendiente: <strong style="color:#8B6914;">${fmt(saldoPendiente)}</strong></span><br>
      <span style="color:#888;font-size:12px;">El saldo se liquida antes de la entrega — puedes pagarlo en línea desde tu página de seguimiento o al recibir tu pedido.</span>
    </td>
  </tr>
</table>` : ''}

<p style="color:#555;"><strong>📅 Semana estimada de entrega:</strong> ${fecha}</p>

<!-- Ticket de pago -->
${(pedido.metodo_pago || pedido.referencia_pago) ? `
<h3 style="color:#5C3D11;font-size:15px;margin:24px 0 8px;">🧾 Comprobante de pago</h3>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;background:#faf6f0;border-radius:6px;">
  <tr>
    <td style="padding:10px 14px;border-bottom:1px solid #f0e8d8;color:#666;width:40%;">Método de pago</td>
    <td style="padding:10px 14px;border-bottom:1px solid #f0e8d8;font-weight:600;">${pedido.metodo_pago || '—'}</td>
  </tr>
  ${pedido.referencia_pago ? `<tr>
    <td style="padding:10px 14px;border-bottom:1px solid #f0e8d8;color:#666;">Referencia de pago</td>
    <td style="padding:10px 14px;border-bottom:1px solid #f0e8d8;font-family:monospace;font-size:12px;word-break:break-all;">${pedido.referencia_pago}</td>
  </tr>` : ''}
  <tr>
    <td style="padding:10px 14px;color:#666;">Fecha de pago</td>
    <td style="padding:10px 14px;font-weight:600;">${pedido.fecha_pago || '—'}</td>
  </tr>
</table>` : ''}

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
  <tr><td align="center">
    <a href="${trackUrl}" style="background:#8B6914;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;font-family:Georgia,serif;">
      Rastrear mi pedido →
    </a>
  </td></tr>
</table>
<p style="color:#888;font-size:13px;text-align:center;">
  También puedes ingresar tu número de pedido en <a href="${trackUrl}" style="color:#8B6914;">muebleswh.com/seguimiento</a>
</p>`;

  return emailWrapper('Pedido Confirmado', contenido);
}

// ── emailEstadoPedido ─────────────────────────────────────────────
function emailEstadoPedido(pedido, estadoAnterior) {
  const folio  = pedido.numero_pedido  || '';
  const nombre = pedido.nombre_cliente || '';

  const estadoLabels = {
    pendiente:        'Pendiente de pago',
    anticipo_pagado:  'Anticipo pagado (50%)',
    pagado:           'Pago confirmado ✓',
    en_produccion:    'En producción 🔨',
    listo:            'Listo para entrega 📦',
    entregado:        'Entregado ✅',
    cancelado:        'Cancelado ❌',
  };

  const estadoActual       = pedido.estado || '';
  const label              = estadoLabels[estadoActual] || estadoActual;
  const esLiquidacionSaldo = estadoActual === 'pagado' && estadoAnterior === 'anticipo_pagado';

  const mensajes = {
    anticipo_pagado: 'Hemos confirmado tu anticipo del 50%. Comenzaremos a fabricar tus muebles. El saldo restante se liquida antes de la entrega.',
    pagado:        esLiquidacionSaldo
      ? '¡Hemos confirmado el pago de tu saldo! Tu pedido ya está completamente liquidado.'
      : 'Hemos confirmado tu pago. Pronto comenzaremos a fabricar tus muebles.',
    en_produccion: 'Tu pedido está siendo fabricado por nuestros artesanos.',
    listo:         'Tu pedido está listo. Nos pondremos en contacto para coordinar la entrega.',
    entregado:     '¡Tu pedido ha sido entregado! Esperamos que disfrutes tus nuevos muebles.',
    cancelado:     'Tu pedido ha sido cancelado. Si tienes dudas, contáctanos.',
  };

  const msg      = mensajes[estadoActual] || 'El estado de tu pedido ha sido actualizado.';
  const tracking = pedido.token_seguimiento || '';
  const trackUrl = `https://muebleswh.com/seguimiento?token=${tracking}&pedido=${folio}`;

  const contenido = `
<h2 style="color:#8B6914;margin-top:0;">Actualización de tu pedido</h2>
<p style="color:#555;">Hola <strong>${nombre}</strong>, el estado de tu pedido ha cambiado.</p>

<div style="background:#faf6f0;border-left:4px solid #8B6914;padding:20px;margin:25px 0;border-radius:4px;">
  <strong style="color:#5C3D11;">${folio}</strong><br>
  <span style="font-size:20px;font-weight:bold;color:#8B6914;">${label}</span>
</div>

<p style="color:#555;line-height:1.7;">${msg}</p>

<div style="text-align:center;margin:30px 0;">
  <a href="${trackUrl}" style="background:#8B6914;color:#fff;text-decoration:none;padding:14px 30px;border-radius:6px;font-size:15px;display:inline-block;">
    Ver detalles del pedido →
  </a>
</div>`;

  return emailWrapper('Estado de Pedido', contenido);
}

// ── emailCotizacionRecibida ───────────────────────────────────────
function emailCotizacionRecibida(cot) {
  const folio  = cot.numero_cotizacion || '';
  const nombre = cot.nombre_cliente    || '';

  const tipoMap = {
    'baño': 'Mueble de baño', 'personalizado': 'Diseño Personalizado',
    'cocina': 'Mueble de cocina', 'closet': 'Mueble closet',
    'bano': 'Mueble de baño', 'sala': 'Mueble de sala',
    'recamara': 'Mueble de recámara', 'estudio': 'Mueble de estudio',
  };
  const tipo = tipoMap[cot.modelo_mueble || ''] || cot.modelo_mueble || 'Mueble personalizado';

  const contenido = `
<h2 style="color:#8B6914;margin-top:0;">¡Solicitud de cotización recibida! ✓</h2>
<p style="color:#555;line-height:1.7;">Hola <strong>${nombre}</strong>, hemos recibido correctamente tu solicitud para <strong>${tipo}</strong>.</p>

<div style="background:#faf6f0;border-left:4px solid #8B6914;padding:20px;margin:25px 0;border-radius:4px;">
  <strong style="font-size:18px;color:#5C3D11;">${folio}</strong><br>
  <span style="color:#888;font-size:13px;">Número de cotización — guárdalo para dar seguimiento a tu solicitud</span>
</div>

<div style="background:#f0f7f0;border-left:4px solid #4a8b5a;padding:16px 20px;margin:20px 0;border-radius:4px;">
  <p style="margin:0;color:#3a5a3a;font-size:14px;line-height:1.7;">
    <strong>¿Qué sigue?</strong><br>
    Nuestro equipo analizará tu solicitud y preparará una propuesta personalizada.<br>
    Recibirás una respuesta en tu correo en <strong>2 a 3 días hábiles</strong>.
  </p>
</div>

<p style="color:#777;font-size:13px;line-height:1.7;">
  Si tienes alguna duda o deseas agregar información adicional, puedes responder a este correo o contactarnos directamente.
</p>`;

  return emailWrapper('Cotización Recibida', contenido);
}

// ── emailCotizacionRespondida ─────────────────────────────────────
function emailCotizacionRespondida(cot) {
  const folio    = cot.numero_cotizacion || '';
  const nombre   = cot.nombre_cliente    || '';
  const respuesta = cot.notas_admin      || '';

  const contenido = `
<h2 style="color:#8B6914;margin-top:0;">Tu cotización ha sido respondida 📋</h2>
<p style="color:#555;line-height:1.7;">Hola <strong>${nombre}</strong>, hemos revisado tu solicitud de cotización y te enviamos nuestra propuesta.</p>

<div style="background:#faf6f0;border-left:4px solid #8B6914;padding:20px;margin:25px 0;border-radius:4px;">
  <strong style="font-size:18px;color:#5C3D11;">${folio}</strong><br>
  <span style="color:#888;font-size:13px;">Número de cotización</span>
</div>

${respuesta ? `
<h3 style="color:#5C3D11;font-size:15px;margin:24px 0 8px;">📝 Respuesta de nuestro equipo</h3>
<div style="background:#fff8f0;border:1px solid #e5ddd4;border-radius:6px;padding:20px;line-height:1.8;color:#3a3a3a;">
  ${respuesta.replace(/\n/g, '<br>')}
</div>` : ''}

<p style="color:#555;line-height:1.7;margin-top:24px;">
  Si tienes preguntas sobre esta propuesta o deseas proceder, por favor contáctanos respondiendo este correo o llamándonos.
</p>

<div style="text-align:center;margin:30px 0;">
  <a href="tel:3317054017" style="background:#8B6914;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;font-family:Georgia,serif;">
    Contactar ahora →
  </a>
</div>`;

  return emailWrapper('Cotización Respondida', contenido);
}

// ── emailCitaConfirmada ───────────────────────────────────────────
function emailCitaConfirmada(cita) {
  const folio  = cita.numero_cita    || '';
  const nombre = cita.nombre_cliente || '';
  const fecha  = cita.fecha_cita     || '';
  const hora   = cita.rango_horario  || '';
  const tipo   = cita.tipo           || 'medición';

  const contenido = `
<h2 style="color:#8B6914;margin-top:0;">Cita confirmada 📅</h2>
<p style="color:#555;line-height:1.7;">Hola <strong>${nombre}</strong>, tu cita de <strong>${tipo}</strong> ha sido confirmada.</p>

<div style="background:#faf6f0;border-left:4px solid #8B6914;padding:20px;margin:25px 0;border-radius:4px;">
  <p style="margin:4px 0;"><strong style="color:#5C3D11;">📅 Fecha:</strong> ${fecha}</p>
  <p style="margin:4px 0;"><strong style="color:#5C3D11;">🕐 Horario:</strong> ${hora}</p>
  <p style="margin:4px 0;"><strong style="color:#5C3D11;">📋 Tipo:</strong> ${tipo}</p>
  <p style="margin:8px 0 0;font-size:13px;color:#888;">Folio: ${folio}</p>
</div>

<p style="color:#555;line-height:1.7;">Si necesitas reagendar, contáctanos con al menos 24 horas de anticipación.</p>`;

  return emailWrapper('Cita Confirmada', contenido);
}

// ── emailAdminNuevoEvento ─────────────────────────────────────────
function emailAdminNuevoEvento(tipo, datos) {
  let subject, body;

  if (tipo === 'pedido') {
    const folio   = datos.numero_pedido  || '';
    const cliente = datos.nombre_cliente || '';
    const fmt     = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    const total   = fmt(datos.total);

    const tipoEntrega       = datos.tipo_entrega || 'envio';
    const etiquetaEntrega   = tipoEntrega === 'recoger' ? '🏠 Recoger en tienda' : '🚚 Envío a domicilio';
    const costoEnvio        = Number(datos.costo_envio || 0);
    const direccion         = datos.direccion_envio || '';
    const incluyeInstalacion = datos.incluye_instalacion;
    const costoInstalacion  = Number(datos.costo_instalacion || 0);
    const subtotal          = Number(datos.subtotal  || 0);
    const descuento         = Number(datos.descuento || 0);

    const itemsRows = (datos.items || []).map(item =>
      `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5ddd4;">${item.nombre_producto || item.nombre || ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5ddd4;text-align:center;">${item.cantidad || 1}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5ddd4;text-align:right;">${fmt(item.precio_unitario || item.precio || 0)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5ddd4;text-align:right;">${fmt((item.precio_unitario || item.precio || 0) * (item.cantidad || 1))}</td>
       </tr>`
    ).join('');

    const esAnticipoAdmin = datos.tipo_pago === 'anticipo';
    const montoPagadoAdmin = Number(datos.monto_pagado || 0);
    const saldoAdmin        = Math.max(0, Number(datos.total || 0) - montoPagadoAdmin);

    subject = esAnticipoAdmin
      ? `🛒 Nuevo pedido ${folio} — Anticipo ${fmt(montoPagadoAdmin)} de ${total}`
      : `🛒 Nuevo pedido ${folio} — ${total}`;
    body = `
<h2 style="color:#8B6914;margin-top:0;">Nuevo pedido recibido</h2>
<p style="color:#555;">Se acaba de confirmar un pedido en tu tienda.</p>

<div style="background:#faf6f0;border-left:4px solid #8B6914;padding:16px 20px;margin:20px 0;border-radius:4px;">
  <p style="margin:4px 0;"><strong>Folio:</strong> ${folio}</p>
  <p style="margin:4px 0;"><strong>Cliente:</strong> ${cliente}</p>
  <p style="margin:4px 0;"><strong>Correo:</strong> ${datos.correo_cliente || ''}</p>
  <p style="margin:4px 0;"><strong>Teléfono:</strong> ${datos.telefono_cliente || 'No proporcionado'}</p>
</div>

<!-- Productos -->
<h3 style="color:#5C3D11;font-size:14px;margin:20px 0 8px;">📦 Productos del pedido</h3>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin-bottom:16px;">
  <tr style="background:#f0e8d8;">
    <th style="padding:8px 10px;text-align:left;color:#5C3D11;">Producto</th>
    <th style="padding:8px 10px;text-align:center;color:#5C3D11;">Cant.</th>
    <th style="padding:8px 10px;text-align:right;color:#5C3D11;">P. Unit.</th>
    <th style="padding:8px 10px;text-align:right;color:#5C3D11;">Subtotal</th>
  </tr>
  ${itemsRows}
</table>

<!-- Entrega -->
<h3 style="color:#5C3D11;font-size:14px;margin:20px 0 8px;">🚚 Tipo de entrega</h3>
<div style="background:#faf6f0;border-left:4px solid #8B6914;padding:12px 16px;margin-bottom:16px;border-radius:4px;font-size:13px;">
  <p style="margin:3px 0;"><strong>${etiquetaEntrega}</strong></p>
  ${direccion ? `<p style="margin:3px 0;color:#666;">📍 Dirección: ${direccion}</p>` : ''}
  <p style="margin:3px 0;">Costo de envío: <strong>${tipoEntrega === 'recoger' ? 'Sin costo' : fmt(costoEnvio)}</strong></p>
</div>

<!-- Instalación -->
<h3 style="color:#5C3D11;font-size:14px;margin:20px 0 8px;">🔧 Instalación</h3>
<div style="background:#faf6f0;border-left:4px solid ${incluyeInstalacion ? '#8B6914' : '#aaa'};padding:12px 16px;margin-bottom:16px;border-radius:4px;font-size:13px;">
  ${incluyeInstalacion
    ? `<p style="margin:3px 0;"><strong>✅ Incluye instalación profesional</strong></p><p style="margin:3px 0;">Costo: <strong>${fmt(costoInstalacion)}</strong></p>`
    : `<p style="margin:3px 0;color:#888;">❌ No incluye instalación</p>`
  }
</div>

<!-- Resumen -->
<h3 style="color:#5C3D11;font-size:14px;margin:20px 0 8px;">💰 Resumen de costos</h3>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
  <tr><td style="padding:5px 10px;color:#666;">Subtotal productos:</td><td style="padding:5px 10px;text-align:right;">${fmt(subtotal)}</td></tr>
  <tr><td style="padding:5px 10px;color:#666;">Envío (${etiquetaEntrega}):</td><td style="padding:5px 10px;text-align:right;">${tipoEntrega === 'recoger' ? 'Sin costo' : fmt(costoEnvio)}</td></tr>
  <tr><td style="padding:5px 10px;color:#666;">Instalación:</td><td style="padding:5px 10px;text-align:right;">${incluyeInstalacion ? fmt(costoInstalacion) : 'No incluida'}</td></tr>
  ${descuento > 0 ? `<tr><td style="padding:5px 10px;color:#3d8b3d;">Descuento:</td><td style="padding:5px 10px;text-align:right;color:#3d8b3d;">-${fmt(descuento)}</td></tr>` : ''}
  <tr style="background:#f0e8d8;"><td style="padding:10px;font-weight:bold;color:#5C3D11;">TOTAL:</td><td style="padding:10px;text-align:right;font-weight:bold;font-size:18px;color:#8B6914;">${total}</td></tr>
</table>

${esAnticipoAdmin ? `
<div style="background:#fdf3e0;border-left:4px solid #c9a96e;padding:12px 16px;margin-bottom:16px;border-radius:4px;font-size:13px;">
  <p style="margin:3px 0;"><strong>⚠️ Pago parcial — anticipo del 50%</strong></p>
  <p style="margin:3px 0;color:#666;">Recibido: <strong>${fmt(montoPagadoAdmin)}</strong> · Saldo pendiente: <strong style="color:#c9a96e;">${fmt(saldoAdmin)}</strong></p>
</div>` : ''}

<p style="margin:20px 0 8px;color:#555;">📅 <strong>Fecha estimada de entrega:</strong> ${datos.fecha_estimada || 'Por confirmar'}</p>
${datos.notas ? `<p style="color:#555;">📝 <strong>Notas del cliente:</strong> ${datos.notas}</p>` : ''}

<p style="margin-top:24px;"><a href="${getPanelUrl()}" style="background:#8B6914;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;display:inline-block;">Ver en el panel →</a></p>`;

  } else if (tipo === 'cotizacion') {
    const folio   = datos.numero_cotizacion || '';
    const cliente = datos.nombre_cliente    || '';
    subject = `📋 Nueva cotización ${folio} de ${cliente}`;
    body = `
<h2 style="color:#8B6914;margin-top:0;">Nueva cotización recibida</h2>
<p style="color:#555;">Un cliente ha enviado una solicitud de cotización.</p>
<div style="background:#faf6f0;border-left:4px solid #8B6914;padding:16px 20px;margin:20px 0;border-radius:4px;">
  <p style="margin:4px 0;"><strong>Folio:</strong> ${folio}</p>
  <p style="margin:4px 0;"><strong>Cliente:</strong> ${cliente}</p>
  <p style="margin:4px 0;"><strong>Email:</strong> ${datos.correo_cliente || ''}</p>
  <p style="margin:4px 0;"><strong>Teléfono:</strong> ${datos.telefono_cliente || ''}</p>
</div>
<p><a href="${getPanelUrl()}" style="background:#8B6914;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;display:inline-block;">Ver en el panel →</a></p>`;

  } else if (tipo === 'cita') {
    const folio   = datos.numero_cita    || '';
    const cliente = datos.nombre_cliente || '';
    const fecha   = datos.fecha_cita     || '';
    const hora    = datos.rango_horario  || '';
    subject = `📅 Nueva cita ${folio} — ${fecha}`;
    body = `
<h2 style="color:#8B6914;margin-top:0;">Nueva cita agendada</h2>
<p style="color:#555;">Un cliente ha agendado una cita.</p>
<div style="background:#faf6f0;border-left:4px solid #8B6914;padding:16px 20px;margin:20px 0;border-radius:4px;">
  <p style="margin:4px 0;"><strong>Folio:</strong> ${folio}</p>
  <p style="margin:4px 0;"><strong>Cliente:</strong> ${cliente}</p>
  <p style="margin:4px 0;"><strong>Fecha:</strong> ${fecha}</p>
  <p style="margin:4px 0;"><strong>Horario:</strong> ${hora}</p>
</div>
<p><a href="${getPanelUrl()}" style="background:#8B6914;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;display:inline-block;">Ver en el panel →</a></p>`;

  } else {
    return null;
  }

  return { subject, html: emailWrapper('Notificación Interna', body) };
}

// ================================================================
// TRIGGER PRINCIPAL
// ================================================================
exports.onNuevaNotificacion = onDocumentCreated(
  { document: 'notificaciones/{notifId}', secrets: SECRETS },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const emails = getEmails();
    const tipo   = data.tipo;

    // ── nuevo_pedido → emailPedidoConfirmado (cliente) + emailAdminNuevoEvento('pedido') (admin) ──
    if (tipo === 'nuevo_pedido') {
      let pedido = {};
      try { pedido = JSON.parse(data.datos_pedido || '{}'); } catch (e) {}
      if (!pedido.correo_cliente) return;

      const adminEmail = emailAdminNuevoEvento('pedido', pedido);

      await Promise.allSettled([
        sendEmail({
          from: emails.pedidos, fromName: 'Wooden House Pedidos',
          to:      pedido.correo_cliente,
          replyTo: emails.replyTo,
          subject: `Pedido confirmado – ${pedido.numero_pedido} | Wooden House`,
          html:    emailPedidoConfirmado(pedido),
          text:    `Pedido ${pedido.numero_pedido} confirmado. Total: $${pedido.total} MXN. Entrega: ${pedido.fecha_estimada || 'Por confirmar'}.`,
        }).then(() => console.log(`[CF] emailPedidoConfirmado → ${pedido.correo_cliente}`))
          .catch(e => console.error('[CF] Error emailPedidoConfirmado:', e.message)),

        sendEmail({
          from: emails.pedidos, fromName: 'Wooden House Sistema',
          to:      emails.admin,
          replyTo: pedido.correo_cliente || emails.pedidos,
          subject: adminEmail.subject,
          html:    adminEmail.html,
          text:    `Nuevo pedido ${pedido.numero_pedido} de ${pedido.nombre_cliente}.`,
        }).then(() => console.log(`[CF] emailAdminNuevoEvento(pedido) → ${emails.admin}`))
          .catch(e => console.error('[CF] Error admin pedido:', e.message)),
      ]);
      return;
    }

    // ── estado_pedido → emailEstadoPedido (cliente) ──────────────
    if (tipo === 'estado_pedido') {
      let pedido = {};
      try { pedido = JSON.parse(data.datos_pedido || '{}'); } catch (e) {}
      if (!pedido.correo_cliente || !pedido.estado) return;

      await sendEmail({
        from: emails.pedidos, fromName: 'Wooden House Pedidos',
        to:      pedido.correo_cliente,
        replyTo: emails.replyTo,
        subject: `Pedido ${pedido.numero_pedido} — ${pedido.estado} | Wooden House`,
        html:    emailEstadoPedido(pedido, pedido.estado_anterior || ''),
        text:    `El estado de tu pedido ${pedido.numero_pedido} cambió a: ${pedido.estado}.`,
      }).then(() => console.log(`[CF] emailEstadoPedido → ${pedido.correo_cliente}`))
        .catch(e => console.error('[CF] Error emailEstadoPedido:', e.message));
      return;
    }

    // ── nueva_cotizacion → emailCotizacionRecibida (cliente) + emailAdminNuevoEvento('cotizacion') (admin) ──
    if (tipo === 'nueva_cotizacion') {
      let cot = {};
      try { cot = JSON.parse(data.datos_cotizacion || '{}'); } catch (e) {}
      if (!cot.correo_cliente) return;

      const adminEmail = emailAdminNuevoEvento('cotizacion', cot);

      await Promise.allSettled([
        sendEmail({
          from: emails.cotizaciones, fromName: 'Wooden House Cotizaciones',
          to:      cot.correo_cliente,
          replyTo: emails.replyTo,
          subject: `Cotización ${cot.numero_cotizacion} recibida | Wooden House`,
          html:    emailCotizacionRecibida(cot),
          text:    `Cotización ${cot.numero_cotizacion} recibida. Te contactaremos en 2-3 días hábiles.`,
        }).then(() => console.log(`[CF] emailCotizacionRecibida → ${cot.correo_cliente}`))
          .catch(e => console.error('[CF] Error emailCotizacionRecibida:', e.message)),

        sendEmail({
          from: emails.cotizaciones, fromName: 'Wooden House Sistema',
          to:      emails.admin,
          replyTo: cot.correo_cliente || emails.cotizaciones,
          subject: adminEmail.subject,
          html:    adminEmail.html,
          text:    `Nueva cotización ${cot.numero_cotizacion} de ${cot.nombre_cliente}.`,
        }).then(() => console.log(`[CF] emailAdminNuevoEvento(cotizacion) → ${emails.admin}`))
          .catch(e => console.error('[CF] Error admin cotizacion:', e.message)),
      ]);
      return;
    }

    // ── cotizacion_respondida → emailCotizacionRespondida (cliente) ─────────────
    if (tipo === 'cotizacion_respondida') {
      let cot = {};
      try { cot = JSON.parse(data.datos_cotizacion || '{}'); } catch (e) {}
      if (!cot.correo_cliente) return;

      await sendEmail({
        from: emails.cotizaciones, fromName: 'Wooden House Cotizaciones',
        to:      cot.correo_cliente,
        replyTo: emails.replyTo,
        subject: `Tu cotización ${cot.numero_cotizacion} ha sido respondida | Wooden House`,
        html:    emailCotizacionRespondida(cot),
        text:    `Tu cotización ${cot.numero_cotizacion} ha sido respondida. Revisa tu correo para ver la propuesta.`,
      }).then(() => console.log(`[CF] emailCotizacionRespondida → ${cot.correo_cliente}`))
        .catch(e => console.error('[CF] Error emailCotizacionRespondida:', e.message));
      return;
    }

    // ── nueva_cita → emailCitaConfirmada (cliente) + emailAdminNuevoEvento('cita') (admin) ──
    if (tipo === 'nueva_cita') {
      let cita = {};
      try { cita = JSON.parse(data.datos_cita || '{}'); } catch (e) {}
      if (!cita.correo_cliente) return;

      const adminEmail = emailAdminNuevoEvento('cita', cita);

      await Promise.allSettled([
        sendEmail({
          from: emails.citas, fromName: 'Wooden House Citas',
          to:      cita.correo_cliente,
          replyTo: emails.replyTo,
          subject: `Cita confirmada – ${cita.numero_cita} | Wooden House`,
          html:    emailCitaConfirmada(cita),
          text:    `Cita ${cita.numero_cita} confirmada para el ${cita.fecha_cita}.`,
        }).then(() => console.log(`[CF] emailCitaConfirmada → ${cita.correo_cliente}`))
          .catch(e => console.error('[CF] Error emailCitaConfirmada:', e.message)),

        sendEmail({
          from: emails.citas, fromName: 'Wooden House Sistema',
          to:      emails.admin,
          replyTo: cita.correo_cliente || emails.citas,
          subject: adminEmail.subject,
          html:    adminEmail.html,
          text:    `Nueva cita ${cita.numero_cita} de ${cita.nombre_cliente} para ${cita.fecha_cita}.`,
        }).then(() => console.log(`[CF] emailAdminNuevoEvento(cita) → ${emails.admin}`))
          .catch(e => console.error('[CF] Error admin cita:', e.message)),
      ]);
      return;
    }

    console.log(`[CF] Tipo no manejado: ${tipo}`);
  }
);

// ================================================================
// SCHEDULED: Limpiar notificaciones leídas de más de 30 días
// ================================================================
exports.limpiarNotificacionesAntiguas = onSchedule('every 24 hours', async () => {
  const hace30dias = new Date();
  hace30dias.setDate(hace30dias.getDate() - 30);

  try {
    const snapshot = await db.collection('notificaciones')
      .where('leida', '==', true)
      .where('fecha', '<', hace30dias.toISOString())
      .limit(200)
      .get();

    if (snapshot.empty) {
      console.log('[Scheduled] No hay notificaciones antiguas.');
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`[Scheduled] Eliminadas ${snapshot.size} notificaciones antiguas.`);
  } catch (err) {
    console.error('[Scheduled] Error:', err.message);
  }
});