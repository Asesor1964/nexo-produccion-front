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
            producto: p.producto_descripcion || 'Sin descripción',
            estado: p.estado || 'Pendiente',
            maquina: p.maquina_asignada || 'COR-JS',
            prioridad: p.prioridad_secuencia || 999
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

  // 🎯 EXTRAER RUTAS ÚNICAS Y LIMPIAS DIRECTAMENTE DE LOS PEDIDOS CARGADOS
  const rutasUnicasPlanta = Array.from(
    new Set(
      pedidos
        .map(p => p.maquina ? p.maquina.trim().toUpperCase() : '')
        .filter(m => m && isNaN(m) && !m.includes(',')) // Descarta vacíos, números puros y decimales
    )
  ).sort();

  const procesarCSV = (e) => {
    e.preventDefault();
    if (!archivo) return;

    const lector = new FileReader();
    
    lector.onload = async (evento) => {
      const texto = evento.target.result;
      const lineas = texto.split(/\r\n|\n/);
      
      let inicioDatos = -1;
      let indicesCols = {};

      for (let i = 0; i < Math.min(10, lineas.length); i++) {
        const linea = lineas[i];
        if (linea.includes('Número') || linea.includes('Nºmero') || linea.includes('Numero') || linea.includes('Fecha pedido')) {
          const headers = linea.split(';');
          headers.forEach((h, idx) => {
            const cleanH = h.replace(/"/g, '').trim().toLowerCase();
            if (cleanH.includes('número') || cleanH.includes('numero')) indicesCols.numero = idx;
            if (cleanH.includes('fecha pedido')) indicesCols.fecha_pedido = idx;
            if (cleanH.includes('fecha entrega')) indicesCols.fecha_entrega = idx;
            if (cleanH.includes('cliente') && !cleanH.includes('cod')) indicesCols.cliente = idx;
            if (cleanH.includes('rubro')) indicesCols.rubro = idx;
            if (cleanH.includes('código producto') || cleanH.includes('codigo producto') || cleanH.includes('corrugado')) indicesCols.codigo_producto = idx;
            if (cleanH.includes('descripción') || cleanH.includes('descripcion')) indicesCols.descripcion = idx;
            if (cleanH.includes('largo')) indicesCols.largo = idx;
            if (cleanH.includes('ancho')) indicesCols.ancho = idx;
            if (cleanH.includes('plancha')) indicesCols.plancha = idx;
            if (cleanH.includes('cant.')) indicesCols.cantidad = idx;
            if (cleanH.includes('m² tot.')) indicesCols.m2_tot = idx;
            if (cleanH.includes('m² pend.')) indicesCols.m2_pend = idx;
            if (cleanH.includes('peso')) indicesCols.peso = idx;
            if (cleanH === 'ruta' || cleanH.startsWith('ruta')) indicesCols.ruta = idx;
          });
          inicioDatos = i + 1;
          break;
        }
      }

      if (inicioDatos === -1) {
        alert("❌ No se reconoció la cabecera del Maestro_pedidos.csv.");
        return;
      }

      const payloadBackend = [];

      for (let i = inicioDatos; i < lineas.length; i++) {
        if (!lineas[i].trim()) continue;
        
        const cols = lineas[i].split(';');
        
        const numOrden = parseInt(cols[indicesCols.numero !== undefined ? indicesCols.numero : 0]?.replace(/"/g, '').trim(), 10);
        const codProd = cols[indicesCols.codigo_producto !== undefined ? indicesCols.codigo_producto : 10]?.replace(/"/g, '').trim();
        const cantStr = cols[indicesCols.cantidad !== undefined ? indicesCols.cantidad : 20]?.replace(/\./g, '').replace(',', '.') || "0";
        const rutaVal = cols[indicesCols.ruta !== undefined ? indicesCols.ruta : cols.length - 1]?.replace(/"/g, '').trim() || '';

        if (numOrden && !isNaN(numOrden)) {
          payloadBackend.push({
            numero_orden: numOrden,
            codigo_producto: codProd || 'SIN_CODIGO',
            cantidad_programada: parseFloat(cantStr) || 0,
            fecha_entrega: cols[indicesCols.fecha_entrega]?.replace(/"/g, '').trim() || null,
            fecha_pedido: cols[indicesCols.fecha_pedido]?.replace(/"/g, '').trim() || null,
            cliente: cols[indicesCols.cliente]?.replace(/"/g, '').trim() || null,
            rubro: cols[indicesCols.rubro]?.replace(/"/g, '').trim() || null,
            descripcion: cols[indicesCols.descripcion]?.replace(/"/g, '').trim() || null,
            largo: parseFloat(cols[indicesCols.largo]?.replace(/\./g, '').replace(',', '.')) || null,
            ancho: parseFloat(cols[indicesCols.ancho]?.replace(/\./g, '').replace(',', '.')) || null,
            plancha: cols[indicesCols.plancha]?.replace(/"/g, '').trim() || null,
            m2_tot: parseFloat(cols[indicesCols.m2_tot]?.replace(/\./g, '').replace(',', '.')) || null,
            m2_pend: parseFloat(cols[indicesCols.m2_pend]?.replace(/\./g, '').replace(',', '.')) || null,
            peso: parseFloat(cols[indicesCols.peso]?.replace(/\./g, '').replace(',', '.')) || null,
            maquina_asignada: rutaVal
          });
        }
      }

      try {
        const respuesta = await apiFetch('/api/pedidos/sincronizar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pedidos: payloadBackend }),
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
          alert(`✅ [Base de PEDIDOS]\n${resultado.mensaje}`);
          cargarPedidosDesdeBD(); 
        } else {
          alert(`❌ Error en BD: ${resultado.error}`);
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
    if (!pedidoAEnviar.maquina) {
      alert("⚠️ Debe asignar una Máquina Destino antes de enviar la orden a planta.");
      return;
    }

    const nuevosPedidos = pedidos.map(p => p.id === id ? { ...p, estado: 'Habilitada' } : p);
    setPedidos(nuevosPedidos);

    try {
      await apiFetch(`/api/pedidos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'Habilitada' }),
      });
    } catch (error) {
      console.error('Error al habilitar orden en BD', error);
    }
  };

  const handleDragEnd = async (resultado) => {
    if (!resultado.destination) return;

    const items = Array.from(pedidos);
    const [filaArrastrada] = items.splice(resultado.source.index, 1);
    items.splice(resultado.destination.index, 0, filaArrastrada);

    setPedidos(items);

    const payload = items.map((item, index) => ({
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

  const pedidosFiltrados = pedidos.filter(p => {
    if (filtroMaquina === 'TODAS') return true;
    return p.maquina && p.maquina.toUpperCase().includes(filtroMaquina.toUpperCase());
  });

  return (
    <div style={{ padding: '2rem', width: '100%', maxWidth: '1100px', fontFamily: 'sans-serif' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', borderBottom: '3px solid #17a2b8', paddingBottom: '10px' }}>
        <span style={{ fontSize: '2.5rem', marginRight: '15px' }}>💻</span>
        <h2 style={{ color: '#17a2b8', margin: 0, fontSize: '2rem' }}>Panel de Programación de Producción</h2>
      </div>

      <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '2rem', borderLeft: '5px solid #6c757d' }}>
        <h3 style={{ marginTop: 0, color: '#343a40' }}>Actualizar Base de Datos (Maestro_pedidos.csv)</h3>
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
          <h3 style={{ margin: 0, color: '#343a40' }}>2. Órdenes de Producción en Cola (Arrastrá para reordenar)</h3>
          
          {/* 🔍 BARRA DE FILTROS RÁPIDOS LIMPIA Y PROFESIONAL */}
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
            {rutasUnicasPlanta.map((ruta) => (
              <button 
                key={ruta}
                onClick={() => setFiltroMaquina(ruta)}
                style={{ 
                  padding: '6px 14px', borderRadius: '5px', border: '1px solid #ccc', 
                  backgroundColor: filtroMaquina === ruta ? '#17a2b8' : '#f8f9fa', 
                  color: filtroMaquina === ruta ? 'white' : '#333', 
                  cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' 
                }}>
                {ruta}
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
                      <th style={{ padding: '15px 10px', textAlign: 'left', color: '#495057' }}>N° Orden</th>
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
                              <td style={{ padding: '15px 10px', fontWeight: 'bold' }}>
                                <span style={{ cursor: 'grab', marginRight: '10px', color: '#aaa' }}>☰</span>
                                {pedido.id}
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
                                  backgroundColor: pedido.estado === 'Pendiente' ? '#ffefb3' : '#d4edda',
                                  color: pedido.estado === 'Pendiente' ? '#856404' : '#155724',
                                  fontWeight: 'bold', fontSize: '0.85rem'
                                }}>
                                  {pedido.estado}
                                </span>
                              </td>
                              
                              <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                                {pedido.estado === 'Pendiente' ? (
                                  <button 
                                    onClick={() => habilitarOrden(pedido.id)}
                                    style={{ padding: '8px 15px', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                    Enviar a Planta
                                  </button>
                                ) : (
                                  <span style={{ color: '#28a745', fontWeight: 'bold', fontSize: '1.2rem' }}>✓</span>
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