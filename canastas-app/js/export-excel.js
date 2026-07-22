/**
 * export-excel.js — Exportación .xlsx con formato completo
 * Usa SheetJS (xlsx) cargado desde CDN
 * Control de Canastas PWA 2.0
 */

const EXCEL = (() => {

  // ── Paleta de colores ─────────────────────────────────────────────────────
  const C = {
    azul_oscuro:  '1E3A5F',
    azul_medio:   '2563EB',
    azul_claro:   'DBEAFE',
    verde_oscuro: '15803D',
    verde_claro:  'DCFCE7',
    naranja:      'D97706',
    naranja_claro:'FEF3C7',
    rojo:         'DC2626',
    rojo_claro:   'FEE2E2',
    gris_header:  'F1F5F9',
    gris_fila:    'F8FAFC',
    blanco:       'FFFFFF',
    negro:        '111827',
    amarillo_dif: 'FFFBEB',
  };

  // ── Helpers de estilo ─────────────────────────────────────────────────────
  function fill(fgColor) {
    return { patternType: 'solid', fgColor: { rgb: fgColor } };
  }

  function font(bold, color, sz) {
    return { bold: !!bold, color: { rgb: color || C.negro }, sz: sz || 10 };
  }

  function border() {
    const s = { style: 'thin', color: { rgb: 'D1D5DB' } };
    return { top: s, bottom: s, left: s, right: s };
  }

  function align(h, v) {
    return { horizontal: h || 'left', vertical: v || 'center', wrapText: true };
  }

  function cell(v, fgColor, bold, fontColor, sz, halign) {
    return {
      v,
      t: typeof v === 'number' ? 'n' : 's',
      s: {
        fill:      fill(fgColor || C.blanco),
        font:      font(bold, fontColor || C.negro, sz),
        border:    border(),
        alignment: align(halign || (typeof v === 'number' ? 'center' : 'left')),
      },
    };
  }

  function numCell(v, fgColor, bold, fontColor) {
    const n = (v === null || v === undefined || v === '') ? null : Number(v);
    return {
      v: n,
      t: n === null ? 's' : 'n',
      s: {
        fill:      fill(fgColor || C.blanco),
        font:      font(bold, fontColor || C.negro, 10),
        border:    border(),
        alignment: align('center', 'center'),
      },
    };
  }

  // ── Función principal ─────────────────────────────────────────────────────
  async function exportarViajes(filtros = {}) {
    if (typeof XLSX === 'undefined') {
      throw new Error('Librería XLSX no cargada. Verifica la conexión a internet.');
    }

    const [viajes, conductores, auxiliares, inventario] = await Promise.all([
      DB_VIAJES.getViajes(5000),
      DB_VIAJES.getConductores(),
      DB.getAuxiliares(),
      DB_VIAJES.getInventarioInicial(),
    ]);

    // Aplicar filtros
    let rows = viajes;
    if (filtros.fechaDesde) rows = rows.filter(v => v.fecha >= filtros.fechaDesde);
    if (filtros.fechaHasta) rows = rows.filter(v => v.fecha <= filtros.fechaHasta);
    if (filtros.estado && filtros.estado !== 'todos') rows = rows.filter(v => v.estado === filtros.estado);

    const condMap = {};
    conductores.forEach(c => { condMap[c.id] = c.nombre; });
    const auxMap = {};
    auxiliares.forEach(a => { auxMap[a.id] = a.nombre; });

    const wb = XLSX.utils.book_new();
    _crearHojaViajes(wb, rows, condMap, auxMap, inventario);
    _crearHojaResumen(wb, rows, condMap, inventario);
    _crearHojaPorConductor(wb, rows, condMap);

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Canastas_${fecha}.xlsx`);
  }

  // ── Hoja 1: Detalle de viajes ─────────────────────────────────────────────
  function _crearHojaViajes(wb, rows, condMap, auxMap, inventario) {
    const ws = {};
    let r = 0;

    // Fila 1: Título principal
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = {
      v: '🧺 CONTROL DE CANASTAS — DETALLE DE DESPACHOS',
      t: 's',
      s: { fill: fill(C.azul_oscuro), font: font(true, C.blanco, 14),
           alignment: align('center'), border: border() }
    };
    // Merge A1:U1
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: 20 } });
    r++;

    // Fila 2: Inventario teórico inicial
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = cell(
      `Inventario teórico inicial — G: ${inventario.grandes}  M: ${inventario.medianas}  P: ${inventario.pequenas}  E: ${inventario.estibas}`,
      C.gris_header, false, C.azul_oscuro, 9, 'center'
    );
    ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: 20 } });
    r++;

    // Fila 3: Fecha de exportación
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = cell(
      `Exportado: ${new Date().toLocaleDateString('es-CO')}`,
      C.gris_header, false, C.gris_header.replace('F','7'), 8, 'right'
    );
    ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: 20 } });
    r++;

    // Fila vacía
    r++;

    // Encabezado fila 5: grupos
    const grupos = [
      { label: '', cols: 7, bg: C.azul_oscuro },
      { label: 'DESPACHADO POR ALPINA', cols: 4, bg: C.azul_medio },
      { label: 'RETORNO DEL DISTRIBUIDOR', cols: 4, bg: C.verde_oscuro },
      { label: 'DIFERENCIA', cols: 4, bg: C.naranja },
      { label: '', cols: 2, bg: C.azul_oscuro },
    ];
    let col = 0;
    grupos.forEach(g => {
      ws[XLSX.utils.encode_cell({ r, c: col })] = {
        v: g.label, t: 's',
        s: { fill: fill(g.bg), font: font(true, C.blanco, 9),
             alignment: align('center'), border: border() }
      };
      if (g.cols > 1) {
        ws['!merges'].push({ s: { r, c: col }, e: { r, c: col + g.cols - 1 } });
        for (let i = 1; i < g.cols; i++) {
          ws[XLSX.utils.encode_cell({ r, c: col + i })] = {
            v: '', t: 's',
            s: { fill: fill(g.bg), font: font(true, C.blanco, 9), border: border(), alignment: align('center') }
          };
        }
      }
      col += g.cols;
    });
    r++;

    // Encabezado fila 6: columnas individuales
    const headers = [
      ['FECHA', C.azul_oscuro], ['#', C.azul_oscuro], ['CONDUCTOR', C.azul_oscuro],
      ['AUXILIAR', C.azul_oscuro], ['PLACA', C.azul_oscuro], ['REMOLQUE', C.azul_oscuro],
      ['FACTURA', C.azul_oscuro],
      ['G', C.azul_medio], ['M', C.azul_medio], ['P', C.azul_medio], ['E', C.azul_medio],
      ['G', C.verde_oscuro], ['M', C.verde_oscuro], ['P', C.verde_oscuro], ['E', C.verde_oscuro],
      ['G', C.naranja], ['M', C.naranja], ['P', C.naranja], ['E', C.naranja],
      ['ESTADO', C.azul_oscuro], ['OBSERVACIÓN', C.azul_oscuro],
    ];
    headers.forEach(([lbl, bg], c) => {
      ws[XLSX.utils.encode_cell({ r, c })] = {
        v: lbl, t: 's',
        s: { fill: fill(bg), font: font(true, C.blanco, 9),
             alignment: align('center'), border: border() }
      };
    });
    r++;

    // Filas de datos
    let totD = [0,0,0,0], totR = [0,0,0,0], totDif = [0,0,0,0];
    rows.forEach((v, idx) => {
      const bg = idx % 2 === 0 ? C.blanco : C.gris_fila;
      const difG = v.ret_grandes  !== null ? v.desp_grandes  - v.ret_grandes  : null;
      const difM = v.ret_medianas !== null ? v.desp_medianas - v.ret_medianas : null;
      const difP = v.ret_pequenas !== null ? v.desp_pequenas - v.ret_pequenas : null;
      const difE = v.ret_estibas  !== null ? v.desp_estibas  - v.ret_estibas  : null;

      const difColor = (d) => d === null ? C.blanco : d < 0 ? C.rojo_claro : d > 0 ? C.naranja_claro : C.verde_claro;
      const difFont  = (d) => d === null ? C.negro  : d < 0 ? C.rojo      : d > 0 ? C.naranja      : C.verde_oscuro;

      totD[0] += v.desp_grandes || 0;  totD[1] += v.desp_medianas || 0;
      totD[2] += v.desp_pequenas || 0; totD[3] += v.desp_estibas  || 0;
      if (v.ret_grandes  !== null) totR[0] += v.ret_grandes;
      if (v.ret_medianas !== null) totR[1] += v.ret_medianas;
      if (v.ret_pequenas !== null) totR[2] += v.ret_pequenas;
      if (v.ret_estibas  !== null) totR[3] += v.ret_estibas;
      if (difG !== null) totDif[0] += difG;
      if (difM !== null) totDif[1] += difM;
      if (difP !== null) totDif[2] += difP;
      if (difE !== null) totDif[3] += difE;

      const estadoBg = v.estado === 'cerrado' ? C.verde_claro : v.estado === 'anulado' ? C.rojo_claro : C.naranja_claro;
      const estadoColor = v.estado === 'cerrado' ? C.verde_oscuro : v.estado === 'anulado' ? C.rojo : C.naranja;

      const rowData = [
        cell(v.fecha, bg, false, C.negro, 9),
        cell(v.numero_viaje, bg, true, C.azul_oscuro, 8),
        cell(condMap[v.conductor_id] || '', bg, false, C.negro, 9),
        cell(auxMap[v.auxiliar_id] || '', bg, false, C.negro, 9),
        cell(v.placa, bg, true, C.negro, 9),
        cell(v.remolque || '', bg, false, C.negro, 9),
        cell(v.numero_factura || '', bg, false, C.negro, 9),
        numCell(v.desp_grandes, C.azul_claro, true),
        numCell(v.desp_medianas, C.azul_claro, true),
        numCell(v.desp_pequenas, C.azul_claro, true),
        numCell(v.desp_estibas, C.azul_claro, true),
        numCell(v.ret_grandes, C.verde_claro, true),
        numCell(v.ret_medianas, C.verde_claro, true),
        numCell(v.ret_pequenas, C.verde_claro, true),
        numCell(v.ret_estibas, C.verde_claro, true),
        { ...numCell(difG, difColor(difG)), s: { ...numCell(difG, difColor(difG)).s, font: font(true, difFont(difG), 10) } },
        { ...numCell(difM, difColor(difM)), s: { ...numCell(difM, difColor(difM)).s, font: font(true, difFont(difM), 10) } },
        { ...numCell(difP, difColor(difP)), s: { ...numCell(difP, difColor(difP)).s, font: font(true, difFont(difP), 10) } },
        { ...numCell(difE, difColor(difE)), s: { ...numCell(difE, difColor(difE)).s, font: font(true, difFont(difE), 10) } },
        cell(v.estado.toUpperCase(), estadoBg, true, estadoColor, 9, 'center'),
        cell(v.observaciones || '', bg, false, C.negro, 8),
      ];
      rowData.forEach((c, ci) => { ws[XLSX.utils.encode_cell({ r, c: ci })] = c; });
      r++;
    });

    // Fila de totales
    const totalRow = [
      cell('TOTALES', C.azul_oscuro, true, C.blanco, 10, 'right'),
      ...Array(6).fill(cell('', C.azul_oscuro, false, C.blanco)),
      numCell(totD[0], C.azul_medio, true, C.blanco),
      numCell(totD[1], C.azul_medio, true, C.blanco),
      numCell(totD[2], C.azul_medio, true, C.blanco),
      numCell(totD[3], C.azul_medio, true, C.blanco),
      numCell(totR[0], C.verde_oscuro, true, C.blanco),
      numCell(totR[1], C.verde_oscuro, true, C.blanco),
      numCell(totR[2], C.verde_oscuro, true, C.blanco),
      numCell(totR[3], C.verde_oscuro, true, C.blanco),
      numCell(totDif[0], totDif[0] < 0 ? C.rojo : C.naranja, true, C.blanco),
      numCell(totDif[1], totDif[1] < 0 ? C.rojo : C.naranja, true, C.blanco),
      numCell(totDif[2], totDif[2] < 0 ? C.rojo : C.naranja, true, C.blanco),
      numCell(totDif[3], totDif[3] < 0 ? C.rojo : C.naranja, true, C.blanco),
      cell('', C.azul_oscuro), cell('', C.azul_oscuro),
    ];
    totalRow.forEach((c, ci) => { ws[XLSX.utils.encode_cell({ r, c: ci })] = c; });

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 20 } });
    ws['!cols'] = [
      { wch: 11 }, { wch: 12 }, { wch: 26 }, { wch: 26 }, { wch: 9 }, { wch: 9 }, { wch: 9 },
      { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 },
      { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 },
      { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 },
      { wch: 11 }, { wch: 22 },
    ];
    ws['!rows'] = Array(r + 1).fill({ hpt: 18 });
    ws['!rows'][0] = { hpt: 30 };

    XLSX.utils.book_append_sheet(wb, ws, '📋 Despachos');
  }

  // ── Hoja 2: Resumen ejecutivo ─────────────────────────────────────────────
  function _crearHojaResumen(wb, rows, condMap, inventario) {
    const ws = {};
    let r = 0;

    const addTitle = (txt, bg, fontColor, sz, colspan) => {
      ws[XLSX.utils.encode_cell({ r, c: 0 })] = {
        v: txt, t: 's',
        s: { fill: fill(bg), font: font(true, fontColor, sz || 12),
             alignment: align('center'), border: border() }
      };
      if (colspan > 1) {
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: colspan - 1 } });
        for (let i = 1; i < colspan; i++) {
          ws[XLSX.utils.encode_cell({ r, c: i })] = {
            v: '', t: 's', s: { fill: fill(bg), border: border() }
          };
        }
      }
      r++;
    };

    addTitle('📊 RESUMEN EJECUTIVO — CONTROL DE CANASTAS', C.azul_oscuro, C.blanco, 14, 6);
    addTitle(`Generado: ${new Date().toLocaleDateString('es-CO')} · Total viajes: ${rows.length}`, C.gris_header, C.azul_oscuro, 9, 6);
    r++;

    // Totales generales
    const cerrados = rows.filter(v => v.estado === 'cerrado');
    const abiertos = rows.filter(v => v.estado === 'abierto');
    const anulados = rows.filter(v => v.estado === 'anulado');

    let totD = [0,0,0,0], totR = [0,0,0,0];
    rows.forEach(v => {
      totD[0] += v.desp_grandes  || 0; totD[1] += v.desp_medianas || 0;
      totD[2] += v.desp_pequenas || 0; totD[3] += v.desp_estibas  || 0;
      if (v.ret_grandes  !== null) totR[0] += v.ret_grandes;
      if (v.ret_medianas !== null) totR[1] += v.ret_medianas;
      if (v.ret_pequenas !== null) totR[2] += v.ret_pequenas;
      if (v.ret_estibas  !== null) totR[3] += v.ret_estibas;
    });
    const totDif = totD.map((d, i) => d - totR[i]);

    // Bloque KPIs
    addTitle('📦 TOTALES POR TIPO DE ENVASE', C.azul_oscuro, C.blanco, 11, 6);

    const kpiHeaders = ['', 'GRANDES', 'MEDIANAS', 'PEQUEÑAS', 'ESTIBAS', 'TOTAL'];
    kpiHeaders.forEach((h, c) => {
      ws[XLSX.utils.encode_cell({ r, c })] = cell(h, C.azul_oscuro, true, C.blanco, 9, 'center');
    });
    r++;

    const kpiRows = [
      ['📤 Despachado', ...totD, totD.reduce((a,b)=>a+b,0), C.azul_claro, C.azul_medio],
      ['📥 Retornado',  ...totR, totR.reduce((a,b)=>a+b,0), C.verde_claro, C.verde_oscuro],
      ['⚖️ Diferencia', ...totDif, totDif.reduce((a,b)=>a+b,0), C.amarillo_dif, C.naranja],
    ];

    kpiRows.forEach(([lbl, g, m, p, e, tot, bg, fc]) => {
      ws[XLSX.utils.encode_cell({ r, c: 0 })] = cell(lbl, bg, true, fc, 10);
      [g, m, p, e, tot].forEach((v, ci) => {
        ws[XLSX.utils.encode_cell({ r, c: ci + 1 })] = {
          v, t: 'n',
          s: { fill: fill(bg), font: font(true, v < 0 ? C.rojo : fc, 11),
               border: border(), alignment: align('center') }
        };
      });
      r++;
    });
    r++;

    // Bloque estado de viajes
    addTitle('🚛 ESTADO DE VIAJES', C.azul_oscuro, C.blanco, 11, 6);
    [
      ['✅ Cerrados (retorno recibido)', cerrados.length, C.verde_claro, C.verde_oscuro],
      ['⏳ Pendientes (sin retorno)',    abiertos.length, C.naranja_claro, C.naranja],
      ['❌ Anulados',                    anulados.length, C.rojo_claro, C.rojo],
      ['📋 Total viajes',               rows.length,     C.gris_header, C.azul_oscuro],
    ].forEach(([lbl, val, bg, fc]) => {
      ws[XLSX.utils.encode_cell({ r, c: 0 })] = cell(lbl, bg, false, fc, 10);
      ws[XLSX.utils.encode_cell({ r, c: 1 })] = { v: val, t: 'n',
        s: { fill: fill(bg), font: font(true, fc, 12), border: border(), alignment: align('center') }};
      for (let c = 2; c < 6; c++) {
        ws[XLSX.utils.encode_cell({ r, c })] = cell('', bg, false);
      }
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: 0 } });
      r++;
    });
    r++;

    // Inventario inicial vs diferencia
    addTitle('📐 INVENTARIO TEÓRICO INICIAL vs DIFERENCIA', C.azul_oscuro, C.blanco, 11, 6);
    const invHeaders = ['', 'GRANDES', 'MEDIANAS', 'PEQUEÑAS', 'ESTIBAS'];
    invHeaders.forEach((h, c) => {
      ws[XLSX.utils.encode_cell({ r, c })] = cell(h, C.azul_oscuro, true, C.blanco, 9, 'center');
    });
    r++;

    const invRows = [
      ['📦 Inventario inicial', inventario.grandes, inventario.medianas, inventario.pequenas, inventario.estibas, C.gris_header, C.azul_oscuro],
      ['📤 Total despachado',   totD[0], totD[1], totD[2], totD[3], C.azul_claro, C.azul_medio],
      ['⚖️ Diferencia total',   totDif[0], totDif[1], totDif[2], totDif[3], C.amarillo_dif, C.naranja],
    ];
    invRows.forEach(([lbl, g, m, p, e, bg, fc]) => {
      ws[XLSX.utils.encode_cell({ r, c: 0 })] = cell(lbl, bg, true, fc, 10);
      [g, m, p, e].forEach((v, ci) => {
        ws[XLSX.utils.encode_cell({ r, c: ci + 1 })] = {
          v: Number(v), t: 'n',
          s: { fill: fill(bg), font: font(true, v < 0 ? C.rojo : fc, 11),
               border: border(), alignment: align('center') }
        };
      });
      r++;
    });

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 5 } });
    ws['!cols'] = [{ wch: 34 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    ws['!rows'] = Array(r + 1).fill({ hpt: 22 });
    ws['!rows'][0] = { hpt: 32 };

    XLSX.utils.book_append_sheet(wb, ws, '📊 Resumen');
  }

  // ── Hoja 3: Por conductor ─────────────────────────────────────────────────
  function _crearHojaPorConductor(wb, rows, condMap) {
    const ws = {};
    let r = 0;

    if (!ws['!merges']) ws['!merges'] = [];

    ws[XLSX.utils.encode_cell({ r, c: 0 })] = {
      v: '🧑‍✈️ RANKING Y DETALLE POR CONDUCTOR', t: 's',
      s: { fill: fill(C.azul_oscuro), font: font(true, C.blanco, 13),
           alignment: align('center'), border: border() }
    };
    ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: 9 } });
    for (let c = 1; c < 10; c++) {
      ws[XLSX.utils.encode_cell({ r, c })] = { v: '', t: 's', s: { fill: fill(C.azul_oscuro), border: border() } };
    }
    r += 2;

    // Agrupar por conductor
    const porConductor = {};
    rows.forEach(v => {
      const id = v.conductor_id;
      if (!porConductor[id]) porConductor[id] = { nombre: condMap[id] || id, viajes: [] };
      porConductor[id].viajes.push(v);
    });

    // Headers tabla
    const hdr = ['CONDUCTOR', 'VIAJES', 'CERRADOS', 'PENDIENTES', 'G DESP', 'M DESP', 'P DESP', 'E DESP', 'DIF G', 'DIF TOTAL'];
    hdr.forEach((h, c) => {
      ws[XLSX.utils.encode_cell({ r, c })] = cell(h, C.azul_oscuro, true, C.blanco, 9, 'center');
    });
    r++;

    // Ordenar por más viajes
    const sorted = Object.values(porConductor).sort((a, b) => b.viajes.length - a.viajes.length);

    sorted.forEach((cond, idx) => {
      const bg = idx % 2 === 0 ? C.blanco : C.gris_fila;
      const cerrados  = cond.viajes.filter(v => v.estado === 'cerrado').length;
      const pendientes = cond.viajes.filter(v => v.estado === 'abierto').length;
      let despG = 0, despM = 0, despP = 0, despE = 0, retG = 0;
      let difTot = 0;
      cond.viajes.forEach(v => {
        despG += v.desp_grandes  || 0; despM += v.desp_medianas || 0;
        despP += v.desp_pequenas || 0; despE += v.desp_estibas  || 0;
        if (v.ret_grandes  !== null) retG   += v.ret_grandes;
        if (v.ret_grandes  !== null) difTot += (v.desp_grandes  - v.ret_grandes);
        if (v.ret_medianas !== null) difTot += (v.desp_medianas - v.ret_medianas);
        if (v.ret_pequenas !== null) difTot += (v.desp_pequenas - v.ret_pequenas);
        if (v.ret_estibas  !== null) difTot += (v.desp_estibas  - v.ret_estibas);
      });
      const difG = despG - retG;
      const difBg  = difTot < 0 ? C.rojo_claro : difTot > 0 ? C.naranja_claro : C.verde_claro;
      const difFc  = difTot < 0 ? C.rojo : difTot > 0 ? C.naranja : C.verde_oscuro;

      [
        cell(cond.nombre, bg, true, C.azul_oscuro, 9),
        { v: cond.viajes.length, t: 'n', s: { fill: fill(bg), font: font(true, C.negro, 10), border: border(), alignment: align('center') } },
        { v: cerrados,   t: 'n', s: { fill: fill(C.verde_claro), font: font(true, C.verde_oscuro, 10), border: border(), alignment: align('center') } },
        { v: pendientes, t: 'n', s: { fill: fill(pendientes > 0 ? C.naranja_claro : bg), font: font(true, pendientes > 0 ? C.naranja : C.negro, 10), border: border(), alignment: align('center') } },
        { v: despG, t: 'n', s: { fill: fill(C.azul_claro), font: font(false, C.azul_oscuro, 9), border: border(), alignment: align('center') } },
        { v: despM, t: 'n', s: { fill: fill(C.azul_claro), font: font(false, C.azul_oscuro, 9), border: border(), alignment: align('center') } },
        { v: despP, t: 'n', s: { fill: fill(C.azul_claro), font: font(false, C.azul_oscuro, 9), border: border(), alignment: align('center') } },
        { v: despE, t: 'n', s: { fill: fill(C.azul_claro), font: font(false, C.azul_oscuro, 9), border: border(), alignment: align('center') } },
        { v: difG,   t: 'n', s: { fill: fill(difBg), font: font(true, difFc, 10), border: border(), alignment: align('center') } },
        { v: difTot, t: 'n', s: { fill: fill(difBg), font: font(true, difFc, 11), border: border(), alignment: align('center') } },
      ].forEach((cel, c) => { ws[XLSX.utils.encode_cell({ r, c })] = cel; });
      r++;
    });

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 9 } });
    ws['!cols'] = [
      { wch: 30 }, { wch: 8 }, { wch: 10 }, { wch: 11 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 8 }, { wch: 10 },
    ];
    ws['!rows'] = Array(r + 1).fill({ hpt: 20 });
    ws['!rows'][0] = { hpt: 30 };

    XLSX.utils.book_append_sheet(wb, ws, '🧑‍✈️ Por Conductor');
  }

  return { exportarViajes };
})();
