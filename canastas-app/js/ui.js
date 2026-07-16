/**
 * ui.js - UI rendering helpers for Control de Canastas PWA
 */

const UI = (() => {
  // ─── Type labels & badge classes ────────────────────────────────────────────

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

  // ─── Toast notifications ─────────────────────────────────────────────────────

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

    // Trigger animation
    requestAnimationFrame(() => t.classList.add('toast-show'));

    setTimeout(() => {
      t.classList.remove('toast-show');
      t.addEventListener('transitionend', () => t.remove());
    }, 3500);
  }

  // ─── Modal ───────────────────────────────────────────────────────────────────

  function showModal({ title, body, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', onConfirm, danger = false }) {
    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalConfirm = document.getElementById('modal-confirm');
    const modalCancel = document.getElementById('modal-cancel');

    modalTitle.textContent = title;
    modalBody.innerHTML = body;
    modalConfirm.textContent = confirmLabel;
    modalCancel.textContent = cancelLabel;
    modalConfirm.className = danger ? 'btn btn-danger' : 'btn btn-primary';

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
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    }, { once: true });
  }

  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // ─── Loading spinner ─────────────────────────────────────────────────────────

  function setLoading(show) {
    const spinner = document.getElementById('global-spinner');
    if (spinner) spinner.classList.toggle('hidden', !show);
  }

  // ─── Section navigation ──────────────────────────────────────────────────────

  function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`section-${sectionId}`);
    if (target) target.classList.add('active');

    // Update nav active states
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.classList.toggle('active', el.dataset.nav === sectionId);
    });
  }

  // ─── Dashboard render ────────────────────────────────────────────────────────

  function renderDashboard() {
    const estado = DB.getEstado();
    const auxiliares = DB.getAuxiliares();
    const movimientos = DB.getMovimientos().slice().reverse().slice(0, 10);

    // Stat cards
    const totalAuxiliares = Object.values(estado.canastas_con_auxiliares)
      .reduce((s, v) => s + v, 0);
    const totalClientes = estado.canastas_clientes_prestadas
      .reduce((s, p) => s + p.cantidad, 0);

    document.getElementById('stat-bodega').textContent = estado.canastas_en_bodega;
    document.getElementById('stat-auxiliares').textContent = totalAuxiliares;
    document.getElementById('stat-clientes').textContent = totalClientes;
    document.getElementById('stat-total').textContent =
      estado.canastas_en_bodega + totalAuxiliares;

    // Auxiliares breakdown
    const breakdownEl = document.getElementById('auxiliares-breakdown');
    const auxEntries = Object.entries(estado.canastas_con_auxiliares)
      .filter(([, v]) => v > 0);

    if (auxEntries.length === 0) {
      breakdownEl.innerHTML = '<p class="text-muted small">Ningún auxiliar tiene canastas fuera</p>';
    } else {
      breakdownEl.innerHTML = auxEntries.map(([auxId, cant]) => {
        const aux = DB.getAuxiliarById(auxId);
        const nombre = aux ? aux.nombre : auxId;
        return `<div class="breakdown-row">
          <span class="breakdown-name">${escapeHtml(nombre)}</span>
          <span class="badge badge-blue">${cant} canastas</span>
        </div>`;
      }).join('');
    }

    // Client loans breakdown
    const clientesBreakdownEl = document.getElementById('clientes-breakdown');
    if (estado.canastas_clientes_prestadas.length === 0) {
      clientesBreakdownEl.innerHTML = '<p class="text-muted small">No hay préstamos activos de clientes</p>';
    } else {
      clientesBreakdownEl.innerHTML = estado.canastas_clientes_prestadas.map(p => `
        <div class="breakdown-row">
          <span class="breakdown-name">${escapeHtml(p.cliente)}</span>
          <span class="badge badge-orange">${p.cantidad} canastas</span>
        </div>
      `).join('');
    }

    // Recent movements
    const recentEl = document.getElementById('recent-movements');
    if (movimientos.length === 0) {
      recentEl.innerHTML = '<p class="text-muted small">No hay movimientos registrados</p>';
    } else {
      recentEl.innerHTML = movimientos.map(m => renderMovimientoRow(m, auxiliares)).join('');
    }
  }

  function renderMovimientoRow(m, auxiliares) {
    const auxMap = {};
    auxiliares.forEach(a => { auxMap[a.id] = a.nombre; });
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

  // ─── Auxiliares render ───────────────────────────────────────────────────────

  function renderAuxiliares() {
    const auxiliares = DB.getAuxiliares();
    const estado = DB.getEstado();
    const listEl = document.getElementById('auxiliares-list');

    if (auxiliares.length === 0) {
      listEl.innerHTML = '<p class="text-muted">No hay auxiliares registrados</p>';
      return;
    }

    listEl.innerHTML = auxiliares.map(aux => {
      const canastas = estado.canastas_con_auxiliares[aux.id] || 0;
      const statusClass = aux.activo ? 'badge-green' : 'badge-gray';
      const statusLabel = aux.activo ? 'Activo' : 'Inactivo';

      return `<div class="card auxiliar-card ${!aux.activo ? 'inactive' : ''}">
        <div class="auxiliar-header">
          <div>
            <div class="auxiliar-nombre">${escapeHtml(aux.nombre)}</div>
            <div class="auxiliar-cedula text-muted">CC: ${escapeHtml(aux.cedula)}</div>
          </div>
          <span class="badge ${statusClass}">${statusLabel}</span>
        </div>
        <div class="auxiliar-footer">
          <span class="badge badge-blue">${canastas} canastas fuera</span>
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

  // ─── Historial render ────────────────────────────────────────────────────────

  function renderHistorial(filters = {}) {
    const movimientos = DB.filtrarMovimientos(filters);
    const auxiliares = DB.getAuxiliares();
    const tableBody = document.getElementById('historial-tbody');
    const countEl = document.getElementById('historial-count');

    if (countEl) countEl.textContent = `${movimientos.length} registro(s)`;

    if (movimientos.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay movimientos para los filtros seleccionados</td></tr>';
      return;
    }

    const auxMap = {};
    auxiliares.forEach(a => { auxMap[a.id] = a.nombre; });

    tableBody.innerHTML = movimientos.map(m => {
      const responsable = m.auxiliar_id
        ? (auxMap[m.auxiliar_id] || m.auxiliar_id)
        : (m.cliente_nombre || '—');
      return `<tr>
        <td><span class="ref-number">${escapeHtml(m.referencia_numero)}</span></td>
        <td>${DB.formatFecha(m.fecha)}</td>
        <td><span class="badge ${TIPO_BADGE[m.tipo] || 'badge-blue'}">${TIPO_LABELS[m.tipo] || m.tipo}</span></td>
        <td class="text-center"><strong>${m.cantidad}</strong></td>
        <td>${escapeHtml(responsable)}</td>
        <td>${escapeHtml(m.admin_registrador)}</td>
        <td class="notas-cell">${escapeHtml(m.notas || '—')}</td>
      </tr>`;
    }).join('');
  }

  // ─── Populate selects ────────────────────────────────────────────────────────

  function populateAuxiliarSelect(selectId, soloActivos = true) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const auxiliares = DB.getAuxiliares(soloActivos);
    sel.innerHTML = '<option value="">-- Seleccione auxiliar --</option>' +
      auxiliares.map(a => `<option value="${a.id}">${escapeHtml(a.nombre)} (CC: ${escapeHtml(a.cedula)})</option>`).join('');
  }

  function populateClientePrestamos(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const estado = DB.getEstado();
    const prestamos = estado.canastas_clientes_prestadas;
    if (prestamos.length === 0) {
      sel.innerHTML = '<option value="">-- No hay préstamos activos --</option>';
      return;
    }
    sel.innerHTML = '<option value="">-- Seleccione préstamo --</option>' +
      prestamos.map(p => {
        const fecha = DB.formatFecha(p.fecha_entrada);
        return `<option value="${p.id}">${escapeHtml(p.cliente)} — ${p.cantidad} canastas (desde ${fecha})</option>`;
      }).join('');
  }

  // ─── Configuración ───────────────────────────────────────────────────────────

  function renderConfiguracion() {
    const config = DB.getConfig();
    const inputEl = document.getElementById('config-inventario');
    if (inputEl) inputEl.value = config.inventario_inicial || 0;
  }

  // ─── Helper ──────────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTipo(tipo) {
    return TIPO_LABELS[tipo] || tipo;
  }

  return {
    toast,
    showModal,
    closeModal,
    setLoading,
    showSection,
    renderDashboard,
    renderAuxiliares,
    renderHistorial,
    renderMovimientoRow,
    populateAuxiliarSelect,
    populateClientePrestamos,
    renderConfiguracion,
    escapeHtml,
    formatTipo,
    TIPO_LABELS,
    TIPO_BADGE,
  };
})();
