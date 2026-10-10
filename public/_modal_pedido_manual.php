<!-- _modal_pedido_manual.php — Modal "Crear pedido" compartido por
     panel_administrador.php (jefe), panel_ventas.php y panel_disenador.php.
     Incluir solo detrás de un guardia de rol — nunca para administrador/empleado. -->
<style>
  /* Estilos propios del modal: se incluye en tres paneles con hojas distintas
     (admin/ventas/diseñador), pero todas comparten los mismos tokens. */
  .pm-tel-row{ display:flex; gap:8px; align-items:center; }
  .pm-tel-row .form-input{ flex:1; min-width:0; }
  .pm-tel-list{ display:flex; flex-direction:column; gap:6px; }
  .pm-tel-list:not(:empty){ margin-top:6px; }
  .pm-icon-btn{ flex-shrink:0; width:40px; height:40px; padding:0; justify-content:center; }
  .pm-icon-btn--danger{ color:var(--danger,#e57373); }
  .pm-fecha-row{ display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  .pm-fecha-row .form-input{ flex:1; min-width:170px; }
  .pm-check{ display:inline-flex; align-items:center; gap:8px; font-size:13px; color:var(--text); cursor:pointer; min-height:40px; }
  .pm-check input{ width:18px; height:18px; accent-color:var(--accent); }
  .pm-items{ display:flex; flex-direction:column; gap:10px; }
  .pm-item{ border:1px solid var(--border); border-radius:10px; padding:10px; background:var(--bg); display:flex; flex-direction:column; gap:8px; }
  .pm-item-top{ display:flex; justify-content:space-between; align-items:center; gap:8px; }
  .pm-item-top .pm-icon-btn{ width:32px; height:32px; }
  .pm-item-num{ font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.6px; color:var(--accent); }
  .pm-item-grid{ display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; }
  .pm-item-grid label, .pm-medidas{ display:flex; flex-direction:column; gap:4px; font-size:11px; color:var(--muted); }
  .pm-item-grid .form-input, .pm-item-grid .form-select{ width:100%; }
  .pm-modelo{ display:flex; align-items:center; gap:8px; font-size:14px; color:var(--text); flex-wrap:wrap; }
  .pm-modelo svg{ color:var(--accent); }
  .pm-link{ background:none; border:none; padding:0; color:var(--accent); font-size:12px; font-weight:600; text-decoration:underline; cursor:pointer; align-self:flex-start; }
  .pm-hint{ font-size:12px; color:var(--muted); }
  .pm-resultados{ display:flex; flex-direction:column; gap:4px; }
  .pm-resultados .btn{ justify-content:flex-start; text-align:left; white-space:normal; }
  .pm-item > .btn-small{ align-self:flex-start; }
  .pm-items-acciones{ display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
  .pm-intro{ font-size:13px; color:var(--muted2,var(--muted)); line-height:1.5; margin:0 0 14px; }
  #pedidoManualModal .modal-content{ counter-reset: pm-paso; }
  .pm-paso{ border:1px solid var(--border); border-radius:12px; padding:14px; margin-bottom:14px; counter-increment: pm-paso; }
  .pm-paso[hidden]{ display:none; }
  .pm-paso-num::before{ content: counter(pm-paso); }
  .pm-paso > .form-group:last-child{ margin-bottom:0; }
  .pm-paso-titulo{ display:flex; align-items:center; gap:10px; margin:0 0 12px; font-size:14px; font-weight:800; color:var(--text); }
  .pm-paso-num{ width:26px; height:26px; border-radius:50%; background:var(--accent); color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:13px; flex-shrink:0; }
  .pm-opciones{ display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; margin-bottom:12px; }
  .pm-opcion{ position:relative; display:flex; flex-direction:column; align-items:flex-start; gap:6px; padding:12px; border:2px solid var(--border); border-radius:10px; cursor:pointer; background:var(--bg); transition:border-color .15s, background .15s; }
  .pm-opcion input{ position:absolute; opacity:0; pointer-events:none; }
  .pm-opcion-icono{ color:var(--muted); font-size:20px; display:inline-flex; }
  .pm-opcion-texto{ display:flex; flex-direction:column; gap:2px; font-size:13px; color:var(--text); line-height:1.3; }
  .pm-opcion-texto small{ font-size:11px; color:var(--muted); }
  .pm-opcion:has(input:checked){ border-color:var(--accent); background:color-mix(in srgb, var(--accent) 10%, var(--bg)); }
  .pm-opcion:has(input:checked) .pm-opcion-icono{ color:var(--accent); }
  .pm-opcion:has(input:focus-visible){ outline:2px solid var(--accent); outline-offset:2px; }
  .pm-costos{ display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; margin-bottom:12px; }
  .pm-costos label{ display:flex; flex-direction:column; gap:4px; font-size:11px; color:var(--muted); }
  .pm-resumen{ display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; padding:12px; border-radius:10px; background:var(--bg); border:1px solid var(--border); }
  .pm-resumen div{ display:flex; flex-direction:column; gap:2px; }
  .pm-resumen span{ font-size:11px; color:var(--muted); }
  .pm-resumen strong{ font-size:16px; color:var(--text); }
  .pm-resumen-resta strong{ color:var(--accent); }
  .pm-anchos{ display:grid; grid-template-columns:repeat(auto-fill, minmax(78px,1fr)); gap:6px; }
  .pm-ancho{ display:flex; flex-direction:column; align-items:center; gap:1px; padding:8px 4px; border:2px solid var(--border); border-radius:8px; background:var(--panel); color:var(--text); cursor:pointer; font:inherit; }
  .pm-ancho strong{ font-size:13px; }
  .pm-ancho span{ font-size:11px; color:var(--muted); }
  .pm-ancho.activo{ border-color:var(--accent); }
  .pm-ancho.activo span{ color:var(--accent); font-weight:700; }
  .pm-campo{ display:flex; flex-direction:column; gap:4px; font-size:11px; color:var(--muted); }
  .pm-dos{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .pm-foto-modelo{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .pm-foto-modelo img{ width:72px; height:72px; object-fit:cover; border-radius:8px; border:1px solid var(--border); }
  .pm-adic{ display:grid; grid-template-columns:repeat(auto-fill, minmax(180px,1fr)); gap:6px; }
  .pm-adic label{ display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--border); border-radius:8px; font-size:12px; color:var(--text); cursor:pointer; background:var(--panel); }
  .pm-adic input{ width:16px; height:16px; accent-color:var(--accent); flex-shrink:0; }
  .pm-adic em{ margin-left:auto; font-style:normal; color:var(--accent); font-weight:700; white-space:nowrap; }
  @media (max-width: 560px){
    .pm-opciones, .pm-costos, .pm-dos{ grid-template-columns:1fr; }
    .pm-opcion{ flex-direction:row; align-items:center; gap:12px; }
    .pm-resumen strong{ font-size:14px; }
  }
  @media (max-width: 480px){
    .pm-items-acciones .btn{ flex:1 1 100%; justify-content:center; }
  }
</style>
<?php
// Montos (precios, pago) solo para quien cobra: jefe/ventas/administrador.
// El diseñador también carga pedidos, pero sin cifras (ver puedeVerMontos).
$_pmSesion   = sesionActiva();
$_pmVeMontos = $_pmSesion && puedeVerMontos($_pmSesion);
unset($_pmSesion);
?>
<?php require_once dirname(__DIR__) . '/includes/accesorios.php'; ?>
<script nonce="<?= cspNonce() ?>">
  window.WH_PM_MONTOS = <?= $_pmVeMontos ? 'true' : 'false' ?>;
  window.WH_ACCESORIOS = <?= json_encode(whAccesoriosParaJs(), JSON_UNESCAPED_UNICODE) ?>;
</script>
<div class="modal" id="pedidoManualModal">
  <div class="modal-content" style="max-width:640px;width:min(640px,96vw);">
    <div class="modal-header">
      <h3 class="modal-title"><i data-lucide="package-plus"></i> Crear pedido</h3>
      <button class="modal-close" data-dismiss="pedidoManualModal">×</button>
    </div>

    <p class="pm-intro">Llena los pasos en orden, como si el cliente estuviera comprando en el carrito. Lo marcado con <strong>*</strong> es obligatorio; todo lo demás le llega tal cual al diseñador, al taller y al instalador.</p>

    <!-- PASO · Tipo de proyecto -->
    <section class="pm-paso">
      <h4 class="pm-paso-titulo"><span class="pm-paso-num"></span> ¿Qué se va a hacer?</h4>
      <div class="pm-opciones" role="radiogroup" aria-label="Tipo de proyecto">
        <label class="pm-opcion">
          <input type="radio" name="pm_tipo_proyecto" value="bano" checked>
          <span class="pm-opcion-icono"><i data-lucide="bath"></i></span>
          <span class="pm-opcion-texto"><strong>Mueble de baño</strong><small>Modelos del catálogo o uno especial</small></span>
        </label>
        <label class="pm-opcion">
          <input type="radio" name="pm_tipo_proyecto" value="cocina">
          <span class="pm-opcion-icono"><i data-lucide="cooking-pot"></i></span>
          <span class="pm-opcion-texto"><strong>Cocina</strong><small>Diseño 100% a la medida</small></span>
        </label>
        <label class="pm-opcion">
          <input type="radio" name="pm_tipo_proyecto" value="closet">
          <span class="pm-opcion-icono"><i data-lucide="shirt"></i></span>
          <span class="pm-opcion-texto"><strong>Clóset</strong><small>Diseño 100% a la medida</small></span>
        </label>
      </div>
    </section>

    <!-- PASO 1 · Cliente -->
    <section class="pm-paso">
      <h4 class="pm-paso-titulo"><span class="pm-paso-num"></span> Datos del cliente</h4>
      <div class="form-group">
        <label class="form-label" for="pm_nombre">Nombre del cliente *</label>
        <input type="text" class="form-input" id="pm_nombre" placeholder="ej: Juan Pérez" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label" for="pm_telefono">Teléfono principal</label>
        <div class="pm-tel-row">
          <input type="tel" class="form-input" id="pm_telefono" placeholder="33 1234 5678" inputmode="tel" autocomplete="off">
          <button type="button" class="btn btn-secondary pm-icon-btn" data-call="pmAgregarTelefono" title="Agregar otro teléfono" aria-label="Agregar otro teléfono">
            <i data-lucide="plus"></i>
          </button>
        </div>
        <div id="pm_telefonos_sec" class="pm-tel-list"></div>
        <div class="help">Toca <strong>+</strong> para agregar otros números que dé el cliente (pareja, encargado de obra…). Todos le llegan al instalador.</div>
      </div>
    </section>

    <!-- PASO 2 · Entrega -->
    <section class="pm-paso">
      <h4 class="pm-paso-titulo"><span class="pm-paso-num"></span> ¿Cómo se entrega?</h4>
      <div class="pm-opciones" role="radiogroup" aria-label="Tipo de entrega">
        <label class="pm-opcion">
          <input type="radio" name="pm_entrega" value="instalacion" checked>
          <span class="pm-opcion-icono"><i data-lucide="wrench"></i></span>
          <span class="pm-opcion-texto"><strong>Entrega e instalación</strong><small>Lo llevamos y lo instalamos en su domicilio</small></span>
        </label>
        <label class="pm-opcion">
          <input type="radio" name="pm_entrega" value="envio">
          <span class="pm-opcion-icono"><i data-lucide="truck"></i></span>
          <span class="pm-opcion-texto"><strong>Solo entrega a domicilio</strong><small>Lo llevamos, el cliente lo instala</small></span>
        </label>
        <label class="pm-opcion">
          <input type="radio" name="pm_entrega" value="recoger">
          <span class="pm-opcion-icono"><i data-lucide="store"></i></span>
          <span class="pm-opcion-texto"><strong>Pasa a recogerlo</strong><small>El cliente lo recoge en el taller</small></span>
        </label>
      </div>
      <div class="form-group" id="pm_direccion_wrap">
        <label class="form-label" for="pm_direccion">Dirección de entrega</label>
        <input type="text" class="form-input" id="pm_direccion" placeholder="Pega el link de Google Maps o escribe la dirección">
        <div class="help">Puedes pegar directo el link de ubicación que te mandó el cliente — el instalador lo abre en el mapa.</div>
      </div>
      <div class="form-group">
        <label class="form-label" for="pm_fecha_entrega" id="pm_fecha_label">Fecha de instalación</label>
        <input type="date" class="form-input" id="pm_fecha_entrega">
        <div class="help" id="pm_fecha_help">El día que acordaste con el cliente. Aparece en el calendario de todos.</div>
      </div>
    </section>

    <!-- PASO · Muebles de baño -->
    <section class="pm-paso" id="pm_seccion_bano">
      <h4 class="pm-paso-titulo"><span class="pm-paso-num"></span> Muebles de baño del pedido</h4>
      <div id="pm_items_tabla" class="pm-items"></div>
      <div class="pm-items-acciones">
        <button type="button" class="btn btn-secondary btn-small" data-call="pmAgregarModelo">
          <i data-lucide="plus"></i> Agregar modelo del catálogo
        </button>
        <button type="button" class="btn btn-secondary btn-small" data-call="pmAgregarLineaCustom">
          <i data-lucide="plus"></i> Modelo que no está en el catálogo
        </button>
      </div>
      <div class="help">Un mueble por cada modelo distinto. En cada uno eliges el ancho, la cubierta (tapa de MDF, cuarzo, granito o mármol) y el color. Si el cliente trae un modelo que no tenemos, usa "Modelo que no está en el catálogo" y sube su foto con las medidas.</div>
    </section>

    <!-- PASO · Cocina / clóset (sin modelos: medidas, colores, fotos e ideas del cliente) -->
    <section class="pm-paso" id="pm_seccion_medida" hidden>
      <h4 class="pm-paso-titulo"><span class="pm-paso-num"></span> <span id="pm_medida_titulo">Detalles de la cocina</span></h4>
      <div class="form-group">
        <label class="form-label">Medidas del espacio (metros)</label>
        <div class="pm-costos">
          <label>Ancho<input type="number" class="form-input" id="pm_med_ancho" min="0" step="0.01" inputmode="decimal" placeholder="ej. 3.20"></label>
          <label>Alto<input type="number" class="form-input" id="pm_med_alto" min="0" step="0.01" inputmode="decimal" placeholder="ej. 2.40"></label>
          <label>Fondo<input type="number" class="form-input" id="pm_med_fondo" min="0" step="0.01" inputmode="decimal" placeholder="ej. 0.60"></label>
        </div>
        <textarea class="form-textarea" id="pm_med_notas" rows="2" placeholder="Otras medidas: muros, ventanas, columnas, altura de la barra…"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label" for="pm_med_colores">Colores y acabados</label>
        <input type="text" class="form-input" id="pm_med_colores" placeholder="ej. Gabinetes nogal, puertas blanco mate, jaladeras negras">
      </div>
      <div class="form-group">
        <label class="form-label" for="pm_med_info">Información detallada</label>
        <textarea class="form-textarea" id="pm_med_info" rows="4" placeholder="Qué quiere el cliente: distribución, cajones, entrepaños, electrodomésticos que van, cubierta, ideas que mostró…"></textarea>
      </div>
      <div id="pm_fotos_slot_medida"></div>
<?php if ($_pmVeMontos): ?>
      <div class="form-group">
        <label class="form-label" for="pm_med_precio">Precio del proyecto ($)</label>
        <input type="number" class="form-input" id="pm_med_precio" min="0" step="0.01" inputmode="decimal" placeholder="Lo acordado con el cliente (sin envío ni instalación)">
      </div>
<?php endif; ?>
    </section>

<?php if ($_pmVeMontos): ?>
    <!-- PASO 4 · Pago (solo jefe/ventas/administrador: la API ignora estos campos para otros roles) -->
    <section class="pm-paso">
      <h4 class="pm-paso-titulo"><span class="pm-paso-num"></span> Pago</h4>
      <div class="pm-costos">
        <label>Envío ($)<input type="number" class="form-input" id="pm_costo_envio" min="0" step="0.01" value="0" inputmode="decimal"></label>
        <label>Instalación ($)<input type="number" class="form-input" id="pm_costo_instalacion" min="0" step="0.01" value="0" inputmode="decimal"></label>
        <label>Descuento ($)<input type="number" class="form-input" id="pm_descuento" min="0" step="0.01" value="0" inputmode="decimal"></label>
      </div>
      <div class="pm-opciones pm-opciones--compactas" role="radiogroup" aria-label="Forma de pago">
        <label class="pm-opcion">
          <input type="radio" name="pm_tipo_pago" value="completo" checked>
          <span class="pm-opcion-icono"><i data-lucide="circle-check"></i></span>
          <span class="pm-opcion-texto"><strong>Pagó completo</strong><small>Ya no debe nada</small></span>
        </label>
        <label class="pm-opcion">
          <input type="radio" name="pm_tipo_pago" value="anticipo">
          <span class="pm-opcion-icono"><i data-lucide="hand-coins"></i></span>
          <span class="pm-opcion-texto"><strong>Dejó anticipo</strong><small>Paga el resto al entregar</small></span>
        </label>
        <label class="pm-opcion">
          <input type="radio" name="pm_tipo_pago" value="sin_pago">
          <span class="pm-opcion-icono"><i data-lucide="clock"></i></span>
          <span class="pm-opcion-texto"><strong>Todavía no paga</strong><small>No pasa a producción hasta que pague</small></span>
        </label>
      </div>
      <div class="pm-costos" id="pm_pago_detalle">
        <label>Monto recibido ($)<input type="number" class="form-input" id="pm_monto_pagado" min="0" step="0.01" inputmode="decimal"></label>
        <label>¿Cómo pagó?
          <select class="form-select" id="pm_metodo_pago">
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="terminal">Terminal / tarjeta</option>
          </select>
        </label>
        <label>Referencia (opcional)<input type="text" class="form-input" id="pm_referencia_pago" placeholder="folio, últimos 4 dígitos…"></label>
      </div>
      <div class="pm-resumen" aria-live="polite">
        <div><span>Total del pedido</span><strong id="pm_res_total">$0.00</strong></div>
        <div><span>Pagado</span><strong id="pm_res_pagado">$0.00</strong></div>
        <div class="pm-resumen-resta"><span>Resta por pagar</span><strong id="pm_res_resta">$0.00</strong></div>
      </div>
      <div class="help">Estas cifras solo las ven el jefe y ventas. El taller y el instalador solo ven si ya está pagado o si falta una parte.</div>
    </section>
<?php endif; ?>

    <!-- PASO 5 · Notas para diseño -->
    <section class="pm-paso">
      <h4 class="pm-paso-titulo"><span class="pm-paso-num"></span> Indicaciones para el diseñador</h4>
      <div id="pm_fotos_slot_diseno"></div>

    <div class="form-group">
      <label class="form-label">Descripción del proyecto</label>
      <textarea class="form-textarea" id="pm_descripcion" rows="4" placeholder="Describe qué debe diseñar el diseñador (o graba una nota de voz abajo, o usa ambas)"></textarea>
    </div>

    <div class="form-group">
      <label class="form-label">Nota de voz (opcional)</label>
      <div id="pm_audio_zona">
        <button type="button" class="btn btn-secondary" id="pm_btn_grabar">
          <i data-lucide="mic"></i> Grabar nota de voz
        </button>
        <span id="pm_audio_tiempo" style="display:none;margin-left:10px;color:var(--danger,#e57373);font-weight:700;">● 00:00</span>
      </div>
      <div id="pm_audio_preview" style="display:none;margin-top:10px;">
        <audio id="pm_audio_player" controls style="width:100%;"></audio>
        <button type="button" class="btn btn-secondary btn-small" id="pm_btn_borrar_audio" style="margin-top:6px;">
          <i data-lucide="trash-2"></i> Eliminar y regrabar
        </button>
      </div>
    </div>

    <div class="form-group" id="pm_fotos_bloque">
      <label class="form-label" id="pm_fotos_label">Fotos de referencia</label>
      <div id="pmImgDropZone" style="border:2px dashed var(--border);border-radius:10px;padding:20px;text-align:center;cursor:pointer;" data-trigger-click="pm_fotos_files">
        <i data-lucide="camera" style="color:var(--accent);"></i>
        <p style="margin:6px 0 0;font-size:13px;color:var(--muted);">Haz clic para elegir fotos (o arrastra aquí)</p>
      </div>
      <input type="file" id="pm_fotos_files" multiple accept="image/*" style="display:none">
      <div id="pmFotosPreviewGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px;margin-top:10px;"></div>
    </div>

    </section>

    <div id="pm_progreso" style="display:none;margin-top:10px;">
      <div style="font-size:12px;color:var(--muted);" id="pm_progreso_label">Subiendo...</div>
      <div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden;margin-top:4px;">
        <div id="pm_progreso_bar" style="height:100%;background:var(--accent);width:0%;transition:width .3s;"></div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary" data-dismiss="pedidoManualModal">Cancelar</button>
      <button class="btn btn-primary" id="pm_btn_guardar" data-call="guardarPedidoManual">
        <i data-lucide="save"></i> Crear pedido
      </button>
    </div>
  </div>
</div>
