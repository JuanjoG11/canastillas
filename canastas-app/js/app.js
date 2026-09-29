/**
 * app.js — Controlador principal v3
 * Control de Canastas PWA · Alpina
 */

const APP = (() => {

  let viajesFiltros = {};
  let auxiliaresFiltros = {};

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOTSTRAP
  // ═══════════════════════════════════════════════════════════════════════════

  async function init() {
    UI.setLoading(true);
    try { await DB.init(); } catch (e) { console.warn('DB init:', e); }
    if (AUTH.isLoggedIn()) { await showApp(); } else { showLogin(); }
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
    const user = AUTH.getCurrentUser() || '';
    document.getElementById('current-user').textContent = user;
    const av = document.getElementById('user-avatar-initial');
    if (av) av.textContent = user ? user[0].toUpperCase() : 'U';
    await navigateTo('dashboard');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  function bindGlobalEvents() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Navegación
    document.querySelectorAll('[data-nav]').forEach(el =>
      el.addEventListener('click', () => navigateTo(el.dataset.nav))
    );

    // Botones nuevo despacho
    document.getElementById('btn-nuevo-viaje')?.addEventListener('click', abrirFormularioDespacho);
    document.getElementById('btn-nuevo-viaje-dash')?.addEventListener('click', abrirFormularioDespacho);
    document.getElementById('btn-nuevo-viaje-sidebar')?.addEventListener('click', abrirFormularioDespacho);

    // Filtros viajes
    document.getElementById('btn-vf-filtrar')?.addEventListener('click', aplicarFiltrosViajes);
    document.getElementById('btn-vf-limpiar')?.addEventListener('click', limpiarFiltrosViajes);
    document.getElementById('btn-vf-csv')?.addEventListener('click', exportarViajesCSV);
    document.getElementById('vf-auxiliar-txt')?.addEventListener('input', () => {
      if (!document.getElementById('vf-auxiliar-txt').value.trim())
        document.getElementById('vf-auxiliar').value = '';
    });

    // Búsqueda conductores
    document.getElementById('search-conductores-input')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('#conductores-list .persona-card').forEach(c => {
        c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });

    // Filtros auxiliares
    document.getElementById('btn-af-filtrar')?.addEventListener('click', aplicarFiltrosAuxiliares);
    document.getElementById('btn-af-limpiar')?.addEventListener('click', limpiarFiltrosAuxiliares);

    // Búsqueda clientes
    document.getElementById('btn-nuevo-cliente')?.addEventListener('click', abrirFormularioNuevoCliente);
    document.getElementById('search-clientes-input')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('#clientes-kardex-list .persona-card').forEach(c => {
        c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });

    // Configuración
    document.getElementById('form-inventario-inicial')?.addEventListener('submit', handleInventarioSubmit);
    document.getElementById('btn-reset-viajes')?.addEventListener('click', handleResetViajes);

    // Drawer
    document.getElementById('drawer-close')?.addEventListener('click', closeDrawer);
    document.getElementById('drawer-overlay')?.addEventListener('click', e => {
      if (e.target === document.getElementById('drawer-overlay')) closeDrawer();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

    // Service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data?.type === 'QUEUE_FLUSHED') UI.toast('✓ Operaciones offline sincronizadas', 'success');
      });
    }
    window.addEventListener('offline', () => UI.toast('Sin conexión — cambios se sincronizarán al reconectar', 'info'));
    window.addEventListener('online', () => {
      UI.toast('Conexión restaurada', 'success');
      navigator.serviceWorker?.ready.then(sw => sw.sync?.register('sync-queue').catch(() => {}));
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════════════════════════

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
      title: 'Cerrar sesión',
      body: '¿Seguro que deseas cerrar sesión?',
      confirmLabel: 'Cerrar sesión',
      onConfirm: () => { AUTH.logout(); showLogin(); },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NAVEGACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async function navigateTo(section) {
    UI.showSection(section);
    UI.setLoading(true);
    try {
      switch (section) {
        case 'dashboard':
          await UI_VIAJES.renderDashboard();
          break;

        case 'viajes':
          await UI_VIAJES.renderViajes(viajesFiltros);
          try {
            const auxs = await DB.getAuxiliares(false);
            _bindInlineSearch('vf-auxiliar-txt', 'vf-auxiliar-list', 'vf-auxiliar',
              auxs, a => a.nombre, a => `CC: ${a.cedula}`);
          } catch (_) {}
          break;

        case 'retornos':
          await UI_VIAJES.renderRetornos();
          break;

        case 'conductores':
          await UI_VIAJES.renderConductores();
          break;

        case 'auxiliares':
          await UI.renderAuxiliares(auxiliaresFiltros);
          break;

        case 'zonas':
          await UI_ZONAS.renderDashboardZonas();
          break;

        case 'carga-excel':
          UI.showSection('zonas');
          await UI_ZONAS.renderDashboardZonas();
          abrirCargaExcel();
          break;

        case 'configuracion':
          await UI_VIAJES.renderConfiguracion();
          break;

        case 'clientes-dashboard':
          await UI_CLIENTES.renderDashboardClientes();
          break;

        case 'clientes':
          await UI_CLIENTES.renderClientes();
          break;
      }
    } catch (err) {
      UI.toast('Error: ' + err.message, 'error');
    }
    UI.setLoading(false);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DRAWER
  // ═══════════════════════════════════════════════════════════════════════════

  function openDrawer(title, html) {
    document.getElementById('drawer-title').textContent = title;
    document.getElementById('drawer-body').innerHTML = html;
    document.getElementById('drawer-overlay').classList.remove('hidden');
  }

  function closeDrawer() {
    document.getElementById('drawer-overlay').classList.add('hidden');
    document.getElementById('drawer-body').innerHTML = '';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMULARIO NUEVO DESPACHO
  // ═══════════════════════════════════════════════════════════════════════════

  async function abrirFormularioDespacho() {
    UI.setLoading(true);
    DB_VIAJES.invalidateCache();
    DB.invalidateCache();

    let conductores = [], auxiliares = [], stockHoy = [];
    try {
      [conductores, auxiliares] = await Promise.all([
        DB_VIAJES.getConductores(true),
        DB.getAuxiliares(true),
      ]);
    } catch (err) {
      UI.setLoading(false);
      UI.toast('Error al cargar datos: ' + err.message, 'error');
      return;
    }
    try { stockHoy = await DB_ZONAS.getStockHoy(); } catch (_) {}
    UI.setLoading(false);

    if (auxiliares.length === 0) {
      openDrawer('🚛 Nuevo Despacho', `
        <div class="field-info" style="border-left-color:var(--danger);background:var(--danger-light);color:#991B1B;margin-bottom:1rem">
          ⚠️ <strong>No hay auxiliares registrados.</strong><br>
          El auxiliar es el responsable del viaje. Agrega uno primero.
        </div>
        <button class="btn btn-primary btn-block" id="btn-crear-primer-auxiliar">+ Agregar auxiliar</button>
      `);
      document.getElementById('btn-crear-primer-auxiliar')?.addEventListener('click', async () => {
        const nombre = prompt('Nombre del auxiliar:');
        if (!nombre?.trim()) return;
        const cedula = prompt('Cédula:');
        if (cedula === null) return;
        UI.setLoading(true);
        try {
          await DB.addAuxiliar(nombre.trim().toUpperCase(), cedula.trim() || Date.now().toString());
          UI.toast('Auxiliar creado. Abre el formulario de nuevo.', 'success');
          closeDrawer();
        } catch (err) { UI.toast(err.message, 'error'); }
        UI.setLoading(false);
      });
      return;
    }

    const zonasOpts = stockHoy.map(s => {
      const total = (s.grandes || 0) + (s.pequenas || 0);
      return `<option value="${UI.escapeHtml(s.zona_id)}">${UI.escapeHtml(s.zona_id)} · ${total} cubetas (${s.grandes || 0}G · ${s.pequenas || 0}P)</option>`;
    }).join('');

    const cantFields = [
      ['desp-grandes',  'Grandes'],
      ['desp-pequenas', 'Pequeñas'],
      ['desp-estibas',  'Estibas'],
    ];

    openDrawer('🚛 Nuevo Despacho', `
      <form id="form-despacho" novalidate>

        <div class="form-group" style="margin-bottom:1.25rem">
          <label style="font-size:.9rem;font-weight:700;color:var(--gray-800);margin-bottom:.5rem;display:flex;align-items:center;justify-content:space-between">
            <span>👷 Auxiliar <strong style="color:var(--brand)">(Responsable del Viaje) *</strong></span>
            <span style="font-size:.75rem;font-weight:700;color:var(--danger)">Obligatorio</span>
          </label>
          <div style="position:relative">
            <input id="desp-auxiliar-txt" class="form-control" type="text" placeholder="Buscar auxiliar por nombre o cédula..." autocomplete="off" style="font-size:1rem;padding:.75rem 1rem" />
            <input type="hidden" id="desp-auxiliar" />
            <div id="desp-auxiliar-list" class="inline-search-list hidden"></div>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:1.25rem">
          <label style="font-size:.9rem;font-weight:700;color:var(--gray-700);margin-bottom:.5rem;display:flex;align-items:center;justify-content:space-between">
            <span>🧑‍✈️ Conductor <span style="font-weight:400;color:var(--gray-500)">(Transportador / Opcional)</span></span>
            <span style="font-size:.75rem;font-weight:400;color:var(--gray-500)">Opcional</span>
          </label>
          <div style="position:relative">
            <input id="desp-conductor-txt" class="form-control" type="text" placeholder="Buscar conductor o dejar vacío..." autocomplete="off" style="font-size:1rem;padding:.75rem 1rem" />
            <input type="hidden" id="desp-conductor" />
            <div id="desp-conductor-list" class="inline-search-list hidden"></div>
          </div>
          <div id="desp-conductor-nuevo" class="hidden" style="margin-top:.5rem">
            <button type="button" id="btn-crear-conductor" class="btn btn-outline btn-sm">+ Crear conductor nuevo</button>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:1.25rem">
          <label style="font-size:.9rem;font-weight:700;color:var(--gray-700);margin-bottom:.5rem;display:block">📍 Zona (batch)</label>
          <select id="desp-zona" class="form-control" style="font-size:1rem;padding:.75rem 1rem;min-height:52px">
            <option value="">— Sin zona asignada —</option>
            ${zonasOpts}
          </select>
          <div id="desp-zona-stock" style="margin-top:.5rem;font-size:.85rem;color:var(--gray-500)">Selecciona una zona para ver el stock disponible</div>
        </div>

        <div style="background:var(--gray-50);border:2px solid var(--border);border-radius:var(--radius);padding:1.25rem 1rem;margin-bottom:1.25rem">
          <div style="font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--brand);margin-bottom:1rem">📤 Material despachado</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.875rem">
            ${cantFields.map(([id, label]) => `
              <div>
                <div class="spinbox-label">${label}</div>
                <div class="spinbox">
                  <button type="button" class="spinbox-btn minus" data-target="${id}">−</button>
                  <input id="${id}" type="number" min="0" value="0" />
                  <button type="button" class="spinbox-btn plus" data-target="${id}">+</button>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <div class="form-group" style="margin-bottom:1.5rem">
          <label style="font-size:.9rem;font-weight:700;color:var(--gray-700);margin-bottom:.5rem;display:block">💬 Observaciones</label>
          <textarea id="desp-obs" class="form-control" rows="2" placeholder="Notas opcionales..." style="font-size:.9375rem;padding:.75rem 1rem;resize:none"></textarea>
        </div>

        <button type="submit" class="btn btn-primary btn-block" style="padding:1rem;font-size:1.0625rem;font-weight:800;border-radius:var(--radius-sm)">
          ✓ Registrar Despacho
        </button>
      </form>
    `);

    // Autocomplete conductor
    _bindInlineSearch('desp-conductor-txt', 'desp-conductor-list', 'desp-conductor',
      conductores, c => c.nombre, c => c.cedula ? `CC: ${c.cedula}` : '',
      query => {
        const div = document.getElementById('desp-conductor-nuevo');
        if (!div) return;
        if (query.trim().length >= 3) {
          div.classList.remove('hidden');
          const btn = document.getElementById('btn-crear-conductor');
          if (btn) btn.textContent = `+ Crear "${query.trim()}"`;
        } else {
          div.classList.add('hidden');
        }
      }
    );

    // Crear conductor al vuelo
    document.getElementById('btn-crear-conductor')?.addEventListener('click', async () => {
      const nombre = document.getElementById('desp-conductor-txt').value.trim();
      if (!nombre) return;
      const cedula = prompt(`Cédula de ${nombre}:`);
      if (cedula === null) return;
      UI.setLoading(true);
      try {
        const nuevo = await DB_VIAJES.addConductor(nombre.toUpperCase(), cedula.trim() || Date.now().toString());
        conductores.push(nuevo);
        DB_VIAJES.invalidateCache();
        document.getElementById('desp-conductor').value = nuevo.id;
        document.getElementById('desp-conductor-txt').value = nuevo.nombre;
        document.getElementById('desp-conductor-nuevo').classList.add('hidden');
        UI.toast(`Conductor "${nuevo.nombre}" creado`, 'success');
      } catch (err) { UI.toast(err.message, 'error'); }
      UI.setLoading(false);
    });

    // Autocomplete auxiliar
    _bindInlineSearch('desp-auxiliar-txt', 'desp-auxiliar-list', 'desp-auxiliar',
      auxiliares, a => a.nombre, a => `CC: ${a.cedula}`);

    // Zona → mostrar stock
    document.getElementById('desp-zona')?.addEventListener('change', async e => {
      const zonaId = e.target.value;
      const infoEl = document.getElementById('desp-zona-stock');
      if (!infoEl) return;
      if (!zonaId) { infoEl.textContent = 'Selecciona una zona para ver el stock disponible'; return; }
      try {
        const s = await DB_ZONAS.getStockZonaHoy(zonaId);
        if (!s) {
          infoEl.innerHTML = `<span style="color:var(--warning)">⚠️ Sin stock cargado hoy para esta zona</span>`;
          return;
        }
        const total = (s.grandes || 0) + (s.pequenas || 0);
        infoEl.innerHTML = `<span style="color:var(--success);font-weight:700">✓ Disponible: ${s.grandes || 0}G · ${s.pequenas || 0}P <strong>(${total} total)</strong></span>`;
      } catch (_) { infoEl.textContent = 'Error al cargar stock'; }
    });

    // Spinboxes
    document.querySelectorAll('#drawer-body .spinbox-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const inp = document.getElementById(btn.dataset.target);
        if (!inp) return;
        const v = parseInt(inp.value || '0', 10);
        inp.value = btn.classList.contains('plus') ? v + 1 : Math.max(0, v - 1);
      });
    });

    // Submit despacho
    document.getElementById('form-despacho')?.addEventListener('submit', async e => {
      e.preventDefault();
      const auxiliar_id  = document.getElementById('desp-auxiliar').value;
      const conductor_id = document.getElementById('desp-conductor').value || null;
      if (!auxiliar_id) {
        UI.toast('El auxiliar responsable es obligatorio', 'error');
        return;
      }
      UI.setLoading(true);
      try {
        const zona_id = document.getElementById('desp-zona')?.value || null;
        const viaje = await DB_VIAJES.registrarViaje({
          conductor_id, auxiliar_id, zona_id,
          placa: '', remolque: '',
          numero_factura: null,
          desp_grandes:   document.getElementById('desp-grandes').value,
          desp_medianas:  '0',
          desp_pequenas:  document.getElementById('desp-pequenas').value,
          desp_estibas:   document.getElementById('desp-estibas').value,
          observaciones:  document.getElementById('desp-obs').value,
          admin_registrador: AUTH.getCurrentUser(),
        });
        DB_VIAJES.invalidateCache();

        // Descontar stock de zona
        if (zona_id) {
          try {
            await DB_ZONAS.descontarStock(
              zona_id,
              parseInt(document.getElementById('desp-grandes').value || '0'),
              parseInt(document.getElementById('desp-pequenas').value || '0'),
            );
          } catch (ze) { console.warn('descontarStock:', ze.message); }
        }

        closeDrawer();
        UI.setLoading(false);

        // Firma del auxiliar responsable
        const condNombre = conductores.find(c => c.id === conductor_id)?.nombre || '';
        const auxNombre  = auxiliares.find(a => a.id === auxiliar_id)?.nombre || 'Auxiliar Responsable';
        const firmaUrl = await FIRMA.solicitarFirmaViaje({
          tipo: 'despacho', numeroViaje: viaje.numero_viaje,
          conductorNombre: condNombre, auxiliarNombre: auxNombre,
        });
        if (firmaUrl) {
          await DB_VIAJES.guardarFirmaDespacho(viaje.id, firmaUrl);
          UI.toast(`✓ Despacho ${viaje.numero_viaje} registrado y firmado por auxiliar`, 'success');
        } else {
          UI.toast(`✓ Despacho ${viaje.numero_viaje} registrado a cargo de ${auxNombre}`, 'success');
        }
        await navigateTo('viajes');
      } catch (err) {
        UI.toast(err.message, 'error');
        UI.setLoading(false);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARGA DE EXCEL (ZONAS)
  // ═══════════════════════════════════════════════════════════════════════════

  function abrirCargaExcel() {
    openDrawer('📂 Cargar Stock Diario', `
      <div style="margin-bottom:1.25rem">
        <div style="font-size:.875rem;color:var(--gray-600);line-height:1.65;margin-bottom:1rem;padding:.75rem 1rem;background:var(--brand-light);border-radius:var(--radius-sm);border-left:3px solid var(--brand)">
          Sube el archivo Excel con columnas <strong>batch</strong>, <strong>Cubeta Grande</strong> y <strong>Cubeta pequeña</strong>.
          El valor <strong>1</strong> indica el tipo de cubeta de esa fila. Se agrupa por batch y reemplaza el stock de hoy.
        </div>
        <div id="zona-drop-area"
          style="background:var(--gray-50);border:2px dashed var(--border-strong);border-radius:var(--radius);padding:2.5rem 1.5rem;text-align:center;cursor:pointer;transition:background var(--transition)"
          ondragover="event.preventDefault();this.style.background='var(--brand-light)'"
          ondragleave="this.style.background='var(--gray-50)'"
          ondrop="APP._handleZonaDrop(event)">
          <div style="font-size:2.5rem;margin-bottom:.75rem">📋</div>
          <div style="font-weight:800;color:var(--gray-700);font-size:1rem;margin-bottom:.375rem">Arrastra el archivo aquí</div>
          <div style="font-size:.875rem;color:var(--gray-500);margin-bottom:1.125rem">o selecciónalo manualmente</div>
          <label class="btn btn-secondary" style="cursor:pointer;display:inline-flex">
            📁 Seleccionar archivo
            <input type="file" id="zona-file-input" accept=".xlsx,.xls,.csv,.tsv"
              style="display:none" onchange="APP._handleZonaFile(this.files[0])" />
          </label>
        </div>
      </div>
      <div id="zona-preview" style="display:none">
        <hr class="divider" />
        <div id="zona-preview-content"></div>
        <button class="btn btn-primary btn-block btn-lg" id="zona-btn-cargar" style="margin-top:1.25rem">
          ✓ Confirmar carga
        </button>
      </div>
    `);
  }

  async function _handleZonaDrop(e) {
    e.preventDefault();
    const area = document.getElementById('zona-drop-area');
    if (area) area.style.background = 'var(--gray-50)';
    const file = e.dataTransfer?.files?.[0];
    if (file) await _handleZonaFile(file);
  }

  async function _handleZonaFile(file) {
    if (!file) return;
    UI.setLoading(true);
    try {
      const rows = await DB_ZONAS.parsearArchivoExcel(file);
      _mostrarPreviewZonas(rows, file.name);
    } catch (err) {
      UI.toast('Error al leer archivo: ' + err.message, 'error');
    }
    UI.setLoading(false);
  }

  function _mostrarPreviewZonas(rows, fileName) {
    const preview = document.getElementById('zona-preview');
    const content = document.getElementById('zona-preview-content');
    if (!preview || !content) return;

    const totG = rows.reduce((s, r) => s + (r.grandes  || 0), 0);
    const totP = rows.reduce((s, r) => s + (r.pequenas || 0), 0);

    content.innerHTML = `
      <div style="font-size:.875rem;font-weight:700;color:var(--gray-700);margin-bottom:.875rem">
        📋 Vista previa — ${UI.escapeHtml(fileName)}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.625rem;margin-bottom:1rem">
        <div class="zona-kpi" style="--kc:var(--gray-500)">
          <div class="zona-kpi-label">Zonas</div>
          <div class="zona-kpi-value">${rows.length}</div>
        </div>
        <div class="zona-kpi" style="--kc:var(--brand)">
          <div class="zona-kpi-label">Grandes</div>
          <div class="zona-kpi-value">${totG}</div>
        </div>
        <div class="zona-kpi" style="--kc:var(--success)">
          <div class="zona-kpi-label">Pequeñas</div>
          <div class="zona-kpi-value">${totP}</div>
        </div>
      </div>
      <div class="table-wrapper" style="max-height:280px;overflow-y:auto">
        <table class="data-table" style="font-size:.8125rem">
          <thead>
            <tr>
              <th>Zona (batch)</th>
              <th class="th-num">Grandes</th>
              <th class="th-num">Pequeñas</th>
              <th class="th-num">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const tot = (r.grandes || 0) + (r.pequenas || 0);
              return `<tr>
                <td><strong style="font-family:monospace">${UI.escapeHtml(r.batch)}</strong></td>
                <td class="td-num">${r.grandes || 0}</td>
                <td class="td-num">${r.pequenas || 0}</td>
                <td class="td-num"><strong>${tot}</strong></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    preview.style.display = 'block';

    document.getElementById('zona-btn-cargar')?.addEventListener('click', async () => {
      UI.setLoading(true);
      try {
        const res = await DB_ZONAS.cargarStockDiario(rows, AUTH.getCurrentUser());
        closeDrawer();
        UI.toast(`✓ ${res.zonas} zonas cargadas · ${res.grandes}G · ${res.pequenas}P`, 'success');
        await navigateTo('zonas');
      } catch (err) {
        UI.toast('Error al guardar: ' + err.message, 'error');
      }
      UI.setLoading(false);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMULARIO RETORNO
  // ═══════════════════════════════════════════════════════════════════════════


  async function abrirFormularioRetorno(viajeId) {
    const viaje = await DB_VIAJES.getViajeById(viajeId);
    if (!viaje) return;

    const [conductores, auxiliares] = await Promise.all([
      DB_VIAJES.getConductores(),
      DB.getAuxiliares(),
    ]);
    const condNombre = conductores.find(c => c.id === viaje.conductor_id)?.nombre || '—';
    const auxNombre  = auxiliares.find(a => a.id === viaje.auxiliar_id)?.nombre || '—';

    const retFields = [
      ['ret-grandes',  'Grandes',  '🧺'],
      ['ret-pequenas', 'Pequeñas', '🧺'],
      ['ret-estibas',  'Estibas',  '🪵'],
    ];

    openDrawer('📥 Registrar Retorno', `
      <div style="background:var(--gray-50);border:1px solid var(--border);border-radius:var(--radius-sm);padding:1rem 1.125rem;margin-bottom:1.25rem">
        <div style="font-size:1.0625rem;font-weight:800;color:var(--gray-800);margin-bottom:.25rem">${UI.escapeHtml(viaje.numero_viaje)}</div>
        <div style="font-size:.875rem;font-weight:700;color:var(--gray-900)">👷 Auxiliar (Responsable): ${UI.escapeHtml(auxNombre)}</div>
        ${condNombre && condNombre !== '—' ? `<div style="font-size:.78rem;color:var(--gray-500);margin-top:.15rem">🧑‍✈️ Conductor: ${UI.escapeHtml(condNombre)}</div>` : ''}
        ${viaje.placa ? `<div style="font-size:.8125rem;font-weight:600;color:var(--gray-700);margin-top:.25rem">🚛 Placa: ${UI.escapeHtml(viaje.placa)}</div>` : ''}
        <div style="margin-top:.625rem;background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;border-radius:var(--radius-xs);padding:.5rem .75rem;font-size:.75rem;display:flex;align-items:center;gap:.4rem">
          <span>🔒</span>
          <span><strong>Conteo a ciegas:</strong> Ingresa el material contado físicamente al descargar.</span>
        </div>
      </div>

      <form id="form-retorno" novalidate>
        <div style="font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--success);margin-bottom:.875rem">📥 Material retornado (físico)</div>
        <div style="display:flex;flex-direction:column;gap:.75rem;margin-bottom:1.25rem">
          ${retFields.map(([id, label, icon]) => `
            <div style="background:var(--gray-50);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.75rem 1rem;display:flex;align-items:center;justify-content:space-between">
              <div style="display:flex;align-items:center;gap:.6rem">
                <span style="font-size:1.4rem">${icon}</span>
                <div>
                  <div style="font-size:.95rem;font-weight:800;color:var(--gray-800)">${label}</div>
                  <div style="font-size:.75rem;color:var(--gray-500)">Unidades recibidas</div>
                </div>
              </div>
              <div class="spinbox" style="margin:0">
                <button type="button" class="spinbox-btn minus" data-target="${id}">−</button>
                <input id="${id}" type="number" min="0" value="" placeholder="0" style="color:var(--success);font-weight:800;font-size:1.2rem;width:75px;text-align:center" />
                <button type="button" class="spinbox-btn plus" data-target="${id}">+</button>
              </div>
            </div>`).join('')}
        </div>
        <div id="ret-live-alert" style="margin-bottom:1.25rem">
          <div style="background:var(--gray-50);border:1px dashed var(--gray-300);border-radius:var(--radius-sm);padding:.85rem;text-align:center;color:var(--gray-500);font-size:.8125rem">
            🔒 <strong>Conteo a ciegas activo:</strong> Ingresa las cantidades contadas físicamente en descarga.
          </div>
        </div>
        <button id="btn-submit-retorno" type="submit" class="btn btn-secondary btn-block" style="padding:1rem;font-size:1.0625rem;font-weight:800;border-radius:var(--radius-sm)">
          ✓ Confirmar Retorno
        </button>
      </form>
    `);

    const liveAlertEl = document.getElementById('ret-live-alert');
    const submitBtn   = document.getElementById('btn-submit-retorno');

    function actualizarAlertaRetorno() {
      const gInput = document.getElementById('ret-grandes');
      const pInput = document.getElementById('ret-pequenas');
      const eInput = document.getElementById('ret-estibas');
      if (!gInput || !pInput || !eInput || !liveAlertEl || !submitBtn) return;

      const gVal = gInput.value.trim();
      const pVal = pInput.value.trim();
      const eVal = eInput.value.trim();

      if (gVal === '' && pVal === '' && eVal === '') {
        liveAlertEl.innerHTML = `
          <div style="background:var(--gray-50);border:1px dashed var(--gray-300);border-radius:var(--radius-sm);padding:.85rem;text-align:center;color:var(--gray-500);font-size:.8125rem">
            🔒 <strong>Conteo a ciegas activo:</strong> Ingresa las cantidades contadas físicamente en descarga.
          </div>
        `;
        submitBtn.textContent = '✓ Confirmar Retorno';
        submitBtn.className = 'btn btn-secondary btn-block';
        return;
      }

      const retG = parseInt(gVal || '0', 10);
      const retP = parseInt(pVal || '0', 10);
      const retE = parseInt(eVal || '0', 10);

      const difG = retG - (viaje.desp_grandes || 0);
      const difP = retP - (viaje.desp_pequenas || 0);
      const difE = retE - (viaje.desp_estibas || 0);
      const difTotal = difG + difP + difE;
      const hayDiferencia = difG !== 0 || difP !== 0 || difE !== 0;

      if (!hayDiferencia) {
        liveAlertEl.innerHTML = `
          <div style="background:#F0FDF4;border:2px solid #22C55E;border-radius:var(--radius-sm);padding:.875rem 1rem;display:flex;align-items:center;gap:.75rem;animation:fadeIn .15s ease">
            <span style="font-size:1.6rem;line-height:1">✅</span>
            <div>
              <div style="font-size:.95rem;font-weight:900;color:#15803D">¡Conteo Exacto!</div>
              <div style="font-size:.8rem;color:#166534">Coincide 100% con lo despachado.</div>
            </div>
          </div>
        `;
        submitBtn.textContent = '✓ Confirmar Retorno Exacto';
        submitBtn.className = 'btn btn-success btn-block';
      } else {
        const faltan = difTotal < 0;
        liveAlertEl.innerHTML = `
          <div style="background:#FEF2F2;border:2px solid #EF4444;border-radius:var(--radius-sm);padding:1rem;box-shadow:0 4px 12px rgba(239,68,68,.12);animation:fadeIn .15s ease">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem;padding-bottom:.5rem;border-bottom:1.5px dashed #FCA5A5">
              <div style="display:flex;align-items:center;gap:.5rem">
                <span style="font-size:1.5rem;line-height:1">🚨</span>
                <div style="font-size:1rem;font-weight:900;color:#991B1B">
                  ALERTA: Diferencia de ${difTotal > 0 ? '+' : ''}${difTotal}
                </div>
              </div>
              <span style="background:${faltan ? '#DC2626' : '#D97706'};color:#fff;font-size:.72rem;font-weight:900;padding:.25rem .6rem;border-radius:5px;text-transform:uppercase;letter-spacing:.04em">
                ${faltan ? 'Faltante (' + difTotal + ')' : 'Sobrante (+' + difTotal + ')'}
              </span>
            </div>
            <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.5rem">
              ${difG !== 0 ? `<span style="background:${difG<0?'#FEE2E2':'#DCFCE7'};color:${difG<0?'#B91C1C':'#15803D'};font-weight:800;font-size:.82rem;padding:.35rem .65rem;border-radius:6px;border:1px solid ${difG<0?'#FCA5A5':'#86EFAC'}">Grandes: ${difG > 0 ? '+' : ''}${difG} ${difG < 0 ? '(faltan)' : '(sobran)'}</span>` : ''}
              ${difP !== 0 ? `<span style="background:${difP<0?'#FEE2E2':'#DCFCE7'};color:${difP<0?'#B91C1C':'#15803D'};font-weight:800;font-size:.82rem;padding:.35rem .65rem;border-radius:6px;border:1px solid ${difP<0?'#FCA5A5':'#86EFAC'}">Pequeñas: ${difP > 0 ? '+' : ''}${difP} ${difP < 0 ? '(faltan)' : '(sobran)'}</span>` : ''}
              ${difE !== 0 ? `<span style="background:${difE<0?'#FEE2E2':'#DCFCE7'};color:${difE<0?'#B91C1C':'#15803D'};font-weight:800;font-size:.82rem;padding:.35rem .65rem;border-radius:6px;border:1px solid ${difE<0?'#FCA5A5':'#86EFAC'}">Estibas: ${difE > 0 ? '+' : ''}${difE} ${difE < 0 ? '(faltan)' : '(sobran)'}</span>` : ''}
            </div>
            <div style="font-size:.78rem;color:#7F1D1D;line-height:1.4">
              ⚠️ <strong>Atención:</strong> El conteo físico no cuadra con el despacho. Revisa el vehículo o confirma para registrar la novedad.
            </div>
          </div>
        `;
        submitBtn.textContent = `⚠️ Confirmar con Diferencia (${difTotal > 0 ? '+' : ''}${difTotal})`;
        submitBtn.className = 'btn btn-warning btn-block';
      }
    }

    // Spinboxes retorno
    document.querySelectorAll('#drawer-body .spinbox-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const inp = document.getElementById(btn.dataset.target);
        if (!inp) return;
        const v = parseInt(inp.value || '0', 10);
        inp.value = btn.classList.contains('plus') ? v + 1 : Math.max(0, v - 1);
        actualizarAlertaRetorno();
      });
    });

    ['ret-grandes', 'ret-pequenas', 'ret-estibas'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', actualizarAlertaRetorno);
    });

    document.getElementById('form-retorno')?.addEventListener('submit', async e => {
      e.preventDefault();

      const retG = parseInt(document.getElementById('ret-grandes')?.value || '0', 10);
      const retP = parseInt(document.getElementById('ret-pequenas')?.value || '0', 10);
      const retE = parseInt(document.getElementById('ret-estibas')?.value || '0', 10);

      // Calcular diferencias silenciosamente contra lo despachado (SOLO Grandes, Pequeñas, Estibas)
      const difG = retG - (viaje.desp_grandes || 0);
      const difP = retP - (viaje.desp_pequenas || 0);
      const difE = retE - (viaje.desp_estibas || 0);
      const difTotal = difG + difP + difE;
      const hayDiferencia = difG !== 0 || difP !== 0 || difE !== 0;

      // Si hay diferencia, avisar silenciosamente al usuario mediante modal premium
      if (hayDiferencia) {
        const partes = [];
        if (difG !== 0) partes.push({ label: 'Grandes', dif: difG });
        if (difP !== 0) partes.push({ label: 'Pequeñas', dif: difP });
        if (difE !== 0) partes.push({ label: 'Estibas', dif: difE });

        const modalTitle = `
          <div style="display:flex;align-items:center;gap:.6rem">
            <span style="font-size:1.6rem;line-height:1">⚠️</span>
            <div style="text-align:left">
              <div style="font-size:1.15rem;font-weight:900;color:var(--gray-900);line-height:1.2">Diferencia en el Retorno</div>
              <div style="font-size:.78rem;font-weight:600;color:var(--gray-500);margin-top:.15rem">Verificación de descarga a ciegas</div>
            </div>
          </div>
        `;

        const modalBody = `
          <div style="background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:var(--radius-sm);padding:1rem;margin:.5rem 0 1.25rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;padding-bottom:.5rem;border-bottom:1px dashed #FCD34D">
              <span style="font-size:.8rem;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:.05em">Diferencia neta</span>
              <span style="font-size:1.25rem;font-weight:900;color:${difTotal < 0 ? 'var(--danger)' : 'var(--success)'}">
                ${difTotal > 0 ? '+' : ''}${difTotal} canastilla${Math.abs(difTotal) !== 1 ? 's' : ''}
              </span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(${partes.length}, 1fr);gap:.375rem;text-align:center">
              ${partes.map(p => `
                <div style="background:${p.dif < 0 ? '#FEE2E2' : p.dif > 0 ? '#DCFCE7' : 'var(--white)'};
                            border:1px solid ${p.dif < 0 ? '#FECACA' : p.dif > 0 ? '#BBF7D0' : '#E2E8F0'};
                            border-radius:var(--radius-xs);padding:.45rem .25rem">
                  <div style="font-size:.65rem;font-weight:800;color:var(--gray-500);text-transform:uppercase">${p.label}</div>
                  <div style="font-size:1.15rem;font-weight:900;color:${p.dif < 0 ? 'var(--danger)' : p.dif > 0 ? 'var(--success)' : 'var(--gray-700)'}">
                    ${p.dif > 0 ? '+' : ''}${p.dif}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          <div style="background:var(--gray-50);border:1px solid var(--border);border-radius:var(--radius-xs);padding:.75rem .9rem;font-size:.84rem;color:var(--gray-600);line-height:1.5">
            El conteo que ingresaste tiene descuadre con el despacho. Puedes <strong>recontar el vehículo</strong> si consideras que hubo una equivocación, o <strong>confirmar</strong> para dejar registrada la diferencia y pasar a la firma.
          </div>
        `;

        const confirmar = await UI.confirmModal({
          title: modalTitle,
          body: modalBody,
          confirmLabel: '✓ Confirmar con diferencia',
          cancelLabel: '🔍 Recontar material',
          confirmClass: 'btn btn-warning',
        });

        if (!confirmar) {
          return;
        }
      }

      UI.setLoading(true);
      try {
        const viajeAct = await DB_VIAJES.registrarRetorno(
          viajeId,
          retG,
          0,
          retP,
          retE,
        );
        DB_VIAJES.invalidateCache();
        closeDrawer();
        UI.setLoading(false);

        const firmaUrl = await FIRMA.solicitarFirmaViaje({
          tipo: 'retorno', numeroViaje: viajeAct.numero_viaje,
          conductorNombre: (condNombre !== '—' ? condNombre : ''), auxiliarNombre: auxNombre,
        });
        if (firmaUrl) {
          await DB_VIAJES.guardarFirmaRetorno(viajeAct.id, firmaUrl);
          if (difTotal !== 0) {
            UI.toast(`⚠️ Retorno registrado y firmado con diferencia (${difTotal > 0 ? '+' : ''}${difTotal})`, 'warning');
          } else {
            UI.toast('✓ Retorno registrado y firmado exacto', 'success');
          }
        } else {
          if (difTotal !== 0) {
            UI.toast(`⚠️ Retorno registrado sin firma con diferencia (${difTotal > 0 ? '+' : ''}${difTotal})`, 'warning');
          } else {
            UI.toast('✓ Retorno registrado exacto sin firma', 'success');
          }
        }
        await navigateTo('retornos');
      } catch (err) {
        UI.toast(err.message, 'error');
        UI.setLoading(false);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DETALLE VIAJE
  // ═══════════════════════════════════════════════════════════════════════════

  async function verDetalleViaje(viajeId) {
    const viaje = await DB_VIAJES.getViajeById(viajeId);
    if (!viaje) return;

    const [conductores, auxiliares] = await Promise.all([
      DB_VIAJES.getConductores(),
      DB.getAuxiliares(),
    ]);
    const condNombre = conductores.find(c => c.id === viaje.conductor_id)?.nombre || '—';
    const auxNombre  = auxiliares.find(a => a.id === viaje.auxiliar_id)?.nombre || '—';

    const difG = viaje.ret_grandes  !== null ? viaje.ret_grandes  - viaje.desp_grandes  : null;
    const difP = viaje.ret_pequenas !== null ? viaje.ret_pequenas - viaje.desp_pequenas : null;
    const difE = viaje.ret_estibas  !== null ? viaje.ret_estibas  - viaje.desp_estibas  : null;

    const fmt = v => v === null ? '—' : `<span class="${v < 0 ? 'neg' : v > 0 ? 'pos' : ''}">${v > 0 ? '+' : ''}${v}</span>`;

    const BADGE = { abierto: 'badge-orange', cerrado: 'badge-green', anulado: 'badge-gray' };
    const LABEL = { abierto: 'Pendiente', cerrado: 'Cerrado', anulado: 'Anulado' };

    const retBlock = viaje.ret_grandes !== null
      ? `<div class="detalle-row"><span>Retorno:</span><span>${viaje.ret_grandes}G · ${viaje.ret_pequenas}P · ${viaje.ret_estibas}E</span></div>
         <div class="detalle-row"><span>Diferencia:</span><span>${fmt(difG)}G · ${fmt(difP)}P · ${fmt(difE)}E</span></div>`
      : `<div class="field-info">Sin retorno registrado.</div>`;

    openDrawer(`🚛 ${UI.escapeHtml(viaje.numero_viaje)}`, `
      <div class="detalle-grid">
        <div class="detalle-row"><span>Fecha:</span><span>${viaje.fecha}</span></div>
        <div class="detalle-row"><span>Auxiliar (Responsable):</span><strong style="color:var(--gray-900)">👷 ${UI.escapeHtml(auxNombre)}</strong></div>
        <div class="detalle-row"><span>Conductor:</span><span>🧑‍✈️ ${UI.escapeHtml(condNombre)}</span></div>
        ${viaje.zona_id ? `<div class="detalle-row"><span>Zona:</span><span><strong>${UI.escapeHtml(viaje.zona_id)}</strong></span></div>` : ''}
        <div class="detalle-row"><span>Despachado:</span><span>${viaje.desp_grandes}G · ${viaje.desp_pequenas}P · ${viaje.desp_estibas}E</span></div>
        ${retBlock}
        ${viaje.observaciones ? `<div class="detalle-row"><span>Obs:</span><span>${UI.escapeHtml(viaje.observaciones)}</span></div>` : ''}
        <div class="detalle-row"><span>Estado:</span><span><span class="badge ${BADGE[viaje.estado] || 'badge-gray'}">${LABEL[viaje.estado] || viaje.estado}</span></span></div>
        ${viaje.firma_despacho_url ? `<div class="detalle-row"><span>Firma despacho:</span><span><button class="btn btn-sm btn-secondary" onclick="APP.verFirmaViaje('${viaje.firma_despacho_url}','Firma Despacho')">🖊 Ver</button></span></div>` : ''}
        ${viaje.firma_retorno_url  ? `<div class="detalle-row"><span>Firma retorno:</span><span><button class="btn btn-sm btn-secondary" onclick="APP.verFirmaViaje('${viaje.firma_retorno_url}','Firma Retorno')">🖊 Ver</button></span></div>` : ''}
      </div>
      <div style="display:flex;gap:.5rem;margin-top:1.25rem;flex-wrap:wrap">
        ${viaje.estado === 'abierto' ? `<button class="btn btn-primary btn-sm" onclick="APP.abrirFormularioRetorno('${viaje.id}')">Registrar retorno</button>` : ''}
        ${viaje.estado === 'abierto' ? `<button class="btn btn-secondary btn-sm" onclick="APP.abrirFormularioEditarViaje('${viaje.id}')">✏️ Editar</button>` : ''}
        ${viaje.estado !== 'anulado' ? `<button class="btn btn-danger btn-sm" onclick="APP.confirmarAnularViaje('${viaje.id}','${UI.escapeHtml(viaje.numero_viaje)}')">Anular</button>` : ''}
      </div>
    `);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EDITAR VIAJE
  // ═══════════════════════════════════════════════════════════════════════════

  async function abrirFormularioEditarViaje(viajeId) {
    const viaje = await DB_VIAJES.getViajeById(viajeId);
    if (!viaje) return;
    if (viaje.estado !== 'abierto') { UI.toast('Solo se pueden editar viajes pendientes', 'error'); return; }

    openDrawer(`✏️ Editar ${UI.escapeHtml(viaje.numero_viaje)}`, `
      <div class="field-info" style="margin-bottom:1rem">Solo se pueden editar las cantidades mientras el viaje esté pendiente.</div>
      <form id="form-editar-viaje" novalidate>
        <div class="form-section-label">📤 Cantidades despachadas</div>
        <div class="form-row-4">
          ${[['edit-grandes','Grandes',viaje.desp_grandes],['edit-pequenas','Pequeñas',viaje.desp_pequenas],['edit-estibas','Estibas',viaje.desp_estibas]].map(([id,l,v]) =>
            `<div class="form-group"><label>${l}</label><input id="${id}" class="form-control" type="number" min="0" value="${v}" /></div>`
          ).join('')}
        </div>
        <div class="form-group">
          <label>Observaciones</label>
          <textarea id="edit-obs" class="form-control">${UI.escapeHtml(viaje.observaciones || '')}</textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">Guardar cambios</button>
      </form>
    `);

    document.getElementById('form-editar-viaje')?.addEventListener('submit', async e => {
      e.preventDefault();
      UI.setLoading(true);
      try {
        await DB_VIAJES.editarViaje(viajeId, {
          numero_factura: null,
          desp_grandes:   parseInt(document.getElementById('edit-grandes').value) || 0,
          desp_medianas:  0,
          desp_pequenas:  parseInt(document.getElementById('edit-pequenas').value) || 0,
          desp_estibas:   parseInt(document.getElementById('edit-estibas').value) || 0,
          observaciones:  document.getElementById('edit-obs').value,
        });
        DB_VIAJES.invalidateCache();
        closeDrawer();
        UI.toast('✓ Viaje actualizado', 'success');
        await navigateTo('viajes');
      } catch (err) { UI.toast(err.message, 'error'); }
      UI.setLoading(false);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VER FIRMA
  // ═══════════════════════════════════════════════════════════════════════════

  function verFirmaViaje(url, titulo) {
    UI.showModal({
      title: titulo,
      body: `<div style="text-align:center"><img src="${url}" alt="${titulo}" style="max-width:100%;border:1px solid var(--border);border-radius:var(--radius-sm);background:#fff;padding:8px" /></div>`,
      confirmLabel: 'Cerrar',
      cancelLabel: '',
      onConfirm: () => {},
    });
    setTimeout(() => {
      const cancelBtn = document.getElementById('modal-cancel');
      if (cancelBtn) cancelBtn.style.display = 'none';
    }, 0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANULAR VIAJE
  // ═══════════════════════════════════════════════════════════════════════════

  function confirmarAnularViaje(viajeId, numero) {
    UI.showModal({
      title: 'Anular viaje',
      body: `¿Seguro que deseas anular el viaje <strong>${UI.escapeHtml(numero)}</strong>? Esta acción no se puede deshacer.`,
      confirmLabel: 'Anular', danger: true,
      onConfirm: async () => {
        UI.setLoading(true);
        try {
          await DB_VIAJES.anularViaje(viajeId);
          closeDrawer();
          UI.toast('Viaje anulado', 'success');
          await navigateTo('viajes');
        } catch (err) { UI.toast(err.message, 'error'); }
        UI.setLoading(false);
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONDUCTORES / AUXILIARES TOGGLE
  // ═══════════════════════════════════════════════════════════════════════════

  async function toggleConductor(id, activate) {
    const c = await DB_VIAJES.getConductorById(id);
    if (!c) return;
    UI.showModal({
      title: `${activate ? 'Activar' : 'Desactivar'} Conductor`,
      body: `¿${activate ? 'Activar' : 'Desactivar'} a <strong>${UI.escapeHtml(c.nombre)}</strong>?`,
      confirmLabel: activate ? 'Activar' : 'Desactivar', danger: !activate,
      onConfirm: async () => {
        UI.setLoading(true);
        try {
          activate ? await DB_VIAJES.reactivateConductor(id) : await DB_VIAJES.deactivateConductor(id);
          UI.toast(`Conductor ${activate ? 'activado' : 'desactivado'}`, 'success');
          await UI_VIAJES.renderConductores();
        } catch (err) { UI.toast(err.message, 'error'); }
        UI.setLoading(false);
      },
    });
  }

  async function toggleAuxiliar(id, activate) {
    const aux = await DB.getAuxiliarById(id);
    if (!aux) return;
    UI.showModal({
      title: `${activate ? 'Activar' : 'Desactivar'} Auxiliar`,
      body: `¿${activate ? 'Activar' : 'Desactivar'} a <strong>${UI.escapeHtml(aux.nombre)}</strong>?`,
      confirmLabel: activate ? 'Activar' : 'Desactivar', danger: !activate,
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

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTORIAL AUXILIAR / CONDUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  async function verHistorialAuxiliar(auxId, auxNombre) {
    await UI.showHistorialAuxiliar(auxId, auxNombre);
  }

  async function verHistorialConductor(condId, condNombre) {
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
            <div class="aux-drawer-nombre">🧑‍✈️ ${UI.escapeHtml(condNombre)}</div>
            <div class="aux-drawer-cedula" id="cond-drawer-sub">Cargando...</div>
          </div>
          <button class="aux-drawer-close" id="cond-drawer-close">✕</button>
        </div>
        <div class="aux-drawer-chips" id="cond-drawer-chips"><span class="aux-chip">⏳</span></div>
      </div>
      <div class="aux-drawer-body" id="cond-drawer-body">
        <div class="aux-drawer-empty"><div class="aux-drawer-empty-icon">⏳</div><div>Cargando...</div></div>
      </div>`;
    overlay.appendChild(drawer);
    document.body.appendChild(overlay);
    const close = () => {
      overlay.style.animation = 'fadeIn .15s ease reverse';
      drawer.style.animation  = 'drawerIn .18s ease reverse';
      setTimeout(() => overlay.remove(), 160);
    };
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.getElementById('cond-drawer-close').addEventListener('click', close);
    const onKey = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);

    try {
      const [viajes, cond] = await Promise.all([
        DB_VIAJES.getViajesPorConductor(condId),
        DB_VIAJES.getConductorById(condId),
      ]);
      document.getElementById('cond-drawer-sub').textContent = cond ? `CC: ${cond.cedula}` : '';
      const cerrados   = viajes.filter(v => v.estado === 'cerrado').length;
      const pendientes = viajes.filter(v => v.estado === 'abierto').length;
      let totDesp = 0, totRet = 0;
      viajes.forEach(v => {
        totDesp += (v.desp_grandes||0)+(v.desp_pequenas||0)+(v.desp_estibas||0);
        if (v.ret_grandes !== null) totRet += (v.ret_grandes||0)+(v.ret_pequenas||0)+(v.ret_estibas||0);
      });
      const totDif = totRet - totDesp;
      document.getElementById('cond-drawer-chips').innerHTML =
        `<span class="aux-chip">📋 ${viajes.length} viaje${viajes.length !== 1 ? 's' : ''}</span>` +
        `<span class="aux-chip chip-ok">✅ ${cerrados} cerrados</span>` +
        (pendientes > 0 ? `<span class="aux-chip chip-warn">⏳ ${pendientes} pendiente${pendientes !== 1 ? 's' : ''}</span>` : '') +
        `<span class="aux-chip ${totDif < 0 ? 'chip-alert' : 'chip-ok'}">⚖️ Dif: ${totDif > 0 ? '+' : ''}${totDif}</span>`;

      const bodyEl = document.getElementById('cond-drawer-body');
      if (viajes.length === 0) {
        bodyEl.innerHTML = `<div class="aux-drawer-empty"><div class="aux-drawer-empty-icon">📭</div><div>Sin viajes registrados</div></div>`;
        return;
      }
      bodyEl.innerHTML = '<div class="aux-timeline">' + viajes.map(v => {
        const dias = Math.floor((Date.now() - new Date(v.fecha)) / 86400000);
        const dG = v.ret_grandes  !== null ? v.ret_grandes  - v.desp_grandes  : null;
        const dP = v.ret_pequenas !== null ? v.ret_pequenas - v.desp_pequenas : null;
        const dE = v.ret_estibas  !== null ? v.ret_estibas  - v.desp_estibas  : null;
        const ic = v.estado === 'cerrado' ? 't-cerrado' : v.estado === 'anulado' ? 't-anulado' : 't-pendiente';
        const icon = v.estado === 'cerrado' ? '📦' : v.estado === 'anulado' ? '❌' : '🚛';
        const sb = v.estado === 'abierto'
          ? `<span class="tl-status-badge s-pendiente">Pendiente${dias > 0 ? ` · ${dias}d` : ''}</span>`
          : v.estado === 'cerrado'
            ? `<span class="tl-status-badge s-cerrado">Cerrado</span>`
            : `<span class="tl-status-badge s-anulado">Anulado</span>`;
        return `<div class="aux-tl-item">
          <div class="aux-tl-icon ${ic}">${icon}</div>
          <div class="aux-tl-content">
            <div class="aux-tl-tipo">${UI.escapeHtml(v.numero_viaje)} · ${UI.escapeHtml(v.placa || '')} ${sb}</div>
            <div class="aux-tl-ref">📤 ${v.desp_grandes}G·${v.desp_pequenas}P·${v.desp_estibas}E</div>
            ${dG !== null ? `<div class="aux-tl-ref">📥 ${v.ret_grandes}G·${v.ret_pequenas}P·${v.ret_estibas}E</div>
              <div class="tl-dif-row">
                ${[[dG,'G'],[dP,'P'],[dE,'E']].map(([d,l]) =>
                  `<span class="tl-dif-pill ${d < 0 ? 'neg' : d > 0 ? 'ok' : 'zero'}">${l}: ${d > 0 ? '+' : ''}${d}</span>`
                ).join('')}
              </div>` : ''}
            <div class="aux-tl-meta"><span>📅 ${v.fecha}</span></div>
          </div>
        </div>`;
      }).join('') + '</div>';
    } catch (err) {
      document.getElementById('cond-drawer-body').innerHTML =
        `<div class="aux-drawer-empty"><div class="aux-drawer-empty-icon">⚠️</div><div>${UI.escapeHtml(err.message)}</div></div>`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTROS VIAJES
  // ═══════════════════════════════════════════════════════════════════════════

  async function aplicarFiltrosViajes() {
    viajesFiltros = {
      fechaDesde:  document.getElementById('vf-desde')?.value || null,
      fechaHasta:  document.getElementById('vf-hasta')?.value || null,
      estado:      document.getElementById('vf-estado')?.value || 'todos',
      auxiliar_id: document.getElementById('vf-auxiliar')?.value || null,
    };
    await UI_VIAJES.renderViajes(viajesFiltros);
  }

  // ─── Filtros auxiliares ──────────────────────────────────────────────────
  async function aplicarFiltrosAuxiliares() {
    auxiliaresFiltros = {
      fechaDesde: document.getElementById('af-desde')?.value || null,
      fechaHasta: document.getElementById('af-hasta')?.value || null,
      estado:     document.getElementById('af-estado')?.value || 'todos',
      buscar:     document.getElementById('af-buscar')?.value || null,
    };
    await UI.renderAuxiliares(auxiliaresFiltros);
  }

  async function limpiarFiltrosAuxiliares() {
    auxiliaresFiltros = {};
    ['af-desde', 'af-hasta', 'af-buscar'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const est = document.getElementById('af-estado'); if (est) est.value = 'todos';
    await UI.renderAuxiliares({});
  }

  async function limpiarFiltrosViajes() {
    viajesFiltros = {};
    const fields = ['vf-desde', 'vf-hasta'];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const estado = document.getElementById('vf-estado'); if (estado) estado.value = 'todos';
    const txt = document.getElementById('vf-auxiliar-txt'); if (txt) txt.value = '';
    const hid = document.getElementById('vf-auxiliar');    if (hid) hid.value = '';
    await UI_VIAJES.renderViajes({});
  }

  async function exportarViajesCSV() {
    UI.setLoading(true);
    try {
      await EXCEL.exportarViajes(viajesFiltros);
      UI.toast('✓ Excel exportado', 'success');
    } catch (err) { UI.toast('Error: ' + err.message, 'error'); }
    UI.setLoading(false);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async function handleInventarioSubmit(e) {
    e.preventDefault();
    UI.setLoading(true);
    try {
      await DB_VIAJES.setInventarioInicial(
        document.getElementById('inv-grandes').value,
        document.getElementById('inv-medianas')?.value || 0,
        document.getElementById('inv-pequenas').value,
        document.getElementById('inv-estibas').value,
      );
      UI.toast('Inventario actualizado', 'success');
    } catch (err) { UI.toast(err.message, 'error'); }
    UI.setLoading(false);
  }

  async function handleResetViajes() {
    UI.showModal({
      title: '⚠️ Reiniciar viajes',
      body: '<p><strong>Se eliminarán TODOS los viajes.</strong> No se puede deshacer.</p>',
      confirmLabel: 'Reiniciar', danger: true,
      onConfirm: async () => {
        UI.setLoading(true);
        UI.toast('Para reiniciar, ejecuta el SQL en Supabase directamente.', 'info');
        UI.setLoading(false);
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENTES
  // ═══════════════════════════════════════════════════════════════════════════

  async function verKardexCliente(clienteId, nombre) {
    await UI_CLIENTES.renderKardexCliente(clienteId, nombre);
  }

  async function abrirFormularioNuevoCliente() {
    openDrawer('🏢 Nuevo Cliente', `
      <form id="form-nuevo-cliente" novalidate>
        <div class="form-group">
          <label>Nombre / Razón social *</label>
          <input id="nc-nombre" class="form-control" type="text" placeholder="Ej: Distribuciones Pérez" required />
        </div>
        <div class="form-row">
          <div class="form-group"><label>NIT</label><input id="nc-nit" class="form-control" type="text" placeholder="900.123.456-7" /></div>
          <div class="form-group"><label>Teléfono</label><input id="nc-tel" class="form-control" type="text" placeholder="300 000 0000" /></div>
        </div>
        <div class="form-group"><label>Dirección</label><input id="nc-dir" class="form-control" type="text" placeholder="Calle 10 # 5-20" /></div>
        <div class="form-group">
          <label>Stock acordado <span class="text-muted text-sm">(máx. canastillas)</span></label>
          <input id="nc-stock" class="form-control" type="number" min="0" value="0" />
        </div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">✓ Registrar cliente</button>
      </form>
    `);
    document.getElementById('form-nuevo-cliente')?.addEventListener('submit', async e => {
      e.preventDefault();
      const nombre = document.getElementById('nc-nombre').value.trim();
      if (!nombre) { UI.toast('El nombre es obligatorio', 'error'); return; }
      UI.setLoading(true);
      try {
        await DB_CLIENTES.addCliente({
          nombre,
          nit:           document.getElementById('nc-nit').value,
          telefono:      document.getElementById('nc-tel').value,
          direccion:     document.getElementById('nc-dir').value,
          stock_acordado: document.getElementById('nc-stock').value,
        });
        DB_CLIENTES.invalidateCache();
        closeDrawer();
        UI.toast('✓ Cliente registrado', 'success');
        await navigateTo('clientes');
      } catch (err) { UI.toast(err.message, 'error'); }
      UI.setLoading(false);
    });
  }

  async function abrirFormularioMovCliente(clienteId) {
    const [clientes, conductores, auxiliares] = await Promise.all([
      DB_CLIENTES.getClientes(true),
      DB_VIAJES.getConductores(true),
      DB.getAuxiliares(true),
    ]);
    const cliente     = clientes.find(c => c.id === clienteId);
    const saldoActual = await DB_CLIENTES.getSaldoCliente(clienteId);
    const condOpts = conductores.map(c => `<option value="${c.id}">${UI.escapeHtml(c.nombre)}</option>`).join('');
    const auxOpts  = auxiliares.map(a  => `<option value="${a.id}">${UI.escapeHtml(a.nombre)}</option>`).join('');

    openDrawer('📦 Registrar Movimiento', `
      <div style="background:var(--gray-50);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.875rem 1rem;margin-bottom:1rem">
        <div style="font-weight:800;font-size:1rem">${UI.escapeHtml(cliente?.nombre || '')}</div>
        <div class="text-muted text-sm">Saldo actual: <strong>${saldoActual}</strong> canastillas · Stock acordado: ${cliente?.stock_acordado || 0}</div>
      </div>
      <form id="form-mov-cliente" novalidate>
        <div class="form-group">
          <label>Tipo de movimiento *</label>
          <select id="mc-tipo" class="form-control" required>
            <option value="entrega">📤 Entrega (sale a cliente)</option>
            <option value="retorno">📥 Retorno (cliente devuelve)</option>
            <option value="baja">🗑 Baja (dañadas / pérdida)</option>
            <option value="ajuste">🔧 Ajuste de inventario</option>
          </select>
        </div>
        <div class="form-group">
          <label>Cantidad *</label>
          <input id="mc-cantidad" class="form-control" type="number" min="1" value="1" required />
        </div>
        <div class="form-group">
          <label># Documento</label>
          <input id="mc-doc" class="form-control" type="text" placeholder="Ej: FV-1520" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Conductor</label>
            <select id="mc-conductor" class="form-control"><option value="">— Opcional —</option>${condOpts}</select>
          </div>
          <div class="form-group">
            <label>Auxiliar</label>
            <select id="mc-auxiliar" class="form-control"><option value="">— Opcional —</option>${auxOpts}</select>
          </div>
        </div>
        <div class="form-group">
          <label>Notas</label>
          <textarea id="mc-notas" class="form-control" placeholder="Observaciones..."></textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">✓ Registrar</button>
      </form>
    `);

    document.getElementById('form-mov-cliente')?.addEventListener('submit', async e => {
      e.preventDefault();
      UI.setLoading(true);
      try {
        await DB_CLIENTES.registrarMovimientoCliente({
          cliente_id:   clienteId,
          tipo:         document.getElementById('mc-tipo').value,
          cantidad:     document.getElementById('mc-cantidad').value,
          numero_doc:   document.getElementById('mc-doc').value,
          conductor_id: document.getElementById('mc-conductor').value || null,
          auxiliar_id:  document.getElementById('mc-auxiliar').value  || null,
          notas:        document.getElementById('mc-notas').value,
          admin_registrador: AUTH.getCurrentUser(),
        });
        DB_CLIENTES.invalidateCache();
        closeDrawer();
        UI.toast('✓ Movimiento registrado', 'success');
        await navigateTo('clientes');
      } catch (err) { UI.toast(err.message, 'error'); }
      UI.setLoading(false);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INLINE SEARCH (helper)
  // ═══════════════════════════════════════════════════════════════════════════

  function _bindInlineSearch(inputId, listId, hiddenId, items, labelFn, sublabelFn, onNoMatch) {
    const input  = document.getElementById(inputId);
    const list   = document.getElementById(listId);
    const hidden = document.getElementById(hiddenId);
    if (!input || !list || !hidden) return;

    // Deduplicar elementos para evitar repeticiones visuales
    const seen = new Set();
    const cleanItems = items.filter(i => {
      const key = `${labelFn(i)}||${sublabelFn(i) || ''}`.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const renderList = (q = '') => {
      const filtered = q
        ? cleanItems.filter(i =>
            labelFn(i).toLowerCase().includes(q.toLowerCase()) ||
            (sublabelFn(i) || '').toLowerCase().includes(q.toLowerCase()))
        : cleanItems;

      if (filtered.length === 0) {
        list.innerHTML = `<div class="isl-empty">${q ? `Sin resultados para "${q}"` : 'Sin datos disponibles'}</div>`;
        if (onNoMatch) onNoMatch(q);
      } else {
        list.innerHTML = filtered.slice(0, 40).map(i =>
          `<div class="isl-item" data-id="${i.id}">
            <span class="isl-label">${UI.escapeHtml(labelFn(i))}</span>
            <span class="isl-sub">${UI.escapeHtml(sublabelFn(i) || '')}</span>
          </div>`
        ).join('');
        list.querySelectorAll('.isl-item').forEach(el => {
          el.addEventListener('mousedown', e => {
            e.preventDefault();
            hidden.value = el.dataset.id;
            input.value  = el.querySelector('.isl-label').textContent;
            list.classList.add('hidden');
            if (onNoMatch) onNoMatch('');
          });
        });
      }
      list.classList.remove('hidden');
    };

    input.addEventListener('focus', () => renderList(input.value));
    input.addEventListener('input', () => { hidden.value = ''; renderList(input.value); });
    input.addEventListener('blur',  () => { setTimeout(() => list.classList.add('hidden'), 200); });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORTS
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    init, navigateTo, closeDrawer,
    abrirFormularioDespacho, abrirFormularioRetorno, abrirFormularioEditarViaje,
    verDetalleViaje, confirmarAnularViaje, verFirmaViaje,
    toggleConductor, toggleAuxiliar, verHistorialAuxiliar, verHistorialConductor,
    verKardexCliente, abrirFormularioNuevoCliente, abrirFormularioMovCliente,
    abrirCargaExcel, _handleZonaDrop, _handleZonaFile,
  };
})();

document.addEventListener('DOMContentLoaded', APP.init);
