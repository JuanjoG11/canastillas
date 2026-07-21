/**
 * firma.js - Módulo de firma digital con canvas táctil
 * Sube la firma a Supabase Storage y retorna la URL pública
 */

const FIRMA = (() => {

  const SUPABASE_URL  = 'https://oghprxgonszqtoslreod.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9naHByeGdvbnN6cXRvc2xyZW9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MzE4NjYsImV4cCI6MjEwMDIwNzg2Nn0.tXmRLkAXjXl2w2mRhm8IYgkmBm5qfoUtijLT6Mjf2j4';
  const BUCKET        = 'firmas';

  let _canvas   = null;
  let _ctx      = null;
  let _drawing  = false;
  let _resolve  = null;
  let _reject   = null;
  let _hasMark  = false;

  // ─── Subir PNG a Supabase Storage o Data URL Fallback ──────────────────────
  async function subirFirma(blob, nombreArchivo) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${nombreArchivo}`,
        {
          method: 'POST',
          headers: {
            'apikey':        SUPABASE_ANON,
            'Authorization': 'Bearer ' + SUPABASE_ANON,
            'Content-Type':  'image/png',
            'x-upsert':      'true',
          },
          body: blob,
        }
      );
      if (res.ok) {
        return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${nombreArchivo}`;
      }
    } catch (e) {
      console.warn('Storage upload attempt error:', e);
    }
    // Fallback si el bucket no existe aún o falla RLS en Storage
    return _canvas.toDataURL('image/png');
  }

  // ─── Mostrar pad de firma ──────────────────────────────────────────────────
  /**
   * Muestra el modal de firma y retorna una Promise que resuelve con la URL
   * de la firma subida.
   *
   * @param {string} nombreAuxiliar  - Para mostrar en el encabezado
   * @param {string} tipoMovimiento  - 'salida' | 'entrada'
   * @param {string} refMovimiento   - Número de referencia del movimiento
   */
  function solicitarFirma(nombreAuxiliar, tipoMovimiento, refMovimiento) {
    return new Promise((resolve, reject) => {
      _resolve = resolve;
      _reject  = reject;
      _abrirModal(nombreAuxiliar, tipoMovimiento, refMovimiento);
    });
  }

  function _abrirModal(nombreAuxiliar, tipoMovimiento, refMovimiento) {
    // Eliminar modal anterior si existe
    document.getElementById('firma-modal-overlay')?.remove();

    const accion = tipoMovimiento === 'salida' ? 'Salida' : 'Entrada';
    const color  = tipoMovimiento === 'salida' ? '#2563EB' : '#16A34A';

    const overlay = document.createElement('div');
    overlay.id    = 'firma-modal-overlay';
    overlay.className = 'firma-overlay';
    overlay.innerHTML = `
      <div class="firma-modal">
        <div class="firma-header" style="border-top: 4px solid ${color}">
          <div class="firma-header-top">
            <span class="firma-emoji">🖊️</span>
            <div>
              <div class="firma-titulo">${accion} de Canastas</div>
              <div class="firma-subtitulo">${refMovimiento}</div>
            </div>
          </div>
          <div class="firma-aux-nombre">${_escHtml(nombreAuxiliar)}</div>
          <div class="firma-instruccion">Firma obligatoria con el dedo en el recuadro</div>
        </div>

        <div class="firma-canvas-wrap">
          <canvas id="firma-canvas" class="firma-canvas"></canvas>
          <div id="firma-placeholder" class="firma-placeholder">
            ✍️ Firma aquí
          </div>
        </div>

        <div class="firma-actions">
          <button id="firma-btn-limpiar" class="btn btn-secondary btn-sm">
            🗑 Limpiar
          </button>
          <button id="firma-btn-confirmar" class="btn btn-primary btn-sm" style="flex:1" disabled>
            ✓ Confirmar firma
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    _canvas  = document.getElementById('firma-canvas');
    _ctx     = _canvas.getContext('2d');
    _hasMark = false;

    _ajustarCanvas();
    _bindEventos();

    document.getElementById('firma-btn-limpiar').addEventListener('click', _limpiar);
    document.getElementById('firma-btn-confirmar').addEventListener('click', _confirmar);
  }

  function _ajustarCanvas() {
    const wrap = _canvas.parentElement;
    const dpr  = window.devicePixelRatio || 1;
    const w    = wrap.clientWidth  || 320;
    const h    = wrap.clientHeight || 200;

    _canvas.width  = w * dpr;
    _canvas.height = h * dpr;
    _canvas.style.width  = w + 'px';
    _canvas.style.height = h + 'px';

    _ctx.scale(dpr, dpr);
    _ctx.strokeStyle = '#111827';
    _ctx.lineWidth   = 2.5;
    _ctx.lineCap     = 'round';
    _ctx.lineJoin    = 'round';
  }

  function _bindEventos() {
    // Touch
    _canvas.addEventListener('touchstart',  _onTouchStart, { passive: false });
    _canvas.addEventListener('touchmove',   _onTouchMove,  { passive: false });
    _canvas.addEventListener('touchend',    _onTouchEnd);
    // Mouse (desktop/pruebas)
    _canvas.addEventListener('mousedown',   _onMouseDown);
    _canvas.addEventListener('mousemove',   _onMouseMove);
    _canvas.addEventListener('mouseup',     _onMouseUp);
    _canvas.addEventListener('mouseleave',  _onMouseUp);
  }

  function _getPos(e) {
    const rect = _canvas.getBoundingClientRect();
    if (e.touches) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function _onTouchStart(e)  { e.preventDefault(); _drawing = true; const p = _getPos(e); _ctx.beginPath(); _ctx.moveTo(p.x, p.y); }
  function _onTouchMove(e)   { e.preventDefault(); if (!_drawing) return; const p = _getPos(e); _ctx.lineTo(p.x, p.y); _ctx.stroke(); _marcar(); }
  function _onTouchEnd()     { _drawing = false; }
  function _onMouseDown(e)   { _drawing = true; const p = _getPos(e); _ctx.beginPath(); _ctx.moveTo(p.x, p.y); }
  function _onMouseMove(e)   { if (!_drawing) return; const p = _getPos(e); _ctx.lineTo(p.x, p.y); _ctx.stroke(); _marcar(); }
  function _onMouseUp()      { _drawing = false; }

  function _marcar() {
    if (!_hasMark) {
      _hasMark = true;
      document.getElementById('firma-placeholder').style.display = 'none';
      const btn = document.getElementById('firma-btn-confirmar');
      if (btn) { btn.disabled = false; }
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

    const btnConfirmar = document.getElementById('firma-btn-confirmar');
    const btnLimpiar   = document.getElementById('firma-btn-limpiar');
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Guardando...';
    if (btnLimpiar) btnLimpiar.disabled = true;

    try {
      const blob     = await _canvasToBlob();
      const fileName = `firma-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
      const url      = await subirFirma(blob, fileName);
      _cerrarModal();
      _resolve(url);
    } catch (err) {
      btnConfirmar.disabled = false;
      btnConfirmar.textContent = '✓ Confirmar firma';
      if (btnLimpiar) btnLimpiar.disabled = false;
      alert('Error al guardar la firma: ' + err.message);
    }
  }

  function _canvasToBlob() {
    return new Promise((res, rej) => {
      _canvas.toBlob(blob => {
        if (blob) res(blob);
        else rej(new Error('No se pudo convertir el canvas'));
      }, 'image/png');
    });
  }

  function _cerrarModal() {
    document.getElementById('firma-modal-overlay')?.remove();
    _canvas = null; _ctx = null; _drawing = false; _hasMark = false;
  }

  function _escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { solicitarFirma };
})();
