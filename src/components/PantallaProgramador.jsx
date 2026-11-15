import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { apiFetch } from '../services/api'; // 👈 IMPORTACIÓN CENTRALIZADA

// 🎯 Agrupa cualquier sub-ruta exclusivamente en las 3 líneas de Conversión: JS, Ward y SS
const obtenerFamiliaRuta = (ruta) => {
  if (!ruta) return null;
  const limpia = String(ruta).trim().toUpperCase();
  if (limpia.includes('JS')) return 'COR-JS';
  if (limpia.includes('WAR')) return 'COR-WAR';
  if (limpia.includes('COR-SS') || limpia === 'SS' || limpia.endsWith('-SS')) return 'COR-SS';
  return null; // Excluye MAC, FOC1, FOC2, MAQ3, ESQ, REB, IMP, DIV, COR-DIV, COR-TER
};

const ORDEN_FAMILIAS_CONVERSION = ['COR-JS', 'COR-SS', 'COR-WAR'];

export default function PantallaProgramador() {
  const [pedidos, setPedidos] = useState([]);
  const [pedidosOcultos, setPedidosOcultos] = useState([]); // 📦 Guarda las cerradas para poder revivirlas si hace falta
  const [mostrarCerradas, setMostrarCerradas] = useState(false); // 🚑 Interruptor para ver/rescatar órdenes cerradas
  const [archivo, setArchivo] = useState(null);
  const [filtroMaquina, setFiltroMaquina] = useState('TODAS');

  // 🛠️ Mapa en vivo del estado de Clisés y Troqueles desde Alistamiento (Poka-Yoke)
  const [mapaHerramentales, setMapaHerramentales] = useState({});

  // 🚀 Estado de la Barra de Progreso Turbo Batch
  const [progresoCarga, setProgresoCarga] = useState({
    activo: false,
    porcentaje: 0,
    detalle: ''
  });

  const cargarPedidosDesdeBD = async () => {
    try {
      const [respuesta, resRadar] = await Promise.all([
        apiFetch('/api/pedidos'),
        apiFetch('/api/herramentales/radar-cola').catch(() => null)
      ]);

      if (resRadar && resRadar.ok) {
        const dataRadar = await resRadar.json();
        const nuevoMapa = {};
        dataRadar.forEach(item => {
          nuevoMapa[String(item.numero_orden)] = item;
        });
        setMapaHerramentales(nuevoMapa);
      }

      if (respuesta.ok) {
        const data = await respuesta.json();
        
        // 🎯 ESTADOS QUE YA NO DEBEN APARECER EN LA COLA ACTIVA
        const ESTADOS_OCULTOS = ['FINALIZADA', 'CERRADO POR ACUERDO', 'CUMPLIDA', 'COMPLETADA', 'CERRADA'];

        const formatear = (p) => ({
          id: p.id,
          cliente: p.cliente || 'Sin cliente',
          producto: p.descripcion_producto || p.producto_descripcion || 'Sin descripción',
          estado: p.estado || 'Pendiente',
          maquina: p.maquina_asignada || 'COR-JS',
          prioridad: p.prioridad_secuencia || 999,
          cantidad_programada: Number(p.cantidad_programada) || 0,
          cantidad_fabricada: Number(p.cantidad_fabricada) || 0,
          cantidad_faltante: Number(p.cantidad_faltante) || 0
        });

        const activos = [];
        const cerrados = [];

        data.forEach(p => {
          const item = formatear(p);
          if (!obtenerFamiliaRuta(item.maquina)) return;

          const est = item.estado.trim().toUpperCase();
          if (ESTADOS_OCULTOS.includes(est)) {
            cerrados.push(item);
          } else {
            activos.push(item);
          }
        });

        activos.sort((a, b) => a.prioridad - b.prioridad);
        cerrados.sort((a, b) => b.id - a.id);

        setPedidos(activos);
        setPedidosOcultos(cerrados);
      }
    } catch (error) {
      console.error('Error al cargar la BD:', error);
    }
  };

  useEffect(() => {
    cargarPedidosDesdeBD();
  }, []);

  // 🛡️ Función auxiliar que envía una petición con reintento automático si el Wi-Fi parpadea
  const enviarConReintento = async (url, opciones, reintentos = 3) => {
    for (let intento = 1; intento <= reintentos; intento++) {
      try {
        const res = await apiFetch(url, opciones);
        return res;
      } catch (err) {
        if (intento === reintentos) throw err;
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  };

  // 🚑 RESCATAR / REVIVIR ORDEN CERRADA EN CERO O POR ERROR
  const revivirOrden = async (pedido) => {
    const confirmar = window.confirm(
      `🚑 ¿Desea REVIVIR la orden #${pedido.id} (${pedido.cliente})?\n\n` +
      `• Se retirará de Expedición.\n` +
      `• Volverá a la cola activa como "Pendiente" (contador en 0) para enviarla nuevamente a ${pedido.maquina}.`
    );
    if (!confirmar) return;

    try {
      const respuesta = await apiFetch(`/api/pedidos/${pedido.id}/revivir`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetear_cantidades: true })
      });

      if (respuesta.ok) {
        alert(`✅ Orden #${pedido.id} revivida con éxito y devuelta a la cola activa.`);
        cargarPedidosDesdeBD();
      } else {
        alert('❌ Error al intentar revivir la orden.');
      }
    } catch (error) {
      console.error('Error de conexión al revivir orden:', error);
    }
  };

  // 🎯 GESTIÓN DE DECISIÓN COMERCIAL SOBRE EL SALDO FALTANTE
  const gestionarFaltante = async (pedido, decision) => {
    if (decision === 'reprogramar') {
      const confirmar = window.confirm(`¿Desea reasignar el saldo pendiente de ${pedido.cantidad_faltante} cajas para la orden #${pedido.id}?`);
      if (!confirmar) return;

      try {
        const respuesta = await apiFetch(`/api/pedidos/${pedido.id}/reprogramar-faltante`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cantidad_faltante: pedido.cantidad_faltante })
        });
        if (respuesta.ok) {
          alert("✅ Saldo pendiente reprogramado con éxito en la cola de producción.");
          cargarPedidosDesdeBD();
        } else {
          alert("❌ Error al reprogramar el faltante.");
        }
      } catch (error) {
        console.error("Error de conexión:", error);
      }
    } else if (decision === 'cerrar') {
      const confirmar = window.confirm(`¿Seguro que desea dar por cerrado y archivado el faltante de la orden #${pedido.id} por acuerdo comercial?`);
      if (!confirmar) return;

      try {
        const respuesta = await apiFetch(`/api/pedidos/${pedido.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'Cerrado por Acuerdo' })
        });
        if (respuesta.ok) {
          alert("📁 Orden archivada sin pendientes.");
          cargarPedidosDesdeBD();
        } else {
          alert("❌ Error al archivar la orden.");
        }
      } catch (error) {
        console.error("Error de conexión:", error);
      }
    }
  };

  // Lista base filtrada exclusivamente para las 3 máquinas de Conversión
  const listaBase = (mostrarCerradas ? pedidosOcultos : pedidos).filter(
    p => obtenerFamiliaRuta(p.maquina) !== null
  );

  // 🎯 EXTRAER RUTAS EXACTAS DE CONVERSIÓN (Para el desplegable <select> de cada orden)
  const rutasUnicasPlanta = Array.from(
    new Set([
      ...ORDEN_FAMILIAS_CONVERSION,
      ...[...pedidos, ...pedidosOcultos]
        .map(p => (p.maquina ? p.maquina.trim().toUpperCase() : ''))
        .filter(m => m && isNaN(m) && !m.includes(',') && obtenerFamiliaRuta(m) !== null)
    ])
  ).sort();

  // 🎯 CONTAR ÓRDENES POR CADA UNA DE LAS 3 LÍNEAS DE CONVERSIÓN (COR-JS, COR-SS, COR-WAR)
  const conteoPorFamilia = {
    'COR-JS': 0,
    'COR-SS': 0,
    'COR-WAR': 0
  };
  listaBase.forEach(p => {
    const fam = obtenerFamiliaRuta(p.maquina);
    if (fam && conteoPorFamilia[fam] !== undefined) {
      conteoPorFamilia[fam] += 1;
    }
  });

  // 🚀 IMPORTADOR TURBO POR LOTES (CON BARRA DE PROGRESO Y REINTENTO ANTI-CORTE WI-FI)
  const procesarCSV = (e) => {
    e.preventDefault();
    if (!archivo || progresoCarga.activo) return;

    const procesarTextoCSV = async (textoRaw) => {
      const texto = String(textoRaw || '').replace(/^\uFEFF/, '');
      const lineas = texto.split(/\r\n|\n/);

      let inicioDatos = -1;
      let tipoArchivo = null;
      let indicesCols = { colsColores: [] };

      const normalizar = (str) =>
        String(str || '')
          .replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '')
          .replace(/"/g, '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();

      const detectarColumnasColor = (cols) => {
        const colsColores = [];
        cols.forEach((h, idx) => {
          const cleanH = normalizar(h);
          if (
            cleanH === 'colores' ||
            cleanH.includes('color') ||
            cleanH.includes('tinta') ||
            cleanH.includes('impresi') ||
            /^c[1-6]$/.test(cleanH)
          ) {
            colsColores.push(idx);
          }
        });
        return colsColores;
      };

      for (let i = 0; i < Math.min(15, lineas.length); i++) {
        if (!lineas[i].trim()) continue;
        const cols = lineas[i].split(';');
        if (cols.length < 4) continue;

        const lineaNorm = normalizar(lineas[i]);

        // 1. DETECCIÓN DE MAESTRO_PEDIDOS.CSV
        if (lineaNorm.includes('fecha pedido') || lineaNorm.includes('fecha entrega') || lineaNorm.includes('m2 pend')) {
          tipoArchivo = 'PEDIDOS';
          indicesCols.colsColores = detectarColumnasColor(cols);
          cols.forEach((h, idx) => {
            const cleanH = normalizar(h);
            if (idx === 0 || cleanH.includes('numero') || cleanH === 'nro') indicesCols.numero = idx;
            if (cleanH === 'fecha pedido' || idx === 1) indicesCols.fecha_pedido = idx;
            if (cleanH === 'fecha entrega' || idx === 2) indicesCols.fecha_entrega = idx;
            if (cleanH === 'cliente' || idx === 5) indicesCols.cliente = idx;
            if (cleanH === 'rubro' || idx === 6) indicesCols.rubro = idx;
            if ((cleanH.includes('producto') && cleanH.includes('cod')) || idx === 10) indicesCols.codigo_producto = idx;
            if (cleanH.startsWith('descripci') || idx === 13) indicesCols.descripcion = idx;
            if (cleanH === 'largo' || idx === 17) indicesCols.largo = idx;
            if (cleanH === 'ancho' || idx === 18) indicesCols.ancho = idx;
            if (cleanH === 'plancha' || idx === 19) indicesCols.plancha = idx;
            if (cleanH === 'cant.' || cleanH === 'cantidad' || idx === 20) indicesCols.cantidad = idx;
            if (cleanH.includes('tot') && cleanH.startsWith('m')) indicesCols.m2_tot = idx;
            if (cleanH.includes('pend') && cleanH.startsWith('m')) indicesCols.m2_pend = idx;
            if (cleanH === 'peso' || idx === 26) indicesCols.peso = idx;
            if (cleanH === 'bocas' || idx === 27) indicesCols.bocas = idx;
            if (cleanH === 'ruta' || idx === 39) indicesCols.ruta = idx;
          });
          inicioDatos = i + 1;
          break;
        }

        // 2. DETECCIÓN DE MAESTRO_PRODUCTOS.CSV (30 Columnas)
        if (
          lineaNorm.includes('rubro comercial') ||
          lineaNorm.includes('troquel') ||
          lineaNorm.includes('codigo') ||
          lineaNorm.includes('cliente')
        ) {
          tipoArchivo = 'PRODUCTOS';
          indicesCols.colsColores = detectarColumnasColor(cols);
          indicesCols = {
            ...indicesCols,
            codigo_producto: 0,
            cliente: 4,
            descripcion: 5,
            plano: 8,
            troquel: 9,
            ubic_troquel: 10,
            material: 11,
            clise: 15,
            ubic_clise: 16,
            largo: 17,
            ancho: 18,
            superficie_m2: 19,
            ruta: 21,
            bocas: 22
          };

          cols.forEach((h, idx) => {
            const cleanH = normalizar(h);
            if (idx === 0 || (cleanH === 'codigo' && !cleanH.includes('cliente'))) {
              indicesCols.codigo_producto = idx;
            }
            if (cleanH === 'cliente') indicesCols.cliente = idx;
            if (cleanH.startsWith('descripci')) indicesCols.descripcion = idx;
            if (cleanH === 'plano') indicesCols.plano = idx;
            if (cleanH === 'troquel') indicesCols.troquel = idx;
            if (cleanH.includes('ubic') && cleanH.includes('troquel')) indicesCols.ubic_troquel = idx;
            if (cleanH === 'corrugado' || cleanH.includes('material')) indicesCols.material = idx;
            if ((cleanH.startsWith('clis') || cleanH === 'clise') && !cleanH.includes('ubic')) indicesCols.clise = idx;
            if (cleanH.includes('ubic') && cleanH.includes('clis')) indicesCols.ubic_clise = idx;
            if (cleanH === 'largo') indicesCols.largo = idx;
            if (cleanH === 'ancho') indicesCols.ancho = idx;
            if (cleanH.includes('m2') || cleanH.includes('superficie') || idx === 19) indicesCols.superficie_m2 = idx;
            if (cleanH === 'ruta') indicesCols.ruta = idx;
            if (cleanH === 'bocas') indicesCols.bocas = idx;
          });
          inicioDatos = i + 1;
          break;
        }
      }

      if (inicioDatos === -1) {
        alert('❌ No se encontró una cabecera válida en el archivo CSV.');
        return;
      }

      const limpiarNum = (val) => {
        if (!val) return null;
        const n = parseFloat(String(val).replace(/"/g, '').replace(/\./g, '').replace(',', '.').trim());
        return isNaN(n) ? null : n;
      };

      const extraerColoresDeFila = (cols) => {
        let encontrados = [];

        if (indicesCols.colsColores && indicesCols.colsColores.length > 0) {
          indicesCols.colsColores.forEach(idx => {
            const val = String(cols[idx] || '').replace(/"/g, '').trim();
            if (val && val !== '-' && val !== '0' && val.toUpperCase() !== 'NO' && val.toUpperCase() !== 'NULL') {
              val.split(/[,;/]/).forEach(sub => {
                const limpio = sub.trim();
                if (limpio) encontrados.push(limpio);
              });
            }
          });
        }

        if (encontrados.length === 0) {
          const patronTinta = /^(GCMI\s*\d+|PU\s*\d+|NEGRO.*|NEG\s+.*|MAGENTA|CYAN.*|AMA\s+PROC|BARNIZ|VIOLETA|VER\s+LIM|CEL\s+LED|GRIS\s+.*|AZUL\s+.*|COOL\s+GRAY.*)/i;
          cols.forEach((celda, idx) => {
            if (idx === indicesCols.descripcion || idx === indicesCols.cliente) return;
            const val = String(celda || '').replace(/"/g, '').trim();
            if (patronTinta.test(val)) {
              encontrados.push(val.toUpperCase());
            }
          });
        }

        const unicos = encontrados.slice(0, 6);
        return {
          colores: unicos.join(', ') || null,
          color_1: unicos[0] || null,
          color_2: unicos[1] || null,
          color_3: unicos[2] || null,
          color_4: unicos[3] || null,
          color_5: unicos[4] || null,
          color_6: unicos[5] || null
        };
      };

      // 🚀 CARGA TURBO POR LOTES DE PRODUCTOS (400 POR LOTE)
      if (tipoArchivo === 'PRODUCTOS') {
        const payloadProductos = [];
        for (let i = inicioDatos; i < lineas.length; i++) {
          if (!lineas[i].trim()) continue;
          const cols = lineas[i].split(';');
          const codProd = cols[indicesCols.codigo_producto ?? 0]?.replace(/"/g, '').trim();
          if (!codProd || codProd.startsWith('!')) continue;

          const infoColores = extraerColoresDeFila(cols);
          const troqVal = cols[indicesCols.troquel ?? 9]?.replace(/"/g, '').trim() || null;
          const cliseVal = cols[indicesCols.clise ?? 15]?.replace(/"/g, '').trim() || null;

          payloadProductos.push({
            codigo_producto: codProd,
            cliente: cols[indicesCols.cliente ?? 4]?.replace(/"/g, '').trim() || null,
            descripcion: cols[indicesCols.descripcion ?? 5]?.replace(/"/g, '').trim() || null,
            plano: cols[indicesCols.plano ?? 8]?.replace(/"/g, '').trim() || null,
            troquel: troqVal,
            ubic_troquel: cols[indicesCols.ubic_troquel ?? 10]?.replace(/"/g, '').trim() || null,
            material: cols[indicesCols.material ?? 11]?.replace(/"/g, '').trim() || null,
            clise: cliseVal,
            ubic_clise: cols[indicesCols.ubic_clise ?? 16]?.replace(/"/g, '').trim() || null,
            herramientas: [troqVal, cliseVal].filter(Boolean).join(' | ') || null,
            largo_mm: limpiarNum(cols[indicesCols.largo ?? 17]),
            ancho_mm: limpiarNum(cols[indicesCols.ancho ?? 18]),
            superficie_m2: limpiarNum(cols[indicesCols.superficie_m2 ?? 19]),
            ruta_sugerida: cols[indicesCols.ruta ?? 21]?.replace(/"/g, '').trim() || 'COR-JS',
            bocas: parseInt(cols[indicesCols.bocas ?? 22]?.replace(/"/g, '').trim(), 10) || 1,
            ...infoColores
          });
        }

        const TAMANO_LOTE = 400;
        const totalLotes = Math.ceil(payloadProductos.length / TAMANO_LOTE);
        let totalInsertados = 0;
        let totalOmitidos = 0;
        let resumenFinalHerramentales = '';

        try {
          for (let idxLote = 0; idxLote < totalLotes; idxLote++) {
            const inicio = idxLote * TAMANO_LOTE;
            const lote = payloadProductos.slice(inicio, inicio + TAMANO_LOTE);
            const esUltimoLote = idxLote === totalLotes - 1;
            const pct = Math.round(((idxLote + 1) / totalLotes) * 100);

            setProgresoCarga({
              activo: true,
              porcentaje: pct,
              detalle: esUltimoLote
                ? `🔄 Lote final (${idxLote + 1}/${totalLotes}) y actualizando Clisés y Troqueles...`
                : `📦 Subiendo productos: ${Math.min(inicio + TAMANO_LOTE, payloadProductos.length)} de ${payloadProductos.length} (${pct}%)`
            });

            const respuesta = await enviarConReintento('/api/productos/sincronizar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productos: lote,
                omitir_herramentales: !esUltimoLote
              }),
            });

            const resultado = await respuesta.json();
            if (!respuesta.ok) {
              throw new Error(resultado.error || 'Error en lote de productos');
            }

            totalInsertados += Number(resultado.insertados || lote.length);
            totalOmitidos += Number(resultado.omitidos || 0);
            if (resultado.resumenHerramentales) {
              resumenFinalHerramentales = resultado.resumenHerramentales;
            }
          }

          setProgresoCarga({ activo: false, porcentaje: 0, detalle: '' });
          alert(
            `✅ [Base de PRODUCTOS Sincronizada]\n` +
            `📦 Productos procesados: ${totalInsertados}\n` +
            `⚠️ Omitidos: ${totalOmitidos}` +
            `${resumenFinalHerramentales}`
          );
          cargarPedidosDesdeBD();
        } catch (error) {
          setProgresoCarga({ activo: false, porcentaje: 0, detalle: '' });
          alert(`❌ Error al subir Productos: ${error.message}`);
        }
        return;
      }

      // PROCESAMIENTO DE MAESTRO_PEDIDOS.CSV
      const payloadPedidos = [];
      const productosDesdePedidosMap = new Map();

      for (let i = inicioDatos; i < lineas.length; i++) {
        if (!lineas[i].trim()) continue;
        const cols = lineas[i].split(';');

        const rawOrden = String(cols[0] || '').replace(/"/g, '').replace(/\./g, '').trim();
        const numOrden = parseInt(rawOrden, 10);

        if (!numOrden || isNaN(numOrden) || numOrden <= 0 || numOrden > 999999) continue;

        const codProd = cols[indicesCols.codigo_producto ?? 10]?.replace(/"/g, '').trim();
        const cantProg = limpiarNum(cols[indicesCols.cantidad ?? 20]) || 0;
        const rutaVal = cols[indicesCols.ruta ?? 39]?.replace(/"/g, '').trim() || '';
        const clienteVal = cols[indicesCols.cliente ?? 5]?.replace(/"/g, '').trim() || null;
        const descVal = cols[indicesCols.descripcion ?? 13]?.replace(/"/g, '').trim() || null;
        const largoVal = limpiarNum(cols[indicesCols.largo ?? 17]);
        const anchoVal = limpiarNum(cols[indicesCols.ancho ?? 18]);
        const bocasPed = parseInt(cols[indicesCols.bocas ?? 27]?.replace(/"/g, '').trim(), 10) || null;

        const infoColores = extraerColoresDeFila(cols);

        if (cantProg > 0) {
          payloadPedidos.push({
            numero_orden: numOrden,
            codigo_producto: codProd || 'SIN_CODIGO',
            cantidad_programada: cantProg,
            fecha_pedido: cols[indicesCols.fecha_pedido ?? 1]?.replace(/"/g, '').trim() || null,
            fecha_entrega: cols[indicesCols.fecha_entrega ?? 2]?.replace(/"/g, '').trim() || null,
            cliente: clienteVal,
            rubro: cols[indicesCols.rubro ?? 6]?.replace(/"/g, '').trim() || null,
            descripcion: descVal,
            largo: largoVal,
            ancho: anchoVal,
            plancha: cols[indicesCols.plancha ?? 19]?.replace(/"/g, '').trim() || null,
            m2_tot: limpiarNum(cols[indicesCols.m2_tot ?? 21]),
            m2_pend: limpiarNum(cols[indicesCols.m2_pend ?? 22]),
            peso: limpiarNum(cols[indicesCols.peso ?? 26]),
            maquina_asignada: rutaVal,
            ...infoColores
          });

          if (codProd && codProd !== 'SIN_CODIGO') {
            productosDesdePedidosMap.set(codProd, {
              codigo_producto: codProd,
              cliente: clienteVal,
              descripcion: descVal,
              largo_mm: largoVal,
              ancho_mm: anchoVal,
              ruta_sugerida: rutaVal || 'COR-JS',
              bocas: bocasPed,
              ...infoColores
            });
          }
        }
      }

      try {
        setProgresoCarga({
          activo: true,
          porcentaje: 50,
          detalle: `📋 Sincronizando ${payloadPedidos.length} órdenes de producción...`
        });

        if (productosDesdePedidosMap.size > 0) {
          await enviarConReintento('/api/productos/sincronizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productos: Array.from(productosDesdePedidosMap.values()),
              omitir_herramentales: true
            })
          }).catch(() => {});
        }

        const respuesta = await enviarConReintento('/api/pedidos/sincronizar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pedidos: payloadPedidos }),
        });

        const resultado = await respuesta.json();
        setProgresoCarga({ activo: false, porcentaje: 0, detalle: '' });

        if (respuesta.ok) {
          alert(`✅ [Base de PEDIDOS]\n${resultado.mensaje}`);
          cargarPedidosDesdeBD();
        } else {
          alert(`❌ Error en BD Pedidos: ${resultado.error}`);
        }
      } catch (error) {
        setProgresoCarga({ activo: false, porcentaje: 0, detalle: '' });
        alert('❌ Error crítico de conexión con el servidor.');
      }
    };

    const lectorUTF8 = new FileReader();
    lectorUTF8.onload = (ev) => {
      const contenido = String(ev.target.result || '');
      if (contenido.includes('\uFFFD')) {
        const lectorISO = new FileReader();
        lectorISO.onload = (ev2) => procesarTextoCSV(ev2.target.result);
        lectorISO.readAsText(archivo, 'ISO-8859-1');
      } else {
        procesarTextoCSV(contenido);
      }
    };
    lectorUTF8.readAsText(archivo, 'UTF-8');
  };

  const cambiarMaquina = async (id, nuevaMaquina) => {
    const actualizarLista = (lista) => lista.map(p => p.id === id ? { ...p, maquina: nuevaMaquina } : p);
    setPedidos(actualizarLista);
    setPedidosOcultos(actualizarLista);

    try {
      await apiFetch(`/api/pedidos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maquina_asignada: nuevaMaquina }),
      });
    } catch (error) {
      console.error('Error al actualizar máquina en BD', error);
    }
  };

  const habilitarOrden = async (id) => {
    const pedidoAEnviar = pedidos.find(p => p.id === id);
    if (!pedidoAEnviar || !pedidoAEnviar.maquina) {
      alert("⚠️ Debe asignar una Máquina Destino antes de enviar la orden a planta.");
      return;
    }

    // 🛡️ POKA-YOKE: Verificamos si Alistamiento reportó el Clisé o Troquel en Taller / Reparación
    const infoHerr = mapaHerramentales[String(id)];
    if (infoHerr) {
      const cliseEnTaller = infoHerr.estado_alistamiento_clise === 'En Reparación';
      const troquelEnTaller = infoHerr.estado_alistamiento_troquel === 'En Reparación';

      if (cliseEnTaller || troquelEnTaller) {
        const alertaTaller = window.confirm(
          `🚨 ALERTA POKA-YOKE DE ALISTAMIENTO (Orden #${id}):\n\n` +
          `${cliseEnTaller ? `• El Clisé (${infoHerr.codigo_clise}) figura EN REPARACIÓN / FALTANTE.\n` : ''}` +
          `${troquelEnTaller ? `• El Troquel (${infoHerr.codigo_troquel}) figura EN REPARACIÓN / TALLER.\n` : ''}\n` +
          `¿Seguro que querés enviar esta orden a ${pedidoAEnviar.maquina} de todos modos?`
        );
        if (!alertaTaller) return;
      }
    }

    const nuevosPedidos = pedidos.map(p => p.id === id ? { ...p, estado: 'Habilitada' } : p);
    setPedidos(nuevosPedidos);

    try {
      await apiFetch(`/api/pedidos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          estado: 'Habilitada',
          maquina_asignada: pedidoAEnviar.maquina
        }),
      });
    } catch (error) {
      console.error('Error al habilitar orden en BD', error);
    }
  };

  // 🎯 DAR POR CUMPLIDA MANUALMENTE UNA ORDEN HABILITADA (O DE PRUEBA) Y QUITARLA DE LA COLA
  const darPorCumplida = async (pedido) => {
    const confirmar = window.confirm(`¿Confirmás que la orden #${pedido.id} (${pedido.cliente}) ya fue fabricada/cumplida? Se quitará de la cola activa.`);
    if (!confirmar) return;

    setPedidos(prev => prev.filter(p => p.id !== pedido.id));

    try {
      const respuesta = await apiFetch(`/api/pedidos/${pedido.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'Finalizada' }),
      });
      if (!respuesta.ok) {
        alert('❌ Error al actualizar el estado en la BD.');
      }
      cargarPedidosDesdeBD();
    } catch (error) {
      console.error('Error al dar por cumplida la orden:', error);
      cargarPedidosDesdeBD();
    }
  };

  // 🦅 DRAG AND DROP BLINDADO (Funciona perfectamente con filtros de familia activos)
  const handleDragEnd = async (resultado) => {
    if (mostrarCerradas || !resultado.destination) return;

    const sourceIndex = resultado.source.index;
    const destIndex = resultado.destination.index;

    if (sourceIndex === destIndex) return;

    const itemsFiltrados = Array.from(pedidosFiltrados);
    const [movido] = itemsFiltrados.splice(sourceIndex, 1);
    itemsFiltrados.splice(destIndex, 0, movido);

    const idsFiltradosSet = new Set(pedidosFiltrados.map(p => p.id));
    const restoPedidos = pedidos.filter(p => !idsFiltradosSet.has(p.id));
    
    const nuevaListaGlobal = [...itemsFiltrados, ...restoPedidos];
    setPedidos(nuevaListaGlobal);

    const payload = nuevaListaGlobal.map((item, index) => ({
      id: item.id,
      prioridad: index + 1
    }));

    try {
      await apiFetch('/api/pedidos/reordenar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuevoOrden: payload })
      });
    } catch (error) {
      console.error("Error al guardar el nuevo orden en BD", error);
    }
  };

  // ⚡ CAMBIAR DE PUESTO ESCRIBIENDO EL NÚMERO DIRECTAMENTE (1, 2, 3...)
  const cambiarPosicionManual = async (indexActual, nuevoPuestoTexto) => {
    if (mostrarCerradas) return;
    const nuevoPuesto = parseInt(nuevoPuestoTexto, 10);
    if (isNaN(nuevoPuesto)) return;

    const destIndex = Math.max(0, Math.min(nuevoPuesto - 1, pedidosFiltrados.length - 1));
    if (indexActual === destIndex) return;

    const itemsFiltrados = Array.from(pedidosFiltrados);
    const [movido] = itemsFiltrados.splice(indexActual, 1);
    itemsFiltrados.splice(destIndex, 0, movido);

    const idsFiltradosSet = new Set(pedidosFiltrados.map(p => p.id));
    const restoPedidos = pedidos.filter(p => !idsFiltradosSet.has(p.id));
    
    const nuevaListaGlobal = [...itemsFiltrados, ...restoPedidos];
    setPedidos(nuevaListaGlobal);

    const payload = nuevaListaGlobal.map((item, idx) => ({
      id: item.id,
      prioridad: idx + 1
    }));

    try {
      await apiFetch('/api/pedidos/reordenar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuevoOrden: payload })
      });
    } catch (error) {
      console.error("Error al cambiar posición manualmente", error);
    }
  };

  // 🎯 Renderiza el Semáforo Poka-Yoke de Alistamiento para cada orden (Responsivo)
  const renderSemaforoHerramental = (idOrden) => {
    const info = mapaHerramentales[String(idOrden)];
    if (!info) {
      return <span style={{ color: '#adb5bd', fontSize: '0.78rem' }}>—</span>;
    }

    const sinClise = !info.codigo_clise || info.codigo_clise.toUpperCase().includes('SIN IMPRESION');
    const sinTroquel = !info.codigo_troquel;

    const badgeColor = (estado) => {
      if (estado === 'Listo en Máquina') return { bg: '#d1fae5', text: '#065f46', icon: '✅' };
      if (estado === 'En Reparación') return { bg: '#fee2e2', text: '#991b1b', icon: '🚫' };
      if (estado === 'En Alistamiento') return { bg: '#e0f2fe', text: '#075985', icon: '🧹' };
      return { bg: '#fef3c7', text: '#92400e', icon: '⏳' };
    };

    const cBadge = badgeColor(info.estado_alistamiento_clise);
    const tBadge = badgeColor(info.estado_alistamiento_troquel);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.74rem', textAlign: 'left' }}>
        {sinClise ? (
          <span style={{ color: '#6c757d' }}>🎨 Liso (S/Imp.)</span>
        ) : (
          <span
            style={{
              backgroundColor: cBadge.bg,
              color: cBadge.text,
              padding: '3px 6px',
              borderRadius: '4px',
              fontWeight: 'bold',
              display: 'inline-block',
              lineHeight: 1.25,
              wordBreak: 'break-word'
            }}
            title={`Clisé ${info.codigo_clise} (${info.ubic_clise || 'S/U'}): ${info.estado_alistamiento_clise}`}
          >
            {cBadge.icon} Clisé: {info.codigo_clise} ({info.ubic_clise || 'S/U'})
          </span>
        )}

        {sinTroquel ? (
          <span style={{ color: '#6c757d' }}>🔪 Slotter (S/Troq.)</span>
        ) : (
          <span
            style={{
              backgroundColor: tBadge.bg,
              color: tBadge.text,
              padding: '3px 6px',
              borderRadius: '4px',
              fontWeight: 'bold',
              display: 'inline-block',
              lineHeight: 1.25,
              wordBreak: 'break-word'
            }}
            title={`Troquel ${info.codigo_troquel} (${info.ubic_troquel || 'S/U'}): ${info.estado_alistamiento_troquel}`}
          >
            {tBadge.icon} Troq: {info.codigo_troquel} ({info.ubic_troquel || 'S/U'})
          </span>
        )}
      </div>
    );
  };

  // 🎯 FILTRADO INTELIGENTE POR FAMILIA DE RUTA (EXCLUSIVO CONVERSIÓN: JS, SS, WARD)
  const pedidosFiltrados = listaBase.filter(p => {
    if (filtroMaquina === 'TODAS') return true;
    return obtenerFamiliaRuta(p.maquina) === filtroMaquina;
  });

  const cantidadCerradasEnCero = pedidosOcultos.filter(p => p.cantidad_fabricada <= 0).length;

  return (
    <div style={{ padding: '1.2rem 1.5rem', width: '100%', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '3px solid #17a2b8', paddingBottom: '10px' }}>
        <span style={{ fontSize: '2.3rem', marginRight: '14px' }}>💻</span>
        <div>
          <h2 style={{ color: '#17a2b8', margin: 0, fontSize: '1.85rem' }}>Panel de Programación de Producción</h2>
          <small style={{ color: '#6c757d', fontWeight: 'bold' }}>Conversión de Planta · Líneas COR-JS, COR-SS y COR-WAR · Semáforo de Alistamiento en Vivo</small>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '1.3rem 1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '1.5rem', borderLeft: '5px solid #6c757d', boxSizing: 'border-box' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.8rem', color: '#343a40', fontSize: '1.05rem' }}>
          Actualizar Base de Datos (Maestro_pedidos.csv / Maestro_Productos.csv)
        </h3>
        <form onSubmit={procesarCSV} style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input 
            type="file" 
            accept=".csv" 
            disabled={progresoCarga.activo}
            onChange={(e) => setArchivo(e.target.files[0])} 
            style={{ padding: '9px', border: '1px solid #ccc', borderRadius: '5px', flex: '1 1 260px' }} 
          />
          <button 
            type="submit" 
            disabled={!archivo || progresoCarga.activo} 
            style={{ padding: '11px 22px', backgroundColor: archivo && !progresoCarga.activo ? '#17a2b8' : '#e9ecef', color: archivo && !progresoCarga.activo ? 'white' : '#6c757d', border: 'none', borderRadius: '5px', cursor: archivo && !progresoCarga.activo ? 'pointer' : 'not-allowed', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            {progresoCarga.activo ? '⏳ Procesando por Lotes...' : 'Procesar e Importar a BD'}
          </button>
        </form>

        {/* 🚀 BARRA DE PROGRESO TURBO BATCH */}
        {progresoCarga.activo && (
          <div style={{ marginTop: '1rem', backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.9rem', color: '#0f172a', marginBottom: '6px' }}>
              <span>{progresoCarga.detalle}</span>
              <span>{progresoCarga.porcentaje}%</span>
            </div>
            <div style={{ width: '100%', height: '12px', backgroundColor: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progresoCarga.porcentaje}%`,
                  height: '100%',
                  backgroundColor: '#17a2b8',
                  transition: 'width 0.25s ease'
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div style={{ backgroundColor: 'white', padding: '1.3rem 1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: mostrarCerradas ? '5px solid #fd7e14' : '5px solid #ffc107', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, color: '#343a40', fontSize: '1.15rem' }}>
              {mostrarCerradas
                ? '🚑 Órdenes Cerradas / En Expedición (Modo Rescate)'
                : '2. Órdenes de Producción en Cola (Arrastrá o tipeá el puesto)'}
            </h3>

            <button
              onClick={() => setMostrarCerradas(!mostrarCerradas)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: mostrarCerradas ? '2px solid #343a40' : '1px solid #fd7e14',
                backgroundColor: mostrarCerradas ? '#343a40' : (cantidadCerradasEnCero > 0 ? '#fff3cd' : '#f8f9fa'),
                color: mostrarCerradas ? '#fff' : '#d9480f',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.82rem'
              }}
              title="Ver órdenes finalizadas o cerradas en cero para revivirlas y devolverlas a la cola"
            >
              {mostrarCerradas
                ? '⬅️ Volver a Cola Activa'
                : `🚑 Ver Cerradas / Revivir (${pedidosOcultos.length}${cantidadCerradasEnCero > 0 ? ` · ⚠️ ${cantidadCerradasEnCero} en 0` : ''})`}
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#6c757d', marginRight: '5px' }}>Filtro Máquina:</span>
            <button 
              onClick={() => setFiltroMaquina('TODAS')}
              style={{ 
                padding: '6px 14px', borderRadius: '5px', border: '1px solid #ccc', 
                backgroundColor: filtroMaquina === 'TODAS' ? '#17a2b8' : '#f8f9fa', 
                color: filtroMaquina === 'TODAS' ? 'white' : '#333', 
                cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' 
              }}>
              Todas ({listaBase.length})
            </button>
            {ORDEN_FAMILIAS_CONVERSION.map((familia) => (
              <button 
                key={familia}
                onClick={() => setFiltroMaquina(familia)}
                style={{ 
                  padding: '6px 14px', borderRadius: '5px', border: '1px solid #ccc', 
                  backgroundColor: filtroMaquina === familia ? '#17a2b8' : '#f8f9fa', 
                  color: filtroMaquina === familia ? 'white' : '#333', 
                  cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' 
                }}>
                {familia} ({conteoPorFamilia[familia] || 0})
              </button>
            ))}
          </div>
        </div>
        
        <div style={{ maxHeight: '640px', overflowY: 'auto', overflowX: 'hidden', width: '100%' }}>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="lista-pedidos">
              {(provided) => (
                <table 
                  className="table table-hover" 
                  {...provided.droppableProps} 
                  ref={provided.innerRef}
                  style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', marginTop: '0.5rem' }}
                >
                  <colgroup>
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '12%' }} />
                  </colgroup>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', fontSize: '0.86rem' }}>
                      <th style={{ padding: '12px 8px', textAlign: 'left', color: '#495057' }}>Puesto / Orden</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', color: '#495057' }}>Cliente / Producto</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', color: '#495057', backgroundColor: '#eef6ff' }}>🛠️ Alistamiento (Clisé / Troquel)</th>
                      <th style={{ padding: '12px 6px', textAlign: 'center', color: '#495057', backgroundColor: '#e9ecef' }}>Máquina Destino</th>
                      <th style={{ padding: '12px 6px', textAlign: 'center', color: '#495057' }}>Estado</th>
                      <th style={{ padding: '12px 6px', textAlign: 'center', color: '#495057' }}>Acción</th>
                    </tr>
                  </thead>
                  
                  <tbody>
                    {pedidosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#6c757d', fontStyle: 'italic' }}>
                          No hay órdenes de producción para el filtro seleccionado.
                        </td>
                      </tr>
                    ) : (
                      pedidosFiltrados.map((pedido, index) => {
                        const cerradaEnCero = mostrarCerradas && pedido.cantidad_fabricada <= 0;
                        const infoHerr = mapaHerramentales[String(pedido.id)];
                        const bloqueadaPorTaller =
                          infoHerr &&
                          (infoHerr.estado_alistamiento_clise === 'En Reparación' ||
                           infoHerr.estado_alistamiento_troquel === 'En Reparación');

                        return (
                          <Draggable 
                            key={pedido.id.toString()} 
                            draggableId={pedido.id.toString()} 
                            index={index}
                            isDragDisabled={mostrarCerradas}
                          >
                            {(provided, snapshot) => (
                              <tr
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{ 
                                  borderBottom: '1px solid #dee2e6',
                                  backgroundColor: snapshot.isDragging
                                    ? '#e3f2fd'
                                    : bloqueadaPorTaller
                                    ? '#fff5f5'
                                    : cerradaEnCero
                                    ? '#fff8e6'
                                    : 'white',
                                  ...provided.draggableProps.style
                                }}
                              >
                                <td style={{ padding: '10px 6px', fontWeight: 'bold' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                                    {!mostrarCerradas && (
                                      <>
                                        <span style={{ cursor: 'grab', color: '#aaa', fontSize: '1rem' }} title="Arrastrar fila">☰</span>
                                        
                                        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '5px', padding: '2px 4px' }} title="Escribí el puesto deseado y presioná Enter">
                                          <span style={{ fontSize: '0.72rem', color: '#856404', marginRight: '1px', fontWeight: 'bold' }}>#</span>
                                          <input
                                            key={`pos-${pedido.id}-${index}`}
                                            type="number"
                                            min="1"
                                            max={pedidosFiltrados.length}
                                            defaultValue={index + 1}
                                            onFocus={(e) => e.target.select()}
                                            onClick={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.target.blur();
                                              }
                                            }}
                                            onBlur={(e) => {
                                              if (parseInt(e.target.value, 10) !== index + 1) {
                                                cambiarPosicionManual(index, e.target.value);
                                              } else {
                                                e.target.value = index + 1;
                                              }
                                            }}
                                            style={{
                                              width: '36px',
                                              textAlign: 'center',
                                              fontWeight: 'bold',
                                              fontSize: '0.82rem',
                                              border: 'none',
                                              backgroundColor: 'transparent',
                                              color: '#212529',
                                              outline: 'none'
                                            }}
                                          />
                                        </div>
                                      </>
                                    )}

                                    <span style={{ fontSize: '0.92rem', color: '#333' }}>{pedido.id}</span>
                                  </div>
                                </td>

                                <td style={{ padding: '10px 8px', wordWrap: 'break-word' }}>
                                  <div style={{ fontWeight: 'bold', color: '#212529', fontSize: '0.88rem', lineHeight: 1.2 }}>{pedido.cliente}</div>
                                  <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '2px', lineHeight: 1.2 }}>{pedido.producto}</div>
                                  {infoHerr?.colores && (
                                    <div style={{ fontSize: '0.73rem', color: '#0d6efd', fontWeight: 'bold', marginTop: '3px' }}>
                                      🎨 {infoHerr.colores}
                                    </div>
                                  )}
                                </td>

                                {/* 🛠️ COLUMNA SEMÁFORO DE ALISTAMIENTO */}
                                <td style={{ padding: '8px', backgroundColor: bloqueadaPorTaller ? '#fee2e2' : '#f8fbff' }}>
                                  {renderSemaforoHerramental(pedido.id)}
                                </td>
                                
                                <td style={{ padding: '10px 6px', textAlign: 'center', backgroundColor: '#fdfdfe' }}>
                                  <select 
                                    value={pedido.maquina}
                                    onChange={(e) => cambiarMaquina(pedido.id, e.target.value)}
                                    style={{ 
                                      width: '100%', maxWidth: '140px', padding: '6px 4px', borderRadius: '5px', border: '2px solid #ccc', 
                                      fontSize: '0.82rem', fontWeight: 'bold', color: pedido.maquina ? '#0056b3' : '#dc3545',
                                      outline: 'none', cursor: 'pointer', boxSizing: 'border-box'
                                    }}
                                  >
                                    <option value="" disabled>-- Ruta --</option>
                                    {rutasUnicasPlanta.map((ruta) => (
                                      <option key={ruta} value={ruta}>
                                        {ruta}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                
                                <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                                  <span style={{ 
                                    display: 'inline-block',
                                    padding: '5px 10px', borderRadius: '20px', 
                                    backgroundColor: pedido.estado === 'Pendiente' ? '#ffefb3' : (pedido.estado === 'Finalizada Parcial' ? '#f8d7da' : '#d4edda'),
                                    color: pedido.estado === 'Pendiente' ? '#856404' : (pedido.estado === 'Finalizada Parcial' ? '#721c24' : '#155724'),
                                    fontWeight: 'bold', fontSize: '0.78rem'
                                  }}>
                                    {pedido.estado}
                                  </span>

                                  {mostrarCerradas && (
                                    <div style={{ marginTop: '5px', fontSize: '0.72rem', fontWeight: 'bold', color: cerradaEnCero ? '#d9480f' : '#495057' }}>
                                      {cerradaEnCero
                                        ? '⚠️ EN 0 CAJAS'
                                        : `${pedido.cantidad_fabricada}/${pedido.cantidad_programada}`}
                                    </div>
                                  )}

                                  {pedido.estado === 'Finalizada Parcial' && !mostrarCerradas && (
                                    <div style={{ marginTop: '6px', padding: '6px', backgroundColor: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: '6px', textAlign: 'center' }}>
                                      <span style={{ 
                                        backgroundColor: '#dc3545', 
                                        color: 'white', 
                                        padding: '3px 6px', 
                                        borderRadius: '4px', 
                                        fontWeight: 'bold', 
                                        fontSize: '0.7rem',
                                        display: 'inline-block',
                                        marginBottom: '4px'
                                      }}>
                                        ⚠️ FALTAN: {pedido.cantidad_faltante}
                                      </span>

                                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                        <button 
                                          onClick={() => gestionarFaltante(pedido, 'reprogramar')}
                                          style={{ padding: '3px 6px', backgroundColor: '#ffc107', color: '#000', border: 'none', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer' }}
                                          title="Generar nueva orden o sumar a cola por el saldo pendiente">
                                          🔄 Reprog.
                                        </button>

                                        <button 
                                          onClick={() => gestionarFaltante(pedido, 'cerrar')}
                                          style={{ padding: '3px 6px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer' }}
                                          title="Cerrar definitivamente por acuerdo comercial con el cliente">
                                          📁 Cerrar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </td>
                                
                                <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                                  {mostrarCerradas ? (
                                    <button
                                      onClick={() => revivirOrden(pedido)}
                                      style={{
                                        width: '100%',
                                        padding: '7px 8px',
                                        backgroundColor: cerradaEnCero ? '#fd7e14' : '#17a2b8',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '5px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        fontSize: '0.76rem'
                                      }}
                                      title="Sacar de Expedición y devolver a la cola activa como Pendiente"
                                    >
                                      🚑 Revivir
                                    </button>
                                  ) : pedido.estado === 'Pendiente' ? (
                                    <button 
                                      onClick={() => habilitarOrden(pedido.id)}
                                      style={{
                                        width: '100%',
                                        padding: '7px 8px',
                                        backgroundColor: bloqueadaPorTaller ? '#dc3545' : '#0056b3',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '5px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        fontSize: '0.78rem',
                                        lineHeight: 1.2
                                      }}
                                      title={bloqueadaPorTaller ? 'Atención: Herramental reportado en Reparación/Taller' : 'Enviar orden a máquina'}
                                    >
                                      {bloqueadaPorTaller ? '⚠️ Herr. Taller' : 'Enviar a Planta'}
                                    </button>
                                  ) : pedido.estado === 'Finalizada Parcial' ? (
                                    <span style={{ color: '#dc3545', fontWeight: 'bold', fontSize: '1.2rem' }} title="Atender decisión comercial en columna Estado">
                                      ⚡
                                    </span>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                      <span style={{ color: '#28a745', fontWeight: 'bold', fontSize: '0.75rem' }}>✓ En Planta</span>
                                      <button
                                        onClick={() => darPorCumplida(pedido)}
                                        style={{
                                          width: '100%',
                                          padding: '5px 6px',
                                          backgroundColor: '#198754',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          fontWeight: 'bold',
                                          fontSize: '0.74rem'
                                        }}
                                        title="Marcar como ya fabricada y quitar de la cola"
                                      >
                                        ✅ Cumplida
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Draggable>
                        );
                      })
                    )}
                    {provided.placeholder}
                  </tbody>
                </table>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>
    </div>
  );
}