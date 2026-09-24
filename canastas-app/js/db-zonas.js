/**
 * db-zonas.js — Módulo de zonas y stock diario
 * Control de Canastas PWA v3
 *
 * Flujo:
 *  1. Usuario sube Excel con columnas: batch | Cubeta Grande | Cubeta pequeña
 *  2. Se agrupa por batch sumando grandes y pequeñas
 *  3. Se hace upsert en stock_diario para la fecha de hoy
 *  4. Las zonas nuevas se crean automáticamente en la tabla zonas
 *  5. Al despachar un viaje se asigna zona_id y se descuenta del stock
 */

const DB_ZONAS = (() => {

  const BASE = 'https://oghprxgonszqtoslreod.supabase.co/rest/v1';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9naHByeGdvbnN6cXRvc2xyZW9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MzE4NjYsImV4cCI6MjEwMDIwNzg2Nn0.tXmRLkAXjXl2w2mRhm8IYgkmBm5qfoUtijLT6Mjf2j4';
  const H = {
    'apikey': ANON,
    'Authorization': 'Bearer ' + ANON,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  async function api(method, path, body = null, extra = {}) {
    const opts = { method, headers: { ...H, ...extra } };
    if (body !== null) opts.body = JSON.stringify(body);
    const res  = await fetch(BASE + path, opts);
    const text = await res.text();
    if (!res.ok) {
      let m = text;
      try { m = JSON.parse(text).message || text; } catch {}
      throw new Error(m);
    }
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }

  const GET    = p       => api('GET', p);
  const POST   = (p, b)  => api('POST',  p, b);
  const PATCH  = (p, b)  => api('PATCH', p, b, { Prefer: 'return=representation' });

  // ─── Zonas ─────────────────────────────────────────────────────────────────
  let _zonasCache = null;

  function invalidateCache() { _zonasCache = null; }

  async function getZonas(soloActivas = false) {
    if (_zonasCache) return soloActivas ? _zonasCache.filter(z => z.activa) : _zonasCache;
    const data = await GET('/zonas?order=id.asc');
    _zonasCache = data || [];
    return soloActivas ? _zonasCache.filter(z => z.activa) : _zonasCache;
  }

  async function upsertZona(id, nombre = null) {
    // Crea la zona si no existe, la ignora si ya existe
    const payload = { id: String(id), activa: true };
    if (nombre) payload.nombre = nombre;
    try {
      await api('POST', '/zonas?on_conflict=id', payload, {
        Prefer: 'resolution=merge-duplicates,return=representation',
      });
    } catch (e) {
      console.warn('upsertZona:', e.message);
    }
    invalidateCache();
  }

  async function updateZonaNombre(id, nombre) {
    await PATCH(`/zonas?id=eq.${encodeURIComponent(id)}`, { nombre: nombre.trim() });
    invalidateCache();
  }

  // ─── Stock diario ──────────────────────────────────────────────────────────
  async function getStockHoy() {
    const hoy = _fechaHoy();
    const data = await GET(`/stock_diario?fecha=eq.${hoy}&order=zona_id.asc`);
    return data || [];
  }

  async function getStockFecha(fecha) {
    const data = await GET(`/stock_diario?fecha=eq.${fecha}&order=zona_id.asc`);
    return data || [];
  }

  async function getStockZonaHoy(zona_id) {
    const hoy = _fechaHoy();
    const data = await GET(`/stock_diario?fecha=eq.${hoy}&zona_id=eq.${encodeURIComponent(zona_id)}`);
    return (data && data[0]) || null;
  }

  /**
   * Carga masiva desde Excel parseado.
   * rows: [{ batch, grandes, medianas, pequenas }]
   * Hace upsert de zonas y stock_diario para hoy.
   * Devuelve resumen: { zonas: N, grandes: X, pequenas: Y }
   */
  async function cargarStockDiario(rows, cargadoPor = '') {
    if (!rows || rows.length === 0) throw new Error('Sin datos para cargar');
    const hoy = _fechaHoy();

    // 1. Asegurar que todas las zonas existen
    const zonaIds = [...new Set(rows.map(r => String(r.batch)))];
    for (const id of zonaIds) {
      await upsertZona(id);
    }

    // 2. Upsert stock_diario (reemplaza el día actual)
    const payload = rows.map(r => ({
      fecha:       hoy,
      zona_id:     String(r.batch),
      grandes:     r.grandes  || 0,
      pequenas:    r.pequenas || 0,
      cargado_por: cargadoPor || '',
    }));

    // Supabase no hace upsert masivo bien con on_conflict, hacemos de a batch de 50
    const CHUNK = 50;
    for (let i = 0; i < payload.length; i += CHUNK) {
      const chunk = payload.slice(i, i + CHUNK);
      await api('POST', '/stock_diario?on_conflict=fecha,zona_id', chunk, {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      });
    }

    invalidateCache();

    const totalG = rows.reduce((s, r) => s + (r.grandes  || 0), 0);
    const totalP = rows.reduce((s, r) => s + (r.pequenas || 0), 0);
    return { zonas: zonaIds.length, grandes: totalG, pequenas: totalP };
  }

  /**
   * Descontar cubetas de una zona al registrar un viaje.
   * No bloquea si no hay stock (solo registra la diferencia).
   */
  async function descontarStock(zona_id, grandes, pequenas) {
    const stock = await getStockZonaHoy(zona_id);
    if (!stock) return null; // zona sin stock cargado hoy — no bloquear
    const nuevoG = Math.max(0, (stock.grandes  || 0) - (grandes  || 0));
    const nuevoP = Math.max(0, (stock.pequenas || 0) - (pequenas || 0));
    await PATCH(
      `/stock_diario?fecha=eq.${stock.fecha}&zona_id=eq.${encodeURIComponent(zona_id)}`,
      { grandes: nuevoG, pequenas: nuevoP }
    );
    return { grandes: nuevoG, pequenas: nuevoP };
  }

  // ─── Historial de despachos por zona ──────────────────────────────────────
  async function getViajesPorZona(zona_id, limit = 50) {
    const data = await fetch(
      `${BASE}/viajes?zona_id=eq.${encodeURIComponent(zona_id)}&order=fecha.desc,created_at.desc&limit=${limit}`,
      { headers: H }
    );
    const text = await data.text();
    try { return JSON.parse(text) || []; } catch { return []; }
  }

  // ─── Parser de Excel/TSV ──────────────────────────────────────────────────
  /**
   * Normaliza un string: minúsculas, sin tildes, sin espacios extra.
   * Así "Cubeta pequeña", "cubeta pequena", "Cubeta Pequeña" → "cubeta pequena"
   */
  function _norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')                    // descompone letras con tilde
      .replace(/[\u0300-\u036f]/g, '')     // elimina los diacríticos
      .trim();
  }

  /**
   * Busca el índice de una columna en un array de headers normalizados.
   * candidates: array de strings que se normalizan antes de comparar.
   */
  function _findCol(headers, candidates) {
    const normHeaders = headers.map(_norm);
    for (const c of candidates) {
      const nc = _norm(c);
      const i  = normHeaders.indexOf(nc);
      if (i !== -1) return i;
    }
    // Segundo intento: includes parcial (por si hay espacios raros o BOM)
    for (const c of candidates) {
      const nc = _norm(c);
      const i  = normHeaders.findIndex(h => h.includes(nc) || nc.includes(h));
      if (i !== -1) return i;
    }
    return -1;
  }

  /**
   * Parsea el archivo Excel/TSV subido por el usuario.
   * Acepta:
   *  - .xlsx / .xls  (usa SheetJS si está disponible)
   *  - .csv / .tsv   (parseo manual)
   *
   * Devuelve array de { batch, grandes, medianas, pequenas } agrupado por batch.
   */
  async function parsearArchivoExcel(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    let rawRows = [];

    if (ext === 'xlsx' || ext === 'xls') {
      rawRows = await _parsearXLSX(file);
    } else {
      const text = await file.text();
      rawRows = _parsearCSV(text);
    }

    return _agruparPorBatch(rawRows);
  }

  async function _parsearXLSX(file) {
    if (typeof XLSX === 'undefined') {
      throw new Error('Librería XLSX no disponible. Usa formato CSV/TSV.');
    }
    const buffer = await file.arrayBuffer();
    const wb     = XLSX.read(buffer, { type: 'array' });
    const ws     = wb.Sheets[wb.SheetNames[0]];
    const data   = XLSX.utils.sheet_to_json(ws, { defval: 0, raw: true });

    if (!data.length) throw new Error('El archivo no tiene filas de datos');

    // Detectar nombres de columna reales (primera fila)
    const allKeys = Object.keys(data[0]);

    const iBatch = _findColInKeys(allKeys, ['batch', 'zona', 'lote']);
    const iG     = _findColInKeys(allKeys, ['cubeta grande', 'cubeta grandes', 'grande', 'grandes']);
    const iP     = _findColInKeys(allKeys, ['cubeta pequeña', 'cubeta pequena', 'cubeta pequenas', 'pequeña', 'pequena', 'pequeñas', 'pequenas', 'pequeño', 'pequeños']);

    if (iBatch === -1) throw new Error('No se encontró columna "batch" en el archivo');

    const bKey = allKeys[iBatch];
    const gKey = iG !== -1 ? allKeys[iG] : null;
    const pKey = iP !== -1 ? allKeys[iP] : null;

    return data.map(row => ({
      batch:    String(row[bKey] || '').trim(),
      grandes:  gKey ? (parseFloat(row[gKey]) || 0) : 0,
      pequenas: pKey ? (parseFloat(row[pKey]) || 0) : 0,
    })).filter(r => r.batch);
  }

  /**
   * Busca índice en array de keys de objeto (con normalización).
   */
  function _findColInKeys(keys, candidates) {
    const normKeys = keys.map(_norm);
    for (const c of candidates) {
      const nc = _norm(c);
      // Exacto
      let i = normKeys.indexOf(nc);
      if (i !== -1) return i;
      // Parcial: la key contiene el candidato o viceversa
      i = normKeys.findIndex(k => k.includes(nc) || nc.includes(k));
      if (i !== -1) return i;
    }
    return -1;
  }

  function _parsearCSV(text) {
    // Limpiar BOM si existe
    const clean = text.replace(/^\uFEFF/, '');
    const lines  = clean.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('Archivo vacío o sin datos');

    // Detectar separador
    const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.replace(/^"|"$/g, '').trim());

    const iB = _findCol(headers, ['batch', 'zona', 'lote']);
    const iG = _findCol(headers, ['cubeta grande', 'cubeta grandes', 'grande', 'grandes']);
    const iP = _findCol(headers, ['cubeta pequeña', 'cubeta pequena', 'cubeta pequenas', 'pequeña', 'pequena', 'pequeñas', 'pequenas']);

    if (iB === -1) throw new Error('No se encontró columna "batch" en el archivo');

    return lines.slice(1).map(line => {
      const cols = line.split(sep).map(c => c.replace(/^"|"$/g, '').trim());
      return {
        batch:    cols[iB] || '',
        grandes:  iG !== -1 ? parseFloat(cols[iG]) || 0 : 0,
        pequenas: iP !== -1 ? parseFloat(cols[iP]) || 0 : 0,
      };
    }).filter(r => r.batch && r.batch !== '');
  }

  function _agruparPorBatch(rows) {
    const map = {};
    rows.forEach(r => {
      const key = String(r.batch).trim();
      if (!key) return;
      if (!map[key]) map[key] = { batch: key, grandes: 0, pequenas: 0 };
      map[key].grandes  += r.grandes  || 0;
      map[key].pequenas += r.pequenas || 0;
    });
    return Object.values(map).sort((a, b) => a.batch.localeCompare(b.batch));
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function _fechaHoy() {
    return new Date().toISOString().split('T')[0];
  }

  return {
    getZonas, upsertZona, updateZonaNombre, invalidateCache,
    getStockHoy, getStockFecha, getStockZonaHoy,
    cargarStockDiario, descontarStock,
    getViajesPorZona,
    parsearArchivoExcel,
  };
})();
