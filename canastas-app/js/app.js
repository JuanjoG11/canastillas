/**
 * app.js - Controlador principal
 * Control de Canastas PWA
 */

const APP = (() => {

  let currentSection    = 'dashboard';
  let editingAuxiliarId = null;
  let historialFilters  = {};

  // ─── Bootstrap ─────────────────────────────────────────────────────────────
  async function init() {
    UI.setLoading(true);
    try { await DB.init(); } catch (e) { console.warn('DB init warning:', e); }

    if (AUTH.isLoggedIn()) {
      await showApp();
    } else {
      showLogin();
    }
    bindGlobalEvents();
    UI.setLoading(false);
  }

  function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('login-username').focus();
  }

  async function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('current-user').textContent = AUTH.getCurrentUser() || '';
    await navigateTo('dashboard');
  }

  // ─── Bindings ──────────────────────────────────────────────────────────────
  function bindGlobalEvents() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    document.querySelectorAll('[data-nav]').forEach(el =>
      el.addEventListener('click', () => navigateTo(el.dataset.nav))
    );
    document.querySelectorAll('[data-mov-tab]').forEach(tab =>
      tab.addEventListener('click', () => switchMovTab(tab.dataset.movTab))
    );

    document.getElementById('form-salida-auxiliar').addEventListener('submit', handleSalidaAuxiliar);
    document.getElementById('form-entrada-auxiliar').addEventListener('submit', handleEntradaAuxiliar);
    document.getElementById('form-entrada-cliente').addEventListener('submit', handleEntradaCliente);
    document.getElementById('form-salida-cliente').addEventListener('submit', handleSalidaCliente);

    document.getElementById('entrada-aux-select').addEventListener('change', updateEntradaAuxInfo);
    document.getElementById('salida-cliente-select').addEventListener('change', updateSalidaClienteInfo);

    // Búsqueda rápida de auxiliar (filtra el select en tiempo real)
    document.querySelectorAll('.aux-search').forEach(input => {
      const selectId = input.dataset.for;
      input.addEventListener('input', () => {
        const q   = input.value.toLowerCase();
        const sel = document.getElementById(selectId);
        if (!sel) return;
        Array.from(sel.options).forEach(opt => {
          if (!opt.value) return;
          opt.style.display = opt.text.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    });

    document.getElementById('form-auxiliar').addEventListener('submit', handleAuxiliarSubmit);
    document.getElementById('btn-cancel-auxiliar').addEventListener('click', resetAuxiliarForm);

    document.getElementById('btn-apply-filters').addEventListener('click', applyHistorialFilters);
    document.getElementById('btn-clear-filters').addEventListener('click', clearHistorialFilters);
    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

    document.getElementById('form-config').addEventListener('submit', handleConfigSubmit);
    document.getElementById('btn-reset-data').addEventListener('click', handleResetData);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    try {
      AUTH.login(
        document.getElementById('login-username').value,
        document.getElementById('login-password').value
      );
      errEl.classList.add('hidden');
      await showApp();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
      document.getElementById('login-password').value = '';
    }
  }

  function handleLogout() {
    UI.showModal({
      title: 'Cerrar Sesión',
      body: '¿Está seguro que desea cerrar sesión?',
      confirmLabel: 'Cerrar sesión',
      onConfirm: () => { AUTH.logout(); showLogin(); },
    });
  }

  // ─── Navegación ────────────────────────────────────────────────────────────
  async function navigateTo(section) {
    currentSection = section;
    UI.showSection(section);
    UI.setLoading(true);
    try {
      switch (section) {
        case 'dashboard':    await UI.renderDashboard(); break;
        case 'movimiento':   await switchMovTab('salida-auxiliar'); break;
        case 'auxiliares':   await UI.renderAuxiliares(); resetAuxiliarForm(); break;
        case 'historial':    await populateHistorialFilters(); await UI.renderHistorial(historialFilters, 1); break;
        case 'configuracion': await UI.renderConfiguracion(); break;
      }
    } catch (err) {
      UI.toast('Error cargando sección: ' + err.message, 'error');
    }
    UI.setLoading(false);
  }

  // ─── Tabs ──────────────────────────────────────────────────────────────────
  async function switchMovTab(tab) {
    document.querySelectorAll('[data-mov-tab]').forEach(t =>
      t.classList.toggle('active', t.dataset.movTab === tab)
    );
    document.querySelectorAll('.mov-panel').forEach(p =>
      p.classList.toggle('hidden', p.id !== `panel-${tab}`)
    );
    try {
      if (tab === 'salida-auxiliar')  await UI.populateAuxiliarSelect('salida-aux-select');
      if (tab === 'entrada-auxiliar') { await UI.populateAuxiliarSelect('entrada-aux-select'); await updateEntradaAuxInfo(); }
      if (tab === 'salida-cliente')   { await UI.populateClientePrestamos('salida-cliente-select'); await updateSalidaClienteInfo(); }
    } catch (err) { console.warn('switchMovTab:', err); }
  }

  async function updateEntradaAuxInfo() {
    const auxId  = document.getElementById('entrada-aux-select').value;
    const infoEl = document.getElementById('entrada-aux-info');
    if (!auxId) { infoEl.classList.add('hidden'); return; }
    try {
      const estado   = await DB.getEstado();
      const canastas = (estado.canastas_con_auxiliares || {})[auxId] || 0;
      infoEl.textContent = `Este auxiliar tiene ${canastas} canasta(s) fuera actualmente`;
      infoEl.classList.remove('hidden');
      const ci = document.getElementById('entrada-aux-cantidad');
      if (ci) ci.max = canastas;
    } catch {}
  }

  async function updateSalidaClienteInfo() {
    const pid    = document.getElementById('salida-cliente-select').value;
    const infoEl = document.getElementById('salida-cliente-info');
    if (!pid) { infoEl.classList.add('hidden'); return; }
    try {
      const estado   = await DB.getEstado();
      const prestamo = (estado.canastas_clientes_prestadas || []).find(p => p.id === pid);
      if (prestamo) {
        infoEl.textContent = `Préstamo de ${prestamo.cliente}: ${prestamo.cantidad} canastas disponibles`;
        infoEl.classList.remove('hidden');
        const ci = document.getElementById('salida-cliente-cantidad');
        if (ci) ci.max = prestamo.cantidad;
      }
    } catch {}
  }

  // ─── Confirmación de movimiento ────────────────────────────────────────────
  // Construye un resumen legible antes de confirmar
  async function buildConfirmBody({ tipo, cantidad, auxiliar_id, cliente_nombre, cliente_prestamo_id, turno }) {
    const tipoLabel = UI.TIPO_LABELS[tipo] || tipo;
    const turnoStr  = turno ? ` — Turno <strong>${turno}</strong>` : '';
    let quien = '';

    if (auxiliar_id) {
      const aux = await DB.getAuxiliarById(auxiliar_id);
      quien = aux ? `con <strong>${UI.escapeHtml(aux.nombre)}</strong>` : '';
    } else if (cliente_prestamo_id) {
      const estado   = await DB.getEstado();
      const prestamo = (estado.canastas_clientes_prestadas || []).find(p => p.id === cliente_prestamo_id);
      quien = prestamo ? `para <strong>${UI.escapeHtml(prestamo.cliente)}</strong>` : '';
    } else if (cliente_nombre) {
      quien = `de <strong>${UI.escapeHtml(cliente_nombre)}</strong>`;
    }

    return `¿Registrar <strong>${tipoLabel}</strong> de <strong>${cantidad} canastas</strong> ${quien}${turnoStr}?`;
  }

  // ─── Handlers de movimiento con confirmación ───────────────────────────────
  async function handleSalidaAuxiliar(e) {
    e.preventDefault();
    const data = {
      tipo:        'salida_auxiliar',
      cantidad:    document.getElementById('salida-aux-cantidad').value,
      auxiliar_id: document.getElementById('salida-aux-select').value,
      turno:       document.getElementById('salida-aux-turno').value,
      notas:       document.getElementById('salida-aux-notas').value,
    };
    await confirmarYRegistrar(data, 'form-salida-auxiliar', async () => {
      await UI.populateAuxiliarSelect('salida-aux-select');
    });
  }

  async function handleEntradaAuxiliar(e) {
    e.preventDefault();
    const data = {
      tipo:        'entrada_auxiliar',
      cantidad:    document.getElementById('entrada-aux-cantidad').value,
      auxiliar_id: document.getElementById('entrada-aux-select').value,
      turno:       document.getElementById('entrada-aux-turno').value,
      notas:       document.getElementById('entrada-aux-notas').value,
    };
    await confirmarYRegistrar(data, 'form-entrada-auxiliar', async () => {
      await UI.populateAuxiliarSelect('entrada-aux-select');
      await updateEntradaAuxInfo();
    });
  }

  async function handleEntradaCliente(e) {
    e.preventDefault();
    const data = {
      tipo:           'entrada_cliente',
      cantidad:       document.getElementById('entrada-cliente-cantidad').value,
      cliente_nombre: document.getElementById('entrada-cliente-nombre').value,
      turno:          document.getElementById('entrada-cliente-turno').value,
      notas:          document.getElementById('entrada-cliente-notas').value,
    };
    await confirmarYRegistrar(data, 'form-entrada-cliente');
  }

  async function handleSalidaCliente(e) {
    e.preventDefault();
    const data = {
      tipo:                'salida_cliente',
      cantidad:            document.getElementById('salida-cliente-cantidad').value,
      cliente_prestamo_id: document.getElementById('salida-cliente-select').value,
      turno:               document.getElementById('salida-cliente-turno').value,
      notas:               document.getElementById('salida-cliente-notas').value,
    };
    await confirmarYRegistrar(data, 'form-salida-cliente', async () => {
      await UI.populateClientePrestamos('salida-cliente-select');
      await updateSalidaClienteInfo();
    });
  }

  async function confirmarYRegistrar(data, formId, afterSuccess = null) {
    // Validación básica antes de mostrar modal
    if (!data.cantidad || parseInt(data.cantidad) <= 0) {
      UI.toast('Ingresa una cantidad válida', 'error'); return;
    }
    if ((data.tipo === 'salida_auxiliar' || data.tipo === 'entrada_auxiliar') && !data.auxiliar_id) {
      UI.toast('Selecciona un auxiliar', 'error'); return;
    }
    if (data.tipo === 'entrada_cliente' && !data.cliente_nombre?.trim()) {
      UI.toast('Ingresa el nombre del cliente', 'error'); return;
    }
    if (data.tipo === 'salida_cliente' && !data.cliente_prestamo_id) {
      UI.toast('Selecciona el préstamo del cliente', 'error'); return;
    }

    const body = await buildConfirmBody(data);

    UI.showModal({
      title: '¿Confirmar movimiento?',
      body,
      confirmLabel: '✓ Confirmar',
      cancelLabel: 'Revisar',
      onConfirm: async () => {
        UI.setLoading(true);
        try {
          DB.invalidateCache();
          const mov = await DB.registrarMovimiento({
            ...data,
            admin_registrador: AUTH.getCurrentUser(),
          });
          UI.toast(`✓ Registrado: ${mov.referencia_numero}`, 'success');
          document.getElementById(formId).reset();
          document.querySelectorAll('.field-info').forEach(el => el.classList.add('hidden'));
          if (afterSuccess) await afterSuccess();
        } catch (err) {
          UI.toast(err.message, 'error');
        }
        UI.setLoading(false);
      },
    });
  }

  // ─── Auxiliares CRUD ──────────────────────────────────────────────────────
  async function handleAuxiliarSubmit(e) {
    e.preventDefault();
    const nombre = document.getElementById('aux-nombre').value.trim();
    const cedula = document.getElementById('aux-cedula').value.trim();
    if (!nombre || !cedula) { UI.toast('Nombre y cédula son obligatorios', 'error'); return; }

    UI.setLoading(true);
    try {
      if (editingAuxiliarId) {
        await DB.updateAuxiliar(editingAuxiliarId, { nombre, cedula });
        UI.toast('Auxiliar actualizado', 'success');
      } else {
        await DB.addAuxiliar(nombre, cedula);
        UI.toast('Auxiliar registrado', 'success');
      }
      resetAuxiliarForm();
      await UI.renderAuxiliares();
    } catch (err) { UI.toast(err.message, 'error'); }
    UI.setLoading(false);
  }

  async function editAuxiliar(id) {
    const aux = await DB.getAuxiliarById(id);
    if (!aux) return;
    editingAuxiliarId = id;
    document.getElementById('aux-nombre').value = aux.nombre;
    document.getElementById('aux-cedula').value = aux.cedula;
    document.getElementById('form-auxiliar-title').textContent = 'Editar Auxiliar';
    document.getElementById('btn-cancel-auxiliar').classList.remove('hidden');
    document.getElementById('form-auxiliar').scrollIntoView({ behavior: 'smooth' });
  }

  async function toggleAuxiliar(id, activate) {
    const aux = await DB.getAuxiliarById(id);
    if (!aux) return;
    UI.showModal({
      title: `${activate ? 'Activar' : 'Desactivar'} Auxiliar`,
      body: `¿${activate ? 'Activar' : 'Desactivar'} a <strong>${UI.escapeHtml(aux.nombre)}</strong>?`,
      confirmLabel: activate ? 'Activar' : 'Desactivar',
      danger: !activate,
      onConfirm: async () => {
        UI.setLoading(true);
        try {
          activate ? await DB.reactivateAuxiliar(id) : await DB.deactivateAuxiliar(id);
          UI.toast(`Auxiliar ${activate ? 'activado' : 'desactivado'}`, 'success');
          await UI.renderAuxiliares();
        } catch (err) { UI.toast(err.message, 'error'); }
        UI.setLoading(false);
      },
    });
  }

  function resetAuxiliarForm() {
    editingAuxiliarId = null;
    document.getElementById('form-auxiliar').reset();
    document.getElementById('form-auxiliar-title').textContent = 'Nuevo Auxiliar';
    document.getElementById('btn-cancel-auxiliar').classList.add('hidden');
  }

  // ─── Historial ─────────────────────────────────────────────────────────────
  async function populateHistorialFilters() {
    await UI.populateAuxiliarSelect('filter-auxiliar', false);
    const sel = document.getElementById('filter-auxiliar');
    if (sel) {
      const opt = document.createElement('option');
      opt.value = 'todos'; opt.textContent = '-- Todos --';
      sel.insertBefore(opt, sel.firstChild);
      sel.value = historialFilters.auxiliar_id || 'todos';
    }
  }

  async function applyHistorialFilters() {
    historialFilters = {
      fechaDesde:  document.getElementById('filter-fecha-desde').value || null,
      fechaHasta:  document.getElementById('filter-fecha-hasta').value || null,
      tipo:        document.getElementById('filter-tipo').value || 'todos',
      auxiliar_id: document.getElementById('filter-auxiliar').value || 'todos',
    };
    UI.setLoading(true);
    try { await UI.renderHistorial(historialFilters, 1); }
    catch (err) { UI.toast('Error al filtrar: ' + err.message, 'error'); }
    UI.setLoading(false);
  }

  async function clearHistorialFilters() {
    historialFilters = {};
    document.getElementById('filter-fecha-desde').value = '';
    document.getElementById('filter-fecha-hasta').value = '';
    document.getElementById('filter-tipo').value = 'todos';
    const s = document.getElementById('filter-auxiliar');
    if (s) s.value = 'todos';
    UI.setLoading(true);
    await UI.renderHistorial({}, 1);
    UI.setLoading(false);
  }

  async function exportCSV() {
    UI.setLoading(true);
    try {
      const csv  = await DB.exportCSV();
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `canastas-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      UI.toast('CSV exportado', 'success');
    } catch (err) { UI.toast('Error: ' + err.message, 'error'); }
    UI.setLoading(false);
  }

  // ─── Configuración ─────────────────────────────────────────────────────────
  async function handleConfigSubmit(e) {
    e.preventDefault();
    const cantidad = parseInt(document.getElementById('config-inventario').value, 10);
    if (isNaN(cantidad) || cantidad < 0) { UI.toast('Cantidad inválida', 'error'); return; }
    UI.showModal({
      title: 'Actualizar Inventario',
      body: `¿Establecer bodega en <strong>${cantidad} canastas</strong>?`,
      confirmLabel: 'Actualizar',
      onConfirm: async () => {
        UI.setLoading(true);
        try { await DB.setInventarioInicial(cantidad); UI.toast('Inventario actualizado', 'success'); await UI.renderConfiguracion(); }
        catch (err) { UI.toast(err.message, 'error'); }
        UI.setLoading(false);
      },
    });
  }

  async function handleResetData() {
    UI.showModal({
      title: '⚠️ Reiniciar Todos los Datos',
      body: '<p><strong>Se eliminarán TODOS los movimientos</strong> y el estado volverá a cero.</p><p style="margin-top:.5rem"><strong>No se puede deshacer.</strong></p>',
      confirmLabel: 'Reiniciar',
      danger: true,
      onConfirm: async () => {
        UI.setLoading(true);
        try { await DB.resetData(); UI.toast('Datos reiniciados', 'success'); await UI.renderConfiguracion(); }
        catch (err) { UI.toast(err.message, 'error'); }
        UI.setLoading(false);
      },
    });
  }

  return { init, navigateTo, editAuxiliar, toggleAuxiliar, resetAuxiliarForm, exportCSV };
})();

document.addEventListener('DOMContentLoaded', APP.init);
