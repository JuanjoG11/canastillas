/**
 * ui-zonas.js — Módulo UI de zonas y carga diaria
 * Control de Canastas PWA v3
 */

const UI_ZONAS = (() => {

  // ─── Dashboard de zonas ───────────────────────────────────────────────────
  async function renderDashboardZonas() {
    UI.setLoading(true);
    try {
      const [stockHoy, zonas] = await Promise.all([
        DB_ZONAS.getStockHoy(),
        DB_ZONAS.getZonas(),
      ]);

      const hoy   = new Date().toISOString().split('T')[0];
      const zona_map = {};
      zonas.forEach(z => { zona_map[z.id] = z; });

      // ── Resumen totales ──────────────────────────────────────────────────
      const totG = stockHoy.reduce((s, r) => s + (r.grandes  || 0), 0);
      const totP = stockHoy.reduce((s, r) => s + (r.pequenas || 0), 0);
      const totT = totG + totP;

      const resumen = document.getElementById('zonas-resumen');
      if (resumen) {
        resumen.innerHTML = `
          <div class="zona-kpi-grid">
            <div class="zona-kpi">
              <div class="zona-kpi-label">Zonas activas hoy</div>
              <div class="zona-kpi-value">${stockHoy.length}</div>
            </div>
            <div class="zona-kpi" style="--kc:var(--brand)">
              <div class="zona-kpi-label">Cubetas Grandes</div>
              <div class="zona-kpi-value">${totG}</div>
            </div>
            <div class="zona-kpi" style="--kc:var(--success)">
              <div class="zona-kpi-label">Cubetas Pequeñas</div>
              <div class="zona-kpi-value">${totP}</div>
            </div>
            <div class="zona-kpi" style="--kc:var(--gray-500)">
              <div class="zona-kpi-label">Total cubetas</div>
              <div class="zona-kpi-value">${totT}</div>
            </div>
          </div>`;
      }

      // ── Tabla de zonas con stock ─────────────────────────────────────────
      const tabla = document.getElementById('zonas-tabla');
      if (!tabla) return;

      if (stockHoy.length === 0) {
        tabla.innerHTML = `
          <div class="zona-empty">
            <div class="zona-empty-icon">📋</div>
            <div class="zona-empty-title">Sin stock cargado hoy</div>
            <div class="zona-empty-sub">Sube el archivo Excel para cargar el stock del día.</div>
            <button class="btn btn-primary btn-lg" style="margin-top:1.25rem"
              onclick="UI_ZONAS.abrirCargaExcel()">
              📂 Cargar Excel ahora
            </button>
          </div>`;
        return;
      }

      tabla.innerHTML = `
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:100px">Zona (batch)</th>
                <th>Nombre</th>
                <th class="th-num" style="width:90px">Grandes</th>
                <th class="th-num" style="width:90px">Pequeñas</th>
                <th class="th-num" style="width:90px">Total</th>
                <th style="width:120px">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${stockHoy.map(s => {
                const z     = zona_map[s.zona_id] || {};
                const total = (s.grandes || 0) + (s.pequenas || 0);
                const nivel = total === 0 ? 'agotado' : total <= 5 ? 'bajo' : 'ok';
                const badge = nivel === 'agotado'
                  ? '<span class="badge badge-red">Agotado</span>'
                  : nivel === 'bajo'
                    ? '<span class="badge badge-orange">Bajo</span>'
                    : '<span class="badge badge-green">Disponible</span>';
                return `<tr class="zona-row ${nivel === 'agotado' ? 'zona-agotada' : ''}"
                    onclick="UI_ZONAS.verDetalleZona('${UI.escapeHtml(s.zona_id)}')">
                  <td><strong style="font-family:monospace">${UI.escapeHtml(s.zona_id)}</strong></td>
                  <td>${UI.escapeHtml(z.nombre || '—')}</td>
                  <td class="td-num">${s.grandes  || 0}</td>
                  <td class="td-num">${s.pequenas || 0}</td>
                  <td class="td-num"><strong>${total}</strong></td>
                  <td>${badge}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;

    } catch (err) { UI.toast('Error al cargar zonas: ' + err.message, 'error'); }
    UI.setLoading(false);
  }

  // ─── Abrir formulario de carga de Excel ───────────────────────────────────
  function abrirCargaExcel() {
    // Obtener el openDrawer de APP
    APP.abrirCargaExcel();
  }

  // ─── Detalle de zona (drawer) ─────────────────────────────────────────────
  async function verDetalleZona(zonaId) {
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
            <div class="aux-drawer-nombre">📍 Zona ${UI.escapeHtml(zonaId)}</div>
            <div class="aux-drawer-cedula" id="zd-sub">Cargando...</div>
          </div>
          <button class="aux-drawer-close" id="zd-close">✕</button>
        </div>
        <div class="aux-drawer-chips" id="zd-chips"></div>
      </div>
      <div class="aux-drawer-body" id="zd-body">
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
    document.getElementById('zd-close').addEventListener('click', close);
    const onKey = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);

    try {
      const [stock, viajes, zonas, conductores, auxiliares] = await Promise.all([
        DB_ZONAS.getStockZonaHoy(zonaId),
        DB_ZONAS.getViajesPorZona(zonaId, 30),
        DB_ZONAS.getZonas(),
        DB_VIAJES.getConductores(),
        DB.getAuxiliares(),
      ]);

      const zona     = zonas.find(z => z.id === zonaId);
      const condMap  = {}; conductores.forEach(c => { condMap[c.id] = c.nombre; });
      const auxMap   = {}; auxiliares.forEach(a => { auxMap[a.id]  = a.nombre; });

      document.getElementById('zd-sub').textContent =
        zona?.nombre ? zona.nombre : 'Sin nombre asignado';

      const total = stock ? (stock.grandes || 0) + (stock.pequenas || 0) : 0;
      document.getElementById('zd-chips').innerHTML =
        (stock
          ? `<span class="aux-chip chip-ok">📦 ${stock.grandes || 0} Grandes</span>
             <span class="aux-chip chip-ok">📦 ${stock.pequenas || 0} Pequeñas</span>`
          : '<span class="aux-chip">Sin stock hoy</span>') +
        `<span class="aux-chip">🚛 ${viajes.length} viaje${viajes.length !== 1 ? 's' : ''}</span>`;

      const bodyEl = document.getElementById('zd-body');

      // Editar nombre de zona
      let html = `
        <div style="margin-bottom:1.25rem">
          <div class="form-group" style="margin-bottom:.5rem">
            <label style="font-size:.8rem;font-weight:700;color:var(--gray-600)">Nombre de la zona</label>
            <div style="display:flex;gap:.5rem">
              <input id="zd-nombre-input" class="form-control" type="text"
                value="${UI.escapeHtml(zona?.nombre || '')}"
                placeholder="Ej: Zona Norte, Bogotá Centro..." />
              <button class="btn btn-primary btn-sm" id="zd-guardar-nombre">Guardar</button>
            </div>
          </div>
        </div>`;

      // Stock del día
      if (stock) {
        html += `
          <div class="zona-stock-box">
            <div class="zona-stock-title">📊 Stock disponible hoy (${stock.fecha})</div>
            <div class="zona-stock-grid">
              <div class="zona-stock-item">
                <span class="zona-stock-label">Grandes</span>
                <span class="zona-stock-val" style="color:var(--brand)">${stock.grandes || 0}</span>
              </div>
              <div class="zona-stock-item">
                <span class="zona-stock-label">Pequeñas</span>
                <span class="zona-stock-val" style="color:var(--success)">${stock.pequenas || 0}</span>
              </div>
              <div class="zona-stock-item" style="border-top:2px solid var(--border);margin-top:.25rem;padding-top:.5rem">
                <span class="zona-stock-label fw-700">Total</span>
                <span class="zona-stock-val" style="color:var(--gray-900)">${total}</span>
              </div>
            </div>
          </div>`;
      } else {
        html += `<div class="field-info" style="margin-bottom:1.25rem">⚠️ Sin stock cargado para hoy en esta zona.</div>`;
      }

      // Historial de viajes de esta zona
      if (viajes.length > 0) {
        html += `<div class="aux-tl-date-label" style="margin-top:.5rem">🚛 Últimos viajes de esta zona</div>
          <div class="aux-timeline">
          ${viajes.map(v => {
            const cond = condMap[v.conductor_id] || '—';
            const aux  = auxMap[v.auxiliar_id]   || '—';
            const icon = v.estado === 'cerrado' ? 't-cerrado' : v.estado === 'anulado' ? 't-anulado' : 't-pendiente';
            const badge = v.estado === 'abierto'
              ? '<span class="tl-status-badge s-pendiente">Pendiente</span>'
              : v.estado === 'cerrado'
                ? '<span class="tl-status-badge s-cerrado">Cerrado</span>'
                : '<span class="tl-status-badge s-anulado">Anulado</span>';
            const total = (v.desp_grandes||0)+(v.desp_medianas||0)+(v.desp_pequenas||0)+(v.desp_estibas||0);
            return `<div class="aux-tl-item">
              <div class="aux-tl-icon ${icon}">${v.estado==='cerrado'?'📦':v.estado==='anulado'?'❌':'🚛'}</div>
              <div class="aux-tl-content">
                <div class="aux-tl-tipo">${UI.escapeHtml(v.numero_viaje)} ${badge}</div>
                <div class="aux-tl-ref">📤 ${total} cubetas · 👷 ${UI.escapeHtml(aux)}</div>
                <div class="aux-tl-meta"><span>📅 ${v.fecha}</span><span>🧑‍✈️ ${UI.escapeHtml(cond)}</span></div>
              </div>
            </div>`;
          }).join('')}
          </div>`;
      } else {
        html += `<div class="aux-drawer-empty" style="padding:2rem 0">
          <div class="aux-drawer-empty-icon">📭</div>
          <div>Sin viajes registrados para esta zona</div>
        </div>`;
      }

      bodyEl.innerHTML = html;

      // Binding guardar nombre
      document.getElementById('zd-guardar-nombre')?.addEventListener('click', async () => {
        const nombre = document.getElementById('zd-nombre-input').value.trim();
        if (!nombre) return;
        try {
          await DB_ZONAS.updateZonaNombre(zonaId, nombre);
          UI.toast(`Zona ${zonaId} actualizada`, 'success');
          document.getElementById('zd-sub').textContent = nombre;
        } catch (e) { UI.toast(e.message, 'error'); }
      });

    } catch (err) {
      document.getElementById('zd-body').innerHTML = `
        <div class="aux-drawer-empty">
          <div class="aux-drawer-empty-icon">⚠️</div>
          <div>${UI.escapeHtml(err.message)}</div>
        </div>`;
    }
  }

  return { renderDashboardZonas, abrirCargaExcel, verDetalleZona };
})();
