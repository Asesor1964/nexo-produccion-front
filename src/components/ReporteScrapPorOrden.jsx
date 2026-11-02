import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api'; // 👈 IMPORTACIÓN CENTRALIZADA

export default function ReporteScrap() {
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroMaquina, setFiltroMaquina] = useState('TODOS');
  const [filtroZona, setFiltroZona] = useState('TODOS');
  const [mesSeleccionado, setMesSeleccionado] = useState('TODOS');
  const [filtroOrden, setFiltroOrden] = useState('TODOS'); // NUEVO FILTRO POR ORDEN

  const cargarDetalleScrap = async () => {
    try {
      const res = await apiFetch('/api/scrap/detallado');
      if (res.ok) {
        const data = await res.json();
        setRegistros(data);
      }
    } catch (error) {
      console.error('Error al cargar detalle de scrap:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDetalleScrap();
  }, []);

  const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const obtenerClaveMes = (fechaStr) => {
    if (!fechaStr) return 'Sin Fecha';
    const fecha = new Date(fechaStr);
    if (isNaN(fecha)) return 'Sin Fecha';
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    return `${anio}-${mes}`;
  };

  const formatearClaveMes = (clave) => {
    if (clave === 'Sin Fecha') return clave;
    const [anio, mes] = clave.split('-');
    return `${nombresMeses[parseInt(mes, 10) - 1]} ${anio}`;
  };

  const mesesDisponibles = Array.from(
    new Set(registros.map(r => obtenerClaveMes(r.fecha_registro)))
  ).filter(m => m !== 'Sin Fecha').sort().reverse();

  const maquinasBase = ['IMP-JS', 'WARD-TROQ', 'FLEXO', 'ROTATIVA', 'PEGADORA'];
  const maquinasDinamicas = registros.map(r => r.codigo_maquina).filter(Boolean);
  const maquinasDisponibles = Array.from(new Set([...maquinasBase, ...maquinasDinamicas]));

  // Órdenes únicas disponibles en los registros
  const ordenesDisponibles = Array.from(new Set(registros.map(r => r.orden_id))).filter(Boolean).sort((a, b) => a - b);

  // Filtrado múltiple (Máquina, Zona, Mes y Orden)
  const registrosFiltrados = registros.filter(item => {
    const matchMaquina = filtroMaquina === 'TODOS' || item.codigo_maquina === filtroMaquina;
    const matchZona = filtroZona === 'TODOS' || item.zona === filtroZona;
    const matchMes = mesSeleccionado === 'TODOS' || obtenerClaveMes(item.fecha_registro) === mesSeleccionado;
    const matchOrden = filtroOrden === 'TODOS' || String(item.orden_id) === String(filtroOrden);
    return matchMaquina && matchZona && matchMes && matchOrden;
  });

  const totalKgFiltrados = registrosFiltrados.reduce((acc, curr) => acc + Number(curr.peso_kg || 0), 0);

  const manejarImpresion = () => {
    window.print();
  };

  return (
    <div style={{ padding: '1rem 2rem', fontFamily: 'sans-serif', width: '100%', maxWidth: '1400px', margin: '0 auto', textAlign: 'left' }}>
      
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #seccion-imprimible-scrap, #seccion-imprimible-scrap * {
            visibility: visible;
          }
          #seccion-imprimible-scrap {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            background: white !important;
          }
          .no-imprimir {
            display: none !important;
          }
        }
      `}</style>

      <div id="seccion-imprimible-scrap">
        
        {/* CABECERA */}
        <div style={{ borderBottom: '3px solid #0f172a', paddingBottom: '15px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.8rem' }}>📊 Planilla Oficial de Auditoría de Scrap</h1>
            <p style={{ margin: '5px 0 0 0', color: '#64748b' }}>
              Filtro Activo: Máquina: <strong>{filtroMaquina}</strong> | Zona: <strong>{filtroZona.toUpperCase()}</strong> | Orden: <strong>{filtroOrden === 'TODOS' ? 'Todas' : `N° ${filtroOrden}`}</strong> | Período: <strong>{mesSeleccionado === 'TODOS' ? 'Histórico' : formatearClaveMes(mesSeleccionado)}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.2rem', border: '1px solid #f87171' }}>
              Total: {totalKgFiltrados.toFixed(2)} Kg ({registrosFiltrados.length} eventos)
            </div>
            <button 
              onClick={manejarImpresion}
              className="no-imprimir"
              style={{ padding: '12px 20px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
            >
              🖨️ Imprimir Planilla
            </button>
          </div>
        </div>

        {/* BARRA DE FILTROS (Incluye N° de Orden) */}
        <div className="no-imprimir" style={{ backgroundColor: 'white', padding: '1rem 1.5rem', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Filtro Orden */}
          <div>
            <label style={{ fontWeight: 'bold', marginRight: '8px', color: '#dc2626' }}>📦 N° Orden:</label>
            <select 
              value={filtroOrden} 
              onChange={(e) => setFiltroOrden(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #dc2626', fontWeight: 'bold', color: '#dc2626', cursor: 'pointer' }}
            >
              <option value="TODOS">Todas las Órdenes</option>
              {ordenesDisponibles.map(o => <option key={o} value={o}>Orden N° {o}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontWeight: 'bold', marginRight: '8px', color: '#334155' }}>🏭 Máquina:</label>
            <select 
              value={filtroMaquina} 
              onChange={(e) => setFiltroMaquina(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold', cursor: 'pointer' }}
            >
              <option value="TODOS">Todas</option>
              {maquinasDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontWeight: 'bold', marginRight: '8px', color: '#334155' }}>📂 Zona:</label>
            <select 
              value={filtroZona} 
              onChange={(e) => setFiltroZona(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold', cursor: 'pointer' }}
            >
              <option value="TODOS">Ambas</option>
              <option value="feed">Feed</option>
              <option value="salida">Salida</option>
            </select>
          </div>

          <div>
            <label style={{ fontWeight: 'bold', marginRight: '8px', color: '#0d6efd' }}>📅 Mes:</label>
            <select 
              value={mesSeleccionado} 
              onChange={(e) => setMesSeleccionado(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #0d6efd', fontWeight: 'bold', color: '#0d6efd', cursor: 'pointer' }}
            >
              <option value="TODOS">Histórico</option>
              {mesesDisponibles.map(mes => (
                <option key={mes} value={mes}>{formatearClaveMes(mes)}</option>
              ))}
            </select>
          </div>

        </div>

        {/* TABLA */}
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0, color: '#1e293b', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
            📋 Detalle Cronológico de Merma ({registrosFiltrados.length} registros)
          </h3>

          {cargando ? (
            <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>Cargando registros de auditoría...</p>
          ) : registrosFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <p style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>No se encontraron registros de scrap para la orden o filtros seleccionados.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.95rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Fecha y Hora</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Máquina</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Zona</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>N° Orden</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Cliente / Producto</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Motivo Oficial (RE-PRO 014)</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Piezas</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Peso (Kg)</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: Number(item.peso_kg) > 30 ? '#fff5f5' : 'white' }}>
                      <td style={{ padding: '12px', color: '#475569', fontSize: '0.85rem' }}>
                        {new Date(item.fecha_registro).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#0f172a' }}>{item.codigo_maquina}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: item.zona === 'feed' ? '#e0f2fe' : '#fef3c7', color: item.zona === 'feed' ? '#0369a1' : '#b45309', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          {item.zona.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#dc2626' }}>{item.orden_id || 'N/A'}</td>
                      <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                        <strong>{item.cliente || 'Stock General'}</strong><br/>
                        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{item.producto_descripcion || '-'}</span>
                      </td>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#1e293b' }}>{item.motivo}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#2563eb' }}>{item.cantidad_piezas}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: Number(item.peso_kg) > 30 ? '#dc2626' : '#059669', fontSize: '1.05rem' }}>
                        {Number(item.peso_kg).toFixed(2)} Kg
                      </td>
                      <td style={{ padding: '12px', color: '#64748b', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        {item.observaciones || 'Sin observaciones'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}