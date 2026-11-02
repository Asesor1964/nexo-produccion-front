import { useState } from 'react';
import { apiFetch } from '../services/api';

export default function PantallaLogin({ onLoginExitoso }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const manejarSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const respuesta = await apiFetch('/api/auth/login', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ username, password })
      });

      const datos = await respuesta.json();

      if (respuesta.ok && datos.status === 'ok') {
        // Guardar token y datos del usuario en localStorage
        localStorage.setItem('nexo_token', datos.token);
        localStorage.setItem('nexo_usuario', JSON.stringify(datos.usuario));
        
        // Notificar al componente principal que el login fue exitoso
        onLoginExitoso(datos.usuario);
      } else {
        setError(datos.error || 'Credenciales inválidas');
      }
    } catch (err) {
      console.error('Error de red en login:', err);
      setError('No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f4f6f9', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: 'white', padding: '2.5rem', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '3rem' }}>🔐</span>
          <h2 style={{ color: '#0f172a', margin: '10px 0 0 0' }}>Nexo Producción</h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '5px 0 0 0' }}>Ingrese sus credenciales de acceso</p>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '6px', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 'bold', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={manejarSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', color: '#475569', marginBottom: '5px', fontSize: '0.9rem' }}>Usuario:</label>
            <input 
              type="text" 
              required 
              value={username} 
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej: admin o l.albornoz"
              style={{ width: '100%', padding: '12px', fontSize: '1rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', color: '#475569', marginBottom: '5px', fontSize: '0.9rem' }}>Contraseña:</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '12px', fontSize: '1rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>

          <button 
            type="submit" 
            disabled={cargando}
            style={{ width: '100%', padding: '14px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
          >
            {cargando ? 'Verificando...' : '🔑 Iniciar Sesión'}
          </button>
        </form>

      </div>
    </div>
  );
}