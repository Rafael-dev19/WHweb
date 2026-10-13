// archivos-diseno.js — Entregables del diseñador en el detalle del pedido,
// igual en los 4 paneles (jefe/administrador, ventas, taller/instalación,
// diseñador):
//   · Proyecto SketchUp (.skp)            → obligatorio
//   · Carpeta(s) de cortes para el CNC    → obligatorio (.nc; también .dxf/.tap)
//   · Render en imagen                    → opcional, para ver cómo queda
// Las descargas pasan por la API (api/pedidos.php?action=descargar_diseno),
// que entrega cada archivo con su NOMBRE ORIGINAL ("HOJA 1 BLANCA.nc") y arma
// el .zip de una carpeta completa para el taller.
(function () {
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Nombre del archivo tal como lo subió el diseñador (va al final de la ruta
  // de Firebase Storage). Archivos viejos sin nombre original muestran su ruta.
  function nombreArchivo(url) {
    try {
      const ruta = decodeURIComponent(String(url).split('/o/')[1].split('?')[0]);
      return ruta.split('/').pop();
    } catch (e) {
      return 'archivo';
    }
  }
  window.nombreArchivoDiseno = nombreArchivo;

  const urlDescarga = (pedidoId, params) =>
    `/api/pedidos.php?action=descargar_diseno&id=${encodeURIComponent(pedidoId)}&${params}`;

  const chip = (href, icono, texto, extra = '') =>
    `<a href="${esc(href)}" ${extra} style="display:inline-flex;align-items:center;gap:6px;background:var(--surface,var(--panel));border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:12px;color:var(--accent);text-decoration:none;max-width:100%;word-break:break-all;"><i data-lucide="${icono}"></i> ${esc(texto)}</a>`;

  window.htmlArchivosDiseno = function (lista, pedidoId) {
    const diseno  = lista || [];
    const renders = diseno.filter(i => i.tipo === 'sketchup');
    const skp     = diseno.filter(i => i.tipo === 'skp');
    const cortes  = diseno.filter(i => i.tipo === 'vcarve');
    const otros   = diseno.filter(i => !['sketchup', 'skp', 'vcarve'].includes(i.tipo));
    const titulo  = t => `<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">${t}</div>`;
    let html = '';

    if (skp.length) {
      html += `<div style="margin-bottom:12px;">${titulo('Proyecto SketchUp (.skp)')}
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${skp.map(f => chip(urlDescarga(pedidoId, 'archivo=' + f.id), 'download', nombreArchivo(f.url_imagen))).join('')}
        </div></div>`;
    }

    if (cortes.length) {
      const grupos = {};
      cortes.forEach(c => { const g = c.grupo || 'Cortes'; (grupos[g] = grupos[g] || []).push(c); });
      const nGrupos = Object.keys(grupos).length;
      html += `<div style="margin-bottom:12px;">${titulo('Cortes para el CNC')}
        ${nGrupos > 1 ? `<div style="margin-bottom:8px;">${chip(urlDescarga(pedidoId, 'todos=1'), 'folder-down', `Descargar todas las carpetas (.zip)`)}</div>` : ''}
        ${Object.entries(grupos).map(([g, files]) => `
          <details class="wh-subcollapse" open style="margin-bottom:8px;">
            <summary><i data-lucide="folder"></i> ${esc(g)} <span class="wh-collapse-count">(${files.length} archivo${files.length === 1 ? '' : 's'})</span></summary>
            <div class="wh-collapse-body" style="display:flex;flex-direction:column;gap:6px;">
              <div>${chip(urlDescarga(pedidoId, 'grupo=' + encodeURIComponent(g)), 'folder-down', `Descargar carpeta completa (.zip)`)}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${files.map(f => chip(urlDescarga(pedidoId, 'archivo=' + f.id), 'file-code', nombreArchivo(f.url_imagen))).join('')}
              </div>
            </div>
          </details>`).join('')}
      </div>`;
    }

    if (renders.length) {
      html += `<div style="margin-bottom:12px;">${titulo('Render')}
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${renders.map(img => `<a href="${esc(img.url_imagen)}" target="_blank" rel="noopener"><img src="${esc(img.url_imagen)}" alt="Render" style="width:84px;height:84px;object-fit:cover;border-radius:6px;border:1px solid var(--border);"></a>`).join('')}
        </div></div>`;
    }

    if (otros.length) {
      html += `<div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${otros.map(img => `<a href="${esc(img.url_imagen)}" target="_blank" rel="noopener"><img src="${esc(img.url_imagen)}" alt="Referencia" style="width:84px;height:84px;object-fit:cover;border-radius:6px;border:1px solid var(--border);"></a>`).join('')}
      </div>`;
    }
    return html;
  };
})();
