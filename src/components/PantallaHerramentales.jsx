import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';

export default function PantallaHerramentales() {
  const [pestana, setPestana] = useState('radar'); // 'radar' | 'clises' | 'troqueles' | 'historial'
  const [radarCola, setRadarCola] = useState([]);
  const [clises, setClises] = useState([]);
  const [troqueles, setTroqueles] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(false);

  // Filtros
  const [filtroMaquinaRadar, setFiltroMaquinaRadar] = useState('TODAS');
  const [busquedaClise, setBusquedaClise] = useState('');
  const [filtroEstadoClise, setFiltroEstadoClise] = useState('ACTIVOS');
  const [busquedaTroquel, setBusquedaTroquel] = useState('');
  const [filtroEstadoTroquel, setFiltroEstadoTroquel] = useState('ACTIVOS');

  // Modales CRUD / Mantenimiento / Baja por Nueva Versión
  const [cliseExpandido, setCliseExpandido] = useState(null);
  const [modalNuevoItem, setModalNuevoItem] = useState(null); // 'clise' | 'troquel' | null
  const [formNuevo, setFormNuevo] = useState({
    codigo: '',
    plano: '',
    ubicacion: '',
    bocas: 1,
    colores_resumen: '',
    limite: 250000,
    productos_asociados: '',
    clientes_asociados: '',
    observaciones: ''
  });

  const [modalBajaVersion, setModalBajaVersion] = useState(null); // { tipo: 'clises'|'troqueles', item }
  const [datosBaja, setDatosBaja] = useState({
    motivo_baja: 'Modificación de Diseño / Nueva Versión',
    nuevo_codigo: '',
    nueva_ubicacion: ''
  });

  const cargarTodo = async () => {
    setCargando(true);
    try {
      const [resRadar, resCli, resTroq, resHist] = await Promise.all([
        apiFetch('/api/herramentales/radar-cola'),
        apiFetch('/api/herramentales/clises'),
        apiFetch('/api/herramentales/troqueles'),
        apiFetch('/api/herramentales/historial')
      ]);

      if (resRadar.ok) setRadarCola(await resRadar.json());
      if (resCli.ok) setClises(await resCli.json());
      if (resTroq.ok) setTroqueles(await resTroq.json());
      if (resHist.ok) setHistorial(await resHist.json());
    } catch (error) {
      console.error('Error al cargar herramentales:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTodo();
  }, []);

  const sincronizarDesdeMaestro = async () => {
    setCargando(true);
    try {
      const res = await apiFetch('/api/herramentales/sincronizar-desde-maestro', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.mensaje}`);
        await cargarTodo();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      alert('❌ Error de conexión al sincronizar.');
    } finally {
      setCargando(false);
    }
  };

  // 🎯 Actualizar estado de Alistamiento en el Radar de Cola
  const cambiarEstadoAlistamiento = async (numeroOrden, campo, valor) => {
    setRadarCola(prev =>
      prev.map(o => (o.numero_orden === numeroOrden ? { ...o, [campo]: valor } : o))
    );
    try {
      await apiFetch(`/api/herramentales/radar-cola/${numeroOrden}/alistamiento`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: valor })
      });
    } catch (error) {
      console.error('Error al actualizar estado de alistamiento:', error);
    }
  };

  // 📍 Guardar Ubicación Editable (Perchero o Fila) con escudo anti-pisado CSV
  const guardarUbicacionRapida = async (tipo, item, nuevaUbicacion) => {
    const limpia = String(nuevaUbicacion || '').trim().toUpperCase();
    if (!limpia || limpia === item.ubicacion) return;

    try {
      const res = await apiFetch(`/api/herramentales/${tipo}/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ubicacion: limpia })
      });
      if (res.ok) {
        cargarTodo();
      }
    } catch (error) {
      alert('❌ Error al actualizar la ubicación.');
    }
  };

  const cambiarEstadoHerramental = async (tipo, item, nuevoEstado) => {
    try {
      const res = await apiFetch(`/api/herramentales/${tipo}/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      if (res.ok) cargarTodo();
    } catch (error) {
      console.error('Error cambiando estado:', error);
    }
  };

  // 🔧 Mantenimiento de Clisé (Total o de 1 solo Color)
  const registrarMantenimientoClise = async (cliseItem, cuerpoNumero = null, colorNombre = '') => {
    const texto = cuerpoNumero
      ? `¿Confirmás que se reemplazó/reparó el polímero del ${cuerpoNumero}° Color (${colorNombre}) del Clisé ${cliseItem.codigo_clise}?\n\nSe pondrá en 0 giros únicamente ese color.`
      : `¿Confirmás mantenimiento / reposición completa de TODOS los colores del Clisé ${cliseItem.codigo_clise}?\n\nSe reiniciarán los giros parciales a 0.`;

    const detalle = window.prompt(texto + '\n\nObservación / Detalle de taller:', 'Reposición de polímero / Limpieza profunda');
    if (detalle === null) return;

    try {
      const res = await apiFetch(`/api/herramentales/clises/${cliseItem.id}/mantenimiento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuerpo_numero: cuerpoNumero, detalle })
      });
      if (res.ok) {
        alert('✅ Mantenimiento de Clisé registrado correctamente.');
        cargarTodo();
      }
    } catch (error) {
      alert('❌ Error al registrar mantenimiento.');
    }
  };

  // 🔧 Mantenimiento de Troquel (Cambio de gomas / cuchillas)
  const registrarMantenimientoTroquel = async (troqItem) => {
    const detalle = window.prompt(
      `🔧 Mantenimiento del Troquel ${troqItem.codigo_troquel}\n(Golpes acumulados desde último ajuste: ${troqItem.golpes_actuales})\n\nIngresá el trabajo realizado (Ej: Cambio de gomas, rectificado de cuchillas):`,
      'Cambio completo de gomas y revisión de cuchillas'
    );
    if (detalle === null) return;

    try {
      const res = await apiFetch(`/api/herramentales/troqueles/${troqItem.id}/mantenimiento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'MANTENIMIENTO TALLER',
          detalle,
          reiniciar_golpes: true
        })
      });
      if (res.ok) {
        alert(`✅ Troquel ${troqItem.codigo_troquel} dejado Disponible y con contador parcial en 0 golpes (se conserva el histórico total).`);
        cargarTodo();
      }
    } catch (error) {
      alert('❌ Error al registrar mantenimiento de troquel.');
    }
  };

  // ➕ Guardar Nuevo Clisé o Troquel (Alta Manual CRUD)
  const handleGuardarNuevo = async (e) => {
    e.preventDefault();
    if (!formNuevo.codigo.trim()) return;

    const endpoint = modalNuevoItem === 'clise' ? '/api/herramentales/clises' : '/api/herramentales/troqueles';
    const body =
      modalNuevoItem === 'clise'
        ? {
            codigo_clise: formNuevo.codigo,
            ubicacion: formNuevo.ubicacion || 'SIN UBICACIÓN',
            bocas: formNuevo.bocas,
            colores_resumen: formNuevo.colores_resumen,
            limite_giros: formNuevo.limite,
            productos_asociados: formNuevo.productos_asociados,
            clientes_asociados: formNuevo.clientes_asociados,
            observaciones: formNuevo.observaciones
          }
        : {
            codigo_troquel: formNuevo.codigo,
            plano: formNuevo.plano,
            ubicacion: formNuevo.ubicacion || 'SIN UBICACIÓN',
            bocas: formNuevo.bocas,
            limite_golpes: formNuevo.limite,
            productos_asociados: formNuevo.productos_asociados,
            clientes_asociados: formNuevo.clientes_asociados,
            observaciones: formNuevo.observaciones
          };

    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        alert('✅ Herramental guardado en el inventario.');
        setModalNuevoItem(null);
        cargarTodo();
      } else {
        const err = await res.json();
        alert(`❌ Error: ${err.error}`);
      }
    } catch (error) {
      alert('❌ Error de conexión.');
    }
  };

  // ⛔ Procesar Baja / Reemplazo por Nueva Versión
  const handleConfirmarBajaVersion = async (e) => {
    e.preventDefault();
    if (!modalBajaVersion) return;
    const { tipo, item } = modalBajaVersion;

    try {
      const res = await apiFetch(`/api/herramentales/${tipo}/${item.id}/reemplazar-baja`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosBaja)
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.mensaje}`);
        setModalBajaVersion(null);
        cargarTodo();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      alert('❌ Error al procesar la baja/reemplazo.');
    }
  };

  const renderBarraDesgaste = (actual, limite, unidad = 'giros') => {
    const lim = Math.max(1, Number(limite) || 250000);
    const act = Number(actual) || 0;
    const pct = Math.min(100, Math.round((act / lim) * 100));
    const color = pct >= 90 ? '#dc3545' : pct >= 75 ? '#fd7e14' : '#198754';

    return (
      <div style={{ minWidth: '140px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '3px' }}>
          <span>{act.toLocaleString('es-AR')} {unidad}</span>
          <span style={{ color }}>{pct}%</span>
        </div>
        <div style={{ width: '100%', height: '7px', backgroundColor: '#e9ecef', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color }} />
        </div>
      </div>
    );
  };

  const maquinasRadar = Array.from(new Set(radarCola.map(r => r.maquina).filter(Boolean))).sort();

  const radarFiltrado = radarCola.filter(r =>
    filtroMaquinaRadar === 'TODAS' ? true : r.maquina === filtroMaquinaRadar
  );

  const clisesFiltrados = clises
    .filter(c => {
      if (filtroEstadoClise === 'ACTIVOS' && c.estado === 'Fuera de Circulación') return false;
      if (filtroEstadoClise === 'REVISION' && c.estado !== 'Requiere Revisión' && c.estado !== 'En Reparación') return false;
      if (filtroEstadoClise === 'BAJAS' && c.estado !== 'Fuera de Circulación') return false;
      if (!busquedaClise.trim()) return true;
      const q = busquedaClise.toLowerCase();
      return (
        String(c.codigo_clise || '').toLowerCase().includes(q) ||
        String(c.ubicacion || '').toLowerCase().includes(q) ||
        String(c.productos_asociados || '').toLowerCase().includes(q) ||
        String(c.clientes_asociados || '').toLowerCase().includes(q) ||
        String(c.colores_resumen || '').toLowerCase().includes(q)
      );
    })
    .slice(0, 150);

  const troquelesFiltrados = troqueles
    .filter(t => {
      if (filtroEstadoTroquel === 'ACTIVOS' && t.estado === 'Fuera de Circulación') return false;
      if (filtroEstadoTroquel === 'REVISION' && t.estado !== 'Requiere Revisión' && t.estado !== 'En Reparación') return false;
      if (filtroEstadoTroquel === 'BAJAS' && t.estado !== 'Fuera de Circulación') return false;
      if (!busquedaTroquel.trim()) return true;
      const q = busquedaTroquel.toLowerCase();
      return (
        String(t.codigo_troquel || '').toLowerCase().includes(q) ||
        String(t.plano || '').toLowerCase().includes(q) ||
        String(t.ubicacion || '').toLowerCase().includes(q) ||
        String(t.productos_asociados || '').toLowerCase().includes(q) ||
        String(t.clientes_asociados || '').toLowerCase().includes(q)
      );
    })
    .slice(0, 150);

  return (
    <div style={{ padding: '1.8rem', width: '100%', maxWidth: '1320px', fontFamily: 'sans-serif', textAlign: 'left' }}>
      
      {/* CABECERA PRINCIPAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #6f42c1', paddingBottom: '12px', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '2.5rem' }}>🛠️</span>
          <div>
            <h2 style={{ margin: 0, color: '#343a40', fontSize: '1.85rem' }}>
              Administración Inteligente de Clisés y Troqueles (Alistamiento)
            </h2>
            <small style={{ color: '#6c757d', fontWeight: 'bold' }}>
              Control de Percheros, Filas, Giros por Polímero de Color, Golpes de Troquel y Versionado
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={sincronizarDesdeMaestro}
            disabled={cargando}
            style={{ padding: '10px 16px', backgroundColor: '#6f42c1', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            title="Extrae todos los clisés, troqueles, percheros, filas y colores cargados en el Maestro de Productos"
          >
            🔄 Sincronizar desde Maestro Productos
          </button>
          <button
            onClick={() => {
              setFormNuevo({ codigo: '', plano: '', ubicacion: 'PERCHERO 1', bocas: 1, colores_resumen: 'GCMI 90', limite: 250000, productos_asociados: '', clientes_asociados: '', observaciones: '' });
              setModalNuevoItem('clise');
            }}
            style={{ padding: '10px 14px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            + Nuevo Clisé
          </button>
          <button
            onClick={() => {
              setFormNuevo({ codigo: '', plano: '', ubicacion: 'FILA 1', bocas: 1, colores_resumen: '', limite: 300000, productos_asociados: '', clientes_asociados: '', observaciones: '' });
              setModalNuevoItem('troquel');
            }}
            style={{ padding: '10px 14px', backgroundColor: '#198754', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            + Nuevo Troquel
          </button>
        </div>
      </div>

      {/* BARRA DE PESTAÑAS */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setPestana('radar')}
          style={{
            padding: '12px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem',
            backgroundColor: pestana === 'radar' ? '#6f42c1' : '#e9ecef',
            color: pestana === 'radar' ? '#fff' : '#343a40'
          }}
        >
          📡 1. Radar de Cola (Pedidos a Preparar: {radarCola.length})
        </button>

        <button
          onClick={() => setPestana('clises')}
          style={{
            padding: '12px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem',
            backgroundColor: pestana === 'clises' ? '#0d6efd' : '#e9ecef',
            color: pestana === 'clises' ? '#fff' : '#343a40'
          }}
        >
          🎨 2. Inventario de Clisés y Polímeros ({clises.length})
        </button>

        <button
          onClick={() => setPestana('troqueles')}
          style={{
            padding: '12px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem',
            backgroundColor: pestana === 'troqueles' ? '#198754' : '#e9ecef',
            color: pestana === 'troqueles' ? '#fff' : '#343a40'
          }}
        >
          🔪 3. Inventario de Troqueles ({troqueles.length})
        </button>

        <button
          onClick={() => setPestana('historial')}
          style={{
            padding: '12px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem',
            backgroundColor: pestana === 'historial' ? '#fd7e14' : '#e9ecef',
            color: pestana === 'historial' ? '#fff' : '#343a40'
          }}
        >
          📜 4. Bitácora de Mantenimiento y Versiones
        </button>
      </div>

      {/* =========================================================================
          PESTAÑA 1: RADAR DE COLA (ALISTAMIENTO DE PEDIDOS EN COLA)
         ========================================================================= */}
      {pestana === 'radar' && (
        <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.06)', borderLeft: '5px solid #6f42c1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, color: '#343a40' }}>📡 Preparación Anticipada según Secuencia de Programación</h3>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#6c757d' }}>Máquina:</span>
              <button
                onClick={() => setFiltroMaquinaRadar('TODAS')}
                style={{ padding: '6px 12px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: filtroMaquinaRadar === 'TODAS' ? '#6f42c1' : '#f8f9fa', color: filtroMaquinaRadar === 'TODAS' ? '#fff' : '#333', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Todas ({radarCola.length})
              </button>
              {maquinasRadar.map(m => (
                <button
                  key={m}
                  onClick={() => setFiltroMaquinaRadar(m)}
                  style={{ padding: '6px 12px', borderRadius: '5px', border: '1px solid #ccc', backgroundColor: filtroMaquinaRadar === m ? '#6f42c1' : '#f8f9fa', color: filtroMaquinaRadar === m ? '#fff' : '#333', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '620px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>
                <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '12px 8px' }}>Puesto / Orden</th>
                  <th style={{ padding: '12px 8px' }}>Máquina</th>
                  <th style={{ padding: '12px 8px' }}>Cliente / Producto</th>
                  <th style={{ padding: '12px 8px', backgroundColor: '#eef6ff' }}>🎨 Diseño Clisé y Perchero</th>
                  <th style={{ padding: '12px 8px', backgroundColor: '#eef6ff' }}>Checklist Clisé</th>
                  <th style={{ padding: '12px 8px', backgroundColor: '#f0fdf4' }}>🔪 Troquel y Fila</th>
                  <th style={{ padding: '12px 8px', backgroundColor: '#f0fdf4' }}>Checklist Troquel</th>
                </tr>
              </thead>
              <tbody>
                {radarFiltrado.map((ord, idx) => {
                  const sinImpresion = !ord.codigo_clise || ord.codigo_clise.toUpperCase().includes('SIN IMPRESION');
                  const sinTroquel = !ord.codigo_troquel;

                  return (
                    <tr key={ord.numero_orden} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 'bold' }}>
                        <span style={{ backgroundColor: '#fff3cd', padding: '2px 6px', borderRadius: '4px', marginRight: '6px', color: '#856404' }}>
                          #{idx + 1}
                        </span>
                        {ord.numero_orden}
                        <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '2px' }}>
                          {Number(ord.cantidad_programada).toLocaleString('es-AR')} caj. ({ord.bocas} boc.)
                        </div>
                      </td>

                      <td style={{ padding: '10px 8px', fontWeight: 'bold', color: '#0056b3' }}>
                        {ord.maquina}
                        <div style={{ fontSize: '0.72rem', color: '#555' }}>{ord.estado}</div>
                      </td>

                      <td style={{ padding: '10px 8px' }}>
                        <strong>{ord.cliente}</strong>
                        <div style={{ color: '#555', fontSize: '0.82rem' }}>{ord.descripcion}</div>
                        {ord.colores && (
                          <div style={{ fontSize: '0.75rem', color: '#0d6efd', fontWeight: 'bold', marginTop: '2px' }}>
                            🎨 {ord.colores}
                          </div>
                        )}
                      </td>

                      {/* CLISÉ */}
                      <td style={{ padding: '10px 8px', backgroundColor: '#f8fbff' }}>
                        {sinImpresion ? (
                          <span style={{ color: '#6c757d', fontStyle: 'italic' }}>Liso / Sin Impresión</span>
                        ) : (
                          <div>
                            <strong style={{ color: '#0d6efd', fontSize: '0.95rem' }}>{ord.codigo_clise}</strong>
                            <span style={{ marginLeft: '6px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                              📍 {ord.ubic_clise}
                            </span>
                            <div style={{ marginTop: '4px' }}>
                              {renderBarraDesgaste(ord.giros_actuales, ord.limite_giros, 'giros')}
                            </div>
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '10px 8px', backgroundColor: '#f8fbff' }}>
                        {sinImpresion ? (
                          <span style={{ color: '#198754', fontWeight: 'bold' }}>✓ N/A</span>
                        ) : (
                          <select
                            value={ord.estado_alistamiento_clise}
                            onChange={(e) => cambiarEstadoAlistamiento(ord.numero_orden, 'estado_alistamiento_clise', e.target.value)}
                            style={{
                              padding: '6px', borderRadius: '5px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer',
                              backgroundColor:
                                ord.estado_alistamiento_clise === 'Listo en Máquina' ? '#d4edda' :
                                ord.estado_alistamiento_clise === 'En Reparación' ? '#f8d7da' : '#fff3cd'
                            }}
                          >
                            <option value="Pendiente">⏳ En Perchero (Buscar)</option>
                            <option value="En Alistamiento">🧹 Limpiando / Encintando</option>
                            <option value="Listo en Máquina">✅ Listo a Pie de Máquina</option>
                            <option value="En Reparación">🔴 En Reparación / Faltante</option>
                          </select>
                        )}
                      </td>

                      {/* TROQUEL */}
                      <td style={{ padding: '10px 8px', backgroundColor: '#f7fee7' }}>
                        {sinTroquel ? (
                          <span style={{ color: '#6c757d', fontStyle: 'italic' }}>Sin Troquel (Slotter)</span>
                        ) : (
                          <div>
                            <strong style={{ color: '#198754', fontSize: '0.95rem' }}>{ord.codigo_troquel}</strong>
                            {ord.plano && <span style={{ fontSize: '0.75rem', color: '#555', marginLeft: '5px' }}>({ord.plano})</span>}
                            <span style={{ marginLeft: '6px', backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                              📍 {ord.ubic_troquel}
                            </span>
                            <div style={{ marginTop: '4px' }}>
                              {renderBarraDesgaste(ord.golpes_actuales, ord.limite_golpes, 'golpes')}
                            </div>
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '10px 8px', backgroundColor: '#f7fee7' }}>
                        {sinTroquel ? (
                          <span style={{ color: '#198754', fontWeight: 'bold' }}>✓ N/A</span>
                        ) : (
                          <select
                            value={ord.estado_alistamiento_troquel}
                            onChange={(e) => cambiarEstadoAlistamiento(ord.numero_orden, 'estado_alistamiento_troquel', e.target.value)}
                            style={{
                              padding: '6px', borderRadius: '5px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer',
                              backgroundColor:
                                ord.estado_alistamiento_troquel === 'Listo en Máquina' ? '#d4edda' :
                                ord.estado_alistamiento_troquel === 'En Reparación' ? '#f8d7da' : '#fff3cd'
                            }}
                          >
                            <option value="Pendiente">⏳ En Fila (Buscar)</option>
                            <option value="En Alistamiento">🔧 Revisando Gomas/Cuchillas</option>
                            <option value="Listo en Máquina">✅ Listo a Pie de Máquina</option>
                            <option value="En Reparación">🔴 En Reparación / Taller</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          PESTAÑA 2: INVENTARIO DE CLISÉS (CON DESGLOSE DE 1 A 6 POLÍMEROS DE COLOR)
         ========================================================================= */}
      {pestana === 'clises' && (
        <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.06)', borderLeft: '5px solid #0d6efd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
            <input
              type="text"
              placeholder="🔍 Buscar por N° Diseño Clisé (ej. 88002-00), Perchero, Cliente, Código Producto o Color..."
              value={busquedaClise}
              onChange={(e) => setBusquedaClise(e.target.value)}
              style={{ flexGrow: 1, padding: '10px', borderRadius: '6px', border: '2px solid #0d6efd', fontSize: '0.95rem' }}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setFiltroEstadoClise('ACTIVOS')} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: filtroEstadoClise === 'ACTIVOS' ? '#0d6efd' : '#e9ecef', color: filtroEstadoClise === 'ACTIVOS' ? '#fff' : '#333' }}>
                Activos
              </button>
              <button onClick={() => setFiltroEstadoClise('REVISION')} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: filtroEstadoClise === 'REVISION' ? '#dc3545' : '#e9ecef', color: filtroEstadoClise === 'REVISION' ? '#fff' : '#333' }}>
                🔴 Requieren Revisión
              </button>
              <button onClick={() => setFiltroEstadoClise('BAJAS')} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: filtroEstadoClise === 'BAJAS' ? '#6c757d' : '#e9ecef', color: filtroEstadoClise === 'BAJAS' ? '#fff' : '#333' }}>
                ⛔ Fuera de Circulación
              </button>
            </div>
          </div>

          <div style={{ maxHeight: '620px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>
                <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '12px 8px' }}>N° Diseño Clisé</th>
                  <th style={{ padding: '12px 8px' }}>📍 Ubicación (Editable)</th>
                  <th style={{ padding: '12px 8px' }}>Colores / Cuerpos</th>
                  <th style={{ padding: '12px 8px' }}>Clientes / Productos</th>
                  <th style={{ padding: '12px 8px' }}>Odómetro de Giros</th>
                  <th style={{ padding: '12px 8px' }}>Estado</th>
                  <th style={{ padding: '12px 8px' }}>Acciones / Polímeros</th>
                </tr>
              </thead>
              <tbody>
                {clisesFiltrados.map(c => {
                  const expandido = cliseExpandido === c.id;
                  const cuerpos = Array.isArray(c.cuerpos_json) ? c.cuerpos_json : [];

                  return (
                    <>
                      <tr key={c.id} style={{ borderBottom: '1px solid #dee2e6', backgroundColor: c.estado === 'Requiere Revisión' ? '#fff5f5' : '#fff' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 'bold', color: '#0d6efd', fontSize: '1rem' }}>
                          {c.codigo_clise}
                          {c.reemplazado_por && (
                            <div style={{ fontSize: '0.72rem', color: '#dc3545' }}>➡️ Reemplazado por: {c.reemplazado_por}</div>
                          )}
                        </td>

                        {/* UBICACIÓN EDITABLE AL VUELO */}
                        <td style={{ padding: '10px 8px' }}>
                          <input
                            type="text"
                            defaultValue={c.ubicacion}
                            onBlur={(e) => guardarUbicacionRapida('clises', c, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                            title="Escribí el nuevo Perchero/Sector y presioná Enter para guardar"
                            style={{ padding: '6px 8px', borderRadius: '5px', border: '1px solid #0d6efd', fontWeight: 'bold', width: '165px', backgroundColor: '#f0f7ff' }}
                          />
                        </td>

                        <td style={{ padding: '10px 8px' }}>
                          <span style={{ backgroundColor: '#e7f1ff', color: '#0d6efd', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.78rem' }}>
                            🎨 {c.cantidad_colores || cuerpos.length || 1} Color(es)
                          </span>
                          <div style={{ fontSize: '0.78rem', color: '#444', marginTop: '4px' }}>{c.colores_resumen || 'Estándar'}</div>
                        </td>

                        <td style={{ padding: '10px 8px', fontSize: '0.8rem', color: '#555', maxWidth: '240px' }}>
                          <strong>{c.clientes_asociados}</strong>
                          <div>Cód: {c.productos_asociados}</div>
                        </td>

                        <td style={{ padding: '10px 8px' }}>
                          {renderBarraDesgaste(c.giros_actuales, c.limite_giros, 'giros')}
                          <div style={{ fontSize: '0.72rem', color: '#6c757d', marginTop: '2px' }}>
                            Histórico total: {(c.giros_totales || 0).toLocaleString('es-AR')} giros
                          </div>
                        </td>

                        <td style={{ padding: '10px 8px' }}>
                          <select
                            value={c.estado}
                            onChange={(e) => cambiarEstadoHerramental('clises', c, e.target.value)}
                            style={{ padding: '6px', borderRadius: '5px', fontWeight: 'bold', fontSize: '0.8rem' }}
                          >
                            <option value="Disponible">🟢 Disponible</option>
                            <option value="En Máquina">🔵 En Máquina</option>
                            <option value="Requiere Revisión">🔴 Requiere Revisión</option>
                            <option value="En Reparación">🟠 En Reparación</option>
                            <option value="Fuera de Circulación">⛔ Fuera de Circulación</option>
                          </select>
                        </td>

                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => setCliseExpandido(expandido ? null : c.id)}
                              style={{ padding: '5px 10px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 'bold' }}
                            >
                              {expandido ? '🔼 Ocultar Colores' : `🎨 Ver ${cuerpos.length || 1} Polímeros`}
                            </button>

                            <button
                              onClick={() => {
                                setDatosBaja({ motivo_baja: 'Modificación de Diseño / Nueva Versión', nuevo_codigo: `${c.codigo_clise}-V2`, nueva_ubicacion: c.ubicacion });
                                setModalBajaVersion({ tipo: 'clises', item: c });
                              }}
                              style={{ padding: '5px 9px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 'bold' }}
                              title="Sacar de circulación o reemplazar por una nueva versión"
                            >
                              🔄 Nueva Versión / Baja
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* FILA DESPLEGABLE CON LOS POLÍMEROS INDIVIDUALES (1 A 6 COLORES) */}
                      {expandido && (
                        <tr style={{ backgroundColor: '#f8fbff', borderBottom: '2px solid #0d6efd' }}>
                          <td colSpan="7" style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <strong style={{ color: '#004085' }}>
                                🔍 Desglose Individual de Polímeros del Diseño {c.codigo_clise} (Podés reiniciar a 0 giros un color individual si se repuso esa plancha):
                              </strong>
                              <button
                                onClick={() => registrarMantenimientoClise(c, null)}
                                style={{ padding: '6px 12px', backgroundColor: '#198754', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '0.78rem', cursor: 'pointer' }}
                              >
                                🔄 Reiniciar Giros de TODO el Juego
                              </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
                              {cuerpos.map((cp, idx) => (
                                <div key={idx} style={{ backgroundColor: '#fff', border: '1px solid #b6d4fe', borderRadius: '6px', padding: '10px' }}>
                                  <div style={{ fontWeight: 'bold', color: '#0d6efd', marginBottom: '4px' }}>
                                    {cp.cuerpo}° Cuerpo: {cp.color}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#333', marginBottom: '6px' }}>
                                    Giros Polímero Actual: <strong>{(cp.giros_actuales || 0).toLocaleString('es-AR')}</strong>
                                  </div>
                                  {cp.fecha_reemplazo && (
                                    <div style={{ fontSize: '0.72rem', color: '#198754', marginBottom: '6px' }}>
                                      Último cambio: {cp.fecha_reemplazo}
                                    </div>
                                  )}
                                  <button
                                    onClick={() => registrarMantenimientoClise(c, cp.cuerpo, cp.color)}
                                    style={{ width: '100%', padding: '5px', backgroundColor: '#fd7e14', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                                  >
                                    🔧 Reponer Polímero {cp.cuerpo}° Color (0 Giros)
                                  </button>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          PESTAÑA 3: INVENTARIO DE TROQUELES (GOLPES + FILAS + ENGOMADO/CUCHILLAS)
         ========================================================================= */}
      {pestana === 'troqueles' && (
        <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.06)', borderLeft: '5px solid #198754' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
            <input
              type="text"
              placeholder="🔍 Buscar por Código de Troquel (ej. WI-039, JP-013), Plano (RTUC), Fila o Cliente..."
              value={busquedaTroquel}
              onChange={(e) => setBusquedaTroquel(e.target.value)}
              style={{ flexGrow: 1, padding: '10px', borderRadius: '6px', border: '2px solid #198754', fontSize: '0.95rem' }}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setFiltroEstadoTroquel('ACTIVOS')} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: filtroEstadoTroquel === 'ACTIVOS' ? '#198754' : '#e9ecef', color: filtroEstadoTroquel === 'ACTIVOS' ? '#fff' : '#333' }}>
                Activos
              </button>
              <button onClick={() => setFiltroEstadoTroquel('REVISION')} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: filtroEstadoTroquel === 'REVISION' ? '#dc3545' : '#e9ecef', color: filtroEstadoTroquel === 'REVISION' ? '#fff' : '#333' }}>
                🔴 Requieren Revisión
              </button>
              <button onClick={() => setFiltroEstadoTroquel('BAJAS')} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: filtroEstadoTroquel === 'BAJAS' ? '#6c757d' : '#e9ecef', color: filtroEstadoTroquel === 'BAJAS' ? '#fff' : '#333' }}>
                ⛔ Fuera de Circulación
              </button>
            </div>
          </div>

          <div style={{ maxHeight: '620px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>
                <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '12px 8px' }}>Código Troquel</th>
                  <th style={{ padding: '12px 8px' }}>Plano / Bocas</th>
                  <th style={{ padding: '12px 8px' }}>📍 Fila / Ubicación (Editable)</th>
                  <th style={{ padding: '12px 8px' }}>Clientes / Productos</th>
                  <th style={{ padding: '12px 8px' }}>Odómetro de Golpes</th>
                  <th style={{ padding: '12px 8px' }}>Estado</th>
                  <th style={{ padding: '12px 8px' }}>Mantenimiento / Baja</th>
                </tr>
              </thead>
              <tbody>
                {troquelesFiltrados.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #dee2e6', backgroundColor: t.estado === 'Requiere Revisión' ? '#fff5f5' : '#fff' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 'bold', color: '#198754', fontSize: '1rem' }}>
                      {t.codigo_troquel}
                      {t.reemplazado_por && (
                        <div style={{ fontSize: '0.72rem', color: '#dc3545' }}>➡️ Reemplazado por: {t.reemplazado_por}</div>
                      )}
                    </td>

                    <td style={{ padding: '10px 8px' }}>
                      <strong>{t.plano || 'S/P'}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>{t.bocas || 1} boca(s)</div>
                    </td>

                    <td style={{ padding: '10px 8px' }}>
                      <input
                        type="text"
                        defaultValue={t.ubicacion}
                        onBlur={(e) => guardarUbicacionRapida('troqueles', t, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                        title="Escribí la nueva Fila/Sector y presioná Enter para guardar"
                        style={{ padding: '6px 8px', borderRadius: '5px', border: '1px solid #198754', fontWeight: 'bold', width: '155px', backgroundColor: '#f0fdf4' }}
                      />
                    </td>

                    <td style={{ padding: '10px 8px', fontSize: '0.8rem', color: '#555', maxWidth: '240px' }}>
                      <strong>{t.clientes_asociados}</strong>
                      <div>Cód: {t.productos_asociados}</div>
                    </td>

                    <td style={{ padding: '10px 8px' }}>
                      {renderBarraDesgaste(t.golpes_actuales, t.limite_golpes, 'golpes')}
                      <div style={{ fontSize: '0.72rem', color: '#6c757d', marginTop: '2px' }}>
                        Histórico total: {(t.golpes_totales || 0).toLocaleString('es-AR')} golpes
                      </div>
                    </td>

                    <td style={{ padding: '10px 8px' }}>
                      <select
                        value={t.estado}
                        onChange={(e) => cambiarEstadoHerramental('troqueles', t, e.target.value)}
                        style={{ padding: '6px', borderRadius: '5px', fontWeight: 'bold', fontSize: '0.8rem' }}
                      >
                        <option value="Disponible">🟢 Disponible</option>
                        <option value="En Máquina">🔵 En Máquina</option>
                        <option value="Requiere Revisión">🔴 Requiere Revisión</option>
                        <option value="En Reparación">🟠 En Reparación (Taller)</option>
                        <option value="Fuera de Circulación">⛔ Fuera de Circulación</option>
                      </select>
                    </td>

                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => registrarMantenimientoTroquel(t)}
                          style={{ padding: '5px 10px', backgroundColor: '#fd7e14', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 'bold' }}
                          title="Registrar cambio de gomas o cuchillas y reiniciar contador parcial de golpes"
                        >
                          🔧 Cambio Gomas / Cuchillas
                        </button>

                        <button
                          onClick={() => {
                            setDatosBaja({ motivo_baja: 'Fin de Vida Útil / Nueva Versión de Troquel', nuevo_codigo: `${t.codigo_troquel}-V2`, nueva_ubicacion: t.ubicacion });
                            setModalBajaVersion({ tipo: 'troqueles', item: t });
                          }}
                          style={{ padding: '5px 9px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 'bold' }}
                        >
                          🔄 Nueva Versión / Baja
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          PESTAÑA 4: BITÁCORA E HISTORIAL DE TALLER Y PRODUCCIÓN
         ========================================================================= */}
      {pestana === 'historial' && (
        <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.06)', borderLeft: '5px solid #fd7e14' }}>
          <h3 style={{ marginTop: 0, color: '#343a40' }}>📜 Historial Automático de Uso en Máquina, Reparaciones y Bajas</h3>
          <div style={{ maxHeight: '580px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '10px' }}>Fecha</th>
                  <th style={{ padding: '10px' }}>Tipo</th>
                  <th style={{ padding: '10px' }}>Código Herramental</th>
                  <th style={{ padding: '10px' }}>Acción / Evento</th>
                  <th style={{ padding: '10px' }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {historial.map(h => (
                  <tr key={h.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 10px', color: '#555' }}>{new Date(h.fecha).toLocaleString('es-AR')}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 'bold', color: h.tipo === 'CLISE' ? '#0d6efd' : '#198754' }}>{h.tipo}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 'bold' }}>{h.codigo}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 'bold' }}>{h.accion}</td>
                    <td style={{ padding: '8px 10px' }}>{h.detalle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL ALTA MANUAL DE NUEVO CLISÉ O TROQUEL */}
      {modalNuevoItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleGuardarNuevo} style={{ backgroundColor: '#fff', padding: '1.8rem', borderRadius: '10px', width: '90%', maxWidth: '520px' }}>
            <h3 style={{ marginTop: 0 }}>
              {modalNuevoItem === 'clise' ? '🎨 Dar de Alta Nuevo Clisé' : '🔪 Dar de Alta Nuevo Troquel'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>Código:</label>
                <input required type="text" value={formNuevo.codigo} onChange={e => setFormNuevo({ ...formNuevo, codigo: e.target.value.toUpperCase() })} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>Ubicación (Perchero / Fila):</label>
                <input required type="text" value={formNuevo.ubicacion} onChange={e => setFormNuevo({ ...formNuevo, ubicacion: e.target.value.toUpperCase() })} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
            </div>

            {modalNuevoItem === 'troquel' ? (
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>N° de Plano (Ej. RTUC303):</label>
                <input type="text" value={formNuevo.plano} onChange={e => setFormNuevo({ ...formNuevo, plano: e.target.value.toUpperCase() })} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
            ) : (
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>Colores separados por coma (Ej: GCMI 75, GCMI 90):</label>
                <input type="text" value={formNuevo.colores_resumen} onChange={e => setFormNuevo({ ...formNuevo, colores_resumen: e.target.value.toUpperCase() })} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>Bocas por Golpe:</label>
                <input type="number" min="1" value={formNuevo.bocas} onChange={e => setFormNuevo({ ...formNuevo, bocas: e.target.value })} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>Vida Útil Límite:</label>
                <input type="number" value={formNuevo.limite} onChange={e => setFormNuevo({ ...formNuevo, limite: e.target.value })} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setModalNuevoItem(null)} style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="submit" style={{ padding: '8px 18px', backgroundColor: '#198754', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL SACAR DE CIRCULACIÓN / REEMPLAZAR POR NUEVA VERSIÓN */}
      {modalBajaVersion && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleConfirmarBajaVersion} style={{ backgroundColor: '#fff', padding: '1.8rem', borderRadius: '10px', width: '90%', maxWidth: '520px' }}>
            <h3 style={{ marginTop: 0, color: '#dc3545' }}>
              🔄 Baja / Reemplazo por Nueva Versión ({modalBajaVersion.item.codigo_clise || modalBajaVersion.item.codigo_troquel})
            </h3>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Motivo de Salida de Circulación:</label>
              <select
                value={datosBaja.motivo_baja}
                onChange={e => setDatosBaja({ ...datosBaja, motivo_baja: e.target.value })}
                style={{ width: '100%', padding: '8px' }}
              >
                <option value="Modificación de Diseño / Nueva Versión">Modificación de Diseño / Nueva Versión</option>
                <option value="Fin de Vida Útil / Desgaste">Fin de Vida Útil / Desgaste</option>
                <option value="Rotura Irreparable en Máquina">Rotura Irreparable en Máquina</option>
                <option value="Producto Obsoleto">Producto Obsoleto / Discontinuado</option>
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                Código de la Nueva Versión que lo reemplaza (Dejar vacío si solo se da de baja):
              </label>
              <input
                type="text"
                placeholder="Ej: 88002-01"
                value={datosBaja.nuevo_codigo}
                onChange={e => setDatosBaja({ ...datosBaja, nuevo_codigo: e.target.value.toUpperCase() })}
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', fontWeight: 'bold' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                Ubicación (Perchero / Fila) de la Nueva Versión:
              </label>
              <input
                type="text"
                value={datosBaja.nueva_ubicacion}
                onChange={e => setDatosBaja({ ...datosBaja, nueva_ubicacion: e.target.value.toUpperCase() })}
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', fontWeight: 'bold' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setModalBajaVersion(null)} style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="submit" style={{ padding: '8px 18px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
                Confirmar Baja y Actualizar Maestro
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}