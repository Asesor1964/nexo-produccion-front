import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { apiFetch } from '../services/api'; // 👈 IMPORTACIÓN CENTRALIZADA

export default function PantallaProgramador() {
  const [pedidos, setPedidos] = useState([]);
  const [archivo, setArchivo] = useState(null);
  const [filtroMaquina, setFiltroMaquina] = useState('TODAS');

  const cargarPedidosDesdeBD = async () => {
    try {
      const respuesta = await apiFetch('/api/pedidos');
      if (respuesta.ok) {
        const data = await respuesta.json();
        const pedidosFormateados = data
          .map(p => ({
            id: p.id,
            cliente: p.cliente || 'Sin cliente',
            producto: p.descripcion_producto || p.producto_descripcion || 'Sin descripción',
            estado: p.estado || 'Pendiente',
            maquina: p.maquina_asignada || 'COR-JS',
            prioridad: p.prioridad_secuencia || 999, 
            cantidad_faltante: p.cantidad_faltante || 0
          }))
          .sort((a, b) => a.prioridad - b.prioridad);
          
        setPedidos(pedidosFormateados);
      }
    } catch (error) {
      console.error('Error al cargar la BD:', error);
    }
  };

  useEffect(() => {
    cargarPedidosDesdeBD();
  }, []);

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

  // 🎯 1. FUNCIÓN PARA AGRUPAR CUALQUIER RUTA EN SU FAMILIA BASE
  const obtenerFamiliaRuta = (ruta) => {
    if (!ruta) return '';
    const limpia = ruta.trim().toUpperCase();
    const partes = limpia.split('-');

    if (partes[0].startsWith('COR') && partes.length >= 2) {
      const maquinaBase = partes[1].replace(/X\d+$/i, '');
      return `COR-${maquinaBase}`;
    }

    return partes[0];
  };

  // 🎯 2. EXTRAER RUTAS EXACTAS ÚNICAS (Para el desplegable <select> de cada orden)
  const rutasUnicasPlanta = Array.from(
    new Set(
      pedidos
        .map(p => p.maquina ? p.maquina.trim().toUpperCase() : '')
        .filter(m => m && isNaN(m) && !m.includes(','))
    )
  ).sort();

  // 🎯 3. EXTRAER FAMILIAS DE RUTA Y CONTAR ÓRDENES (Para los botones de Filtro Ruta)
  const conteoPorFamilia = {};
  pedidos.forEach(p => {
    const raw = p.maquina ? p.maquina.trim().toUpperCase() : '';
    if (raw && isNaN(raw) && !raw.includes(',')) {
      const fam = obtenerFamiliaRuta(raw);
      if (fam) {
        conteoPorFamilia[fam] = (conteoPorFamilia[fam] || 0) + 1;
      }
    }
  });
  const familiasUnicasPlanta = Object.keys(conteoPorFamilia).sort();

  const procesarCSV = (e) => {
    e.preventDefault();
    if (!archivo) return;

    const lector = new FileReader();

    lector.onload = async (evento) => {
      const texto = evento.target.result;
      const lineas = texto.split(/\r\n|\n/);

      let inicioDatos = -1;
      let tipoArchivo = null;
      let indicesCols = { colsColores: [] };

      const normalizar = (str) =>
        String(str || '')
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

        if (lineaNorm.includes('fecha pedido') || lineaNorm.includes('fecha entrega') || lineaNorm.includes('m2 pend')) {
          tipoArchivo = 'PEDIDOS';
          indicesCols.colsColores = detectarColumnasColor(cols);
          cols.forEach((h, idx) => {
            const cleanH = normalizar(h);
            if (idx === 0 || cleanH.includes('numero') || cleanH === 'nro') indicesCols.numero = idx;
            if (cleanH === 'fecha pedido') indicesCols.fecha_pedido = idx;
            if (cleanH === 'fecha entrega') indicesCols.fecha_entrega = idx;
            if (cleanH === 'cliente') indicesCols.cliente = idx;
            if (cleanH === 'rubro') indicesCols.rubro = idx;
            if (cleanH.includes('producto') && (cleanH.includes('cod') || idx === 10)) indicesCols.codigo_producto = idx;
            if (cleanH.startsWith('descripci')) indicesCols.descripcion = idx;
            if (cleanH === 'largo') indicesCols.largo = idx;
            if (cleanH === 'ancho') indicesCols.ancho = idx;
            if (cleanH === 'plancha') indicesCols.plancha = idx;
            if (cleanH === 'cant.' || cleanH === 'cantidad') indicesCols.cantidad = idx;
            if (cleanH.includes('tot') && cleanH.startsWith('m')) indicesCols.m2_tot = idx;
            if (cleanH.includes('pend') && cleanH.startsWith('m')) indicesCols.m2_pend = idx;
            if (cleanH === 'peso') indicesCols.peso = idx;
            if (cleanH === 'ruta') indicesCols.ruta = idx;
          });
          inicioDatos = i + 1;
          break;
        }

        if (lineaNorm.includes('codigo') || lineaNorm.includes('cliente') || lineaNorm.includes('descripci') || lineaNorm.includes('largo')) {
          tipoArchivo = 'PRODUCTOS';
          indicesCols.colsColores = detectarColumnasColor(cols);
          cols.forEach((h, idx) => {
            const cleanH = normalizar(h);
            if (cleanH.includes('cod') || idx === 0) indicesCols.codigo_producto = idx;
            if (cleanH.includes('cliente')) indicesCols.cliente = idx;
            if (cleanH.startsWith('descripci')) indicesCols.descripcion = idx;
            if (cleanH.includes('material') || cleanH.includes('onda') || cleanH.includes('calidad')) indicesCols.material = idx;
            if (cleanH.includes('largo')) indicesCols.largo = idx;
            if (cleanH.includes('ancho') && !cleanH.includes('pref')) indicesCols.ancho = idx;
            if (cleanH.includes('m2') || cleanH.includes('superficie')) indicesCols.superficie_m2 = idx;
            if (cleanH.includes('herramienta') || cleanH.includes('troquel') || cleanH.includes('clise')) indicesCols.herramientas = idx;
            if (cleanH.includes('ruta')) indicesCols.ruta = idx;
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

      if (tipoArchivo === 'PRODUCTOS') {
        const payloadProductos = [];
        for (let i = inicioDatos; i < lineas.length; i++) {
          if (!lineas[i].trim()) continue;
          const cols = lineas[i].split(';');
          const codProd = cols[indicesCols.codigo_producto ?? 0]?.replace(/"/g, '').trim();
          if (!codProd) continue;

          const infoColores = extraerColoresDeFila(cols);

          payloadProductos.push({
            codigo_producto: codProd,
            cliente: cols[indicesCols.cliente]?.replace(/"/g, '').trim() || null,
            descripcion: cols[indicesCols.descripcion]?.replace(/"/g, '').trim() || null,
            material: indicesCols.material !== undefined ? cols[indicesCols.material]?.replace(/"/g, '').trim() : null,
            largo_mm: limpiarNum(cols[indicesCols.largo]),
            ancho_mm: limpiarNum(cols[indicesCols.ancho]),
            superficie_m2: indicesCols.superficie_m2 !== undefined ? limpiarNum(cols[indicesCols.superficie_m2]) : null,
            herramientas: indicesCols.herramientas !== undefined ? cols[indicesCols.herramientas]?.replace(/"/g, '').trim() : null,
            ruta_sugerida: cols[indicesCols.ruta ?? cols.length - 1]?.replace(/"/g, '').trim() || 'COR-JS',
            ...infoColores
          });
        }

        try {
          const respuesta = await apiFetch('/api/productos/sincronizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productos: payloadProductos }),
          });
          const resultado = await respuesta.json();
          if (respuesta.ok) {
            alert(`✅ [Base de PRODUCTOS]\n${resultado.mensaje}`);
          } else {
            alert(`❌ Error en BD Productos: ${resultado.error}`);
          }
        } catch (error) {
          alert('❌ Error de conexión al subir Productos.');
        }
        return;
      }

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
              ...infoColores
            });
          }
        }
      }

      try {
        if (productosDesdePedidosMap.size > 0) {
          await apiFetch('/api/productos/sincronizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productos: Array.from(productosDesdePedidosMap.values()) })
          }).catch(() => {});
        }

        const respuesta = await apiFetch('/api/pedidos/sincronizar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pedidos: payloadPedidos }),
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
          alert(`✅ [Base de PEDIDOS]\n${resultado.mensaje}`);
          cargarPedidosDesdeBD();
        } else {
          alert(`❌ Error en BD Pedidos: ${resultado.error}`);
        }
      } catch (error) {
        alert('❌ Error crítico de conexión con el servidor.');
      }
    };

    lector.readAsText(archivo, 'ISO-8859-1');
  };

  const cambiarMaquina = async (id, nuevaMaquina) => {
    const nuevosPedidos = pedidos.map(p => p.id === id ? { ...p, maquina: nuevaMaquina } : p);
    setPedidos(nuevosPedidos);

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

  // 🦅 DRAG AND DROP BLINDADO (Funciona perfectamente con filtros de familia activos)
  const handleDragEnd = async (resultado) => {
    if (!resultado.destination) return;

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

  // 🎯 FILTRADO INTELIGENTE POR FAMILIA DE RUTA
  const pedidosFiltrados = pedidos.filter(p => {
    if (filtroMaquina === 'TODAS') return true;
    return obtenerFamiliaRuta(p.maquina) === filtroMaquina;
  });

  return (
    <div style={{ padding: '2rem', width: '100%', maxWidth: '1100px', fontFamily: 'sans-serif' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', borderBottom: '3px solid #17a2b8', paddingBottom: '10px' }}>
        <span style={{ fontSize: '2.5rem', marginRight: '15px' }}>💻</span>
        <h2 style={{ color: '#17a2b8', margin: 0, fontSize: '2rem' }}>Panel de Programación de Producción</h2>
      </div>

      <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '2rem', borderLeft: '5px solid #6c757d' }}>
        <h3 style={{ marginTop: 0, color: '#343a40' }}>Actualizar Base de Datos (Maestro_pedidos.csv / Maestro_Productos.csv)</h3>
        <form onSubmit={procesarCSV} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="file" 
            accept=".csv" 
            onChange={(e) => setArchivo(e.target.files[0])} 
            style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '5px', flexGrow: 1 }} 
          />
          <button 
            type="submit" 
            disabled={!archivo} 
            style={{ padding: '12px 25px', backgroundColor: archivo ? '#17a2b8' : '#e9ecef', color: archivo ? 'white' : '#6c757d', border: 'none', borderRadius: '5px', cursor: archivo ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
            Procesar e Importar a BD
          </button>
        </form>
      </div>

      <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderLeft: '5px solid #ffc107' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ margin: 0, color: '#343a40' }}>2. Órdenes de Producción en Cola (Arrastrá o tipeá el puesto)</h3>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#6c757d', marginRight: '5px' }}>Filtro Ruta:</span>
            <button 
              onClick={() => setFiltroMaquina('TODAS')}
              style={{ 
                padding: '6px 14px', borderRadius: '5px', border: '1px solid #ccc', 
                backgroundColor: filtroMaquina === 'TODAS' ? '#17a2b8' : '#f8f9fa', 
                color: filtroMaquina === 'TODAS' ? 'white' : '#333', 
                cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' 
              }}>
              Todas ({pedidos.length})
            </button>
            {familiasUnicasPlanta.map((familia) => (
              <button 
                key={familia}
                onClick={() => setFiltroMaquina(familia)}
                style={{ 
                  padding: '6px 14px', borderRadius: '5px', border: '1px solid #ccc', 
                  backgroundColor: filtroMaquina === familia ? '#17a2b8' : '#f8f9fa', 
                  color: filtroMaquina === familia ? 'white' : '#333', 
                  cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' 
                }}>
                {familia} ({conteoPorFamilia[familia]})
              </button>
            ))}
          </div>
        </div>
        
        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="lista-pedidos">
              {(provided) => (
                <table 
                  className="table table-hover" 
                  {...provided.droppableProps} 
                  ref={provided.innerRef}
                  style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}
                >
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ padding: '15px 10px', textAlign: 'left', color: '#495057' }}>Puesto / N° Orden</th>
                      <th style={{ padding: '15px 10px', textAlign: 'left', color: '#495057' }}>Cliente</th>
                      <th style={{ padding: '15px 10px', textAlign: 'left', color: '#495057' }}>Producto</th>
                      <th style={{ padding: '15px 10px', textAlign: 'center', color: '#495057', backgroundColor: '#e9ecef' }}>Máquina Destino</th>
                      <th style={{ padding: '15px 10px', textAlign: 'center', color: '#495057' }}>Estado</th>
                      <th style={{ padding: '15px 10px', textAlign: 'center', color: '#495057' }}>Acción</th>
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
                      pedidosFiltrados.map((pedido, index) => (
                        <Draggable 
                          key={pedido.id.toString()} 
                          draggableId={pedido.id.toString()} 
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <tr
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{ 
                                borderBottom: '1px solid #dee2e6',
                                backgroundColor: snapshot.isDragging ? '#e3f2fd' : 'white',
                                ...provided.draggableProps.style
                              }}
                            >
                              <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ cursor: 'grab', color: '#aaa', fontSize: '1.1rem' }} title="Arrastrar fila">☰</span>
                                  
                                  <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '5px', padding: '2px 5px' }} title="Escribí el puesto deseado y presioná Enter">
                                    <span style={{ fontSize: '0.75rem', color: '#856404', marginRight: '2px', fontWeight: 'bold' }}>#</span>
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
                                        width: '42px',
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                        fontSize: '0.85rem',
                                        border: 'none',
                                        backgroundColor: 'transparent',
                                        color: '#212529',
                                        outline: 'none'
                                      }}
                                    />
                                  </div>

                                  <span style={{ fontSize: '1rem', color: '#333' }}>{pedido.id}</span>
                                </div>
                              </td>
                              <td style={{ padding: '15px 10px' }}>{pedido.cliente}</td>
                              <td style={{ padding: '15px 10px', fontSize: '0.9rem', color: '#555' }}>{pedido.producto}</td>
                              
                              <td style={{ padding: '15px 10px', textAlign: 'center', backgroundColor: '#fdfdfe' }}>
                                <select 
                                  value={pedido.maquina}
                                  onChange={(e) => cambiarMaquina(pedido.id, e.target.value)}
                                  style={{ 
                                    padding: '8px', borderRadius: '5px', border: '2px solid #ccc', 
                                    fontSize: '0.9rem', fontWeight: 'bold', color: pedido.maquina ? '#0056b3' : '#dc3545',
                                    outline: 'none', cursor: 'pointer'
                                  }}
                                >
                                  <option value="" disabled>-- Asignar Ruta --</option>
                                  {rutasUnicasPlanta.map((ruta) => (
                                    <option key={ruta} value={ruta}>
                                      {ruta}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              
                              <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                                <span style={{ 
                                  padding: '6px 12px', borderRadius: '20px', 
                                  backgroundColor: pedido.estado === 'Pendiente' ? '#ffefb3' : (pedido.estado === 'Finalizada Parcial' ? '#f8d7da' : '#d4edda'),
                                  color: pedido.estado === 'Pendiente' ? '#856404' : (pedido.estado === 'Finalizada Parcial' ? '#721c24' : '#155724'),
                                  fontWeight: 'bold', fontSize: '0.85rem'
                                }}>
                                  {pedido.estado}
                                </span>

                                {pedido.estado === 'Finalizada Parcial' && (
                                  <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fdf2f2', border: '1px solid #f5c6cb', borderRadius: '6px', textAlign: 'center' }}>
                                    <span style={{ 
                                      backgroundColor: '#dc3545', 
                                      color: 'white', 
                                      padding: '4px 8px', 
                                      borderRadius: '4px', 
                                      fontWeight: 'bold', 
                                      fontSize: '0.75rem',
                                      display: 'inline-block',
                                      marginBottom: '6px'
                                    }}>
                                      ⚠️ FALTANTE: {pedido.cantidad_faltante} caj.
                                    </span>

                                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                      <button 
                                        onClick={() => gestionarFaltante(pedido, 'reprogramar')}
                                        style={{ padding: '4px 8px', backgroundColor: '#ffc107', color: '#000', border: 'none', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                                        title="Generar nueva orden o sumar a cola por el saldo pendiente">
                                        🔄 Reprogramar
                                      </button>

                                      <button 
                                        onClick={() => gestionarFaltante(pedido, 'cerrar')}
                                        style={{ padding: '4px 8px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                                        title="Cerrar definitivamente por acuerdo comercial con el cliente">
                                        📁 Archivar / Cerrar
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </td>
                              
                              <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                                {pedido.estado === 'Pendiente' ? (
                                  <button 
                                    onClick={() => habilitarOrden(pedido.id)}
                                    style={{ padding: '8px 15px', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                    Enviar a Planta
                                  </button>
                                ) : (
                                  <span style={{ color: pedido.estado === 'Finalizada Parcial' ? '#dc3545' : '#28a745', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                    {pedido.estado === 'Finalizada Parcial' ? '⚡' : '✓'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )}
                        </Draggable>
                      ))
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