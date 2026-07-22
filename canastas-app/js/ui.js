/**
 * ui.js - UI rendering helpers (shared)
 * Control de Canastas PWA 2.0
 */

const UI = (() => {

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

  // ─── Spinner & Navegación ─────────────────────────────────────────────────
  function setLoading(show) {
    document.getElementById('global-spinner')?.classList.toggle('hidden', !show);
  }

  function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`section-${sectionId}`)?.classList.add('active');
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.classList.toggle('active', el.dataset.nav === sectionId);
    });
  }

  // ─── Auxiliares (lista tipo persona-card) ─────────────────────────────────
  async function renderAuxiliares() {
    const auxiliares = await DB.getAuxiliares();
    const listEl = document.getElementById('auxiliares-list');
    if (auxiliares.length === 0) {
      listEl.innerHTML = '<p class="text-muted">No hay auxiliares registrados</p>';
      return;
    }
    listEl.innerHTML = auxiliares.map(a => {
      const statusClass = a.activo ? 'badge-green' : 'badge-gray';
      const statusLabel = a.activo ? 'Activo' : 'Inactivo';
      const safeName = escapeHtml(a.nombre).replace(/'/g, "\\'");
      return `<div class="persona-card ${!a.activo ? 'inactive' : ''}"
        onclick="APP.verHistorialAuxiliar('${a.id}','${safeName}')"
        style="cursor:pointer" title="Ver historial">
        <div class="persona-info">
          <div class="persona-nombre">${escapeHtml(a.nombre)}</div>
          <div class="persona-cedula">CC: ${escapeHtml(a.cedula)}</div>
        </div>
        <div class="persona-actions">
          <span class="badge ${statusClass}">${statusLabel}</span>
          ${a.activo
            ? `<button class="btn btn-sm btn-danger" onclick="event.stopPropagation();APP.toggleAuxiliar('${a.id}',false)">Desactivar</button>`
            : `<button class="btn btn-sm btn-primary" onclick="event.stopPropagation();APP.toggleAuxiliar('${a.id}',true)">Activar</button>`
          }
        </div>
      </div>`;
    }).join('');
  }

  // ─── Drawer historial auxiliar ────────────────────────────────────────────
  const TIPO_ICONS = { salida_auxiliar:'📤', entrada_auxiliar:'📥', entrada_cliente:'🏢', salida_cliente:'🔄' };
  const TIPO_LABELS = { salida_auxiliar:'Salida a Auxiliar', entrada_auxiliar:'Entrada de Auxiliar', entrada_cliente:'Entrada de Cliente', salida_cliente:'Salida a Cliente' };

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
            <div class="aux-drawer-cedula" id="aux-drawer-cedula">Cargando...</div>
          </div>
          <button class="aux-drawer-close" id="aux-drawer-close-btn">✕</button>
        </div>
        <div class="aux-drawer-chips" id="aux-drawer-chips"><span class="aux-chip">⏳</span></div>
      </div>
      <div class="aux-drawer-body" id="aux-drawer-body">
        <div class="aux-drawer-empty"><div class="aux-drawer-empty-icon">⏳</div><div>Cargando...</div></div>
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
    const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);

    try {
      const [movs, aux] = await Promise.all([DB.getMovimientosPorAuxiliar(auxId), DB.getAuxiliarById(auxId)]);
      document.getElementById('aux-drawer-cedula').textContent = aux ? `CC: ${aux.cedula}` : '';
      const chipsEl = document.getElementById('aux-drawer-chips');
      chipsEl.innerHTML = (aux?.activo ? '<span class="aux-chip">✅ Activo</span>' : '<span class="aux-chip">⛔ Inactivo</span>') +
        `<span class="aux-chip">📋 ${movs.length} mov.</span>`;
      const bodyEl = document.getElementById('aux-drawer-body');
      if (movs.length === 0) {
        bodyEl.innerHTML = `<div class="aux-drawer-empty"><div class="aux-drawer-empty-icon">📭</div><div>Sin movimientos</div></div>`;
        return;
      }
      // Agrupar por día
      const groups = {};
      movs.forEach(m => {
        const d = new Date(m.fecha);
        const key = d.toISOString().split('T')[0];
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        const ayer = new Date(hoy); ayer.setDate(hoy.getDate()-1);
        const mDate = new Date(d); mDate.setHours(0,0,0,0);
        let label = mDate.getTime() === hoy.getTime() ? 'Hoy'
          : mDate.getTime() === ayer.getTime() ? 'Ayer'
          : d.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
        if (!groups[key]) groups[key] = { label, items: [] };
        groups[key].items.push(m);
      });
      let html = '<div class="aux-timeline">';
      Object.keys(groups).sort((a,b) => b.localeCompare(a)).forEach(key => {
        const g = groups[key];
        html += `<div class="aux-tl-date-group"><div class="aux-tl-date-label">${g.label}</div>`;
        g.items.forEach(m => {
          const anulado  = m.anulado;
          const esEspejo = m.notas?.startsWith('Anulación de');
          const iconClass = anulado || esEspejo ? 'tipo-anulado' : `tipo-${m.tipo}`;
          const hora = new Date(m.fecha).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
          const aB = anulado  ? '<span class="aux-tl-anulado-badge">Anulado</span>' : '';
          const eB = esEspejo ? '<span class="aux-tl-anulado-badge" style="background:var(--gray-100);color:var(--gray-500)">Contrapartida</span>' : '';
          html += `<div class="aux-tl-item">
            <div class="aux-tl-icon ${iconClass}">${TIPO_ICONS[m.tipo]||'↔️'}</div>
            <div class="aux-tl-content">
              <div class="aux-tl-top">
                <span class="aux-tl-tipo" style="${anulado?'text-decoration:line-through;opacity:.6':''}">${TIPO_LABELS[m.tipo]||m.tipo} ${aB}${eB}</span>
                <span class="aux-tl-cant">${m.cantidad} 🧺</span>
              </div>
              <div class="aux-tl-ref">${escapeHtml(m.referencia_numero)}</div>
              <div class="aux-tl-meta">
                <span>🕐 ${hora}</span>
                ${m.cliente_nombre ? `<span>👤 ${escapeHtml(m.cliente_nombre)}</span>` : ''}
                ${m.firma_url ? '<span>🖊️ Firmado</span>' : ''}
              </div>
              ${m.notas ? `<div class="aux-tl-notas">💬 ${escapeHtml(m.notas)}</div>` : ''}
            </div>
          </div>`;
        });
        html += '</div>';
      });
      html += '</div>';
      bodyEl.innerHTML = html;
    } catch (err) {
      document.getElementById('aux-drawer-body').innerHTML = `
        <div class="aux-drawer-empty"><div class="aux-drawer-empty-icon">⚠️</div>
        <div>Error: ${escapeHtml(err.message)}</div></div>`;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
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
