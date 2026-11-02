import { useState, useEffect } from 'react';
import GestionUsuarios from './GestionUsuarios';
import { apiFetch } from '../services/api'; // 👈 IMPORTACIÓN CENTRALIZADA

export default function PantallaDesarrollador() {
  const [listaMaquinas, setListaMaquinas] = useState([]);
  const [mensajeEstado, setMensajeEstado] = useState('');

  // 1. CARGA DE MÁQUINAS DESDE EL BACKEND
  const cargarMaquinas = async () => {
    try {
      const res = await apiFetch('/api/pedidos/recursos/maquinas');
      if (res.ok) {
        const data = await res.json();
        setListaMaquinas(data);
      } else {
        console.error("Error en la respuesta del servidor al cargar máquinas.");
      }
    } catch (error) {
      console.error("Error de red al cargar máquinas:", error);
    }
  };

  useEffect(() => {
    cargarMaquinas();
  }, []);

  // 2. ACTUALIZACIÓN DE CONFIGURACIÓN VÍA PUT
  const actualizarConfiguracionMaquina = async (maq) => {
    try {
      const res = await apiFetch(`/api/pedidos/maquinas/${maq.codigo_maquina}/config-modo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo_captura: maq.modo_captura,
          velocidad_estandar: Number(maq.velocidad_estandar),
          tiempo_setup_estandar: Number(maq.tiempo_setup_estandar)
        })
      });

      if (res.ok) {
        setMensajeEstado(`✅ Configuración de ${maq.codigo_maquina} actualizada correctamente.`);
        setTimeout(() => setMensajeEstado(''), 4000);
        await cargarMaquinas(); // Recargamos para sincronizar estado real
      } else {
        alert("⚠️ Error al guardar la configuración en el servidor.");
      }
    } catch (error) {
      console.error("Error al actualizar configuración:", error);
    }
  };

  // 3. BUENA PRÁCTICA: MANEJADOR DE CAMBIOS INMUTABLE
  const handleChange = (index, campo, valor) => {
    setListaMaquinas(prevMaquinas => {
      const nuevasMaquinas = [...prevMaquinas];
      nuevasMaquinas[index] = {
        ...nuevasMaquinas[index],
        [campo]: valor
      };
      return nuevasMaquinas;
    });
  };

  return (
    <div style={{ padding: '2rem', width: '100%', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* ENCABEZADO */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', borderBottom: '3px solid #0f172a', paddingBottom: '15px' }}>
        <span style={{ fontSize: '2.5rem', marginRight: '15px' }}>🛠️</span>
        <div>
          <h2 style={{ color: '#0f172a', margin: 0, fontSize: '2rem' }}>Centro de Ingeniería y Telemetría</h2>
          <p style={{ color: '#64748b', margin: '5px 0 0 0' }}>Gestión de modos de captura (Manual vs Sensor IIoT) y parámetros de planta por máquina</p>
        </div>
      </div>

      {/* MENSAJE DE ESTADO FLOTANTE */}
      {mensajeEstado && (
        <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '15px', borderRadius: '8px', marginBottom: '2rem', fontWeight: 'bold', border: '1px solid #10b981' }}>
          {mensajeEstado}
        </div>
      )}

      {/* GRILLA DE MÁQUINAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
        {listaMaquinas.map((maq, index) => (
          <div key={maq.id || maq.codigo_maquina} style={{ backgroundColor: 'white', border: '2px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            
            {/* CABECERA DE CARTA DE MÁQUINA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem' }}>⚙️ {maq.codigo_maquina}</h3>
              <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', backgroundColor: maq.modo_captura === 'AUTOMATICO' ? '#dbeafe' : '#fef3c7', color: maq.modo_captura === 'AUTOMATICO' ? '#1e40af' : '#92400e' }}>
                {maq.modo_captura === 'AUTOMATICO' ? '🤖 MODO AUTOMÁTICO (Sensor)' : '🖐️ MODO MANUAL (Tablet)'}
              </span>
            </div>

            {/* CONTENEDOR DE FORMULARIO DE CADA MÁQUINA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* SELECTOR DE MODO DE CAPTURA */}
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Modo de Adquisición de Datos:</label>
                <select
                  value={maq.modo_captura || 'MANUAL'}
                  onChange={(e) => handleChange(index, 'modo_captura', e.target.value)}
                  style={{ width: '100%', padding: '10px', fontSize: '1.1rem', borderRadius: '6px', border: '2px solid #cbd5e1', fontWeight: 'bold' }}
                >
                  <option value="MANUAL">🖐️ Manual (Control por Operador)</option>
                  <option value="AUTOMATICO">🤖 Automático (Sensor Óptico IIoT)</option>
                </select>
              </div>

              {/* VELOCIDAD ESTÁNDAR */}
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Velocidad Estándar (cajas/min):</label>
                <input
                  type="number"
                  value={maq.velocidad_estandar !== undefined ? maq.velocidad_estandar : 120}
                  onChange={(e) => handleChange(index, 'velocidad_estandar', e.target.value)}
                  style={{ width: '100%', padding: '10px', fontSize: '1.1rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              {/* TIEMPO LÍMITE DE SET-UP */}
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Tiempo Límite Set-Up (minutos):</label>
                <input
                  type="number"
                  value={maq.tiempo_setup_estandar !== undefined ? maq.tiempo_setup_estandar : 15}
                  onChange={(e) => handleChange(index, 'tiempo_setup_estandar', e.target.value)}
                  style={{ width: '100%', padding: '10px', fontSize: '1.1rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              {/* RUTA DE API PARA EL SENSOR FUTURO */}
              <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', fontWeight: 'bold' }}>ENDPOINT ESP32 (FUTURO SENSOR):</span>
                <code style={{ fontSize: '0.85rem', color: '#0284c7' }}>POST /api/iot/pulso/{maq.codigo_maquina}</code>
              </div>

              {/* BOTÓN DE GUARDADO */}
              <button
                onClick={() => actualizarConfiguracionMaquina(maq)}
                style={{ width: '100%', padding: '12px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px' }}
              >
                💾 Guardar Configuración
              </button>

            </div>

          </div>
        ))}
      </div>

      <GestionUsuarios />

    </div>
  );
}