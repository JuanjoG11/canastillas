/**
 * app.js - Controlador principal (async/await para Supabase)
 * Control de Canastas PWA
 */

const APP = (() => {

  let currentSection    = 'dashboard';
  let editingAuxiliarId = null;
  let historialFilters  = {};

  // ─── Bootstrap ─────────────────────────────────────────────────────────────

  async function init() {
    UI.setLoading(true);
    try {
      await DB.init();
    } catch (e) {
      console.warn('DB init warning:', e);
    }

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
    const user = AUTH.getCurrentUser();
    document.getElementById('current-user').textContent = user || '';
    await navigateTo('dashboard');
  }

  // ─── Event bindings ────────────────────────────────────────────────────────

  function bindGlobalEvents() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    document.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', () => navigateTo(el.dataset.nav));
    });

    document.querySelectorAll('[data-mov-tab]').forEach(tab => {
      tab.addEventListener('click', () => switchMovTab(tab.dataset.movTab));
    });

    document.getElementById('form-salida-auxiliar').addEventListener('submit', handleSalidaAuxiliar);
    document.getElementById('form-entrada-auxiliar').addEventListener('submit', handleEntradaAuxiliar);
    document.getElementById('form-entrada-cliente').addEventListener('submit', handleEntradaCliente);
    document.getElementById('form-salida-cliente').addEventListener('submit', handleSalidaCliente);

    document.getElementById('entrada-aux-select').addEventListener('change', updateEntradaAuxInfo);
    document.getElementById('salida-cliente-select').addEventListener('change', updateSalidaClienteInfo);

    document.getElementById('form-auxiliar').addEventListener('submit', handleAuxiliarSubmit);
    document.getElementById('btn-cancel-auxiliar').addEventListener('click', resetAuxiliarForm);

    document.getElementById('btn-apply-filters').addEventListener('click', applyHistorialFilters);
    document.getElementById('btn-clear-filters').addEventListener('click', clearHistorialFilters);
    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

    document.getElementById('form-config').addEventListener('submit', handleConfigSubmit);
    document.getElementById('btn-reset-data').addEventListener('click', handleResetData);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('SW registration failed:', err);
      });
    }
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');

    try {
      AUTH.login(username, password);
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
      onConfirm: () => {
        AUTH.logout();
        showLogin();
      },
    });
  }

  // ─── Navegación ────────────────────────────────────────────────────────────

  async function navigateTo(section) {
    currentSection = section;
    UI.showSection(section);
    UI.setLoading(true);

    try {
      switch (section) {
        case 'dashboard':
          await UI.renderDashboard();
          break;
        case 'movimiento':
          await switchMovTab('salida-auxiliar');
          break;
        case 'auxiliares':
          await UI.renderAuxiliares();
          resetAuxiliarForm();
          break;
        case 'historial':
          await populateHistorialFilters();
          await UI.renderHistorial(historialFilters);
          break;
        case 'configuracion':
          await UI.renderConfiguracion();
          break;
      }
    } catch (err) {
      UI.toast('Error cargando sección: ' + err.message, 'error');
    }

    UI.setLoading(false);
  }

  // ─── Tabs de movimiento ────────────────────────────────────────────────────

  async function switchMovTab(tab) {
    document.querySelectorAll('[data-mov-tab]').forEach(t => {
      t.classList.toggle('active', t.dataset.movTab === tab);
    });
    document.querySelectorAll('.mov-panel').forEach(p => {
      p.classList.toggle('hidden', p.id !== `panel-${tab}`);
    });

    try {
      switch (tab) {
        case 'salida-auxiliar':
          await UI.populateAuxiliarSelect('salida-aux-select');
          break;
        case 'entrada-auxiliar':
          await UI.populateAuxiliarSelect('entrada-aux-select');
          await updateEntradaAuxInfo();
          break;
        case 'salida-cliente':
          await UI.populateClientePrestamos('salida-cliente-select');
          await updateSalidaClienteInfo();
          break;
      }
    } catch (err) {
      console.warn('switchMovTab error:', err);
    }
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
      const cantInput = document.getElementById('entrada-aux-cantidad');
      if (cantInput) cantInput.max = canastas;
    } catch {}
  }

  async function updateSalidaClienteInfo() {
    const prestamo_id = document.getElementById('salida-cliente-select').value;
    const infoEl      = document.getElementById('salida-cliente-info');
    if (!prestamo_id) { infoEl.classList.add('hidden'); return; }

    try {
      const estado   = await DB.getEstado();
      const prestamo = (estado.canastas_clientes_prestadas || []).find(p => p.id === prestamo_id);
      if (prestamo) {
        infoEl.textContent = `Préstamo de ${prestamo.cliente}: ${prestamo.cantidad} canastas disponibles para devolver`;
        infoEl.classList.remove('hidden');
        const cantInput = document.getElementById('salida-cliente-cantidad');
        if (cantInput) cantInput.max = prestamo.cantidad;
      }
    } catch {}
  }

  // ─── Handlers de movimiento ────────────────────────────────────────────────

  async function handleSalidaAuxiliar(e) {
    e.preventDefault();
    await submitMovimiento({
      tipo:        'salida_auxiliar',
      cantidad:    document.getElementById('salida-aux-cantidad').value,
      auxiliar_id: document.getElementById('salida-aux-select').value,
      notas:       document.getElementById('salida-aux-notas').value,
    }, 'form-salida-auxiliar', async () => {
      await UI.populateAuxiliarSelect('salida-aux-select');
    });
  }

  async function handleEntradaAuxiliar(e) {
    e.preventDefault();
    await submitMovimiento({
      tipo:        'entrada_auxiliar',
      cantidad:    document.getElementById('entrada-aux-cantidad').value,
      auxiliar_id: document.getElementById('entrada-aux-select').value,
      notas:       document.getElementById('entrada-aux-notas').value,
    }, 'form-entrada-auxiliar', async () => {
      await UI.populateAuxiliarSelect('entrada-aux-select');
      await updateEntradaAuxInfo();
    });
  }

  async function handleEntradaCliente(e) {
    e.preventDefault();
    await submitMovimiento({
      tipo:           'entrada_cliente',
      cantidad:       document.getElementById('entrada-cliente-cantidad').value,
      cliente_nombre: document.getElementById('entrada-cliente-nombre').value,
      notas:          document.getElementById('entrada-cliente-notas').value,
    }, 'form-entrada-cliente');
  }

  async function handleSalidaCliente(e) {
    e.preventDefault();
    await submitMovimiento({
      tipo:                'salida_cliente',
      cantidad:            document.getElementById('salida-cliente-cantidad').value,
      cliente_prestamo_id: document.getElementById('salida-cliente-select').value,
      notas:               document.getElementById('salida-cliente-notas').value,
    }, 'form-salida-cliente', async () => {
      await UI.populateClientePrestamos('salida-cliente-select');
      await updateSalidaClienteInfo();
    });
  }

  async function submitMovimiento(data, formId, afterSuccess = null) {
    UI.setLoading(true);
    try {
      // Invalida cache antes de operar para tener estado fresco
      DB.invalidateCache();
      const mov = await DB.registrarMovimiento({
        ...data,
        admin_registrador: AUTH.getCurrentUser(),
      });
      UI.toast(`✓ Movimiento registrado: ${mov.referencia_numero}`, 'success');
      document.getElementById(formId).reset();
      document.querySelectorAll('.field-info').forEach(el => el.classList.add('hidden'));
      if (afterSuccess) await afterSuccess();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
    UI.setLoading(false);
  }

  // ─── Auxiliares CRUD ──────────────────────────────────────────────────────

  async function handleAuxiliarSubmit(e) {
    e.preventDefault();
    const nombre = document.getElementById('aux-nombre').value.trim();
    const cedula = document.getElementById('aux-cedula').value.trim();

    if (!nombre || !cedula) {
      UI.toast('Nombre y cédula son obligatorios', 'error');
      return;
    }

    UI.setLoading(true);
    try {
      if (editingAuxiliarId) {
        await DB.updateAuxiliar(editingAuxiliarId, { nombre, cedula });
        UI.toast('Auxiliar actualizado correctamente', 'success');
      } else {
        await DB.addAuxiliar(nombre, cedula);
        UI.toast('Auxiliar registrado correctamente', 'success');
      }
      resetAuxiliarForm();
      await UI.renderAuxiliares();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
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
      body: `¿Está seguro que desea ${activate ? 'activar' : 'desactivar'} a <strong>${UI.escapeHtml(aux.nombre)}</strong>?`,
      confirmLabel: activate ? 'Activar' : 'Desactivar',
      danger: !activate,
      onConfirm: async () => {
        UI.setLoading(true);
        try {
          if (activate) await DB.reactivateAuxiliar(id);
          else          await DB.deactivateAuxiliar(id);
          UI.toast(`Auxiliar ${activate ? 'activado' : 'desactivado'}`, 'success');
          await UI.renderAuxiliares();
        } catch (err) {
          UI.toast(err.message, 'error');
        }
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
      opt.value = 'todos';
      opt.textContent = '-- Todos los auxiliares --';
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
    try {
      await UI.renderHistorial(historialFilters);
    } catch (err) {
      UI.toast('Error al filtrar: ' + err.message, 'error');
    }
    UI.setLoading(false);
  }

  async function clearHistorialFilters() {
    historialFilters = {};
    document.getElementById('filter-fecha-desde').value = '';
    document.getElementById('filter-fecha-hasta').value = '';
    document.getElementById('filter-tipo').value = 'todos';
    const auxSel = document.getElementById('filter-auxiliar');
    if (auxSel) auxSel.value = 'todos';
    UI.setLoading(true);
    await UI.renderHistorial({});
    UI.setLoading(false);
  }

  async function exportCSV() {
    UI.setLoading(true);
    try {
      const csv  = await DB.exportCSV();
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `movimientos-canastas-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      UI.toast('CSV exportado correctamente', 'success');
    } catch (err) {
      UI.toast('Error al exportar: ' + err.message, 'error');
    }
    UI.setLoading(false);
  }

  // ─── Configuración ─────────────────────────────────────────────────────────

  async function handleConfigSubmit(e) {
    e.preventDefault();
    const cantidad = parseInt(document.getElementById('config-inventario').value, 10);
    if (isNaN(cantidad) || cantidad < 0) {
      UI.toast('Ingrese una cantidad válida', 'error');
      return;
    }

    UI.showModal({
      title: 'Actualizar Inventario',
      body: `¿Establecer el inventario de bodega en <strong>${cantidad} canastas</strong>?<br><br>
             <em class="text-muted">Esto reemplazará el conteo actual en bodega.</em>`,
      confirmLabel: 'Actualizar',
      onConfirm: async () => {
        UI.setLoading(true);
        try {
          await DB.setInventarioInicial(cantidad);
          UI.toast('Inventario actualizado correctamente', 'success');
          await UI.renderConfiguracion();
        } catch (err) {
          UI.toast(err.message, 'error');
        }
        UI.setLoading(false);
      },
    });
  }

  async function handleResetData() {
    UI.showModal({
      title: '⚠️ Reiniciar Todos los Datos',
      body: `<p><strong>Esta acción eliminará TODOS los movimientos</strong> y reseteará el estado al inicial.</p>
             <p style="margin-top:.5rem"><strong>Esta acción no se puede deshacer.</strong></p>`,
      confirmLabel: 'Reiniciar datos',
      danger: true,
      onConfirm: async () => {
        UI.setLoading(true);
        try {
          await DB.resetData();
          UI.toast('Datos reiniciados correctamente', 'success');
          await UI.renderConfiguracion();
        } catch (err) {
          UI.toast(err.message, 'error');
        }
        UI.setLoading(false);
      },
    });
  }

  // Public API
  return {
    init,
    navigateTo,
    editAuxiliar,
    toggleAuxiliar,
    resetAuxiliarForm,
    exportCSV,
  };
})();

document.addEventListener('DOMContentLoaded', APP.init);
