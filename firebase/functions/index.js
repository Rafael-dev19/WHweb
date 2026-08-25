// firebase/functions/index.js — Email triggers via Brevo para pedidos, cotizaciones y citas

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule }        = require('firebase-functions/v2/scheduler');
const { initializeApp }     = require('firebase-admin/app');
const { getFirestore }      = require('firebase-admin/firestore');
const { getMessaging }      = require('firebase-admin/messaging');
const https                 = require('https');

initializeApp();
const db = getFirestore();

// ── Web Push (FCM) — notificaciones al personal interno ────────────
// El contenido siempre es genérico (título/mensaje cortos): el detalle real
// se ve entrando al panel, nunca viaja en el push. Ver includes/notifications.php
// (PHP) para quién dispara cada evento y a qué roles.
// Avisa al sitio (PHP) qué tokens ya no son válidos para que los desactive —
// sin esto, un token muerto (dispositivo desinstalado, permiso revocado)
// se sigue intentando para siempre y nunca se sabe que ese usuario dejó de
// recibir push de verdad.
function limpiarTokensMuertos(tokens) {
  return new Promise((resolve) => {
    const secreto = process.env.PUSH_CLEANUP_SECRET;
    const appUrl  = process.env.APP_URL;
    if (!secreto || !appUrl || !tokens.length) { resolve(); return; }

    let hostname, pathBase;
    try {
      const u = new URL(appUrl);
      hostname = u.hostname;
      pathBase = u.pathname.replace(/\/$/, '');
    } catch (e) { resolve(); return; }

    const body = JSON.stringify({ tokens });
    const req = https.request({
      hostname,
      path: `${pathBase}/api/push_tokens.php?action=limpiar`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Push-Secret': secreto,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve());
    });
    req.on('error', (e) => { console.warn('[CF] limpiarTokensMuertos error:', e.message); resolve(); });
    req.write(body);
    req.end();
  });
}

async function enviarPush(tokens, titulo, cuerpo, clickUrl) {
  if (!Array.isArray(tokens) || tokens.length === 0) return;
  try {
    const resp = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: titulo, body: cuerpo },
      webpush: {
        fcmOptions: { link: clickUrl || '/' },
        notification: { icon: '/favicon.ico' },
      },
    });
    console.log(`[CF] push enviado: ${resp.successCount}/${tokens.length} ok`);

    // Tokens con error permanente (no transitorio) → avisar al sitio que los
    // desactive. Códigos de error de FCM: docs.expo.dev / firebase-admin.
    const CODIGOS_MUERTOS = new Set([
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
      'messaging/invalid-argument',
    ]);
    const tokensMuertos = [];
    resp.responses.forEach((r, i) => {
      if (!r.success && r.error && CODIGOS_MUERTOS.has(r.error.code)) {
        tokensMuertos.push(tokens[i]);
      }
    });
    if (tokensMuertos.length) {
      await limpiarTokensMuertos(tokensMuertos);
      console.log(`[CF] ${tokensMuertos.length} token(s) muerto(s) desactivado(s)`);
    }
  } catch (e) {
    console.error('[CF] Error enviando push:', e.message);
  }
}

const SECRETS = [
  'BREVO_API_KEY',
  'EMAIL_GENERAL', 'REPLY_TO', 'ADMIN_EMAIL',
  'APP_URL', 'PUSH_CLEANUP_SECRET',
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

// Descarga un archivo por HTTPS y lo devuelve en base64 (para adjuntar en Brevo).
function descargarBase64(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`descargarBase64: HTTP ${res.statusCode} para ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── Brevo HTTP API ────────────────────────────────────────────────
// attachment (opcional): [{ content: base64String, name: 'archivo.pdf' }]
function sendEmail({ from, fromName, to, subject, html, text, replyTo, bcc, attachment }) {
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

    // Adjunto (ej. PDF de propuesta de cotización, ya en base64)
    if (attachment && Array.isArray(attachment) && attachment.length) {
      payload.attachment = attachment;
    }

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
  const folio    = cot.numero_cotizacion    || '';
  const nombre   = cot.nombre_cliente       || '';
  const precio   = Number(cot.precio_cotizado || 0);
  const precioFmt = `$${precio.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`;
  const desc     = cot.descripcion_respuesta || cot.notas_admin || '';
  const fechaEnt = cot.fecha_entrega_estimada || '';
  const fechaVisita = cot.fecha_visita || '';
  const horaVisita  = cot.hora_visita  || '';
  const token    = cot.token_seguimiento || '';
  const trackUrl = token ? `https://muebleswh.com/seguimiento?token=${token}&cotizacion=${folio}` : '';

  const contenido = `
<h2 style="color:#8B6914;margin-top:0;">Tu propuesta de cotización está lista 📋</h2>
<p style="color:#555;line-height:1.7;">Hola <strong>${nombre}</strong>, hemos revisado tu solicitud y preparamos esta propuesta personalizada para ti.</p>

<div style="background:#faf6f0;border-left:4px solid #8B6914;padding:20px;margin:25px 0;border-radius:4px;">
  <strong style="font-size:18px;color:#5C3D11;display:block;margin-bottom:4px;">${folio}</strong>
  <span style="color:#888;font-size:13px;">Número de cotización</span>
</div>

<!-- Precio destacado -->
<div style="background:#fff8f0;border:2px solid #c9a96e;border-radius:10px;padding:20px;margin:20px 0;text-align:center;">
  <div style="color:#7a5a1a;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Precio total de tu proyecto</div>
  <div style="font-size:32px;font-weight:700;color:#5C3D11;">${precioFmt}</div>
  ${fechaEnt ? `<div style="color:#888;font-size:13px;margin-top:6px;">📅 Entrega estimada: <strong>${fechaEnt}</strong></div>` : ''}
</div>

${fechaVisita ? `
<div style="background:#eef5fb;border-left:4px solid #4a7c8b;padding:16px 20px;margin:20px 0;border-radius:4px;">
  <p style="margin:0;color:#2a4a55;font-size:14px;line-height:1.7;">
    <strong>📍 Visita para confirmar medidas y detalles</strong><br>
    ${fechaVisita}${horaVisita ? ` — ${horaVisita}` : ''}
  </p>
</div>` : ''}

${desc ? `
<h3 style="color:#5C3D11;font-size:15px;margin:24px 0 8px;">📐 Descripción de tu proyecto</h3>
<div style="background:#fff;border:1px solid #e5ddd4;border-radius:6px;padding:20px;line-height:1.8;color:#3a3a3a;">
  ${desc.replace(/\n/g, '<br>')}
</div>` : ''}

<p style="color:#888;font-size:13px;margin:16px 0;">📎 Adjuntamos el PDF con el detalle completo de tu propuesta.</p>

<div style="background:#f0f7f0;border-left:4px solid #4a8b5a;padding:16px 20px;margin:24px 0;border-radius:4px;">
  <p style="margin:0;color:#2a5a2a;font-size:14px;line-height:1.7;">
    <strong>¿Te convence esta propuesta?</strong><br>
    Confírmala desde tu página de seguimiento para continuar con tu proyecto.
  </p>
</div>

<div style="text-align:center;margin:30px 0;">
  ${trackUrl ? `<a href="${trackUrl}" style="background:#4a8b5a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;font-family:Georgia,serif;margin-right:12px;margin-bottom:10px;">
    ✅ Confirmar cotización
  </a>` : ''}
  <a href="tel:3317054017" style="background:#8B6914;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;font-family:Georgia,serif;margin-right:12px;margin-bottom:10px;">
    📞 Llamar ahora
  </a>
  <a href="https://wa.me/523317054017?text=Hola%2C%20acepto%20la%20cotizaci%C3%B3n%20${folio}" style="background:#25D366;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;font-family:Georgia,serif;margin-bottom:10px;">
    💬 WhatsApp
  </a>
</div>`;

  return emailWrapper('Cotización Lista', contenido);
}

// ── emailCotizacionEnProduccion ───────────────────────────────────
function emailCotizacionEnProduccion(cot) {
  const folio    = cot.numero_cotizacion    || '';
  const nombre   = cot.nombre_cliente       || '';
  const desc     = cot.descripcion_respuesta || '';
  const fechaEnt = cot.fecha_entrega_estimada || '';
  const token    = cot.token_seguimiento    || '';
  const trackUrl = token ? `https://muebleswh.com/seguimiento?token=${token}&cotizacion=${folio}` : '';

  const contenido = `
<h2 style="color:#8B6914;margin-top:0;">¡Tu mueble está en fabricación! 🔨</h2>
<p style="color:#555;line-height:1.7;">Hola <strong>${nombre}</strong>, ¡excelente noticia! Tu proyecto personalizado ha comenzado el proceso de fabricación en nuestro taller.</p>

<div style="background:#faf6f0;border-left:4px solid #8B6914;padding:20px;margin:25px 0;border-radius:4px;">
  <strong style="font-size:18px;color:#5C3D11;display:block;margin-bottom:4px;">${folio}</strong>
  <span style="color:#888;font-size:13px;">Número de cotización — guárdalo para dar seguimiento</span>
  ${fechaEnt ? `<p style="margin:8px 0 0;color:#5C3D11;font-size:14px;">📅 Fecha estimada de entrega: <strong>${fechaEnt}</strong></p>` : ''}
</div>

${desc ? `
<div style="background:#fff8f0;border:1px solid #e5ddd4;border-radius:6px;padding:16px 20px;margin:16px 0;">
  <div style="color:#7a5a1a;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Tu proyecto</div>
  <div style="color:#3a3a3a;line-height:1.7;font-size:14px;">${desc.replace(/\n/g, '<br>')}</div>
</div>` : ''}

${trackUrl ? `
<div style="text-align:center;margin:28px 0;">
  <a href="${trackUrl}" style="background:#8B6914;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;">
    Seguir mi pedido →
  </a>
</div>` : ''}

<p style="color:#777;font-size:13px;text-align:center;">Te avisaremos por correo cuando tu mueble esté listo para entrega.</p>`;

  return emailWrapper('En Fabricación', contenido);
}

// ── emailCotizacionLista ──────────────────────────────────────────
function emailCotizacionLista(cot) {
  const folio  = cot.numero_cotizacion || '';
  const nombre = cot.nombre_cliente    || '';
  const token  = cot.token_seguimiento || '';
  const trackUrl = token ? `https://muebleswh.com/seguimiento?token=${token}&cotizacion=${folio}` : '';

  const contenido = `
<h2 style="color:#8B6914;margin-top:0;">¡Tu mueble está listo! ✅</h2>
<p style="color:#555;line-height:1.7;">Hola <strong>${nombre}</strong>, tu mueble personalizado ha sido fabricado y está listo para entrega. Nos pondremos en contacto para coordinar los detalles.</p>

<div style="background:#faf6f0;border-left:4px solid #4a8b5a;padding:20px;margin:25px 0;border-radius:4px;">
  <strong style="font-size:18px;color:#5C3D11;display:block;margin-bottom:4px;">${folio}</strong>
  <span style="color:#888;font-size:13px;">Número de cotización</span>
</div>

<div style="background:#f0f7f0;border-left:4px solid #4a8b5a;padding:16px 20px;margin:20px 0;border-radius:4px;">
  <p style="margin:0;color:#2a5a2a;font-size:14px;line-height:1.7;">
    📞 Nos comunicaremos contigo en las próximas horas para agendar la entrega o instalación.
  </p>
</div>

${trackUrl ? `<div style="text-align:center;margin:24px 0;"><a href="${trackUrl}" style="background:#8B6914;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:bold;display:inline-block;">Ver estado →</a></div>` : ''}`;

  return emailWrapper('Mueble Listo', contenido);
}

// ── emailCotizacionEntregada ──────────────────────────────────────
function emailCotizacionEntregada(cot) {
  const folio  = cot.numero_cotizacion || '';
  const nombre = cot.nombre_cliente    || '';

  const contenido = `
<h2 style="color:#8B6914;margin-top:0;">¡Entrega completada! 🎉</h2>
<p style="color:#555;line-height:1.7;">Hola <strong>${nombre}</strong>, tu mueble personalizado ha sido entregado. Esperamos que lo disfrutes mucho.</p>

<div style="background:#faf6f0;border-left:4px solid #8B6914;padding:20px;margin:25px 0;border-radius:4px;">
  <strong style="font-size:18px;color:#5C3D11;display:block;margin-bottom:4px;">${folio}</strong>
</div>

<p style="color:#555;line-height:1.7;">
  Si tienes alguna duda o necesitas ajustes, no dudes en contactarnos. Tu satisfacción es nuestra prioridad.
</p>
<div style="text-align:center;margin:28px 0;">
  <a href="tel:3317054017" style="background:#8B6914;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:bold;display:inline-block;">
    Contactar soporte →
  </a>
</div>`;

  return emailWrapper('Entrega Completada', contenido);
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

    // ── Push al personal interno (jefe/administrador/empleado/disenador) ──
    // Independiente del tipo: cualquier notificación puede traer push_tokens_json
    // (ver includes/notifications.php → crearNotificacionPush). El personal solo
    // recibe push de estos eventos — EXCEPTO el jefe, que además recibe un email
    // corto (sin datos sensibles, solo un aviso) por cada correo en correos_jefe_json
    // (puede haber más de una cuenta jefe activa, ej. una de prueba para el panel).
    // El cliente sigue recibiendo su email normal más abajo.
    if (data.push_tokens_json) {
      try {
        const tokens = JSON.parse(data.push_tokens_json);
        if (Array.isArray(tokens) && tokens.length) {
          await enviarPush(tokens, data.push_titulo || 'Wooden House', data.push_mensaje || '', data.push_url || '/');
        }
      } catch (e) {
        console.error('[CF] Error procesando push_tokens_json:', e.message);
      }
    }

    if (data.correos_jefe_json) {
      try {
        const correosJefe = JSON.parse(data.correos_jefe_json);
        const clickUrl = data.push_url ? `${process.env.APP_URL || ''}${data.push_url}` : (process.env.APP_URL || '');
        if (Array.isArray(correosJefe)) {
          correosJefe.forEach(correoJefe => {
            sendEmail({
              from: emails.admin, fromName: 'WOODEN HOUSE',
              to:      correoJefe,
              replyTo: emails.replyTo,
              subject: `${data.push_titulo || 'Aviso'} — Wooden House`,
              html:    emailWrapper(data.push_titulo || 'Wooden House', `
                <p style="margin-top:0;">${data.push_mensaje || 'Ingresa al sitio para ver los detalles.'}</p>
                <div style="text-align:center;margin:26px 0;">
                  <a href="${clickUrl}" style="background:#8B6914;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:bold;display:inline-block;font-family:Georgia,serif;">Ir al panel</a>
                </div>`),
              text:    `${data.push_mensaje || 'Ingresa al sitio para ver los detalles.'} ${clickUrl}`,
            }).then(() => console.log(`[CF] emailJefe (${tipo}) → ${correoJefe}`))
              .catch(e => console.error('[CF] Error emailJefe:', e.message));
          });
        }
      } catch (e) {
        console.error('[CF] Error procesando correos_jefe_json:', e.message);
      }
    }

    // ── nuevo_pedido → emailPedidoConfirmado (cliente) ──────────────
    if (tipo === 'nuevo_pedido') {
      let pedido = {};
      try { pedido = JSON.parse(data.datos_pedido || '{}'); } catch (e) {}
      if (!pedido.correo_cliente) return;

      await sendEmail({
        from: emails.pedidos, fromName: 'WOODEN HOUSE PEDIDOS',
        to:      pedido.correo_cliente,
        replyTo: emails.replyTo,
        subject: `Pedido confirmado – ${pedido.numero_pedido} | Wooden House`,
        html:    emailPedidoConfirmado(pedido),
        text:    `Pedido ${pedido.numero_pedido} confirmado. Total: $${pedido.total} MXN. Entrega: ${pedido.fecha_estimada || 'Por confirmar'}.`,
      }).then(() => console.log(`[CF] emailPedidoConfirmado → ${pedido.correo_cliente}`))
        .catch(e => console.error('[CF] Error emailPedidoConfirmado:', e.message));
      return;
    }

    // ── estado_pedido → emailEstadoPedido (cliente) ──────────────
    if (tipo === 'estado_pedido') {
      let pedido = {};
      try { pedido = JSON.parse(data.datos_pedido || '{}'); } catch (e) {}
      if (!pedido.correo_cliente || !pedido.estado) return;

      await sendEmail({
        from: emails.pedidos, fromName: 'WOODEN HOUSE PEDIDOS',
        to:      pedido.correo_cliente,
        replyTo: emails.replyTo,
        subject: `Pedido ${pedido.numero_pedido} — ${pedido.estado} | Wooden House`,
        html:    emailEstadoPedido(pedido, pedido.estado_anterior || ''),
        text:    `El estado de tu pedido ${pedido.numero_pedido} cambió a: ${pedido.estado}.`,
      }).then(() => console.log(`[CF] emailEstadoPedido → ${pedido.correo_cliente}`))
        .catch(e => console.error('[CF] Error emailEstadoPedido:', e.message));
      return;
    }

    // ── nueva_cotizacion → emailCotizacionRecibida (cliente) ────────
    if (tipo === 'nueva_cotizacion') {
      let cot = {};
      try { cot = JSON.parse(data.datos_cotizacion || '{}'); } catch (e) {}
      if (!cot.correo_cliente) return;

      await sendEmail({
        from: emails.cotizaciones, fromName: 'WOODEN HOUSE COTIZACIONES',
        to:      cot.correo_cliente,
        replyTo: emails.replyTo,
        subject: `Cotización ${cot.numero_cotizacion} recibida | Wooden House`,
        html:    emailCotizacionRecibida(cot),
        text:    `Cotización ${cot.numero_cotizacion} recibida. Te contactaremos en 2-3 días hábiles.`,
      }).then(() => console.log(`[CF] emailCotizacionRecibida → ${cot.correo_cliente}`))
        .catch(e => console.error('[CF] Error emailCotizacionRecibida:', e.message));
      return;
    }

    // ── cotizacion_respondida → emailCotizacionRespondida (cliente con precio) ──
    if (tipo === 'cotizacion_respondida') {
      let cot = {};
      try { cot = JSON.parse(data.datos_cotizacion || '{}'); } catch (e) {}
      if (!cot.correo_cliente) return;

      let attachment;
      if (cot.pdf_url) {
        try {
          const base64Pdf = await descargarBase64(cot.pdf_url);
          attachment = [{ content: base64Pdf, name: `Cotizacion-${cot.numero_cotizacion}.pdf` }];
        } catch (e) {
          console.error('[CF] No se pudo adjuntar el PDF de la cotización:', e.message);
        }
      }

      await sendEmail({
        from: emails.cotizaciones, fromName: 'WOODEN HOUSE COTIZACIONES',
        to:      cot.correo_cliente,
        replyTo: emails.replyTo,
        subject: `Tu propuesta está lista — ${cot.numero_cotizacion} | Wooden House`,
        html:    emailCotizacionRespondida(cot),
        text:    `Tu cotización ${cot.numero_cotizacion} ha sido respondida. Precio: $${Number(cot.precio_cotizado||0).toFixed(2)} MXN.`,
        attachment,
      }).then(() => console.log(`[CF] emailCotizacionRespondida → ${cot.correo_cliente}`))
        .catch(e => console.error('[CF] Error emailCotizacionRespondida:', e.message));
      return;
    }

    // ── cotizacion_en_produccion → cliente (personal recibe solo push, nunca email) ──
    if (tipo === 'cotizacion_en_produccion') {
      let cot = {};
      try { cot = JSON.parse(data.datos_cotizacion || '{}'); } catch (e) {}
      if (!cot.correo_cliente) return;

      await sendEmail({
        from: emails.cotizaciones, fromName: 'WOODEN HOUSE',
        to:      cot.correo_cliente,
        replyTo: emails.replyTo,
        subject: `Tu mueble está en fabricación — ${cot.numero_cotizacion} | Wooden House`,
        html:    emailCotizacionEnProduccion(cot),
        text:    `Tu mueble personalizado (${cot.numero_cotizacion}) ha comenzado la fabricación. Entrega estimada: ${cot.fecha_entrega_estimada || 'por confirmar'}.`,
      }).then(() => console.log(`[CF] emailCotEnProduccion → ${cot.correo_cliente}`))
        .catch(e => console.error('[CF] Error cot en produccion cliente:', e.message));
      return;
    }

    // ── cotizacion_lista → email al cliente ───────────────────────
    if (tipo === 'cotizacion_lista') {
      let cot = {};
      try { cot = JSON.parse(data.datos_cotizacion || '{}'); } catch (e) {}
      if (!cot.correo_cliente) return;

      await sendEmail({
        from: emails.cotizaciones, fromName: 'WOODEN HOUSE',
        to:      cot.correo_cliente,
        replyTo: emails.replyTo,
        subject: `¡Tu mueble está listo! — ${cot.numero_cotizacion} | Wooden House`,
        html:    emailCotizacionLista(cot),
        text:    `Tu mueble personalizado (${cot.numero_cotizacion}) está listo. Pronto te contactaremos para coordinar la entrega.`,
      }).then(() => console.log(`[CF] emailCotLista → ${cot.correo_cliente}`))
        .catch(e => console.error('[CF] Error cot lista:', e.message));
      return;
    }

    // ── cotizacion_entregada → email al cliente ───────────────────
    if (tipo === 'cotizacion_entregada') {
      let cot = {};
      try { cot = JSON.parse(data.datos_cotizacion || '{}'); } catch (e) {}
      if (!cot.correo_cliente) return;

      await sendEmail({
        from: emails.cotizaciones, fromName: 'WOODEN HOUSE',
        to:      cot.correo_cliente,
        replyTo: emails.replyTo,
        subject: `¡Entrega completada! — ${cot.numero_cotizacion} | Wooden House`,
        html:    emailCotizacionEntregada(cot),
        text:    `Tu mueble personalizado (${cot.numero_cotizacion}) ha sido entregado. ¡Gracias por confiar en Wooden House!`,
      }).then(() => console.log(`[CF] emailCotEntregada → ${cot.correo_cliente}`))
        .catch(e => console.error('[CF] Error cot entregada:', e.message));
      return;
    }

    // ── nueva_cita → emailCitaConfirmada (cliente) ──────────────────
    if (tipo === 'nueva_cita') {
      let cita = {};
      try { cita = JSON.parse(data.datos_cita || '{}'); } catch (e) {}
      if (!cita.correo_cliente) return;

      await sendEmail({
        from: emails.citas, fromName: 'WOODEN HOUSE CITAS',
        to:      cita.correo_cliente,
        replyTo: emails.replyTo,
        subject: `Cita confirmada – ${cita.numero_cita} | Wooden House`,
        html:    emailCitaConfirmada(cita),
        text:    `Cita ${cita.numero_cita} confirmada para el ${cita.fecha_cita}.`,
      }).then(() => console.log(`[CF] emailCitaConfirmada → ${cita.correo_cliente}`))
        .catch(e => console.error('[CF] Error emailCitaConfirmada:', e.message));
      return;
    }

    // ── invitacion_personal → email al empleado invitado ──────────
    if (tipo === 'invitacion_personal') {
      const correoEmp  = data.correo_empleado  || '';
      const nombreEmp  = data.nombre_empleado  || 'Equipo';
      const rolEmp     = data.rol              || 'empleado';
      const urlActivar = data.url_activacion   || '';
      if (!correoEmp || !urlActivar) return;

      const ROL_LABELS = { jefe: 'Jefe', administrador: 'Administrador', empleado: 'Empleado', disenador: 'Diseñador' };
      const rolLabel = ROL_LABELS[rolEmp] || 'Empleado';
      await sendEmail({
        from: emails.admin, fromName: 'WOODEN HOUSE',
        to:      correoEmp,
        replyTo: emails.replyTo,
        subject: 'Invitación al panel de gestión — Wooden House',
        html: `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#faf6f0;border-radius:12px;overflow:hidden;border:1px solid #e5ddd4;">
  <div style="background:#5C3D11;padding:28px 32px;text-align:center;">
    <h1 style="color:#e8dcc8;margin:0;font-size:22px;font-weight:700;letter-spacing:1px;">WOODEN HOUSE</h1>
  </div>
  <div style="padding:32px;">
    <h2 style="color:#5C3D11;margin-top:0;">Hola, ${nombreEmp}</h2>
    <p style="color:#555;line-height:1.7;">
      Has sido invitado/a al panel de gestión de <strong>Wooden House</strong> como <strong>${rolLabel}</strong>.
    </p>
    <p style="color:#555;line-height:1.7;">
      Haz clic en el botón de abajo para crear tu contraseña y activar tu cuenta. El enlace es válido por <strong>48 horas</strong>.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${urlActivar}"
         style="background:#8B6914;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
        Activar mi cuenta
      </a>
    </div>
    <p style="color:#888;font-size:12px;line-height:1.6;">
      Si no esperabas este correo, ignóralo. Nadie más puede usar este enlace.
    </p>
    <hr style="border:none;border-top:1px solid #e5ddd4;margin:20px 0;">
    <p style="color:#aaa;font-size:11px;text-align:center;margin:0;">© Wooden House · Muebles a medida</p>
  </div>
</div>`,
        text: `Hola ${nombreEmp},\n\nFuiste invitado al panel de Wooden House como ${rolLabel}.\n\nActiva tu cuenta aquí: ${urlActivar}\n\nEl enlace expira en 48 horas.`,
      }).then(() => console.log(`[CF] emailInvitacion → ${correoEmp}`))
        .catch(e => console.error('[CF] Error invitacion:', e.message));
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