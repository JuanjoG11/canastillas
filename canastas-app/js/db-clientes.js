/**
 * db-clientes.js — Kardex de clientes y estado general
 * Control de Canastas PWA 2.0
 */

const DB_CLIENTES = (() => {

  const BASE = 'https://oghprxgonszqtoslreod.supabase.co/rest/v1';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9naHByeGdvbnN6cXRvc2xyZW9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MzE4NjYsImV4cCI6MjEwMDIwNzg2Nn0.tXmRLkAXjXl2w2mRhm8IYgkmBm5qfoUtijLT6Mjf2j4';
  const H = { 'apikey': ANON, 'Authorization': 'Bearer ' + ANON, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

  async function api(method, path, body = null, extra = {}) {
    const opts = { method, headers: { ...H, ...extra } };
    if (body !== null) opts.body = JSON.stringify(body);
    const res  = await fetch(BASE + path, opts);
    const text = await res.text();
    if (!res.ok) { let m = text; try { m = JSON.parse(text).message || text; } catch {} throw new Error(m); }
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }

  const GET   = p       => api('GET',   p);
  const POST  = (p, b)  => api('POST',  p, b);
  const PATCH = (p, b)  => api('PATCH', p, b, { Prefer: 'return=representation' });
  const DEL   = p       => api('DELETE', p);

  let _clientesCache = null;
  function invalidateCache() { _clientesCache = null; }

  // ─── Clientes ──────────────────────────────────────────────────────────────
  async function getClientes(soloActivos = false) {
    if (_clientesCache && _clientesCache.length > 0)
      return soloActivos ? _clientesCache.filter(c => c.activo) : _clientesCache;
    const data = await GET('/clientes?order=nombre.asc');
    _clientesCache = data || [];
    return soloActivos ? _clientesCache.filter(c => c.activo) : _clientesCache;
  }

  async function getClienteById(id) {
    const list = await getClientes();
    return list.find(c => c.id === id) || null;
  }

  async function addCliente({ nombre, nit, telefono, direccion, stock_acordado }) {
    const data = await POST('/clientes', {
      nombre: nombre.trim().toUpperCase(),
      nit:           nit?.trim()       || null,
      telefono:      telefono?.trim()  || null,
      direccion:     direccion?.trim() || null,
      stock_acordado: parseInt(stock_acordado, 10) || 0,
      activo: true,
    });
    invalidateCache();
    return Array.isArray(data) ? data[0] : data;
  }

  async function updateCliente(id, campos) {
    const data = await PATCH(`/clientes?id=eq.${id}`, campos);
    invalidateCache();
    return Array.isArray(data) ? data[0] : data;
  }

  async function toggleCliente(id, activo) {
    return updateCliente(id, { activo });
  }

  // ─── Saldo por cliente ─────────────────────────────────────────────────────
  async function getSaldoCliente(clienteId) {
    const movs = await GET(`/movimientos_cliente?cliente_id=eq.${clienteId}&order=fecha.asc,created_at.asc`);
    let saldo = 0;
    (movs || []).forEach(m => {
      if (m.tipo === 'entrega')  saldo += m.cantidad;
      if (m.tipo === 'retorno')  saldo -= m.cantidad;
      if (m.tipo === 'ajuste')   saldo += m.cantidad; // puede ser negativo si se permite
      if (m.tipo === 'baja')     saldo -= m.cantidad;
    });
    return Math.max(0, saldo);
  }

  async function getSaldosTodos() {
    const data = await GET('/movimientos_cliente?select=cliente_id,tipo,cantidad');
    const map = {};
    (data || []).forEach(m => {
      if (!map[m.cliente_id]) map[m.cliente_id] = 0;
      if (m.tipo === 'entrega') map[m.cliente_id] += m.cantidad;
      if (m.tipo === 'retorno') map[m.cliente_id] -= m.cantidad;
      if (m.tipo === 'baja')    map[m.cliente_id] -= m.cantidad;
    });
    return map;
  }

  // ─── Movimientos del cliente (kardex) ──────────────────────────────────────
  async function getMovimientosCliente(clienteId, limit = 100) {
    const data = await GET(`/movimientos_cliente?cliente_id=eq.${clienteId}&order=fecha.desc,created_at.desc&limit=${limit}`);
    return data || [];
  }

  async function registrarMovimientoCliente({
    cliente_id, tipo, cantidad, numero_doc,
    viaje_id, conductor_id, auxiliar_id, notas, admin_registrador
  }) {
    cantidad = parseInt(cantidad, 10);
    if (isNaN(cantidad) || cantidad <= 0) throw new Error('Cantidad inválida');
    if (!cliente_id) throw new Error('Debe seleccionar un cliente');
    const cliente = await getClienteById(cliente_id);
    if (!cliente) throw new Error('Cliente no encontrado');

    // Validar que no supere stock acordado en entrega
    if (tipo === 'entrega' && cliente.stock_acordado > 0) {
      const saldoActual = await getSaldoCliente(cliente_id);
      const nuevo = saldoActual + cantidad;
      if (nuevo > cliente.stock_acordado * 1.2) { // alerta al 120%
        throw new Error(`⚠️ El cliente ${cliente.nombre} tendría ${nuevo} canastillas, superando su stock acordado de ${cliente.stock_acordado}`);
      }
    }

    const row = {
      fecha:            new Date().toISOString().split('T')[0],
      tipo,
      cliente_id,
      cantidad,
      numero_doc:       numero_doc?.trim()  || null,
      viaje_id:         viaje_id            || null,
      conductor_id:     conductor_id        || null,
      auxiliar_id:      auxiliar_id         || null,
      notas:            notas               || '',
      admin_registrador,
      created_at:       new Date().toISOString(),
    };

    const inserted = await POST('/movimientos_cliente', row);
    // Actualizar inventario general
    await _actualizarInventarioGeneral();
    return Array.isArray(inserted) ? inserted[0] : inserted;
  }

  // ─── Inventario general ────────────────────────────────────────────────────
  async function getInventarioGeneral() {
    const data = await GET('/inventario_general?id=eq.main');
    return (data && data[0]) || { id:'main', total_sistema:0, en_bodega:0, en_clientes:0, en_rutas:0, danadas:0 };
  }

  async function _actualizarInventarioGeneral() {
    // en_clientes = suma de saldos activos de todos los clientes
    const saldos = await getSaldosTodos();
    const enClientes = Object.values(saldos).reduce((s, v) => s + Math.max(0, v), 0);
    // en_rutas = viajes abiertos sumando despachado
    const viajesAbiertos = await fetch(BASE + '/viajes?estado=eq.abierto', { headers: H });
    const vaData = await viajesAbiertos.json();
    let enRutas = 0;
    (vaData || []).forEach(v => {
      enRutas += (v.desp_grandes||0)+(v.desp_medianas||0)+(v.desp_pequenas||0)+(v.desp_estibas||0);
    });
    const inv = await getInventarioGeneral();
    const enBodega = inv.total_sistema - enClientes - enRutas - inv.danadas;
    await PATCH('/inventario_general?id=eq.main', {
      en_clientes: enClientes,
      en_rutas:    enRutas,
      en_bodega:   Math.max(0, enBodega),
      updated_at:  new Date().toISOString(),
    });
  }

  async function setTotalSistema(total, danadas = 0) {
    await PATCH('/inventario_general?id=eq.main', {
      total_sistema: parseInt(total, 10),
      danadas:       parseInt(danadas, 10) || 0,
      updated_at:    new Date().toISOString(),
    });
    await _actualizarInventarioGeneral();
  }

  // ─── Alertas ───────────────────────────────────────────────────────────────
  async function getClientesConAlertas() {
    const [clientes, saldos, movs] = await Promise.all([
      getClientes(true),
      getSaldosTodos(),
      GET('/movimientos_cliente?tipo=eq.entrega&select=cliente_id,fecha&order=fecha.desc'),
    ]);

    const ultimaEntrega = {};
    (movs || []).forEach(m => {
      if (!ultimaEntrega[m.cliente_id]) ultimaEntrega[m.cliente_id] = m.fecha;
    });

    return clientes.map(c => {
      const saldo = saldos[c.id] || 0;
      const dias  = ultimaEntrega[c.id]
        ? Math.floor((Date.now() - new Date(ultimaEntrega[c.id])) / 86400000) : null;
      const alerta = saldo === 0 ? null : dias === null ? 'gray'
        : dias < 30 ? 'green' : dias < 60 ? 'yellow' : 'red';
      const superaStock = c.stock_acordado > 0 && saldo > c.stock_acordado;
      return { ...c, saldo, dias, alerta, superaStock };
    }).filter(c => c.saldo > 0 || c.stock_acordado > 0);
  }

  // ─── Reporte análisis mensual ──────────────────────────────────────────────
  async function getResumenMensual() {
    const hoy  = new Date();
    const ini  = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const fin  = hoy.toISOString().split('T')[0];
    const data = await GET(`/movimientos_cliente?fecha=gte.${ini}&fecha=lte.${fin}`);
    let entregas = 0, retornos = 0, bajas = 0;
    (data || []).forEach(m => {
      if (m.tipo === 'entrega') entregas += m.cantidad;
      if (m.tipo === 'retorno') retornos += m.cantidad;
      if (m.tipo === 'baja')    bajas    += m.cantidad;
    });
    return { entregas, retornos, bajas, neto: entregas - retornos };
  }

  return {
    getClientes, getClienteById, addCliente, updateCliente, toggleCliente, invalidateCache,
    getSaldoCliente, getSaldosTodos, getMovimientosCliente,
    registrarMovimientoCliente,
    getInventarioGeneral, setTotalSistema, _actualizarInventarioGeneral,
    getClientesConAlertas, getResumenMensual,
  };
})();
