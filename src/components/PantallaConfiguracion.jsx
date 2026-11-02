import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api'; // 👈 IMPORTACIÓN CENTRALIZADA

export default function PantallaConfiguracion() {
  const [operadores, setOperadores] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [rutas, setRutas] = useState([]);

  // Estados para los formularios nuevos
  const [nuevoOperador, setNuevoOperador] = useState('');
  const [nuevoRolOperador, setNuevoRolOperador] = useState('Maquinista');
  const [nuevaMaquina, setNuevaMaquina] = useState({ codigo_maquina: '', descripcion: '', tipo: 'Principal' });
  const [nuevaRuta, setNuevaRuta] = useState({ codigo_ruta: '', descripcion: '' });

  // 1. CARGAR DATOS
  const cargarDatos = async () => {
    try {
      const resOp = await apiFetch('/api/scrap/operadores-lista');
      if (resOp.ok) {
        setOperadores(await resOp.json());
      } else {
        const resOpFallback = await apiFetch('/api/pedidos/recursos/operadores/todos');
        if (resOpFallback.ok) setOperadores(await resOpFallback.json());
      }

      const resMaq = await apiFetch('/api/pedidos/recursos/maquinas/todas');
      if (resMaq.ok) setMaquinas(await resMaq.json());

      const resRutas = await apiFetch('/api/pedidos/recursos/rutas/todas');
      if (resRutas.ok) setRutas(await resRutas.json());
    } catch (error) {
      console.error("Error al cargar configuraciones:", error);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // 2. AGREGAR NUEVO PERSONAL
  const agregarOperador = async (e) => {
    e.preventDefault();
    if (!nuevoOperador.trim()) return;
    try {
      const res = await apiFetch('/api/scrap/operadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nombre: nuevoOperador.trim().toUpperCase(), 
          rol: nuevoRolOperador 
        })
      });
      if (res.ok) {
        setNuevoOperador('');
        setNuevoRolOperador('Maquinista');
        cargarDatos();
      }
    } catch (error) { 
      console.error("Error al agregar operador:", error); 
    }
  };

  // 2B. CAMBIAR ROL DE UN OPERADOR EXISTENTE
  const cambiarRolOperador = async (id, nuevoRol) => {
    try {
      const res = await apiFetch(`/api/scrap/operadores/${id}/rol`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol: nuevoRol })
      });
      if (res.ok) {
        cargarDatos();
      }
    } catch (error) { 
      console.error("Error al cambiar rol:", error); 
    }
  };

  // 2C. ELIMINAR DEFINITIVAMENTE PERSONAL
  const eliminarOperador = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar definitivamente a "${nombre}" de la base de datos?`)) return;
    try {
      const res = await apiFetch(`/api/scrap/operadores/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        cargarDatos();
      }
    } catch (error) { console.error("Error al eliminar operador:", error); }
  };

  // 3. AGREGAR NUEVA MÁQUINA
  const agregarMaquina = async (e) => {
    e.preventDefault();
    if (!nuevaMaquina.codigo_maquina) return;
    try {
      const res = await apiFetch('/api/pedidos/recursos/maquinas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevaMaquina)
      });
      if (res.ok) {
        setNuevaMaquina({ codigo_maquina: '', descripcion: '', tipo: 'Principal' });
        cargarDatos();
      } else {
        alert("Error: Es posible que el código de máquina ya exista.");
      }
    } catch (error) { console.error("Error:", error); }
  };

  // 4. AGREGAR O ACTUALIZAR RUTA DE PRODUCCIÓN
  const guardarRuta = async (e) => {
    e.preventDefault();
    if (!nuevaRuta.codigo_ruta || !nuevaRuta.descripcion) return;
    try {
      const res = await apiFetch('/api/pedidos/recursos/rutas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevaRuta)
      });
      if (res.ok) {
        setNuevaRuta({ codigo_ruta: '', descripcion: '' });
        cargarDatos();
      } else {
        alert("Error al guardar la ruta de producción.");
      }
    } catch (error) { console.error("Error:", error); }
  };

  // 5. CAMBIAR ESTADO (Operadores y Máquinas)
  const cambiarEstado = async (tipo, id, estadoActual, estadosPosibles) => {
    const nuevoEstado = estadoActual === estadosPosibles[0] ? estadosPosibles[1] : estadosPosibles[0];
    try {
      await apiFetch(`/api/pedidos/recursos/${tipo}/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      cargarDatos();
    } catch (error) { console.error("Error:", error); }
  };

  // 6. CAMBIAR ESTADO DE RUTA
  const cambiarEstadoRuta = async (id, activoActual) => {
    try {
      await apiFetch(`/api/pedidos/recursos/rutas/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !activoActual })
      });
      cargarDatos();
    } catch (error) { console.error("Error:", error); }
  };

  return (
    <div style={{ padding: '2rem', width: '100%', maxWidth: '1400px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', borderBottom: '3px solid #343a40', paddingBottom: '10px' }}>
        <span style={{ fontSize: '2.5rem', marginRight: '15px' }}>⚙️</span>
        <h2 style={{ color: '#343a40', margin: 0, fontSize: '2rem' }}>Panel de Configuración (Parámetros)</h2>
      </div>

      {/* FILA SUPERIOR: PERSONAL OPERATIVO Y MÁQUINAS */}
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        
        {/* COLUMNA IZQUIERDA: GESTIÓN DE PERSONAL */}
        <div style={{ flex: 1.2, minWidth: '450px', backgroundColor: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0, color: '#0d6efd', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
            👤 Gestión de Personal (Maquinistas y Supervisores)
          </h3>
          
          <form onSubmit={agregarOperador} style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="Apellido y Nombre..." 
              value={nuevoOperador}
              onChange={(e) => setNuevoOperador(e.target.value)}
              style={{ flex: 1, minWidth: '180px', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '1rem' }}
            />
            <select
              value={nuevoRolOperador}
              onChange={(e) => setNuevoRolOperador(e.target.value)}
              style={{ padding: '10px', borderRadius: '5px', border: '2px solid #0d6efd', fontWeight: 'bold', color: '#0f172a', backgroundColor: '#f8fafc', cursor: 'pointer' }}
            >
              <option value="Maquinista">👷 Maquinista</option>
              <option value="Supervisor">👔 Supervisor</option>
            </select>
            <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
              + Agregar
            </button>
          </form>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Nombre</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Rol Asignado</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Estado</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {operadores.map(op => {
                const rolActual = op.rol || 'Maquinista';
                return (
                  <tr key={op.id} style={{ borderBottom: '1px solid #dee2e6', opacity: op.estado === 'Baja' ? 0.5 : 1 }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{op.nombre}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <select
                        value={rolActual}
                        onChange={(e) => cambiarRolOperador(op.id, e.target.value)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          border: '1px solid #cbd5e1',
                          fontWeight: 'bold',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          backgroundColor: rolActual === 'Supervisor' ? '#e0e7ff' : '#f1f5f9',
                          color: rolActual === 'Supervisor' ? '#1d4ed8' : '#334155'
                        }}
                      >
                        <option value="Maquinista">👷 Maquinista</option>
                        <option value="Supervisor">👔 Supervisor</option>
                      </select>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <span style={{ backgroundColor: op.estado === 'Activo' ? '#d4edda' : '#f8d7da', color: op.estado === 'Activo' ? '#155724' : '#721c24', padding: '5px 10px', borderRadius: '15px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        {op.estado}
                      </span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button 
                        onClick={() => cambiarEstado('operadores', op.id, op.estado, ['Activo', 'Baja'])}
                        style={{ padding: '5px 12px', backgroundColor: op.estado === 'Activo' ? '#dc3545' : '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        {op.estado === 'Activo' ? 'Dar de Baja' : 'Reactivar'}
                      </button>
                      <button
                        onClick={() => eliminarOperador(op.id, op.nombre)}
                        title="Eliminar definitivamente de la base de datos"
                        style={{ padding: '5px 8px', backgroundColor: '#f1f5f9', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '5px', cursor: 'pointer' }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* COLUMNA DERECHA: MÁQUINAS */}
        <div style={{ flex: 1, minWidth: '400px', backgroundColor: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0, color: '#17a2b8', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>⚙️ Gestión de Máquinas</h3>
          
          <form onSubmit={agregarMaquina} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="text" placeholder="Cód (Ej: TROQ-02)" required
                value={nuevaMaquina.codigo_maquina} onChange={(e) => setNuevaMaquina({...nuevaMaquina, codigo_maquina: e.target.value})}
                style={{ width: '30%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
              />
              <input 
                type="text" placeholder="Descripción detallada" required
                value={nuevaMaquina.descripcion} onChange={(e) => setNuevaMaquina({...nuevaMaquina, descripcion: e.target.value})}
                style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select 
                value={nuevaMaquina.tipo} onChange={(e) => setNuevaMaquina({...nuevaMaquina, tipo: e.target.value})}
                style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}>
                <option value="Principal">Principal (Genera Cuello de Botella)</option>
                <option value="Auxiliar">Auxiliar (Apoyo / Empaque)</option>
              </select>
              <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>+ Agregar</button>
            </div>
          </form>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Código / Tipo</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Estado</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {maquinas.map(maq => (
                <tr key={maq.id} style={{ borderBottom: '1px solid #dee2e6', opacity: maq.estado === 'Jubilada' ? 0.5 : 1 }}>
                  <td style={{ padding: '10px' }}>
                    <strong>{maq.codigo_maquina}</strong><br/>
                    <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>{maq.tipo}</span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span style={{ backgroundColor: maq.estado === 'Activa' ? '#d4edda' : '#e2e3e5', color: maq.estado === 'Activa' ? '#155724' : '#383d41', padding: '5px 10px', borderRadius: '15px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                      {maq.estado}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <button 
                      onClick={() => cambiarEstado('maquinas', maq.id, maq.estado, ['Activa', 'Jubilada'])}
                      style={{ padding: '5px 15px', backgroundColor: maq.estado === 'Activa' ? '#6c757d' : '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                      {maq.estado === 'Activa' ? 'Jubilar' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* FILA INFERIOR: GESTIÓN DE RUTAS DE PRODUCCIÓN */}
      <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderTop: '4px solid #fd7e14' }}>
        <h3 style={{ marginTop: 0, color: '#fd7e14', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
          🛣️ Gestión de Rutas de Producción (Lista Desplegable del Programador)
        </h3>
        <p style={{ color: '#6c757d', marginTop: 0, marginBottom: '15px', fontSize: '0.95rem' }}>
          Las rutas <strong>Activas</strong> aquí configuradas son las que aparecerán disponibles en el menú desplegable de <em>Máquina Destino</em> dentro de la Cola de Programación. Si ingresas un código que ya existe, se actualizará su descripción.
        </p>

        <form onSubmit={guardarRuta} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input 
            type="text" 
            placeholder="Código Ruta (Ej: CORR-JS, TROQUELADORA)" 
            required
            value={nuevaRuta.codigo_ruta}
            onChange={(e) => setNuevaRuta({ ...nuevaRuta, codigo_ruta: e.target.value.toUpperCase() })}
            style={{ width: '30%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '1rem', fontWeight: 'bold' }}
          />
          <input 
            type="text" 
            placeholder="Descripción del flujo o ruta (Ej: Corrugadora e Impresora JS Directo)" 
            required
            value={nuevaRuta.descripcion}
            onChange={(e) => setNuevaRuta({ ...nuevaRuta, descripcion: e.target.value })}
            style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '1rem' }}
          />
          <button 
            type="submit" 
            style={{ padding: '10px 25px', backgroundColor: '#fd7e14', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
            💾 Guardar Ruta
          </button>
        </form>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '10px', textAlign: 'left', width: '25%' }}>Código de Ruta</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Descripción en Lista Desplegable</th>
              <th style={{ padding: '10px', textAlign: 'center', width: '15%' }}>Estado</th>
              <th style={{ padding: '10px', textAlign: 'center', width: '25%' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rutas.map(ruta => (
              <tr key={ruta.id} style={{ borderBottom: '1px solid #dee2e6', opacity: !ruta.activo ? 0.5 : 1 }}>
                <td style={{ padding: '10px', fontWeight: 'bold', color: '#0056b3' }}>{ruta.codigo_ruta}</td>
                <td style={{ padding: '10px' }}>{ruta.descripcion}</td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <span style={{ 
                    backgroundColor: ruta.activo ? '#d4edda' : '#f8d7da', 
                    color: ruta.activo ? '#155724' : '#721c24', 
                    padding: '5px 12px', borderRadius: '15px', fontSize: '0.85rem', fontWeight: 'bold' 
                  }}>
                    {ruta.activo ? 'Activa' : 'Oculta'}
                  </span>
                </td>
                <td style={{ padding: '10px', textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button 
                    type="button"
                    onClick={() => setNuevaRuta({ codigo_ruta: ruta.codigo_ruta, descripcion: ruta.descripcion })}
                    style={{ padding: '5px 12px', backgroundColor: '#ffc107', color: '#212529', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                    ✏️ Editar
                  </button>
                  <button 
                    type="button"
                    onClick={() => cambiarEstadoRuta(ruta.id, ruta.activo)}
                    style={{ padding: '5px 12px', backgroundColor: ruta.activo ? '#dc3545' : '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                    {ruta.activo ? 'Ocultar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}