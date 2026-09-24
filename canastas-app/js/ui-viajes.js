/**
 * ui-viajes.js — Renderizado módulo de viajes
 * Control de Canastas PWA v3
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

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  async function renderDashboard() {
    UI.setLoading(true);
    try {
      const [viajes, diferencia] = await Promise.all([
        DB_VIAJES.getViajes(200),
        DB_VIAJES.calcularDiferenciaAcumulada(),
      ]);

      // ── KPI cards (diferencia acumulada) ────────────────────────────────
      const tipos = [
        { key: 'grandes',  label: 'Grandes',  icon: '📦' },
        { key: 'pequenas', label: 'Pequeñas', icon: '📦' },
        { key: 'estibas',  label: 'Estibas',  icon: '🪵' },
      ];
      const colors = ['#0F4C81', '#0E9E5B', '#D08700', '#6B7280'];

      document.getElementById('kpi-row').innerHTML = tipos.map((t, i) => {
        const val = diferencia.diferencia[t.key];
        const cls = val < 0 ? 'value-danger' : val > 0 ? 'value-ok' : 'value-ok';
        return `<div class="metric-card" style="--metric-color:${colors[i]}">
          <div class="m-icon">${t.icon}</div>
          <div class="m-label">${t.label}</div>
          <div class="m-value ${cls}">${val > 0 ? '+' : ''}${val}</div>
          <div class="m-sub">diferencia acumulada</div>
        </div>`;
      }).join('');

      // ── Panel alertas auxiliares ─────────────────────────────────────────
      await _renderAlertasAuxiliares(viajes);

      // ── Viajes sin retorno ────────────────────────────────────────────────
      const abiertos = viajes.filter(v => v.estado === 'abierto');
      document.getElementById('dash-abiertos-count').textContent = abiertos.length;
      const dashAbiertosEl = document.getElementById('dash-viajes-abiertos');
      if (abiertos.length === 0) {
        dashAbiertosEl.innerHTML = '<div class="alert-empty">✅ Sin viajes pendientes</div>';
      } else {
        const [conductores, auxiliares] = await Promise.all([
          DB_VIAJES.getConductores(),
          DB.getAuxiliares(),
        ]);
        const condMap = {}; conductores.forEach(c => { condMap[c.id] = c.nombre; });
        const auxMap  = {}; auxiliares.forEach(a => { auxMap[a.id]  = a.nombre; });

        dashAbiertosEl.innerHTML = abiertos.map(v => {
          const dias = Math.floor((Date.now() - new Date(v.fecha)) / 86400000);
          const sem  = dias === 0 ? 'green' : dias <= 2 ? 'yellow' : 'red';
          const txt  = dias === 0 ? 'Hoy' : dias === 1 ? 'Hace 1 día' : `Hace ${dias} días`;
          return `<div class="viaje-abierto-row" style="cursor:pointer" onclick="APP.verDetalleViaje('${v.id}')">
            <div style="display:flex;align-items:center;gap:.5rem">
              <span class="semaforo semaforo-${sem}" title="${txt}"></span>
              <div>
                <strong style="font-size:.875rem">${UI.escapeHtml(v.placa)}</strong>
                <span class="text-muted text-xs"> · ${v.numero_viaje}</span>
              </div>
            </div>
            <div style="text-align:right">
              <div class="text-xs text-muted">${txt}</div>
              <div class="text-xs text-muted">${abrevNombre(condMap[v.conductor_id] || '')}</div>
            </div>
          </div>`;
        }).join('');
      }

      // ── Diferencia acumulada (banner 4 boxes) ────────────────────────────
      const difEl = document.getElementById('dash-diferencia');
      difEl.innerHTML = tipos.map(t => {
        const val = diferencia.diferencia[t.key];
        const cls = val > 0 ? 'neg' : val < 0 ? 'pos' : '';
        return `<div class="dif-box">
          <div class="dif-box-label">${t.label}</div>
          <div class="dif-box-value ${cls}">${val > 0 ? '+' : ''}${val}</div>
        </div>`;
      }).join('');

      // ── Últimos despachos ─────────────────────────────────────────────────
      const ultimos = viajes.slice(0, 8);
      const dashUltimosEl = document.getElementById('dash-ultimos-viajes');
      if (ultimos.length === 0) {
        dashUltimosEl.innerHTML = '<p class="text-muted text-sm">No hay viajes registrados</p>';
      } else {
        const [conductores2, auxiliares2] = await Promise.all([
          DB_VIAJES.getConductores(),
          DB.getAuxiliares(),
        ]);
        const cMap = {}; conductores2.forEach(c => { cMap[c.id] = c.nombre; });
        const aMap = {}; auxiliares2.forEach(a => { aMap[a.id] = a.nombre; });

        dashUltimosEl.innerHTML = ultimos.map(v => {
          return `<div class="viaje-dash-row">
            <div>
              <div style="font-size:.875rem;font-weight:700">${UI.escapeHtml(v.numero_viaje)} · ${UI.escapeHtml(v.placa)}</div>
              <div class="text-muted text-xs">${abrevNombre(cMap[v.conductor_id] || '')} · ${abrevNombre(aMap[v.auxiliar_id] || '')} · ${formatFecha(v.fecha)}</div>
            </div>
            <span class="badge ${ESTADOS_BADGE[v.estado] || 'badge-gray'}">${ESTADOS_LABEL[v.estado]}</span>
          </div>`;
        }).join('');
      }

      // ── Gráfico semanal ───────────────────────────────────────────────────
      _renderGraficoSemanal(viajes);

    } catch (err) { UI.toast('Error dashboard: ' + err.message, 'error'); }
    UI.setLoading(false);
  }

  // ─── Alertas auxiliares (panel del dashboard) ──────────────────────────────
  async function _renderAlertasAuxiliares(viajes) {
    try {
      const auxiliares = await DB.getAuxiliares(true);
      if (!auxiliares.length) {
        document.getElementById('dash-alertas-aux').innerHTML =
          '<div class="alert-empty">Sin auxiliares activos</div>';
        document.getElementById('dash-alertas-count').textContent = '0';
        document.getElementById('dash-alertas-count').className = 'alert-badge zero';
        return;
      }

      // Para cada auxiliar, calcular diferencia total de sus viajes cerrados
      const alertas = auxiliares.map(aux => {
        const viajesAux = viajes.filter(v => v.auxiliar_id === aux.id);
        const pendientes = viajesAux.filter(v => v.estado === 'abierto');
        const cerrados   = viajesAux.filter(v => v.estado === 'cerrado');

        let difTotal = 0;
        cerrados.forEach(v => {
          difTotal += ((v.ret_grandes  || 0) - v.desp_grandes);
          difTotal += ((v.ret_medianas || 0) - (v.desp_medianas || 0));
          difTotal += ((v.ret_pequenas || 0) - v.desp_pequenas);
          difTotal += ((v.ret_estibas  || 0) - v.desp_estibas);
        });

        // Semáforo: rojo si dif < -20 o tiene pendientes > 2d, amarillo si dif < -5 o pendiente, verde ok
        const maxDias = pendientes.length > 0
          ? Math.max(...pendientes.map(v => Math.floor((Date.now() - new Date(v.fecha)) / 86400000)))
          : 0;

        let nivel = 'ok';
        if (difTotal < -20 || maxDias > 3) nivel = 'crit';
        else if (difTotal < -5 || maxDias > 1 || pendientes.length > 0) nivel = 'warn';

        return { aux, difTotal, pendientes: pendientes.length, cerrados: cerrados.length, maxDias, nivel };
      });

      // Ordenar: críticos primero, luego advertencia, luego ok
      const orden = { crit: 0, warn: 1, ok: 2 };
      alertas.sort((a, b) => orden[a.nivel] - orden[b.nivel] || a.difTotal - b.difTotal);

      const conAlerta = alertas.filter(a => a.nivel !== 'ok');
      const badgeEl = document.getElementById('dash-alertas-count');
      badgeEl.textContent = conAlerta.length;
      badgeEl.className = conAlerta.length > 0 ? 'alert-badge' : 'alert-badge zero';

      const container = document.getElementById('dash-alertas-aux');
      if (alertas.length === 0) {
        container.innerHTML = '<div class="alert-empty">✅ Sin alertas</div>';
        return;
      }

      const dotClass = { crit: 'crit', warn: 'warn', ok: 'ok' };
      container.innerHTML = alertas.slice(0, 8).map(a => {
        const safeName = UI.escapeHtml(a.aux.nombre).replace(/'/g, "\\'");
        const subParts = [];
        if (a.pendientes > 0) subParts.push(`${a.pendientes} viaje${a.pendientes > 1 ? 's' : ''} pendiente${a.pendientes > 1 ? 's' : ''}`);
        if (a.maxDias > 0) subParts.push(`max ${a.maxDias}d sin retorno`);
        if (a.cerrados > 0) subParts.push(`dif acum: ${a.difTotal > 0 ? '+' : ''}${a.difTotal}`);

        const difBadge = a.difTotal > 0
          ? `<span class="badge badge-orange">${a.difTotal > 0 ? '+' : ''}${a.difTotal}</span>`
          : a.difTotal < 0
            ? `<span class="badge badge-red">${a.difTotal}</span>`
            : `<span class="badge badge-green">✓</span>`;

        return `<div class="alert-item" onclick="APP.verHistorialAuxiliar('${a.aux.id}','${safeName}')">
          <div class="alert-item-dot ${dotClass[a.nivel]}"></div>
          <div class="alert-item-body">
            <div class="alert-item-name">${UI.escapeHtml(a.aux.nombre)}</div>
            <div class="alert-item-sub">${subParts.join(' · ') || 'Sin actividad'}</div>
          </div>
          <div class="alert-item-right">${difBadge}</div>
        </div>`;
      }).join('');

    } catch (e) {
      document.getElementById('dash-alertas-aux').innerHTML =
        '<div class="alert-empty">Error al cargar alertas</div>';
    }
  }

  // ─── Gráfico semanal (SVG puro) ────────────────────────────────────────────
  function _renderGraficoSemanal(viajes) {
    const el = document.getElementById('dash-grafico-semanal');
    if (!el) return;

    const semanas = {};
    viajes.forEach(v => {
      const d   = new Date(v.fecha + 'T00:00:00');
      const dow = d.getDay() || 7;
      const lunes = new Date(d); lunes.setDate(d.getDate() - dow + 1);
      const key = lunes.toISOString().split('T')[0];
      if (!semanas[key]) semanas[key] = { desp: 0, ret: 0 };
      semanas[key].desp += (v.desp_grandes||0)+(v.desp_medianas||0)+(v.desp_pequenas||0)+(v.desp_estibas||0);
      if (v.ret_grandes !== null)
        semanas[key].ret += (v.ret_grandes||0)+(v.ret_medianas||0)+(v.ret_pequenas||0)+(v.ret_estibas||0);
    });

    const keys = Object.keys(semanas).sort().slice(-8);
    if (keys.length === 0) {
      el.innerHTML = '<p class="text-muted text-sm">Sin datos para graficar</p>';
      return;
    }

    const maxVal = Math.max(...keys.flatMap(k => [semanas[k].desp, semanas[k].ret]), 1);
    const W = 520, H = 150, PL = 44, PB = 30, PT = 8, PR = 10;
    const cW = W - PL - PR, cH = H - PT - PB;
    const grpW = cW / keys.length;
    const barW = Math.max(6, Math.min(20, grpW * 0.3));

    const yLines = [0, 0.25, 0.5, 0.75, 1].map(f => {
      const y = PT + cH * (1 - f);
      const val = Math.round(maxVal * f);
      return `<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="#E2E8F0" stroke-width="1"/>
              <text x="${PL-5}" y="${y+4}" text-anchor="end" font-size="9" fill="#94A3B8">${val}</text>`;
    }).join('');

    const bars = keys.map((k, i) => {
      const s  = semanas[k];
      const cx = PL + grpW * i + grpW / 2;
      const hD = (s.desp / maxVal) * cH || 0;
      const hR = (s.ret  / maxVal) * cH || 0;
      const label = k.slice(5);
      return `<g>
        <rect x="${cx - barW - 1.5}" y="${PT + cH - hD}" width="${barW}" height="${Math.max(hD, 1)}" fill="#0F4C81" rx="3" opacity=".85"/>
        <rect x="${cx + 1.5}"        y="${PT + cH - hR}" width="${barW}" height="${Math.max(hR, 1)}" fill="#0E9E5B" rx="3" opacity=".85"/>
        <text x="${cx}" y="${H - 6}" text-anchor="middle" font-size="8.5" fill="#94A3B8">${label}</text>
        <title>Semana ${k}: Desp ${s.desp} · Ret ${s.ret}</title>
      </g>`;
    }).join('');

    el.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;max-height:165px;display:block;overflow:visible">
        ${yLines}
        <line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT+cH}" stroke="#CBD5E1" stroke-width="1"/>
        ${bars}
      </svg>
      <div class="chart-legend">
        <span><span class="legend-dot" style="background:#0F4C81"></span>Despachado</span>
        <span><span class="legend-dot" style="background:#0E9E5B"></span>Retornado</span>
      </div>`;
  }

  // ─── Tabla de viajes ────────────────────────────────────────────────────────
  async function renderViajes(filtros = {}) {
    UI.setLoading(true);
    try {
      const [viajes, conductores, auxiliares] = await Promise.all([
        DB_VIAJES.getViajes(500),
        DB_VIAJES.getConductores(),
        DB.getAuxiliares(),
      ]);

      const condMap = {}; conductores.forEach(c => { condMap[c.id] = c.nombre; });
      const auxMap  = {}; auxiliares.forEach(a => { auxMap[a.id]  = a.nombre; });

      // Filtrar
      let filtered = viajes;
      if (filtros.fechaDesde)   filtered = filtered.filter(v => v.fecha >= filtros.fechaDesde);
      if (filtros.fechaHasta)   filtered = filtered.filter(v => v.fecha <= filtros.fechaHasta);
      if (filtros.estado && filtros.estado !== 'todos') filtered = filtered.filter(v => v.estado === filtros.estado);
      if (filtros.conductor_id) filtered = filtered.filter(v => v.conductor_id === filtros.conductor_id);

      // Totales
      let totD = { g:0,p:0,e:0 }, totR = { g:0,p:0,e:0 };
      filtered.forEach(v => {
        totD.g += v.desp_grandes  || 0;
        totD.p += v.desp_pequenas || 0; totD.e += v.desp_estibas  || 0;
        if (v.ret_grandes  !== null) totR.g += v.ret_grandes;
        if (v.ret_pequenas !== null) totR.p += v.ret_pequenas;
        if (v.ret_estibas  !== null) totR.e += v.ret_estibas;
      });
      const totDif = { g: totR.g-totD.g, p: totR.p-totD.p, e: totR.e-totD.e };

      document.getElementById('viajes-totales').innerHTML = `
        <div class="totales-card">
          <div class="totales-label">Total despachado</div>
          <div class="totales-grid">
            <span><strong>${totD.g}</strong> G</span>
            <span><strong>${totD.p}</strong> P</span>
            <span><strong>${totD.e}</strong> E</span>
          </div>
        </div>
        <div class="totales-card">
          <div class="totales-label">Total retornado</div>
          <div class="totales-grid">
            <span><strong>${totR.g}</strong> G</span>
            <span><strong>${totR.p}</strong> P</span>
            <span><strong>${totR.e}</strong> E</span>
          </div>
        </div>
        <div class="totales-card totales-dif">
          <div class="totales-label">Diferencia</div>
          <div class="totales-grid">
            <span class="${totDif.g < 0 ? 'neg' : totDif.g > 0 ? 'pos' : ''}"><strong>${totDif.g > 0 ? '+' : ''}${totDif.g}</strong> G</span>
            <span class="${totDif.p < 0 ? 'neg' : totDif.p > 0 ? 'pos' : ''}"><strong>${totDif.p > 0 ? '+' : ''}${totDif.p}</strong> P</span>
            <span class="${totDif.e < 0 ? 'neg' : totDif.e > 0 ? 'pos' : ''}"><strong>${totDif.e > 0 ? '+' : ''}${totDif.e}</strong> E</span>
          </div>
        </div>`;

      // Tabla
      const tbody = document.getElementById('viajes-tbody');
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="17" class="text-center text-muted" style="padding:2rem">No hay viajes para mostrar</td></tr>';
      } else {
        tbody.innerHTML = filtered.map(v => {
          const difG = v.ret_grandes  !== null ? v.ret_grandes  - v.desp_grandes  : '—';
          const difP = v.ret_pequenas !== null ? v.ret_pequenas - v.desp_pequenas : '—';
          const difE = v.ret_estibas  !== null ? v.ret_estibas  - v.desp_estibas  : '—';
          const hasDif = difG !== '—';

          return `<tr class="viaje-row">
            <td>${formatFecha(v.fecha)}</td>
            <td class="td-num-viaje">${UI.escapeHtml(v.numero_viaje)}</td>
            <td title="${UI.escapeHtml(condMap[v.conductor_id]||'')}">${abrevNombre(condMap[v.conductor_id]||'')}</td>
            <td title="${UI.escapeHtml(auxMap[v.auxiliar_id]||'')}">${abrevNombre(auxMap[v.auxiliar_id]||'')}</td>
            <td>${UI.escapeHtml(v.numero_factura||'—')}</td>
            <td class="td-num">${v.desp_grandes}</td>
            <td class="td-num">${v.desp_pequenas}</td>
            <td class="td-num">${v.desp_estibas}</td>
            <td class="td-num">${v.ret_grandes  !== null ? v.ret_grandes  : '—'}</td>
            <td class="td-num">${v.ret_pequenas !== null ? v.ret_pequenas : '—'}</td>
            <td class="td-num">${v.ret_estibas  !== null ? v.ret_estibas  : '—'}</td>
            <td class="td-num ${hasDif && difG < 0 ? 'td-num-neg' : hasDif && difG > 0 ? 'td-num-pos' : ''}">${hasDif && difG > 0 ? '+' : ''}${difG}</td>
            <td class="td-num ${hasDif && difP < 0 ? 'td-num-neg' : hasDif && difP > 0 ? 'td-num-pos' : ''}">${hasDif && difP > 0 ? '+' : ''}${difP}</td>
            <td class="td-num ${hasDif && difE < 0 ? 'td-num-neg' : hasDif && difE > 0 ? 'td-num-pos' : ''}">${hasDif && difE > 0 ? '+' : ''}${difE}</td>
            <td><span class="badge ${ESTADOS_BADGE[v.estado]||'badge-gray'}">${ESTADOS_LABEL[v.estado]}</span></td>
            <td class="td-acc" style="text-align:center">
              <button class="btn-accion btn-ver" onclick="APP.verDetalleViaje('${v.id}')" title="Ver detalle">👁</button>
              ${v.firma_despacho_url ? `<button class="btn-accion btn-firma-tbl" onclick="APP.verFirmaViaje('${v.firma_despacho_url}','Firma Despacho')" title="Firma despacho">📤🖊</button>` : ''}
              ${v.firma_retorno_url  ? `<button class="btn-accion btn-firma-tbl" onclick="APP.verFirmaViaje('${v.firma_retorno_url}','Firma Retorno')" title="Firma retorno">📥🖊</button>` : ''}
            </td>
          </tr>`;
        }).join('');
      }
    } catch (err) { UI.toast('Error al cargar viajes: ' + err.message, 'error'); }
    UI.setLoading(false);
  }

  // ─── Retornos ───────────────────────────────────────────────────────────────
  async function renderRetornos() {
    UI.setLoading(true);
    try {
      const [abiertos, conductores, auxiliares] = await Promise.all([
        DB_VIAJES.getViajesAbiertos(),
        DB_VIAJES.getConductores(),
        DB.getAuxiliares(),
      ]);
      const condMap = {}; conductores.forEach(c => { condMap[c.id] = c.nombre; });
      const auxMap  = {}; auxiliares.forEach(a => { auxMap[a.id]  = a.nombre; });

      const listEl = document.getElementById('retornos-list');
      if (abiertos.length === 0) {
        listEl.innerHTML = `<div class="empty-state">
          <span class="empty-icon">✅</span>
          <strong>Sin viajes pendientes</strong>
          <p class="text-muted text-sm">Todos los viajes tienen retorno registrado.</p>
        </div>`;
        return;
      }

      listEl.innerHTML = abiertos.map(v => {
        const dias = Math.floor((Date.now() - new Date(v.fecha)) / 86400000);
        const sem  = dias === 0 ? 'green' : dias <= 2 ? 'yellow' : 'red';
        const txt  = dias === 0 ? 'Hoy' : dias === 1 ? 'Hace 1 día' : `Hace ${dias} días`;
        const total = (v.desp_grandes||0)+(v.desp_pequenas||0)+(v.desp_estibas||0);
        return `<div class="card retorno-card" style="margin-bottom:.75rem">
          <div class="retorno-header">
            <div>
              <div class="retorno-ref">
                <span class="semaforo semaforo-${sem}" style="margin-right:.4rem"></span>
                <strong>${UI.escapeHtml(v.numero_viaje)}</strong> · ${UI.escapeHtml(v.placa)}
              </div>
              <div class="text-muted text-sm" style="margin-top:.2rem">
                ${formatFecha(v.fecha)} · ${txt}
              </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="APP.abrirFormularioRetorno('${v.id}')">
              Registrar retorno
            </button>
          </div>
          <div class="retorno-desp">
            <strong>Despachado:</strong>
            ${v.desp_grandes}G · ${v.desp_pequenas}P · ${v.desp_estibas}E
            <span class="text-muted text-xs">(total: ${total})</span>
          </div>
          <div class="retorno-meta text-muted text-sm">
            🧑‍✈️ ${condMap[v.conductor_id]||'—'} · 👷 ${auxMap[v.auxiliar_id]||'—'}
            ${v.numero_factura ? ` · 🧾 ${UI.escapeHtml(v.numero_factura)}` : ''}
          </div>
        </div>`;
      }).join('');
    } catch (err) { UI.toast('Error al cargar retornos: ' + err.message, 'error'); }
    UI.setLoading(false);
  }

  // ─── Conductores ────────────────────────────────────────────────────────────
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
        const safeName = UI.escapeHtml(c.nombre).replace(/'/g, "\\'");
        return `<div class="persona-card ${!c.activo ? 'inactive' : ''}"
          onclick="APP.verHistorialConductor('${c.id}','${safeName}')" style="cursor:pointer">
          <div class="persona-info">
            <div class="persona-nombre">${UI.escapeHtml(c.nombre)}</div>
            <div class="persona-cedula">CC: ${UI.escapeHtml(c.cedula)}</div>
          </div>
          <div class="persona-actions">
            <span class="badge ${c.activo ? 'badge-green' : 'badge-gray'}">${c.activo ? 'Activo' : 'Inactivo'}</span>
            ${c.activo
              ? `<button class="btn btn-sm btn-danger" onclick="event.stopPropagation();APP.toggleConductor('${c.id}',false)">Desactivar</button>`
              : `<button class="btn btn-sm btn-primary" onclick="event.stopPropagation();APP.toggleConductor('${c.id}',true)">Activar</button>`}
          </div>
        </div>`;
      }).join('');
    } catch (err) { UI.toast('Error al cargar conductores: ' + err.message, 'error'); }
    UI.setLoading(false);
  }

  // ─── Configuración ──────────────────────────────────────────────────────────
  async function renderConfiguracion() {
    UI.setLoading(true);
    try {
      const inv = await DB_VIAJES.getInventarioInicial();
      document.getElementById('inv-grandes').value  = inv.grandes  || 0;
      document.getElementById('inv-medianas').value = inv.medianas || 0;
      document.getElementById('inv-pequenas').value = inv.pequenas || 0;
      document.getElementById('inv-estibas').value  = inv.estibas  || 0;
    } catch (err) { console.warn(err); }
    UI.setLoading(false);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function formatFecha(fecha) {
    if (!fecha) return '—';
    const [y, m, d] = fecha.split('-');
    return `${d}/${m}/${y}`;
  }

  function abrevNombre(nombre) {
    if (!nombre) return '—';
    const p = nombre.split(' ');
    if (p.length <= 2) return nombre;
    return p[0] + ' ' + p.slice(1).map(x => x[0] + '.').join(' ');
  }

  return {
    renderDashboard, renderViajes, renderRetornos,
    renderConductores, renderConfiguracion,
  };
})();
