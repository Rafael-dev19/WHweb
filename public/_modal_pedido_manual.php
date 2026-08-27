<!-- _modal_pedido_manual.php — Modal "Crear pedido" compartido por
     panel_administrador.php (jefe) y panel_empleado.php (diseñador). Incluir
     solo detrás de un guardia de rol — nunca para administrador/empleado. -->
<div class="modal" id="pedidoManualModal">
  <div class="modal-content" style="max-width:640px;width:min(640px,96vw);">
    <div class="modal-header">
      <h3 class="modal-title"><i data-lucide="package-plus"></i> Crear pedido</h3>
      <button class="modal-close" data-dismiss="pedidoManualModal">×</button>
    </div>

    <div class="form-group">
      <label class="form-label">Nombre del cliente *</label>
      <input type="text" class="form-input" id="pm_nombre" placeholder="ej: Juan Pérez">
    </div>

    <div class="form-group">
      <label class="form-label">Teléfono</label>
      <input type="text" class="form-input" id="pm_telefono" placeholder="33 1234 5678">
    </div>

    <div class="form-group">
      <label class="form-label">Dirección</label>
      <input type="text" class="form-input" id="pm_direccion" placeholder="Pega el link de la ubicación (Google Maps) o escribe la dirección">
      <div class="help">Puedes pegar directamente el link de ubicación compartido — no hace falta escribir la dirección completa.</div>
    </div>

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

    <div class="form-group">
      <label class="form-label">Fotos de referencia</label>
      <div id="pmImgDropZone" style="border:2px dashed var(--border);border-radius:10px;padding:20px;text-align:center;cursor:pointer;" data-trigger-click="pm_fotos_files">
        <i data-lucide="camera" style="color:var(--accent);"></i>
        <p style="margin:6px 0 0;font-size:13px;color:var(--muted);">Haz clic para elegir fotos (o arrastra aquí)</p>
      </div>
      <input type="file" id="pm_fotos_files" multiple accept="image/*" style="display:none">
      <div id="pmFotosPreviewGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px;margin-top:10px;"></div>
    </div>

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
