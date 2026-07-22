/**
 * ui-viajes.js - UI del módulo de viajes (Excel-like)
 * Control de Canastas PWA 2.0
 */

const UI_VIAJES = (() => {

  const ESTADOS_BADGE = {
    abierto: 'badge-orange',
    cerrado: 'badge-green',
    anulado: 'badge-gray',
  };

  const ESTADOS_LABEL = {
    abierto: 'Pendiente',
    cerrado: 'Cerrado',
    anulado: 'Anulado',
  };

  // ─── Dashboard ────────────────────────────────────────────────────────────
  async function renderDashboard() {
    UI.setLoading(true);
    try {
      const [viajes, diferencia] = await Promise.all([
        DB_VIAJES.getViajes(100),
        DB_VIAJES.calcularDiferenciaAcumulada(),
      ]);

      // KPI cards por tipo
      const kpiHtml = `
        <div class="kpi-card kpi-grandes">
          <div class="kpi-label">Grandes</div>
          <div class="kpi-value">${diferencia.diferencia.grandes}</div>
          <div class="kpi-sub">diferencia</div>
        </div>
        <div class="kpi-card kpi-medianas">
          <div class="kpi-label">Medianas</div>
          <div class="kpi-value">${diferencia.diferencia.medianas}</div>
          <div class="kpi-sub">diferencia</div>
        </div>
        <div class="kpi-card kpi-pequenas">
          <div class="kpi-label">Pequeñas</div>
          <div class="kpi-value">${diferencia.diferencia.pequenas}</div>
          <div class="kpi-sub">diferencia</div>
        </div>
        <div class="kpi-card kpi-estibas">
          <div class="kpi-label">Estibas</div>
          <div class="kpi-value">${diferencia.diferencia.estibas}</div>
          <div class="kpi-sub">diferencia</div>
        </div>`;
      document.getElementById('kpi-row').innerHTML = kpiHtml;

      // Viajes abiertos (sin retorno) con semáforo
      const abiertos = viajes.filter(v => v.estado === 'abierto');
      document.getElementById('dash-abiertos-count').textContent = abiertos.length;
      const dashAbiertosEl = document.getElementById('dash-viajes-abiertos');
      if (abiertos.length === 0) {
        dashAbiertosEl.innerHTML = '<p class="text-muted small">✅ Sin viajes pendientes</p>';
      } else {
        dashAbiertosEl.innerHTML = abiertos.map(v => {
          const dias = Math.floor((Date.now() - new Date(v.fecha)) / 86400000);
          const sem  = dias === 0 ? 'green' : dias <= 2 ? 'yellow' : 'red';
          const txt  = dias === 0 ? 'Hoy' : dias === 1 ? 'Hace 1 día' : `Hace ${dias} días`;
          return `<div class="viaje-abierto-row">
            <div style="display:flex;align-items:center;gap:.5rem">
              <span class="semaforo semaforo-${sem}" title="${txt}"></span>
              <div>
                <strong>${UI.escapeHtml(v.placa)}</strong> · <span class="text-muted" style="font-size:.8rem">${v.numero_viaje}</span>
              </div>
            </div>
            <div class="text-muted small" style="white-space:nowrap">${txt}</div>
          </div>`;
        }).join('');
      }

      // Diferencia acumulada
      const dashDifEl = document.getElementById('dash-diferencia');
      dashDifEl.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-top:.5rem">
          <div class="dif-item">
            <span class="dif-label">Grandes:</span>
            <span class="dif-val ${diferencia.diferencia.grandes < 0 ? 'neg' : ''}">${diferencia.diferencia.grandes}</span>
          </div>
          <div class="dif-item">
            <span class="dif-label">Medianas:</span>
            <span class="dif-val ${diferencia.diferencia.medianas < 0 ? 'neg' : ''}">${diferencia.diferencia.medianas}</span>
          </div>
          <div class="dif-item">
            <span class="dif-label">Pequeñas:</span>
            <span class="dif-val ${diferencia.diferencia.pequenas < 0 ? 'neg' : ''}">${diferencia.diferencia.pequenas}</span>
          </div>
          <div class="dif-item">
            <span class="dif-label">Estibas:</span>
            <span class="dif-val ${diferencia.diferencia.estibas < 0 ? 'neg' : ''}">${diferencia.diferencia.estibas}</span>
          </div>
        </div>`;

      // Últimos 8 viajes
      const ultimos = viajes.slice(0, 8);
      const dashUltimosEl = document.getElementById('dash-ultimos-viajes');
      if (ultimos.length === 0) {
        dashUltimosEl.innerHTML = '<p class="text-muted small">No hay viajes registrados</p>';
      } else {
        const [conductores, auxiliares] = await Promise.all([
          DB_VIAJES.getConductores(),
          DB.getAuxiliares(),
        ]);
        const condMap = {};
        conductores.forEach(c => { condMap[c.id] = c.nombre; });
        const auxMap = {};
        auxiliares.forEach(a => { auxMap[a.id] = a.nombre; });

        dashUltimosEl.innerHTML = ultimos.map(v => {
          const estadoBadge = `<span class="badge ${ESTADOS_BADGE[v.estado] || 'badge-gray'}">${ESTADOS_LABEL[v.estado]}</span>`;
          return `<div class="viaje-dash-row">
            <div class="viaje-dash-left">
              <div><strong>${UI.escapeHtml(v.numero_viaje)}</strong> · ${UI.escapeHtml(v.placa)}</div>
              <div class="text-muted small">${condMap[v.conductor_id] || ''} · ${auxMap[v.auxiliar_id] || ''}</div>
            </div>
            <div>${estadoBadge}</div>
          </div>`;
        }).join('');
      }
      // Gráfico semanal: últimas 6 semanas
      _renderGraficoSemanal(viajes);

    } catch (err) { UI.toast('Error al cargar dashboard: ' + err.message, 'error'); }
    UI.setLoading(false);
  }

  // ─── Gráfico semanal (SVG puro) ───────────────────────────────────────────
  function _renderGraficoSemanal(viajes) {
    const el = document.getElementById('dash-grafico-semanal');
    if (!el) return;

    // Agrupar por semana (lunes)
    const semanas = {};
    viajes.forEach(v => {
      const d = new Date(v.fecha + 'T00:00:00');
      const dow = d.getDay() || 7; // 1=lun 7=dom
      const lunes = new Date(d); lunes.setDate(d.getDate() - dow + 1);
      const key = lunes.toISOString().split('T')[0];
      if (!semanas[key]) semanas[key] = { desp: 0, ret: 0, pendientes: 0 };
      const tot = (v.desp_grandes||0)+(v.desp_medianas||0)+(v.desp_pequenas||0)+(v.desp_estibas||0);
      semanas[key].desp += tot;
      if (v.ret_grandes !== null) {
        const totR = (v.ret_grandes||0)+(v.ret_medianas||0)+(v.ret_pequenas||0)+(v.ret_estibas||0);
        semanas[key].ret += totR;
      } else {
        semanas[key].pendientes++;
      }
    });

    const keys = Object.keys(semanas).sort().slice(-6);
    if (keys.length === 0) { el.innerHTML = '<p class="text-muted small">Sin datos para graficar</p>'; return; }

    const maxVal = Math.max(...keys.map(k => semanas[k].desp), 1);
    const W = 100 / keys.length;
    const BAR_H = 80;

    const bars = keys.map((k, i) => {
      const s = semanas[k];
      const hD = (s.desp / maxVal) * BAR_H;
      const hR = (s.ret  / maxVal) * BAR_H;
      const x  = i * W + W * 0.1;
      const bw = W * 0.38;
      const label = k.slice(5); // MM-DD
      return `
        <rect x="${x}%" y="${BAR_H - hD}%" width="${bw}%" height="${hD}%" fill="#2563EB" rx="2" opacity=".85">
          <title>Desp: ${s.desp}</title>
        </rect>
        <rect x="${x + W*0.42}%" y="${BAR_H - hR}%" width="${bw}%" height="${hR}%" fill="#16A34A" rx="2" opacity=".85">
          <title>Ret: ${s.ret}</title>
        </rect>
        <text x="${x + W*0.4}%" y="98%" text-anchor="middle" font-size="7" fill="#6B7280">${label}</text>`;
    }).join('');

    el.innerHTML = `
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:120px;display:block">
        ${bars}
      </svg>
      <div style="display:flex;gap:1rem;margin-top:.375rem;font-size:.72rem;color:var(--gray-500)">
        <span><span style="display:inline-block;width:10px;height:10px;background:#2563EB;border-radius:2px;margin-right:3px"></span>Despachado</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#16A34A;border-radius:2px;margin-right:3px"></span>Retornado</span>
      </div>`;
  }

  // ─── Viajes tabla ─────────────────────────────────────────────────────────
  let _viajesFiltros = {};

  async function renderViajes(filtros = {}) {
    _viajesFiltros = filtros;
    UI.setLoading(true);
    try {
      const [viajes, conductores, auxiliares] = await Promise.all([
        DB_VIAJES.getViajes(500),
        DB_VIAJES.getConductores(),
        DB.getAuxiliares(),
      ]);

      const condMap = {};
      conductores.forEach(c => { condMap[c.id] = c.nombre; });
      const auxMap = {};
      auxiliares.forEach(a => { auxMap[a.id] = a.nombre; });

      // Filtrar
      let filtered = viajes;
      if (filtros.fechaDesde)   filtered = filtered.filter(v => v.fecha >= filtros.fechaDesde);
      if (filtros.fechaHasta)   filtered = filtered.filter(v => v.fecha <= filtros.fechaHasta);
      if (filtros.estado && filtros.estado !== 'todos') filtered = filtered.filter(v => v.estado === filtros.estado);
      if (filtros.conductor_id) filtered = filtered.filter(v => v.conductor_id === filtros.conductor_id);

      // Calcular totales
      let totDesp = { grandes: 0, medianas: 0, pequenas: 0, estibas: 0 };
      let totRet  = { grandes: 0, medianas: 0, pequenas: 0, estibas: 0 };
      let totDif  = { grandes: 0, medianas: 0, pequenas: 0, estibas: 0 };

      filtered.forEach(v => {
        totDesp.grandes  += v.desp_grandes || 0;
        totDesp.medianas += v.desp_medianas || 0;
        totDesp.pequenas += v.desp_pequenas || 0;
        totDesp.estibas  += v.desp_estibas || 0;

        if (v.ret_grandes !== null)  totRet.grandes  += v.ret_grandes;
        if (v.ret_medianas !== null) totRet.medianas += v.ret_medianas;
        if (v.ret_pequenas !== null) totRet.pequenas += v.ret_pequenas;
        if (v.ret_estibas !== null)  totRet.estibas  += v.ret_estibas;
      });

      totDif.grandes  = totDesp.grandes  - totRet.grandes;
      totDif.medianas = totDesp.medianas - totRet.medianas;
      totDif.pequenas = totDesp.pequenas - totRet.pequenas;
      totDif.estibas  = totDesp.estibas  - totRet.estibas;

      // Render totales
      document.getElementById('viajes-totales').innerHTML = `
        <div class="totales-card">
          <div class="totales-label">Total despachado</div>
          <div class="totales-grid">
            <span><strong>${totDesp.grandes}</strong> G</span>
            <span><strong>${totDesp.medianas}</strong> M</span>
            <span><strong>${totDesp.pequenas}</strong> P</span>
            <span><strong>${totDesp.estibas}</strong> E</span>
          </div>
        </div>
        <div class="totales-card">
          <div class="totales-label">Total retornado</div>
          <div class="totales-grid">
            <span><strong>${totRet.grandes}</strong> G</span>
            <span><strong>${totRet.medianas}</strong> M</span>
            <span><strong>${totRet.pequenas}</strong> P</span>
            <span><strong>${totRet.estibas}</strong> E</span>
          </div>
        </div>
        <div class="totales-card totales-dif">
          <div class="totales-label">Diferencia</div>
          <div class="totales-grid">
            <span class="${totDif.grandes < 0 ? 'neg' : ''}"><strong>${totDif.grandes}</strong> G</span>
            <span class="${totDif.medianas < 0 ? 'neg' : ''}"><strong>${totDif.medianas}</strong> M</span>
            <span class="${totDif.pequenas < 0 ? 'neg' : ''}"><strong>${totDif.pequenas}</strong> P</span>
            <span class="${totDif.estibas < 0 ? 'neg' : ''}"><strong>${totDif.estibas}</strong> E</span>
          </div>
        </div>`;

      // Render tabla
      const tbody = document.getElementById('viajes-tbody');
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="21" class="text-center text-muted">No hay viajes para mostrar</td></tr>';
      } else {
        tbody.innerHTML = filtered.map(v => {
          const difG = (v.ret_grandes !== null) ? (v.desp_grandes - v.ret_grandes) : '—';
          const difM = (v.ret_medianas !== null) ? (v.desp_medianas - v.ret_medianas) : '—';
          const difP = (v.ret_pequenas !== null) ? (v.desp_pequenas - v.ret_pequenas) : '—';
          const difE = (v.ret_estibas !== null) ? (v.desp_estibas - v.ret_estibas) : '—';

          const estadoBadge = `<span class="badge ${ESTADOS_BADGE[v.estado] || 'badge-gray'}">${ESTADOS_LABEL[v.estado]}</span>`;

          return `<tr class="viaje-row">
            <td>${formatFecha(v.fecha)}</td>
            <td class="td-num-viaje">${UI.escapeHtml(v.numero_viaje)}</td>
            <td title="${UI.escapeHtml(condMap[v.conductor_id] || '')}">${abrevNombre(condMap[v.conductor_id] || '')}</td>
            <td title="${UI.escapeHtml(auxMap[v.auxiliar_id] || '')}">${abrevNombre(auxMap[v.auxiliar_id] || '')}</td>
            <td>${UI.escapeHtml(v.placa)}</td>
            <td>${UI.escapeHtml(v.remolque || '—')}</td>
            <td>${UI.escapeHtml(v.numero_factura || '—')}</td>
            <td class="td-num">${v.desp_grandes}</td>
            <td class="td-num">${v.desp_medianas}</td>
            <td class="td-num">${v.desp_pequenas}</td>
            <td class="td-num">${v.desp_estibas}</td>
            <td class="td-num">${v.ret_grandes !== null ? v.ret_grandes : '—'}</td>
            <td class="td-num">${v.ret_medianas !== null ? v.ret_medianas : '—'}</td>
            <td class="td-num">${v.ret_pequenas !== null ? v.ret_pequenas : '—'}</td>
            <td class="td-num">${v.ret_estibas !== null ? v.ret_estibas : '—'}</td>
            <td class="td-num ${difG < 0 ? 'td-num-neg' : ''}">${difG}</td>
            <td class="td-num ${difM < 0 ? 'td-num-neg' : ''}">${difM}</td>
            <td class="td-num ${difP < 0 ? 'td-num-neg' : ''}">${difP}</td>
            <td class="td-num ${difE < 0 ? 'td-num-neg' : ''}">${difE}</td>
            <td>${estadoBadge}</td>
            <td class="td-acc">
              <button class="btn-accion btn-ver" onclick="APP.verDetalleViaje('${v.id}')" title="Ver detalle">👁️</button>
              ${v.firma_despacho_url ? `<button class="btn-accion btn-firma-tbl" onclick="APP.verFirmaViaje('${v.firma_despacho_url}','Firma Despacho')" title="Ver firma despacho">📤🖊️</button>` : ''}
              ${v.firma_retorno_url  ? `<button class="btn-accion btn-firma-tbl" onclick="APP.verFirmaViaje('${v.firma_retorno_url}','Firma Retorno')" title="Ver firma retorno">📥🖊️</button>` : ''}
            </td>
          </tr>`;
        }).join('');
      }
    } catch (err) { UI.toast('Error al cargar viajes: ' + err.message, 'error'); }
    UI.setLoading(false);
  }

  // ─── Retornos ─────────────────────────────────────────────────────────────
  async function renderRetornos() {
    UI.setLoading(true);
    try {
      const [abiertos, conductores, auxiliares] = await Promise.all([
        DB_VIAJES.getViajesAbiertos(),
        DB_VIAJES.getConductores(),
        DB.getAuxiliares(),
      ]);

      const condMap = {};
      conductores.forEach(c => { condMap[c.id] = c.nombre; });
      const auxMap = {};
      auxiliares.forEach(a => { auxMap[a.id] = a.nombre; });

      const listEl = document.getElementById('retornos-list');
      if (abiertos.length === 0) {
        listEl.innerHTML = '<p class="text-muted">No hay viajes pendientes de retorno</p>';
        return;
      }

      listEl.innerHTML = abiertos.map(v => {
        const dias = Math.floor((Date.now() - new Date(v.fecha)) / 86400000);
        return `<div class="card retorno-card">
          <div class="retorno-header">
            <div>
              <div class="retorno-ref"><strong>${UI.escapeHtml(v.numero_viaje)}</strong> · ${UI.escapeHtml(v.placa)}</div>
              <div class="text-muted small">${formatFecha(v.fecha)} · Hace ${dias} día${dias !== 1 ? 's' : ''}</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="APP.abrirFormularioRetorno('${v.id}')">Registrar retorno</button>
          </div>
          <div class="retorno-desp">
            <strong>Despachado:</strong> ${v.desp_grandes} G · ${v.desp_medianas} M · ${v.desp_pequenas} P · ${v.desp_estibas} E
          </div>
          <div class="retorno-meta text-muted small">
            Conductor: ${condMap[v.conductor_id] || '—'} · Auxiliar: ${auxMap[v.auxiliar_id] || '—'}
          </div>
        </div>`;
      }).join('');
    } catch (err) { UI.toast('Error al cargar retornos: ' + err.message, 'error'); }
    UI.setLoading(false);
  }

  // ─── Conductores ──────────────────────────────────────────────────────────
  async function renderConductores() {
    UI.setLoading(true);
    try {
      const conductores = await DB_VIAJES.getConductores();
      const listEl = document.getElementById('conductores-list');
      if (conductores.length === 0) {
        listEl.innerHTML = '<p class="text-muted">No hay conductores registrados</p>';
        return;
      }

      listEl.innerHTML = conductores.map(c => {
        const statusClass = c.activo ? 'badge-green' : 'badge-gray';
        const statusLabel = c.activo ? 'Activo' : 'Inactivo';
        const safeName = UI.escapeHtml(c.nombre).replace(/'/g, "\\'");
        return `<div class="persona-card ${!c.activo ? 'inactive' : ''}"
          onclick="APP.verHistorialConductor('${c.id}','${safeName}')"
          style="cursor:pointer" title="Ver viajes">
          <div class="persona-info">
            <div class="persona-nombre">${UI.escapeHtml(c.nombre)}</div>
            <div class="persona-cedula">CC: ${UI.escapeHtml(c.cedula)}</div>
          </div>
          <div class="persona-actions">
            <span class="badge ${statusClass}">${statusLabel}</span>
            ${c.activo
              ? `<button class="btn btn-sm btn-danger" onclick="event.stopPropagation();APP.toggleConductor('${c.id}', false)">Desactivar</button>`
              : `<button class="btn btn-sm btn-primary" onclick="event.stopPropagation();APP.toggleConductor('${c.id}', true)">Activar</button>`
            }
          </div>
        </div>`;
      }).join('');
    } catch (err) { UI.toast('Error al cargar conductores: ' + err.message, 'error'); }
    UI.setLoading(false);
  }

  // ─── Configuración ────────────────────────────────────────────────────────
  async function renderConfiguracion() {
    UI.setLoading(true);
    try {
      const inv = await DB_VIAJES.getInventarioInicial();
      document.getElementById('inv-grandes').value  = inv.grandes;
      document.getElementById('inv-medianas').value = inv.medianas;
      document.getElementById('inv-pequenas').value = inv.pequenas;
      document.getElementById('inv-estibas').value  = inv.estibas;
    } catch (err) { console.warn(err); }
    UI.setLoading(false);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function formatFecha(fecha) {
    if (!fecha) return '—';
    const d = new Date(fecha);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  }

  function abrevNombre(nombre) {
    if (!nombre) return '—';
    const partes = nombre.split(' ');
    if (partes.length <= 2) return nombre;
    return partes[0] + ' ' + partes.slice(1).map(p => p[0] + '.').join(' ');
  }

  return {
    renderDashboard, renderViajes, renderRetornos,
    renderConductores, renderConfiguracion,
  };
})();
