/**
 * ui.js — Helpers de UI compartidos
 * Control de Canastas PWA v3
 */

const UI = (() => {

  // ─── Toast ─────────────────────────────────────────────────────────────────
  function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span class="toast-message">${escapeHtml(message)}</span>`;
    container.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast-show'));
    setTimeout(() => {
      t.classList.remove('toast-show');
      t.addEventListener('transitionend', () => t.remove(), { once: true });
    }, 3500);
  }

  // ─── Modal ─────────────────────────────────────────────────────────────────
  function showModal({ title, body, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', onConfirm, danger = false }) {
    const overlay  = document.getElementById('modal-overlay');
    const titleEl  = document.getElementById('modal-title');
    const bodyEl   = document.getElementById('modal-body');
    const confirmEl = document.getElementById('modal-confirm');
    const cancelEl  = document.getElementById('modal-cancel');

    titleEl.textContent   = title;
    bodyEl.innerHTML      = body;
    confirmEl.textContent = confirmLabel;
    cancelEl.textContent  = cancelLabel;
    confirmEl.className   = danger ? 'btn btn-danger' : 'btn btn-primary';
    cancelEl.style.display = cancelLabel ? '' : 'none';
    overlay.classList.remove('hidden');

    const close = () => overlay.classList.add('hidden');
    const handleConfirm = () => {
      close();
      if (onConfirm) onConfirm();
      confirmEl.removeEventListener('click', handleConfirm);
      cancelEl.removeEventListener('click', close);
    };
    confirmEl.addEventListener('click', handleConfirm);
    cancelEl.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); }, { once: true });
  }

  function closeModal() {
    document.getElementById('modal-overlay')?.classList.add('hidden');
  }

  // ─── Spinner / Sección ─────────────────────────────────────────────────────
  function setLoading(show) {
    document.getElementById('global-spinner')?.classList.toggle('hidden', !show);
  }

  function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`section-${sectionId}`)?.classList.add('active');
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.classList.toggle('active', el.dataset.nav === sectionId);
    });
    // Scroll al inicio al cambiar de sección
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─── Auxiliares: lista con tarjetas de alerta ──────────────────────────────
  async function renderAuxiliares() {
    UI.setLoading(true);
    try {
      const [auxiliares, viajes] = await Promise.all([
        DB.getAuxiliares(),
        DB_VIAJES.getViajes(500),
      ]);

      const listEl = document.getElementById('auxiliares-list');
      const resumenEl = document.getElementById('aux-alertas-resumen');

      if (auxiliares.length === 0) {
        listEl.innerHTML = '<p class="text-muted">No hay auxiliares registrados</p>';
        if (resumenEl) resumenEl.innerHTML = '';
        return;
      }

      // Calcular métricas por auxiliar
      const metricas = auxiliares.map(aux => {
        const vAux      = viajes.filter(v => v.auxiliar_id === aux.id);
        const pendientes = vAux.filter(v => v.estado === 'abierto');
        const cerrados   = vAux.filter(v => v.estado === 'cerrado');

        // Diferencia total acumulada (cerrados): Retorno - Despacho
        let difTotal = 0;
        cerrados.forEach(v => {
          difTotal += ((v.ret_grandes  || 0) - v.desp_grandes);
          difTotal += ((v.ret_medianas || 0) - (v.desp_medianas || 0));
          difTotal += ((v.ret_pequenas || 0) - v.desp_pequenas);
          difTotal += ((v.ret_estibas  || 0) - v.desp_estibas);
        });

        // Días sin retorno del viaje pendiente más antiguo
        const maxDias = pendientes.length > 0
          ? Math.max(...pendientes.map(v => Math.floor((Date.now() - new Date(v.fecha)) / 86400000)))
          : 0;

        // Nivel de alerta: negativo significa faltante de canastas
        let nivel = 'ok';
        if (difTotal < -20 || maxDias > 3) nivel = 'crit';
        else if (difTotal < -5 || maxDias > 1 || pendientes.length > 0) nivel = 'warn';

        return { aux, difTotal, pendientes: pendientes.length, cerrados: cerrados.length,
                 totalViajes: vAux.length, maxDias, nivel, ultimoViaje };
      });

      // Ordenar: crit → warn → ok, luego por mayor faltante
      const orden = { crit: 0, warn: 1, ok: 2 };
      metricas.sort((a, b) => orden[a.nivel] - orden[b.nivel] || a.difTotal - b.difTotal);

      // ── Resumen de alertas ───────────────────────────────────────────────
      const nCrit = metricas.filter(m => m.nivel === 'crit').length;
      const nWarn = metricas.filter(m => m.nivel === 'warn').length;
      if (resumenEl) {
        if (nCrit === 0 && nWarn === 0) {
          resumenEl.innerHTML = `
            <div style="display:inline-flex;align-items:center;gap:.5rem;background:var(--success-light);
              color:var(--success);border-radius:var(--radius-sm);padding:.5rem 1rem;
              font-size:.875rem;font-weight:600;border:1px solid #BBF7D0;margin-bottom:.5rem">
              ✅ Todos los auxiliares al día — sin diferencias pendientes
            </div>`;
        } else {
          resumenEl.innerHTML = `
            <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:.75rem;align-items:center">
              <span style="font-size:.875rem;font-weight:600;color:var(--gray-700)">Estado del equipo:</span>
              ${nCrit > 0 ? `<span class="badge badge-red">🔴 ${nCrit} crítico${nCrit>1?'s':''}</span>` : ''}
              ${nWarn > 0 ? `<span class="badge badge-orange">🟡 ${nWarn} con alerta</span>` : ''}
              <span class="badge badge-green">🟢 ${metricas.filter(m=>m.nivel==='ok').length} ok</span>
            </div>`;
        }
      }

      // ── Tarjetas ─────────────────────────────────────────────────────────
      const stripeClass = { ok: 's-ok', warn: 's-warn', crit: 's-crit', gray: 's-gray' };
      const statClass   = { ok: 'stat-ok', warn: 'stat-warn', crit: 'stat-crit' };

      listEl.innerHTML = metricas.map(m => {
        const a = m.aux;
        const safeName = escapeHtml(a.nombre).replace(/'/g, "\\'");
        const stripe   = a.activo ? stripeClass[m.nivel] : 's-gray';

        // Stat principal: diferencia
        let statHtml = '';
        if (!a.activo) {
          statHtml = `<span class="aux-card-stat no-viajes">Inactivo</span>`;
        } else if (m.totalViajes === 0) {
          statHtml = `<span class="aux-card-stat no-viajes">Sin viajes</span>`;
        } else {
          const dc = m.nivel === 'ok' ? 'stat-ok' : m.nivel === 'warn' ? 'stat-warn' : 'stat-crit';
          statHtml = `<span class="aux-card-stat ${dc}">
            ${m.difTotal > 0 ? '+' : ''}${m.difTotal} dif
          </span>`;
        }

        // Sub-info
        const subParts = [];
        if (m.pendientes > 0) subParts.push(`⏳ ${m.pendientes} pendiente${m.pendientes>1?'s':''}`);
        if (m.maxDias > 0)    subParts.push(`${m.maxDias}d sin retorno`);
        if (m.cerrados > 0)   subParts.push(`${m.cerrados} cerrado${m.cerrados>1?'s':''}`);

        return `<div class="aux-card ${!a.activo?'inactive':''} ${m.nivel==='crit'?'alert-crit':m.nivel==='warn'?'alert-warn':''}"
          onclick="APP.verHistorialAuxiliar('${a.id}','${safeName}')">
          <div class="aux-card-stripe ${stripe}"></div>
          <div class="aux-card-body">
            <div class="aux-card-top">
              <div>
                <div class="aux-card-nombre">${escapeHtml(a.nombre)}</div>
                <div class="aux-card-cedula">CC: ${escapeHtml(a.cedula)}</div>
              </div>
              ${statHtml}
            </div>
            ${subParts.length > 0 ? `<div class="text-xs text-muted" style="margin-top:.2rem">${subParts.join(' · ')}</div>` : ''}
          </div>
          <div class="aux-card-footer">
            <span class="aux-footer-hint">Ver historial →</span>
            <div class="aux-footer-actions" onclick="event.stopPropagation()">
              ${a.activo
                ? `<button class="btn btn-xs btn-danger" onclick="APP.toggleAuxiliar('${a.id}',false)">Desactivar</button>`
                : `<button class="btn btn-xs btn-primary" onclick="APP.toggleAuxiliar('${a.id}',true)">Activar</button>`}
            </div>
          </div>
        </div>`;
      }).join('');

    } catch (err) { UI.toast('Error al cargar auxiliares: ' + err.message, 'error'); }
    UI.setLoading(false);
  }

  // ─── Historial auxiliar (drawer lateral) ───────────────────────────────────
  async function showHistorialAuxiliar(auxId, auxNombre) {
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
            <div class="aux-drawer-nombre">👷 ${escapeHtml(auxNombre)}</div>
            <div class="aux-drawer-cedula" id="aux-d-cedula">Cargando...</div>
          </div>
          <button class="aux-drawer-close" id="aux-d-close">✕</button>
        </div>
        <div class="aux-drawer-chips" id="aux-d-chips">
          <span class="aux-chip">⏳ Cargando...</span>
        </div>
      </div>
      <div class="aux-drawer-body" id="aux-d-body">
        <div class="aux-drawer-empty">
          <div class="aux-drawer-empty-icon">⏳</div>
          <div>Cargando historial...</div>
        </div>
      </div>`;

    overlay.appendChild(drawer);
    document.body.appendChild(overlay);

    const close = () => {
      overlay.style.animation = 'fadeIn .15s ease reverse';
      drawer.style.animation  = 'drawerIn .18s ease reverse';
      setTimeout(() => overlay.remove(), 170);
    };
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.getElementById('aux-d-close').addEventListener('click', close);
    const onKey = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);

    try {
      const [movs, viajesAux, aux] = await Promise.all([
        DB.getMovimientosPorAuxiliar ? DB.getMovimientosPorAuxiliar(auxId) : Promise.resolve([]),
        DB_VIAJES.getViajesPorAuxiliar(auxId),
        DB.getAuxiliarById(auxId),
      ]);

      document.getElementById('aux-d-cedula').textContent = aux ? `CC: ${aux.cedula}` : '';

      // ── Calcular métricas ─────────────────────────────────────────────
      const cerrados  = viajesAux.filter(v => v.estado === 'cerrado');
      const pendientes = viajesAux.filter(v => v.estado === 'abierto');

      let difG = 0, difM = 0, difP = 0, difE = 0;
      cerrados.forEach(v => {
        difG += ((v.ret_grandes  || 0) - v.desp_grandes);
        difM += ((v.ret_medianas || 0) - (v.desp_medianas || 0));
        difP += ((v.ret_pequenas || 0) - v.desp_pequenas);
        difE += ((v.ret_estibas  || 0) - v.desp_estibas);
      });
      const difTotal = difG + difM + difP + difE;

      const maxDias = pendientes.length > 0
        ? Math.max(...pendientes.map(v => Math.floor((Date.now() - new Date(v.fecha)) / 86400000)))
        : 0;

      let nivel = 'ok';
      if (difTotal < -20 || maxDias > 3) nivel = 'crit';
      else if (difTotal < -5 || maxDias > 1 || pendientes.length > 0) nivel = 'warn';

      const chipColor = nivel === 'crit' ? 'chip-alert' : nivel === 'warn' ? 'chip-warn' : 'chip-ok';
      const nivelLabel = nivel === 'crit' ? '🔴 Crítico' : nivel === 'warn' ? '🟡 Alerta' : '🟢 Ok';

      // ── Chips del header ─────────────────────────────────────────────
      document.getElementById('aux-d-chips').innerHTML =
        `<span class="aux-chip ${chipColor}">${nivelLabel}</span>` +
        (aux?.activo ? '<span class="aux-chip">✅ Activo</span>' : '<span class="aux-chip">⛔ Inactivo</span>') +
        `<span class="aux-chip">📋 ${viajesAux.length} viaje${viajesAux.length !== 1 ? 's' : ''}</span>` +
        (pendientes.length > 0 ? `<span class="aux-chip chip-warn">⏳ ${pendientes.length} pendiente${pendientes.length>1?'s':''}</span>` : '') +
        `<span class="aux-chip ${difTotal < 0 ? 'chip-alert' : 'chip-ok'}">Dif total: ${difTotal > 0 ? '+' : ''}${difTotal}</span>`;

      const bodyEl = document.getElementById('aux-d-body');

      // ── Stats bar ────────────────────────────────────────────────────
      let statsHtml = `
        <div class="hist-stats-bar">
          <div class="hist-stat">
            <div class="hist-stat-label">Viajes</div>
            <div class="hist-stat-value">${viajesAux.length}</div>
          </div>
          <div class="hist-stat">
            <div class="hist-stat-label">Cerrados</div>
            <div class="hist-stat-value ok">${cerrados.length}</div>
          </div>
          <div class="hist-stat">
            <div class="hist-stat-label">Dif. total</div>
            <div class="hist-stat-value ${difTotal < 0 ? 'neg' : difTotal > 0 ? 'ok' : ''}">${difTotal > 0 ? '+' : ''}${difTotal}</div>
          </div>
        </div>`;

      // ── Detalle de diferencias por tipo ──────────────────────────────
      if (cerrados.length > 0) {
        statsHtml += `
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.375rem;margin-bottom:1rem">
            ${[['G',difG],['M',difM],['P',difP],['E',difE]].map(([l,d]) => `
              <div style="background:${d<0?'var(--danger-light)':d>0?'var(--success-light)':'var(--gray-50)'};
                border-radius:var(--radius-xs);padding:.375rem .25rem;text-align:center;
                border:1px solid ${d<0?'#FECACA':d>0?'#BBF7D0':'var(--border)'}">
                <div style="font-size:.62rem;font-weight:700;text-transform:uppercase;color:var(--gray-500)">${l}</div>
                <div style="font-size:1.1rem;font-weight:800;color:${d<0?'var(--danger)':d>0?'var(--success)':'var(--gray-700)'}">${d>0?'+':''}${d}</div>
              </div>`).join('')}
          </div>`;
      }

      if (viajesAux.length === 0 && movs.length === 0) {
        bodyEl.innerHTML = statsHtml + `
          <div class="aux-drawer-empty">
            <div class="aux-drawer-empty-icon">📭</div>
            <div>Sin actividad registrada</div>
          </div>`;
        return;
      }

      // ── Timeline de viajes ───────────────────────────────────────────
      let tlHtml = '<div class="aux-timeline">';

      if (viajesAux.length > 0) {
        tlHtml += `<div class="aux-tl-date-label">🚛 Viajes registrados</div>`;

        viajesAux.forEach(v => {
          const dG = v.ret_grandes  !== null ? v.ret_grandes  - v.desp_grandes  : null;
          const dM = v.ret_medianas !== null ? v.ret_medianas - (v.desp_medianas || 0) : null;
          const dP = v.ret_pequenas !== null ? v.ret_pequenas - v.desp_pequenas : null;
          const dE = v.ret_estibas  !== null ? v.ret_estibas  - v.desp_estibas  : null;
          const dTot = dG !== null ? dG + (dM || 0) + dP + dE : null;

          const iconClass = v.estado === 'cerrado' ? 't-cerrado'
            : v.estado === 'anulado' ? 't-anulado' : 't-pendiente';
          const icon = v.estado === 'cerrado' ? '📦'
            : v.estado === 'anulado' ? '❌' : '🚛';

          const statusBadge = v.estado === 'abierto'
            ? `<span class="tl-status-badge s-pendiente">Pendiente${
                (() => { const d = Math.floor((Date.now()-new Date(v.fecha))/86400000); return d > 0 ? ` · Hace ${d}d` : ''; })()
              }</span>`
            : v.estado === 'cerrado'
              ? `<span class="tl-status-badge s-cerrado">Cerrado</span>`
              : `<span class="tl-status-badge s-anulado">Anulado</span>`;

          // Pills de diferencia por tipo
          let difPills = '';
          if (dG !== null) {
            difPills = `<div class="tl-dif-row">
              ${[['G',dG],['M',dM],['P',dP],['E',dE]].map(([l,d]) =>
                `<span class="tl-dif-pill ${d < 0 ? 'neg' : d > 0 ? 'ok' : 'zero'}">${l}: ${d > 0 ? '+' : ''}${d}</span>`
              ).join('')}
              ${dTot !== 0 ? `<span class="tl-dif-pill ${dTot < 0 ? 'neg' : 'ok'}" style="font-weight:800">Total: ${dTot > 0 ? '+' : ''}${dTot}</span>` : ''}
            </div>`;
          }

          tlHtml += `<div class="aux-tl-item">
            <div class="aux-tl-icon ${iconClass}">${icon}</div>
            <div class="aux-tl-content">
              <div class="aux-tl-top">
                <span class="aux-tl-tipo">${escapeHtml(v.numero_viaje)} · ${escapeHtml(v.placa)} ${statusBadge}</span>
              </div>
              <div class="aux-tl-ref">📤 ${v.desp_grandes}G·${v.desp_medianas || 0}M·${v.desp_pequenas}P·${v.desp_estibas}E</div>
              ${v.ret_grandes !== null
                ? `<div class="aux-tl-ref">📥 ${v.ret_grandes}G·${v.ret_medianas !== null ? v.ret_medianas : 0}M·${v.ret_pequenas}P·${v.ret_estibas}E</div>
                   ${difPills}`
                : ''}
              <div class="aux-tl-meta">
                <span>📅 ${v.fecha}</span>
                ${v.firma_despacho_url ? '<span>🖊 Firmado despacho</span>' : ''}
                ${v.firma_retorno_url  ? '<span>🖊 Firmado retorno</span>'  : ''}
              </div>
            </div>
          </div>`;
        });
      }

      // ── Historial antiguo (modelo legacy) ───────────────────────────
      const TIPO_ICONS  = { salida_auxiliar:'📤', entrada_auxiliar:'📥', entrada_cliente:'🏢', salida_cliente:'🔄' };
      const TIPO_LABELS = { salida_auxiliar:'Salida', entrada_auxiliar:'Entrada', entrada_cliente:'Entrada cliente', salida_cliente:'Salida cliente' };

      if (movs.length > 0) {
        if (viajesAux.length > 0) tlHtml += `<hr style="margin:1rem 0;border:none;border-top:1px solid var(--border)">`;
        tlHtml += `<div class="aux-tl-date-label">📦 Historial anterior</div>`;

        const groups = {};
        movs.forEach(m => {
          const key = m.fecha.split('T')[0];
          const d = new Date(key);
          const hoy = new Date(); hoy.setHours(0,0,0,0);
          const ayer = new Date(hoy); ayer.setDate(hoy.getDate()-1);
          const mDate = new Date(d); mDate.setHours(0,0,0,0);
          const label = mDate.getTime() === hoy.getTime() ? 'Hoy'
            : mDate.getTime() === ayer.getTime() ? 'Ayer'
            : d.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' });
          if (!groups[key]) groups[key] = { label, items: [] };
          groups[key].items.push(m);
        });

        Object.keys(groups).sort((a,b) => b.localeCompare(a)).forEach(key => {
          const g = groups[key];
          tlHtml += `<div class="aux-tl-date-label">${g.label}</div>`;
          g.items.forEach(m => {
            const anulado = m.anulado;
            const icCls = anulado ? 't-anulado' : (m.tipo === 'entrada_auxiliar' ? 't-entrada' : 't-salida');
            const hora = new Date(m.fecha).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
            tlHtml += `<div class="aux-tl-item">
              <div class="aux-tl-icon ${icCls}">${TIPO_ICONS[m.tipo]||'↔️'}</div>
              <div class="aux-tl-content">
                <div class="aux-tl-top">
                  <span class="aux-tl-tipo" style="${anulado?'text-decoration:line-through;opacity:.55':''}">
                    ${TIPO_LABELS[m.tipo]||m.tipo}
                    ${anulado ? '<span class="tl-status-badge s-anulado">Anulado</span>' : ''}
                  </span>
                  <span class="aux-tl-cant">${m.cantidad} 🧺</span>
                </div>
                <div class="aux-tl-ref">${escapeHtml(m.referencia_numero||'')}</div>
                <div class="aux-tl-meta">
                  <span>🕐 ${hora}</span>
                  ${m.cliente_nombre ? `<span>👤 ${escapeHtml(m.cliente_nombre)}</span>` : ''}
                  ${m.firma_url ? '<span>🖊 Firmado</span>' : ''}
                </div>
                ${m.notas ? `<div class="aux-tl-notas">💬 ${escapeHtml(m.notas)}</div>` : ''}
              </div>
            </div>`;
          });
        });
      }

      tlHtml += '</div>';
      bodyEl.innerHTML = statsHtml + tlHtml;

    } catch (err) {
      document.getElementById('aux-d-body').innerHTML = `
        <div class="aux-drawer-empty">
          <div class="aux-drawer-empty-icon">⚠️</div>
          <div>Error: ${escapeHtml(err.message)}</div>
        </div>`;
    }
  }

  // ─── escapeHtml ────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return {
    toast, showModal, closeModal, setLoading, showSection,
    renderAuxiliares, showHistorialAuxiliar, escapeHtml,
  };
})();
