<!-- _modal_cotizacion_manual.php — Modal "Crear cotización" para que ventas/
     jefe/administrador inicien una cotización desde cero (cliente que llamó
     o llegó directo, sin pasar por el cotizador público del sitio). Solo
     captura los datos básicos del cliente; las partidas se llenan después
     en el mismo cotizador de dos columnas que ya se usa para responder
     cualquier cotización (verDetalleCotAdmin), para no duplicar esa UI.
     Compartido por panel_administrador.php y panel_ventas.php. -->
<div class="modal" id="nuevaCotizacionModal">
  <div class="modal-content" style="max-width:520px;width:min(520px,96vw);">
    <div class="modal-header">
      <h3 class="modal-title"><i data-lucide="plus"></i> Crear cotización</h3>
      <button class="modal-close" data-dismiss="nuevaCotizacionModal">×</button>
    </div>

    <div class="form-group">
      <label class="form-label">Nombre del cliente *</label>
      <input type="text" class="form-input" id="nc_nombre" placeholder="ej: Juan Pérez">
    </div>
    <div class="form-group">
      <label class="form-label">Correo *</label>
      <input type="email" class="form-input" id="nc_correo" placeholder="correo@ejemplo.com">
      <div class="help">Si el cliente no tiene correo, usa uno de referencia (ej. el tuyo) — el campo es obligatorio en el sistema.</div>
    </div>
    <div class="form-group">
      <label class="form-label">Teléfono *</label>
      <input type="text" class="form-input" id="nc_telefono" placeholder="33 1234 5678">
    </div>
    <div class="form-group">
      <label class="form-label">Tipo de proyecto</label>
      <select class="form-select" id="nc_tipo_mueble">
        <option value="cocina">Cocina</option>
        <option value="closet">Closet</option>
        <option value="lavamanos">Muebles de baño</option>
        <option value="otro" selected>Otro</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Dirección (opcional)</label>
      <input type="text" class="form-input" id="nc_direccion" placeholder="Pega el link de ubicación o escribe la dirección">
    </div>
    <div class="form-group">
      <label class="form-label">Descripción del proyecto *</label>
      <textarea class="form-textarea" id="nc_descripcion" rows="3" placeholder="ej: 6 baños — cubierta de cuarzo blanco, base de herrería e instalación en todos."></textarea>
    </div>

    <div id="nc_error" style="display:none;color:#e05;font-size:13px;margin-bottom:12px;padding:10px;background:#2a0a0a;border-radius:6px;"></div>

    <div class="modal-footer">
      <button class="btn btn-secondary" data-dismiss="nuevaCotizacionModal">Cancelar</button>
      <button class="btn btn-primary" id="nc_btn_guardar" data-call="guardarNuevaCotizacion">
        <i data-lucide="arrow-right"></i> Crear y continuar al cotizador
      </button>
    </div>
  </div>
</div>
