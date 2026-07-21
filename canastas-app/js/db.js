/**
 * db.js - Data layer usando Supabase
 * Control de Canastas PWA
 */

// ─── Supabase config ──────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://oghprxgonszqtoslreod.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9naHByeGdvbnN6cXRvc2xyZW9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MzE4NjYsImV4cCI6MjEwMDIwNzg2Nn0.tXmRLkAXjXl2w2mRhm8IYgkmBm5qfoUtijLT6Mjf2j4';

const DB = (() => {

  // ─── HTTP helper (sin librería externa, fetch nativo) ──────────────────────
  const BASE = SUPABASE_URL + '/rest/v1';
  const HEADERS = {
    'apikey':        SUPABASE_ANON,
    'Authorization': 'Bearer ' + SUPABASE_ANON,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
  };

  async function api(method, path, body = null, extraHeaders = {}) {
    const opts = {
      method,
      headers: { ...HEADERS, ...extraHeaders },
    };
    if (body !== null) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try { msg = JSON.parse(text).message || text; } catch {}
      throw new Error(msg);
    }
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }

  function GET(path)         { return api('GET',    path); }
  function POST(path, body)  { return api('POST',   path, body); }
  function PATCH(path, body) { return api('PATCH',  path, body, { Prefer: 'return=representation' }); }

  // ─── Cache local mínimo (evita queries innecesarios) ──────────────────────
  let _auxiliaresCache = null;
  let _estadoCache     = null;

  function invalidateCache() {
    _auxiliaresCache = null;
    _estadoCache     = null;
  }

  // ─── Inicialización ────────────────────────────────────────────────────────
  async function init() {
    // Solo verifica conexión; las filas base ya existen por el SQL de setup
    try {
      await getEstado();
    } catch (e) {
      console.error('DB.init error:', e);
    }
  }

  // ─── Auxiliares ───────────────────────────────────────────────────────────

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
    const data = await POST('/auxiliares', {
      nombre: nombre.trim(),
      cedula: cedula.trim(),
      activo: true,
    });
    invalidateCache();
    return Array.isArray(data) ? data[0] : data;
  }

  async function updateAuxiliar(id, campos) {
    const data = await PATCH(`/auxiliares?id=eq.${id}`, campos);
    invalidateCache();
    return Array.isArray(data) ? data[0] : data;
  }

  async function deactivateAuxiliar(id) {
    const estado = await getEstado();
    const pending = (estado.canastas_con_auxiliares || {})[id] || 0;
    if (pending > 0) {
      throw new Error(`El auxiliar tiene ${pending} canastas pendientes por devolver`);
    }
    return updateAuxiliar(id, { activo: false });
  }

  async function reactivateAuxiliar(id) {
    return updateAuxiliar(id, { activo: true });
  }

  // ─── Estado ───────────────────────────────────────────────────────────────

  async function getEstado() {
    if (_estadoCache) return _estadoCache;
    const data = await GET('/estado?id=eq.main');
    _estadoCache = (data && data[0]) || {
      id: 'main',
      canastas_en_bodega: 0,
      canastas_con_auxiliares: {},
      canastas_clientes_prestadas: [],
    };
    return _estadoCache;
  }

  async function saveEstado(estado) {
    estado.updated_at = new Date().toISOString();
    await PATCH('/estado?id=eq.main', {
      canastas_en_bodega:          estado.canastas_en_bodega,
      canastas_con_auxiliares:     estado.canastas_con_auxiliares,
      canastas_clientes_prestadas: estado.canastas_clientes_prestadas,
      updated_at:                  estado.updated_at,
    });
    _estadoCache = estado;
  }

  async function setInventarioInicial(cantidad) {
    if (cantidad < 0) throw new Error('La cantidad no puede ser negativa');
    const estado = await getEstado();
    estado.canastas_en_bodega = cantidad;
    await saveEstado(estado);
    await PATCH('/config?id=eq.main', { inventario_inicial: cantidad });
  }

  async function getConfig() {
    const data = await GET('/config?id=eq.main');
    return (data && data[0]) || { inventario_inicial: 100, mov_counter: 0 };
  }

  // ─── Contador de referencia ───────────────────────────────────────────────

  async function nextMovCounter() {
    // Incremento atómico via RPC o via PATCH leyendo el valor actual
    const cfg = await getConfig();
    const next = (cfg.mov_counter || 0) + 1;
    await PATCH('/config?id=eq.main', { mov_counter: next });
    return next;
  }

  async function generateRef() {
    const year = new Date().getFullYear();
    const num  = String(await nextMovCounter()).padStart(4, '0');
    return `MOV-${year}-${num}`;
  }

  // ─── Movimientos ─────────────────────────────────────────────────────────

  async function getMovimientos() {
    const data = await GET('/movimientos?order=fecha.desc&limit=500');
    return data || [];
  }

  async function registrarMovimiento({ tipo, cantidad, auxiliar_id, cliente_nombre, cliente_prestamo_id, admin_registrador, notas }) {
    cantidad = parseInt(cantidad, 10);
    if (isNaN(cantidad) || cantidad <= 0) throw new Error('Cantidad inválida: debe ser un número mayor a 0');

    const estado = await getEstado();
    let resolvedClienteNombre = cliente_nombre || null;

    switch (tipo) {
      case 'salida_auxiliar': {
        if (!auxiliar_id) throw new Error('Debe seleccionar un auxiliar');
        const aux = await getAuxiliarById(auxiliar_id);
        if (!aux || !aux.activo) throw new Error('Auxiliar inválido o inactivo');
        if (estado.canastas_en_bodega < cantidad) {
          throw new Error(`Solo hay ${estado.canastas_en_bodega} canastas en bodega`);
        }
        estado.canastas_en_bodega -= cantidad;
        estado.canastas_con_auxiliares[auxiliar_id] =
          (estado.canastas_con_auxiliares[auxiliar_id] || 0) + cantidad;
        break;
      }
      case 'entrada_auxiliar': {
        if (!auxiliar_id) throw new Error('Debe seleccionar un auxiliar');
        const auxCant = (estado.canastas_con_auxiliares[auxiliar_id] || 0);
        if (auxCant < cantidad) {
          throw new Error(`El auxiliar solo tiene ${auxCant} canastas fuera`);
        }
        estado.canastas_en_bodega += cantidad;
        estado.canastas_con_auxiliares[auxiliar_id] = auxCant - cantidad;
        if (estado.canastas_con_auxiliares[auxiliar_id] === 0) {
          delete estado.canastas_con_auxiliares[auxiliar_id];
        }
        break;
      }
      case 'entrada_cliente': {
        if (!cliente_nombre || !cliente_nombre.trim()) throw new Error('Debe ingresar el nombre del cliente');
        const prestamo = {
          id:            crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
          cliente:       cliente_nombre.trim(),
          cantidad,
          fecha_entrada: new Date().toISOString(),
        };
        estado.canastas_clientes_prestadas.push(prestamo);
        estado.canastas_en_bodega += cantidad;
        resolvedClienteNombre = cliente_nombre.trim();
        break;
      }
      case 'salida_cliente': {
        if (!cliente_prestamo_id) throw new Error('Debe seleccionar el préstamo del cliente');
        const pIdx = estado.canastas_clientes_prestadas.findIndex(p => p.id === cliente_prestamo_id);
        if (pIdx === -1) throw new Error('Préstamo de cliente no encontrado');
        const prestamo = estado.canastas_clientes_prestadas[pIdx];
        if (cantidad > prestamo.cantidad) {
          throw new Error(`El préstamo solo tiene ${prestamo.cantidad} canastas`);
        }
        if (estado.canastas_en_bodega < cantidad) {
          throw new Error(`Solo hay ${estado.canastas_en_bodega} canastas en bodega para devolver`);
        }
        estado.canastas_en_bodega -= cantidad;
        if (cantidad === prestamo.cantidad) {
          estado.canastas_clientes_prestadas.splice(pIdx, 1);
        } else {
          estado.canastas_clientes_prestadas[pIdx] = {
            ...prestamo,
            cantidad: prestamo.cantidad - cantidad,
          };
        }
        resolvedClienteNombre = prestamo.cliente;
        break;
      }
      default:
        throw new Error('Tipo de movimiento desconocido');
    }

    // Guardar estado actualizado
    await saveEstado(estado);

    // Insertar movimiento
    const ref = await generateRef();
    const mov = {
      referencia_numero: ref,
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

  // ─── Historial con filtros ────────────────────────────────────────────────

  async function filtrarMovimientos({ fechaDesde, fechaHasta, tipo, auxiliar_id } = {}) {
    let path = '/movimientos?order=fecha.desc&limit=1000';

    if (fechaDesde) path += `&fecha=gte.${fechaDesde}T00:00:00`;
    if (fechaHasta) path += `&fecha=lte.${fechaHasta}T23:59:59`;
    if (tipo && tipo !== 'todos') path += `&tipo=eq.${tipo}`;
    if (auxiliar_id && auxiliar_id !== 'todos') path += `&auxiliar_id=eq.${auxiliar_id}`;

    const data = await GET(path);
    return data || [];
  }

  // ─── Reset ────────────────────────────────────────────────────────────────

  async function resetData() {
    // Borra movimientos
    await api('DELETE', '/movimientos?id=neq.00000000-0000-0000-0000-000000000000');
    // Resetea estado
    await PATCH('/estado?id=eq.main', {
      canastas_en_bodega: 100,
      canastas_con_auxiliares: {},
      canastas_clientes_prestadas: [],
      updated_at: new Date().toISOString(),
    });
    // Resetea contador
    await PATCH('/config?id=eq.main', { mov_counter: 0, inventario_inicial: 100 });
    invalidateCache();
  }

  // ─── CSV Export ───────────────────────────────────────────────────────────

  async function exportCSV() {
    const movs = await getMovimientos();
    const auxiliares = await getAuxiliares();
    const auxMap = {};
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

  // ─── Utilidades ──────────────────────────────────────────────────────────

  function formatFecha(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins  = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  }

  // Public API
  return {
    init,
    getAuxiliares,
    getAuxiliarById,
    addAuxiliar,
    updateAuxiliar,
    deactivateAuxiliar,
    reactivateAuxiliar,
    getEstado,
    setInventarioInicial,
    getConfig,
    getMovimientos,
    registrarMovimiento,
    filtrarMovimientos,
    resetData,
    exportCSV,
    formatFecha,
    invalidateCache,
  };
})();
