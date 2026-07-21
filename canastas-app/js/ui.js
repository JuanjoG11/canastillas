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
      const semaforo    = canastas > 0 ? getSemaforo(ultimasSalidas[aux.id]) : null;

      return `<div class="card auxiliar-card ${!aux.activo ? 'inactive' : ''}">
        <div class="auxiliar-header">
          <div>
            <div class="auxiliar-nombre">
              ${semaforo ? `<span class="semaforo semaforo-${semaforo.color}" title="${semaforo.label}"></span>` : ''}
              ${escapeHtml(aux.nombre)}
            </div>
            <div class="auxiliar-cedula text-muted">CC: ${escapeHtml(aux.cedula)}</div>
          </div>
          <span class="badge ${statusClass}">${statusLabel}</span>
        </div>
        <div class="auxiliar-footer">
          <span class="badge ${canastas > 0 ? 'badge-blue' : 'badge-gray'}">${canastas} canastas fuera</span>
          <div class="auxiliar-actions">
            <button class="btn btn-sm btn-secondary" onclick="APP.editAuxiliar('${aux.id}')">Editar</button>
            ${aux.activo
              ? `<button class="btn btn-sm btn-danger" onclick="APP.toggleAuxiliar('${aux.id}', false)">Desactivar</button>`
              : `<button class="btn btn-sm btn-primary" onclick="APP.toggleAuxiliar('${aux.id}', true)">Activar</button>`
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
      tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay movimientos para los filtros seleccionados</td></tr>';
      renderPagination();
      return;
    }

    const auxMap = {};
    auxiliares.forEach(a => { auxMap[a.id] = a.nombre; });

    tableBody.innerHTML = movimientos.map(m => {
      const responsable = m.auxiliar_id
        ? (auxMap[m.auxiliar_id] || m.auxiliar_id)
        : '—';
      return `<tr>
        <td><span class="ref-number">${escapeHtml(m.referencia_numero)}</span></td>
        <td>${DB.formatFecha(m.fecha)}</td>
        <td><span class="badge ${TIPO_BADGE[m.tipo] || 'badge-blue'}">${TIPO_LABELS[m.tipo] || m.tipo}</span></td>
        <td class="text-center"><strong>${m.cantidad}</strong></td>
        <td>${escapeHtml(responsable)}</td>
        <td>${escapeHtml(m.cliente_nombre || '—')}</td>
        <td>${escapeHtml(m.admin_registrador)}</td>
        <td class="notas-cell" title="${escapeHtml(m.notas || '')}">${escapeHtml(m.notas || '—')}</td>
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

  // ─── Selects con búsqueda ─────────────────────────────────────────────────
  async function populateAuxiliarSelect(selectId, soloActivos = true) {
    const wrapper = document.getElementById(selectId + '-wrapper');
    const sel     = document.getElementById(selectId);
    if (!sel) return;

    const auxiliares = await DB.getAuxiliares(soloActivos);
    const current    = sel.value;

    sel.innerHTML = '<option value="">-- Seleccione auxiliar --</option>' +
      auxiliares.map(a =>
        `<option value="${a.id}">${escapeHtml(a.nombre)} (CC: ${escapeHtml(a.cedula)})</option>`
      ).join('');
    if (current) sel.value = current;

    // Activar búsqueda si hay wrapper
    if (wrapper) {
      const searchInput = wrapper.querySelector('.aux-search');
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          const q = searchInput.value.toLowerCase();
          Array.from(sel.options).forEach(opt => {
            if (!opt.value) return;
            opt.style.display = opt.text.toLowerCase().includes(q) ? '' : 'none';
          });
        });
      }
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
    renderConfiguracion, escapeHtml, getSemaforo,
    TIPO_LABELS, TIPO_BADGE,
  };
})();
