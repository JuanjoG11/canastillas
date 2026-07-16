/**
 * db.js - Data layer for Control de Canastas PWA
 * Uses localStorage for persistence
 */

const DB = (() => {
  const KEYS = {
    AUXILIARES: 'canastas_auxiliares',
    MOVIMIENTOS: 'canastas_movimientos',
    ESTADO: 'canastas_estado',
    CONFIG: 'canastas_config',
    MOV_COUNTER: 'canastas_mov_counter',
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function load(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('DB.load error', key, e);
      return null;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('DB.save error', key, e);
    }
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function nextMovCounter() {
    let counter = load(KEYS.MOV_COUNTER) || 0;
    counter += 1;
    save(KEYS.MOV_COUNTER, counter);
    return counter;
  }

  function generateRef() {
    const year = new Date().getFullYear();
    const num = String(nextMovCounter()).padStart(4, '0');
    return `MOV-${year}-${num}`;
  }

  // ─── Seed / Init ────────────────────────────────────────────────────────────

  function init() {
    if (!load(KEYS.AUXILIARES)) {
      const auxiliares = [
        { id: 'aux1', nombre: 'Carlos Gómez',  cedula: '12345678', activo: true },
        { id: 'aux2', nombre: 'Ana Martínez',  cedula: '87654321', activo: true },
        { id: 'aux3', nombre: 'Luis Herrera',  cedula: '11223344', activo: true },
      ];
      save(KEYS.AUXILIARES, auxiliares);
    }

    if (!load(KEYS.ESTADO)) {
      const estado = {
        canastas_en_bodega: 100,
        canastas_con_auxiliares: {},
        canastas_clientes_prestadas: [],
      };
      save(KEYS.ESTADO, estado);
    }

    if (!load(KEYS.CONFIG)) {
      save(KEYS.CONFIG, { inventario_inicial: 100 });
    }

    if (!load(KEYS.MOVIMIENTOS)) {
      // Seed 2 sample movements
      const now = Date.now();
      const movimientos = [];

      // Movement 1: salida_auxiliar
      const ref1 = generateRef();
      movimientos.push({
        id: generateId(),
        referencia_numero: ref1,
        tipo: 'salida_auxiliar',
        cantidad: 10,
        auxiliar_id: 'aux1',
        cliente_nombre: null,
        fecha: new Date(now - 86400000 * 2).toISOString(),
        admin_registrador: 'admin1',
        notas: 'Movimiento inicial de ejemplo',
      });

      // Movement 2: entrada_cliente
      const ref2 = generateRef();
      const clientePrestamoId = generateId();
      movimientos.push({
        id: generateId(),
        referencia_numero: ref2,
        tipo: 'entrada_cliente',
        cantidad: 20,
        auxiliar_id: null,
        cliente_nombre: 'Distribuciones López',
        cliente_prestamo_id: clientePrestamoId,
        fecha: new Date(now - 86400000).toISOString(),
        admin_registrador: 'admin1',
        notas: 'Cliente dejó canastas en préstamo',
      });

      save(KEYS.MOVIMIENTOS, movimientos);

      // Reflect seed movements in estado
      const estado = load(KEYS.ESTADO);
      // salida_auxiliar: bodega -10, aux1 +10
      estado.canastas_en_bodega -= 10;
      estado.canastas_con_auxiliares['aux1'] = 10;
      // entrada_cliente: client baskets added to bodega
      estado.canastas_en_bodega += 20;
      estado.canastas_clientes_prestadas.push({
        id: clientePrestamoId,
        cliente: 'Distribuciones López',
        cantidad: 20,
        fecha_entrada: new Date(now - 86400000).toISOString(),
      });
      save(KEYS.ESTADO, estado);
    }
  }

  // ─── Auxiliares CRUD ────────────────────────────────────────────────────────

  function getAuxiliares(soloActivos = false) {
    const list = load(KEYS.AUXILIARES) || [];
    return soloActivos ? list.filter(a => a.activo) : list;
  }

  function getAuxiliarById(id) {
    return getAuxiliares().find(a => a.id === id) || null;
  }

  function addAuxiliar(nombre, cedula) {
    const list = getAuxiliares();
    const dup = list.find(a => a.cedula === cedula.trim());
    if (dup) throw new Error(`Ya existe un auxiliar con cédula ${cedula}`);
    const aux = { id: generateId(), nombre: nombre.trim(), cedula: cedula.trim(), activo: true };
    list.push(aux);
    save(KEYS.AUXILIARES, list);
    return aux;
  }

  function updateAuxiliar(id, campos) {
    const list = getAuxiliares();
    const idx = list.findIndex(a => a.id === id);
    if (idx === -1) throw new Error('Auxiliar no encontrado');
    list[idx] = { ...list[idx], ...campos };
    save(KEYS.AUXILIARES, list);
    return list[idx];
  }

  function deactivateAuxiliar(id) {
    const estado = load(KEYS.ESTADO);
    const pending = estado.canastas_con_auxiliares[id] || 0;
    if (pending > 0) {
      throw new Error(`El auxiliar tiene ${pending} canastas pendientes por devolver`);
    }
    return updateAuxiliar(id, { activo: false });
  }

  function reactivateAuxiliar(id) {
    return updateAuxiliar(id, { activo: true });
  }

  // ─── Estado ─────────────────────────────────────────────────────────────────

  function getEstado() {
    return load(KEYS.ESTADO) || {
      canastas_en_bodega: 0,
      canastas_con_auxiliares: {},
      canastas_clientes_prestadas: [],
    };
  }

  function setInventarioInicial(cantidad) {
    if (cantidad < 0) throw new Error('La cantidad no puede ser negativa');
    const estado = getEstado();
    const config = load(KEYS.CONFIG) || {};
    config.inventario_inicial = cantidad;
    save(KEYS.CONFIG, config);
    estado.canastas_en_bodega = cantidad;
    save(KEYS.ESTADO, estado);
  }

  function getConfig() {
    return load(KEYS.CONFIG) || { inventario_inicial: 0 };
  }

  // ─── Movimientos ────────────────────────────────────────────────────────────

  function getMovimientos() {
    return load(KEYS.MOVIMIENTOS) || [];
  }

  /**
   * Registra un movimiento y actualiza el estado.
   * tipo: 'salida_auxiliar' | 'entrada_auxiliar' | 'entrada_cliente' | 'salida_cliente'
   */
  function registrarMovimiento({ tipo, cantidad, auxiliar_id, cliente_nombre, cliente_prestamo_id, admin_registrador, notas }) {
    cantidad = parseInt(cantidad, 10);
    if (isNaN(cantidad) || cantidad <= 0) throw new Error('Cantidad inválida: debe ser un número mayor a 0');

    const estado = getEstado();
    const movimientos = getMovimientos();
    let resolvedClienteNombre = cliente_nombre || null;

    switch (tipo) {
      case 'salida_auxiliar': {
        if (!auxiliar_id) throw new Error('Debe seleccionar un auxiliar');
        const aux = getAuxiliarById(auxiliar_id);
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
        const auxCant = estado.canastas_con_auxiliares[auxiliar_id] || 0;
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
          id: generateId(),
          cliente: cliente_nombre.trim(),
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

    const mov = {
      id: generateId(),
      referencia_numero: generateRef(),
      tipo,
      cantidad,
      auxiliar_id: auxiliar_id || null,
      cliente_nombre: resolvedClienteNombre,
      fecha: new Date().toISOString(),
      admin_registrador,
      notas: notas || '',
    };

    movimientos.push(mov);
    save(KEYS.MOVIMIENTOS, movimientos);
    save(KEYS.ESTADO, estado);
    return mov;
  }

  // ─── Historial filters ──────────────────────────────────────────────────────

  function filtrarMovimientos({ fechaDesde, fechaHasta, tipo, auxiliar_id } = {}) {
    let movs = getMovimientos();
    if (fechaDesde) {
      const d = new Date(fechaDesde + 'T00:00:00');
      movs = movs.filter(m => new Date(m.fecha) >= d);
    }
    if (fechaHasta) {
      const h = new Date(fechaHasta + 'T23:59:59');
      movs = movs.filter(m => new Date(m.fecha) <= h);
    }
    if (tipo && tipo !== 'todos') {
      movs = movs.filter(m => m.tipo === tipo);
    }
    if (auxiliar_id && auxiliar_id !== 'todos') {
      movs = movs.filter(m => m.auxiliar_id === auxiliar_id);
    }
    return movs.slice().reverse();
  }

  // ─── Reset ──────────────────────────────────────────────────────────────────

  function resetData() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    init();
  }

  // ─── CSV Export ─────────────────────────────────────────────────────────────

  function exportCSV() {
    const movs = getMovimientos().slice().reverse();
    const auxiliares = getAuxiliares();
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

  // ─── Utilities ──────────────────────────────────────────────────────────────

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
  };
})();
