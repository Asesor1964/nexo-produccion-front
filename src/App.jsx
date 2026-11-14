import { useState, useEffect } from 'react';
import PantallaLogin from './components/PantallaLogin';
import PantallaMaquinista from './components/PantallaMaquinista';
import PantallaProgramador from './components/PantallaProgramador';
import PantallaHistorial from './components/PantallaHistorial';
import PantallaEficiencia from './components/PantallaEficiencia';
import PantallaConfiguracion from './components/PantallaConfiguracion';
import PantallaMonitorTV from './components/PantallaMonitorTV';
import PantallaDesarrollador from './components/PantallaDesarrollador';
import PantallaExpedicion from './components/PantallaExpedicion';
import PantallaCargaManual from './components/PantallaCargaManual'; // 👈 NUEVA CONSOLA DE PARTES FÍSICOS
import PantallaHerramentales from './components/PantallaHerramentales';

export default function App() {
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [rolActivo, setRolActivo] = useState(null);

  // Al cargar la app, revisamos si ya hay una sesión guardada en localStorage
  useEffect(() => {
    const usuarioGuardado = localStorage.getItem('nexo_usuario');
    if (usuarioGuardado) {
      try {
        const parsedUser = JSON.parse(usuarioGuardado);
        setUsuarioActual(parsedUser);
      } catch (e) {
        console.error("Error al leer sesión guardada:", e);
        localStorage.removeItem('nexo_usuario');
      }
    }
  }, []);

  // Función para cerrar sesión por completo
  const cerrarSesion = () => {
    localStorage.removeItem('nexo_token');
    localStorage.removeItem('nexo_usuario');
    setUsuarioActual(null);
    setRolActivo(null);
  };

  // 1. SI NO HAY SESIÓN ACTIVA, OBLIGAMOS A MOSTRAR EL LOGIN
  if (!usuarioActual) {
    return <PantallaLogin onLoginExitoso={(user) => {
      setUsuarioActual(user);
      const rolUser = (user.rol || '').toLowerCase();
      // Redirección inteligente según el rol al ingresar
      if (rolUser === 'operador' || rolUser === 'maquinista') {
        setRolActivo('maquinista');
      } else if (rolUser === 'desarrollador') {
        setRolActivo('desarrollador');
      } else if (rolUser === 'monitor') {
        setRolActivo('monitor');
      } else if (rolUser === 'expedicion') {
        setRolActivo('expedicion');
      }
    }} />;
  }

  // Normalización del rol del usuario actual
  const rolUsuarioNormalizado = (usuarioActual?.rol || '').toLowerCase().trim();

  // Función de permisos inteligente por palabras clave (Blindaje total)
  const tienePermiso = (modulo) => {
    if (rolUsuarioNormalizado.includes('desarrollador') || rolUsuarioNormalizado.includes('admin')) {
      return true;
    }
    if (rolUsuarioNormalizado.includes('programador')) {
      return ['programador', 'jefe', 'carga-manual', 'configuracion', 'monitor', 'maquinista', 'expedicion'].includes(modulo);
    }
    if (rolUsuarioNormalizado.includes('jefe')) {
      return ['jefe', 'carga-manual', 'eficiencia', 'programador', 'maquinista', 'configuracion', 'monitor', 'expedicion'].includes(modulo);
    }
    if (rolUsuarioNormalizado.includes('expedicion')) {
      return ['expedicion', 'monitor'].includes(modulo);
    }
    if (rolUsuarioNormalizado.includes('eficiencia')) {
      return ['eficiencia', 'jefe', 'carga-manual', 'monitor'].includes(modulo);
    }
    if (rolUsuarioNormalizado.includes('configuración') || rolUsuarioNormalizado.includes('configuracion') || rolUsuarioNormalizado.includes('abm')) {
      return ['configuracion', 'monitor', 'programador'].includes(modulo);
    }
    return ['maquinista', 'monitor'].includes(modulo);
  };

  // 2. RENDERIZADO DEL MENÚ PRINCIPAL (Cuando rolActivo es null)
  if (rolActivo === null) {
    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', position: 'relative' }}>
        
        {/* Barra superior de usuario activo y salida */}
        <div style={{ position: 'absolute', top: '20px', right: '30px', display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span style={{ fontSize: '1rem', color: '#334155' }}>👤 <strong>{usuarioActual?.nombre || 'Usuario'}</strong> ({(usuarioActual?.rol || 'GENERAL').toUpperCase()})</span>
          <button onClick={cerrarSesion} style={{ padding: '8px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Cerrar Sesión
          </button>
        </div>

        {/* Encabezado del Sistema */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '3.5rem', color: '#0056b3', margin: '0' }}>NEXO PRODUCCIÓN</h1>
          <h2 style={{ color: '#6c757d', marginTop: '10px' }}>Portal de Acceso Seguro v1.0</h2>
        </div>

        {/* Botonera Dinámica según Permisos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', width: '90%', maxWidth: '800px' }}>
          
          {tienePermiso('desarrollador') && (
            <button 
              onClick={() => setRolActivo('desarrollador')}
              style={{ padding: '30px', fontSize: '1.5rem', backgroundColor: '#343a40', color: 'white', border: 'none', borderRadius: '15px', cursor: 'pointer', boxShadow: '0 6px 10px rgba(0,0,0,0.15)' }}>
              ⚙️ Desarrollador
            </button>
          )}

          {tienePermiso('programador') && (
            <button 
              onClick={() => setRolActivo('programador')}
              style={{ padding: '30px', fontSize: '1.5rem', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '15px', cursor: 'pointer', boxShadow: '0 6px 10px rgba(0,0,0,0.15)' }}>
              💻 Programador (PCP)
            </button>
          )}

          {tienePermiso('jefe') && (
            <button 
              onClick={() => setRolActivo('jefe')}
              style={{ padding: '30px', fontSize: '1.5rem', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 6px 10px rgba(0,0,0,0.15)' }}>
              📊 Jefe de Producción
            </button>
          )}

          {tienePermiso('carga-manual') && (
            <button 
              onClick={() => setRolActivo('carga-manual')}
              style={{ padding: '30px', fontSize: '1.5rem', backgroundColor: '#fd7e14', color: 'white', border: 'none', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 6px 10px rgba(0,0,0,0.15)' }}>
              📋 Carga Manual de Partes
            </button>
          )}

          {tienePermiso('expedicion') && (
            <button 
              onClick={() => setRolActivo('expedicion')}
              style={{ padding: '30px', fontSize: '1.5rem', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 6px 10px rgba(0,0,0,0.15)' }}>
              🚚 Expedición y Logística
            </button>
          )}

          {tienePermiso('eficiencia') && (
            <button 
              onClick={() => setRolActivo('eficiencia')}
              style={{ padding: '30px', fontSize: '1.5rem', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 6px 10px rgba(0,0,0,0.15)' }}>
              ⏱️ Analista de Eficiencia
            </button>
          )}

          {tienePermiso('maquinista') && (
            <button 
              onClick={() => setRolActivo('maquinista')}
              style={{ padding: '30px', fontSize: '1.5rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 6px 10px rgba(0,0,0,0.15)' }}>
              🏭 Terminal Maquinistas / Supervisor
            </button>
          )}

          {tienePermiso('configuracion') && (
            <button 
              onClick={() => setRolActivo('configuracion')}
              style={{ padding: '30px', fontSize: '1.5rem', backgroundColor: '#212529', color: 'white', border: 'none', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 6px 10px rgba(0,0,0,0.15)' }}>
              ⚙️ Configuración (ABM)
            </button>
          )}

          {tienePermiso('monitor') && (
            <button 
              onClick={() => setRolActivo('monitor')} 
              style={{ padding: '20px', fontSize: '1.2rem', backgroundColor: '#0f172a', color: '#38bdf8', border: '2px solid #38bdf8', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', gridColumn: 'span 2' }}
            >
              📺 Monitor TV (Andon - Planta)
            </button>
          )}

          {tienePermiso('herramentales') && (
            <button 
              onClick={() => setRolActivo('herramentales')}
              style={{ padding: '30px', fontSize: '1.5rem', backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 6px 10px rgba(0,0,0,0.15)' }}>
             🛠️ Clisés y Troqueles (Alistamiento)
            </button>
          )}

        </div>
      </div>
    );
  }

  // 3. RENDERIZADO DEL MÓDULO ACTIVO (Cuando el usuario ya seleccionó un módulo)
  return (
    <div style={{ backgroundColor: '#f4f4f9', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* Barra de navegación superior con datos de usuario y opción de volver al menú */}
      <div style={{ width: '100%', backgroundColor: '#343a40', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}>
        <span style={{ color: 'white', fontSize: '1.1rem', fontWeight: 'bold' }}>
          NEXO PRODUCCIÓN | Módulo: {rolActivo ? rolActivo.toUpperCase() : 'GENERAL'} &nbsp;|&nbsp; 👤 {usuarioActual?.nombre || 'Usuario'}
        </span>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setRolActivo(null)}
            style={{ padding: '8px 15px', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
            Menú Principal
          </button>
          <button 
            onClick={cerrarSesion}
            style={{ padding: '8px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Contenedor del Módulo Activo */}
      <div style={{ marginTop: '2rem', width: '100%', display: 'flex', justifyContent: 'center' }}>
        {rolActivo === 'maquinista' && <PantallaMaquinista />}
        {rolActivo === 'programador' && <PantallaProgramador />}
        {rolActivo === 'jefe' && <PantallaHistorial />} 
        {rolActivo === 'carga-manual' && <PantallaCargaManual />} {/* 👈 NUEVA PANTALLA EXCLUSIVA */}
        {rolActivo === 'eficiencia' && <PantallaEficiencia />}
        {rolActivo === 'desarrollador' && <PantallaDesarrollador />}
        {rolActivo === 'configuracion' && <PantallaConfiguracion />}
        {rolActivo === 'monitor' && <PantallaMonitorTV />}
        {rolActivo === 'expedicion' && <PantallaExpedicion />}
        {rolActivo === 'herramentales' && <PantallaHerramentales />}
      </div>

    </div>
  );
}