/**
 * db-viajes.js - Data layer para modelo de viajes (Excel-like)
 * Control de Canastas PWA 2.0
 */

const DB_VIAJES = (() => {

  const BASE = 'https://oghprxgonszqtoslreod.supabase.co/rest/v1';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9naHByeGdvbnN6cXRvc2xyZW9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MzE4NjYsImV4cCI6MjEwMDIwNzg2Nn0.tXmRLkAXjXl2w2mRhm8IYgkmBm5qfoUtijLT6Mjf2j4';
  const HEADERS = {
    'apikey':        ANON,
    'Authorization': 'Bearer ' + ANON,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
  };

  async function api(method, path, body = null, extraHeaders = {}) {
    const opts = { method, headers: { ...HEADERS, ...extraHeaders } };
    if (body !== null) opts.body = JSON.stringify(body);
    const res  = await fetch(BASE + path, opts);
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try { msg = JSON.parse(text).message || text; } catch {}
      throw new Error(msg);
    }
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }

  const GET   = (path)        => api('GET',   path);
  const POST  = (path, body)  => api('POST',  path, body);
  const PATCH = (path, body)  => api('PATCH', path, body, { Prefer: 'return=representation' });

  let _conductoresCache = null;

  function invalidateCache() { _conductoresCache = null; }

  // ─── Conductores ───────────────────────────────────────────────────────────
  async function getConductores(soloActivos = false) {
    if (_conductoresCache && _conductoresCache.length > 0) {
      return soloActivos ? _conductoresCache.filter(c => c.activo) : _conductoresCache;
    }
    const data = await GET('/conductores?order=nombre.asc');
    _conductoresCache = data || [];
    return soloActivos ? _conductoresCache.filter(c => c.activo) : _conductoresCache;
  }

  async function getConductorById(id) {
    const list = await getConductores();
    return list.find(c => c.id === id) || null;
  }

  async function addConductor(nombre, cedula) {
    const data = await POST('/conductores', { nombre: nombre.trim(), cedula: cedula.trim(), activo: true });
    invalidateCache();
    return Array.isArray(data) ? data[0] : data;
  }

  async function updateConductor(id, campos) {
    const data = await PATCH(`/conductores?id=eq.${id}`, campos);
    invalidateCache();
    return Array.isArray(data) ? data[0] : data;
  }

  async function deactivateConductor(id) {
    return updateConductor(id, { activo: false });
  }

  async function reactivateConductor(id) {
    return updateConductor(id, { activo: true });
  }

  // ─── Inventario inicial ────────────────────────────────────────────────────
  async function getInventarioInicial() {
    let data = null;
    try { data = await GET('/inventario_inicial?id=eq.main'); } catch {}
    return (data && data[0]) || { id: 'main', grandes: 0, medianas: 0, pequenas: 0, estibas: 0 };
  }

  async function setInventarioInicial(grandes, medianas, pequenas, estibas) {
    const payload = {
      id: 'main',
      grandes:  parseInt(grandes,  10) || 0,
      medianas: parseInt(medianas, 10) || 0,
      pequenas: parseInt(pequenas, 10) || 0,
      estibas:  parseInt(estibas,  10) || 0,
      updated_at: new Date().toISOString(),
    };
    try {
      await api('POST', '/inventario_inicial?on_conflict=id', payload, {
        'Prefer': 'resolution=merge-duplicates,return=representation'
      });
    } catch (e) {
      await PATCH('/inventario_inicial?id=eq.main', payload);
    }
    return payload;
  }

  // ─── Numero de viaje ───────────────────────────────────────────────────────
  async function generateNumeroViaje() {
    const cfgData = await GET('/config?id=eq.main');
    const cfg = (cfgData && cfgData[0]) || { id: 'main', viaje_counter: 0 };
    const next = (cfg.viaje_counter || 0) + 1;
    await PATCH('/config?id=eq.main', { viaje_counter: next });
    const year = new Date().getFullYear();
    return `${year}-${String(next).padStart(4, '0')}`;
  }

  // ─── Viajes ────────────────────────────────────────────────────────────────
  async function getViajes(limit = 100) {
    const data = await GET(`/viajes?order=fecha.desc,created_at.desc&limit=${limit}`);
    return data || [];
  }

  async function getViajesAbiertos() {
    const data = await GET('/viajes?estado=eq.abierto&order=fecha.desc,created_at.desc');
    return data || [];
  }

  async function getViajeById(id) {
    const data = await GET(`/viajes?id=eq.${id}`);
    return (data && data[0]) || null;
  }

  async function getViajesPorAuxiliar(auxiliar_id, limit = 100) {
    const data = await GET(`/viajes?auxiliar_id=eq.${auxiliar_id}&order=fecha.desc,created_at.desc&limit=${limit}`);
    return data || [];
  }

  async function getViajesPorConductor(conductor_id, limit = 100) {
    const data = await GET(`/viajes?conductor_id=eq.${conductor_id}&order=fecha.desc,created_at.desc&limit=${limit}`);
    return data || [];
  }

  async function registrarViaje({
    conductor_id, auxiliar_id, placa, remolque, numero_factura,
    desp_grandes, desp_medianas, desp_pequenas, desp_estibas,
    observaciones, admin_registrador
  }) {
    if (!conductor_id || !auxiliar_id || !placa) {
      throw new Error('Conductor, auxiliar y placa son obligatorios');
    }

    const numero = await generateNumeroViaje();
    const viaje = {
      numero_viaje: numero,
      fecha: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      conductor_id,
      auxiliar_id,
      placa:        placa.trim().toUpperCase(),
      remolque:     remolque ? remolque.trim().toUpperCase() : null,
      numero_factura: numero_factura ? numero_factura.trim() : null,
      desp_grandes:  parseInt(desp_grandes,  10) || 0,
      desp_medianas: parseInt(desp_medianas, 10) || 0,
      desp_pequenas: parseInt(desp_pequenas, 10) || 0,
      desp_estibas:  parseInt(desp_estibas,  10) || 0,
      ret_grandes:   null,
      ret_medianas:  null,
      ret_pequenas:  null,
      ret_estibas:   null,
      fecha_retorno: null,
      observaciones: observaciones || '',
      estado:        'abierto',
      admin_registrador,
      created_at:    new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    };

    const inserted = await POST('/viajes', viaje);
    return Array.isArray(inserted) ? inserted[0] : inserted;
  }

  async function registrarRetorno(viaje_id, ret_grandes, ret_medianas, ret_pequenas, ret_estibas) {
    const viaje = await getViajeById(viaje_id);
    if (!viaje) throw new Error('Viaje no encontrado');
    if (viaje.estado === 'cerrado') throw new Error('Este viaje ya fue cerrado');

    await PATCH(`/viajes?id=eq.${viaje_id}`, {
      ret_grandes:   parseInt(ret_grandes,  10) || 0,
      ret_medianas:  parseInt(ret_medianas, 10) || 0,
      ret_pequenas:  parseInt(ret_pequenas, 10) || 0,
      ret_estibas:   parseInt(ret_estibas,  10) || 0,
      fecha_retorno: new Date().toISOString(),
      estado:        'cerrado',
      updated_at:    new Date().toISOString(),
    });

    return await getViajeById(viaje_id);
  }

  async function anularViaje(viaje_id) {
    const viaje = await getViajeById(viaje_id);
    if (!viaje) throw new Error('Viaje no encontrado');
    // Marcar como anulado (o eliminar — elegimos soft delete con campo anulado)
    await PATCH(`/viajes?id=eq.${viaje_id}`, {
      estado: 'anulado',
      updated_at: new Date().toISOString(),
    });
    return viaje;
  }

  async function editarViaje(viajeId, campos) {
    const viaje = await getViajeById(viajeId);
    if (!viaje) throw new Error('Viaje no encontrado');
    if (viaje.estado !== 'abierto') throw new Error('Solo se pueden editar viajes pendientes');
    await PATCH(`/viajes?id=eq.${viajeId}`, { ...campos, updated_at: new Date().toISOString() });
    invalidateCache();
  }

  async function guardarFirmaDespacho(viajeId, firmaUrl) {
    await PATCH(`/viajes?id=eq.${viajeId}`, { firma_despacho_url: firmaUrl });
  }

  async function guardarFirmaRetorno(viajeId, firmaUrl) {
    await PATCH(`/viajes?id=eq.${viajeId}`, { firma_retorno_url: firmaUrl });
  }

  // ─── CSV Export ────────────────────────────────────────────────────────────
  async function exportViajesCSV() {
    const viajes = await getViajes(1000);
    const [conductores, auxiliares] = await Promise.all([
      getConductores(),
      DB.getAuxiliares(), // del módulo original
    ]);

    const condMap = {};
    conductores.forEach(c => { condMap[c.id] = c.nombre; });
    const auxMap = {};
    auxiliares.forEach(a => { auxMap[a.id] = a.nombre; });

    const headers = [
      'FECHA', 'CONDUCTOR', 'PLACA', 'REMOLQUE', '# FACTURA',
      'GRANDES', 'MEDIANAS', 'PEQUEÑAS', 'ESTIBAS',
      'GRANDES', 'MEDIANAS', 'PEQUEÑAS', 'ESTIBAS',
      'GRANDES', 'MEDIANAS', 'PEQUEÑAS', 'ESTIBAS',
      'OBSERVACION'
    ];

    const rows = viajes.map(v => {
      const difG = (v.ret_grandes !== null) ? (v.desp_grandes - v.ret_grandes) : '';
      const difM = (v.ret_medianas !== null) ? (v.desp_medianas - v.ret_medianas) : '';
      const difP = (v.ret_pequenas !== null) ? (v.desp_pequenas - v.ret_pequenas) : '';
      const difE = (v.ret_estibas !== null) ? (v.desp_estibas - v.ret_estibas) : '';

      return [
        v.fecha,
        condMap[v.conductor_id] || '',
        v.placa,
        v.remolque || '',
        v.numero_factura || '',
        v.desp_grandes,
        v.desp_medianas,
        v.desp_pequenas,
        v.desp_estibas,
        v.ret_grandes !== null ? v.ret_grandes : '',
        v.ret_medianas !== null ? v.ret_medianas : '',
        v.ret_pequenas !== null ? v.ret_pequenas : '',
        v.ret_estibas !== null ? v.ret_estibas : '',
        difG,
        difM,
        difP,
        difE,
        v.observaciones || '',
      ];
    });

    return [headers, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  // ─── Calcular diferencia acumulada ─────────────────────────────────────────
  async function calcularDiferenciaAcumulada() {
    const viajes = await getViajes(10000);
    const inventario = await getInventarioInicial();

    let totalDesp = { grandes: 0, medianas: 0, pequenas: 0, estibas: 0 };
    let totalRet  = { grandes: 0, medianas: 0, pequenas: 0, estibas: 0 };

    viajes.forEach(v => {
      totalDesp.grandes  += v.desp_grandes || 0;
      totalDesp.medianas += v.desp_medianas || 0;
      totalDesp.pequenas += v.desp_pequenas || 0;
      totalDesp.estibas  += v.desp_estibas || 0;

      if (v.ret_grandes !== null)  totalRet.grandes  += v.ret_grandes;
      if (v.ret_medianas !== null) totalRet.medianas += v.ret_medianas;
      if (v.ret_pequenas !== null) totalRet.pequenas += v.ret_pequenas;
      if (v.ret_estibas !== null)  totalRet.estibas  += v.ret_estibas;
    });

    return {
      inventario,
      totalDesp,
      totalRet,
      diferencia: {
        grandes:  totalDesp.grandes  - totalRet.grandes,
        medianas: totalDesp.medianas - totalRet.medianas,
        pequenas: totalDesp.pequenas - totalRet.pequenas,
        estibas:  totalDesp.estibas  - totalRet.estibas,
      },
    };
  }

  return {
    getConductores, getConductorById, addConductor, updateConductor,
    deactivateConductor, reactivateConductor,
    getInventarioInicial, setInventarioInicial,
    getViajes, getViajesAbiertos, getViajeById, getViajesPorAuxiliar, getViajesPorConductor,
    registrarViaje, registrarRetorno, anularViaje, editarViaje,
    guardarFirmaDespacho, guardarFirmaRetorno,
    exportViajesCSV, calcularDiferenciaAcumulada,
    invalidateCache,
  };
})();
