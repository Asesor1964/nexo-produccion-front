import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api'; // 👈 IMPORTACIÓN CENTRALIZADA

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [listaMaquinas, setListaMaquinas] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const [editandoId, setEditandoId] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    nombre_completo: '',
    rol: 'maquinista',
    maquina_asignada: '',
    activo: true
  });

  const cargarDatos = async () => {
    try {
      const [resUsers, resMaq] = await Promise.all([
        apiFetch('/api/auth/usuarios'),
        apiFetch('/api/pedidos/recursos/maquinas')
      ]);
      if (resUsers.ok) setUsuarios(await resUsers.json());
      if (resMaq.ok) setListaMaquinas(await resMaq.json());
    } catch (err) {
      console.error('Error al cargar datos del CRUD de usuarios:', err);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const limpiarFormulario = () => {
    setEditandoId(null);
    setFormData({
      username: '',
      password: '',
      nombre_completo: '',
      rol: 'maquinista',
      maquina_asignada: '',
      activo: true
    });
    setError('');
  };

  const seleccionarParaEditar = (u) => {
    setEditandoId(u.id);
    setFormData({
      username: u.username,
      password: '',
      nombre_completo: u.nombre_completo,
      rol: u.rol,
      maquina_asignada: u.maquina_asignada || '',
      activo: u.activo
    });
    setError('');
  };

  const guardarUsuario = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');

    const url = editandoId 
      ? `/api/auth/usuarios/${editandoId}`
      : '/api/auth/usuarios';
    
    const metodo = editandoId ? 'PUT' : 'POST';

    try {
      const res = await apiFetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (res.ok) {
        setMensaje(editandoId ? '✅ Usuario actualizado con éxito.' : '✅ Usuario creado con éxito.');
        setTimeout(() => setMensaje(''), 4000);
        limpiarFormulario();
        cargarDatos();
      } else {
        setError(data.error || 'Ocurrió un error al guardar.');
      }
    } catch (err) {
      setError('Error de conexión con el servidor.');
    }
  };

  const eliminarUsuario = async (id, username) => {
    if (username === 'admin') {
      alert('⚠️ No puedes eliminar al usuario administrador principal.');
      return;
    }
    if (!window.confirm(`¿Estás seguro de eliminar al usuario "${username}"?`)) return;

    try {
      const res = await apiFetch(`/api/auth/usuarios/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMensaje('🗑️ Usuario eliminado correctamente.');
        setTimeout(() => setMensaje(''), 4000);
        cargarDatos();
      }
    } catch (err) {
      console.error('Error al eliminar:', err);
    }
  };

  return (
    <div style={{ marginTop: '3rem', backgroundColor: 'white', border: '2px solid #cbd5e1', borderRadius: '12px', padding: '2rem', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
      
      <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.6rem' }}>👥 Administración de Usuarios y Roles (ABM)</h2>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.95rem' }}>Alta, baja y modificación de credenciales de acceso para planta y gestión</p>
        </div>
      </div>

      {mensaje && (
        <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '12px', borderRadius: '8px', marginBottom: '1rem', fontWeight: 'bold' }}>
          {mensaje}
        </div>
      )}

      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '8px', marginBottom: '1rem', fontWeight: 'bold' }}>
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={guardarUsuario} style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0, color: editandoId ? '#d97706' : '#0284c7' }}>
          {editandoId ? `✏️ Editando Usuario (ID #${editandoId})` : '➕ Crear Nuevo Usuario'}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '5px', color: '#334155' }}>Usuario (Login):</label>
            <input 
              type="text" 
              required 
              autoComplete="new-password"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              placeholder="Ej: s.sanchez"
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '5px', color: '#334155' }}>
              {editandoId ? 'Nueva Clave (opcional):' : 'Contraseña:'}
            </label>
            <input 
              type="password" 
              required={!editandoId}
              autoComplete="new-password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              placeholder={editandoId ? 'Dejar vacío para no cambiar' : '••••••••'}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '5px', color: '#334155' }}>Nombre Completo:</label>
            <input 
              type="text" 
              required 
              autoComplete="off"
              value={formData.nombre_completo}
              onChange={(e) => setFormData({...formData, nombre_completo: e.target.value})}
              placeholder="Ej: Sergio Sanchez"
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '5px', color: '#334155' }}>Rol en el Sistema:</label>
            <select 
              value={formData.rol}
              onChange={(e) => setFormData({...formData, rol: e.target.value})}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
            >
              <option value="desarrollador">⚙️ Desarrollador (Acceso Total)</option>
              <option value="programador">💻 Programador (PCP / Usuarios)</option>
              <option value="jefe">📊 Jefe de Producción</option>
              <option value="eficiencia">⏱️ Analista de Eficiencia</option>
              <option value="maquinista">🏭 Supervisor / Maquinista</option>
              <option value="configuracion">🛠️ Configuración (ABM)</option>
              <option value="monitor">📺 Monitor TV (Andon)</option>
            </select>
          </div>

          {/* SECCIÓN DE MÁQUINAS MÚLTIPLES CON CHECKBOXES */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '8px', color: '#334155' }}>
              🏭 Máquinas Autorizadas (Seleccione una o varias):
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', backgroundColor: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              {listaMaquinas.length === 0 ? (
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>No hay máquinas cargadas en el sistema.</span>
              ) : (
                listaMaquinas.map(m => {
                  const cod = m.codigo_maquina;
                  const maquinasActuales = formData.maquina_asignada ? formData.maquina_asignada.split(',') : [];
                  const estaSeleccionada = maquinasActuales.includes(cod);

                  return (
                    <label key={m.id || cod} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem', backgroundColor: '#f1f5f9', padding: '6px 10px', borderRadius: '4px' }}>
                      <input 
                        type="checkbox"
                        checked={estaSeleccionada}
                        onChange={(e) => {
                          let nuevas;
                          if (e.target.checked) {
                            nuevas = [...maquinasActuales, cod];
                          } else {
                            nuevas = maquinasActuales.filter(item => item !== cod);
                          }
                          setFormData({...formData, maquina_asignada: nuevas.join(',')});
                        }}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{cod}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {editandoId && (
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '22px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                <input 
                  type="checkbox" 
                  checked={formData.activo}
                  onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                  style={{ width: '18px', height: '18px' }}
                />
                Usuario Activo
              </label>
            </div>
          )}

        </div>

        <div style={{ marginTop: '1.2rem', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          {editandoId && (
            <button 
              type="button" 
              onClick={limpiarFormulario}
              style={{ padding: '10px 20px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Cancelar Edición
            </button>
          )}
          <button 
            type="submit"
            style={{ padding: '10px 25px', backgroundColor: editandoId ? '#d97706' : '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {editandoId ? '💾 Guardar Cambios' : '➕ Registrar Usuario'}
          </button>
        </div>
      </form>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
              <th style={{ padding: '12px' }}>ID</th>
              <th style={{ padding: '12px' }}>Usuario (Login)</th>
              <th style={{ padding: '12px' }}>Nombre Completo</th>
              <th style={{ padding: '12px' }}>Rol</th>
              <th style={{ padding: '12px' }}>Máquina</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Estado</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: u.activo ? 'white' : '#fef2f2' }}>
                <td style={{ padding: '12px', fontWeight: 'bold', color: '#64748b' }}>#{u.id}</td>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{u.username}</td>
                <td style={{ padding: '12px' }}>{u.nombre_completo}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold', backgroundColor: '#e0f2fe', color: '#0369a1', textTransform: 'uppercase' }}>
                    {u.rol}
                  </span>
                </td>
                <td style={{ padding: '12px', color: '#475569' }}>{u.maquina_asignada || '—'}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {u.activo ? (
                    <span style={{ color: '#16a34a', fontWeight: 'bold' }}>● Activo</span>
                  ) : (
                    <span style={{ color: '#dc2626', fontWeight: 'bold' }}>○ Inactivo</span>
                  )}
                </td>
                <td style={{ padding: '12px', textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button 
                    onClick={() => seleccionarParaEditar(u)}
                    style={{ padding: '6px 12px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                  >
                    ✏️ Editar
                  </button>
                  <button 
                    onClick={() => eliminarUsuario(u.id, u.username)}
                    style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                  >
                    🗑️ Borrar
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