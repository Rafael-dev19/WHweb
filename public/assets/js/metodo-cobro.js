// metodo-cobro.js — "¿Cómo pagó el cliente?" al marcar un saldo como cobrado.
// Lo usan los paneles de jefe/administrador/ventas y de taller/instalación:
// el pago queda registrado con el método real y con quién lo marcó
// (api/pagos.php?action=marcar_saldo_manual), en vez de un "tarjeta" genérico.
(function () {
  const METODOS = [
    ['efectivo',      'Efectivo',            'banknote'],
    ['transferencia', 'Transferencia',       'landmark'],
    ['terminal',      'Terminal / tarjeta',  'credit-card'],
  ];

  // Devuelve una promesa con el método elegido, o null si se cancela.
  window.elegirMetodoCobro = function (pregunta) {
    return new Promise(resolve => {
      const fondo = document.createElement('div');
      fondo.setAttribute('role', 'dialog');
      fondo.setAttribute('aria-modal', 'true');
      fondo.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9500;display:flex;align-items:center;justify-content:center;padding:16px;';
      fondo.innerHTML = `
        <div style="background:var(--panel,#fff);color:var(--text,#111);border:1px solid var(--border,#ddd);border-radius:14px;padding:18px;width:100%;max-width:380px;box-shadow:0 14px 40px rgba(0,0,0,.4);">
          <div style="font-weight:800;font-size:15px;margin-bottom:6px;">¿Cómo pagó el cliente el resto?</div>
          <div style="font-size:13px;color:var(--muted,#666);line-height:1.5;margin-bottom:14px;">${pregunta || 'Elige cómo se cobró. El pedido quedará como pagado completo.'}</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${METODOS.map(([v, t, ico]) => `
              <button type="button" data-metodo="${v}" class="btn btn-secondary" style="justify-content:flex-start;min-height:44px;font-size:14px;">
                <i data-lucide="${ico}"></i> ${t}
              </button>`).join('')}
            <button type="button" data-metodo="" class="btn btn-secondary" style="min-height:44px;justify-content:center;opacity:.8;">Todavía no ha pagado</button>
          </div>
        </div>`;
      const cerrar = valor => { fondo.remove(); document.removeEventListener('keydown', esc); resolve(valor); };
      const esc = e => { if (e.key === 'Escape') cerrar(null); };
      fondo.addEventListener('click', e => {
        const b = e.target.closest('[data-metodo]');
        if (b) cerrar(b.dataset.metodo || null);
        else if (e.target === fondo) cerrar(null);
      });
      document.addEventListener('keydown', esc);
      document.body.appendChild(fondo);
      if (window.lucide?.createIcons) window.lucide.createIcons();
      fondo.querySelector('[data-metodo]')?.focus();
    });
  };

  // Diálogo para capturar un monto en pesos (ej. corregir el total de un
  // pedido). Devuelve el número o null si se cancela.
  window.pedirMonto = function ({ titulo, texto, valor, minimo }) {
    return new Promise(resolve => {
      const fondo = document.createElement('div');
      fondo.setAttribute('role', 'dialog');
      fondo.setAttribute('aria-modal', 'true');
      fondo.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9500;display:flex;align-items:center;justify-content:center;padding:16px;';
      fondo.innerHTML = `
        <form style="background:var(--panel,#fff);color:var(--text,#111);border:1px solid var(--border,#ddd);border-radius:14px;padding:18px;width:100%;max-width:380px;box-shadow:0 14px 40px rgba(0,0,0,.4);">
          <div style="font-weight:800;font-size:15px;margin-bottom:6px;"></div>
          <div data-texto style="font-size:13px;color:var(--muted,#666);line-height:1.5;margin-bottom:12px;"></div>
          <input type="number" class="form-input" step="0.01" inputmode="decimal" required style="width:100%;font-size:16px;margin-bottom:6px;">
          <div data-error style="font-size:12px;color:var(--danger,#c0392b);min-height:16px;margin-bottom:8px;"></div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button type="button" class="btn btn-secondary" data-cancelar>Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>`;
      fondo.querySelector('form > div').textContent = titulo || 'Monto';
      fondo.querySelector('[data-texto]').textContent = texto || '';
      const input = fondo.querySelector('input');
      if (valor) input.value = Number(valor).toFixed(2);
      const err = fondo.querySelector('[data-error]');
      const cerrar = v => { fondo.remove(); document.removeEventListener('keydown', esc); resolve(v); };
      const esc = e => { if (e.key === 'Escape') cerrar(null); };
      fondo.querySelector('[data-cancelar]').addEventListener('click', () => cerrar(null));
      fondo.addEventListener('click', e => { if (e.target === fondo) cerrar(null); });
      fondo.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const n = Math.round(parseFloat(input.value) * 100) / 100;
        if (!(n > 0)) { err.textContent = 'Escribe un monto mayor a $0.'; return; }
        if (minimo && n < minimo - 0.01) { err.textContent = `No puede ser menor a $${Number(minimo).toLocaleString('es-MX', { minimumFractionDigits: 2 })} (lo ya cobrado).`; return; }
        cerrar(n);
      });
      document.addEventListener('keydown', esc);
      document.body.appendChild(fondo);
      input.focus();
      input.select();
    });
  };
})();
