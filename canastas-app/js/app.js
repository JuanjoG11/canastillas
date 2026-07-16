/**
 * app.js - Main application controller for Control de Canastas PWA
 */

const APP = (() => {
  // ─── State ───────────────────────────────────────────────────────────────────

  let currentSection = 'dashboard';
  let editingAuxiliarId = null;
  let historialFilters = {};

  // ─── Bootstrap ───────────────────────────────────────────────────────────────

  function init() {
    DB.init();

    if (AUTH.isLoggedIn()) {
      showApp();
    } else {
      showLogin();
    }

    bindGlobalEvents();
  }

  function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('login-username').focus();
  }

  function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');

    const user = AUTH.getCurrentUser();
    document.getElementById('current-user').textContent = user || '';

    navigateTo('dashboard');
  }

  // ─── Global event bindings ───────────────────────────────────────────────────

  function bindGlobalEvents() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Logout
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Nav items (bottom nav + sidebar)
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', () => navigateTo(el.dataset.nav));
    });

    // Movimiento tabs
    document.querySelectorAll('[data-mov-tab]').forEach(tab => {
      tab.addEventListener('click', () => switchMovTab(tab.dataset.movTab));
    });

    // Movimiento forms
    document.getElementById('form-salida-auxiliar').addEventListener('submit', handleSalidaAuxiliar);
    document.getElementById('form-entrada-auxiliar').addEventListener('submit', handleEntradaAuxiliar);
    document.getElementById('form-entrada-cliente').addEventListener('submit', handleEntradaCliente);
    document.getElementById('form-salida-cliente').addEventListener('submit', handleSalidaCliente);

    // Show canastas count when auxiliar selected (entrada)
    document.getElementById('entrada-aux-select').addEventListener('change', updateEntradaAuxInfo);

    // Show prestamo details when selected
    document.getElementById('salida-cliente-select').addEventListener('change', updateSalidaClienteInfo);

    // Auxiliar form
    document.getElementById('form-auxiliar').addEventListener('submit', handleAuxiliarSubmit);
    document.getElementById('btn-cancel-auxiliar').addEventListener('click', resetAuxiliarForm);

    // Historial filters
    document.getElementById('btn-apply-filters').addEventListener('click', applyHistorialFilters);
    document.getElementById('btn-clear-filters').addEventListener('click', clearHistorialFilters);
    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

    // Configuración
    document.getElementById('form-config').addEventListener('submit', handleConfigSubmit);
    document.getElementById('btn-reset-data').addEventListener('click', handleResetData);

    // Service worker update
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
          UI.toast('Nueva versión disponible. Recarga la página para actualizar.', 'info');
        });
      }).catch(err => console.warn('SW registration failed:', err));
    }
  }

  // ─── Auth handlers ───────────────────────────────────────────────────────────

  function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');

    try {
      AUTH.login(username, password);
      errEl.classList.add('hidden');
      showApp();
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
      cancelLabel: 'Cancelar',
      onConfirm: () => {
        AUTH.logout();
        showLogin();
      },
    });
  }

  // ─── Navigation ──────────────────────────────────────────────────────────────

  function navigateTo(section) {
    currentSection = section;
    UI.showSection(section);

    switch (section) {
      case 'dashboard':
        UI.renderDashboard();
        break;
      case 'movimiento':
        switchMovTab('salida-auxiliar');
        break;
      case 'auxiliares':
        UI.renderAuxiliares();
        resetAuxiliarForm();
        break;
      case 'historial':
        populateHistorialFilters();
        UI.renderHistorial(historialFilters);
        break;
      case 'configuracion':
        UI.renderConfiguracion();
        break;
    }
  }

  // ─── Movimiento tabs ─────────────────────────────────────────────────────────

  function switchMovTab(tab) {
    document.querySelectorAll('[data-mov-tab]').forEach(t => {
      t.classList.toggle('active', t.dataset.movTab === tab);
    });
    document.querySelectorAll('.mov-panel').forEach(p => {
      p.classList.toggle('hidden', p.id !== `panel-${tab}`);
    });

    // Refresh dynamic data on tab switch
    switch (tab) {
      case 'salida-auxiliar':
        UI.populateAuxiliarSelect('salida-aux-select');
        break;
      case 'entrada-auxiliar':
        UI.populateAuxiliarSelect('entrada-aux-select');
        updateEntradaAuxInfo();
        break;
      case 'salida-cliente':
        UI.populateClientePrestamos('salida-cliente-select');
        updateSalidaClienteInfo();
        break;
    }
  }

  function updateEntradaAuxInfo() {
    const auxId = document.getElementById('entrada-aux-select').value;
    const infoEl = document.getElementById('entrada-aux-info');
    if (!auxId) {
      infoEl.classList.add('hidden');
      return;
    }
    const estado = DB.getEstado();
    const canastas = estado.canastas_con_auxiliares[auxId] || 0;
    infoEl.textContent = `Este auxiliar tiene ${canastas} canasta(s) fuera actualmente`;
    infoEl.classList.remove('hidden');
    // Set max
    const cantInput = document.getElementById('entrada-aux-cantidad');
    if (cantInput) cantInput.max = canastas;
  }

  function updateSalidaClienteInfo() {
    const prestamo_id = document.getElementById('salida-cliente-select').value;
    const infoEl = document.getElementById('salida-cliente-info');
    if (!prestamo_id) {
      infoEl.classList.add('hidden');
      return;
    }
    const estado = DB.getEstado();
    const prestamo = estado.canastas_clientes_prestadas.find(p => p.id === prestamo_id);
    if (prestamo) {
      infoEl.textContent = `Préstamo de ${prestamo.cliente}: ${prestamo.cantidad} canastas disponibles para devolver`;
      infoEl.classList.remove('hidden');
      const cantInput = document.getElementById('salida-cliente-cantidad');
      if (cantInput) cantInput.max = prestamo.cantidad;
    }
  }

  // ─── Movimiento form handlers ────────────────────────────────────────────────

  function handleSalidaAuxiliar(e) {
    e.preventDefault();
    const auxId = document.getElementById('salida-aux-select').value;
    const cantidad = document.getElementById('salida-aux-cantidad').value;
    const notas = document.getElementById('salida-aux-notas').value;

    submitMovimiento({
      tipo: 'salida_auxiliar',
      cantidad,
      auxiliar_id: auxId,
      notas,
    }, 'form-salida-auxiliar');
  }

  function handleEntradaAuxiliar(e) {
    e.preventDefault();
    const auxId = document.getElementById('entrada-aux-select').value;
    const cantidad = document.getElementById('entrada-aux-cantidad').value;
    const notas = document.getElementById('entrada-aux-notas').value;

    submitMovimiento({
      tipo: 'entrada_auxiliar',
      cantidad,
      auxiliar_id: auxId,
      notas,
    }, 'form-entrada-auxiliar');
  }

  function handleEntradaCliente(e) {
    e.preventDefault();
    const nombre = document.getElementById('entrada-cliente-nombre').value;
    const cantidad = document.getElementById('entrada-cliente-cantidad').value;
    const notas = document.getElementById('entrada-cliente-notas').value;

    submitMovimiento({
      tipo: 'entrada_cliente',
      cantidad,
      cliente_nombre: nombre,
      notas,
    }, 'form-entrada-cliente');
  }

  function handleSalidaCliente(e) {
    e.preventDefault();
    const prestamo_id = document.getElementById('salida-cliente-select').value;
    const cantidad = document.getElementById('salida-cliente-cantidad').value;
    const notas = document.getElementById('salida-cliente-notas').value;

    submitMovimiento({
      tipo: 'salida_cliente',
      cantidad,
      cliente_prestamo_id: prestamo_id,
      notas,
    }, 'form-salida-cliente');
  }

  function submitMovimiento(data, formId) {
    try {
      const mov = DB.registrarMovimiento({
        ...data,
        admin_registrador: AUTH.getCurrentUser(),
      });
      UI.toast(`Movimiento registrado: ${mov.referencia_numero}`, 'success');
      document.getElementById(formId).reset();

      // Refresh info helpers after reset
      const infoEls = document.querySelectorAll('.field-info');
      infoEls.forEach(el => el.classList.add('hidden'));

    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  // ─── Auxiliares CRUD ─────────────────────────────────────────────────────────

  function handleAuxiliarSubmit(e) {
    e.preventDefault();
    const nombre = document.getElementById('aux-nombre').value.trim();
    const cedula = document.getElementById('aux-cedula').value.trim();

    if (!nombre || !cedula) {
      UI.toast('Nombre y cédula son obligatorios', 'error');
      return;
    }

    try {
      if (editingAuxiliarId) {
        DB.updateAuxiliar(editingAuxiliarId, { nombre, cedula });
        UI.toast('Auxiliar actualizado correctamente', 'success');
      } else {
        DB.addAuxiliar(nombre, cedula);
        UI.toast('Auxiliar registrado correctamente', 'success');
      }
      resetAuxiliarForm();
      UI.renderAuxiliares();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  function editAuxiliar(id) {
    const aux = DB.getAuxiliarById(id);
    if (!aux) return;

    editingAuxiliarId = id;
    document.getElementById('aux-nombre').value = aux.nombre;
    document.getElementById('aux-cedula').value = aux.cedula;
    document.getElementById('form-auxiliar-title').textContent = 'Editar Auxiliar';
    document.getElementById('btn-cancel-auxiliar').classList.remove('hidden');

    // Scroll to form
    document.getElementById('form-auxiliar').scrollIntoView({ behavior: 'smooth' });
  }

  function toggleAuxiliar(id, activate) {
    const aux = DB.getAuxiliarById(id);
    if (!aux) return;

    const action = activate ? 'activar' : 'desactivar';
    UI.showModal({
      title: `${activate ? 'Activar' : 'Desactivar'} Auxiliar`,
      body: `¿Está seguro que desea ${action} a <strong>${UI.escapeHtml(aux.nombre)}</strong>?`,
      confirmLabel: activate ? 'Activar' : 'Desactivar',
      danger: !activate,
      onConfirm: () => {
        try {
          if (activate) {
            DB.reactivateAuxiliar(id);
          } else {
            DB.deactivateAuxiliar(id);
          }
          UI.toast(`Auxiliar ${activate ? 'activado' : 'desactivado'}`, 'success');
          UI.renderAuxiliares();
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      },
    });
  }

  function resetAuxiliarForm() {
    editingAuxiliarId = null;
    document.getElementById('form-auxiliar').reset();
    document.getElementById('form-auxiliar-title').textContent = 'Nuevo Auxiliar';
    document.getElementById('btn-cancel-auxiliar').classList.add('hidden');
  }

  // ─── Historial ────────────────────────────────────────────────────────────────

  function populateHistorialFilters() {
    UI.populateAuxiliarSelect('filter-auxiliar', false);
    // Add "todos" option at start
    const sel = document.getElementById('filter-auxiliar');
    if (sel) {
      const opt = document.createElement('option');
      opt.value = 'todos';
      opt.textContent = '-- Todos los auxiliares --';
      sel.insertBefore(opt, sel.firstChild);
      sel.value = historialFilters.auxiliar_id || 'todos';
    }
  }

  function applyHistorialFilters() {
    historialFilters = {
      fechaDesde: document.getElementById('filter-fecha-desde').value || null,
      fechaHasta: document.getElementById('filter-fecha-hasta').value || null,
      tipo: document.getElementById('filter-tipo').value || 'todos',
      auxiliar_id: document.getElementById('filter-auxiliar').value || 'todos',
    };
    UI.renderHistorial(historialFilters);
  }

  function clearHistorialFilters() {
    historialFilters = {};
    document.getElementById('filter-fecha-desde').value = '';
    document.getElementById('filter-fecha-hasta').value = '';
    document.getElementById('filter-tipo').value = 'todos';
    const auxSel = document.getElementById('filter-auxiliar');
    if (auxSel) auxSel.value = 'todos';
    UI.renderHistorial({});
  }

  function exportCSV() {
    const csv = DB.exportCSV();
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movimientos-canastas-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.toast('CSV exportado correctamente', 'success');
  }

  // ─── Configuración ────────────────────────────────────────────────────────────

  function handleConfigSubmit(e) {
    e.preventDefault();
    const cantidad = parseInt(document.getElementById('config-inventario').value, 10);
    if (isNaN(cantidad) || cantidad < 0) {
      UI.toast('Ingrese una cantidad válida', 'error');
      return;
    }

    UI.showModal({
      title: 'Actualizar Inventario',
      body: `¿Está seguro que desea establecer el inventario de bodega en <strong>${cantidad} canastas</strong>?<br><br>
             <em class="text-muted">Esto reemplazará el conteo actual en bodega.</em>`,
      confirmLabel: 'Actualizar',
      onConfirm: () => {
        try {
          DB.setInventarioInicial(cantidad);
          UI.toast('Inventario actualizado correctamente', 'success');
          UI.renderConfiguracion();
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      },
    });
  }

  function handleResetData() {
    UI.showModal({
      title: '⚠️ Reiniciar Todos los Datos',
      body: `<p><strong>Esta acción eliminará TODOS los datos de la aplicación</strong>, incluyendo:</p>
             <ul style="margin: 8px 0 8px 16px;">
               <li>Todos los movimientos</li>
               <li>Estado actual de canastas</li>
               <li>Auxiliares registrados</li>
             </ul>
             <p>Los datos volverán al estado inicial de demostración. <strong>Esta acción no se puede deshacer.</strong></p>`,
      confirmLabel: 'Reiniciar datos',
      cancelLabel: 'Cancelar',
      danger: true,
      onConfirm: () => {
        DB.resetData();
        UI.toast('Datos reiniciados correctamente', 'success');
        UI.renderConfiguracion();
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

// ─── Bootstrap on DOM ready ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', APP.init);
