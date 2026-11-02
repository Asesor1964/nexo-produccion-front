import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api'; // 👈 IMPORTACIÓN CENTRALIZADA

export default function PantallaHistorial() {
  const [historial, setHistorial] = useState([]);
  const [terminoBusqueda, setTerminoBusqueda] = useState('');

  // 1. Conectar con la nueva ruta del backend usando apiFetch
  const cargarHistorial = async () => {
    try {
      const respuesta = await apiFetch('/api/pedidos/historial');
      if (respuesta.ok) {
        const datos = await respuesta.json();
        setHistorial(datos);
      }
    } catch (error) {
      console.error('Error al cargar el historial:', error);
    }
  };

  useEffect(() => {
    cargarHistorial();
  }, []);

  // 2. Buscador dinámico (Filtra por Cliente o N° Orden al instante)
  const historialFiltrado = historial.filter(pedido => {
    const busqueda = terminoBusqueda.toLowerCase();
    const clienteMatch = pedido.cliente ? pedido.cliente.toLowerCase().includes(busqueda) : false;
    const ordenMatch = pedido.numero_orden ? pedido.numero_orden.toString().includes(busqueda) : false;
    return clienteMatch || ordenMatch;
  });

  return (
    <div style={{ padding: '2rem', width: '100%', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* CABECERA GERENCIAL */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', borderBottom: '3px solid #6f42c1', paddingBottom: '10px' }}>
        <span style={{ fontSize: '2.5rem', marginRight: '15px' }}>📊</span>
        <h2 style={{ color: '#6f42c1', margin: 0, fontSize: '2rem' }}>Historial de Producción (Gerencia)</h2>
      </div>

      {/* PANEL DE CONTROL: BUSCADOR Y MÉTRICAS BÁSICAS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '2rem', borderLeft: '5px solid #17a2b8' }}>
        <div style={{ flex: 1, marginRight: '2rem' }}>
          <label style={{ fontWeight: 'bold', color: '#495057', display: 'block', marginBottom: '5px' }}>Buscar Orden o Cliente:</label>
          <input 
            type="text" 
            placeholder="Ej: CARTON TUCUMAN o 48185..."
            value={terminoBusqueda}
            onChange={(e) => setTerminoBusqueda(e.target.value)}
            style={{ padding: '10px', width: '100%', borderRadius: '5px', border: '2px solid #ced4da', fontSize: '1.1rem' }}
          />
        </div>
        <div style={{ textAlign: 'right', paddingRight: '1rem' }}>
          <p style={{ margin: 0, fontSize: '1rem', color: '#6c757d' }}>Total de Órdenes Finalizadas</p>
          <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: 'bold', color: '#28a745' }}>{historial.length}</p>
        </div>
      </div>

      {/* TABLA DE RESULTADOS HISTÓRICOS */}
      <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '15px 10px', textAlign: 'left', color: '#495057' }}>N° Orden</th>
                <th style={{ padding: '15px 10px', textAlign: 'left', color: '#495057' }}>Cliente y Producto</th>
                <th style={{ padding: '15px 10px', textAlign: 'center', color: '#495057' }}>Máquina</th>
                <th style={{ padding: '15px 10px', textAlign: 'center', color: '#495057' }}>Prog.</th>
                <th style={{ padding: '15px 10px', textAlign: 'center', color: '#0056b3' }}>Real</th>
                <th style={{ padding: '15px 10px', textAlign: 'center', color: '#495057' }}>Rendimiento</th>
                <th style={{ padding: '15px 10px', textAlign: 'center', color: '#495057' }}>Estado</th>
              </tr>
            </thead>
            
            <tbody>
              {historialFiltrado.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#6c757d', fontSize: '1.2rem' }}>
                    No hay registros de producción finalizada para mostrar.
                  </td>
                </tr>
              ) : (
                historialFiltrado.map(pedido => {
                  // Cálculos gerenciales
                  const programado = Number(pedido.cantidad_programada) || 0;
                  const real = Number(pedido.cantidad_fabricada) || 0;
                  const diferencia = real - programado;
                  
                  // Colores dinámicos según el rendimiento
                  let colorDiferencia = '#6c757d'; // Gris si es exacto
                  if (diferencia > 0) colorDiferencia = '#28a745'; // Verde si hizo de más
                  if (diferencia < 0) colorDiferencia = '#dc3545'; // Rojo si hizo de menos

                  return (
                    <tr key={pedido.numero_orden} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '15px 10px', fontWeight: 'bold', fontSize: '1.1rem' }}>{pedido.numero_orden}</td>
                      <td style={{ padding: '15px 10px' }}>
                        <strong>{pedido.cliente}</strong><br/>
                        <span style={{ fontSize: '0.85rem', color: '#555' }}>{pedido.producto_descripcion}</span>
                      </td>
                      <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: '#17a2b8' }}>
                        {pedido.maquina_asignada}
                      </td>
                      <td style={{ padding: '15px 10px', textAlign: 'center', color: '#6c757d' }}>{programado}</td>
                      <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: '#0056b3' }}>
                        {real}
                      </td>
                      <td style={{ padding: '15px 10px', textAlign: 'center', fontWeight: 'bold', color: colorDiferencia }}>
                        {diferencia > 0 ? '+' : ''}{diferencia}
                      </td>
                      <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                        <span style={{ padding: '6px 12px', borderRadius: '20px', backgroundColor: '#d4edda', color: '#155724', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          ✔️ Finalizada
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}