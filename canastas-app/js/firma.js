/**
 * firma.js - Módulo de firma digital con canvas táctil v2.0
 * Soporta firma simple y firma doble (conductor + auxiliar)
 */

const FIRMA = (() => {

  const SUPABASE_URL  = 'https://oghprxgonszqtoslreod.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9naHByeGdvbnN6cXRvc2xyZW9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MzE4NjYsImV4cCI6MjEwMDIwNzg2Nn0.tXmRLkAXjXl2w2mRhm8IYgkmBm5qfoUtijLT6Mjf2j4';
  const BUCKET = 'firmas';

  let _canvas  = null;
  let _ctx     = null;
  let _drawing = false;
  let _resolve = null;
  let _hasMark = false;

  // ─── Subir imagen ──────────────────────────────────────────────────────────
  async function _subirFirma(blob, fileName) {
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${fileName}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON,
          'Content-Type': 'image/png', 'x-upsert': 'true',
        },
        body: blob,
      });
      if (res.ok) return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${fileName}`;
    } catch (e) { console.warn('Storage upload failed:', e); }
    return _canvas.toDataURL('image/png');
  }

  // ─── API pública: firma simple (compatibilidad hacia atrás) ────────────────
  function solicitarFirma(nombre, tipo, referencia) {
    return new Promise((resolve) => {
      _resolve = resolve;
      _mostrarPad({
        titulo:      tipo === 'salida' ? 'Salida de Canastas' : 'Entrada de Canastas',
        subtitulo:   referencia,
        nombre,
        color:       tipo === 'salida' ? '#1E3A5F' : '#16A34A',
        emoji:       tipo === 'salida' ? '📤' : '📥',
        instruccion: 'Firma del auxiliar',
      });
    });
  }

  // ─── API pública: firma de viaje (despacho o retorno) ─────────────────────
  /**
   * Solicita firma para un viaje.
   * @param {object} opts
   *   tipo: 'despacho' | 'retorno'
   *   numeroViaje: string
   *   conductorNombre: string
   *   auxiliarNombre: string
   * @returns {Promise<string>} URL de la firma
   */
  function solicitarFirmaViaje({ tipo, numeroViaje, conductorNombre, auxiliarNombre }) {
    return new Promise((resolve) => {
      _resolve = resolve;
      const esDespacho = tipo === 'despacho';
      _mostrarPad({
        titulo:      esDespacho ? '📤 Despacho de Material' : '📥 Retorno de Material',
        subtitulo:   numeroViaje,
        nombre:      conductorNombre,
        sublabel:    `Auxiliar: ${auxiliarNombre}`,
        color:       esDespacho ? '#1E3A5F' : '#16A34A',
        emoji:       esDespacho ? '🚛' : '📦',
        instruccion: esDespacho
          ? 'Firma del conductor confirmando el despacho'
          : 'Firma confirmando el retorno del material',
      });
    });
  }

  // ─── Pad de firma ──────────────────────────────────────────────────────────
  function _mostrarPad({ titulo, subtitulo, nombre, sublabel, color, emoji, instruccion }) {
    document.getElementById('firma-modal-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'firma-modal-overlay';
    overlay.className = 'firma-overlay';
    overlay.innerHTML = `
      <div class="firma-modal">
        <div class="firma-header" style="border-top:4px solid ${color}">
          <div class="firma-header-top">
            <span class="firma-emoji">${emoji}</span>
            <div>
              <div class="firma-titulo">${_esc(titulo)}</div>
              <div class="firma-subtitulo">${_esc(subtitulo)}</div>
            </div>
            <button id="firma-btn-omitir" class="firma-btn-omitir" title="Omitir firma">✕</button>
          </div>
          <div class="firma-nombre-bloque">
            <div class="firma-aux-nombre">${_esc(nombre)}</div>
            ${sublabel ? `<div class="firma-sublabel">${_esc(sublabel)}</div>` : ''}
          </div>
          <div class="firma-instruccion">${_esc(instruccion)}</div>
        </div>
        <div class="firma-canvas-wrap">
          <canvas id="firma-canvas" class="firma-canvas"></canvas>
          <div id="firma-placeholder" class="firma-placeholder">✍️ Firma aquí con el dedo</div>
        </div>
        <div class="firma-actions">
          <button id="firma-btn-limpiar" class="btn btn-secondary btn-sm">🗑 Limpiar</button>
          <button id="firma-btn-confirmar" class="btn btn-primary btn-sm" style="flex:1" disabled>
            ✓ Confirmar firma
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    _canvas  = document.getElementById('firma-canvas');
    _ctx     = _canvas.getContext('2d');
    _hasMark = false;
    _ajustarCanvas();
    _bindEventos();

    document.getElementById('firma-btn-limpiar').addEventListener('click', _limpiar);
    document.getElementById('firma-btn-confirmar').addEventListener('click', _confirmar);
    document.getElementById('firma-btn-omitir').addEventListener('click', () => {
      _cerrar();
      _resolve(null); // omitida
    });
  }

  function _ajustarCanvas() {
    const wrap = _canvas.parentElement;
    const dpr  = window.devicePixelRatio || 1;
    const w    = wrap.clientWidth  || 340;
    const h    = wrap.clientHeight || 200;
    _canvas.width  = w * dpr; _canvas.height = h * dpr;
    _canvas.style.width  = w + 'px'; _canvas.style.height = h + 'px';
    _ctx.scale(dpr, dpr);
    _ctx.strokeStyle = '#111827';
    _ctx.lineWidth   = 2.5;
    _ctx.lineCap     = 'round';
    _ctx.lineJoin    = 'round';
  }

  function _bindEventos() {
    _canvas.addEventListener('touchstart',  _onStart, { passive: false });
    _canvas.addEventListener('touchmove',   _onMove,  { passive: false });
    _canvas.addEventListener('touchend',    () => { _drawing = false; });
    _canvas.addEventListener('mousedown',   _onStart);
    _canvas.addEventListener('mousemove',   _onMove);
    _canvas.addEventListener('mouseup',     () => { _drawing = false; });
    _canvas.addEventListener('mouseleave',  () => { _drawing = false; });
  }

  function _pos(e) {
    const r = _canvas.getBoundingClientRect();
    if (e.touches) return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function _onStart(e) {
    e.preventDefault?.();
    _drawing = true;
    const p = _pos(e);
    _ctx.beginPath(); _ctx.moveTo(p.x, p.y);
  }

  function _onMove(e) {
    e.preventDefault?.();
    if (!_drawing) return;
    const p = _pos(e);
    _ctx.lineTo(p.x, p.y); _ctx.stroke();
    if (!_hasMark) {
      _hasMark = true;
      document.getElementById('firma-placeholder').style.display = 'none';
      const btn = document.getElementById('firma-btn-confirmar');
      if (btn) btn.disabled = false;
    }
  }

  function _limpiar() {
    const dpr = window.devicePixelRatio || 1;
    _ctx.clearRect(0, 0, _canvas.width / dpr, _canvas.height / dpr);
    _hasMark = false;
    document.getElementById('firma-placeholder').style.display = 'flex';
    const btn = document.getElementById('firma-btn-confirmar');
    if (btn) btn.disabled = true;
  }

  async function _confirmar() {
    if (!_hasMark) return;
    const btnC = document.getElementById('firma-btn-confirmar');
    const btnL = document.getElementById('firma-btn-limpiar');
    btnC.disabled = true; btnC.textContent = 'Guardando...';
    if (btnL) btnL.disabled = true;
    try {
      const blob     = await new Promise((res, rej) =>
        _canvas.toBlob(b => b ? res(b) : rej(new Error('Canvas vacío')), 'image/png')
      );
      const fileName = `firma-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
      const url      = await _subirFirma(blob, fileName);
      _cerrar();
      _resolve(url);
    } catch (err) {
      btnC.disabled = false; btnC.textContent = '✓ Confirmar firma';
      if (btnL) btnL.disabled = false;
      alert('Error al guardar la firma: ' + err.message);
    }
  }

  function _cerrar() {
    document.getElementById('firma-modal-overlay')?.remove();
    _canvas = null; _ctx = null; _drawing = false; _hasMark = false;
  }

  function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { solicitarFirma, solicitarFirmaViaje };
})();
