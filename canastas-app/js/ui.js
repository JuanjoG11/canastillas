/**
 * ui.js - UI rendering helpers
 * Control de Canastas PWA
 */

const UI = (() => {

  const TIPO_LABELS = {
    salida_auxiliar:  'Salida a Auxiliar',
    entrada_auxiliar: 'Entrada de Auxiliar',
    entrada_cliente:  'Entrada de Cliente',
    salida_cliente:   'Salida a Cliente',
  };

  const TIPO_BADGE = {
    salida_auxiliar:  'badge-blue',
    entrada_auxiliar: 'badge-green',
    entrada_cliente:  'badge-orange',
    salida_cliente:   'badge-red',
  };



  // ─── Estado de paginación ─────────────────────────────────────────────────
  let _histPage     = 1;
  const PAGE_SIZE   = 50;
  let _histFilters  = {};
  let _histTotal    = 0;

  // ─── Toast ────────────────────────────────────────────────────────────────
  function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
    `;
    container.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast-show'));
    setTimeout(() => {
      t.classList.remove('toast-show');
      t.addEventListener('transitionend', () => t.remove());
    }, 3500);
  }

  // ─── Modal genérico ───────────────────────────────────────────────────────
  function showModal({ title, body, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', onConfirm, danger = false }) {
    const overlay      = document.getElementById('modal-overlay');
    const modalTitle   = document.getElementById('modal-title');
    const modalBody    = document.getElementById('modal-body');
    const modalConfirm = document.getElementById('modal-confirm');
    const modalCancel  = document.getElementById('modal-cancel');

    modalTitle.textContent   = title;
    modalBody.innerHTML      = body;
    modalConfirm.textContent = confirmLabel;
    modalCancel.textContent  = cancelLabel;
    modalConfirm.className   = danger ? 'btn btn-danger' : 'btn btn-primary';
    overlay.classList.remove('hidden');

    const close = () => overlay.classList.add('hidden');
    const handleConfirm = () => {
      close();
      if (onConfirm) onConfirm();
      modalConfirm.removeEventListener('click', handleConfirm);
      modalCancel.removeEventListener('click', close);
    };
    modalConfirm.addEventListener('click', handleConfirm);
    modalCancel.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); }, { once: true });
  }

  function closeModal() {
    document.getElementById('modal-overlay')?.classList.add('hidden');
  }

  // ─── Spinner ──────────────────────────────────────────────────────────────
  function setLoading(show) {
    document.getElementById('global-spinner')?.classList.toggle('hidden', !show);
  }

  // ─── Navegación ───────────────────────────────────────────────────────────
  function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`section-${sectionId}`)?.classList.add('active');
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.classList.toggle('active', el.dataset.nav === sectionId);
    });
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────
  async function renderDashboard() {
    const [estado, auxiliares, movimientos] = await Promise.all([
      DB.getEstado(),
      DB.getAuxiliares(),
      DB.getMovimientos(),
    ]);

    const recentMovs      = movimientos.slice(0, 10);
    const totalAuxiliares = Object.values(estado.canastas_con_auxiliares || {}).reduce((s, v) => s + v, 0);
    const totalClientes   = (estado.canastas_clientes_prestadas || []).reduce((s, p) => s + p.cantidad, 0);

    document.getElementById('stat-bodega').textContent     = estado.canastas_en_bodega;
    document.getElementById('stat-auxiliares').textContent = totalAuxiliares;
    document.getElementById('stat-clientes').textContent   = totalClientes;
    document.getElementById('stat-total').textContent      = estado.canastas_en_bodega + totalAuxiliares;

    // Auxiliares breakdown con semáforo
    const breakdownEl = document.getElementById('auxiliares-breakdown');
    const auxEntries  = Object.entries(estado.canastas_con_auxiliares || {}).filter(([, v]) => v > 0);
    if (auxEntries.length === 0) {
      breakdownEl.innerHTML = '<p class="text-muted small">Ningún auxiliar tiene canastas fuera</p>';
    } else {
      // Obtener última salida por auxiliar para el semáforo
      const ultimasSalidas = {};
      movimientos.forEach(m => {
        if (m.tipo === 'salida_auxiliar' && m.auxiliar_id) {
          if (!ultimasSalidas[m.auxiliar_id]) ultimasSalidas[m.auxiliar_id] = m.fecha;
        }
      });
      breakdownEl.innerHTML = auxEntries.map(([auxId, cant]) => {
        const aux    = auxiliares.find(a => a.id === auxId);
        const nombre = aux ? aux.nombre : auxId;
        const semaforo = getSemaforo(ultimasSalidas[auxId]);
        return `<div class="breakdown-row">
          <span class="breakdown-name">
            <span class="semaforo semaforo-${semaforo.color}" title="${semaforo.label}"></span>
            ${escapeHtml(nombre)}
          </span>
          <span class="badge badge-blue">${cant} 🧺</span>
        </div>`;
      }).join('');
    }

    // Clientes breakdown — muestra auxiliar responsable
    const clientesEl = document.getElementById('clientes-breakdown');
    const prestamos  = estado.canastas_clientes_prestadas || [];
    if (prestamos.length === 0) {
      clientesEl.innerHTML = '<p class="text-muted small">No hay préstamos activos de clientes</p>';
    } else {
      clientesEl.innerHTML = prestamos.map(p => {
        const auxNombre = p.auxiliar_id
          ? (auxiliares.find(a => a.id === p.auxiliar_id)?.nombre || '')
          : '';
        return `<div class="breakdown-row">
          <span class="breakdown-name">
            ${escapeHtml(p.cliente)}
            ${auxNombre ? `<span class="text-muted small"> · ${escapeHtml(auxNombre)}</span>` : ''}
          </span>
          <span class="badge badge-orange">${p.cantidad} 🧺</span>
        </div>`;
      }).join('');
    }

    // Movimientos recientes
    const recentEl = document.getElementById('recent-movements');
    recentEl.innerHTML = recentMovs.length === 0
      ? '<p class="text-muted small">No hay movimientos registrados</p>'
      : recentMovs.map(m => renderMovimientoRow(m, auxiliares)).join('');
  }

  // Semáforo: verde=hoy, amarillo=ayer, rojo=2+ días
  function getSemaforo(fechaISO) {
    if (!fechaISO) return { color: 'gray', label: 'Sin fecha' };
    const diff = (Date.now() - new Date(fechaISO)) / 86400000;
    if (diff < 1)  return { color: 'green',  label: 'Salió hoy' };
    if (diff < 3)  return { color: 'yellow', label: 'Salió hace 1-2 días' };
    return          { color: 'red',    label: 'Salió hace más de 3 días' };
  }

  function renderMovimientoRow(m, auxiliares) {
    const auxMap = {};
    (auxiliares || []).forEach(a => { auxMap[a.id] = a.nombre; });
    const responsable = m.auxiliar_id ? (auxMap[m.auxiliar_id] || m.auxiliar_id) : (m.cliente_nombre || '—');
    return `<div class="movement-row">
      <div class="movement-ref">${escapeHtml(m.referencia_numero)}</div>
      <div class="movement-info">
        <span class="badge ${TIPO_BADGE[m.tipo] || 'badge-blue'}">${TIPO_LABELS[m.tipo] || m.tipo}</span>
        <span class="movement-responsable">${escapeHtml(responsable)}</span>
      </div>
      <div class="movement-meta">
        <span class="movement-cantidad">${m.cantidad} 🧺</span>
        <span class="movement-fecha text-muted">${DB.formatFecha(m.fecha)}</span>
      </div>
    </div>`;
  }

  // ─── Auxiliares con semáforo ──────────────────────────────────────────────
  async function renderAuxiliares() {
    const [auxiliares, estado, movimientos] = await Promise.all([
      DB.getAuxiliares(),
      DB.getEstado(),
      DB.getMovimientos(),
    ]);

    const listEl = document.getElementById('auxiliares-list');
    if (auxiliares.length === 0) {
      listEl.innerHTML = '<p class="text-muted">No hay auxiliares registrados</p>';
      return;
    }

    // Última salida por auxiliar
    const ultimasSalidas = {};
    movimientos.forEach(m => {
      if (m.tipo === 'salida_auxiliar' && m.auxiliar_id && !ultimasSalidas[m.auxiliar_id]) {
        ultimasSalidas[m.auxiliar_id] = m.fecha;
      }
    });

    listEl.innerHTML = auxiliares.map(aux => {
      const canastas    = (estado.canastas_con_auxiliares || {})[aux.id] || 0;
      const statusClass = aux.activo ? 'badge-green' : 'badge-gray';
      const statusLabel = aux.activo ? 'Activo' : 'Inactivo';
      const semaforo    = canastas > 0 ? getSemaforo(ultimasSalidas[aux.id]) : { color: 'gray', label: '' };

      // Calcular días desde última salida para mostrar
      let diasLabel = '';
      if (canastas > 0 && ultimasSalidas[aux.id]) {
        const diff = Math.floor((Date.now() - new Date(ultimasSalidas[aux.id])) / 86400000);
        diasLabel = diff === 0 ? 'Salió hoy' : diff === 1 ? 'Hace 1 día' : `Hace ${diff} días`;
      }

      const iconoTipo = canastas > 0 ? '🧺' : '✓';

      return `<div class="auxiliar-card ${!aux.activo ? 'inactive' : ''}"
        onclick="APP.verHistorialAuxiliar('${aux.id}', '${escapeHtml(aux.nombre).replace(/'/g, "\\'")}')"
        title="Ver historial de ${escapeHtml(aux.nombre)}">
        <div class="auxiliar-card-bar bar-${semaforo.color}"></div>
        <div class="auxiliar-card-body">
          <div class="auxiliar-card-top">
            <div>
              <div class="auxiliar-nombre">${escapeHtml(aux.nombre)}</div>
              <div class="auxiliar-cedula">CC: ${escapeHtml(aux.cedula)}</div>
            </div>
            <span class="badge ${statusClass}">${statusLabel}</span>
          </div>
          <div class="auxiliar-stats">
            <span class="aux-stat-canastas ${canastas === 0 ? 'sin-canastas' : ''}">
              ${iconoTipo} ${canastas} canasta${canastas !== 1 ? 's' : ''}
            </span>
            ${diasLabel ? `<span class="aux-stat-dias">${diasLabel}</span>` : ''}
          </div>
        </div>
        <div class="auxiliar-card-footer">
          <span class="aux-ver-historial">📋 Ver historial →</span>
          <div class="auxiliar-actions">
            ${aux.activo
              ? `<button class="btn btn-sm btn-danger" onclick="event.stopPropagation();APP.toggleAuxiliar('${aux.id}', false)">Desactivar</button>`
              : `<button class="btn btn-sm btn-primary" onclick="event.stopPropagation();APP.toggleAuxiliar('${aux.id}', true)">Activar</button>`
            }
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // ─── Historial paginado ───────────────────────────────────────────────────
  async function renderHistorial(filters = {}, page = 1) {
    _histFilters = filters;
    _histPage    = page;

    const [result, auxiliares] = await Promise.all([
      DB.getMovimientosPaginados({ ...filters, page, pageSize: PAGE_SIZE }),
      DB.getAuxiliares(),
    ]);

    const { rows: movimientos, total } = result;
    _histTotal = total;

    const tableBody = document.getElementById('historial-tbody');
    const countEl   = document.getElementById('historial-count');
    if (countEl) countEl.textContent = `${total} registro(s) total`;

    if (movimientos.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No hay movimientos para los filtros seleccionados</td></tr>';
      renderPagination();
      return;
    }

    const auxMap = {};
    auxiliares.forEach(a => { auxMap[a.id] = a.nombre; });

    tableBody.innerHTML = movimientos.map(m => {
      const responsable = m.auxiliar_id
        ? (auxMap[m.auxiliar_id] || m.auxiliar_id)
        : '—';
      const anulado  = m.anulado;
      const esEspejo = m.notas && m.notas.startsWith('Anulación de');
      const rowClass = anulado ? 'fila-anulada' : (esEspejo ? 'fila-espejo' : '');

      const firmaBtn = m.firma_url
        ? `<button class="btn-firma" onclick="APP.verFirma('${m.firma_url}')" title="Ver firma">🖊️</button>`
        : '';
      const anuladoBadge = anulado  ? '<span class="badge badge-red" style="font-size:.7rem">Anulado</span>' : '';
      const espejoBadge  = esEspejo ? '<span class="badge badge-gray" style="font-size:.7rem">Contrapartida</span>' : '';

      const anularBtn = (!anulado && !esEspejo)
        ? `<button class="btn-anular" onclick="APP.anularMovimiento('${m.id}','${escapeHtml(m.referencia_numero)}')" title="Anular movimiento">✕</button>`
        : '';

      return `<tr class="${rowClass}">
        <td>
          <span class="ref-number">${escapeHtml(m.referencia_numero)}</span>
          ${anuladoBadge}${espejoBadge}
        </td>
        <td>${DB.formatFecha(m.fecha)}</td>
        <td><span class="badge ${TIPO_BADGE[m.tipo] || 'badge-blue'}">${TIPO_LABELS[m.tipo] || m.tipo}</span></td>
        <td class="text-center"><strong>${m.cantidad}</strong></td>
        <td>${escapeHtml(responsable)}</td>
        <td>${escapeHtml(m.cliente_nombre || '—')}</td>
        <td>${escapeHtml(m.admin_registrador)}</td>
        <td class="notas-cell" title="${escapeHtml(m.notas || '')}">${escapeHtml(m.notas || '—')}</td>
        <td class="text-center">${firmaBtn}${anularBtn}</td>
      </tr>`;
    }).join('');

    renderPagination();
  }

  function renderPagination() {
    const container = document.getElementById('historial-pagination');
    if (!container) return;

    const totalPages = Math.ceil(_histTotal / PAGE_SIZE);
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    const prevDisabled = _histPage <= 1 ? 'disabled' : '';
    const nextDisabled = _histPage >= totalPages ? 'disabled' : '';

    container.innerHTML = `
      <div class="pagination">
        <button class="btn btn-sm btn-secondary" ${prevDisabled}
          onclick="UI.goToPage(${_histPage - 1})">← Anterior</button>
        <span class="page-info">Página ${_histPage} de ${totalPages}</span>
        <button class="btn btn-sm btn-secondary" ${nextDisabled}
          onclick="UI.goToPage(${_histPage + 1})">Siguiente →</button>
      </div>`;
  }

  async function goToPage(page) {
    setLoading(true);
    await renderHistorial(_histFilters, page);
    setLoading(false);
    document.getElementById('section-historial')?.scrollIntoView({ behavior: 'smooth' });
  }

  // ─── Drawer historial por auxiliar ───────────────────────────────────────
  const TIPO_ICONS = {
    salida_auxiliar:  '📤',
    entrada_auxiliar: '📥',
    entrada_cliente:  '🏢',
    salida_cliente:   '🔄',
  };

  async function showHistorialAuxiliar(auxId, auxNombre) {
    // Eliminar drawer previo si existe
    document.getElementById('aux-drawer-overlay')?.remove();

    // Crear overlay + drawer
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
            <div class="aux-drawer-cedula" id="aux-drawer-cedula">Cargando...</div>
          </div>
          <button class="aux-drawer-close" id="aux-drawer-close-btn" aria-label="Cerrar">✕</button>
        </div>
        <div class="aux-drawer-chips" id="aux-drawer-chips">
          <span class="aux-chip">⏳ Cargando...</span>
        </div>
      </div>
      <div class="aux-drawer-body" id="aux-drawer-body">
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
      setTimeout(() => overlay.remove(), 160);
    };

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.getElementById('aux-drawer-close-btn').addEventListener('click', close);

    // Cerrar con Escape
    const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);

    try {
      const [movs, estado, aux] = await Promise.all([
        DB.getMovimientosPorAuxiliar(auxId),
        DB.getEstado(),
        DB.getAuxiliarById(auxId),
      ]);

      // Actualizar cabecera
      const canastas = (estado.canastas_con_auxiliares || {})[auxId] || 0;
      document.getElementById('aux-drawer-cedula').textContent = aux ? `CC: ${aux.cedula}` : '';

      const chipsEl = document.getElementById('aux-drawer-chips');
      const statusChip = aux?.activo
        ? '<span class="aux-chip">✅ Activo</span>'
        : '<span class="aux-chip">⛔ Inactivo</span>';
      const canastasChip = canastas > 0
        ? `<span class="aux-chip">🧺 ${canastas} canasta${canastas !== 1 ? 's' : ''} fuera</span>`
        : '<span class="aux-chip">✓ Sin canastas fuera</span>';
      const totalChip = `<span class="aux-chip">📋 ${movs.length} movimiento${movs.length !== 1 ? 's' : ''}</span>`;
      chipsEl.innerHTML = statusChip + canastasChip + totalChip;

      const bodyEl = document.getElementById('aux-drawer-body');

      if (movs.length === 0) {
        bodyEl.innerHTML = `
          <div class="aux-drawer-empty">
            <div class="aux-drawer-empty-icon">📭</div>
            <div style="font-weight:600;color:var(--gray-600)">Sin movimientos</div>
            <div style="font-size:.85rem">Este auxiliar aún no tiene registros.</div>
          </div>`;
        return;
      }

      // Agrupar por fecha (día)
      const groups = {};
      movs.forEach(m => {
        const d   = new Date(m.fecha);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const hoy   = new Date(); hoy.setHours(0,0,0,0);
        const ayer  = new Date(hoy); ayer.setDate(hoy.getDate()-1);
        const mDate = new Date(d); mDate.setHours(0,0,0,0);
        let label;
        if (mDate.getTime() === hoy.getTime())  label = 'Hoy';
        else if (mDate.getTime() === ayer.getTime()) label = 'Ayer';
        else label = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        if (!groups[key]) groups[key] = { label, items: [] };
        groups[key].items.push(m);
      });

      let html = '<div class="aux-timeline">';
      Object.keys(groups).sort((a,b) => b.localeCompare(a)).forEach(key => {
        const g = groups[key];
        html += `<div class="aux-tl-date-group">
          <div class="aux-tl-date-label">${g.label}</div>`;

        g.items.forEach(m => {
          const anulado   = m.anulado;
          const esEspejo  = m.notas && m.notas.startsWith('Anulación de');
          const iconClass = anulado || esEspejo ? 'tipo-anulado' : `tipo-${m.tipo}`;
          const hora      = new Date(m.fecha).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
          const tipoLabel = TIPO_LABELS[m.tipo] || m.tipo;
          const icon      = TIPO_ICONS[m.tipo] || '↔️';
          const anuladoBadge = anulado  ? '<span class="aux-tl-anulado-badge">Anulado</span>' : '';
          const espejoBadge  = esEspejo ? '<span class="aux-tl-anulado-badge" style="background:var(--gray-100);color:var(--gray-500)">Contrapartida</span>' : '';

          html += `<div class="aux-tl-item">
            <div class="aux-tl-icon ${iconClass}">${icon}</div>
            <div class="aux-tl-content">
              <div class="aux-tl-top">
                <span class="aux-tl-tipo" style="${anulado ? 'text-decoration:line-through;opacity:.6' : ''}">${tipoLabel} ${anuladoBadge}${espejoBadge}</span>
                <span class="aux-tl-cant">${m.cantidad} 🧺</span>
              </div>
              <div class="aux-tl-ref">${escapeHtml(m.referencia_numero)}</div>
              <div class="aux-tl-meta">
                <span>🕐 ${hora}</span>
                ${m.cliente_nombre ? `<span>👤 ${escapeHtml(m.cliente_nombre)}</span>` : ''}
                ${m.admin_registrador ? `<span>🔑 ${escapeHtml(m.admin_registrador)}</span>` : ''}
                ${m.firma_url ? `<span>🖊️ Firmado</span>` : ''}
              </div>
              ${m.notas ? `<div class="aux-tl-notas" title="${escapeHtml(m.notas)}">💬 ${escapeHtml(m.notas)}</div>` : ''}
            </div>
          </div>`;
        });

        html += '</div>';
      });

      html += '</div>';
      bodyEl.innerHTML = html;

    } catch (err) {
      document.getElementById('aux-drawer-body').innerHTML = `
        <div class="aux-drawer-empty">
          <div class="aux-drawer-empty-icon">⚠️</div>
          <div>Error al cargar historial</div>
          <div style="font-size:.8rem">${escapeHtml(err.message)}</div>
        </div>`;
    }
  }

  // ─── Selects con búsqueda ─────────────────────────────────────────────────
  // ─── Selects con búsqueda autocomplete ────────────────────────────────────
  async function populateAuxiliarSelect(selectId, soloActivos = true) {
    const el = document.getElementById(selectId);
    if (!el) return;

    const auxiliares = await DB.getAuxiliares(soloActivos);

    // Si es un input autocomplete
    const container = el.closest('.autocomplete-container') || document.querySelector(`.autocomplete-container[data-aux-target="${selectId}"]`);
    if (container) {
      const textInput = container.querySelector('.aux-autocomplete-input');
      const dropdown  = container.querySelector('.autocomplete-dropdown');
      if (!textInput || !dropdown) return;

      if (!el.value) {
        textInput.value = '';
      } else if (el.value === 'todos') {
        textInput.value = '';
      } else {
        const match = auxiliares.find(a => a.id === el.value);
        if (match) textInput.value = `${match.nombre} (${match.cedula})`;
      }

      let activeIndex = -1;

      const renderList = (query = '') => {
        const q = query.toLowerCase().trim();
        const filtered = q
          ? auxiliares.filter(a => a.nombre.toLowerCase().includes(q) || a.cedula.includes(q))
          : auxiliares;

        if (filtered.length === 0) {
          dropdown.innerHTML = '<div class="autocomplete-no-results">No se encontraron auxiliares</div>';
        } else {
          dropdown.innerHTML = filtered.map(a => `
            <div class="autocomplete-item" data-id="${a.id}" data-nombre="${escapeHtml(a.nombre)}" data-cedula="${escapeHtml(a.cedula)}">
              <span class="item-nombre">${escapeHtml(a.nombre)}</span>
              <span class="item-cedula">CC: ${escapeHtml(a.cedula)}</span>
            </div>
          `).join('');

          dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', (e) => {
              e.stopPropagation();
              selectItem(item);
            });
          });
        }
        dropdown.classList.remove('hidden');
        activeIndex = -1;
      };

      const selectItem = (itemEl) => {
        if (!itemEl) return;
        const id     = itemEl.dataset.id;
        const nombre = itemEl.dataset.nombre;
        const cedula = itemEl.dataset.cedula;

        el.value        = id;
        textInput.value = `${nombre} (${cedula})`;
        dropdown.classList.add('hidden');

        // Disparar evento change para listener de info
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      if (!textInput._autocompleteBound) {
        textInput._autocompleteBound = true;

        textInput.addEventListener('focus', () => {
          renderList(textInput.value);
        });

        textInput.addEventListener('input', () => {
          el.value = '';
          el.dispatchEvent(new Event('change', { bubbles: true }));
          renderList(textInput.value);
        });

        textInput.addEventListener('keydown', (e) => {
          const items = dropdown.querySelectorAll('.autocomplete-item');
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (dropdown.classList.contains('hidden')) { renderList(textInput.value); return; }
            if (items.length > 0) {
              activeIndex = (activeIndex + 1) % items.length;
              items.forEach((it, idx) => it.classList.toggle('active-item', idx === activeIndex));
              items[activeIndex]?.scrollIntoView({ block: 'nearest' });
            }
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (items.length > 0) {
              activeIndex = (activeIndex - 1 + items.length) % items.length;
              items.forEach((it, idx) => it.classList.toggle('active-item', idx === activeIndex));
              items[activeIndex]?.scrollIntoView({ block: 'nearest' });
            }
          } else if (e.key === 'Enter') {
            if (!dropdown.classList.contains('hidden')) {
              e.preventDefault();
              if (activeIndex >= 0 && items[activeIndex]) {
                selectItem(items[activeIndex]);
              } else if (items.length > 0) {
                selectItem(items[0]);
              }
            }
          } else if (e.key === 'Escape') {
            dropdown.classList.add('hidden');
          }
        });

        document.addEventListener('click', (e) => {
          if (!container.contains(e.target)) {
            dropdown.classList.add('hidden');
          }
        });
      }
      return;
    }

    // Fallback si es un select estándar
    if (el.tagName === 'SELECT') {
      const current = el.value;
      el.innerHTML = '<option value="">-- Seleccione auxiliar --</option>' +
        auxiliares.map(a =>
          `<option value="${a.id}">${escapeHtml(a.nombre)} (CC: ${escapeHtml(a.cedula)})</option>`
        ).join('');
      if (current) el.value = current;
    }
  }

  async function populateClientePrestamos(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const estado    = await DB.getEstado();
    const prestamos = estado.canastas_clientes_prestadas || [];
    const current   = sel.value;
    if (prestamos.length === 0) {
      sel.innerHTML = '<option value="">-- No hay préstamos activos --</option>';
      return;
    }
    sel.innerHTML = '<option value="">-- Seleccione préstamo --</option>' +
      prestamos.map(p => {
        const fecha = DB.formatFecha(p.fecha_entrada);
        return `<option value="${p.id}">${escapeHtml(p.cliente)} — ${p.cantidad} canastas (desde ${fecha})</option>`;
      }).join('');
    if (current) sel.value = current;
  }

  // ─── Configuración ────────────────────────────────────────────────────────
  async function renderConfiguracion() {
    const estado  = await DB.getEstado();
    const inputEl = document.getElementById('config-inventario');
    if (inputEl) inputEl.value = estado.canastas_en_bodega;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    toast, showModal, closeModal, setLoading, showSection,
    renderDashboard, renderAuxiliares, renderHistorial, goToPage,
    renderMovimientoRow, populateAuxiliarSelect, populateClientePrestamos,
    renderConfiguracion, showHistorialAuxiliar, escapeHtml, getSemaforo,
    TIPO_LABELS, TIPO_BADGE,
  };
})();
