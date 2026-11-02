import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api'; // 👈 IMPORTACIÓN CENTRALIZADA

export default function ReporteScrap() {
  const [registros, setRegistros] = useState([]);
  const [ordenesReales, setOrdenesReales] = useState([]);
  const [supervisoresBD, setSupervisoresBD] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [filtroMaquina, setFiltroMaquina] = useState('TODOS');
  const [filtroZona, setFiltroZona] = useState('TODOS');
  const [mesSeleccionado, setMesSeleccionado] = useState('TODOS');
  const [filtroOrdenSelect, setFiltroOrdenSelect] = useState('TODOS');
  const [busquedaOrdenInput, setBusquedaOrdenInput] = useState('');

  // Estados para la Planilla Oficial RE-PRO 014
  const [maquinaManual, setMaquinaManual] = useState('');
  const [maquinistaManual, setMaquinistaManual] = useState('');
  const [supervisorSeleccionado, setSupervisorSeleccionado] = useState('');
  const [jefeProduccion, setJefeProduccion] = useState('SANCHEZ SERGIO');

  const cargarDatos = async () => {
    setCargando(true);
    try {
      // 1. Cargamos el detalle de scrap
      const resScrap = await apiFetch('/api/scrap/detallado');
      if (resScrap.ok) {
        const dataScrap = await resScrap.json();
        setRegistros(Array.isArray(dataScrap) ? dataScrap : []);
      }

      // 2. Cargamos las órdenes de producción reales
      const endpointsPosibles = [
        '/api/scrap/ordenes-lista',
        '/api/pedidos',
        '/api/produccion'
      ];

      for (const endpoint of endpointsPosibles) {
        try {
          const resOrd = await apiFetch(endpoint);
          if (resOrd.ok) {
            const dataOrd = await resOrd.json();
            if (Array.isArray(dataOrd) && dataOrd.length > 0) {
              setOrdenesReales(dataOrd);
              break;
            }
          }
        } catch (e) {
          // Continúa buscando el endpoint activo
        }
      }

      // 3. Cargamos el personal desde la ruta de scrap que incluye la columna 'rol'
      const endpointsPersonal = [
        '/api/scrap/operadores-lista',
        '/api/pedidos/recursos/operadores/todos',
        '/api/operadores'
      ];

      for (const urlPers of endpointsPersonal) {
        try {
          const resPers = await apiFetch(urlPers);
          if (resPers.ok) {
            const dataPers = await resPers.json();
            if (Array.isArray(dataPers) && dataPers.length > 0) {
              const nombresPrueba = ['sergio sanchez', 'martín sanchez', 'martin sanchez', 'operador comodín', 'operador comodin'];
              
              // Filtramos solo personal activo y sin nombres de prueba
              const activosReales = dataPers.filter(p => {
                const nom = String(p.nombre || '').trim().toLowerCase();
                const estaActivo = p.activo !== false && String(p.estado || 'Activo').toLowerCase() !== 'baja';
                return nom !== '' && estaActivo && !nombresPrueba.includes(nom);
              });

              // Filtramos los que tengan rol 'Supervisor'
              const soloSupervisores = activosReales.filter(
                p => String(p.rol || '').trim().toLowerCase() === 'supervisor'
              );

              const listaFinal = soloSupervisores.length > 0 
                ? soloSupervisores.map(p => p.nombre) 
                : activosReales.map(p => p.nombre);

              setSupervisoresBD(listaFinal);

              if (soloSupervisores.length > 0) {
                setSupervisorSeleccionado(soloSupervisores[0].nombre);
              }
              break;
            }
          }
        } catch (e) {
          // Continúa probando el siguiente endpoint si falla
        }
      }
    } catch (error) {
      console.error('Error al cargar datos de auditoría:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Diccionario de órdenes reales
  const mapaOrdenesOriginales = {};
  ordenesReales.forEach(o => {
    const numOrden = o.numero_orden || o.nro_orden || o.orden_id || o.id;
    const info = {
      id: o.id,
      numero: numOrden,
      cliente: o.cliente || o.nombre_cliente || 'Sin Cliente',
      producto: o.producto || o.producto_descripcion || o.descripcion || 'Sin Producto',
      maquina: o.maquina_destino || o.codigo_maquina || o.maquina || o.maquina_asignada || o.sector || '-',
      maquinista: o.maquinista || o.nombre_maquinista || o.operador || o.nombre_operador || o.operario || o.usuario || o.oficial || o.responsable_maquina || '',
      supervisor: o.supervisor || o.nombre_supervisor || o.encargado || o.jefe_turno || '',
      cantidad_pedida: o.cantidad || o.cantidad_pedida || o.unidades || '-',
      estado: o.estado || 'Finalizada'
    };
    if (numOrden) mapaOrdenesOriginales[String(numOrden)] = info;
    if (o.id) mapaOrdenesOriginales[String(o.id)] = info;
  });

  // Enriquecemos cada registro de scrap
  const registrosEnriquecidos = registros.map(r => {
    const infoReal = mapaOrdenesOriginales[String(r.orden_id)];
    return {
      ...r,
      nro_pedido_real: infoReal ? infoReal.numero : r.orden_id,
      cliente_real: infoReal ? infoReal.cliente : (r.cliente && r.cliente !== 'General' ? r.cliente : 'Stock / General'),
      producto_real: infoReal ? infoReal.producto : (r.producto_descripcion && r.producto_descripcion !== '-' && r.producto_descripcion !== 'Sin descripción' ? r.producto_descripcion : '-'),
      maquina_real: r.codigo_maquina || (infoReal ? infoReal.maquina : ''),
      maquinista_real: r.maquinista || r.operador || r.usuario || (infoReal ? infoReal.maquinista : ''),
      supervisor_real: r.supervisor || (infoReal ? infoReal.supervisor : '')
    };
  });

  const supervisoresDinamicos = [
    ...supervisoresBD,
    ...ordenesReales.map(o => o.supervisor || o.nombre_supervisor || o.encargado).filter(Boolean),
    ...registrosEnriquecidos.map(r => r.supervisor_real).filter(Boolean)
  ];
  const listaSupervisores = Array.from(new Set(supervisoresDinamicos));

  const opcionesDesplegableMap = {};

  ordenesReales.forEach(o => {
    const estadoOrden = String(o.estado || '').trim().toLowerCase();
    if (estadoOrden === 'finalizada' || estadoOrden === 'finalizado' || estadoOrden === 'terminada') {
      const numOrden = o.numero_orden || o.nro_orden || o.orden_id || o.id;
      const cliente = o.cliente || o.nombre_cliente || 'General';
      const producto = o.producto || o.producto_descripcion || o.descripcion || '-';
      if (numOrden) {
        opcionesDesplegableMap[String(numOrden)] = {
          valor: String(numOrden),
          idInterno: String(o.id),
          etiqueta: `Orden N° ${numOrden} — ${cliente} (${producto})`
        };
      }
    }
  });

  registrosEnriquecidos.forEach(r => {
    const clave = String(r.nro_pedido_real || r.orden_id);
    if (clave && clave !== 'undefined' && clave !== 'null' && !opcionesDesplegableMap[clave]) {
      opcionesDesplegableMap[clave] = {
        valor: clave,
        idInterno: String(r.orden_id),
        etiqueta: `Orden N° ${clave} — ${r.cliente_real} (${r.producto_real})`
      };
    }
  });

  const listaOrdenesDisponibles = Object.values(opcionesDesplegableMap).sort((a, b) => Number(b.valor) - Number(a.valor));

  const ordenActiva = busquedaOrdenInput.trim() !== '' 
    ? busquedaOrdenInput.trim() 
    : (filtroOrdenSelect !== 'TODOS' ? filtroOrdenSelect : null);

  const datosOrdenSeleccionada = ordenActiva ? (mapaOrdenesOriginales[String(ordenActiva)] || {
    numero: ordenActiva,
    cliente: registrosEnriquecidos.find(r => String(r.nro_pedido_real) === String(ordenActiva))?.cliente_real || 'Stock / General',
    producto: registrosEnriquecidos.find(r => String(r.nro_pedido_real) === String(ordenActiva))?.producto_real || '-',
    maquina: registrosEnriquecidos.find(r => String(r.nro_pedido_real) === String(ordenActiva))?.maquina_real || '',
    maquinista: registrosEnriquecidos.find(r => String(r.nro_pedido_real) === String(ordenActiva))?.maquinista_real || '',
    supervisor: registrosEnriquecidos.find(r => String(r.nro_pedido_real) === String(ordenActiva))?.supervisor_real || '',
    cantidad_pedida: '-',
    estado: 'Finalizada'
  }) : null;

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

  const maquinasBase = ['COR-SS', 'COR-JS', 'IMP-JS', 'WARD-TROQ', 'FLEXO', 'ROTATIVA', 'PEGADORA'];
  const maquinasDinamicas = registros.map(r => r.codigo_maquina).filter(Boolean);
  const maquinasDisponibles = Array.from(new Set([...maquinasBase, ...maquinasDinamicas]));

  const registrosFiltrados = registrosEnriquecidos.filter(item => {
    const matchMaquina = filtroMaquina === 'TODOS' || item.codigo_maquina === filtroMaquina;
    const matchZona = filtroZona === 'TODOS' || item.zona === filtroZona;
    const matchMes = mesSeleccionado === 'TODOS' || obtenerClaveMes(item.fecha_registro) === mesSeleccionado;

    const nroStr = String(item.nro_pedido_real || '');
    const idStr = String(item.orden_id || '');

    const matchOrden = busquedaOrdenInput.trim() !== ''
      ? (nroStr === busquedaOrdenInput.trim() || idStr === busquedaOrdenInput.trim() || nroStr.includes(busquedaOrdenInput.trim()))
      : (filtroOrdenSelect === 'TODOS' || nroStr === String(filtroOrdenSelect) || idStr === String(filtroOrdenSelect));

    return matchMaquina && matchZona && matchMes && matchOrden;
  });

  useEffect(() => {
    if (ordenActiva && datosOrdenSeleccionada) {
      const maqEventos = Array.from(new Set(registrosFiltrados.map(r => r.maquina_real))).filter(Boolean).join(' / ');
      const maqFinal = maqEventos || datosOrdenSeleccionada.maquina || (filtroMaquina !== 'TODOS' ? filtroMaquina : 'COR-SS');

      const maquinistaEventos = Array.from(new Set(registrosFiltrados.map(r => r.maquinista_real))).filter(Boolean).join(' / ');
      const maquinistaFinal = maquinistaEventos || datosOrdenSeleccionada.maquinista || '';

      const supervisorEventos = Array.from(new Set(registrosFiltrados.map(r => r.supervisor_real))).filter(Boolean).join(' / ');
      const supervisorFinal = supervisorEventos || datosOrdenSeleccionada.supervisor || '';

      setMaquinaManual(maqFinal);
      setMaquinistaManual(maquinistaFinal);
      if (supervisorFinal) {
        setSupervisorSeleccionado(supervisorFinal);
      }
    }
  }, [ordenActiva, ordenesReales.length, registros.length]);

  const totalKgFiltrados = registrosFiltrados.reduce((acc, curr) => acc + Number(curr.peso_kg || 0), 0);
  const totalPiezasFiltradas = registrosFiltrados.reduce((acc, curr) => acc + Number(curr.cantidad_piezas || 0), 0);

  const kgZonaFeed = registrosFiltrados
    .filter(r => String(r.zona).toLowerCase() === 'feed')
    .reduce((acc, curr) => acc + Number(curr.peso_kg || 0), 0);

  const kgZonaSalida = registrosFiltrados
    .filter(r => String(r.zona).toLowerCase() === 'salida')
    .reduce((acc, curr) => acc + Number(curr.peso_kg || 0), 0);

  const manejarImpresion = () => {
    window.print();
  };

  const handleInputOrdenChange = (e) => {
    const val = e.target.value;
    setBusquedaOrdenInput(val);
    if (val.trim() === '') {
      setFiltroOrdenSelect('TODOS');
    } else if (opcionesDesplegableMap[val.trim()]) {
      setFiltroOrdenSelect(val.trim());
    }
  };

  const handleSelectOrdenChange = (e) => {
    const val = e.target.value;
    setFiltroOrdenSelect(val);
    setBusquedaOrdenInput(val === 'TODOS' ? '' : val);
  };

  const limpiarOrden = () => {
    setBusquedaOrdenInput('');
    setFiltroOrdenSelect('TODOS');
  };

  const maquinistaInterviniente =
    maquinistaManual ||
    Array.from(new Set(registrosFiltrados.map(r => r.maquinista_real).filter(Boolean))).join(' / ') ||
    datosOrdenSeleccionada?.maquinista ||
    'SIN ASIGNAR';

  const supervisorInterviniente =
    supervisorSeleccionado ||
    Array.from(new Set(registrosFiltrados.map(r => r.supervisor_real).filter(Boolean))).join(' / ') ||
    supervisoresBD[0] ||
    'SIN ASIGNAR';

  const jefeInterviniente = jefeProduccion || 'SANCHEZ SERGIO';

  return (
    <div style={{ padding: '1rem 2rem', fontFamily: 'sans-serif', width: '100%', maxWidth: '1400px', margin: '0 auto', textAlign: 'left' }}>
      
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
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
            box-shadow: none !important;
          }
          .no-imprimir {
            display: none !important;
          }
          .select-imprimible {
            appearance: none !important;
            -webkit-appearance: none !important;
            -moz-appearance: none !important;
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="no-imprimir" style={{ backgroundColor: 'white', padding: '1rem 1.5rem', borderRadius: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', marginBottom: '1.5rem', border: '1px solid #cbd5e1' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
          <div>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem' }}>
              {ordenActiva ? `📄 Vista Previa: Planilla Oficial RE-PRO 014 (Orden N° ${ordenActiva})` : '📊 Auditoría General de Scrap y Emisión de Planillas'}
            </h2>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Seleccione una orden, verifique el Maquinista asignado y elija el Supervisor de Turno antes de imprimir.
            </span>
          </div>
          <button 
            onClick={manejarImpresion}
            style={{ padding: '12px 24px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            🖨️ {ordenActiva ? `Imprimir Planilla Orden N° ${ordenActiva}` : 'Imprimir Reporte General'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ backgroundColor: '#fef2f2', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <label style={{ fontWeight: 'bold', color: '#dc2626' }}>📦 Llamar Orden:</label>
            <input
              type="text"
              placeholder="Ej: 48273..."
              value={busquedaOrdenInput}
              onChange={handleInputOrdenChange}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '2px solid #dc2626', fontWeight: 'bold', color: '#dc2626', width: '110px', backgroundColor: 'white', fontSize: '0.95rem' }}
            />
            <select 
              value={filtroOrdenSelect} 
              onChange={handleSelectOrdenChange}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #dc2626', fontWeight: 'bold', color: '#991b1b', cursor: 'pointer', backgroundColor: 'white', maxWidth: '340px' }}
            >
              <option value="TODOS">📋 Ver Todas (Modo Resumen Mensual)</option>
              {listaOrdenesDisponibles.map(o => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>

            {ordenActiva && (
              <button
                onClick={limpiarOrden}
                style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
              >
                ✕ Volver al General
              </button>
            )}
          </div>

          <div>
            <label style={{ fontWeight: 'bold', marginRight: '6px', color: '#334155' }}>🏭 Máquina:</label>
            <select 
              value={filtroMaquina} 
              onChange={(e) => setFiltroMaquina(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold', cursor: 'pointer' }}
            >
              <option value="TODOS">Todas</option>
              {maquinasDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontWeight: 'bold', marginRight: '6px', color: '#334155' }}>📂 Zona:</label>
            <select 
              value={filtroZona} 
              onChange={(e) => setFiltroZona(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold', cursor: 'pointer' }}
            >
              <option value="TODOS">Ambas</option>
              <option value="feed">Feed (Entrada)</option>
              <option value="salida">Salida (Máquina)</option>
            </select>
          </div>

          <div>
            <label style={{ fontWeight: 'bold', marginRight: '6px', color: '#0d6efd' }}>📅 Mes:</label>
            <select 
              value={mesSeleccionado} 
              onChange={(e) => setMesSeleccionado(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #0d6efd', fontWeight: 'bold', color: '#0d6efd', cursor: 'pointer' }}
            >
              <option value="TODOS">Histórico</option>
              {mesesDisponibles.map(mes => (
                <option key={mes} value={mes}>{formatearClaveMes(mes)}</option>
              ))}
            </select>
          </div>
        </div>

        {ordenActiva && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1', display: 'flex', gap: '1.2rem', alignItems: 'center', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px' }}>
            <span style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '0.9rem' }}>👷 Personal en Planilla:</span>
            
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', marginRight: '6px' }}>Máquina:</label>
              <input
                type="text"
                value={maquinaManual}
                onChange={(e) => setMaquinaManual(e.target.value)}
                style={{ padding: '5px 10px', borderRadius: '5px', border: '1px solid #94a3b8', fontWeight: 'bold', width: '100px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', marginRight: '6px' }}>Maquinista (BD):</label>
              <input
                type="text"
                value={maquinistaManual}
                onChange={(e) => setMaquinistaManual(e.target.value)}
                placeholder="Cargado de BD..."
                style={{ padding: '5px 10px', borderRadius: '5px', border: '1px solid #94a3b8', fontWeight: 'bold', width: '180px', backgroundColor: '#f0fdf4', color: '#166534' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0f172a' }}>👔 Supervisor de Turno:</label>
              <select
                value={supervisorSeleccionado}
                onChange={(e) => setSupervisorSeleccionado(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: '5px', border: '2px solid #0f172a', fontWeight: 'bold', backgroundColor: 'white', color: '#0f172a', cursor: 'pointer' }}
              >
                <option value="">-- Seleccionar de Gestión de Personal --</option>
                {listaSupervisores.map(sup => (
                  <option key={sup} value={sup}>{sup}</option>
                ))}
              </select>
              <input
                type="text"
                value={supervisorSeleccionado}
                onChange={(e) => setSupervisorSeleccionado(e.target.value)}
                placeholder="O escribir nombre..."
                style={{ padding: '5px 10px', borderRadius: '5px', border: '1px solid #94a3b8', fontWeight: 'bold', width: '160px' }}
              />
            </div>
          </div>
        )}
      </div>

      <div id="seccion-imprimible-scrap">
        {ordenActiva && datosOrdenSeleccionada ? (
          <div style={{ backgroundColor: 'white', padding: '2rem', border: '2px solid #0f172a', borderRadius: '4px', color: '#0f172a' }}>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.2rem', border: '2px solid #0f172a' }}>
              <tbody>
                <tr>
                  <td style={{ width: '25%', padding: '12px', borderRight: '2px solid #0f172a', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontWeight: '900', fontSize: '1.3rem', letterSpacing: '1px', color: '#0f172a' }}>NEXO PRODUCCIÓN</div>
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '4px', fontWeight: 'bold' }}>DIVISIÓN CARTÓN CORRUGADO</div>
                  </td>
                  <td style={{ width: '50%', padding: '12px', borderRight: '2px solid #0f172a', textAlign: 'center' }}>
                    <div style={{ fontWeight: '900', fontSize: '1.25rem', textTransform: 'uppercase' }}>
                      PLANILLA DE CONTROL Y AUDITORÍA DE SCRAP
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '4px' }}>
                      Registro de Merma Operativa por Orden de Producción
                    </div>
                  </td>
                  <td style={{ width: '25%', padding: '10px 14px', fontSize: '0.82rem', backgroundColor: '#f8fafc' }}>
                    <div style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '4px' }}>
                      <strong>CÓDIGO:</strong> RE-PRO-014
                    </div>
                    <div style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '4px' }}>
                      <strong>VERSIÓN:</strong> 02 — VIGENTE
                    </div>
                    <div>
                      <strong>EMISIÓN:</strong> {new Date().toLocaleDateString()}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '6px 12px', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              1. Identificación de la Orden, Máquina y Personal Operativo
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.2rem', border: '2px solid #0f172a', fontSize: '0.92rem' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 10px', border: '1px solid #0f172a', backgroundColor: '#f8fafc', width: '18%', fontWeight: 'bold' }}>N° DE ORDEN / OP:</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #0f172a', width: '32%', fontSize: '1.15rem', fontWeight: '900', color: '#dc2626' }}>
                    {datosOrdenSeleccionada.numero}
                  </td>
                  <td style={{ padding: '8px 10px', border: '1px solid #0f172a', backgroundColor: '#f8fafc', width: '18%', fontWeight: 'bold' }}>ESTADO DE ORDEN:</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #0f172a', width: '32%', fontWeight: 'bold', color: '#166534' }}>
                    {String(datosOrdenSeleccionada.estado || 'FINALIZADA').toUpperCase()}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 10px', border: '1px solid #0f172a', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>CLIENTE:</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #0f172a', fontWeight: 'bold' }}>
                    {datosOrdenSeleccionada.cliente}
                  </td>
                  <td style={{ padding: '8px 10px', border: '1px solid #0f172a', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>MÁQUINA / LÍNEA:</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #0f172a', fontWeight: '900', color: '#0f172a', fontSize: '1rem' }}>
                    {maquinaManual || 'SIN ESPECIFICAR'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 10px', border: '1px solid #0f172a', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>MAQUINISTA:</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #0f172a', fontWeight: 'bold' }}>
                    <input
                      type="text"
                      value={maquinistaManual}
                      onChange={(e) => setMaquinistaManual(e.target.value)}
                      placeholder="Sin especificar..."
                      style={{ width: '100%', border: 'none', background: 'transparent', fontWeight: '900', fontSize: '0.95rem', outline: 'none', color: '#0f172a' }}
                    />
                  </td>
                  <td style={{ padding: '8px 10px', border: '1px solid #0f172a', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>SUPERVISOR TURNO:</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #0f172a', fontWeight: '900', fontSize: '0.95rem', color: '#0f172a' }}>
                    {supervisorSeleccionado || '___________________________'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 10px', border: '1px solid #0f172a', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>PRODUCTO / CAJA:</td>
                  <td colSpan="3" style={{ padding: '8px 10px', border: '1px solid #0f172a', fontWeight: 'bold', fontSize: '1rem' }}>
                    {datosOrdenSeleccionada.producto}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '6px 12px', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              2. Balance Cuantitativo de Merma Registrada
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', border: '1px solid #0f172a', textAlign: 'center', fontSize: '0.92rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }}>
                  <th style={{ padding: '8px', border: '1px solid #0f172a' }}>EVENTOS REGISTRADOS</th>
                  <th style={{ padding: '8px', border: '1px solid #0f172a' }}>SCRAP ZONA ENTRADA (FEED)</th>
                  <th style={{ padding: '8px', border: '1px solid #0f172a' }}>SCRAP ZONA SALIDA (MÁQUINA)</th>
                  <th style={{ padding: '8px', border: '1px solid #0f172a' }}>TOTAL PIEZAS DESCARTADAS</th>
                  <th style={{ padding: '8px', border: '1px solid #0f172a', backgroundColor: '#fee2e2', color: '#991b1b' }}>TOTAL SCRAP ACUMULADO (KG)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '10px', border: '1px solid #0f172a', fontWeight: 'bold', fontSize: '1.05rem' }}>{registrosFiltrados.length}</td>
                  <td style={{ padding: '10px', border: '1px solid #0f172a', fontWeight: 'bold', color: '#0369a1' }}>{kgZonaFeed.toFixed(2)} Kg</td>
                  <td style={{ padding: '10px', border: '1px solid #0f172a', fontWeight: 'bold', color: '#b45309' }}>{kgZonaSalida.toFixed(2)} Kg</td>
                  <td style={{ padding: '10px', border: '1px solid #0f172a', fontWeight: 'bold', color: '#2563eb', fontSize: '1.05rem' }}>{totalPiezasFiltradas} u.</td>
                  <td style={{ padding: '10px', border: '1px solid #0f172a', fontWeight: '900', fontSize: '1.2rem', backgroundColor: '#fef2f2', color: '#dc2626' }}>
                    {totalKgFiltrados.toFixed(2)} Kg
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '6px 12px', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              3. Detalle Cronológico de Eventos de Descarte y Causa Raíz (RE-PRO 014)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem', border: '1px solid #0f172a', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}>
                  <th style={{ padding: '8px', border: '1px solid #0f172a', textAlign: 'center', width: '5%' }}>Ítem</th>
                  <th style={{ padding: '8px', border: '1px solid #0f172a', textAlign: 'left', width: '15%' }}>Fecha y Hora</th>
                  <th style={{ padding: '8px', border: '1px solid #0f172a', textAlign: 'center', width: '10%' }}>Máquina</th>
                  <th style={{ padding: '8px', border: '1px solid #0f172a', textAlign: 'left', width: '16%' }}>Maquinista</th>
                  <th style={{ padding: '8px', border: '1px solid #0f172a', textAlign: 'center', width: '9%' }}>Zona</th>
                  <th style={{ padding: '8px', border: '1px solid #0f172a', textAlign: 'left', width: '16%' }}>Motivo Oficial</th>
                  <th style={{ padding: '8px', border: '1px solid #0f172a', textAlign: 'center', width: '8%' }}>Piezas</th>
                  <th style={{ padding: '8px', border: '1px solid #0f172a', textAlign: 'right', width: '10%' }}>Peso (Kg)</th>
                  <th style={{ padding: '8px', border: '1px solid #0f172a', textAlign: 'left' }}>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {registrosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ padding: '2rem', textAlign: 'center', border: '1px solid #0f172a', color: '#475569', fontStyle: 'italic' }}>
                      SIN NOVEDADES DE SCRAP REGISTRADAS PARA LA ORDEN N° {datosOrdenSeleccionada.numero} (MERMA DECLARADA: 0.00 KG).
                    </td>
                  </tr>
                ) : (
                  registrosFiltrados.map((item, index) => (
                    <tr key={item.id || index}>
                      <td style={{ padding: '8px', border: '1px solid #0f172a', textAlign: 'center', fontWeight: 'bold' }}>{index + 1}</td>
                      <td style={{ padding: '8px', border: '1px solid #0f172a' }}>{new Date(item.fecha_registro).toLocaleString()}</td>
                      <td style={{ padding: '8px', border: '1px solid #0f172a', textAlign: 'center', fontWeight: 'bold' }}>
                        {item.codigo_maquina || maquinaManual || '-'}
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #0f172a', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        {item.maquinista_real || maquinistaManual || 'Turno Planta'}
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #0f172a', textAlign: 'center', fontWeight: 'bold' }}>
                        {String(item.zona || '').toUpperCase()}
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #0f172a', fontWeight: 'bold' }}>{item.motivo}</td>
                      <td style={{ padding: '8px', border: '1px solid #0f172a', textAlign: 'center', fontWeight: 'bold' }}>{item.cantidad_piezas}</td>
                      <td style={{ padding: '8px', border: '1px solid #0f172a', textAlign: 'right', fontWeight: 'bold' }}>
                        {Number(item.peso_kg).toFixed(2)} Kg
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #0f172a', fontStyle: 'italic' }}>
                        {item.observaciones || '-'}
                      </td>
                    </tr>
                  ))
                )}
                <tr style={{ backgroundColor: '#f8fafc', fontWeight: '900' }}>
                  <td colSpan="6" style={{ padding: '10px', border: '1px solid #0f172a', textAlign: 'right', textTransform: 'uppercase' }}>
                    Totales de Cierre de Orden N° {datosOrdenSeleccionada.numero}:
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #0f172a', textAlign: 'center', color: '#2563eb', fontSize: '1rem' }}>
                    {totalPiezasFiltradas}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #0f172a', textAlign: 'right', color: '#dc2626', fontSize: '1.05rem' }}>
                    {totalKgFiltrados.toFixed(2)} Kg
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #0f172a' }}></td>
                </tr>
              </tbody>
            </table>

            <div style={{ border: '1px solid #0f172a', padding: '10px 12px', marginBottom: '2.5rem', minHeight: '60px', fontSize: '0.85rem', color: '#475569' }}>
              <strong>Dictamen de Calidad / Plan de Acción Correctivo (uso en planta):</strong>
              <div style={{ borderBottom: '1px dotted #94a3b8', height: '22px', marginTop: '6px' }}></div>
              <div style={{ borderBottom: '1px dotted #94a3b8', height: '22px' }}></div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '2rem', textAlign: 'center', fontSize: '0.85rem' }}>
              <tbody>
                <tr>
                  <td style={{ width: '33%', padding: '0 15px', verticalAlign: 'bottom' }}>
                    <div style={{ minHeight: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '6px' }}>
                      <span style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive', fontSize: '1.35rem', color: '#1e3a8a', letterSpacing: '0.5px' }}>
                        {maquinistaInterviniente}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 'bold' }}>
                        ✓ VALIDADO EN TERMINAL DE MÁQUINA
                      </span>
                    </div>
                    <div style={{ borderTop: '1.5px solid #0f172a', paddingTop: '6px', fontWeight: 'bold', color: '#334155' }}>
                      Firma Maquinista Responsable
                    </div>
                    <div style={{ color: '#0f172a', fontSize: '0.9rem', fontWeight: '900', marginTop: '2px', textTransform: 'uppercase' }}>
                      {maquinistaInterviniente}
                    </div>
                  </td>

                  <td style={{ width: '33%', padding: '0 15px', verticalAlign: 'bottom' }}>
                    <div style={{ minHeight: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '6px' }}>
                      <span style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive', fontSize: '1.35rem', color: '#1e3a8a', letterSpacing: '0.5px' }}>
                        {supervisorInterviniente}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 'bold' }}>
                        ✓ CONTROL Y AUDITORÍA DE TURNO
                      </span>
                    </div>
                    <div style={{ borderTop: '1.5px solid #0f172a', paddingTop: '6px', fontWeight: 'bold', color: '#334155' }}>
                      Firma Supervisor de Turno
                    </div>
                    <div style={{ color: '#0f172a', fontSize: '0.9rem', fontWeight: '900', marginTop: '2px', textTransform: 'uppercase' }}>
                      {supervisorInterviniente}
                    </div>
                  </td>

                  <td style={{ width: '33%', padding: '0 15px', verticalAlign: 'bottom' }}>
                    <div style={{ minHeight: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '6px' }}>
                      <span style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive', fontSize: '1.35rem', color: '#1e3a8a', letterSpacing: '0.5px' }}>
                        {jefeInterviniente}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#166534', fontWeight: 'bold' }}>
                        ✓ APROBADO — JEFATURA DE PRODUCCIÓN
                      </span>
                    </div>
                    <div style={{ borderTop: '1.5px solid #0f172a', paddingTop: '6px', fontWeight: 'bold', color: '#334155' }}>
                      V° B° Jefe de Producción / Planta
                    </div>
                    <div style={{ color: '#0f172a', fontSize: '0.9rem', fontWeight: '900', marginTop: '2px', textTransform: 'uppercase' }}>
                      {jefeInterviniente}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

          </div>
        ) : (
          <div>
            <div style={{ borderBottom: '3px solid #0f172a', paddingBottom: '15px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.8rem' }}>📊 Resumen General de Auditoría de Scrap</h1>
                <p style={{ margin: '5px 0 0 0', color: '#64748b' }}>
                  Máquina: <strong>{filtroMaquina}</strong> | Zona: <strong>{filtroZona.toUpperCase()}</strong> | Período: <strong>{mesSeleccionado === 'TODOS' ? 'Histórico Completo' : formatearClaveMes(mesSeleccionado)}</strong>
                </p>
              </div>
              <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.2rem', border: '1px solid #f87171' }}>
                Total Acumulado: {totalKgFiltrados.toFixed(2)} Kg ({registrosFiltrados.length} eventos)
              </div>
            </div>

            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginTop: 0, color: '#1e293b', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
                📋 Historial Cronológico de Merma ({registrosFiltrados.length} registros) — Haga clic en una orden para abrir su Planilla Oficial
              </h3>

              {cargando ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>Cargando registros de auditoría...</p>
              ) : registrosFiltrados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  <p style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>No se encontraron registros de scrap con los filtros seleccionados.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.95rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Fecha y Hora</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Máquina</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Maquinista</th>
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
                          <td style={{ padding: '12px', color: '#0f172a', fontWeight: 'bold', fontSize: '0.88rem' }}>
                            {item.maquinista_real || '-'}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: item.zona === 'feed' ? '#e0f2fe' : '#fef3c7', color: item.zona === 'feed' ? '#0369a1' : '#b45309', fontWeight: 'bold', fontSize: '0.8rem' }}>
                              {item.zona.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                const ord = String(item.nro_pedido_real || item.orden_id);
                                setBusquedaOrdenInput(ord);
                                setFiltroOrdenSelect(ord);
                              }}
                              title="Abrir Planilla Oficial de esta Orden"
                              style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #f87171', borderRadius: '6px', padding: '4px 10px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                              📄 N° {item.nro_pedido_real || 'N/A'}
                            </button>
                          </td>
                          <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                            <strong>{item.cliente_real}</strong><br/>
                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{item.producto_real}</span>
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
        )}
      </div>
    </div>
  );
}