/**
 * ui-clientes.js — Renderizado módulo clientes y kardex
 * Control de Canastas PWA v3
 */

const UI_CLIENTES = (() => {

  const TIPO_LABEL = { entrega: '📤 Entrega', retorno: '📥 Retorno', ajuste: '🔧 Ajuste', baja: '🗑 Baja' };
  const TIPO_BADGE = { entrega: 'badge-blue', retorno: 'badge-green', ajuste: 'badge-orange', baja: 'badge-red' };

  // ─── Dashboard de clientes ──────────────────────────────────────────────────
  async function renderDashboardClientes() {
    UI.setLoading(true);
    try {
      const [inv, alertas, resumen] = await Promise.all([
        DB_CLIENTES.getInventarioGeneral(),
        DB_CLIENTES.getClientesConAlertas(),
        DB_CLIENTES.getResumenMensual(),
      ]);

      const total = inv.total_sistema || 0;
      const pct = v => total > 0 ? Math.max(0, Math.round(v / total * 100)) : 0;

      // KPIs
      document.getElementById('cli-inv-bodega').textContent   = inv.en_bodega    ?? '—';
      document.getElementById('cli-inv-clientes').textContent = inv.en_clientes  ?? '—';
      document.getElementById('cli-inv-rutas').textContent    = inv.en_rutas     ?? '—';
      document.getElementById('cli-inv-danadas').textContent  = inv.danadas      ?? '—';
      document.getElementById('cli-inv-total').textContent    = total;

      // Barra de distribución
      const barEl = document.getElementById('cli-estado-bar');
      barEl.innerHTML = `
        <div class="estado-bar-wrap">
          <div class="estado-seg seg-bodega"   style="width:${pct(inv.en_bodega)}%"   title="Bodega: ${inv.en_bodega}"></div>
          <div class="estado-seg seg-clientes" style="width:${pct(inv.en_clientes)}%" title="Clientes: ${inv.en_clientes}"></div>
          <div class="estado-seg seg-rutas"    style="width:${pct(inv.en_rutas)}%"    title="Rutas: ${inv.en_rutas}"></div>
          <div class="estado-seg seg-danadas"  style="width:${pct(inv.danadas)}%"     title="Dañadas: ${inv.danadas}"></div>
        </div>
        <div class="estado-bar-legend">
          <span><span class="seg-dot seg-bodega"></span>Bodega ${pct(inv.en_bodega)}%</span>
          <span><span class="seg-dot seg-clientes"></span>Clientes ${pct(inv.en_clientes)}%</span>
          <span><span class="seg-dot seg-rutas"></span>Rutas ${pct(inv.en_rutas)}%</span>
          <span><span class="seg-dot seg-danadas"></span>Dañadas ${pct(inv.danadas)}%</span>
        </div>`;

      // Descuadre
      const registrado = (inv.en_bodega||0) + (inv.en_clientes||0) + (inv.en_rutas||0) + (inv.danadas||0);
      const descuadre  = total - registrado;
      const descEl = document.getElementById('cli-descuadre');
      if (descEl) {
        descEl.textContent = descuadre === 0
          ? '✅ Inventario cuadrado'
          : `⚠️ Descuadre: ${descuadre > 0 ? '+' : ''}${descuadre} canastillas`;
        descEl.className = descuadre === 0 ? 'inv-ok' : 'inv-warn';
      }

      // Resumen mensual
      document.getElementById('cli-mes-entregas').textContent = resumen.entregas;
      document.getElementById('cli-mes-retornos').textContent = resumen.retornos;
      document.getElementById('cli-mes-bajas').textContent    = resumen.bajas;
      const netoEl = document.getElementById('cli-mes-neto');
      if (netoEl) {
        netoEl.textContent = (resumen.neto > 0 ? '+' : '') + resumen.neto;
        netoEl.className   = 'dif-val ' + (resumen.neto > 0 ? 'neg' : 'pos');
      }

      // Top clientes
      const top = [...alertas].sort((a, b) => b.saldo - a.saldo).slice(0, 8);
      const topEl = document.getElementById('cli-top-saldos');
      topEl.innerHTML = top.length === 0
        ? '<p class="text-muted text-sm">No hay clientes con saldo</p>'
        : top.map(c => {
          const pctBar   = c.stock_acordado > 0 ? Math.min(100, Math.round(c.saldo / c.stock_acordado * 100)) : 0;
          const barColor = c.superaStock ? 'var(--danger)' : pctBar > 75 ? 'var(--warning)' : 'var(--brand)';
          const safeName = UI.escapeHtml(c.nombre).replace(/'/g, "\\'");
          return `<div class="cli-saldo-row" onclick="APP.verKardexCliente('${c.id}','${safeName}')">
            <div class="cli-saldo-info">
              ${c.alerta ? `<span class="semaforo semaforo-${c.alerta}"></span>` : ''}
              <span class="cli-nombre">${UI.escapeHtml(c.nombre)}</span>
              ${c.superaStock ? '<span class="badge badge-red" style="font-size:.65rem">⚠️ Sobre stock</span>' : ''}
            </div>
            <div class="cli-saldo-right">
              <strong>${c.saldo}</strong>
              ${c.stock_acordado > 0 ? `<span class="text-muted text-xs">/${c.stock_acordado}</span>` : ''}
            </div>
            ${c.stock_acordado > 0 ? `
            <div class="cli-prog-wrap" style="grid-column:1/-1">
              <div class="cli-prog-bar" style="width:${pctBar}%;background:${barColor}"></div>
            </div>` : ''}
          </div>`;
        }).join('');

      // Alertas críticas
      const criticas = alertas.filter(c => c.alerta === 'red' || c.superaStock);
      const alertaEl = document.getElementById('cli-alertas');
      alertaEl.innerHTML = criticas.length === 0
        ? '<div style="padding:.75rem .25rem;color:var(--success);font-size:.875rem;font-weight:600">✅ Sin alertas críticas</div>'
        : criticas.map(c => `
          <div class="alerta-item alerta-rojo">
            <span class="semaforo semaforo-red"></span>
            <span style="flex:1;font-size:.8125rem">${UI.escapeHtml(c.nombre)}</span>
            <span class="badge badge-red">${c.saldo} 🧺 · ${c.dias}d</span>
          </div>`).join('');

    } catch (err) { UI.toast('Error dashboard clientes: ' + err.message, 'error'); }
    UI.setLoading(false);
  }

  // ─── Lista de clientes ──────────────────────────────────────────────────────
  async function renderClientes() {
    UI.setLoading(true);
    try {
      const [alertas, todos] = await Promise.all([
        DB_CLIENTES.getClientesConAlertas(),
        DB_CLIENTES.getClientes(),
      ]);
      const saldoMap = {};
      alertas.forEach(a => { saldoMap[a.id] = a; });

      const listEl = document.getElementById('clientes-kardex-list');
      if (todos.length === 0) {
        listEl.innerHTML = `<div class="empty-state">
          <span class="empty-icon">🏢</span>
          <strong>Sin clientes registrados</strong>
        </div>`;
        return;
      }

      listEl.innerHTML = `<div class="persona-cards-grid">${todos.map(c => {
        const info    = saldoMap[c.id] || { saldo: 0, dias: null, alerta: null, superaStock: false };
        const safeName = UI.escapeHtml(c.nombre).replace(/'/g, "\\'");
        return `<div class="persona-card ${!c.activo ? 'inactive' : ''}"
          onclick="APP.verKardexCliente('${c.id}','${safeName}')" style="cursor:pointer">
          <div class="persona-info">
            <div style="display:flex;align-items:center;gap:.4rem">
              ${info.alerta ? `<span class="semaforo semaforo-${info.alerta}"></span>` : ''}
              <div class="persona-nombre">${UI.escapeHtml(c.nombre)}</div>
            </div>
            <div class="persona-cedula">
              NIT: ${UI.escapeHtml(c.nit || '—')} · Stock: ${c.stock_acordado}
              ${info.dias !== null ? ` · ${info.dias}d` : ''}
            </div>
          </div>
          <div class="persona-actions">
            <span class="badge ${info.saldo > 0 ? 'badge-blue' : 'badge-gray'}">${info.saldo} 🧺</span>
            <span class="badge ${c.activo ? 'badge-green' : 'badge-gray'}">${c.activo ? 'Activo' : 'Inactivo'}</span>
            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();APP.abrirFormularioMovCliente('${c.id}')">+ Mov.</button>
          </div>
        </div>`;
      }).join('')}</div>`;
    } catch (err) { UI.toast('Error al cargar clientes: ' + err.message, 'error'); }
    UI.setLoading(false);
  }

  // ─── Kardex de un cliente (drawer) ─────────────────────────────────────────
  async function renderKardexCliente(clienteId, clienteNombre) {
    document.getElementById('aux-drawer-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'aux-drawer-overlay';
    overlay.className = 'aux-drawer-overlay';
    const drawer = document.createElement('div');
    drawer.className = 'aux-drawer';
    drawer.innerHTML = `
      <div class="aux-drawer-header">
        <div class="aux-drawer-header-top">
          <div>
            <div class="aux-drawer-nombre">🏢 ${UI.escapeHtml(clienteNombre)}</div>
            <div class="aux-drawer-cedula" id="kard-sub">Cargando...</div>
          </div>
          <button class="aux-drawer-close" id="kard-close">✕</button>
        </div>
        <div class="aux-drawer-chips" id="kard-chips"><span class="aux-chip">⏳</span></div>
      </div>
      <div style="padding:.625rem 1.375rem;border-bottom:1px solid var(--border)">
        <button class="btn btn-primary btn-sm btn-block" id="kard-btn-mov">+ Registrar movimiento</button>
      </div>
      <div class="aux-drawer-body" id="kard-body">
        <div class="aux-drawer-empty"><div class="aux-drawer-empty-icon">⏳</div><div>Cargando...</div></div>
      </div>`;
    overlay.appendChild(drawer);
    document.body.appendChild(overlay);

    const close = () => {
      overlay.style.animation = 'fadeIn .15s ease reverse';
      drawer.style.animation  = 'drawerIn .18s ease reverse';
      setTimeout(() => overlay.remove(), 170);
    };
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.getElementById('kard-close').addEventListener('click', close);
    document.getElementById('kard-btn-mov').addEventListener('click', () => {
      close(); APP.abrirFormularioMovCliente(clienteId);
    });
    const onKey = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);

    try {
      const [movs, cliente, saldo] = await Promise.all([
        DB_CLIENTES.getMovimientosCliente(clienteId),
        DB_CLIENTES.getClienteById(clienteId),
        DB_CLIENTES.getSaldoCliente(clienteId),
      ]);

      document.getElementById('kard-sub').textContent =
        `NIT: ${cliente?.nit || '—'} · Stock acordado: ${cliente?.stock_acordado || 0}`;

      const dias = movs.length > 0
        ? Math.floor((Date.now() - new Date(movs[movs.length - 1].fecha)) / 86400000)
        : null;
      const alerta = saldo === 0 ? null : dias === null ? 'gray'
        : dias < 30 ? 'green' : dias < 60 ? 'yellow' : 'red';
      const superaStock = cliente?.stock_acordado > 0 && saldo > cliente.stock_acordado;

      document.getElementById('kard-chips').innerHTML =
        `<span class="aux-chip ${saldo > 0 ? (superaStock ? 'chip-alert' : 'chip-ok') : ''}">🧺 Saldo: <strong>${saldo}</strong></span>` +
        (cliente?.stock_acordado > 0 ? `<span class="aux-chip">📋 Stock: ${cliente.stock_acordado}</span>` : '') +
        (alerta ? `<span class="aux-chip ${alerta === 'red' ? 'chip-alert' : alerta === 'yellow' ? 'chip-warn' : 'chip-ok'}">
          <span class="semaforo semaforo-${alerta}" style="border-color:rgba(255,255,255,.4)"></span>
          ${dias !== null ? `${dias} días` : ''}
        </span>` : '') +
        `<span class="aux-chip">📝 ${movs.length} movimientos</span>`;

      const bodyEl = document.getElementById('kard-body');
      if (movs.length === 0) {
        bodyEl.innerHTML = `<div class="aux-drawer-empty">
          <div class="aux-drawer-empty-icon">📭</div>
          <div>Sin movimientos registrados</div>
        </div>`;
        return;
      }

      // Running balance (saldo corriente)
      const movsAsc = [...movs].reverse();
      let saldoCorriente = 0;
      const filas = movsAsc.map(m => {
        if (m.tipo === 'entrega') saldoCorriente += m.cantidad;
        else if (m.tipo === 'retorno' || m.tipo === 'baja') saldoCorriente -= m.cantidad;
        return { ...m, saldoCorriente };
      }).reverse();

      bodyEl.innerHTML = `
        <div class="table-wrapper" style="border-radius:0;box-shadow:none;border:none">
          <table class="data-table" style="font-size:.78rem">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th style="text-align:center">Cant.</th>
                <th style="text-align:center">Saldo</th>
                <th>Doc.</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              ${filas.map(m => `<tr>
                <td>${m.fecha}</td>
                <td><span class="badge ${TIPO_BADGE[m.tipo]||'badge-gray'}" style="font-size:.68rem">${TIPO_LABEL[m.tipo]||m.tipo}</span></td>
                <td style="text-align:center;font-weight:700;color:${m.tipo==='retorno'||m.tipo==='baja'?'var(--success)':'var(--brand)'}">
                  ${m.tipo==='retorno'||m.tipo==='baja'?'-':''}${m.cantidad}
                </td>
                <td style="text-align:center;font-weight:800;color:${m.saldoCorriente>0?'var(--brand)':'var(--success)'}">
                  ${m.saldoCorriente}
                </td>
                <td>${UI.escapeHtml(m.numero_doc||'—')}</td>
                <td class="notas-cell" title="${UI.escapeHtml(m.notas||'')}">
                  ${UI.escapeHtml(m.notas||'—')}
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;

    } catch (err) {
      document.getElementById('kard-body').innerHTML = `
        <div class="aux-drawer-empty">
          <div class="aux-drawer-empty-icon">⚠️</div>
          <div>${UI.escapeHtml(err.message)}</div>
        </div>`;
    }
  }

  return { renderDashboardClientes, renderClientes, renderKardexCliente };
})();
