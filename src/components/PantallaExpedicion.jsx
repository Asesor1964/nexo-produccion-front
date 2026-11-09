import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';

export default function PantallaExpedicion() {
  const [pestanaActiva, setPestanaActiva] = useState('stock'); // 'stock' | 'traspaso' | 'despacho' | 'informes'
  const [stockGalpon, setStockGalpon] = useState([]);
  const [stockFisico, setStockFisico] = useState([]); // Lista de pallets individuales para despachos
  const [busqueda, setBusqueda] = useState('');
  
  // Estados para modal CRUD Manual
  const [mostrarModalCrud, setMostrarModalCrud] = useState(false);
  const [palletEditando, setPalletEditando] = useState(null);
  const [formCrud, setFormCrud] = useState({
    numero_orden: '',
    cliente: '',
    producto_descripcion: '',
    unidades: '',
    m2_unitario: '',
    estado: 'En Galpón'
  });

  // Estados para Importar desde Producción
  const [mostrarModalImportar, setMostrarModalImportar] = useState(false);
  const [ordenesProducidas, setOrdenesProducidas] = useState([]);
  const [ordenSeleccionadaImportar, setOrdenSeleccionadaImportar] = useState(null);
  const [cantidadAImportar, setCantidadAImportar] = useState('');
  const [capacidadImportar, setCapacidadImportar] = useState(1000);

  // Estados para Traspaso
  const [traspasoData, setTraspasoData] = useState({ pallet_origen_id: '', orden_destino: '', unidades: '' });

  // Estados para Despacho
  const [despachoData, setDespachoData] = useState({ pallet_id: '', unidades: '', remito: '' });

  // Estados para Informes
  const [informeTipo, setInformeTipo] = useState('dia');
  const [fechaInforme, setFechaInforme] = useState(new Date().toISOString().split('T')[0]);
  const [datosInforme, setDatosInforme] = useState([]);

  const cargarDatos = async () => {
    try {
      // 1. Stock resumido para la tabla principal
      const resStock = await apiFetch('/api/expedicion/stock');
      if (resStock.ok) setStockGalpon(await resStock.json());

      // 2. Stock físico individual para selects de despacho y traspaso
      const resFisico = await apiFetch('/api/expedicion/stock-fisico');
      if (resFisico.ok) setStockFisico(await resFisico.json());
    } catch (err) {
      console.error('Error al cargar datos de expedición:', err);
    }
  };

  const cargarOrdenesProducidas = async () => {
    try {
      const res = await apiFetch('/api/expedicion/ordenes-producidas');
      if (res.ok) {
        const data = await res.json();
        setOrdenesProducidas(data);
        setOrdenSeleccionadaImportar(null);
        setCantidadAImportar('');
        setCapacidadImportar(1000);
        setMostrarModalImportar(true);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`❌ No se pudieron obtener las órdenes: ${errData.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Error al cargar órdenes producidas:', err);
      alert('❌ Error de conexión al buscar órdenes producidas.');
    }
  };

  // Confirmar Importación con desglose automático de pallets
  const confirmarImportacionProduccion = async () => {
    if (!ordenSeleccionadaImportar || !cantidadAImportar || Number(cantidadAImportar) <= 0) {
      alert('⚠️ Selecciona una orden e ingresa una cantidad de unidades válida.');
      return;
    }

    const numOrden = ordenSeleccionadaImportar.numero_orden || ordenSeleccionadaImportar.orden || ordenSeleccionadaImportar.id;
    const maq = ordenSeleccionadaImportar.maquina || ordenSeleccionadaImportar.codigo_maquina || 'PLANTA';
    const cli = ordenSeleccionadaImportar.cliente || 'Sin Cliente';
    const prod = ordenSeleccionadaImportar.producto_descripcion || ordenSeleccionadaImportar.descripcion || ordenSeleccionadaImportar.producto || 'Producto';

    try {
      const res = await apiFetch('/api/expedicion/pallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_orden: numOrden,
          maquina: maq,
          cliente: cli,
          producto_descripcion: prod,
          cantidad_unidades: Number(cantidadAImportar),
          capacidad_standard: Number(capacidadImportar) || 1000
        })
      });

      if (res.ok) {
        alert('✅ Orden importada y desglosada en pallets físicos con éxito.');
        setMostrarModalImportar(false);
        setOrdenSeleccionadaImportar(null);
        setCantidadAImportar('');
        cargarDatos();
      } else {
        const errData = await res.json();
        alert(`❌ Error al importar: ${errData.error || 'Error desconocido'}`);
      }
    } catch (err) {
      console.error('Error al importar orden:', err);
    }
  };

  const cargarInformes = async () => {
    try {
      const res = await apiFetch(`/api/expedicion/informes?periodo=${informeTipo}&fecha=${fechaInforme}`);
      if (res.ok) setDatosInforme(await res.json());
    } catch (err) {
      console.error('Error al cargar informes:', err);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (pestanaActiva === 'informes') cargarInformes();
  }, [pestanaActiva, fechaInforme, informeTipo]);

  // Función para eliminar todos los pallets activos de una orden en la vista resumida
  const eliminarOrdenCompleta = async (numeroOrden) => {
    if (!window.confirm(`¿Seguro que deseas eliminar los registros de la Orden #${numeroOrden}?`)) return;
    try {
      const res = await apiFetch(`/api/expedicion/orden/${numeroOrden}`, { method: 'DELETE' });
      if (res.ok) {
        cargarDatos();
      } else {
        alert('❌ Error al eliminar la orden.');
      }
    } catch (err) {
      console.error('Error al eliminar orden completa:', err);
    }
  };

  const ejecutarTraspaso = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/expedicion/traspaso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pallet_origen_id: traspasoData.pallet_origen_id,
          orden_destino: Number(traspasoData.orden_destino),
          unidades_a_traspasar: Number(traspasoData.unidades)
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('✅ Traspaso realizado con éxito.');
        setTraspasoData({ pallet_origen_id: '', orden_destino: '', unidades: '' });
        cargarDatos();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Error en traspaso:', err);
    }
  };

  const ejecutarDespacho = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/expedicion/despachar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pallet_id: despachoData.pallet_id,
          unidades_despachadas: Number(despachoData.unidades),
          remito: despachoData.remito
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Despacho registrado. m² sumados: ${Number(data.m2_despachados).toFixed(2)} m²`);
        setDespachoData({ pallet_id: '', unidades: '', remito: '' });
        cargarDatos();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Error en despacho:', err);
    }
  };

  const stockFiltrado = stockGalpon.filter(p => 
    String(p.numero_orden).includes(busqueda) || 
    String(p.cliente || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    String(p.producto_descripcion || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', borderBottom: '3px solid #0d6efd', paddingBottom: '10px' }}>
        <span style={{ fontSize: '2.5rem', marginRight: '15px' }}>🚚</span>
        <h2 style={{ color: '#0d6efd', margin: 0, fontSize: '2rem' }}>Terminal de Expedición y Logística</h2>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button onClick={() => setPestanaActiva('stock')} style={estiloPestana(pestanaActiva === 'stock')}>📦 Stock en Galpón (Resumen)</button>
        <button onClick={() => setPestanaActiva('traspaso')} style={estiloPestana(pestanaActiva === 'traspaso')}>🔄 Traspaso Genéricos</button>
        <button onClick={() => setPestanaActiva('despacho')} style={estiloPestana(pestanaActiva === 'despacho')}>🚚 Registrar Despacho</button>
        <button onClick={() => setPestanaActiva('informes')} style={estiloPestana(pestanaActiva === 'informes')}>📊 Informes m²</button>
      </div>

      {/* CONTENIDO 1: STOCK RESUMIDO */}
      {pestanaActiva === 'stock' && (
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <input 
              type="text" 
              placeholder="🔍 Buscar por N° Orden, Cliente o Producto..." 
              value={busqueda} 
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ padding: '10px', width: '350px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '1rem' }}
            />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={cargarOrdenesProducidas} style={{ padding: '10px 20px', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
                📥 Traer de Producción
              </button>
              <button onClick={() => {
                setPalletEditando(null);
                setFormCrud({ numero_orden: '', cliente: '', producto_descripcion: '', unidades: '', m2_unitario: '', estado: 'En Galpón', cant_completos: '', capacidad_completos: '', unidades_saldo: '' });
                setMostrarModalCrud(true);
              }} style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
                ➕ Nuevo Pallet Manual
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '12px' }}>Orden</th>
                  <th style={{ padding: '12px' }}>Cliente</th>
                  <th style={{ padding: '12px' }}>Producto</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Stock Total (Cajas)</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>m² Stock</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Desglose de Pallets</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {stockFiltrado.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#6c757d' }}>No hay stock en galpón. Usa "📥 Traer de Producción".</td></tr>
                ) : (
                  stockFiltrado.map(p => (
                    <tr key={p.numero_orden} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>#{p.numero_orden}</td>
                      <td style={{ padding: '12px' }}>{p.cliente}</td>
                      <td style={{ padding: '12px', fontSize: '0.9rem', color: '#555' }}>{p.producto_descripcion}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#0d6efd' }}>{p.stock_total_cajas} u.</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#198754' }}>{Number(p.m2_stock_total || 0).toFixed(2)} m²</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', color: '#495057' }}>
                        📦 <strong>{p.pallets_completos}</strong> comp. / <strong>{p.pallets_parciales}</strong> parc. <br/>
                        <span style={{ color: '#6c757d', fontSize: '0.8rem' }}>{p.detalle_pallets}</span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                          <button onClick={() => setPestanaActiva('despacho')} style={{ padding: '6px 12px', backgroundColor: '#198754', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>🚚 Despachar</button>
                          <button onClick={() => eliminarOrdenCompleta(p.numero_orden)} style={{ padding: '6px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }} title="Eliminar pallets de esta orden">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTENIDO 2: TRASPASO */}
      {pestanaActiva === 'traspaso' && (
        <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', maxWidth: '600px', margin: '0 auto', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#343a40', marginTop: 0 }}>🔄 Reasignar Producto Genérico a otro Pedido</h3>
          <form onSubmit={ejecutarTraspaso} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '1.5rem' }}>
            <label style={{ fontWeight: 'bold' }}>Seleccionar Pallet Físico Origen:</label>
            <select value={traspasoData.pallet_origen_id} onChange={(e) => setTraspasoData({...traspasoData, pallet_origen_id: e.target.value})} required style={{ padding: '10px', fontSize: '1rem', borderRadius: '5px', border: '1px solid #ccc' }}>
              <option value="">-- Seleccione Pallet Físico --</option>
              {stockFisico.map(p => (
                <option key={p.id} value={p.id}>
                  Pallet #{p.id} | Ord: {p.numero_orden} | {p.cliente} | Stock: {p.cantidad_unidades} u.
                </option>
              ))}
            </select>
            <label style={{ fontWeight: 'bold' }}>N° de Orden Destino:</label>
            <input type="number" placeholder="Ej: 48320" value={traspasoData.orden_destino} onChange={(e) => setTraspasoData({...traspasoData, orden_destino: e.target.value})} required style={{ padding: '10px', fontSize: '1rem', borderRadius: '5px', border: '1px solid #ccc' }} />
            <label style={{ fontWeight: 'bold' }}>Cantidad de Unidades a Traspasar:</label>
            <input type="number" placeholder="Ej: 500" value={traspasoData.unidades} onChange={(e) => setTraspasoData({...traspasoData, unidades: e.target.value})} required style={{ padding: '10px', fontSize: '1rem', borderRadius: '5px', border: '1px solid #ccc' }} />
            <button type="submit" style={{ padding: '12px', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}>Confirmar Traspaso</button>
          </form>
        </div>
      )}

      {/* CONTENIDO 3: REGISTRAR DESPACHO (Usa stock físico individual) */}
      {pestanaActiva === 'despacho' && (
        <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', maxWidth: '600px', margin: '0 auto', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#343a40', marginTop: 0 }}>🚚 Despacho por Pallet Físico (Total o Parcial)</h3>
          <p style={{ color: '#666', fontSize: '0.95rem' }}>Selecciona el pallet físico exacto que se retira. Si el cliente lleva solo una parte, el remanente queda en galpón.</p>

          <form onSubmit={ejecutarDespacho} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '1.5rem' }}>
            <label style={{ fontWeight: 'bold' }}>Seleccionar Pallet Físico:</label>
            <select value={despachoData.pallet_id} onChange={(e) => setDespachoData({...despachoData, pallet_id: e.target.value})} required style={{ padding: '10px', fontSize: '1rem', borderRadius: '5px', border: '1px solid #ccc' }}>
              <option value="">-- Seleccione Pallet Físico --</option>
              {stockFisico.map(p => (
                <option key={p.id} value={p.id}>
                  Pallet #{p.id} | Ord: {p.numero_orden} | {p.cliente} | Disp: {p.cantidad_unidades} u. {p.es_parcial ? '(Parcial)' : '(Completo)'}
                </option>
              ))}
            </select>

            <label style={{ fontWeight: 'bold' }}>Cantidad a Despachar (Unidades):</label>
            <input type="number" placeholder="Ej: 1000" value={despachoData.unidades} onChange={(e) => setDespachoData({...despachoData, unidades: e.target.value})} required style={{ padding: '10px', fontSize: '1rem', borderRadius: '5px', border: '1px solid #ccc' }} />

            <label style={{ fontWeight: 'bold' }}>N° de Remito / Transporte:</label>
            <input type="text" placeholder="Ej: Remito 0001-00004589" value={despachoData.remito} onChange={(e) => setDespachoData({...despachoData, remito: e.target.value})} style={{ padding: '10px', fontSize: '1rem', borderRadius: '5px', border: '1px solid #ccc' }} />

            <button type="submit" style={{ padding: '12px', backgroundColor: '#198754', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}>✅ Registrar Salida y Descontar Stock</button>
          </form>
        </div>
      )}

      {/* CONTENIDO 4: INFORMES */}
      {pestanaActiva === 'informes' && (
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0, color: '#343a40' }}>📊 Reporte de Metros Cuadrados Despachados</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select value={informeTipo} onChange={(e) => setInformeTipo(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}>
                <option value="dia">Por Día</option>
                <option value="mes">Por Mes</option>
              </select>
              {informeTipo === 'dia' && <input type="date" value={fechaInforme} onChange={(e) => setFechaInforme(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }} />}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '12px' }}>Fecha / Periodo</th>
                  <th style={{ padding: '12px' }}>N° Orden</th>
                  <th style={{ padding: '12px' }}>Cliente</th>
                  <th style={{ padding: '12px' }}>Producto</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Cajas Despachadas</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Metros Cuadrados (m²)</th>
                </tr>
              </thead>
              <tbody>
                {datosInforme.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#6c757d' }}>No hay registros de despachos.</td></tr>
                ) : (
                  datosInforme.map((inf, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '12px' }}>{inf.fecha ? String(inf.fecha).split('T')[0] : inf.periodo}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{inf.numero_orden}</td>
                      <td style={{ padding: '12px' }}>{inf.cliente}</td>
                      <td style={{ padding: '12px', fontSize: '0.9rem', color: '#555' }}>{inf.producto_descripcion}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{inf.total_unidades}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#198754' }}>{Number(inf.total_m2).toFixed(2)} m²</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL IMPORTAR DESDE PRODUCCIÓN */}
      {mostrarModalImportar && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', width: '90%', maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, color: '#0d6efd' }}>📥 Traer Orden desde Producción</h3>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>Selecciona una orden para desglosarla automáticamente en pallets físicos (completos y parciales).</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '1.5rem 0' }}>
              <label style={{ fontWeight: 'bold' }}>Órdenes Registradas en Planta:</label>
              <select onChange={(e) => {
                const idx = e.target.value;
                const encontrada = idx !== '' ? ordenesProducidas[Number(idx)] : null;
                setOrdenSeleccionadaImportar(encontrada);
                if (encontrada) {
                  setCantidadAImportar(encontrada.cantidad_fabricada || encontrada.cantidad_producida || encontrada.unidades_producidas || encontrada.cantidad_programada || encontrada.cantidad || '');
                } else {
                  setCantidadAImportar('');
                }
              }} style={{ padding: '10px', fontSize: '1rem', borderRadius: '5px', border: '1px solid #ccc' }}>
                <option value="">-- Seleccione una Orden --</option>
                {ordenesProducidas.map((ord, index) => {
                  const numOrd = ord.numero_orden || ord.orden || ord.id_orden || index + 1;
                  const desc = ord.producto_descripcion || ord.descripcion || ord.producto || '';
                  const cantFab = ord.cantidad_fabricada || ord.cantidad_producida || ord.unidades_producidas || 0;
                  return (
                    <option key={index} value={index}>
                      Orden #{numOrd} | {ord.cliente} | {desc} [{ord.estado || 'S/E'}] (Fab: {cantFab})
                    </option>
                  );
                })}
              </select>

              <label style={{ fontWeight: 'bold' }}>Cantidad Total a Ingresar:</label>
              <input type="number" value={cantidadAImportar} onChange={(e) => setCantidadAImportar(e.target.value)} placeholder="Ej: 4800" style={{ padding: '10px', fontSize: '1rem', borderRadius: '5px', border: '1px solid #ccc' }} />

              <label style={{ fontWeight: 'bold' }}>Capacidad Estándar por Pallet (Unidades):</label>
              <input type="number" value={capacidadImportar} onChange={(e) => setCapacidadImportar(e.target.value)} placeholder="Ej: 1000" style={{ padding: '10px', fontSize: '1rem', borderRadius: '5px', border: '1px solid #ccc' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem' }}>
              <button type="button" onClick={() => setMostrarModalImportar(false)} style={{ padding: '10px 15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
              <button type="button" onClick={confirmarImportacionProduccion} style={{ padding: '10px 20px', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>📥 Ingresar y Desglosar Pallets</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREACIÓN MANUAL INTELIGENTE Y POR LOTES */}
      {mostrarModalCrud && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', width: '90%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, color: '#0d6efd' }}>➕ Ingreso Manual de Pallets por Lotes</h3>
            <p style={{ color: '#666', fontSize: '0.85rem' }}>Ingrese el N° de orden para autocompletar y desglose los bultos físicos que ingresan al galpón.</p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const cantComp = Number(formCrud.cant_completos) || 0;
                const capComp = Number(formCrud.capacidad_completos) || 0;
                const saldo = Number(formCrud.unidades_saldo) || 0;

                if ((cantComp > 0 && capComp <= 0) || (cantComp <= 0 && saldo <= 0)) {
                  alert('⚠️ Indique al menos pallets completos con su capacidad, o un saldo válido.');
                  return;
                }

                // 1. Guardar los pallets completos si los hay
                for (let i = 0; i < cantComp; i++) {
                  await apiFetch('/api/expedicion/pallets/crud', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      numero_orden: Number(formCrud.numero_orden),
                      cliente: formCrud.cliente,
                      producto_descripcion: formCrud.producto_descripcion,
                      unidades: capComp,
                      m2_unitario: Number(formCrud.m2_unitario),
                      es_parcial: false,
                      estado: 'En Galpón'
                    })
                  });
                }

                // 2. Guardar el pallet de saldo/parcial si existe
                if (saldo > 0) {
                  await apiFetch('/api/expedicion/pallets/crud', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      numero_orden: Number(formCrud.numero_orden),
                      cliente: formCrud.cliente,
                      producto_descripcion: formCrud.producto_descripcion,
                      unidades: saldo,
                      m2_unitario: Number(formCrud.m2_unitario),
                      es_parcial: true,
                      estado: 'En Galpón'
                    })
                  });
                }

                alert('✅ Lotes de pallets registrados con éxito en el galpón.');
                setMostrarModalCrud(false);
                cargarDatos();
              } catch (err) {
                console.error('Error al guardar lotes manuales:', err);
                alert('❌ Error al registrar los pallets.');
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <label style={{ fontWeight: 'bold' }}>N° de Orden (Autocompleta datos):</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
  type="number" 
  value={formCrud.numero_orden} 
  onChange={async (e) => {
    const val = e.target.value;
    setFormCrud(prev => ({ ...prev, numero_orden: val }));
    
    // 🛡️ Solo busca en la API cuando el número de orden tiene al menos 4 dígitos
    if (val.length >= 5) {
      try {
        const res = await apiFetch(`/api/expedicion/ordenes/buscar/${val}`);
        if (res.ok) {
          const datos = await res.json();
          setFormCrud(prev => ({
            ...prev,
            cliente: datos.cliente,
            producto_descripcion: datos.producto_descripcion,
            m2_unitario: datos.m2_unitario
          }));
        }
      } catch (err) {
        // Silencioso
      }
    }
  }} 
  placeholder="Ej: 48326"
  required 
  style={{ ...estiloInput(), flex: 1, fontWeight: 'bold', fontSize: '1.1rem', color: '#0d6efd' }} 
/>
              </div>
              
              <label>Cliente:</label>
              <input type="text" value={formCrud.cliente} onChange={(e) => setFormCrud({...formCrud, cliente: e.target.value})} required style={estiloInput()} />

              <label>Descripción del Producto:</label>
              <input type="text" value={formCrud.producto_descripcion} onChange={(e) => setFormCrud({...formCrud, producto_descripcion: e.target.value})} required style={estiloInput()} />

              <label>m² Unitario:</label>
              <input type="number" step="0.0001" value={formCrud.m2_unitario} onChange={(e) => setFormCrud({...formCrud, m2_unitario: e.target.value})} required style={estiloInput()} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                <div>
                  <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Cant. Pallets Completos:</label>
                  <input type="number" placeholder="Ej: 2" value={formCrud.cant_completos || ''} onChange={(e) => setFormCrud({...formCrud, cant_completos: e.target.value})} style={estiloInput()} />
                </div>
                <div>
                  <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Unidades por Pallet:</label>
                  <input type="number" placeholder="Ej: 1680" value={formCrud.capacidad_completos || ''} onChange={(e) => setFormCrud({...formCrud, capacidad_completos: e.target.value})} style={estiloInput()} />
                </div>
              </div>

              <div style={{ backgroundColor: '#fff3cd', padding: '12px', borderRadius: '8px', border: '1px solid #ffecb5' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#856404' }}>Pallet de Saldo / Parcial (Opcional):</label>
                <input type="number" placeholder="Ej: 580 unidades" value={formCrud.unidades_saldo || ''} onChange={(e) => setFormCrud({...formCrud, unidades_saldo: e.target.value})} style={{ ...estiloInput(), marginTop: '5px' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
                <button type="button" onClick={() => setMostrarModalCrud(false)} style={{ padding: '10px 15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>💾 Registrar Lotes en Galpón</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function estiloPestana(activa) {
  return {
    padding: '10px 20px',
    backgroundColor: activa ? '#0d6efd' : '#f8f9fa',
    color: activa ? 'white' : '#333',
    border: '1px solid #ccc',
    borderRadius: '5px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '1rem'
  };
}

function estiloInput() {
  return {
    padding: '8px',
    fontSize: '1rem',
    borderRadius: '4px',
    border: '1px solid #ccc',
    width: '100%',
    boxSizing: 'border-box'
  };
}