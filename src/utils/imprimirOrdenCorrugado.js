// Genera el documento físico A4 "ORDEN DE CORRUGADO - COMBINACIONES PROGRAMADAS"
export function imprimirOrdenesCorrugado(tiradasInput) {
  const tiradas = Array.isArray(tiradasInput) ? tiradasInput : [tiradasInput];
  if (tiradas.length === 0) return;

  const fechaHoy = new Date().toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  const construirCaras = (prog) => {
    const asig = prog.portabobinas_asignados || {};
    const rec = prog.receta || {};
    const esDoble = Boolean(
      rec.es_doble_onda || asig.entretapa?.codigo || asig.onda_2?.codigo
    );

    const puestos = esDoble
      ? [
          { cara: 1, key: 'liner_ext', esOnda: false, fallbackNom: rec.liner_ext_ideal, fallbackGr: rec.liner_ext_gramaje },
          { cara: 2, key: 'onda_1', esOnda: true, fallbackNom: rec.medium_ideal, fallbackGr: rec.onda1_gramaje },
          { cara: 3, key: 'entretapa', esOnda: false, fallbackNom: rec.entretapa_ideal, fallbackGr: rec.entretapa_gramaje },
          { cara: 4, key: 'onda_2', esOnda: true, fallbackNom: rec.onda2_ideal, fallbackGr: rec.onda2_gramaje },
          { cara: 5, key: 'liner_int', esOnda: false, fallbackNom: rec.liner_int_ideal, fallbackGr: rec.liner_int_gramaje }
        ]
      : [
          { cara: 1, key: 'liner_ext', esOnda: false, fallbackNom: rec.liner_ext_ideal, fallbackGr: rec.liner_ext_gramaje },
          { cara: 2, key: 'onda_1', esOnda: true, fallbackNom: rec.medium_ideal, fallbackGr: rec.onda1_gramaje },
          { cara: 3, key: 'liner_int', esOnda: false, fallbackNom: rec.liner_int_ideal, fallbackGr: rec.liner_int_gramaje }
        ];

    const anchoM = (Number(prog.ancho_bobina_mm) || 0) / 1000;
    const metros = Number(prog.metros_lineales) || 0;

    return puestos.map((p) => {
      const info = asig[p.key] || {};
      const gramaje = Number(info.gramaje) || Number(p.fallbackGr) || 0;
      const factor = p.esOnda ? 1.38 : 1;
      const kilos = Math.round(anchoM * metros * (gramaje / 1000) * factor);
      const codigo = info.codigo || 'RECETA';
      const descripcion = info.nombre
        ? `${info.nombre}${info.fabricante ? ` (${info.fabricante})` : ''}`
        : (p.fallbackNom || 'Según receta estándar');

      return {
        cara: p.cara,
        codigo,
        gramaje,
        ancho: prog.ancho_bobina_mm || 0,
        descripcion,
        kilos
      };
    });
  };

  const paginasHTML = tiradas
    .map((prog, idx) => {
      const caras = construirCaras(prog);
      const resumenPapeles = caras.map((c) => c.codigo).join(' - ');
      const pistas = Array.isArray(prog.pistas_detalle) ? prog.pistas_detalle : [];
      const metros = Math.round(Number(prog.metros_lineales) || 0);
      const anchoMm = Number(prog.ancho_bobina_mm) || 0;
      const m2Totales = Math.round((anchoMm / 1000) * metros);
      const kilosTotales = caras.reduce((acc, c) => acc + c.kilos, 0) || Math.round(Number(prog.consumo_estimado_kg) || 0);

      const filasPistas = pistas
        .map((p, pIdx) => {
          const salidas = Number(p.salidas) || 1;
          const cortes = p.largo_mm > 0 ? Math.floor((metros * 1000) / Number(p.largo_mm)) : 0;
          const planchas = Number(p.planchas_tirada) || cortes * salidas;
          return `
            <tr class="fila-pista">
              <td><strong>${pIdx === 0 ? idx + 1 : ''}</strong></td>
              <td><strong>${p.numero_orden || ''}</strong></td>
              <td>
                <strong>${p.cliente || ''}</strong><br/>
                <span class="sub">${p.producto_descripcion || ''}</span>
              </td>
              <td class="num"><strong>${p.largo_mm || 0}</strong></td>
              <td class="num"><strong>${p.ancho_mm || 0}</strong></td>
              <td class="num"><strong>${cortes} x ${salidas}</strong></td>
              <td class="num">${planchas}</td>
              <td class="num">${metros}</td>
              <td class="num">${pIdx === 0 ? (prog.trim_mm || 0) : ''}</td>
            </tr>
          `;
        })
        .join('');

      const filasCaras = caras
        .map(
          (c, cIdx) => `
          <tr>
            <td>${cIdx === 0 ? (prog.clave_material || '') : ''}</td>
            <td class="center">${c.cara}</td>
            <td><strong>${c.codigo}</strong></td>
            <td class="num">${c.gramaje}</td>
            <td class="num">${c.ancho}</td>
            <td>${c.descripcion}</td>
            <td class="num"><strong>${c.kilos}</strong></td>
          </tr>
        `
        )
        .join('');

      const filasParadas = Array.from({ length: 7 })
        .map(
          () => `
          <tr>
            <td>&nbsp;</td><td></td><td></td><td></td><td></td>
          </tr>
        `
        )
        .join('');

      return `
        <div class="hoja">
          <div class="top-bar">
            <div class="titulo-centro">
              <div class="t1">ORDEN DE CORRUGADO</div>
              <div class="t2">COMBINACIONES PROGRAMADAS</div>
            </div>
            <div class="meta-der">
              <div>Hoja ${idx + 1} / ${tiradas.length}</div>
              <div>${fechaHoy}</div>
            </div>
          </div>

          <table class="cabecera-grid">
            <tr>
              <td>Programa: <strong>${prog.codigo_tirada || prog.id}</strong></td>
              <td>Maquinista: _______________________</td>
              <td>Fecha: ____/____/____</td>
              <td>Turno: ________</td>
            </tr>
            <tr>
              <td>Material: <strong>${prog.clave_material || ''}</strong></td>
              <td>Ancho del Papel: <strong>${anchoMm} mm</strong></td>
              <td colspan="2">Papeles: <strong>${resumenPapeles}</strong></td>
            </tr>
          </table>

          <hr class="linea-gruesa"/>

          <table class="tabla-datos">
            <thead>
              <tr>
                <th style="width:36px;">N°<br/>Cmb</th>
                <th style="width:62px;">Pedido</th>
                <th>Cliente / Producto</th>
                <th class="num" style="width:52px;">Largo</th>
                <th class="num" style="width:52px;">Ancho</th>
                <th class="num" style="width:76px;">Cortes</th>
                <th class="num" style="width:62px;">Planchas</th>
                <th class="num" style="width:56px;">Metros</th>
                <th class="num" style="width:48px;">Ref<br/>mm</th>
              </tr>
            </thead>
            <tbody>
              ${filasPistas}
            </tbody>
          </table>

          <div class="horarios">
            <span>Hora Inicio: ____________</span>
            <span>Hora Fin: ____________</span>
          </div>

          <hr class="linea-gruesa"/>

          <table class="tabla-datos">
            <thead>
              <tr>
                <th style="width:110px;">Material</th>
                <th class="center" style="width:42px;">Cara</th>
                <th style="width:90px;">Papel</th>
                <th class="num" style="width:45px;">Grs</th>
                <th class="num" style="width:55px;">Ancho</th>
                <th>Descripción / Fabricante</th>
                <th class="num" style="width:60px;">Kilos</th>
              </tr>
            </thead>
            <tbody>
              ${filasCaras}
            </tbody>
          </table>

          <div class="totales-bar">
            <span><strong>Totales</strong></span>
            <span>Metros: <strong>${metros} m</strong></span>
            <span>Superficie: <strong>${m2Totales} m²</strong></span>
            <span>Consumo Total: <strong>${kilosTotales} Kg</strong></span>
          </div>

          <div class="seccion-paradas">
            <div class="paradas-titulo">PARADAS</div>
            <table class="tabla-paradas">
              <thead>
                <tr>
                  <th style="width:55px;">Cod</th>
                  <th style="width:70px;">Desde</th>
                  <th style="width:70px;">Hasta</th>
                  <th style="width:60px;">Mins</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                ${filasParadas}
              </tbody>
            </table>
          </div>
        </div>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Orden de Corrugado - NEXO Producción</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 11.5px; color: #000; margin: 0; padding: 0; }
        .hoja { page-break-after: always; display: flex; flex-direction: column; min-height: 270mm; box-sizing: border-box; }
        .hoja:last-child { page-break-after: auto; }
        .top-bar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
        .titulo-centro { flex: 1; text-align: center; }
        .t1 { font-size: 15px; font-weight: bold; letter-spacing: 0.5px; }
        .t2 { font-size: 12px; font-weight: bold; margin-top: 2px; }
        .meta-der { text-align: right; font-size: 11px; min-width: 110px; }
        .cabecera-grid { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
        .cabecera-grid td { padding: 3px 4px; font-size: 11.5px; }
        .linea-gruesa { border: none; border-top: 2px solid #000; margin: 6px 0; }
        .tabla-datos { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        .tabla-datos th { border-bottom: 1.5px solid #000; padding: 4px; text-align: left; font-size: 11px; }
        .tabla-datos td { padding: 5px 4px; vertical-align: top; border-bottom: 1px dashed #cbd5e1; }
        .sub { font-size: 10.5px; color: #333; }
        .num { text-align: right !important; }
        .center { text-align: center !important; }
        .horarios { display: flex; justify-content: flex-end; gap: 36px; margin: 10px 0 6px; font-size: 11.5px; }
        .totales-bar { display: flex; justify-content: space-between; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 5px 6px; margin-top: 4px; font-size: 12px; }
        .seccion-paradas { margin-top: auto; padding-top: 18px; }
        .paradas-titulo { font-weight: bold; margin-bottom: 5px; font-size: 11.5px; }
        .tabla-paradas { width: 100%; border-collapse: collapse; }
        .tabla-paradas th, .tabla-paradas td { border: 1px solid #000; padding: 4px; height: 22px; text-align: center; font-size: 11px; }
      </style>
    </head>
    <body>
      ${paginasHTML}
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `;

  const win = window.open('', '_blank', 'width=900,height=750');
  if (!win) {
    alert('⚠️ Habilitá las ventanas emergentes (pop-ups) para imprimir la Orden de Corrugado.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}