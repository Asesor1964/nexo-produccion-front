import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { imprimirOrdenesCorrugado } from '../utils/imprimirOrdenCorrugado';

export default function PantallaProgramadorCorrugadora({ onIrAStock }) {
  const [anchos, setAnchos] = useState([]);
  const [claves, setClaves] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [programas, setProgramas] = useState([]);
  const [papelesStock, setPapelesStock] = useState([]);
  const [recetasFormulas, setRecetasFormulas] = useState([]);
  const [origenPedidos, setOrigenPedidos] = useState('');
  const [importandoCSV, setImportandoCSV] = useState(false);
  const [cargando, setCargando] = useState(true);

  // Filtros y Parámetros del Cerebro IA
  const [claveSeleccionada, setClaveSeleccionada] = useState('');
  const [clavesCompatiblesExtra, setClavesCompatiblesExtra] = useState([]);
  const [ocultarClavesVacias, setOcultarClavesVacias] = useState(true);
  const [ordenesSeleccionadasIA, setOrdenesSeleccionadasIA] = useState([]);
  const [trimMaxPct, setTrimMaxPct] = useState(5.0);
  const [forzarOrdenId, setForzarOrdenId] = useState('');
  const [forzarAnchoBobina, setForzarAnchoBobina] = useState('');

  // Propuestas calculadas por la IA
  const [propuestasIA, setPropuestasIA] = useState([]);
  const [calculandoIA, setCalculandoIA] = useState(false);

  // 🛠️ MESA DE FORZADO / OVERRIDE MANUAL & EDICIÓN DE COLA
  const [modoVista, setModoVista] = useState('IA'); // 'IA' | 'MANUAL' | 'COLA' | 'MATRIZ_CLAVES'
  const [bobinaManual, setBobinaManual] = useState(2050);
  const [pistasManuales, setPistasManuales] = useState([]); // [{ orden, salidas }]
  const [metrosManuales, setMetrosManuales] = useState(500);
  const [editandoProgramaId, setEditandoProgramaId] = useState(null);

  // Selector de Papel Ideal vs Papel Alternativo Manual (Reserva de Stock)
  const [usarPapelAlternativo, setUsarPapelAlternativo] = useState(false);
  const [portabobinasManual, setPortabobinasManual] = useState({
    liner_ext: '', onda_1: '', entretapa: '', onda_2: '', liner_int: ''
  });
  const [motivoAlternativa, setMotivoAlternativa] = useState('');
  const [habilitarConversionAlAprobar, setHabilitarConversionAlAprobar] = useState(true);

  // Nuevo ancho de bobina para sumar al catálogo
  const [nuevoAnchoInput, setNuevoAnchoInput] = useState('');

  // Edición de Matriz de Equivalencias por Clave (TMC1, TMC5...)
  const [claveEditando, setClaveEditando] = useState(null);
  const [nuevaAlternativaTexto, setNuevaAlternativaTexto] = useState('');

  // Solo claves de Corrugadora de Conversión (todas empiezan con "T")
  const esClaveCorrugadoraConversion = (claveStr) =>
    String(claveStr || '').trim().toUpperCase().startsWith('T');

  const cargarContexto = async () => {
    setCargando(true);
    try {
      const res = await apiFetch('/api/corrugadora/contexto');
      if (res.ok) {
        const data = await res.json();
        const listaClaves = data.claves || [];
        const listaPedidos = data.pedidos || [];
        setAnchos(data.anchos || []);
        setClaves(listaClaves);
        setPedidos(listaPedidos);
        setProgramas(data.programas || []);
        setPapelesStock(data.papeles_stock || []);
        setRecetasFormulas(data.recetas_formulas || []);
        setOrigenPedidos(data.origen_pedidos || '');

        if (!claveSeleccionada && listaClaves.length > 0) {
          const primeraTConPedidos = listaClaves.find(
            c => esClaveCorrugadoraConversion(c.clave) && listaPedidos.some(p => p.clave_material === c.clave)
          );
          const primeraT = listaClaves.find(c => esClaveCorrugadoraConversion(c.clave));
          if (primeraTConPedidos) setClaveSeleccionada(primeraTConPedidos.clave);
          else if (primeraT) setClaveSeleccionada(primeraT.clave);
        }
      }
    } catch (error) {
      console.error('Error cargando contexto de corrugadora:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarContexto();
  }, []);

  const anchosActivos = anchos.filter(a => a.activo).map(a => a.ancho_mm);
  const infoClaveActual = claves.find(c => c.clave === claveSeleccionada) || null;
  const esDobleOndaActual = Boolean(
    infoClaveActual?.es_doble_onda ||
    String(claveSeleccionada || '').toUpperCase().includes('Z')
  );

  const esBlancoActual = String(claveSeleccionada || '').toUpperCase().includes('BLANCO');

  const obtenerPapelesOrdenados = (puesto) => {
    const esOnda = puesto === 'onda_1' || puesto === 'onda_2';
    return [...papelesStock].sort((a, b) => {
      const tipoA = String(a.tipo_papel || '').toUpperCase();
      const tipoB = String(b.tipo_papel || '').toUpperCase();
      const score = (tipo) => {
        if (esOnda) return tipo.includes('ONDA') ? 0 : 1;
        if (puesto === 'liner_ext' && esBlancoActual) return tipo.includes('BLANCO') ? 0 : 1;
        return (tipo.includes('KRAFT') || tipo.includes('LINER')) ? 0 : 1;
      };
      return score(tipoA) - score(tipoB) || (Number(a.gramaje) - Number(b.gramaje));
    });
  };

  // Fórmulas Originales y Alternativas para la clave actual (exacta o base, ej: "TMZ390 RH" -> "TMZ390")
  const formulasClaveActual = recetasFormulas.filter(f => {
    const sel = String(claveSeleccionada || '').trim().toUpperCase();
    const base = sel.split(/\s+/)[0];
    return f.clave === sel || f.clave === base;
  });

  // Busca la mejor bobina en stock que coincida con un código de RECETAS.csv (ej: "B 150", "OE 180", "TL 140")
  const buscarBobinaEnStockPorToken = (token) => {
    if (!token) return '';
    const t = String(token).trim().toUpperCase();
    const matchGr = t.match(/(\d{2,3})/);
    const gr = matchGr ? Number(matchGr[1]) : 0;

    let palabraTipo = '';
    if (t.startsWith('B')) palabraTipo = 'BLANCO';
    else if (t.startsWith('K')) palabraTipo = 'KRAFT';
    else if (t.startsWith('TL')) palabraTipo = 'TEST';
    else if (t.startsWith('OE')) palabraTipo = 'ENCOLAD';
    else if (t.startsWith('SQ')) palabraTipo = 'SEMI';
    else if (t.startsWith('O')) palabraTipo = 'ONDA';

    // 1. Coincidencia exacta de tipo + gramaje (mayor stock primero)
    const exactos = papelesStock
      .filter(p =>
        String(p.tipo_papel || '').toUpperCase().includes(palabraTipo) &&
        (gr === 0 || Number(p.gramaje) === gr)
      )
      .sort((a, b) => Number(b.stock_kg || 0) - Number(a.stock_kg || 0));
    if (exactos.length > 0) return exactos[0].codigo;

    // 2. Solo por tipo con gramaje más cercano
    const mismoTipo = papelesStock
      .filter(p => palabraTipo && String(p.tipo_papel || '').toUpperCase().includes(palabraTipo))
      .sort((a, b) => Math.abs(Number(a.gramaje) - gr) - Math.abs(Number(b.gramaje) - gr) || (Number(b.stock_kg || 0) - Number(a.stock_kg || 0)));
    return mismoTipo[0]?.codigo || '';
  };

  // Busca una bobina real del stock a partir del texto de CLAVES.csv (ej: "T.LINER PESADO", "ONDA ENC")
  const buscarPapelStockPorIdeal = (textoIdeal, gramajeIdeal, esBlanco = false) => {
    if (!papelesStock.length) return null;
    const txt = String(textoIdeal || '').toUpperCase();
    const gr = Number(gramajeIdeal) || 0;

    const filtrarPorTipo = (fn) => papelesStock.filter(fn);
    let candidatos = [];

    if (esBlanco || txt.includes('BLANCO')) {
      candidatos = filtrarPorTipo(p => String(p.tipo_papel || '').toUpperCase().includes('BLANCO') || String(p.nombre || '').toUpperCase().includes('BLANCO'));
    } else if (txt.includes('ENC')) {
      candidatos = filtrarPorTipo(p => String(p.tipo_papel || '').toUpperCase().includes('ENCOL') || String(p.nombre || '').toUpperCase().includes('ENCOL'));
      if (candidatos.length === 0) {
        candidatos = filtrarPorTipo(p => String(p.tipo_papel || '').toUpperCase().includes('ONDA'));
      }
    } else if (txt.includes('KRAFT')) {
      candidatos = filtrarPorTipo(p => String(p.tipo_papel || '').toUpperCase().includes('KRAFT'));
    } else if (txt.includes('LINER') || txt.includes('TEST')) {
      candidatos = filtrarPorTipo(p => String(p.tipo_papel || '').toUpperCase().includes('TEST') || String(p.tipo_papel || '').toUpperCase().includes('LINER'));
    } else if (txt.includes('SEMI')) {
      candidatos = filtrarPorTipo(p => String(p.tipo_papel || '').toUpperCase().includes('SEMI'));
    } else if (txt.includes('ONDA') || txt.includes('MED')) {
      candidatos = filtrarPorTipo(p => String(p.tipo_papel || '').toUpperCase().includes('ONDA'));
    }

    if (candidatos.length === 0) return null;

    const exactos = candidatos
      .filter(p => gr > 0 && Number(p.gramaje) === gr)
      .sort((a, b) => Number(b.stock_kg || 0) - Number(a.stock_kg || 0));
    if (exactos.length > 0) return exactos[0];

    return [...candidatos].sort(
      (a, b) => Math.abs(Number(a.gramaje) - gr) - Math.abs(Number(b.gramaje) - gr) || (Number(b.stock_kg || 0) - Number(a.stock_kg || 0))
    )[0];
  };

  const formatearPapelAsignado = (obj) => {
    if (!obj) return null;
    return {
      codigo: obj.codigo,
      nombre: obj.nombre,
      gramaje: obj.gramaje,
      tipo_papel: obj.tipo_papel || '',
      fabricante: obj.fabricante || obj.proveedor || ''
    };
  };

  // Resuelve los 3 o 5 portabobinas reales desde Stock (priorizando RECETAS.csv ORIGINAL y luego CLAVES.csv)
  const resolverPortabobinasDesdeStock = (claveMat, recetaObj) => {
    const claveNorm = String(claveMat || '').trim().toUpperCase();
    const base = claveNorm.split(/\s+/)[0];
    const esBlanco = claveNorm.includes('BLANCO');
    const rec = recetaObj || claves.find(c => c.clave === claveNorm) || claves.find(c => c.clave === base) || {};
    const formulaOrig =
      recetasFormulas.find(f => (f.clave === claveNorm || f.clave === base) && f.formula_tipo === 'ORIGINAL') ||
      recetasFormulas.find(f => f.clave === claveNorm || f.clave === base) ||
      null;

    const esDoble = Boolean(rec.es_doble_onda || formulaOrig?.es_doble_onda || claveNorm.includes('Z'));

    const resolverPuesto = (tokenFormula, idealTxt, idealGr, blancoFlag = false) => {
      if (tokenFormula) {
        const cod = buscarBobinaEnStockPorToken(tokenFormula);
        const pap = papelesStock.find(p => p.codigo === cod);
        if (pap) return formatearPapelAsignado(pap);
      }
      const papIdeal = buscarPapelStockPorIdeal(idealTxt, idealGr, blancoFlag);
      return formatearPapelAsignado(papIdeal);
    };

    const resultado = {};
    const p1 = resolverPuesto(formulaOrig?.liner_ext, rec.liner_ext_ideal, rec.liner_ext_gramaje, esBlanco);
    const p2 = resolverPuesto(formulaOrig?.onda_1, rec.medium_ideal, rec.onda1_gramaje, false);
    if (p1) resultado.liner_ext = p1;
    if (p2) resultado.onda_1 = p2;

    if (esDoble) {
      const p3 = resolverPuesto(formulaOrig?.entretapa, rec.entretapa_ideal, rec.entretapa_gramaje, false);
      const p4 = resolverPuesto(formulaOrig?.onda_2, rec.onda2_ideal, rec.onda2_gramaje, false);
      if (p3) resultado.entretapa = p3;
      if (p4) resultado.onda_2 = p4;
    }

    const p5 = resolverPuesto(formulaOrig?.liner_int, rec.liner_int_ideal, rec.liner_int_gramaje, false);
    if (p5) resultado.liner_int = p5;

    return Object.keys(resultado).length > 0 ? resultado : null;
  };

  const aplicarFormulaReceta = (formulaId) => {
    const f = formulasClaveActual.find(x => String(x.id) === String(formulaId));
    if (!f) return;

    const nuevaSeleccion = {
      liner_ext: buscarBobinaEnStockPorToken(f.liner_ext),
      onda_1: buscarBobinaEnStockPorToken(f.onda_1),
      entretapa: f.es_doble_onda ? buscarBobinaEnStockPorToken(f.entretapa) : '',
      onda_2: f.es_doble_onda ? buscarBobinaEnStockPorToken(f.onda_2) : '',
      liner_int: buscarBobinaEnStockPorToken(f.liner_int)
    };

    const resumen = f.es_doble_onda
      ? `${f.liner_ext} / ${f.onda_1} / ${f.entretapa} / ${f.onda_2} / ${f.liner_int}`
      : `${f.liner_ext} / ${f.onda_1} / ${f.liner_int}`;

    setPortabobinasManual(nuevaSeleccion);
    setMotivoAlternativa(`Fórmula ${f.formula_tipo} (${f.clave}): ${resumen}`);
  };

  const clavesVisibles = claves.filter(c => {
    if (!esClaveCorrugadoraConversion(c.clave)) return false;
    if (!ocultarClavesVacias) return true;
    const tienePedidos = pedidos.some(p => p.clave_material === c.clave);
    const estaActiva = c.clave === claveSeleccionada || clavesCompatiblesExtra.includes(c.clave);
    return tienePedidos || estaActiva;
  });

  const programasActivos = programas
    .filter(p => p.estado === 'En Proceso' || p.estado === 'Programada')
    .sort((a, b) => {
      if (a.estado === 'En Proceso' && b.estado !== 'En Proceso') return -1;
      if (b.estado === 'En Proceso' && a.estado !== 'En Proceso') return 1;
      return (a.prioridad_secuencia || 999) - (b.prioridad_secuencia || 999) || a.id - b.id;
    });

  const toggleClaveSeleccionada = (clave) => {
    setForzarOrdenId('');
    setPropuestasIA([]);

    if (claveSeleccionada === clave) {
      if (clavesCompatiblesExtra.length > 0) {
        const [nuevaPrincipal, ...resto] = clavesCompatiblesExtra;   
        setClaveSeleccionada(nuevaPrincipal);
        setClavesCompatiblesExtra(resto);
      }
      return;
    }

    if (clavesCompatiblesExtra.includes(clave)) {
      setClavesCompatiblesExtra(prev => prev.filter(c => c !== clave));
    } else if (!claveSeleccionada) {
      setClaveSeleccionada(clave);
    } else {
      setClavesCompatiblesExtra(prev => [...prev, clave]);
    }
  };

  const toggleSeleccionOrdenIA = (numOrden) => {
    const num = Number(numOrden);
    setOrdenesSeleccionadasIA(prev =>
      prev.includes(num) ? prev.filter(id => id !== num) : [...prev, num]
    );
  };

  const darPorCumplidoPendiente = async (ord) => {
    const ok = window.confirm(
      `¿Dar por cumplida la orden #${ord.numero_orden} (${ord.cliente})?\n\nSe cerrará el saldo pendiente de ${ord.cantidad_pendiente} planchas y saldrá de la lista de Corrugadora.`
    );
    if (!ok) return;

    try {
      const res = await apiFetch(`/api/corrugadora/pendientes/${ord.numero_orden}/cerrar`, {
        method: 'PUT'
      });
      const data = await res.json();
      if (res.ok) {
        setOrdenesSeleccionadasIA(prev => prev.filter(id => id !== Number(ord.numero_orden)));
        cargarContexto();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (e) {
      alert('❌ Error de conexión al cerrar el pendiente.');
    }
  };

  const imprimirDesdeProgramacion = (tiradasAImprimir) => {
    const lista = Array.isArray(tiradasAImprimir) ? tiradasAImprimir : [tiradasAImprimir];
    const enriquecidas = lista.map((prog) => {
      const claveNorm = String(prog.clave_material || '').trim().toUpperCase();
      const base = claveNorm.split(/\s+/)[0];
      const receta = claves.find((c) => c.clave === claveNorm) || claves.find((c) => c.clave === base) || null;

      let portabobinas = prog.portabobinas_asignados;
      if (!portabobinas || Object.keys(portabobinas).length === 0) {
        portabobinas = resolverPortabobinasDesdeStock(prog.clave_material, receta);
      } else {
        // Si ya tenía bobinas guardadas sin fabricante, completarlo desde stock
        const copia = {};
        Object.entries(portabobinas).forEach(([k, v]) => {
          const pap = papelesStock.find(p => p.codigo === v?.codigo);
          copia[k] = {
            ...v,
            fabricante: v?.fabricante || pap?.fabricante || pap?.proveedor || ''
          };
        });
        portabobinas = copia;
      }

      return { ...prog, receta, portabobinas_asignados: portabobinas };
    });
    imprimirOrdenesCorrugado(enriquecidas);
  };

  const handleAgregarAncho = async (e) => {
    e.preventDefault();
    const val = parseInt(nuevoAnchoInput, 10);
    if (!val) return;
    try {
      const res = await apiFetch('/api/corrugadora/anchos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ancho_mm: val })
      });
      if (res.ok) {
        setNuevoAnchoInput('');
        cargarContexto();
      }
    } catch (e) {}
  };

  const toggleAnchoBobina = async (id) => {
    try {
      await apiFetch(`/api/corrugadora/anchos/${id}/toggle`, { method: 'PUT' });
      cargarContexto();
    } catch (e) {}
  };

  // 📥 IMPORTADOR INTELIGENTE DE CSV (CLAVES, PAPELES/BOBINAS, PENDIENTES, RECETAS)
  const handleImportarCSVCorrugadora = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportandoCSV(true);

    const parseNumAR = (v) => {
      if (!v) return 0;
      const n = parseFloat(String(v).replace(/"/g, '').replace(/\./g, '').replace(',', '.').trim());
      return isNaN(n) ? 0 : n;
    };

    const procesarTexto = async (textoRaw) => {
      try {
        const texto = String(textoRaw || '').replace(/^\uFEFF/, '');
        const lineas = texto.split(/\r\n|\n/).filter(l => l.trim());
        if (lineas.length < 2) throw new Error('Archivo vacío');

        const header = lineas[0].toLowerCase();

        if (header.includes('liner.ext') && header.includes('clave')) {
          const clavesPayload = lineas.slice(1).map(l => {
            const c = l.split(';');
            return {
              clave: c[0]?.trim(),
              liner_ext_ideal: c[1]?.trim(), liner_ext_gramaje: parseNumAR(c[2]), liner_ext_rct: parseNumAR(c[3]),
              medium_ideal: c[4]?.trim(), onda1_gramaje: parseNumAR(c[5]), onda1_cct: parseNumAR(c[6]),
              liner_int_ideal: c[7]?.trim(), liner_int_gramaje: parseNumAR(c[8]), liner_int_rct: parseNumAR(c[9]),
              onda2_ideal: c[10]?.trim(), onda2_gramaje: parseNumAR(c[11]), onda2_cct: parseNumAR(c[12]),
              entretapa_ideal: c[13]?.trim(), entretapa_gramaje: parseNumAR(c[14]), entretapa_rct: parseNumAR(c[15])
            };
          }).filter(x => x.clave);

          const res = await apiFetch('/api/corrugadora/importar-claves', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ claves: clavesPayload })
          });
          const data = await res.json();
          alert(res.ok ? `✅ ${data.mensaje}` : `❌ ${data.error}`);
        } else if (header.includes('tipo de papel') && header.includes('stock')) {
          const papelesPayload = lineas.slice(1).map(l => {
            const c = l.split(';');
            return {
              codigo: c[0]?.trim(), nombre: c[1]?.trim(), precio_kg: parseNumAR(c[2]),
              fabricante: c[3]?.trim(), proveedor: c[4]?.trim(), color: c[5]?.trim(),
              gramaje: parseNumAR(c[6]), tipo_papel: c[7]?.trim(), punto_pedido_kg: parseNumAR(c[8]),
              stock_kg: parseNumAR(c[9]), valor_stock: parseNumAR(c[10]), fsc: c[11]?.trim()
            };
          }).filter(x => x.codigo);

          const res = await apiFetch('/api/corrugadora/importar-papeles', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ papeles: papelesPayload })
          });
          const data = await res.json();
          alert(res.ok ? `✅ ${data.mensaje}` : `❌ ${data.error}`);
        } else if (header.includes('planchas necesarias') || header.includes('corrugado')) {
          const pendientesPayload = lineas.slice(1).map(l => {
            const c = l.split(';');
            return {
              numero_orden: parseInt(String(c[0] || '').replace(/\./g, ''), 10),
              fecha_pedido: c[1]?.trim(), fecha_entrega: c[2]?.trim(), clave_material: c[3]?.trim(),
              ancho_pref_mm: parseNumAR(c[4]) || null, codigo_producto: c[5]?.trim(),
              cliente: c[6]?.trim(), descripcion: c[7]?.trim(),
              largo_mm: parseNumAR(c[8]), ancho_mm: parseNumAR(c[9]),
              cant_pedido: parseNumAR(c[10]), cajas: parseNumAR(c[11]),
              planchas_necesarias: parseNumAR(c[12]), pendiente: parseNumAR(c[13]),
              m2_pendientes: parseNumAR(c[14]),
              primer_pedido: String(c[15] || '').toUpperCase().includes('VERDAD'),
              progr_siguiente: parseNumAR(c[16])
            };
          }).filter(x => x.numero_orden && x.pendiente > 0);

          const res = await apiFetch('/api/corrugadora/importar-pendientes', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pendientes: pendientesPayload, reemplazar_cola: true })
          });
          const data = await res.json();
          alert(res.ok ? `✅ ${data.mensaje}` : `❌ ${data.error}`);

          } else if (header.includes('sector') && header.includes('ancho') && header.includes('consumida')) {
          const vistas = new Set();
          const mapaGrupos = new Map();

          lineas.slice(1).forEach(l => {
            const c = l.split(';');
            const codBobina = c[0]?.trim();
            const tipoPapel = c[2]?.trim() || '';
            const nombrePapel = c[3]?.trim() || '';
            const proveedor = c[4]?.trim() || '';
            const fabricante = c[5]?.trim() || '';
            const anchoMm = Math.round(parseNumAR(c[6]));
            const gramaje = Math.round(parseNumAR(c[9]));
            const pesoKg = parseNumAR(c[11]);
            const color = c[16]?.trim() || '';
            const sector = (c[20] || '').trim().toUpperCase();
            const consumida = (c[23] || '').trim().toUpperCase();

            // Filtros: solo PAPEL CARTON, activas (FALSO), ancho >= 1000 mm y sin duplicados
            if (!codBobina || vistas.has(codBobina)) return;
            if (sector !== 'PAPEL CARTON') return;
            if (consumida !== 'FALSO') return;
            if (anchoMm < 1000 || pesoKg <= 0 || !nombrePapel) return;

            vistas.add(codBobina);

            const key = `${nombrePapel.toUpperCase()}|${fabricante.toUpperCase()}|${gramaje}|${anchoMm}`;
            if (!mapaGrupos.has(key)) {
              mapaGrupos.set(key, {
                tipo_papel: tipoPapel,
                nombre: nombrePapel,
                proveedor,
                fabricante,
                color,
                gramaje,
                ancho_mm: anchoMm,
                stock_kg: 0,
                cantidad_bobinas: 0
              });
            }
            const item = mapaGrupos.get(key);
            item.stock_kg += pesoKg;
            item.cantidad_bobinas += 1;
          });

          const grupos = Array.from(mapaGrupos.values());
          const res = await apiFetch('/api/corrugadora/importar-macro-bobinas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grupos })
          });
          const data = await res.json();
          alert(res.ok ? `✅ ${data.mensaje}` : `❌ ${data.error}`);

        } else if (header.includes('claves') && header.includes('tipos de papeles')) {
          const recetasPayload = lineas.slice(1).map(l => {
            const c = l.split(';');
            return {
              clave: c[0]?.trim(),
              p1: c[1]?.trim(),
              p2: c[2]?.trim(),
              p3: c[3]?.trim(),
              p4: c[4]?.trim(),
              p5: c[5]?.trim(),
              formula_tipo: c[6]?.trim()
            };
          }).filter(x => x.clave && (x.formula_tipo === 'ORIGINAL' || x.formula_tipo === 'ALTERNATIVO'));

          const res = await apiFetch('/api/corrugadora/importar-recetas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recetas: recetasPayload })
          });
          const data = await res.json();
          alert(res.ok ? `✅ ${data.mensaje}` : `❌ ${data.error}`);
        } else {
          alert('⚠️ No se reconoció el formato. Subí CLAVES.csv, REGISTRO DE PAPELES.csv, RECETAS.csv o PENDIENTES DE CORRUGADORA.csv.');
        }
        await cargarContexto();
      } catch (err) {
        alert('❌ Error procesando CSV: ' + err.message);
      } finally {
        setImportandoCSV(false);
        e.target.value = '';
      }
    };

    const reader = new FileReader();
    reader.onload = (ev) => procesarTexto(ev.target.result);
    reader.readAsText(file, 'UTF-8');
  };

  // 🧠 EJECUTAR MOTOR DE OPTIMIZACIÓN IA
  const ejecutarCerebroIA = async () => {
    setCalculandoIA(true);
    setModoVista('IA');
    try {
      const res = await apiFetch('/api/corrugadora/optimizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clave_objetivo: claveSeleccionada,
          claves_compatibles: clavesCompatiblesExtra,
          anchos_disponibles: anchosActivos,
          trim_maximo_pct: Number(trimMaxPct) || 5.5,
          forzar_ancho_bobina: forzarAnchoBobina ? Number(forzarAnchoBobina) : null,
          forzar_orden_id: forzarOrdenId ? Number(forzarOrdenId) : null,
          ordenes_seleccionadas: ordenesSeleccionadasIA
        })
      });
      const data = await res.json();
      if (res.ok) {
        const lista = data.propuestas || [];
        setPropuestasIA(lista);
        if (lista.length === 0) {
          alert(`⚠️ El motor evaluó ${data.total_candidatos ?? 0} orden(es) pero ninguna combinación entró en el Trim Máx (${trimMaxPct}%).\n\nRevisá: Bobinas activas, "Forzar Bobina" o "Incluir Orden #".`);
        }
      } else {
        alert(`❌ Error del servidor: ${data.error || 'No se pudo calcular'}`);
      }
    } catch (error) {
      alert('❌ Error al consultar el motor optimizador.');
    } finally {
      setCalculandoIA(false);
    }
  };

  const llevarPropuestaAMesaManual = (prop) => {
    setEditandoProgramaId(null);
    setBobinaManual(prop.ancho_bobina_mm);
    setMetrosManuales(prop.metros_lineales);
    const pistasMapeadas = prop.pistas.map(p => {
      const ordFull = pedidos.find(x => Number(x.numero_orden) === Number(p.numero_orden)) || p;
      return { orden: ordFull, salidas: p.salidas };
    });
    setPistasManuales(pistasMapeadas);
    setModoVista('MANUAL');
  };

  const editarProgramaEnMesa = (prog) => {
    setEditandoProgramaId(prog.id);
    setBobinaManual(Number(prog.ancho_bobina_mm) || 2050);
    setMetrosManuales(Number(prog.metros_lineales) || 500);
    const pistasMapeadas = (prog.pistas_detalle || []).map(p => {
      const ordFull = pedidos.find(x => Number(x.numero_orden) === Number(p.numero_orden)) || p;
      return { orden: ordFull, salidas: Number(p.salidas) || 1 };
    });
    setPistasManuales(pistasMapeadas);
    setUsarPapelAlternativo(Boolean(prog.es_alternativa_manual));
    setMotivoAlternativa(prog.motivo_alternativa || '');
    setModoVista('MANUAL');
  };

  const agregarOrdenAMesaManual = (ord) => {
    if (pistasManuales.some(p => Number(p.orden.numero_orden) === Number(ord.numero_orden))) return;
    setPistasManuales([...pistasManuales, { orden: ord, salidas: 1 }]);
    setModoVista('MANUAL');
  };

  const cambiarSalidasManual = (idx, delta) => {
    const copia = [...pistasManuales];
    const nueva = Math.max(1, Math.min(5, copia[idx].salidas + delta));
    copia[idx].salidas = nueva;
    setPistasManuales(copia);
  };

  const quitarPistaManual = (idx) => {
    setPistasManuales(pistasManuales.filter((_, i) => i !== idx));
  };

  const moverEnCola = async (index, direccion) => {
    const lista = [...programasActivos];
    const destino = index + direccion;
    if (destino < 0 || destino >= lista.length) return;
    if (lista[index].estado === 'En Proceso' || lista[destino].estado === 'En Proceso') return;

    const [item] = lista.splice(index, 1);
    lista.splice(destino, 0, item);

    try {
      await apiFetch('/api/corrugadora/programas/reordenar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordenIds: lista.map(p => p.id) })
      });
      cargarContexto();
    } catch (e) {}
  };

  const eliminarPrograma = async (prog) => {
    if (!window.confirm(`🗑️ ¿Quitar la tirada ${prog.codigo_tirada} de la cola de Corrugadora?`)) return;
    try {
      await apiFetch(`/api/corrugadora/programas/${prog.id}`, { method: 'DELETE' });
      cargarContexto();
    } catch (e) {}
  };

  const anchoOcupadoManual = pistasManuales.reduce((acc, p) => acc + (Number(p.orden.ancho_mm) || 0) * p.salidas, 0);
  const trimManualMm = Number(bobinaManual) - anchoOcupadoManual;
  const trimManualPct = Number(bobinaManual) > 0 ? Number(((trimManualMm / Number(bobinaManual)) * 100).toFixed(2)) : 0;

  const aprobarTirada = async (datosTirada) => {
    let portabobinasPayload = null;
    let papelFinal = `IDEAL (${datosTirada.clave_material}): ${infoClaveActual?.liner_ext_ideal || 'Estándar'}`;

    if (usarPapelAlternativo) {
      const buscarPapel = (cod) => papelesStock.find(p => p.codigo === cod) || null;
      const seleccionados = {};
      ['liner_ext', 'onda_1', 'entretapa', 'onda_2', 'liner_int'].forEach((k) => {
        if (portabobinasManual[k]) {
          const obj = buscarPapel(portabobinasManual[k]);
          seleccionados[k] = obj
            ? formatearPapelAsignado(obj)
            : { codigo: portabobinasManual[k], nombre: portabobinasManual[k], gramaje: 0, fabricante: '' };
        }
      });

      if (Object.keys(seleccionados).length === 0) {
        alert('⚠️ Elegí al menos un papel real en los desplegables de Portabobinas o destildá "Usar Papel Alternativo".');
        return;
      }

      portabobinasPayload = seleccionados;
      papelFinal = Object.entries(seleccionados)
        .map(([k, v]) => `${k.toUpperCase()}: ${v.codigo} (${v.gramaje}g)`)
        .join(' | ');
    } else {
      // Auto-asignar bobinas reales del stock (código + fabricante) según RECETAS.csv / CLAVES.csv
      portabobinasPayload = resolverPortabobinasDesdeStock(datosTirada.clave_material);
      if (portabobinasPayload) {
        papelFinal = Object.values(portabobinasPayload).map(v => v.codigo).join(' - ');
      }
    }

    const esEdicion = Boolean(editandoProgramaId && modoVista === 'MANUAL');
    const confirmar = window.confirm(
      `${esEdicion ? '💾 ¿Guardar cambio de combinación en esta tirada?' : '🚀 ¿Confirmás programar esta tirada en Corrugadora?'}\n\n` +
      `• Bobina Madre: ${datosTirada.ancho_bobina_mm} mm\n` +
      `• Trim / Refile: ${datosTirada.trim_mm} mm (${datosTirada.trim_porcentaje}%)\n` +
      `• Corrida: ${datosTirada.metros_lineales} metros lineales\n` +
      `• Papel: ${papelFinal}`
    );
    if (!confirmar) return;

    try {
      const url = esEdicion ? `/api/corrugadora/programas/${editandoProgramaId}` : '/api/corrugadora/aprobar-tirada';
      const method = esEdicion ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...datosTirada,
          papel_utilizado: papelFinal,
          es_alternativa_manual: usarPapelAlternativo,
          motivo_alternativa: motivoAlternativa,
          habilitar_en_conversion: habilitarConversionAlAprobar,
          portabobinas_asignados: portabobinasPayload
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.mensaje}`);
        setEditandoProgramaId(null);
        setUsarPapelAlternativo(false);
        setMotivoAlternativa('');
        setPortabobinasManual({ liner_ext: '', onda_1: '', entretapa: '', onda_2: '', liner_int: '' });
        cargarContexto();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      alert('❌ Error de conexión con el servidor.');
    }
  };

  const guardarMatrizClave = async (e) => {
    e.preventDefault();
    if (!claveEditando) return;
    try {
      const res = await apiFetch(`/api/corrugadora/claves/${encodeURIComponent(claveEditando.clave)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(claveEditando)
      });
      if (res.ok) {
        alert(`✅ Matriz de papeles y alternativas guardada para la clave ${claveEditando.clave}.`);
        setClaveEditando(null);
        cargarContexto();
      }
    } catch (e) {}
  };

  const pedidosFiltradosClave = pedidos.filter(p => {
    if (!esClaveCorrugadoraConversion(p.clave_material)) return false;
    if (!claveSeleccionada) return true;
    return p.clave_material === claveSeleccionada || clavesCompatiblesExtra.includes(p.clave_material);
  });

  const colorTrim = (pct) => {
    if (pct < 0) return '#dc2626';
    if (pct <= 2.5) return '#059669';
    if (pct <= 4.5) return '#d97706';
    return '#dc2626';
  };

  return (
    <div style={{ padding: '1.2rem 1.5rem', maxWidth: '1480px', margin: '0 auto', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
      
      {/* CABECERA DEDICADA CORRUGADORA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '3px solid #7c3aed', paddingBottom: '10px', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '2.4rem' }}>🧠</span>
          <div>
            <h2 style={{ margin: 0, color: '#4c1d95', fontSize: '1.8rem' }}>Cerebro de Programación — Línea Corrugadora</h2>
            <small style={{ color: '#64748b', fontWeight: 'bold' }}>
              Optimización de Anchos de Bobina, Trim Ideal, Claves de Conversión (T*) y Cola en Vivo
              {origenPedidos && ` · Origen cola: ${origenPedidos}`}
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setModoVista('IA')}
            style={{
              padding: '9px 14px', borderRadius: '8px', border: '2px solid #7c3aed',
              backgroundColor: modoVista === 'IA' ? '#7c3aed' : '#fff',
              color: modoVista === 'IA' ? '#fff' : '#7c3aed', fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            🤖 Sugerencias IA
          </button>

          <button
            type="button"
            onClick={() => setModoVista('MANUAL')}
            style={{
              padding: '9px 14px', borderRadius: '8px', border: '2px solid #0284c7',
              backgroundColor: modoVista === 'MANUAL' ? '#0284c7' : '#fff',
              color: modoVista === 'MANUAL' ? '#fff' : '#0284c7', fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            🛠️ Mesa Manual ({pistasManuales.length})
          </button>

          <button
            type="button"
            onClick={() => setModoVista('COLA')}
            style={{
              padding: '9px 14px', borderRadius: '8px', border: '2px solid #16a34a',
              backgroundColor: modoVista === 'COLA' ? '#16a34a' : '#fff',
              color: modoVista === 'COLA' ? '#fff' : '#15803d', fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            📋 Cola Corrugadora ({programasActivos.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setClaveEditando(infoClaveActual || clavesVisibles[0] || null);
              setModoVista('MATRIZ_CLAVES');
            }}
            style={{
              padding: '9px 14px', borderRadius: '8px', border: '2px solid #d97706',
              backgroundColor: modoVista === 'MATRIZ_CLAVES' ? '#d97706' : '#fff',
              color: modoVista === 'MATRIZ_CLAVES' ? '#fff' : '#b45309', fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            📜 Matriz Claves
          </button>

          <label style={{
            padding: '9px 14px', borderRadius: '8px', backgroundColor: '#0f766e', color: '#fff',
            fontWeight: 'bold', cursor: 'pointer', fontSize: '0.86rem', display: 'flex', alignItems: 'center'
          }}>
            {importandoCSV ? '⏳ Importando...' : '📥 Importar CSV'}
            <input type="file" accept=".csv" disabled={importandoCSV} onChange={handleImportarCSVCorrugadora} style={{ display: 'none' }} />
          </label>

          {onIrAStock && (
            <button
              type="button"
              onClick={onIrAStock}
              style={{ padding: '9px 14px', borderRadius: '8px', border: '2px solid #0f766e', backgroundColor: '#f0fdfa', color: '#0f766e', fontWeight: 'bold', cursor: 'pointer' }}
            >
              🧻 Ver Stock Bobinas
            </button>
          )}
        </div>
      </div>

      {/* BARRA DE BOBINAS DISPONIBLES EN PAÑOL */}
      <div style={{ backgroundColor: '#fff', padding: '12px 16px', borderRadius: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', marginBottom: '1.2rem', borderLeft: '5px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>🧻 Formatos de Bobina Activos:</strong>
          {anchos.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleAnchoBobina(a.id)}
              style={{
                padding: '5px 11px', borderRadius: '20px',
                border: a.activo ? '2px solid #0f172a' : '1px solid #cbd5e1',
                backgroundColor: a.activo ? '#0f172a' : '#f1f5f9',
                color: a.activo ? '#38bdf8' : '#64748b',
                fontWeight: 'bold', fontSize: '0.82rem', cursor: 'pointer'
              }}
            >
              {a.activo ? '✓ ' : ''}{a.ancho_mm} mm
            </button>
          ))}
        </div>

        <form onSubmit={handleAgregarAncho} style={{ display: 'flex', gap: '6px' }}>
          <input
            type="number" min="600" max="3200" placeholder="+ Ancho mm (ej. 2200)"
            value={nuevoAnchoInput} onChange={(e) => setNuevoAnchoInput(e.target.value)}
            style={{ width: '155px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
          />
          <button type="submit" style={{ padding: '6px 12px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.82rem', cursor: 'pointer' }}>
            + Sumar Formato
          </button>
        </form>
      </div>

      {/* VISTA: COLA DE FABRICACIÓN EN VIVO (SECUENCIADOR + IMPRESIÓN A4) */}
      {modoVista === 'COLA' && (
        <div style={{ backgroundColor: '#fff', padding: '1.4rem', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.06)', borderTop: '5px solid #16a34a', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: '#15803d' }}>📋 Cola de Fabricación de Corrugadora (Vista en Vivo del Maquinista)</h3>
            <button
              type="button"
              onClick={() => imprimirDesdeProgramacion(programasActivos)}
              disabled={programasActivos.length === 0}
              style={{
                padding: '8px 14px', borderRadius: '8px', border: 'none',
                backgroundColor: programasActivos.length === 0 ? '#94a3b8' : '#0f172a',
                color: '#fff', fontWeight: 'bold', cursor: programasActivos.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              🖨️ Imprimir Toda la Cola (A4)
            </button>
          </div>

          {programasActivos.length === 0 ? (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No hay tiradas programadas todavía. Aprobá una desde Sugerencias IA o Mesa Manual.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {programasActivos.map((prog, idx) => (
                <div key={prog.id} style={{ border: prog.estado === 'En Proceso' ? '2px solid #16a34a' : '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', backgroundColor: prog.estado === 'En Proceso' ? '#f0fdf4' : '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ backgroundColor: prog.estado === 'En Proceso' ? '#16a34a' : '#334155', color: '#fff', padding: '2px 9px', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        #{idx + 1} · {prog.estado}
                      </span>
                      <strong>{prog.codigo_tirada}</strong>
                      <span style={{ color: '#7c3aed', fontWeight: 'bold' }}>{prog.clave_material}</span>
                      <span>Bobina <strong>{prog.ancho_bobina_mm} mm</strong></span>
                      <span>Trim <strong>{prog.trim_mm} mm ({prog.trim_porcentaje}%)</strong></span>
                      <span>Corrida <strong>{prog.metros_lineales} mts</strong></span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '4px' }}>
                      {(prog.pistas_detalle || []).map(p => `OP #${p.numero_orden} (${p.salidas}×${p.ancho_mm}mm · ${p.planchas_tirada} pl.)`).join('  +  ')}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      title="Imprimir solo esta Orden de Corrugado (A4)"
                      onClick={() => imprimirDesdeProgramacion(prog)}
                      style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#0f172a', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      🖨️ A4
                    </button>

                    {prog.estado === 'Programada' && (
                      <>
                        <button type="button" onClick={() => moverEnCola(idx, -1)} style={{ padding: '5px 9px', cursor: 'pointer' }} title="Subir puesto">⬆️</button>
                        <button type="button" onClick={() => moverEnCola(idx, 1)} style={{ padding: '5px 9px', cursor: 'pointer' }} title="Bajar puesto">⬇️</button>
                        <button type="button" onClick={() => editarProgramaEnMesa(prog)} style={{ padding: '5px 10px', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #0284c7', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                          ✏️ Cambiar Combinación
                        </button>
                        <button type="button" onClick={() => eliminarPrograma(prog)} style={{ padding: '5px 9px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer' }}>
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VISTA: MATRIZ DE EQUIVALENCIAS DE CLAVES Y PAPELES */}
      {modoVista === 'MATRIZ_CLAVES' && (
        <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.06)', borderTop: '5px solid #d97706', marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0, color: '#92400e' }}>📜 Configuración de Claves de Material (T*) y Papeles Alternativos Aprobados</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
            <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '1rem', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '500px', overflowY: 'auto' }}>
              {claves.filter(c => esClaveCorrugadoraConversion(c.clave)).map(c => (
                <button
                  key={c.clave}
                  type="button"
                  onClick={() => setClaveEditando(c)}
                  style={{
                    padding: '10px 12px', textAlign: 'left', borderRadius: '6px',
                    border: claveEditando?.clave === c.clave ? '2px solid #d97706' : '1px solid #cbd5e1',
                    backgroundColor: claveEditando?.clave === c.clave ? '#fef3c7' : '#f8fafc',
                    fontWeight: 'bold', cursor: 'pointer'
                  }}
                >
                  {c.clave} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({c.onda || 'Onda C'})</span>
                </button>
              ))}
            </div>

            {claveEditando && (
              <form onSubmit={guardarMatrizClave}>
                <h4 style={{ marginTop: 0 }}>Editando Clave: <span style={{ color: '#d97706' }}>{claveEditando.clave}</span></h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Tipo Onda:</label>
                    <select value={claveEditando.onda || 'C'} onChange={e => setClaveEditando({ ...claveEditando, onda: e.target.value })} style={{ width: '100%', padding: '7px' }}>
                      <option value="B">Onda B</option>
                      <option value="C">Onda C</option>
                      <option value="CB">Doble Onda CB</option>
                      <option value="E">Micro Onda E</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Liner Exterior Ideal:</label>
                    <input type="text" value={claveEditando.liner_ext_ideal || ''} onChange={e => setClaveEditando({ ...claveEditando, liner_ext_ideal: e.target.value })} style={{ width: '100%', padding: '7px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Onda / Medium Ideal:</label>
                    <input type="text" value={claveEditando.medium_ideal || ''} onChange={e => setClaveEditando({ ...claveEditando, medium_ideal: e.target.value })} style={{ width: '100%', padding: '7px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Liner Interior Ideal:</label>
                    <input type="text" value={claveEditando.liner_int_ideal || ''} onChange={e => setClaveEditando({ ...claveEditando, liner_int_ideal: e.target.value })} style={{ width: '100%', padding: '7px', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '12px' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                    🔄 Papeles / Gramajes Alternativos Aprobados por Stock:
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input type="text" placeholder="Ej: Kraft 165g + Onda 125g + Kraft 150g" value={nuevaAlternativaTexto} onChange={e => setNuevaAlternativaTexto(e.target.value)} style={{ flex: 1, padding: '7px', borderRadius: '5px', border: '1px solid #ccc' }} />
                    <button
                      type="button"
                      onClick={() => {
                        if (!nuevaAlternativaTexto.trim()) return;
                        const prev = Array.isArray(claveEditando.alternativas_aprobadas) ? claveEditando.alternativas_aprobadas : [];
                        setClaveEditando({ ...claveEditando, alternativas_aprobadas: [...prev, nuevaAlternativaTexto.trim()] });
                        setNuevaAlternativaTexto('');
                      }}
                      style={{ padding: '7px 14px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      + Agregar Alternativa
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(Array.isArray(claveEditando.alternativas_aprobadas) ? claveEditando.alternativas_aprobadas : []).map((alt, i) => (
                      <span key={i} style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {alt}
                        <button type="button" onClick={() => setClaveEditando({ ...claveEditando, alternativas_aprobadas: claveEditando.alternativas_aprobadas.filter((_, idx) => idx !== i) })} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold' }}>✖</button>
                      </span>
                    ))}
                  </div>
                </div>

                <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                  💾 Guardar Configuración de Clave {claveEditando.clave}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* GRILLA PRINCIPAL DE TRABAJO (2 COLUMNAS: PEDIDOS POR CLAVE | MOTOR IA & MESA MANUAL) */}
      {(modoVista === 'IA' || modoVista === 'MANUAL') && (
        <div style={{ display: 'grid', gridTemplateColumns: '430px 1fr', gap: '1.4rem', alignItems: 'start' }}>
          
          {/* COLUMNA IZQUIERDA: PEDIDOS PENDIENTES AGRUPADOS POR CLAVE (SOLO "T") */}
          <div style={{ backgroundColor: '#fff', padding: '1.2rem', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.06)', borderTop: '5px solid #7c3aed' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, color: '#4c1d95' }}>1. Claves Corrugadora (T*)</h4>
              <label style={{ fontSize: '0.75rem', color: '#475569', cursor: 'pointer', fontWeight: 'bold' }}>
                <input type="checkbox" checked={ocultarClavesVacias} onChange={(e) => setOcultarClavesVacias(e.target.checked)} /> Solo con pendientes
              </label>
            </div>

            {clavesCompatiblesExtra.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fef3c7', border: '1px solid #f59e0b', padding: '5px 8px', borderRadius: '6px', marginBottom: '8px', fontSize: '0.76rem' }}>
                <strong style={{ color: '#92400e' }}>
                  🔗 Mezclando {1 + clavesCompatiblesExtra.length} claves ({[claveSeleccionada, ...clavesCompatiblesExtra].join(' + ')})
                </strong>
                <button type="button" onClick={() => { setClavesCompatiblesExtra([]); setOrdenesSeleccionadasIA([]); setPropuestasIA([]); }} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>
                  ✖ Solo 1
                </button>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {clavesVisibles.map(c => {
                const count = pedidos.filter(p => p.clave_material === c.clave).length;
                const esPrincipal = claveSeleccionada === c.clave;
                const esExtra = clavesCompatiblesExtra.includes(c.clave);
                const activa = esPrincipal || esExtra;
                return (
                  <button
                    key={c.clave}
                    type="button"
                    onClick={() => toggleClaveSeleccionada(c.clave)}
                    style={{
                      padding: '5px 10px', borderRadius: '6px',
                      border: esPrincipal ? '2px solid #7c3aed' : esExtra ? '2px solid #d97706' : '1px solid #cbd5e1',
                      backgroundColor: esPrincipal ? '#ede9fe' : esExtra ? '#fef3c7' : '#f8fafc',
                      color: esPrincipal ? '#5b21b6' : esExtra ? '#92400e' : '#334155',
                      fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer'
                    }}
                    title="Clic para sumar o quitar esta clave en la cola de programación"
                  >
                    {activa ? '✓ ' : ''}{c.clave} ({count})
                  </button>
                );
              })}
            </div>

            {infoClaveActual && (
              <div style={{ backgroundColor: '#f5f3ff', padding: '8px 10px', borderRadius: '6px', fontSize: '0.78rem', marginBottom: '8px', border: '1px solid #ddd6fe' }}>
                <strong>Receta Ideal {infoClaveActual.clave}:</strong> {infoClaveActual.liner_ext_ideal} / {infoClaveActual.medium_ideal} / {infoClaveActual.liner_int_ideal}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '6px 8px', backgroundColor: ordenesSeleccionadasIA.length > 0 ? '#ede9fe' : '#f8fafc', borderRadius: '6px', border: '1px solid #ddd6fe', fontSize: '0.78rem' }}>
              <strong style={{ color: '#4c1d95' }}>
                {ordenesSeleccionadasIA.length > 0
                  ? `🎯 ${ordenesSeleccionadasIA.length} orden(es) elegidas para hoy`
                  : `Evaluando todas (${pedidosFiltradosClave.length})`}
              </strong>
              {ordenesSeleccionadasIA.length > 0 && (
                <button type="button" onClick={() => setOrdenesSeleccionadasIA([])} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.76rem' }}>
                  ✖ Limpiar selección
                </button>
              )}
            </div>

            <div style={{ maxHeight: '560px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cargando ? (
                <p style={{ color: '#64748b', textAlign: 'center' }}>Cargando pedidos...</p>
              ) : pedidosFiltradosClave.length === 0 ? (
                <p style={{ color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>No hay pedidos pendientes para esta clave.</p>
              ) : (
                pedidosFiltradosClave.map(ord => {
                  const estaElegida = ordenesSeleccionadasIA.includes(Number(ord.numero_orden));
                  const totalOrig = Number(ord.planchas_originales) || Number(ord.planchas_necesarias) || 0;
                  const pend = Number(ord.cantidad_pendiente) || 0;
                  const esParcial = totalOrig > 0 && pend < totalOrig;
                  const pctFaltante = totalOrig > 0 ? Math.max(1, Math.round((pend / totalOrig) * 100)) : 100;
                  const pctProg = Math.max(0, 100 - pctFaltante);

                  return (
                    <div
                      key={ord.numero_orden}
                      style={{
                        padding: '10px',
                        borderRadius: '6px',
                        border: estaElegida ? '2px solid #7c3aed' : esParcial ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                        backgroundColor: estaElegida ? '#f5f3ff' : esParcial ? '#fffbeb' : '#fff',
                        fontSize: '0.82rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={estaElegida} onChange={() => toggleSeleccionOrdenIA(ord.numero_orden)} />
                          <strong style={{ color: '#1e40af', fontSize: '0.92rem' }}>#{ord.numero_orden} · {ord.clave_material}</strong>
                        </label>
                        <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.75rem' }}>
                          {ord.ancho_mm} × {ord.largo_mm} mm
                        </span>
                      </div>

                      {esParcial && (
                        <div style={{ marginTop: '5px', backgroundColor: '#ffedd5', color: '#c2410c', border: '1px solid #fb923c', borderRadius: '5px', padding: '4px 8px', fontSize: '0.76rem', fontWeight: 'bold' }}>
                          🟠 Parcial: {pctProg}% prog. · Falta {pctFaltante}% ({pend} de {totalOrig} pl.)
                        </div>
                      )}

                      <div style={{ fontWeight: 'bold', color: '#1e293b', marginTop: '4px' }}>{ord.cliente}</div>
                      <div style={{ color: '#64748b', fontSize: '0.76rem' }}>{ord.producto_descripcion}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #e2e8f0' }}>
                        <span>
                          {esParcial ? 'Restan:' : 'Planchas:'} <strong>{pend}</strong>
                          {esParcial ? ` / ${totalOrig}` : ` (${ord.cantidad_pendiente} caj.)`}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button type="button" onClick={() => { setForzarOrdenId(String(ord.numero_orden)); ejecutarCerebroIA(); }} style={{ padding: '3px 7px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer' }}>
                            🧠 Combinar
                          </button>
                          <button type="button" onClick={() => agregarOrdenAMesaManual(ord)} style={{ padding: '3px 7px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer' }}>
                            + Mesa
                          </button>
                          <button
                            type="button"
                            title="Dar por cumplido / cerrar saldo pendiente"
                            onClick={() => darPorCumplidoPendiente(ord)}
                            style={{ padding: '3px 7px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            ✓ Cumplido
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA: CEREBRO IA / MESA MANUAL + SUSTITUCIÓN DE PAPEL */}
          <div style={{ backgroundColor: '#fff', padding: '1.4rem', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.06)', borderTop: `5px solid ${modoVista === 'IA' ? '#7c3aed' : '#0284c7'}` }}>
            
            {/* PANEL DE OVERRIDE DE PAPEL */}
            <div style={{ backgroundColor: usarPapelAlternativo ? '#fffbeb' : '#f8fafc', border: usarPapelAlternativo ? '2px solid #f59e0b' : '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <label style={{ fontWeight: 'bold', color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={usarPapelAlternativo} onChange={(e) => setUsarPapelAlternativo(e.target.checked)} />
                  🔄 Usar Papel / Gramaje Alternativo Manual (reservar el papel ideal para otro producto)
                </label>

                <label style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#065f46', cursor: 'pointer' }}>
                  <input type="checkbox" checked={habilitarConversionAlAprobar} onChange={(e) => setHabilitarConversionAlAprobar(e.target.checked)} /> Habilitar órdenes en Conversión al aprobar
                </label>
              </div>

              {usarPapelAlternativo && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #f59e0b' }}>
                  {formulasClaveActual.length > 0 && (
                    <div style={{ marginBottom: '10px', backgroundColor: '#fef3c7', padding: '8px 10px', borderRadius: '6px', border: '1px solid #f59e0b' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#92400e', display: 'block', marginBottom: '4px' }}>
                        ⚡ Cargar Fórmula Aprobada de RECETAS.csv ({formulasClaveActual.length} opciones para {claveSeleccionada}):
                      </label>
                      <select
                        defaultValue=""
                        onChange={(e) => aplicarFormulaReceta(e.target.value)}
                        style={{ width: '100%', padding: '7px', borderRadius: '5px', border: '1px solid #d97706', fontWeight: 'bold', fontSize: '0.82rem', backgroundColor: '#fff' }}
                      >
                        <option value="">-- Elegir fórmula Original o Alternativa para pre-cargar bobinas --</option>
                        {formulasClaveActual.map((f, idx) => {
                          const txt = f.es_doble_onda
                            ? `${f.liner_ext} / ${f.onda_1} / ${f.entretapa} / ${f.onda_2} / ${f.liner_int}`
                            : `${f.liner_ext} / ${f.onda_1} / ${f.liner_int}`;
                          return (
                            <option key={f.id} value={f.id}>
                              {f.formula_tipo === 'ORIGINAL' ? '⭐ ORIGINAL' : `🔄 ALT #${idx}`}: {txt}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                  
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${esDobleOndaActual ? 5 : 3}, 1fr)`, gap: '8px', marginBottom: '10px' }}>
                    {[
                      { key: 'liner_ext', label: '1. Liner Ext' },
                      { key: 'onda_1', label: '2. Onda 1' },
                      ...(esDobleOndaActual ? [
                        { key: 'entretapa', label: '3. Entretapa' },
                        { key: 'onda_2', label: '4. Onda 2' }
                      ] : []),
                      { key: 'liner_int', label: esDobleOndaActual ? '5. Liner Int' : '3. Liner Int' }
                    ].map((est) => (
                      <div key={est.key}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '3px', color: '#92400e' }}>
                          {est.label}:
                        </label>
                        <select
                          value={portabobinasManual[est.key] || ''}
                          onChange={(e) => setPortabobinasManual({ ...portabobinasManual, [est.key]: e.target.value })}
                          style={{ width: '100%', padding: '7px 5px', borderRadius: '5px', border: '1px solid #f59e0b', fontSize: '0.78rem', fontWeight: 'bold', backgroundColor: '#fff' }}
                        >
                          <option value="">-- Ideal de clave --</option>
                          {obtenerPapelesOrdenados(est.key).map((pap) => (
                            <option key={`${pap.codigo}-${pap.ancho_mm || 0}`} value={pap.codigo}>
                              {pap.codigo} · {pap.ancho_mm ? `[${pap.ancho_mm}mm] ` : ''}{pap.nombre} ({Math.round(pap.stock_kg)} kg)
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                      Motivo / Reserva de Stock (Auditoría):
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Falta Testliner 145g, usamos Kraft Misionero 125g..."
                      value={motivoAlternativa}
                      onChange={(e) => setMotivoAlternativa(e.target.value)}
                      style={{ width: '100%', padding: '7px', borderRadius: '5px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* MODO 1: SUGERENCIAS DE LA IA */}
            {modoVista === 'IA' && (
              <>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'end', flexWrap: 'wrap', marginBottom: '1.2rem', backgroundColor: '#f5f3ff', padding: '12px', borderRadius: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Trim Máx (%):</label>
                    <input type="number" step="0.5" min="0.5" max="15" value={trimMaxPct} onChange={(e) => setTrimMaxPct(e.target.value)} style={{ width: '85px', padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontWeight: 'bold' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Forzar Bobina (Opcional):</label>
                    <select value={forzarAnchoBobina} onChange={(e) => setForzarAnchoBobina(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>
                      <option value="">-- Todas las activas --</option>
                      {anchosActivos.map(a => <option key={a} value={a}>{a} mm</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Incluir Orden # (Opcional):</label>
                    <input type="number" placeholder="Ej: 48341" value={forzarOrdenId} onChange={(e) => setForzarOrdenId(e.target.value)} style={{ width: '110px', padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1' }} />
                  </div>
                  <button type="button" onClick={ejecutarCerebroIA} disabled={calculandoIA} style={{ padding: '9px 18px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.92rem' }}>
                    {calculandoIA ? '⏳ Calculando Trim...' : '⚡ Calcular Combinaciones Óptimas'}
                  </button>
                </div>

                {propuestasIA.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🤖</div>
                    <h4 style={{ margin: '0 0 6px 0', color: '#334155' }}>Listo para optimizar {[claveSeleccionada, ...clavesCompatiblesExtra].filter(Boolean).join(' + ')}</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem' }}>Presioná <strong>"Calcular Combinaciones Óptimas"</strong> para cruzar bobinas, slitter (máx. 5) y guillotina (máx. 2).</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {propuestasIA.map((prop, idx) => (
                      <div key={idx} style={{ border: '2px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', backgroundColor: idx === 0 ? '#f0fdf4' : '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ backgroundColor: '#4c1d95', color: '#fff', padding: '3px 9px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 'bold' }}>Score IA: {prop.score_ia}/100</span>
                            <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>Bobina {prop.ancho_bobina_mm} mm</strong>
                            <span style={{ color: colorTrim(prop.trim_porcentaje), fontWeight: 'bold', fontSize: '0.9rem' }}>· Trim: {prop.trim_mm} mm ({prop.trim_porcentaje}%)</span>
                            <span style={{ color: '#0284c7', fontWeight: 'bold', fontSize: '0.9rem' }}>· Corrida: {prop.metros_lineales} mts</span>
                            {prop.consumo_estimado_kg > 0 && <span style={{ color: '#475569', fontWeight: 'bold', fontSize: '0.85rem' }}>· ~{prop.consumo_estimado_kg} kg</span>}
                          </div>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button type="button" onClick={() => llevarPropuestaAMesaManual(prop)} style={{ padding: '6px 10px', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #0284c7', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}>✏️ Retocar en Mesa</button>
                            <button type="button" onClick={() => aprobarTirada(prop)} style={{ padding: '6px 14px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.82rem', cursor: 'pointer' }}>🚀 Aprobar Tirada</button>
                          </div>
                        </div>

                        <div style={{ width: '100%', height: '22px', backgroundColor: '#fee2e2', borderRadius: '6px', overflow: 'hidden', display: 'flex', marginBottom: '8px', border: '1px solid #cbd5e1' }}>
                          {prop.pistas.map((p, iP) => (
                            <div key={iP} style={{ width: `${(p.ancho_ocupado_mm / prop.ancho_bobina_mm) * 100}%`, backgroundColor: iP === 0 ? '#2563eb' : '#0d9488', color: '#fff', fontSize: '0.74rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '2px solid #fff' }}>
                              #{p.numero_orden} ({p.salidas}×{p.ancho_mm}mm)
                            </div>
                          ))}
                          <div style={{ flex: 1, fontSize: '0.7rem', color: '#991b1b', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{prop.trim_mm}mm</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px', fontSize: '0.8rem' }}>
                          {prop.pistas.map((p, iP) => (
                            <div key={iP} style={{ backgroundColor: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              <strong>OP #{p.numero_orden}</strong> ({p.cliente}) — {p.salidas} salida(s) · <strong>{p.planchas_tirada}</strong> planchas ({p.cumplimiento_pct}% del pedido)
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* MODO 2: MESA MANUAL / OVERRIDE DEL PROGRAMADOR */}
            {modoVista === 'MANUAL' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, color: '#0369a1' }}>
                    {editandoProgramaId ? `✏️ Editando Combinación de Tirada #${editandoProgramaId}` : '🛠️ Mesa Manual de Combinación de Bobina y Pistas'}
                  </h4>
                  {editandoProgramaId && (
                    <button type="button" onClick={() => setEditandoProgramaId(null)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 'bold', cursor: 'pointer' }}>
                      ✖ Cancelar edición
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem', backgroundColor: '#f0f9ff', padding: '12px', borderRadius: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block' }}>Bobina Madre (mm):</label>
                    <select value={bobinaManual} onChange={e => setBobinaManual(Number(e.target.value))} style={{ padding: '8px', borderRadius: '5px', border: '2px solid #0284c7', fontWeight: 'bold', fontSize: '1rem' }}>
                      {anchos.map(a => <option key={a.id} value={a.ancho_mm}>{a.ancho_mm} mm</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block' }}>Metros Lineales a Correr:</label>
                    <input type="number" min="10" value={metrosManuales} onChange={e => setMetrosManuales(Number(e.target.value))} style={{ width: '120px', padding: '8px', borderRadius: '5px', border: '1px solid #0284c7', fontWeight: 'bold', fontSize: '1rem' }} />
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.82rem', color: '#475569', display: 'block' }}>Ancho Ocupado: <strong>{anchoOcupadoManual} / {bobinaManual} mm</strong></span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: colorTrim(trimManualPct) }}>
                      {trimManualMm < 0 ? `❌ EXCEDE ANCHO POR ${Math.abs(trimManualMm)} mm` : `Trim Resultante: ${trimManualMm} mm (${trimManualPct}%)`}
                    </span>
                  </div>
                </div>

                {pistasManuales.length === 0 ? (
                  <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem', border: '2px dashed #cbd5e1', borderRadius: '8px' }}>
                    Hacé clic en <strong>"+ Mesa"</strong> en cualquier pedido de la columna izquierda para armar tu combinación manual.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
                    {pistasManuales.map((pm, idx) => {
                      const planchasTirada = Math.floor((metrosManuales * 1000) / (pm.orden.largo_mm || 1000)) * pm.salidas;
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                          <div>
                            <strong>#{pm.orden.numero_orden}</strong> · {pm.orden.cliente} ({pm.orden.ancho_mm}×{pm.orden.largo_mm} mm · Clave {pm.orden.clave_material})
                            <div style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 'bold' }}>Produce {planchasTirada} planchas en {metrosManuales} mts</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button type="button" onClick={() => cambiarSalidasManual(idx, -1)} style={{ padding: '4px 9px', fontWeight: 'bold' }}>-</button>
                            <strong>{pm.salidas} salida(s) = {pm.orden.ancho_mm * pm.salidas} mm</strong>
                            <button type="button" onClick={() => cambiarSalidasManual(idx, 1)} style={{ padding: '4px 9px', fontWeight: 'bold' }}>+</button>
                            <button type="button" onClick={() => quitarPistaManual(idx)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 'bold', cursor: 'pointer', marginLeft: '6px' }}>✖</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {pistasManuales.length > 0 && trimManualMm >= 0 && (
                  <button
                    type="button"
                    onClick={() => aprobarTirada({
                      clave_material: pistasManuales[0].orden.clave_material,
                      ancho_bobina_mm: bobinaManual,
                      ancho_utilizado_mm: anchoOcupadoManual,
                      trim_mm: trimManualMm,
                      trim_porcentaje: trimManualPct,
                      metros_lineales: metrosManuales,
                      pistas: pistasManuales.map(pm => ({
                        numero_orden: pm.orden.numero_orden,
                        cliente: pm.orden.cliente,
                        ancho_mm: pm.orden.ancho_mm,
                        largo_mm: pm.orden.largo_mm,
                        salidas: pm.salidas,
                        ancho_ocupado_mm: pm.orden.ancho_mm * pm.salidas,
                        planchas_tirada: Math.floor((metrosManuales * 1000) / (pm.orden.largo_mm || 1000)) * pm.salidas
                      }))
                    })}
                    style={{ width: '100%', padding: '12px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}
                  >
                    {editandoProgramaId ? '💾 Guardar Cambio de Combinación' : '🚀 Aprobar Tirada Manual y Enviar a Corrugadora'}
                  </button>
                )}
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}