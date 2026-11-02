import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import ReporteScrap from './ReporteScrap'; // <--- Importamos la auditoría de scrap
import { apiFetch } from '../services/api'; // 👈 IMPORTACIÓN CENTRALIZADA

export default function PantallaEficiencia() {
  const [tiemposMuertos, setTiemposMuertos] = useState([]);
  const [paradaEditando, setParadaEditando] = useState(null);
  
  // NUEVO: Pestaña activa dentro del módulo de eficiencia ('tiempos' o 'scrap')
  const [pestanaActiva, setPestanaActiva] = useState('tiempos');

  // NUEVO: ESTADO PARA EL FILTRO MENSUAL
  const [mesSeleccionado, setMesSeleccionado] = useState('TODOS');

  // 1. CARGAR DATOS
  const cargarTiempos = async () => {
    try {
      const res = await apiFetch('/api/pedidos/tiempos-muertos/todos');
      if (res.ok) {
        const data = await res.json();
        setTiemposMuertos(data);
      }
    } catch (error) {
      console.error("Error cargando tiempos muertos:", error);
    }
  };

  useEffect(() => {
    cargarTiempos();
  }, []);

  // 2. ELIMINAR (DELETE)
  const eliminarParada = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este registro de tiempo muerto?')) return;
    try {
      const res = await apiFetch(`/api/pedidos/tiempos-muertos/${id}`, { method: 'DELETE' });
      if (res.ok) cargarTiempos(); 
    } catch (error) {
      console.error("Error al eliminar", error);
    }
  };

  // 3. ACTUALIZAR (PUT)
  const guardarEdicion = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/api/pedidos/tiempos-muertos/${paradaEditando.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minutos_duracion: paradaEditando.minutos_duracion,
          codigo_parada: paradaEditando.codigo_parada,
          observaciones: paradaEditando.observaciones || ''
        })
      });
      if (res.ok) {
        setParadaEditando(null); 
        cargarTiempos(); 
      }
    } catch (error) {
      console.error("Error al actualizar", error);
    }
  };

  // ==========================================
  // MOTOR TEMPORAL (MES A MES)
  // ==========================================
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
    new Set(tiemposMuertos.map(t => obtenerClaveMes(t.fecha_registro)))
  ).filter(m => m !== 'Sin Fecha').sort().reverse();

  const dataEvolucionMensual = Object.values(
    tiemposMuertos.reduce((acc, curr) => {
      const clave = obtenerClaveMes(curr.fecha_registro);
      if (clave === 'Sin Fecha') return acc;
      
      if (!acc[clave]) {
        acc[clave] = { 
          claveOrden: clave, 
          mes: formatearClaveMes(clave), 
          setup: 0, 
          paradas: 0, 
          total: 0 
        };
      }
      
      const mins = Number(curr.minutos_duracion) || 0;
      const esSetup = (curr.codigo_parada || '').toLowerCase().includes('set-up');
      
      if (esSetup) {
        acc[clave].setup += mins;
      } else {
        acc[clave].paradas += mins;
      }
      acc[clave].total += mins;
      return acc;
    }, {})
  ).sort((a, b) => a.claveOrden.localeCompare(b.claveOrden));

  const tiemposFiltrados = mesSeleccionado === 'TODOS'
    ? tiemposMuertos
    : tiemposMuertos.filter(t => obtenerClaveMes(t.fecha_registro) === mesSeleccionado);

  const totalMinutosPerdidos = tiemposFiltrados.reduce((acc, curr) => acc + (Number(curr.minutos_duracion) || 0), 0);
  const horasPerdidas = (totalMinutosPerdidos / 60).toFixed(1);

  const dataMaquinas = tiemposFiltrados.reduce((acc, curr) => {
    const maquina = curr.maquina || 'Sin Asignar';
    const mins = Number(curr.minutos_duracion) || 0;
    const existente = acc.find(item => item.name === maquina);
    if (existente) existente.minutos += mins;
    else acc.push({ name: maquina, minutos: mins });
    return acc;
  }, []);

  const dataOperadores = tiemposFiltrados.reduce((acc, curr) => {
    const operador = curr.operador || 'Anónimo';
    const mins = Number(curr.minutos_duracion) || 0;
    const existente = acc.find(item => item.name === operador);
    if (existente) existente.minutos += mins;
    else acc.push({ name: operador, minutos: mins });
    return acc;
  }, []).sort((a, b) => b.minutos - a.minutos);

  const dataMotivos = tiemposFiltrados.reduce((acc, curr) => {
    let motivo = curr.codigo_parada || 'Desconocido';
    if (motivo.includes('-')) motivo = motivo.split('-')[1].trim(); 
    const mins = Number(curr.minutos_duracion) || 0;
    const existente = acc.find(item => item.name === motivo);
    if (existente) existente.value += mins;
    else acc.push({ name: motivo, value: mins });
    return acc;
  }, []).sort((a, b) => b.value - a.value).slice(0, 5);

  const COLORES_PIE = ['#dc3545', '#fd7e14', '#ffc107', '#20c997', '#0d6efd'];

  return (
    <div style={{ padding: '2rem', width: '100%', maxWidth: '1400px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* 🧭 PESTAÑAS DE NAVEGACIÓN SUPERIOR INTERNA */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '2rem', borderBottom: '3px solid #cbd5e1', paddingBottom: '15px' }}>
        <button
          onClick={() => setPestanaActiva('tiempos')}
          style={{
            padding: '12px 24px',
            fontWeight: 'bold',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: pestanaActiva === 'tiempos' ? '#0f172a' : '#e2e8f0',
            color: pestanaActiva === 'tiempos' ? 'white' : '#334155',
            cursor: 'pointer',
            fontSize: '1.1rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}
        >
          ⏱️ Rendimiento y Tiempos Muertos (OEE)
        </button>
        <button
          onClick={() => setPestanaActiva('scrap')}
          style={{
            padding: '12px 24px',
            fontWeight: 'bold',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: pestanaActiva === 'scrap' ? '#dc2626' : '#e2e8f0',
            color: pestanaActiva === 'scrap' ? 'white' : '#334155',
            cursor: 'pointer',
            fontSize: '1.1rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}
        >
          📊 Auditoría de Scrap (Kg & Pareto)
        </button>
      </div>

      {/* RENDERIZADO CONDICIONAL DE LA PESTAÑA */}
      {pestanaActiva === 'scrap' ? (
        <ReporteScrap />
      ) : (
        <div>
          {/* CABECERA CON SELECTOR DE MES */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '3px solid #343a40', paddingBottom: '15px', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '2.5rem', marginRight: '15px' }}>📈</span>
              <h2 style={{ color: '#343a40', margin: 0, fontSize: '2rem' }}>Tablero de Eficiencia (BI)</h2>
            </div>

            {/* FILTRO DE PERÍODO */}
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '10px 20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '2px solid #0d6efd' }}>
              <label style={{ fontWeight: 'bold', marginRight: '10px', color: '#343a40' }}>📅 Período de Análisis:</label>
              <select 
                value={mesSeleccionado} 
                onChange={(e) => setMesSeleccionado(e.target.value)}
                style={{ padding: '8px 15px', fontSize: '1.1rem', borderRadius: '6px', border: '1px solid #ced4da', fontWeight: 'bold', color: '#0d6efd', cursor: 'pointer' }}
              >
                <option value="TODOS">🌎 Histórico Completo</option>
                {mesesDisponibles.map(mes => (
                  <option key={mes} value={mes}>{formatearClaveMes(mes)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* TARJETAS DE KPIs SUPERIORES */}
          <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '250px', backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderLeft: '5px solid #ffc107' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#6c757d', fontSize: '1.1rem' }}>Total Paradas ({mesSeleccionado === 'TODOS' ? 'Histórico' : formatearClaveMes(mesSeleccionado)})</h3>
              <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: 'bold', color: '#343a40' }}>{tiemposFiltrados.length}</p>
            </div>
            <div style={{ flex: 1, minWidth: '250px', backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderLeft: '5px solid #dc3545' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#6c757d', fontSize: '1.1rem' }}>Tiempo Total Perdido</h3>
              <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: 'bold', color: '#dc3545' }}>
                {totalMinutosPerdidos} <span style={{ fontSize: '1.2rem' }}>min</span> 
                <span style={{ fontSize: '1rem', color: '#6c757d', marginLeft: '10px' }}>({horasPerdidas} hs)</span>
              </p>
            </div>
            <div style={{ flex: 1, minWidth: '250px', backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderLeft: '5px solid #0dcaf0' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#6c757d', fontSize: '1.1rem' }}>Principal Cuello de Botella</h3>
              <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#0dcaf0' }}>
                {dataMotivos.length > 0 ? dataMotivos[0].name : 'N/A'}
              </p>
            </div>
          </div>

          {/* GRÁFICO ESTRELLA: EVOLUCIÓN MENSUAL */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
            <h3 style={{ marginTop: 0, color: '#343a40', textAlign: 'center', marginBottom: '5px' }}>
              📊 Evolución Mensual de TNP: Set-Up vs. Paradas Imprevistas (Minutos)
            </h3>
            <p style={{ textAlign: 'center', color: '#6c757d', marginTop: 0, marginBottom: '20px', fontSize: '0.95rem' }}>
              Comparativa histórica para medir el aprendizaje en tiempos de preparación (SMED) frente a fallas operativas
            </p>
            <div style={{ width: '100%', height: 280 }}>
              {dataEvolucionMensual.length > 0 ? (
                <ResponsiveContainer>
                  <LineChart data={dataEvolucionMensual} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fill: '#495057', fontWeight: 'bold' }} />
                    <YAxis tick={{ fill: '#6c757d' }} />
                    <Tooltip contentStyle={{ borderRadius: '10px' }} />
                    <Legend verticalAlign="top" height={36} />
                    <Line type="monotone" dataKey="setup" name="Minutos de Set-Up (Preparación)" stroke="#fd7e14" strokeWidth={3} dot={{ r: 6 }} />
                    <Line type="monotone" dataKey="paradas" name="Minutos por Fallas / Paradas" stroke="#dc3545" strokeWidth={3} dot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#adb5bd' }}>Sin datos históricos</div>
              )}
            </div>
          </div>

          {/* SECCIÓN DE GRÁFICOS (DASHBOARD TRIPLE) */}
          <div style={{ display: 'flex', gap: '2rem', marginBottom: '3rem', flexWrap: 'wrap' }}>
            
            {/* Gráfico 1: Máquinas */}
            <div style={{ flex: '1 1 30%', minWidth: '350px', backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginTop: 0, color: '#495057', textAlign: 'center', marginBottom: '20px' }}>Impacto por Máquina</h3>
              <div style={{ width: '100%', height: 300 }}>
                {dataMaquinas.length > 0 ? (
                  <ResponsiveContainer>
                    <BarChart data={dataMaquinas} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{fill: '#6c757d'}} />
                      <YAxis tick={{fill: '#6c757d'}} />
                      <Tooltip cursor={{fill: '#f8f9fa'}} contentStyle={{ borderRadius: '10px' }} />
                      <Bar dataKey="minutos" fill="#0d6efd" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#adb5bd' }}>Sin datos en este período</div>}
              </div>
            </div>

            {/* Gráfico 2: Operadores */}
            <div style={{ flex: '1 1 30%', minWidth: '350px', backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginTop: 0, color: '#495057', textAlign: 'center', marginBottom: '20px' }}>Impacto por Operador</h3>
              <div style={{ width: '100%', height: 300 }}>
                {dataOperadores.length > 0 ? (
                  <ResponsiveContainer>
                    <BarChart data={dataOperadores} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{fill: '#6c757d'}} />
                      <YAxis tick={{fill: '#6c757d'}} />
                      <Tooltip cursor={{fill: '#f8f9fa'}} contentStyle={{ borderRadius: '10px' }} />
                      <Bar dataKey="minutos" fill="#6f42c1" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#adb5bd' }}>Sin datos en este período</div>}
              </div>
            </div>

            {/* Gráfico 3: Motivos de Parada */}
            <div style={{ flex: '1 1 30%', minWidth: '350px', backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginTop: 0, color: '#495057', textAlign: 'center', marginBottom: '20px' }}>Top 5 Motivos de Parada</h3>
              <div style={{ width: '100%', height: 300 }}>
                {dataMotivos.length > 0 ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={dataMotivos} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={5} dataKey="value">
                        {dataMotivos.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORES_PIE[index % COLORES_PIE.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '10px' }} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#adb5bd' }}>Sin datos en este período</div>}
              </div>
            </div>

          </div>

          {/* TABLA DE AUDITORÍA Y CRUD */}
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginTop: 0, color: '#495057', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
              Registro Crudo para Auditoría ({tiemposFiltrados.length} registros)
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#495057' }}>Fecha / Hora</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#495057' }}>Máquina</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#6f42c1' }}>Operador</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#495057' }}>Orden / Producto</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: '#495057' }}>Motivo</th>
                  <th style={{ padding: '15px', textAlign: 'center', color: '#dc3545' }}>Minutos</th>
                  <th style={{ padding: '15px', textAlign: 'center', color: '#495057' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tiemposFiltrados.map(parada => (
                  <tr key={parada.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '15px', fontSize: '0.9rem' }}>
                      <strong>{new Date(parada.fecha_registro).toLocaleDateString()}</strong><br/>
                      {parada.hora_inicio} a {parada.hora_fin}
                    </td>
                    <td style={{ padding: '15px', fontWeight: 'bold', color: '#17a2b8' }}>{parada.maquina}</td>
                    <td style={{ padding: '15px', fontWeight: 'bold', color: '#6f42c1' }}>
                      {parada.operador || 'Anónimo'}
                    </td>
                    <td style={{ padding: '15px', fontSize: '0.9rem' }}>
                      <strong>OP: {parada.numero_orden}</strong><br/>
                      {parada.producto}
                    </td>
                    <td style={{ padding: '15px', fontWeight: 'bold', color: '#555' }}>{parada.codigo_parada}</td>
                    <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: '#dc3545' }}>
                      {parada.minutos_duracion}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <button onClick={() => setParadaEditando(parada)} style={{ padding: '8px 12px', marginRight: '5px', backgroundColor: '#ffc107', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>✏️</button>
                      <button onClick={() => eliminarParada(parada.id)} style={{ padding: '8px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MODAL DE EDICIÓN */}
          {paradaEditando && (
            <div style={{ position: 'fixed', top: 0, left: '0', width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
              <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', width: '90%', maxWidth: '500px' }}>
                <h3 style={{ marginTop: 0, color: '#dc3545' }}>Editar Tiempo Muerto</h3>
                <form onSubmit={guardarEdicion} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ fontWeight: 'bold' }}>Minutos de Duración:</label>
                  <input type="number" value={paradaEditando.minutos_duracion} onChange={(e) => setParadaEditando({...paradaEditando, minutos_duracion: e.target.value})} style={{ padding: '10px', fontSize: '1.2rem', borderRadius: '5px', border: '1px solid #ccc' }} />
                  <label style={{ fontWeight: 'bold' }}>Motivo de la Parada (Código):</label>
                  <input type="text" value={paradaEditando.codigo_parada} onChange={(e) => setParadaEditando({...paradaEditando, codigo_parada: e.target.value})} style={{ padding: '10px', fontSize: '1.1rem', borderRadius: '5px', border: '1px solid #ccc' }} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                    <button type="button" onClick={() => setParadaEditando(null)} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
                    <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Guardar Cambios</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}