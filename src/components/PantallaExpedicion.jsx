import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';

export default function PantallaExpedicion() {
  const [pestanaActiva, setPestanaActiva] = useState('stock'); // 'stock' | 'traspaso' | 'despacho' | 'informes'
  const [stockGalpon, setStockGalpon] = useState([]);
  const [stockFisico, setStockFisico] = useState([]); // Lista de pallets individuales
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
    estado: 'En Galpón',
    cant_completos: '',
    capacidad_completos: '',
    unidades_saldo: ''
  });

  // 📦 ESTADOS PARA IMPORTACIÓN MÚLTIPLE DESDE PRODUCCIÓN (CON CHECKBOXES)
  const [mostrarModalImportar, setMostrarModalImportar] = useState(false);
  const [ordenesProducidas, setOrdenesProducidas] = useState([]);
  const [ordenesSeleccionadasImportar, setOrdenesSeleccionadasImportar] = useState({}); // { [numOrden]: { orden, cantidad, capacidad } }
  const [filtroModalImportar, setFiltroModalImportar] = useState('');
  const [capacidadGlobalImportar, setCapacidadGlobalImportar] = useState(1000);
  const [procesandoImportacion, setProcesandoImportacion] = useState(false);

  // Estados para Traspaso
  const [traspasoData, setTraspasoData] = useState({ pallet_origen_id: '', orden_destino: '', unidades: '' });

  // 🚚 ESTADOS PARA DESPACHO MÚLTIPLE (POR LOTES / CAMIÓN)
  const [filtroOrdenDespacho, setFiltroOrdenDespacho] = useState('');
  const [palletsSeleccionados, setPalletsSeleccionados] = useState({}); // { [palletId]: cantidadADespachar }
  const [remitoDespacho, setRemitoDespacho] = useState('');
  const [cantidadRapidaPallets, setCantidadRapidaPallets] = useState('');
  const [procesandoDespacho, setProcesandoDespacho] = useState(false);

  // Estados para Informes
  const [informeTipo, setInformeTipo] = useState('dia');
  const [fechaInforme, setFechaInforme] = useState(new Date().toISOString().split('T')[0]);
  const [datosInforme, setDatosInforme] = useState([]);

  const cargarDatos = async () => {
    try {
      const resStock = await apiFetch('/api/expedicion/stock');
      if (resStock.ok) setStockGalpon(await resStock.json());

      const resFisico = await apiFetch('/api/expedicion/stock-fisico');
      if (resFisico.ok) setStockFisico(await resFisico.json());
    } catch (err) {
      console.error('Error al cargar datos de expedición:', err);
    }
  };

  // =========================================================================
  // 📥 LÓGICA DE IMPORTACIÓN MÚLTIPLE DESDE PRODUCCIÓN
  // =========================================================================

  const obtenerNumeroOrden = (ord, idx = 0) =>
    ord.numero_orden || ord.orden || ord.id_orden || ord.id || idx + 1;

  const obtenerCantidadSugerida = (ord) => {
    const fab = Number(ord.cantidad_fabricada || ord.cantidad_producida || ord.unidades_producidas || 0);
    if (fab > 0) return fab;
    const prog = Number(ord.cantidad_programada || ord.cantidad || 0);
    return prog > 0 ? prog : 1000;
  };

  const cargarOrdenesProducidas = async () => {
    try {
      const res = await apiFetch('/api/expedicion/ordenes-producidas');
      if (res.ok) {
        const data = await res.json();
        setOrdenesProducidas(data);
        setOrdenesSeleccionadasImportar({});
        setFiltroModalImportar('');
        setCapacidadGlobalImportar(1000);
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

  // Filtrar órdenes dentro del modal por buscador
  const ordenesProducidasFiltradas = ordenesProducidas.filter((ord, idx) => {
    if (!filtroModalImportar.trim()) return true;
    const t = filtroModalImportar.toLowerCase().trim();
    const numOrd = String(obtenerNumeroOrden(ord, idx));
    const cli = String(ord.cliente || '').toLowerCase();
    const desc = String(ord.descripcion_producto || ord.producto_descripcion || ord.descripcion || ord.producto || '').toLowerCase();
    return numOrd.includes(t) || cli.includes(t) || desc.includes(t);
  });

  // Tildar o destildar una orden individual para importar
  const toggleSeleccionOrdenImportar = (ord, idx) => {
    const numOrd = String(obtenerNumeroOrden(ord, idx));
    setOrdenesSeleccionadasImportar(prev => {
      const copia = { ...prev };
      if (copia[numOrd]) {
        delete copia[numOrd];
      } else {
        copia[numOrd] = {
          orden: ord,
          cantidad: obtenerCantidadSugerida(ord),
          capacidad: Number(capacidadGlobalImportar) || 1000
        };
      }
      return copia;
    });
  };

  // Seleccionar o desmarcar todas las órdenes visibles (omite por defecto las que ya están en galpón)
  const seleccionarTodasOrdenesImportar = () => {
    const ordenesEnGalponSet = new Set(stockGalpon.map(s => String(s.numero_orden)));
    const candidatas = ordenesProducidasFiltradas.filter((ord, idx) => !ordenesEnGalponSet.has(String(obtenerNumeroOrden(ord, idx))));
    const listaBase = candidatas.length > 0 ? candidatas : ordenesProducidasFiltradas;

    const todasMarcadas = listaBase.length > 0 &&
      listaBase.every((ord, idx) => ordenesSeleccionadasImportar[String(obtenerNumeroOrden(ord, idx))] !== undefined);

    if (todasMarcadas) {
      const copia = { ...ordenesSeleccionadasImportar };
      ordenesProducidasFiltradas.forEach((ord, idx) => {
        delete copia[String(obtenerNumeroOrden(ord, idx))];
      });
      setOrdenesSeleccionadasImportar(copia);
    } else {
      const copia = { ...ordenesSeleccionadasImportar };
      listaBase.forEach((ord, idx) => {
        const numOrd = String(obtenerNumeroOrden(ord, idx));
        copia[numOrd] = {
          orden: ord,
          cantidad: obtenerCantidadSugerida(ord),
          capacidad: Number(capacidadGlobalImportar) || 1000
        };
      });
      setOrdenesSeleccionadasImportar(copia);
    }
  };

  const cambiarDatoOrdenSeleccionada = (numOrd, campo, valor) => {
    setOrdenesSeleccionadasImportar(prev => ({
      ...prev,
      [numOrd]: {
        ...prev[numOrd],
        [campo]: valor
      }
    }));
  };

  const aplicarCapacidadGlobalATodas = (nuevaCap) => {
    setCapacidadGlobalImportar(nuevaCap);
    setOrdenesSeleccionadasImportar(prev => {
      const copia = {};
      Object.keys(prev).forEach(k => {
        copia[k] = { ...prev[k], capacidad: Number(nuevaCap) || 1000 };
      });
      return copia;
    });
  };

  const confirmarImportacionProduccion = async () => {
    const claves = Object.keys(ordenesSeleccionadasImportar);
    if (claves.length === 0) {
      alert('⚠️ Tilda al menos una orden de la lista para ingresar al galpón.');
      return;
    }

    // Validar que todas las seleccionadas tengan cantidad > 0
    const sinCantidad = claves.filter(k => !ordenesSeleccionadasImportar[k].cantidad || Number(ordenesSeleccionadasImportar[k].cantidad) <= 0);
    if (sinCantidad.length > 0) {
      alert(`⚠️ La(s) orden(es) #${sinCantidad.join(', #')} tienen cantidad 0. Ingresa cuántas cajas se produjeron antes de importar.`);
      return;
    }

    setProcesandoImportacion(true);
    let importadasOk = 0;
    let errores = [];

    try {
      for (const key of claves) {
        const item = ordenesSeleccionadasImportar[key];
        const ord = item.orden;
        const numOrden = obtenerNumeroOrden(ord);
        const maq = ord.maquina_asignada || ord.maquina || ord.codigo_maquina || 'PLANTA';
        const cli = ord.cliente || 'Sin Cliente';
        const prod = ord.descripcion_producto || ord.producto_descripcion || ord.descripcion || ord.producto || 'Producto';

        const res = await apiFetch('/api/expedicion/pallets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numero_orden: numOrden,
            maquina: maq,
            cliente: cli,
            producto_descripcion: prod,
            cantidad_unidades: Number(item.cantidad),
            capacidad_standard: Number(item.capacidad) || 1000
          })
        });

        if (res.ok) {
          importadasOk++;
        } else {
          const errData = await res.json().catch(() => ({}));
          errores.push(`Orden #${numOrden}: ${errData.error || 'Error al importar'}`);
        }
      }

      if (errores.length === 0) {
        alert(`✅ Se importaron y desglosaron ${importadasOk} orden(es) en el galpón con éxito.`);
        setMostrarModalImportar(false);
        setOrdenesSeleccionadasImportar({});
        cargarDatos();
      } else {
        alert(`⚠️ Se importaron ${importadasOk} órdenes, pero hubo errores en:\n${errores.join('\n')}`);
        cargarDatos();
      }
    } catch (err) {
      console.error('Error al importar órdenes en lote:', err);
      alert('❌ Error de conexión al importar órdenes.');
    } finally {
      setProcesandoImportacion(false);
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

  // =========================================================================
  // 🚚 LÓGICA DE SELECCIÓN Y DESPACHO MÚLTIPLE (CHECKBOXES)
  // =========================================================================
  
  const palletsFiltradosDespacho = stockFisico.filter(p => {
    if (!filtroOrdenDespacho.trim()) return true;
    const termino = filtroOrdenDespacho.toLowerCase().trim();
    return (
      String(p.numero_orden).includes(termino) ||
      String(p.cliente || '').toLowerCase().includes(termino) ||
      String(p.producto_descripcion || '').toLowerCase().includes(termino)
    );
  });

  const toggleSeleccionPallet = (pallet) => {
    setPalletsSeleccionados(prev => {
      const copia = { ...prev };
      if (copia[pallet.id] !== undefined) {
        delete copia[pallet.id];
      } else {
        copia[pallet.id] = Number(pallet.cantidad_unidades);
      }
      return copia;
    });
  };

  const cambiarCantidadPalletSeleccionado = (palletId, maxUnidades, valor) => {
    const num = Number(valor);
    if (num < 0) return;
    setPalletsSeleccionados(prev => ({
      ...prev,
      [palletId]: num > maxUnidades ? maxUnidades : valor
    }));
  };

  const seleccionarTodosVisibles = () => {
    const todosMarcados = palletsFiltradosDespacho.length > 0 &&
      palletsFiltradosDespacho.every(p => palletsSeleccionados[p.id] !== undefined);

    if (todosMarcados) {
      const copia = { ...palletsSeleccionados };
      palletsFiltradosDespacho.forEach(p => delete copia[p.id]);
      setPalletsSeleccionados(copia);
    } else {
      const copia = { ...palletsSeleccionados };
      palletsFiltradosDespacho.forEach(p => {
        copia[p.id] = Number(p.cantidad_unidades);
      });
      setPalletsSeleccionados(copia);
    }
  };

  const seleccionarPrimerosNPallets = () => {
    const n = Number(cantidadRapidaPallets);
    if (!n || n <= 0) {
      alert('⚠️ Ingresa cuántos pallets entran en el camión (ej: 8).');
      return;
    }
    const primerosN = palletsFiltradosDespacho.slice(0, n);
    const nuevaSeleccion = {};
    primerosN.forEach(p => {
      nuevaSeleccion[p.id] = Number(p.cantidad_unidades);
    });
    setPalletsSeleccionados(nuevaSeleccion);
  };

  const idsSeleccionados = Object.keys(palletsSeleccionados);
  const resumenCamion = idsSeleccionados.reduce((acc, id) => {
    const palletObj = stockFisico.find(p => String(p.id) === String(id));
    const cant = Number(palletsSeleccionados[id]) || 0;
    if (palletObj && cant > 0) {
      acc.pallets += 1;
      acc.unidades += cant;
      acc.m2 += cant * Number(palletObj.m2_unitario || 0);
    }
    return acc;
  }, { pallets: 0, unidades: 0, m2: 0 });

  const ejecutarDespachoMultiple = async (e) => {
    e.preventDefault();
    if (resumenCamion.pallets === 0) {
      alert('⚠️ Debes tildar al menos un pallet para despachar.');
      return;
    }

    if (!window.confirm(`¿Confirmas la salida de ${resumenCamion.pallets} pallet(s) (${resumenCamion.unidades} cajas / ${resumenCamion.m2.toFixed(2)} m²)?`)) {
      return;
    }

    setProcesandoDespacho(true);
    let m2Acumulados = 0;
    let errores = [];

    try {
      for (const id of idsSeleccionados) {
        const cantDespachar = Number(palletsSeleccionados[id]);
        if (cantDespachar <= 0) continue;

        const res = await apiFetch('/api/expedicion/despachar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pallet_id: Number(id),
            unidades_despachadas: cantDespachar,
            remito: remitoDespacho || 'S/N'
          })
        });

        const data = await res.json();
        if (res.ok) {
          m2Acumulados += Number(data.m2_despachados || 0);
        } else {
          errores.push(`Pallet #${id}: ${data.error}`);
        }
      }

      if (errores.length === 0) {
        alert(`✅ ¡Despacho múltiple completado con éxito!\n📦 Pallets despachados: ${resumenCamion.pallets}\n📐 Total m²: ${m2Acumulados.toFixed(2)} m²`);
      } else {
        alert(`⚠️ Algunos pallets tuvieron problemas:\n${errores.join('\n')}`);
      }

      setPalletsSeleccionados({});
      setRemitoDespacho('');
      setCantidadRapidaPallets('');
      cargarDatos();
    } catch (err) {
      console.error('Error en despacho múltiple:', err);
      alert('❌ Error de conexión al procesar el despacho.');
    } finally {
      setProcesandoDespacho(false);
    }
  };

  const stockFiltrado = stockGalpon.filter(p => 
    String(p.numero_orden).includes(busqueda) || 
    String(p.cliente || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    String(p.producto_descripcion || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const ordenesUnicasEnGalpon = Array.from(new Set(stockFisico.map(p => p.numero_orden)));
  const cantidadOrdenesMarcadasImportar = Object.keys(ordenesSeleccionadasImportar).length;

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
                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', color: '#495057', maxWidth: '340px' }}>
                        <div style={{ marginBottom: '6px' }}>
                          📦 <strong>{p.pallets_completos}</strong> comp. /{' '}
                          <strong style={{ color: Number(p.pallets_parciales) > 0 ? '#d97706' : 'inherit' }}>
                            {p.pallets_parciales}
                          </strong>{' '}
                          parc.
                        </div>

                        {p.detalle_pallets && (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '5px',
                              justifyContent: 'center',
                              maxHeight: '68px',
                              overflowY: 'auto',
                              padding: '2px'
                            }}
                          >
                            {(() => {
                              const items = String(p.detalle_pallets)
                                .split('|')
                                .map(s => s.trim())
                                .filter(Boolean);

                              const cantidades = items.map(item => {
                                const match = item.match(/\((\d+)/);
                                return match ? parseInt(match[1], 10) : 0;
                              });
                              const maxCant = Math.max(...cantidades, 0);

                              return items.map((palletTxt, idx) => {
                                const match = palletTxt.match(/\((\d+)/);
                                const cant = match ? parseInt(match[1], 10) : maxCant;
                                const esParcial = Number(p.pallets_parciales) > 0 && cant < maxCant;

                                return (
                                  <span
                                    key={idx}
                                    style={{
                                      whiteSpace: 'nowrap',
                                      fontSize: '0.75rem',
                                      fontWeight: 'bold',
                                      padding: '2px 7px',
                                      borderRadius: '4px',
                                      backgroundColor: esParcial ? '#fff3cd' : '#f1f3f5',
                                      color: esParcial ? '#856404' : '#495057',
                                      border: esParcial ? '1px solid #ffc107' : '1px solid #dee2e6'
                                    }}
                                  >
                                    {palletTxt}
                                  </span>
                                );
                              });
                            })()}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                          <button 
                            onClick={() => {
                              setFiltroOrdenDespacho(String(p.numero_orden));
                              setPalletsSeleccionados({});
                              setPestanaActiva('despacho');
                            }} 
                            style={{ padding: '6px 12px', backgroundColor: '#198754', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                          >
                            🚚 Despachar
                          </button>
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

      {/* CONTENIDO 3: REGISTRAR DESPACHO */}
      {pestanaActiva === 'despacho' && (
        <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', maxWidth: '1000px', margin: '0 auto', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#343a40', marginTop: 0 }}>🚚 Consola de Carga de Camión (Selección Múltiple de Pallets)</h3>
          <p style={{ color: '#666', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            Filtra por el pedido a despachar, tilda los pallets que suben al camión (ej. 8 pallets) y registra la salida en un solo paso.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #dee2e6', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px', color: '#0d6efd' }}>
                1️⃣ Filtrar Pedido / Orden a Despachar:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="🔍 Escribe N° Orden o Cliente..."
                  value={filtroOrdenDespacho}
                  onChange={(e) => {
                    setFiltroOrdenDespacho(e.target.value);
                    setPalletsSeleccionados({});
                  }}
                  style={{ ...estiloInput(), flex: 1, fontWeight: 'bold' }}
                />
                <select
                  value={ordenesUnicasEnGalpon.includes(Number(filtroOrdenDespacho)) ? filtroOrdenDespacho : ''}
                  onChange={(e) => {
                    setFiltroOrdenDespacho(e.target.value);
                    setPalletsSeleccionados({});
                  }}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: 'white' }}
                >
                  <option value="">Ver todas las órdenes</option>
                  {ordenesUnicasEnGalpon.map(numOrd => {
                    const info = stockGalpon.find(s => Number(s.numero_orden) === Number(numOrd));
                    return (
                      <option key={numOrd} value={numOrd}>
                        Orden #{numOrd} - {info?.cliente || ''} ({info?.total_pallets_fisicos || ''} pallets)
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px', color: '#198754' }}>
                2️⃣ Selección Rápida por Capacidad de Camión:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  placeholder="Ej: 8 pallets"
                  value={cantidadRapidaPallets}
                  onChange={(e) => setCantidadRapidaPallets(e.target.value)}
                  style={{ ...estiloInput(), width: '140px' }}
                />
                <button
                  type="button"
                  onClick={seleccionarPrimerosNPallets}
                  style={{ padding: '8px 14px', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  ⚡ Tildar primeros {cantidadRapidaPallets || 'N'} pallets
                </button>
                <button
                  type="button"
                  onClick={() => setPalletsSeleccionados({})}
                  style={{ padding: '8px 12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>

          <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#e9ecef', zIndex: 1 }}>
                <tr>
                  <th style={{ padding: '12px', textAlign: 'center', width: '50px' }}>
                    <input
                      type="checkbox"
                      onChange={seleccionarTodosVisibles}
                      checked={palletsFiltradosDespacho.length > 0 && palletsFiltradosDespacho.every(p => palletsSeleccionados[p.id] !== undefined)}
                      style={{ transform: 'scale(1.3)', cursor: 'pointer' }}
                      title="Seleccionar todos los visibles"
                    />
                  </th>
                  <th style={{ padding: '12px' }}>Pallet</th>
                  <th style={{ padding: '12px' }}>Orden</th>
                  <th style={{ padding: '12px' }}>Cliente / Producto</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Tipo</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Disponible</th>
                  <th style={{ padding: '12px', textAlign: 'center', width: '160px' }}>Cajas a Despachar</th>
                </tr>
              </thead>
              <tbody>
                {palletsFiltradosDespacho.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#6c757d' }}>
                      No hay pallets disponibles para este filtro.
                    </td>
                  </tr>
                ) : (
                  palletsFiltradosDespacho.map(p => {
                    const estaSeleccionado = palletsSeleccionados[p.id] !== undefined;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => toggleSeleccionPallet(p)}
                        style={{
                          borderBottom: '1px solid #dee2e6',
                          backgroundColor: estaSeleccionado ? '#e8f5e9' : 'white',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s'
                        }}
                      >
                        <td style={{ padding: '10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={estaSeleccionado}
                            onChange={() => toggleSeleccionPallet(p)}
                            style={{ transform: 'scale(1.3)', cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#0d6efd' }}>P#{p.id}</td>
                        <td style={{ padding: '10px', fontWeight: 'bold' }}>#{p.numero_orden}</td>
                        <td style={{ padding: '10px' }}>
                          <strong>{p.cliente}</strong>
                          <div style={{ fontSize: '0.82rem', color: '#555' }}>{p.producto_descripcion}</div>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '0.78rem',
                            fontWeight: 'bold',
                            backgroundColor: p.es_parcial ? '#fff3cd' : '#d1e7dd',
                            color: p.es_parcial ? '#856404' : '#0f5132'
                          }}>
                            {p.es_parcial ? 'Parcial' : 'Completo'}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                          {p.cantidad_unidades} u.
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          {estaSeleccionado ? (
                            <input
                              type="number"
                              value={palletsSeleccionados[p.id]}
                              max={p.cantidad_unidades}
                              min={1}
                              onChange={(e) => cambiarCantidadPalletSeleccionado(p.id, Number(p.cantidad_unidades), e.target.value)}
                              style={{
                                width: '100px',
                                padding: '6px',
                                textAlign: 'center',
                                fontWeight: 'bold',
                                borderRadius: '4px',
                                border: '2px solid #198754'
                              }}
                            />
                          ) : (
                            <span style={{ color: '#adb5bd', fontSize: '0.85rem' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <form onSubmit={ejecutarDespachoMultiple} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#d1e7dd',
              color: '#0f5132',
              padding: '15px 20px',
              borderRadius: '8px',
              border: '1px solid #badbcc',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ fontSize: '1.1rem' }}>
                🚛 <strong>Pallets al Camión:</strong> {resumenCamion.pallets} bulto(s)
              </div>
              <div style={{ fontSize: '1.1rem' }}>
                📦 <strong>Total Cajas:</strong> {resumenCamion.unidades} u.
              </div>
              <div style={{ fontSize: '1.1rem' }}>
                📐 <strong>Total m² a Despachar:</strong> {resumenCamion.m2.toFixed(2)} m²
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>N° de Remito / Transporte:</label>
                <input
                  type="text"
                  placeholder="Ej: Remito 0001-00004589 / Patente AB123CD"
                  value={remitoDespacho}
                  onChange={(e) => setRemitoDespacho(e.target.value)}
                  style={estiloInput()}
                />
              </div>

              <button
                type="submit"
                disabled={procesandoDespacho || resumenCamion.pallets === 0}
                style={{
                  padding: '14px 28px',
                  backgroundColor: resumenCamion.pallets === 0 ? '#adb5bd' : '#198754',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '1.1rem',
                  cursor: resumenCamion.pallets === 0 ? 'not-allowed' : 'pointer',
                  marginTop: '22px'
                }}
              >
                {procesandoDespacho ? '⏳ Procesando salida...' : `✅ Registrar Salida (${resumenCamion.pallets} Pallets)`}
              </button>
            </div>
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

      {/* =========================================================================
          📥 MODAL IMPORTAR MÚLTIPLES ÓRDENES DESDE PRODUCCIÓN (CON CHECKBOXES)
         ========================================================================= */}
      {mostrarModalImportar && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '1.8rem', borderRadius: '10px', width: '95%', maxWidth: '920px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, color: '#0d6efd' }}>📥 Traer Órdenes desde Producción (Ingreso Masivo)</h3>
              <button onClick={() => setMostrarModalImportar(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#6c757d' }}>✖</button>
            </div>
            <p style={{ color: '#666', fontSize: '0.9rem', marginTop: 0, marginBottom: '1rem' }}>
              Tildá una, varias o todas las órdenes terminadas en planta para ingresarlas y desglosarlas en pallets físicos en un solo paso.
            </p>

            {/* BARRA SUPERIOR: BUSCADOR + CAPACIDAD ESTÁNDAR GLOBAL */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#495057', display: 'block', marginBottom: '4px' }}>Buscar Orden / Cliente / Producto:</label>
                <input
                  type="text"
                  placeholder="🔍 Filtrar lista de órdenes..."
                  value={filtroModalImportar}
                  onChange={(e) => setFiltroModalImportar(e.target.value)}
                  style={estiloInput()}
                />
              </div>

              <div style={{ width: '210px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#0d6efd', display: 'block', marginBottom: '4px' }}>Capacidad Estándar x Pallet:</label>
                <input
                  type="number"
                  value={capacidadGlobalImportar}
                  onChange={(e) => aplicarCapacidadGlobalATodas(e.target.value)}
                  placeholder="Ej: 1000"
                  style={{ ...estiloInput(), fontWeight: 'bold' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
                <button
                  type="button"
                  onClick={seleccionarTodasOrdenesImportar}
                  style={{ padding: '9px 14px', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  ☑️ Seleccionar Nuevas
                </button>
                {cantidadOrdenesMarcadasImportar > 0 && (
                  <button
                    type="button"
                    onClick={() => setOrdenesSeleccionadasImportar({})}
                    style={{ padding: '9px 12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Limpiar ({cantidadOrdenesMarcadasImportar})
                  </button>
                )}
              </div>
            </div>

            {/* TABLA SCROLLEABLE CON CHECKBOXES */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '8px', maxHeight: '420px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#e9ecef', zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '10px', textAlign: 'center', width: '45px' }}>
                      <input
                        type="checkbox"
                        onChange={seleccionarTodasOrdenesImportar}
                        checked={
                          ordenesProducidasFiltradas.length > 0 &&
                          ordenesProducidasFiltradas.every((ord, idx) => ordenesSeleccionadasImportar[String(obtenerNumeroOrden(ord, idx))] !== undefined)
                        }
                        style={{ transform: 'scale(1.3)', cursor: 'pointer' }}
                        title="Seleccionar / Desmarcar todas"
                      />
                    </th>
                    <th style={{ padding: '10px' }}>Orden</th>
                    <th style={{ padding: '10px' }}>Cliente / Producto</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '10px', textAlign: 'center', width: '140px' }}>Total Cajas</th>
                    <th style={{ padding: '10px', textAlign: 'center', width: '130px' }}>Cajas x Pallet</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenesProducidasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#6c757d' }}>
                        No se encontraron órdenes producidas para este filtro.
                      </td>
                    </tr>
                  ) : (
                    ordenesProducidasFiltradas.map((ord, idx) => {
                      const numOrd = String(obtenerNumeroOrden(ord, idx));
                      const desc = ord.descripcion_producto || ord.producto_descripcion || ord.descripcion || ord.producto || '';
                      const cantFab = Number(ord.cantidad_fabricada || ord.cantidad_producida || ord.unidades_producidas || 0);
                      const cantSugerida = obtenerCantidadSugerida(ord);
                      const yaEnGalpon = stockGalpon.some(s => String(s.numero_orden) === numOrd);
                      const itemSeleccionado = ordenesSeleccionadasImportar[numOrd];
                      const estaMarcada = itemSeleccionado !== undefined;

                      return (
                        <tr
                          key={numOrd}
                          onClick={() => toggleSeleccionOrdenImportar(ord, idx)}
                          style={{
                            borderBottom: '1px solid #dee2e6',
                            backgroundColor: estaMarcada ? '#e7f1ff' : (yaEnGalpon ? '#fcfcfc' : 'white'),
                            cursor: 'pointer'
                          }}
                        >
                          <td style={{ padding: '10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={estaMarcada}
                              onChange={() => toggleSeleccionOrdenImportar(ord, idx)}
                              style={{ transform: 'scale(1.3)', cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '10px', fontWeight: 'bold', color: '#0d6efd' }}>
                            #{numOrd}
                            {yaEnGalpon && (
                              <div style={{ fontSize: '0.7rem', color: '#856404', backgroundColor: '#fff3cd', padding: '2px 5px', borderRadius: '4px', display: 'inline-block', marginLeft: '6px' }}>
                                ⚠️ En galpón
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px' }}>
                            <strong>{ord.cliente}</strong>
                            <div style={{ fontSize: '0.8rem', color: '#555' }}>{desc}</div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: '#d1e7dd', color: '#0f5132' }}>
                              {ord.estado || 'Finalizada'}
                            </span>
                            <div style={{ fontSize: '0.72rem', color: '#6c757d', marginTop: '3px' }}>
                              {cantFab > 0 ? `Fab: ${cantFab} u.` : `Prog: ${cantSugerida} u.`}
                            </div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            {estaMarcada ? (
                              <input
                                type="number"
                                min="1"
                                value={itemSeleccionado.cantidad}
                                onChange={(e) => cambiarDatoOrdenSeleccionada(numOrd, 'cantidad', e.target.value)}
                                style={{ width: '105px', padding: '6px', textAlign: 'center', fontWeight: 'bold', borderRadius: '4px', border: '2px solid #0d6efd' }}
                              />
                            ) : (
                              <span style={{ fontWeight: 'bold', color: '#495057' }}>{cantSugerida} u.</span>
                            )}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            {estaMarcada ? (
                              <input
                                type="number"
                                min="1"
                                value={itemSeleccionado.capacidad}
                                onChange={(e) => cambiarDatoOrdenSeleccionada(numOrd, 'capacidad', e.target.value)}
                                style={{ width: '95px', padding: '6px', textAlign: 'center', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #0d6efd' }}
                              />
                            ) : (
                              <span style={{ color: '#6c757d', fontSize: '0.82rem' }}>{capacidadGlobalImportar} u.</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* PIE DEL MODAL CON BOTÓN DE IMPORTACIÓN MASIVA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.2rem', paddingTop: '1rem', borderTop: '1px solid #dee2e6', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ fontWeight: 'bold', color: '#0d6efd' }}>
                {cantidadOrdenesMarcadasImportar === 0
                  ? 'Ninguna orden seleccionada'
                  : `✅ ${cantidadOrdenesMarcadasImportar} orden(es) lista(s) para desglosar en galpón`}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setMostrarModalImportar(false)}
                  style={{ padding: '10px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={procesandoImportacion || cantidadOrdenesMarcadasImportar === 0}
                  onClick={confirmarImportacionProduccion}
                  style={{
                    padding: '10px 22px',
                    backgroundColor: cantidadOrdenesMarcadasImportar === 0 ? '#adb5bd' : '#198754',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    fontWeight: 'bold',
                    cursor: cantidadOrdenesMarcadasImportar === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  {procesandoImportacion
                    ? '⏳ Importando órdenes...'
                    : `📥 Ingresar y Desglosar (${cantidadOrdenesMarcadasImportar})`}
                </button>
              </div>
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
                    if (val.length >= 4) {
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