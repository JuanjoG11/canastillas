/**
 * app.js - Controlador principal v2.0
 * Control de Canastas PWA — Modelo de Viajes
 */

const APP = (() => {

  let viajesFiltros = {};

  // ─── Bootstrap ─────────────────────────────────────────────────────────────
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

    // Nuevo despacho
    document.getElementById('btn-nuevo-viaje').addEventListener('click', abrirFormularioDespacho);

    // Filtros de viajes
    document.getElementById('btn-vf-filtrar').addEventListener('click', aplicarFiltrosViajes);
    document.getElementById('btn-vf-limpiar').addEventListener('click', limpiarFiltrosViajes);
    document.getElementById('btn-vf-csv').addEventListener('click', exportarViajesCSV);

    // Búsqueda conductores
    document.getElementById('search-conductores-input')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.persona-card').forEach(card => {
        card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });

    // Búsqueda auxiliares
    document.getElementById('search-auxiliares-input')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.auxiliar-card').forEach(card => {
        card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });

    // Configuración
    document.getElementById('form-inventario-inicial').addEventListener('submit', handleInventarioSubmit);
    document.getElementById('btn-reset-viajes').addEventListener('click', handleResetViajes);

    // Drawer
    document.getElementById('drawer-close').addEventListener('click', closeDrawer);
    document.getElementById('drawer-overlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('drawer-overlay')) closeDrawer();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
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
      body: '¿Seguro que deseas cerrar sesión?',
      confirmLabel: 'Cerrar sesión',
      onConfirm: () => { AUTH.logout(); showLogin(); },
    });
  }

  // ─── Navegación ────────────────────────────────────────────────────────────
  async function navigateTo(section) {
    UI.showSection(section);
    UI.setLoading(true);
    try {
      switch (section) {
        case 'dashboard':     await UI_VIAJES.renderDashboard();                         break;
        case 'viajes':        await UI_VIAJES.renderViajes(viajesFiltros);               break;
        case 'retornos':      await UI_VIAJES.renderRetornos();                          break;
        case 'conductores':   await UI_VIAJES.renderConductores();                       break;
        case 'auxiliares':    await UI.renderAuxiliares();                               break;
        case 'configuracion': await UI_VIAJES.renderConfiguracion();                     break;
      }
    } catch (err) { UI.toast('Error: ' + err.message, 'error'); }
    UI.setLoading(false);
  }

  // ─── Drawer ────────────────────────────────────────────────────────────────
  function openDrawer(title, html) {
    document.getElementById('drawer-title').textContent = title;
    document.getElementById('drawer-body').innerHTML = html;
    document.getElementById('drawer-overlay').classList.remove('hidden');
    requestAnimationFrame(() =>
      document.getElementById('drawer-panel').classList.add('drawer-open')
    );
  }

  function closeDrawer() {
    const panel = document.getElementById('drawer-panel');
    panel.classList.remove('drawer-open');
    setTimeout(() => {
      document.getElementById('drawer-overlay').classList.add('hidden');
      document.getElementById('drawer-body').innerHTML = '';
    }, 260);
  }

  // ─── Formulario nuevo despacho ─────────────────────────────────────────────
  async function abrirFormularioDespacho() {
    UI.setLoading(true);
    DB_VIAJES.invalidateCache();
    DB.invalidateCache();
    let conductores = [], auxiliares = [];
    try {
      [conductores, auxiliares] = await Promise.all([
        DB_VIAJES.getConductores(false),
        DB.getAuxiliares(false),
      ]);
    } catch (err) {
      UI.setLoading(false);
      UI.toast('Error al cargar datos: ' + err.message, 'error');
      return;
    }
    UI.setLoading(false);

    // loaded: conductores=${conductores.length}, auxiliares=${auxiliares.length}

    if (conductores.length === 0) {
      // Mostrar aviso visible en pantalla, no solo toast
      openDrawer('🚛 Nuevo Despacho', `
        <div class="field-info" style="border-left-color:var(--danger);background:var(--danger-light);color:#991B1B;margin-bottom:1rem">
          ⚠️ <strong>No hay conductores en la base de datos.</strong><br>
          Ve a Supabase → SQL Editor y ejecuta el archivo <code>insert_conductores.sql</code>.<br><br>
          O usa el botón de abajo para crear un conductor ahora mismo.
        </div>
        <button class="btn btn-primary btn-block" id="btn-crear-primer-conductor">+ Agregar conductor manualmente</button>
      `);
      document.getElementById('btn-crear-primer-conductor')?.addEventListener('click', async () => {
        const nombre = prompt('Nombre del conductor:');
        if (!nombre?.trim()) return;
        const cedula = prompt('Cédula:');
        if (cedula === null) return;
        UI.setLoading(true);
        try {
          await DB_VIAJES.addConductor(nombre.trim().toUpperCase(), cedula.trim() || Date.now().toString());
          UI.toast('Conductor creado. Abre el formulario de nuevo.', 'success');
          closeDrawer();
        } catch (err) { UI.toast(err.message, 'error'); }
        UI.setLoading(false);
      });
      return;
    }

    openDrawer('🚛 Nuevo Despacho', `
      <form id="form-despacho" novalidate>
        <div class="form-group">
          <label>Conductor *</label>
          <div style="position:relative">
            <input id="desp-conductor-txt" class="form-control" type="text"
              placeholder="🔍 Escribe el nombre del conductor..." autocomplete="off" />
            <input type="hidden" id="desp-conductor" />
            <div id="desp-conductor-list" class="inline-search-list hidden"></div>
          </div>
          <div id="desp-conductor-nuevo" class="hidden" style="margin-top:.5rem">
            <button type="button" id="btn-crear-conductor" class="btn btn-outline btn-sm">
              + Crear conductor nuevo
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>Auxiliar *</label>
          <div style="position:relative">
            <input id="desp-auxiliar-txt" class="form-control" type="text"
              placeholder="🔍 Escribe nombre o cédula del auxiliar..." autocomplete="off" />
            <input type="hidden" id="desp-auxiliar" />
            <div id="desp-auxiliar-list" class="inline-search-list hidden"></div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Placa *</label>
            <input id="desp-placa" class="form-control" type="text"
              placeholder="Ej: SWK 856" autocomplete="off" />
          </div>
          <div class="form-group">
            <label>Remolque</label>
            <input id="desp-remolque" class="form-control" type="text" placeholder="Ej: R52231" />
          </div>
        </div>
        <div class="form-group">
          <label># Factura</label>
          <input id="desp-factura" class="form-control" type="text" placeholder="Número de factura" />
        </div>
        <hr class="divider" />
        <div class="form-section-label">📤 Material despachado</div>
        <div class="form-row-4">
          <div class="form-group">
            <label>Grandes</label>
            <input id="desp-grandes"  class="form-control" type="number" min="0" value="0" />
          </div>
          <div class="form-group">
            <label>Medianas</label>
            <input id="desp-medianas" class="form-control" type="number" min="0" value="0" />
          </div>
          <div class="form-group">
            <label>Pequeñas</label>
            <input id="desp-pequenas" class="form-control" type="number" min="0" value="0" />
          </div>
          <div class="form-group">
            <label>Estibas</label>
            <input id="desp-estibas"  class="form-control" type="number" min="0" value="0" />
          </div>
        </div>
        <div class="form-group">
          <label>Observaciones</label>
          <textarea id="desp-obs" class="form-control" placeholder="Notas opcionales..."></textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">✓ Registrar Despacho</button>
      </form>
    `);

    // Autocomplete conductor
    _bindInlineSearch(
      'desp-conductor-txt', 'desp-conductor-list', 'desp-conductor',
      conductores,
      c => c.nombre,
      c => c.cedula ? `CC: ${c.cedula}` : '',
      // callback cuando no hay coincidencia: mostrar botón "crear"
      (query) => {
        const nuevoDiv = document.getElementById('desp-conductor-nuevo');
        if (!nuevoDiv) return;
        if (query.trim().length >= 3) {
          nuevoDiv.classList.remove('hidden');
          const btn = document.getElementById('btn-crear-conductor');
          if (btn) btn.textContent = `+ Crear "${query.trim()}"`;
        } else {
          nuevoDiv.classList.add('hidden');
        }
      }
    );

    // Crear conductor al vuelo
    document.getElementById('btn-crear-conductor')?.addEventListener('click', async () => {
      const nombre = document.getElementById('desp-conductor-txt').value.trim();
      if (!nombre) return;
      const cedula = prompt(`Cédula de ${nombre} (puede ser temporal):`);
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
    _bindInlineSearch(
      'desp-auxiliar-txt', 'desp-auxiliar-list', 'desp-auxiliar',
      auxiliares,
      a => a.nombre,
      a => `CC: ${a.cedula}`
    );

    document.getElementById('form-despacho').addEventListener('submit', async (e) => {
      e.preventDefault();
      const conductor_id = document.getElementById('desp-conductor').value;
      const auxiliar_id  = document.getElementById('desp-auxiliar').value;
      const placa        = document.getElementById('desp-placa').value.trim();

      if (!conductor_id || !auxiliar_id || !placa) {
        UI.toast('Conductor, auxiliar y placa son obligatorios', 'error'); return;
      }

      UI.setLoading(true);
      try {
        const viaje = await DB_VIAJES.registrarViaje({
          conductor_id, auxiliar_id, placa,
          remolque:          document.getElementById('desp-remolque').value.trim(),
          numero_factura:    document.getElementById('desp-factura').value.trim(),
          desp_grandes:      document.getElementById('desp-grandes').value,
          desp_medianas:     document.getElementById('desp-medianas').value,
          desp_pequenas:     document.getElementById('desp-pequenas').value,
          desp_estibas:      document.getElementById('desp-estibas').value,
          observaciones:     document.getElementById('desp-obs').value,
          admin_registrador: AUTH.getCurrentUser(),
        });
        DB_VIAJES.invalidateCache();
        closeDrawer();
        UI.setLoading(false);

        // ── Solicitar firma del conductor ──────────────────────────────────
        const condNombre = conductores.find(c => c.id === conductor_id)?.nombre || 'Conductor';
        const auxNombre  = auxiliares.find(a => a.id === auxiliar_id)?.nombre   || 'Auxiliar';
        const firmaUrl   = await FIRMA.solicitarFirmaViaje({
          tipo: 'despacho', numeroViaje: viaje.numero_viaje,
          conductorNombre: condNombre, auxiliarNombre: auxNombre,
        });
        if (firmaUrl) {
          await DB_VIAJES.guardarFirmaDespacho(viaje.id, firmaUrl);
          UI.toast(`✓ Despacho ${viaje.numero_viaje} registrado y firmado`, 'success');
        } else {
          UI.toast(`✓ Despacho ${viaje.numero_viaje} registrado sin firma`, 'success');
        }
        await navigateTo('viajes');
      } catch (err) { UI.toast(err.message, 'error'); UI.setLoading(false); }
    });
  }

  // ─── Formulario de retorno ─────────────────────────────────────────────────
  async function abrirFormularioRetorno(viajeId) {
    const viaje = await DB_VIAJES.getViajeById(viajeId);
    if (!viaje) return;

    const [conductores, auxiliares] = await Promise.all([
      DB_VIAJES.getConductores(),
      DB.getAuxiliares(),
    ]);
    const condNombre = conductores.find(c => c.id === viaje.conductor_id)?.nombre || '—';
    const auxNombre  = auxiliares.find(a => a.id === viaje.auxiliar_id)?.nombre || '—';

    openDrawer('📥 Registrar Retorno', `
      <div class="retorno-detalle-header">
        <div class="retorno-ref"><strong>${UI.escapeHtml(viaje.numero_viaje)}</strong> · ${UI.escapeHtml(viaje.placa)}</div>
        <div class="text-muted small">${condNombre} · ${auxNombre}</div>
        <div class="desp-resumen">
          Despachado: <strong>${viaje.desp_grandes}G · ${viaje.desp_medianas}M · ${viaje.desp_pequenas}P · ${viaje.desp_estibas}E</strong>
        </div>
      </div>
      <hr class="divider" />
      <form id="form-retorno" novalidate>
        <div class="form-section-label">📥 Material retornado por distribuidor</div>
        <div class="form-row-4">
          <div class="form-group">
            <label>Grandes</label>
            <input id="ret-grandes"  class="form-control" type="number" min="0" value="${viaje.desp_grandes}" />
          </div>
          <div class="form-group">
            <label>Medianas</label>
            <input id="ret-medianas" class="form-control" type="number" min="0" value="${viaje.desp_medianas}" />
          </div>
          <div class="form-group">
            <label>Pequeñas</label>
            <input id="ret-pequenas" class="form-control" type="number" min="0" value="${viaje.desp_pequenas}" />
          </div>
          <div class="form-group">
            <label>Estibas</label>
            <input id="ret-estibas"  class="form-control" type="number" min="0" value="${viaje.desp_estibas}" />
          </div>
        </div>
        <!-- Preview diferencia en tiempo real -->
        <div id="dif-preview" class="dif-preview"></div>
        <button type="submit" class="btn btn-success btn-block btn-lg">✓ Confirmar Retorno</button>
      </form>
    `);

    // Preview de diferencia en tiempo real
    const campos = ['ret-grandes', 'ret-medianas', 'ret-pequenas', 'ret-estibas'];
    const desp = [viaje.desp_grandes, viaje.desp_medianas, viaje.desp_pequenas, viaje.desp_estibas];
    const labels = ['Grandes', 'Medianas', 'Pequeñas', 'Estibas'];

    const updatePreview = () => {
      const preview = document.getElementById('dif-preview');
      if (!preview) return;
      const items = campos.map((id, i) => {
        const retVal = parseInt(document.getElementById(id)?.value || '0', 10);
        const dif = desp[i] - retVal;
        return `<span class="${dif < 0 ? 'neg' : dif > 0 ? 'pos' : ''}">${labels[i]}: ${dif > 0 ? '+' : ''}${dif}</span>`;
      });
      preview.innerHTML = `<strong>Diferencia:</strong> ${items.join(' · ')}`;
    };

    campos.forEach(id => {
      document.getElementById(id)?.addEventListener('input', updatePreview);
    });
    updatePreview();

    document.getElementById('form-retorno').addEventListener('submit', async (e) => {
      e.preventDefault();
      UI.setLoading(true);
      try {
        const viajeActualizado = await DB_VIAJES.registrarRetorno(
          viajeId,
          document.getElementById('ret-grandes').value,
          document.getElementById('ret-medianas').value,
          document.getElementById('ret-pequenas').value,
          document.getElementById('ret-estibas').value,
        );
        DB_VIAJES.invalidateCache();
        closeDrawer();
        UI.setLoading(false);

        // ── Solicitar firma del conductor en el retorno ───────────────────
        const firmaUrl = await FIRMA.solicitarFirmaViaje({
          tipo:            'retorno',
          numeroViaje:     viajeActualizado.numero_viaje,
          conductorNombre: condNombre,
          auxiliarNombre:  auxNombre,
        });
        if (firmaUrl) {
          await DB_VIAJES.guardarFirmaRetorno(viajeActualizado.id, firmaUrl);
          UI.toast('✓ Retorno registrado y firmado', 'success');
        } else {
          UI.toast('✓ Retorno registrado sin firma', 'success');
        }
        await navigateTo('retornos');
      } catch (err) { UI.toast(err.message, 'error'); UI.setLoading(false); }
    });
  }

  // ─── Ver detalle viaje ─────────────────────────────────────────────────────
  async function verDetalleViaje(viajeId) {
    const viaje = await DB_VIAJES.getViajeById(viajeId);
    if (!viaje) return;

    const [conductores, auxiliares] = await Promise.all([
      DB_VIAJES.getConductores(),
      DB.getAuxiliares(),
    ]);
    const condNombre = conductores.find(c => c.id === viaje.conductor_id)?.nombre || '—';
    const auxNombre  = auxiliares.find(a => a.id === viaje.auxiliar_id)?.nombre || '—';

    const difG = viaje.ret_grandes !== null ? (viaje.desp_grandes - viaje.ret_grandes) : null;
    const difM = viaje.ret_medianas !== null ? (viaje.desp_medianas - viaje.ret_medianas) : null;
    const difP = viaje.ret_pequenas !== null ? (viaje.desp_pequenas - viaje.ret_pequenas) : null;
    const difE = viaje.ret_estibas !== null ? (viaje.desp_estibas - viaje.ret_estibas) : null;

    const fmtDif = (v) => v === null ? '—' : `<span class="${v < 0 ? 'neg' : v > 0 ? 'pos' : ''}">${v > 0 ? '+' : ''}${v}</span>`;

    const retBlock = viaje.ret_grandes !== null ? `
      <div class="detalle-row"><span>Retorno:</span><span>${viaje.ret_grandes}G · ${viaje.ret_medianas}M · ${viaje.ret_pequenas}P · ${viaje.ret_estibas}E</span></div>
      <div class="detalle-row"><span>Diferencia:</span><span>${fmtDif(difG)}G · ${fmtDif(difM)}M · ${fmtDif(difP)}P · ${fmtDif(difE)}E</span></div>
    ` : `<div class="field-info">Sin retorno registrado aún.</div>`;

    const anularBtn = viaje.estado !== 'anulado'
      ? `<button class="btn btn-danger btn-sm" onclick="APP.confirmarAnularViaje('${viaje.id}','${UI.escapeHtml(viaje.numero_viaje)}')">Anular viaje</button>`
      : '';
    const retornarBtn = viaje.estado === 'abierto'
      ? `<button class="btn btn-primary btn-sm" onclick="APP.abrirFormularioRetorno('${viaje.id}')">Registrar retorno</button>`
      : '';

    openDrawer(`🚛 Viaje ${UI.escapeHtml(viaje.numero_viaje)}`, `
      <div class="detalle-grid">
        <div class="detalle-row"><span>Fecha:</span><span>${viaje.fecha}</span></div>
        <div class="detalle-row"><span>Conductor:</span><span>${UI.escapeHtml(condNombre)}</span></div>
        <div class="detalle-row"><span>Auxiliar:</span><span>${UI.escapeHtml(auxNombre)}</span></div>
        <div class="detalle-row"><span>Placa:</span><span>${UI.escapeHtml(viaje.placa)}</span></div>
        <div class="detalle-row"><span>Remolque:</span><span>${UI.escapeHtml(viaje.remolque || '—')}</span></div>
        <div class="detalle-row"><span># Factura:</span><span>${UI.escapeHtml(viaje.numero_factura || '—')}</span></div>
        <div class="detalle-row"><span>Despachado:</span><span>${viaje.desp_grandes}G · ${viaje.desp_medianas}M · ${viaje.desp_pequenas}P · ${viaje.desp_estibas}E</span></div>
        ${retBlock}
        ${viaje.observaciones ? `<div class="detalle-row"><span>Obs:</span><span>${UI.escapeHtml(viaje.observaciones)}</span></div>` : ''}
        <div class="detalle-row"><span>Estado:</span><span><span class="badge ${ESTADOS_BADGE_MAP[viaje.estado] || 'badge-gray'}">${ESTADOS_LABEL_MAP[viaje.estado] || viaje.estado}</span></span></div>
        ${viaje.firma_despacho_url ? `
        <div class="detalle-row">
          <span>Firma despacho:</span>
          <span><button class="btn btn-sm btn-secondary" onclick="APP.verFirmaViaje('${viaje.firma_despacho_url}','Firma Despacho')">🖊️ Ver firma</button></span>
        </div>` : ''}
        ${viaje.firma_retorno_url ? `
        <div class="detalle-row">
          <span>Firma retorno:</span>
          <span><button class="btn btn-sm btn-secondary" onclick="APP.verFirmaViaje('${viaje.firma_retorno_url}','Firma Retorno')">🖊️ Ver firma</button></span>
        </div>` : ''}
      </div>
      <div style="display:flex;gap:.5rem;margin-top:1.25rem;flex-wrap:wrap">
        ${retornarBtn}
        ${anularBtn}
      </div>
    `);
  }

  const ESTADOS_BADGE_MAP = { abierto: 'badge-orange', cerrado: 'badge-green', anulado: 'badge-gray' };
  const ESTADOS_LABEL_MAP = { abierto: 'Pendiente', cerrado: 'Cerrado', anulado: 'Anulado' };

  // ─── Ver firma de viaje ─────────────────────────────────────────────────────
  function verFirmaViaje(url, titulo) {
    UI.showModal({
      title: `🖊️ ${titulo}`,
      body: `<div style="text-align:center">
        <img src="${url}" alt="${titulo}"
          style="max-width:100%;border:1px solid #e5e7eb;border-radius:8px;background:#fff;padding:8px;" />
      </div>`,
      confirmLabel: 'Cerrar',
      cancelLabel: '',
      onConfirm: () => {},
    });
    setTimeout(() => {
      const cancelBtn = document.getElementById('modal-cancel');
      if (cancelBtn) cancelBtn.style.display = 'none';
    }, 0);
  }

  // ─── Anular viaje ──────────────────────────────────────────────────────────
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

  // ─── Conductores toggle ─────────────────────────────────────────────────────
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

  // ─── Auxiliares toggle ──────────────────────────────────────────────────────
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

  // ─── Historial auxiliar ─────────────────────────────────────────────────────
  async function verHistorialAuxiliar(auxId, auxNombre) {
    await UI.showHistorialAuxiliar(auxId, auxNombre);
  }

  // ─── Filtros viajes ─────────────────────────────────────────────────────────
  async function aplicarFiltrosViajes() {
    viajesFiltros = {
      fechaDesde: document.getElementById('vf-desde').value || null,
      fechaHasta: document.getElementById('vf-hasta').value || null,
      estado:     document.getElementById('vf-estado').value || 'todos',
    };
    await UI_VIAJES.renderViajes(viajesFiltros);
  }

  async function limpiarFiltrosViajes() {
    viajesFiltros = {};
    document.getElementById('vf-desde').value = '';
    document.getElementById('vf-hasta').value = '';
    document.getElementById('vf-estado').value = 'todos';
    await UI_VIAJES.renderViajes({});
  }

  async function exportarViajesCSV() {
    UI.setLoading(true);
    try {
      const csv  = await DB_VIAJES.exportViajesCSV();
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `viajes-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      UI.toast('CSV exportado', 'success');
    } catch (err) { UI.toast('Error: ' + err.message, 'error'); }
    UI.setLoading(false);
  }

  // ─── Configuración ──────────────────────────────────────────────────────────
  async function handleInventarioSubmit(e) {
    e.preventDefault();
    UI.setLoading(true);
    try {
      await DB_VIAJES.setInventarioInicial(
        document.getElementById('inv-grandes').value,
        document.getElementById('inv-medianas').value,
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
        try {
          // Soft: marcar todos como anulados no existe DELETE en REST anon sin RLS
          UI.toast('Para reiniciar, ejecuta el SQL en Supabase directamente.', 'info');
        } catch (err) { UI.toast(err.message, 'error'); }
        UI.setLoading(false);
      },
    });
  }

  // ─── Helper: búsqueda inline para selects en drawer ──────────────────────
  function _bindInlineSearch(inputId, listId, hiddenId, items, labelFn, sublabelFn, onNoMatch) {
    const input  = document.getElementById(inputId);
    const list   = document.getElementById(listId);
    const hidden = document.getElementById(hiddenId);
    if (!input || !list || !hidden) return;

    const renderList = (q = '') => {
      const filtered = q
        ? items.filter(i => labelFn(i).toLowerCase().includes(q.toLowerCase()) ||
                            (sublabelFn(i) || '').toLowerCase().includes(q.toLowerCase()))
        : items;

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
          el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            hidden.value = el.dataset.id;
            input.value  = el.querySelector('.isl-label').textContent;
            list.classList.add('hidden');
            if (onNoMatch) onNoMatch(''); // ocultar botón crear
          });
        });
      }
      list.classList.remove('hidden');
    };

    input.addEventListener('focus', () => renderList(input.value));
    input.addEventListener('input', () => {
      hidden.value = '';
      renderList(input.value);
    });
    input.addEventListener('blur', () => {
      setTimeout(() => list.classList.add('hidden'), 200);
    });
  }

  return {
    init, navigateTo, closeDrawer,
    abrirFormularioDespacho, abrirFormularioRetorno,
    verDetalleViaje, confirmarAnularViaje, verFirmaViaje,
    toggleConductor, toggleAuxiliar, verHistorialAuxiliar,
  };
})();

document.addEventListener('DOMContentLoaded', APP.init);
