/**
 * locked-field.js — Patrón "campo precargado bloqueado, con lápiz para editar
 * y botón guardar que vuelve a bloquear". Reutilizable en cualquier formulario
 * que muestre datos ya guardados del cliente (dirección, contacto, etc.).
 *
 * Dos modos de uso:
 *
 * 1) Modo simple — una lista de inputs/selects/textareas normales:
 *    LockedField.init(wrapperEl, {
 *      fields: [input1, input2, ...],
 *      hasValue: () => !!input1.value,   // si no hay valor guardado, arranca desbloqueado
 *      onSave: async () => true/false,   // guarda (PUT); true = éxito
 *    });
 *
 * 2) Modo personalizado — para widgets que no son inputs simples (ej. un mapa):
 *    LockedField.init(wrapperEl, {
 *      hasValue: () => !!direccionGuardada,
 *      renderLocked(el)   { el.innerHTML = '...resumen de solo lectura...'; },
 *      renderUnlocked(el) { el.innerHTML = '...UI editable...'; }, // ej. MapsPicker.init(...)
 *      onSave: async () => true/false,
 *    });
 *
 * En ambos casos se inyecta un botón lápiz (para desbloquear) y, en modo
 * desbloqueado, un botón "Guardar cambios" que llama a onSave() y —si tuvo
 * éxito— vuelve a bloquear.
 */
(function () {
  'use strict';

  function _pencilBtn() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'locked-field-pencil';
    btn.setAttribute('aria-label', 'Editar');
    btn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar';
    return btn;
  }

  function _saveBtn() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'locked-field-save btn btn-secondary btn-small';
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar cambios';
    return btn;
  }

  function _setFieldsLocked(fields, locked) {
    (fields || []).forEach((f) => {
      if (!f) return;
      f.disabled = locked;
      f.classList.toggle('locked-field-input', locked);
    });
  }

  class LockedFieldInstance {
    constructor(wrapper, opts) {
      this.wrapper = wrapper;
      this.opts    = opts || {};
      this.locked  = this.opts.hasValue ? !!this.opts.hasValue() : true;
      this._build();
    }

    _build() {
      this.wrapper.classList.add('locked-field-wrap');

      // Contenedor de controles (lápiz / guardar), inyectado una sola vez.
      this.controls = document.createElement('div');
      this.controls.className = 'locked-field-controls';
      this.wrapper.appendChild(this.controls);

      this._render();
    }

    _render() {
      this.controls.innerHTML = '';

      if (this.opts.renderLocked || this.opts.renderUnlocked) {
        // Modo personalizado: el caller pinta el contenido según el estado.
        if (!this.content) {
          this.content = document.createElement('div');
          this.content.className = 'locked-field-content';
          this.wrapper.insertBefore(this.content, this.controls);
        }
        if (this.locked && this.opts.renderLocked) this.opts.renderLocked(this.content);
        else if (!this.locked && this.opts.renderUnlocked) this.opts.renderUnlocked(this.content);
      } else if (this.opts.fields) {
        _setFieldsLocked(this.opts.fields, this.locked);
      }

      if (this.locked) {
        const pencil = _pencilBtn();
        pencil.addEventListener('click', () => this.unlock());
        this.controls.appendChild(pencil);
      } else {
        const save = _saveBtn();
        save.addEventListener('click', () => this._save(save));
        this.controls.appendChild(save);
      }

      this.wrapper.classList.toggle('locked-field-is-locked', this.locked);
      this.wrapper.classList.toggle('locked-field-is-unlocked', !this.locked);
    }

    async _save(btn) {
      btn.disabled  = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
      let ok = false;
      try {
        ok = this.opts.onSave ? await this.opts.onSave() : true;
      } catch (e) {
        console.warn('[LockedField] onSave error:', e);
        ok = false;
      }
      btn.disabled  = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar cambios';
      if (ok) this.lock();
    }

    lock()   { this.locked = true;  this._render(); }
    unlock() { this.locked = false; this._render(); if (this.opts.onEdit) this.opts.onEdit(); }
  }

  window.LockedField = {
    init(wrapper, opts) { return new LockedFieldInstance(wrapper, opts); },
  };
})();
