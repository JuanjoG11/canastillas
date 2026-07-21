/**
 * db.js - Data layer usando Supabase
 * Control de Canastas PWA
 */

const SUPABASE_URL  = 'https://oghprxgonszqtoslreod.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9naHByeGdvbnN6cXRvc2xyZW9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MzE4NjYsImV4cCI6MjEwMDIwNzg2Nn0.tXmRLkAXjXl2w2mRhm8IYgkmBm5qfoUtijLT6Mjf2j4';

const DB = (() => {

  const BASE    = SUPABASE_URL + '/rest/v1';
  const HEADERS = {
    'apikey':        SUPABASE_ANON,
    'Authorization': 'Bearer ' + SUPABASE_ANON,
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

  // ─── Cache ─────────────────────────────────────────────────────────────────
  let _auxiliaresCache = null;
  let _estadoCache     = null;

  function invalidateCache() { _auxiliaresCache = null; _estadoCache = null; }

  // ─── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    try { await getEstado(); } catch (e) { console.error('DB.init:', e); }
  }

  // ─── Auxiliares ────────────────────────────────────────────────────────────
  async function getAuxiliares(soloActivos = false) {
    if (_auxiliaresCache) {
      return soloActivos ? _auxiliaresCache.filter(a => a.activo) : _auxiliaresCache;
    }
    const data = await GET('/auxiliares?order=nombre.asc');
    _auxiliaresCache = data || [];
    return soloActivos ? _auxiliaresCache.filter(a => a.activo) : _auxiliaresCache;
  }

  async function getAuxiliarById(id) {
    const list = await getAuxiliares();
    return list.find(a => a.id === id) || null;
  }

  async function addAuxiliar(nombre, cedula) {
    const data = await POST('/auxiliares', { nombre: nombre.trim(), cedula: cedula.trim(), activo: true });
    invalidateCache();
    return Array.isArray(data) ? data[0] : data;
  }

  async function updateAuxiliar(id, campos) {
    const data = await PATCH(`/auxiliares?id=eq.${id}`, campos);
    invalidateCache();
    return Array.isArray(data) ? data[0] : data;
  }

  async function deactivateAuxiliar(id) {
    const estado  = await getEstado();
    const pending = (estado.canastas_con_auxiliares || {})[id] || 0;
    if (pending > 0) throw new Error(`El auxiliar tiene ${pending} canastas pendientes por devolver`);
    return updateAuxiliar(id, { activo: false });
  }

  async function reactivateAuxiliar(id) {
    return updateAuxiliar(id, { activo: true });
  }

  // ─── Estado ────────────────────────────────────────────────────────────────
  async function getEstado() {
    if (_estadoCache) return _estadoCache;
    let data = null;
    try { data = await GET('/estado?id=eq.main'); } catch (e) { console.warn('getEstado:', e); }
    
    if (data && data.length > 0) {
      _estadoCache = data[0];
    } else {
      _estadoCache = {
        id: 'main',
        canastas_en_bodega: 0,
        canastas_con_auxiliares: {},
        canastas_clientes_prestadas: [],
      };
    }
    return _estadoCache;
  }

  async function saveEstado(estado) {
    estado.updated_at = new Date().toISOString();
    const payload = {
      id:                            'main',
      canastas_en_bodega:            estado.canastas_en_bodega,
      canastas_con_auxiliares:       estado.canastas_con_auxiliares || {},
      canastas_clientes_prestadas:   estado.canastas_clientes_prestadas || [],
      updated_at:                    estado.updated_at,
    };
    try {
      await api('POST', '/estado?on_conflict=id', payload, {
        'Prefer': 'resolution=merge-duplicates,return=representation'
      });
    } catch (e) {
      // Fallback a PATCH
      await PATCH('/estado?id=eq.main', payload);
    }
    _estadoCache = estado;
  }

  async function setInventarioInicial(cantidad) {
    if (cantidad < 0) throw new Error('La cantidad no puede ser negativa');
    const estado = await getEstado();
    estado.canastas_en_bodega = Number(cantidad);
    await saveEstado(estado);

    const cfg = await getConfig();
    cfg.inventario_inicial = Number(cantidad);
    await saveConfig(cfg);
  }

  async function getConfig() {
    let data = null;
    try { data = await GET('/config?id=eq.main'); } catch {}
    return (data && data[0]) || { id: 'main', inventario_inicial: 100, mov_counter: 0 };
  }

  async function saveConfig(cfg) {
    const payload = {
      id:                 'main',
      inventario_inicial: cfg.inventario_inicial ?? 100,
      mov_counter:        cfg.mov_counter ?? 0,
    };
    try {
      await api('POST', '/config?on_conflict=id', payload, {
        'Prefer': 'resolution=merge-duplicates,return=representation'
      });
    } catch (e) {
      await PATCH('/config?id=eq.main', payload);
    }
  }

  // ─── Referencia ────────────────────────────────────────────────────────────
  async function generateRef() {
    const cfg  = await getConfig();
    const next = (cfg.mov_counter || 0) + 1;
    cfg.mov_counter = next;
    await saveConfig(cfg);
    const year = new Date().getFullYear();
    return `MOV-${year}-${String(next).padStart(4, '0')}`;
  }

  // ─── Movimientos ───────────────────────────────────────────────────────────
  async function getMovimientos() {
    const data = await GET('/movimientos?order=fecha.desc&limit=500');
    return data || [];
  }

  // Paginado para historial
  async function getMovimientosPaginados({ page = 1, pageSize = 50, fechaDesde, fechaHasta, tipo, auxiliar_id } = {}) {
    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    let path = '/movimientos?order=fecha.desc';
    if (fechaDesde)                              path += `&fecha=gte.${fechaDesde}T00:00:00`;
    if (fechaHasta)                              path += `&fecha=lte.${fechaHasta}T23:59:59`;
    if (tipo && tipo !== 'todos')                path += `&tipo=eq.${tipo}`;
    if (auxiliar_id && auxiliar_id !== 'todos')  path += `&auxiliar_id=eq.${auxiliar_id}`;

    const res  = await fetch(BASE + path, {
      headers: { ...HEADERS, 'Range': `${from}-${to}`, 'Range-Unit': 'items', 'Prefer': 'count=exact' },
    });
    const text = await res.text();
    let rows = [];
    try { rows = JSON.parse(text); } catch {}
    const cr    = res.headers.get('Content-Range') || '';
    const total = parseInt((cr.split('/')[1] || '0'), 10) || rows.length;
    return { rows, total };
  }

  /**
   * Registrar movimiento.
   *
   * Tipos:
   *  salida_auxiliar  → auxiliar_id requerido. Sale de bodega, suma al auxiliar.
   *  entrada_auxiliar → auxiliar_id requerido. Entra a bodega, resta al auxiliar.
   *  entrada_cliente  → cliente_nombre + auxiliar_id requeridos.
   *                     El auxiliar entrega las canastas del cliente a bodega.
   *                     Queda registrado qué auxiliar hizo la gestión.
   *  salida_cliente   → cliente_prestamo_id + auxiliar_id requeridos.
   *                     Se devuelven canastas al cliente, el auxiliar las saca de bodega.
   */
  async function registrarMovimiento({ tipo, cantidad, auxiliar_id, cliente_nombre, cliente_prestamo_id, admin_registrador, notas }) {
    cantidad = parseInt(cantidad, 10);
    if (isNaN(cantidad) || cantidad <= 0) throw new Error('Cantidad inválida: debe ser mayor a 0');

    const estado = await getEstado();
    let resolvedClienteNombre = cliente_nombre || null;

    switch (tipo) {

      case 'salida_auxiliar': {
        if (!auxiliar_id) throw new Error('Debe seleccionar un auxiliar');
        const aux = await getAuxiliarById(auxiliar_id);
        if (!aux || !aux.activo) throw new Error('Auxiliar inválido o inactivo');
        if (estado.canastas_en_bodega < cantidad)
          throw new Error(`Solo hay ${estado.canastas_en_bodega} canastas en bodega`);
        estado.canastas_en_bodega -= cantidad;
        estado.canastas_con_auxiliares[auxiliar_id] =
          (estado.canastas_con_auxiliares[auxiliar_id] || 0) + cantidad;
        break;
      }

      case 'entrada_auxiliar': {
        if (!auxiliar_id) throw new Error('Debe seleccionar un auxiliar');
        const auxCant = (estado.canastas_con_auxiliares[auxiliar_id] || 0);
        if (auxCant < cantidad)
          throw new Error(`El auxiliar solo tiene ${auxCant} canastas fuera`);
        estado.canastas_en_bodega += cantidad;
        estado.canastas_con_auxiliares[auxiliar_id] = auxCant - cantidad;
        if (estado.canastas_con_auxiliares[auxiliar_id] === 0)
          delete estado.canastas_con_auxiliares[auxiliar_id];
        break;
      }

      case 'entrada_cliente': {
        // El cliente deja canastas; el auxiliar las recibe y las mete a bodega.
        if (!cliente_nombre || !cliente_nombre.trim()) throw new Error('Debe ingresar el nombre del cliente');
        if (!auxiliar_id) throw new Error('Debe seleccionar el auxiliar responsable');
        const aux = await getAuxiliarById(auxiliar_id);
        if (!aux || !aux.activo) throw new Error('Auxiliar inválido o inactivo');

        const prestamoId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
        estado.canastas_clientes_prestadas.push({
          id:           prestamoId,
          cliente:      cliente_nombre.trim(),
          cantidad,
          auxiliar_id,                          // queda registrado quién lo gestionó
          fecha_entrada: new Date().toISOString(),
        });
        estado.canastas_en_bodega += cantidad;
        resolvedClienteNombre = cliente_nombre.trim();
        break;
      }

      case 'salida_cliente': {
        // Se devuelven canastas al cliente; el auxiliar las saca de bodega.
        if (!cliente_prestamo_id) throw new Error('Debe seleccionar el préstamo del cliente');
        if (!auxiliar_id) throw new Error('Debe seleccionar el auxiliar que entrega');
        const pIdx = estado.canastas_clientes_prestadas.findIndex(p => p.id === cliente_prestamo_id);
        if (pIdx === -1) throw new Error('Préstamo de cliente no encontrado');
        const prestamo = estado.canastas_clientes_prestadas[pIdx];
        if (cantidad > prestamo.cantidad)
          throw new Error(`El préstamo solo tiene ${prestamo.cantidad} canastas`);
        if (estado.canastas_en_bodega < cantidad)
          throw new Error(`Solo hay ${estado.canastas_en_bodega} canastas en bodega`);
        estado.canastas_en_bodega -= cantidad;
        if (cantidad === prestamo.cantidad) {
          estado.canastas_clientes_prestadas.splice(pIdx, 1);
        } else {
          estado.canastas_clientes_prestadas[pIdx] = { ...prestamo, cantidad: prestamo.cantidad - cantidad };
        }
        resolvedClienteNombre = prestamo.cliente;
        break;
      }

      default:
        throw new Error('Tipo de movimiento desconocido');
    }

    await saveEstado(estado);

    const ref = await generateRef();
    const mov = {
      referencia_numero:   ref,
      tipo,
      cantidad,
      auxiliar_id:         auxiliar_id || null,
      cliente_nombre:      resolvedClienteNombre,
      cliente_prestamo_id: cliente_prestamo_id || null,
      admin_registrador,
      notas:               notas || '',
      fecha:               new Date().toISOString(),
    };

    const inserted = await POST('/movimientos', mov);
    return Array.isArray(inserted) ? inserted[0] : inserted;
  }

  // ─── Anular movimiento ────────────────────────────────────────────────────
  /**
   * Anula un movimiento:
   * 1. Marca el original como anulado
   * 2. Crea un movimiento espejo que revierte el estado
   */
  async function anularMovimiento(movId, adminRegistrador) {
    // Buscar el movimiento original
    const data = await GET(`/movimientos?id=eq.${movId}`);
    const mov  = data && data[0];
    if (!mov) throw new Error('Movimiento no encontrado');
    if (mov.anulado) throw new Error('Este movimiento ya fue anulado');

    const estado = await getEstado();

    // Calcular tipo espejo
    const tipoEspejo = {
      salida_auxiliar:  'entrada_auxiliar',
      entrada_auxiliar: 'salida_auxiliar',
      entrada_cliente:  'salida_cliente',
      salida_cliente:   'entrada_cliente',
    }[mov.tipo];
    if (!tipoEspejo) throw new Error('Tipo de movimiento no reversible');

    // Revertir estado
    switch (mov.tipo) {
      case 'salida_auxiliar':
        estado.canastas_en_bodega += mov.cantidad;
        estado.canastas_con_auxiliares[mov.auxiliar_id] =
          (estado.canastas_con_auxiliares[mov.auxiliar_id] || 0) - mov.cantidad;
        if ((estado.canastas_con_auxiliares[mov.auxiliar_id] || 0) <= 0)
          delete estado.canastas_con_auxiliares[mov.auxiliar_id];
        break;
      case 'entrada_auxiliar':
        estado.canastas_en_bodega -= mov.cantidad;
        estado.canastas_con_auxiliares[mov.auxiliar_id] =
          (estado.canastas_con_auxiliares[mov.auxiliar_id] || 0) + mov.cantidad;
        break;
      case 'entrada_cliente': {
        // Quitar el préstamo que se creó
        estado.canastas_en_bodega -= mov.cantidad;
        const pidx = estado.canastas_clientes_prestadas.findIndex(
          p => p.cliente === mov.cliente_nombre && p.cantidad === mov.cantidad
        );
        if (pidx !== -1) estado.canastas_clientes_prestadas.splice(pidx, 1);
        break;
      }
      case 'salida_cliente':
        estado.canastas_en_bodega += mov.cantidad;
        // Re-agregar préstamo si fue devuelto completamente
        if (mov.cliente_nombre) {
          estado.canastas_clientes_prestadas.push({
            id:            crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
            cliente:       mov.cliente_nombre,
            cantidad:      mov.cantidad,
            auxiliar_id:   mov.auxiliar_id || null,
            fecha_entrada: new Date().toISOString(),
          });
        }
        break;
    }

    await saveEstado(estado);

    // Marcar original como anulado
    await PATCH(`/movimientos?id=eq.${movId}`, {
      anulado:       true,
      anulado_por:   adminRegistrador,
      anulacion_ref: mov.referencia_numero,
    });

    // Crear movimiento espejo
    const ref   = await generateRef();
    const espejo = {
      referencia_numero:   ref,
      tipo:                tipoEspejo,
      cantidad:            mov.cantidad,
      auxiliar_id:         mov.auxiliar_id || null,
      cliente_nombre:      mov.cliente_nombre || null,
      cliente_prestamo_id: mov.cliente_prestamo_id || null,
      admin_registrador:   adminRegistrador,
      notas:               `Anulación de ${mov.referencia_numero}`,
      anulacion_ref:       mov.referencia_numero,
      fecha:               new Date().toISOString(),
    };

    const inserted = await POST('/movimientos', espejo);
    invalidateCache();
    return Array.isArray(inserted) ? inserted[0] : inserted;
  }

  // ─── Guardar firma en un movimiento ───────────────────────────────────────
  async function guardarFirma(movId, firmaUrl) {
    await PATCH(`/movimientos?id=eq.${movId}`, { firma_url: firmaUrl });
  }
  async function getMovimientosPorAuxiliar(auxiliar_id, limit = 100) {
    const path = `/movimientos?auxiliar_id=eq.${auxiliar_id}&order=fecha.desc&limit=${limit}`;
    return (await GET(path)) || [];
  }

  async function filtrarMovimientos({ fechaDesde, fechaHasta, tipo, auxiliar_id } = {}) {
    let path = '/movimientos?order=fecha.desc&limit=1000';
    if (fechaDesde)                             path += `&fecha=gte.${fechaDesde}T00:00:00`;
    if (fechaHasta)                             path += `&fecha=lte.${fechaHasta}T23:59:59`;
    if (tipo && tipo !== 'todos')               path += `&tipo=eq.${tipo}`;
    if (auxiliar_id && auxiliar_id !== 'todos') path += `&auxiliar_id=eq.${auxiliar_id}`;
    return (await GET(path)) || [];
  }

  // ─── Reset ─────────────────────────────────────────────────────────────────
  async function resetData() {
    await api('DELETE', '/movimientos?id=neq.00000000-0000-0000-0000-000000000000');
    await PATCH('/estado?id=eq.main', {
      canastas_en_bodega: 100,
      canastas_con_auxiliares: {},
      canastas_clientes_prestadas: [],
      updated_at: new Date().toISOString(),
    });
    await PATCH('/config?id=eq.main', { mov_counter: 0, inventario_inicial: 100 });
    invalidateCache();
  }

  // ─── CSV Export ────────────────────────────────────────────────────────────
  async function exportCSV() {
    const movs       = await getMovimientos();
    const auxiliares = await getAuxiliares();
    const auxMap     = {};
    auxiliares.forEach(a => { auxMap[a.id] = a.nombre; });

    const TIPO_LABELS = {
      salida_auxiliar:  'Salida a Auxiliar',
      entrada_auxiliar: 'Entrada de Auxiliar',
      entrada_cliente:  'Entrada de Cliente',
      salida_cliente:   'Salida a Cliente',
    };

    const headers = ['Referencia', 'Fecha', 'Tipo', 'Cantidad', 'Auxiliar', 'Cliente', 'Admin', 'Notas'];
    const rows = movs.map(m => [
      m.referencia_numero,
      formatFecha(m.fecha),
      TIPO_LABELS[m.tipo] || m.tipo,
      m.cantidad,
      m.auxiliar_id ? (auxMap[m.auxiliar_id] || m.auxiliar_id) : '',
      m.cliente_nombre || '',
      m.admin_registrador,
      m.notas,
    ]);

    return [headers, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  // ─── Utils ─────────────────────────────────────────────────────────────────
  function formatFecha(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  return {
    init, getAuxiliares, getAuxiliarById, addAuxiliar, updateAuxiliar,
    deactivateAuxiliar, reactivateAuxiliar,
    getEstado, setInventarioInicial, getConfig,
    getMovimientos, getMovimientosPaginados, getMovimientosPorAuxiliar, registrarMovimiento, filtrarMovimientos,
    anularMovimiento, guardarFirma,
    resetData, exportCSV, formatFecha, invalidateCache,
  };
})();
