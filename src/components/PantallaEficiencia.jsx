import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import ReporteScrap from './ReporteScrap'; 
import { apiFetch } from '../services/api'; 

// Respaldo completo de las 64 incidencias oficiales + Set-Up Inicial
const INCIDENCIAS_OFICIALES = [
  "00 - Set-Up Inicial",
  "01- Cambio de Orden",
  "02- Falta de Personal",
  "03- Limpiar Refile",
  "04- Falla Eléctrica",
  "05- Atascamiento",
  "06- Mantenimiento Mecánico Correctivo",
  "08- Cambio Rollo Flejadora",
  "09- Pausa y Refrigerios",
  "12- Limpieza Circuito de Tintas",
  "13- Limpieza Fin de Jornada",
  "15- Problemas en Flejadora",
  "18- Clisee Mal Premontado (Proveedor)",
  "19- Correas Pegadora",
  "20- Rotación de Grabados",
  "21- Falla de Instrumentos",
  "22- Capacitación del Personal",
  "23- Troqueles sueltos-Falta de gomas-Torcedura de cuchillas",
  "25- Clisés sueltos (varios productos)",
  "28- Rotura de Troquel",
  "29- Rotura de Clisée",
  "32- Esperar planchas de Linea de Corrugado",
  "33- Cambio de Máquina (pasar personal)",
  "34- Cambio de Programa por pedido de Ventas",
  "35- Limpieza Ruedas de Tiro",
  "36- Cambio de Racla",
  "37- Cambio cuchillas Chapetón",
  "39- Falta de aire",
  "41- Limpieza de Clisée",
  "42- Cambio bandas cuerpo troquelador",
  "44- Problemas en Colero",
  "46- Problemas en bomba de tintero",
  "47- Cambio tacho de adhesivo",
  "48- Relevos en Corrugado",
  "49- Lavado bandejas de tinteros",
  "50- Clisee, preparar y encintar",
  "51- Corte de Energía Eléctrica",
  "55- Esperar confirmación de Orden de Trabajo",
  "56- Seleccionar Planchas",
  "58- Planchas despegadas, separa y seleccionar",
  "60- Reposicionar clises (Acomodar)",
  "61- Prensa Fardos",
  "62- Cambio de Trazabilidad",
  "63- Rotación Bandas Poliuretano",
  "64- Falta de autoelevador",
  "65- Se coloca goma a troquel",
  "66- Reunión de Personal",
  "68- Lavado de rolo anilox",
  "69- Recuperación de Cajas.",
  "70- Preparación de tintas.",
  "72- Esperar planchas impresas.",
  "73- Cambio de Tinta.",
  "74- Se saco muestras.",
  "75- Falta de Tarimas.",
  "76- Buscar Planchas",
  "77- Falta de Tintas",
  "82- Buscar troquel",
  "83- \"Varios\" Operativo",
  "85- \"Varios\" Alistamiento",
  "86- \"Varios\" Defecto Corrugado",
  "87- Capacitación del Personal Seguridad Industrial",
  "88- Arranque después de Turno Inactivo",
  "89- Traslado de personal Con carga de máquina",
  "90- Traslado de personal Sin carga de máquina",
  "91- Falta de Personal en Planta"
];

export default function PantallaEficiencia() {
  const [tiemposMuertos, setTiemposMuertos] = useState([]);
  const [paradaEditando, setParadaEditando] = useState(null);
  const [listaCodigosParada, setListaCodigosParada] = useState(INCIDENCIAS_OFICIALES);
  const [pestanaActiva, setPestanaActiva] = useState('tiempos');

  // 🎯 MULTIFILTROS DE COMANDO (MES, DÍA, MÁQUINA/FAMILIA, MAQUINISTA)
  const [mesSeleccionado, setMesSeleccionado] = useState('TODOS');
  const [diaSeleccionado, setDiaSeleccionado] = useState('TODOS');
  const [maquinaSeleccionada, setMaquinaSeleccionada] = useState('TODAS');
  const [operadorSeleccionado, setOperadorSeleccionado] = useState('TODOS');
  
  // Controles de visualización de gráficos
  const [agrupacionEvolucion, setAgrupacionEvolucion] = useState('DIA'); // 'DIA' | 'MES'
  const [tipoGraficoEvolucion, setTipoGraficoEvolucion] = useState('BARRAS'); // 'BARRAS' | 'LINEAS'
  const [seleccionadosAuditoria, setSeleccionadosAuditoria] = useState({});

  // 1. CARGAR DATOS Y CATÁLOGO DE PARADAS
  const cargarTiempos = async () => {
    try {
      const res = await apiFetch('/api/pedidos/tiempos-muertos/todos');
      if (res.ok) {
        const data = await res.json();
        setTiemposMuertos(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error cargando tiempos muertos:", error);
    }
  };

  const cargarCatalogoParadas = async () => {
    try {
      const resParadas = await apiFetch('/api/pedidos/recursos/paradas');
      if (resParadas.ok) {
        const dataParadas = await resParadas.json();
        if (Array.isArray(dataParadas) && dataParadas.length > 0) {
          const formateadas = dataParadas.map(item => {
            if (typeof item === 'string') return item;
            const desc = (item.descripcion || '').trim();
            const cod = (item.codigo || '').trim();
            if (/^\d+/.test(desc)) return desc;
            return cod ? `${cod} - ${desc}` : desc;
          }).filter(Boolean);

          if (formateadas.length > 0) {
            const unificadas = Array.from(new Set(["00 - Set-Up Inicial", ...formateadas, ...INCIDENCIAS_OFICIALES]));
            setListaCodigosParada(unificadas);
          }
        }
      }
    } catch (err) {
      console.error("Error cargando catálogo de paradas:", err);
    }
  };

  useEffect(() => {
    cargarTiempos();
    cargarCatalogoParadas();
  }, []);

  // 2. ELIMINAR INDIVIDUAL Y MASIVO (PARA LIMPIAR PRUEBAS)
  const eliminarParada = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este registro de tiempo muerto?')) return;
    try {
      const res = await apiFetch(`/api/pedidos/tiempos-muertos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        cargarTiempos();
      } else {
        alert('❌ No se pudo eliminar el registro.');
      }
    } catch (error) {
      console.error("Error al eliminar", error);
    }
  };

  const eliminarSeleccionadosMasivo = async () => {
    const ids = Object.keys(seleccionadosAuditoria);
    if (ids.length === 0) return;
    if (!window.confirm(`¿Eliminar definitivamente los ${ids.length} registros seleccionados?`)) return;

    try {
      for (const id of ids) {
        await apiFetch(`/api/pedidos/tiempos-muertos/${id}`, { method: 'DELETE' });
      }
      setSeleccionadosAuditoria({});
      cargarTiempos();
    } catch (error) {
      console.error("Error en borrado masivo:", error);
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
          minutos_duracion: Number(paradaEditando.minutos_duracion) || 0,
          codigo_parada: paradaEditando.codigo_parada,
          motivo: paradaEditando.codigo_parada,
          observaciones: paradaEditando.observaciones || ''
        })
      });
      if (res.ok) {
        setParadaEditando(null); 
        cargarTiempos(); 
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`❌ No se pudo guardar el cambio: ${err.error || res.statusText}`);
      }
    } catch (error) {
      console.error("Error al actualizar", error);
      alert('❌ Error de conexión al intentar actualizar el tiempo muerto.');
    }
  };

  // ==========================================
  // FUNCIONES AUXILIARES DE LIMPIEZA Y AGRUPACIÓN
  // ==========================================
  const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // Corrige el corte de "00 - Set-Up Inicial" -> "Set-Up Inicial" (sin cortar en el guion intermedio)
  const limpiarNombreMotivo = (codigoRaw) => {
    if (!codigoRaw) return 'Sin Especificar';
    return String(codigoRaw).replace(/^\d+\s*-\s*/, '').trim();
  };

  const esParadaSetup = (codigoRaw) => {
    const txt = String(codigoRaw || '').toLowerCase();
    return txt.includes('set-up') || txt.includes('setup') || txt.startsWith('00') || txt.startsWith('01-') || txt.includes('cambio de orden') || txt.includes('alistamiento');
  };

  const obtenerFamiliaRuta = (ruta) => {
    if (!ruta) return 'SIN ASIGNAR';
    const limpia = ruta.trim().toUpperCase();
    const partes = limpia.split('-');
    if (partes[0].startsWith('COR') && partes.length >= 2) {
      const maquinaBase = partes[1].replace(/X\d+$/i, '');
      return `COR-${maquinaBase}`;
    }
    return partes[0];
  };

  const obtenerClaveMes = (fechaStr) => {
    if (!fechaStr) return 'Sin Fecha';
    const fecha = new Date(fechaStr);
    if (isNaN(fecha)) return 'Sin Fecha';
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    return `${anio}-${mes}`;
  };

  const obtenerClaveDia = (fechaStr) => {
    if (!fechaStr) return 'Sin Fecha';
    const fecha = new Date(fechaStr);
    if (isNaN(fecha)) return 'Sin Fecha';
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  };

  const formatearClaveMes = (clave) => {
    if (clave === 'Sin Fecha') return clave;
    const [anio, mes] = clave.split('-');
    return `${nombresMeses[parseInt(mes, 10) - 1]} ${anio}`;
  };

  const formatearClaveDia = (clave) => {
    if (clave === 'Sin Fecha') return clave;
    const [, mes, dia] = clave.split('-');
    return `${dia}/${mes}`;
  };

  // Listas dinámicas para los selectores de filtro
  const mesesDisponibles = Array.from(new Set(tiemposMuertos.map(t => obtenerClaveMes(t.fecha_registro))))
    .filter(m => m !== 'Sin Fecha').sort().reverse();

  const diasDisponibles = Array.from(new Set(
    tiemposMuertos
      .filter(t => mesSeleccionado === 'TODOS' || obtenerClaveMes(t.fecha_registro) === mesSeleccionado)
      .map(t => obtenerClaveDia(t.fecha_registro))
  )).filter(d => d !== 'Sin Fecha').sort().reverse();

  const familiasDisponibles = Array.from(new Set(tiemposMuertos.map(t => obtenerFamiliaRuta(t.maquina)).filter(Boolean))).sort();
  const maquinasExactasDisponibles = Array.from(new Set(tiemposMuertos.map(t => (t.maquina || '').trim().toUpperCase()).filter(Boolean))).sort();
  const operadoresDisponibles = Array.from(new Set(tiemposMuertos.map(t => (t.operador || 'Anónimo').trim()).filter(Boolean))).sort();

  // ==========================================
  // 🎯 APLICACIÓN DEL ESCENARIO MULTI-FILTRO
  // ==========================================
  const tiemposFiltrados = tiemposMuertos.filter(t => {
    if (mesSeleccionado !== 'TODOS' && obtenerClaveMes(t.fecha_registro) !== mesSeleccionado) return false;
    if (diaSeleccionado !== 'TODOS' && obtenerClaveDia(t.fecha_registro) !== diaSeleccionado) return false;
    
    if (maquinaSeleccionada !== 'TODAS') {
      if (maquinaSeleccionada.startsWith('FAM:')) {
        const famBuscada = maquinaSeleccionada.replace('FAM:', '');
        if (obtenerFamiliaRuta(t.maquina) !== famBuscada) return false;
      } else {
        if ((t.maquina || '').trim().toUpperCase() !== maquinaSeleccionada) return false;
      }
    }

    if (operadorSeleccionado !== 'TODOS') {
      const op = (t.operador || 'Anónimo').trim();
      if (op !== operadorSeleccionado) return false;
    }

    return true;
  });

  // ==========================================
  // CÁLCULO DE KPIs GERENCIALES Y SERIES DE DATOS
  // ==========================================
  const totalMinutosPerdidos = tiemposFiltrados.reduce((acc, curr) => acc + (Number(curr.minutos_duracion) || 0), 0);
  const horasPerdidas = (totalMinutosPerdidos / 60).toFixed(1);

  const minutosSetup = tiemposFiltrados
    .filter(t => esParadaSetup(t.codigo_parada))
    .reduce((acc, curr) => acc + (Number(curr.minutos_duracion) || 0), 0);
  const minutosFallas = totalMinutosPerdidos - minutosSetup;

  const porcentajeSetup = totalMinutosPerdidos > 0 ? Math.round((minutosSetup / totalMinutosPerdidos) * 100) : 0;
  const porcentajeFallas = totalMinutosPerdidos > 0 ? 100 - porcentajeSetup : 0;

  // Cálculo de Disponibilidad Operativa Estimada (en base a jornadas activas detectadas de 9 hs / 540 min por máquina-día)
  const jornadasMaquinaUnicas = new Set(
    tiemposFiltrados.map(t => `${obtenerClaveDia(t.fecha_registro)}_${obtenerFamiliaRuta(t.maquina)}`)
  ).size;
  const minutosDisponiblesEstimados = Math.max(jornadasMaquinaUnicas * 540, totalMinutosPerdidos + 180);
  const disponibilidadOEE = totalMinutosPerdidos > 0
    ? Math.max(0, Math.min(100, ((minutosDisponiblesEstimados - totalMinutosPerdidos) / minutosDisponiblesEstimados) * 100)).toFixed(1)
    : '100.0';

  // 1. Evolución Temporal (Por Día o Por Mes sobre los datos filtrados)
  const dataEvolucion = Object.values(
    tiemposFiltrados.reduce((acc, curr) => {
      const clave = agrupacionEvolucion === 'MES'
        ? obtenerClaveMes(curr.fecha_registro)
        : obtenerClaveDia(curr.fecha_registro);
      if (clave === 'Sin Fecha') return acc;

      if (!acc[clave]) {
        acc[clave] = {
          claveOrden: clave,
          etiqueta: agrupacionEvolucion === 'MES' ? formatearClaveMes(clave) : formatearClaveDia(clave),
          setup: 0,
          paradas: 0,
          total: 0
        };
      }

      const mins = Number(curr.minutos_duracion) || 0;
      if (esParadaSetup(curr.codigo_parada)) {
        acc[clave].setup += mins;
      } else {
        acc[clave].paradas += mins;
      }
      acc[clave].total += mins;
      return acc;
    }, {})
  ).sort((a, b) => a.claveOrden.localeCompare(b.claveOrden));

  // 2. Comparativa de Equipos / Máquinas (Set-Up vs Fallas + Promedio)
  const dataMaquinas = Object.values(
    tiemposFiltrados.reduce((acc, curr) => {
      const maq = (curr.maquina || 'Sin Asignar').trim().toUpperCase();
      if (!acc[maq]) {
        acc[maq] = { name: maq, setup: 0, paradas: 0, minutos: 0, eventos: 0, cantSetups: 0 };
      }
      const mins = Number(curr.minutos_duracion) || 0;
      if (esParadaSetup(curr.codigo_parada)) {
        acc[maq].setup += mins;
        acc[maq].cantSetups += 1;
      } else {
        acc[maq].paradas += mins;
      }
      acc[maq].minutos += mins;
      acc[maq].eventos += 1;
      return acc;
    }, {})
  ).map(m => ({
    ...m,
    promedioSetup: m.cantSetups > 0 ? Math.round(m.setup / m.cantSetups) : 0,
    promedioParada: m.eventos > 0 ? Math.round(m.minutos / m.eventos) : 0
  })).sort((a, b) => b.minutos - a.minutos);

  // 3. Comparativa de Maquinistas / Operadores (Set-Up vs Fallas + Promedio SMED)
  const dataOperadores = Object.values(
    tiemposFiltrados.reduce((acc, curr) => {
      const op = (curr.operador || 'Anónimo').trim();
      if (!acc[op]) {
        acc[op] = { name: op, setup: 0, paradas: 0, minutos: 0, eventos: 0, cantSetups: 0 };
      }
      const mins = Number(curr.minutos_duracion) || 0;
      if (esParadaSetup(curr.codigo_parada)) {
        acc[op].setup += mins;
        acc[op].cantSetups += 1;
      } else {
        acc[op].paradas += mins;
      }
      acc[op].minutos += mins;
      acc[op].eventos += 1;
      return acc;
    }, {})
  ).map(o => ({
    ...o,
    promedioSetup: o.cantSetups > 0 ? Math.round(o.setup / o.cantSetups) : 0,
    promedioTotal: o.eventos > 0 ? Math.round(o.minutos / o.eventos) : 0
  })).sort((a, b) => b.minutos - a.minutos);

  // 4. Pareto de Motivos de Parada (Con nombre completo sin cortar)
  const dataMotivosCompleta = Object.values(
    tiemposFiltrados.reduce((acc, curr) => {
      const motivoLimpio = limpiarNombreMotivo(curr.codigo_parada);
      if (!acc[motivoLimpio]) {
        acc[motivoLimpio] = { name: motivoLimpio, codigoOriginal: curr.codigo_parada, value: 0, eventos: 0 };
      }
      acc[motivoLimpio].value += Number(curr.minutos_duracion) || 0;
      acc[motivoLimpio].eventos += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.value - a.value);

  const dataMotivosTop5 = dataMotivosCompleta.slice(0, 5);
  const cuelloDeBotella = dataMotivosCompleta.length > 0 ? dataMotivosCompleta[0] : null;
  const maquinaCritica = dataMaquinas.length > 0 ? dataMaquinas[0] : null;

  const COLORES_PIE = ['#dc3545', '#fd7e14', '#ffc107', '#20c997', '#0d6efd'];

  const limpiarTodosLosFiltros = () => {
    setMesSeleccionado('TODOS');
    setDiaSeleccionado('TODOS');
    setMaquinaSeleccionada('TODAS');
    setOperadorSeleccionado('TODOS');
  };

  const hayFiltrosActivos =
    mesSeleccionado !== 'TODOS' ||
    diaSeleccionado !== 'TODOS' ||
    maquinaSeleccionada !== 'TODAS' ||
    operadorSeleccionado !== 'TODOS';

  return (
    <div style={{ padding: '1.5rem 2rem', width: '100%', maxWidth: '1440px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* 🧭 PESTAÑAS DE NAVEGACIÓN SUPERIOR INTERNA */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '1.5rem', borderBottom: '3px solid #cbd5e1', paddingBottom: '15px', flexWrap: 'wrap' }}>
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
            fontSize: '1.05rem',
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
            fontSize: '1.05rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}
        >
          📊 Auditoría de Scrap (Kg & Pareto)
        </button>
      </div>

      {pestanaActiva === 'scrap' ? (
        <ReporteScrap />
      ) : (
        <div>
          {/* =========================================================================
              🚀 CONSOLA DE COMANDO MULTI-FILTRO (MES, DÍA, MÁQUINA, MAQUINISTA)
             ========================================================================= */}
          <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.8rem', boxShadow: '0 6px 12px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '2.2rem' }}>📈</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#f8fafc' }}>Centro de Control de Eficiencia y OEE</h2>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Monitoreo en tiempo real de máquinas, maquinistas, SMED y cuellos de botella</span>
                </div>
              </div>

              {hayFiltrosActivos && (
                <button
                  onClick={limpiarTodosLosFiltros}
                  style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  🔄 Restablecer Filtros
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
              {/* Filtro 1: Mes */}
              <div style={{ backgroundColor: '#1e293b', padding: '10px 14px', borderRadius: '8px', border: '1px solid #334155' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '5px' }}>📅 MES / PERÍODO</label>
                <select
                  value={mesSeleccionado}
                  onChange={(e) => {
                    setMesSeleccionado(e.target.value);
                    setDiaSeleccionado('TODOS');
                  }}
                  style={{ width: '100%', padding: '8px', borderRadius: '5px', border: 'none', fontWeight: 'bold', backgroundColor: '#0f172a', color: '#38bdf8', cursor: 'pointer' }}
                >
                  <option value="TODOS">🌎 Histórico Completo</option>
                  {mesesDisponibles.map(mes => (
                    <option key={mes} value={mes}>{formatearClaveMes(mes)}</option>
                  ))}
                </select>
              </div>

              {/* Filtro 2: Día Exacto */}
              <div style={{ backgroundColor: '#1e293b', padding: '10px 14px', borderRadius: '8px', border: '1px solid #334155' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '5px' }}>📆 DÍA ESPECÍFICO</label>
                <select
                  value={diaSeleccionado}
                  onChange={(e) => setDiaSeleccionado(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '5px', border: 'none', fontWeight: 'bold', backgroundColor: '#0f172a', color: '#fbbf24', cursor: 'pointer' }}
                >
                  <option value="TODOS">🗓️ Todos los días ({diasDisponibles.length})</option>
                  {diasDisponibles.map(dia => (
                    <option key={dia} value={dia}>Día {formatearClaveDia(dia)} ({dia.split('-')[0]})</option>
                  ))}
                </select>
              </div>

              {/* Filtro 3: Máquina o Familia */}
              <div style={{ backgroundColor: '#1e293b', padding: '10px 14px', borderRadius: '8px', border: '1px solid #334155' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '5px' }}>⚙️ MÁQUINA / FAMILIA</label>
                <select
                  value={maquinaSeleccionada}
                  onChange={(e) => setMaquinaSeleccionada(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '5px', border: 'none', fontWeight: 'bold', backgroundColor: '#0f172a', color: '#4ade80', cursor: 'pointer' }}
                >
                  <option value="TODAS">🏭 Todas las Máquinas</option>
                  <optgroup label="Por Familia de Ruta">
                    {familiasDisponibles.map(fam => (
                      <option key={`FAM:${fam}`} value={`FAM:${fam}`}>📂 Familia {fam}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Por Ruta Exacta">
                    {maquinasExactasDisponibles.map(maq => (
                      <option key={maq} value={maq}>🔧 {maq}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Filtro 4: Maquinista / Operador */}
              <div style={{ backgroundColor: '#1e293b', padding: '10px 14px', borderRadius: '8px', border: '1px solid #334155' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '5px' }}>👷 MAQUINISTA / OPERADOR</label>
                <select
                  value={operadorSeleccionado}
                  onChange={(e) => setOperadorSeleccionado(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '5px', border: 'none', fontWeight: 'bold', backgroundColor: '#0f172a', color: '#c084fc', cursor: 'pointer' }}
                >
                  <option value="TODOS">👥 Todos los Maquinistas ({operadoresDisponibles.length})</option>
                  {operadoresDisponibles.map(op => (
                    <option key={op} value={op}>👷 {op}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* =========================================================================
              📊 4 TARJETAS DE KPIs INTELIGENTES (SIN TEXTOS CORTADOS)
             ========================================================================= */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.2rem', marginBottom: '2rem' }}>
            
            {/* KPI 1: Disponibilidad OEE y Total Eventos */}
            <div style={{ backgroundColor: 'white', padding: '1.3rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.07)', borderLeft: '5px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>Disponibilidad Operativa (Est.)</h3>
                <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  {tiemposFiltrados.length} eventos
                </span>
              </div>
              <p style={{ margin: '8px 0 4px 0', fontSize: '2.2rem', fontWeight: 'bold', color: '#0f172a' }}>
                {disponibilidadOEE}%
              </p>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                En {jornadasMaquinaUnicas || 1} jornada(s)-máquina analizadas
              </span>
            </div>

            {/* KPI 2: Tiempo Total Perdido + Desglose SMED vs Fallas */}
            <div style={{ backgroundColor: 'white', padding: '1.3rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.07)', borderLeft: '5px solid #ef4444' }}>
              <h3 style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>Tiempo Total Perdido (TNP)</h3>
              <p style={{ margin: '8px 0 4px 0', fontSize: '2.2rem', fontWeight: 'bold', color: '#dc2626' }}>
                {totalMinutosPerdidos} <span style={{ fontSize: '1.1rem' }}>min</span>
                <span style={{ fontSize: '0.95rem', color: '#64748b', marginLeft: '8px' }}>({horasPerdidas} hs)</span>
              </p>
              <div style={{ fontSize: '0.8rem', display: 'flex', gap: '10px', marginTop: '4px' }}>
                <span style={{ color: '#ea580c', fontWeight: 'bold' }}>🔧 Set-Up: {minutosSetup}m ({porcentajeSetup}%)</span>
                <span style={{ color: '#dc2626', fontWeight: 'bold' }}>⚠️ Fallas: {minutosFallas}m ({porcentajeFallas}%)</span>
              </div>
            </div>

            {/* KPI 3: Principal Cuello de Botella (Nombre Completo) */}
            <div style={{ backgroundColor: 'white', padding: '1.3rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.07)', borderLeft: '5px solid #0ea5e9' }}>
              <h3 style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>Principal Cuello de Botella</h3>
              <p style={{ margin: '8px 0 4px 0', fontSize: '1.25rem', fontWeight: 'bold', color: '#0284c7', lineHeight: 1.25 }}>
                {cuelloDeBotella ? cuelloDeBotella.name : 'Sin paradas registradas'}
              </p>
              {cuelloDeBotella && (
                <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 'bold' }}>
                  ⏱️ {cuelloDeBotella.value} min ({Math.round((cuelloDeBotella.value / Math.max(1, totalMinutosPerdidos)) * 100)}% del total) en {cuelloDeBotella.eventos} evento(s)
                </span>
              )}
            </div>

            {/* KPI 4: Máquina / Equipo con Mayor Impacto */}
            <div style={{ backgroundColor: 'white', padding: '1.3rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.07)', borderLeft: '5px solid #f59e0b' }}>
              <h3 style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>Equipo con Mayor Tiempo Muerto</h3>
              <p style={{ margin: '8px 0 4px 0', fontSize: '1.6rem', fontWeight: 'bold', color: '#d97706' }}>
                {maquinaCritica ? maquinaCritica.name : 'N/A'}
              </p>
              {maquinaCritica && (
                <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 'bold' }}>
                  🔥 {maquinaCritica.minutos} min ({maquinaCritica.eventos} paradas | Prom: {maquinaCritica.promedioParada} min/parada)
                </span>
              )}
            </div>
          </div>

          {/* =========================================================================
              📈 GRÁFICO ESTRELLA: EVOLUCIÓN DINÁMICA (POR DÍA O POR MES)
             ========================================================================= */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.08)', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e293b' }}>
                  📊 Evolución Temporal de TNP: Set-Up (Preparación) vs. Fallas Imprevistas
                </h3>
                <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.88rem' }}>
                  Seguimiento del aprendizaje en alistamiento (SMED) frente a paradas operativas ({agrupacionEvolucion === 'DIA' ? 'Vista Día por Día' : 'Vista Mes a Mes'})
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setAgrupacionEvolucion('DIA')}
                  style={{
                    padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.82rem',
                    backgroundColor: agrupacionEvolucion === 'DIA' ? '#0d6efd' : '#f8fafc',
                    color: agrupacionEvolucion === 'DIA' ? 'white' : '#334155'
                  }}
                >
                  📆 Ver por Día
                </button>
                <button
                  onClick={() => setAgrupacionEvolucion('MES')}
                  style={{
                    padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.82rem',
                    backgroundColor: agrupacionEvolucion === 'MES' ? '#0d6efd' : '#f8fafc',
                    color: agrupacionEvolucion === 'MES' ? 'white' : '#334155'
                  }}
                >
                  📅 Ver por Mes
                </button>
                <button
                  onClick={() => setTipoGraficoEvolucion(prev => prev === 'BARRAS' ? 'LINEAS' : 'BARRAS')}
                  style={{
                    padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.82rem',
                    backgroundColor: '#f1f5f9', color: '#0f172a'
                  }}
                >
                  {tipoGraficoEvolucion === 'BARRAS' ? '📈 Cambiar a Líneas' : '📊 Cambiar a Barras'}
                </button>
              </div>
            </div>

            <div style={{ width: '100%', height: 290 }}>
              {dataEvolucion.length > 0 ? (
                <ResponsiveContainer>
                  {tipoGraficoEvolucion === 'BARRAS' || dataEvolucion.length === 1 ? (
                    <BarChart data={dataEvolucion} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="etiqueta" tick={{ fill: '#334155', fontWeight: 'bold' }} />
                      <YAxis tick={{ fill: '#64748b' }} />
                      <Tooltip contentStyle={{ borderRadius: '8px' }} />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="setup" name="Minutos de Set-Up (Preparación)" fill="#fd7e14" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="paradas" name="Minutos por Fallas / Paradas" fill="#dc3545" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={dataEvolucion} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="etiqueta" tick={{ fill: '#334155', fontWeight: 'bold' }} />
                      <YAxis tick={{ fill: '#64748b' }} />
                      <Tooltip contentStyle={{ borderRadius: '8px' }} />
                      <Legend verticalAlign="top" height={36} />
                      <Line type="monotone" dataKey="setup" name="Minutos de Set-Up (Preparación)" stroke="#fd7e14" strokeWidth={3} dot={{ r: 6 }} />
                      <Line type="monotone" dataKey="paradas" name="Minutos por Fallas / Paradas" stroke="#dc3545" strokeWidth={3} dot={{ r: 6 }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  Sin registros para la combinación de filtros seleccionada
                </div>
              )}
            </div>
          </div>

          {/* =========================================================================
              ⚔️ GRÁFICOS COMPARATIVOS (MÁQUINAS, MAQUINISTAS Y PARETO DE CAUSAS)
             ========================================================================= */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            
            {/* Comparativa 1: Máquina vs Máquina (Set-Up vs Fallas Apiladas) */}
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.08)' }}>
              <h3 style={{ marginTop: 0, color: '#1e293b', textAlign: 'center', marginBottom: '5px' }}>⚙️ Comparativa de Equipos (Set-Up vs. Fallas)</h3>
              <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.82rem', marginTop: 0, marginBottom: '15px' }}>
                Hacé clic en una barra para filtrar todo el tablero por esa máquina
              </p>
              <div style={{ width: '100%', height: 280 }}>
                {dataMaquinas.length > 0 ? (
                  <ResponsiveContainer>
                    <BarChart
                      data={dataMaquinas}
                      margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                      onClick={(estado) => {
                        if (estado && estado.activeLabel) {
                          setMaquinaSeleccionada(prev => prev === estado.activeLabel ? 'TODAS' : estado.activeLabel);
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#334155', fontWeight: 'bold', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#64748b' }} />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px' }} />
                      <Legend verticalAlign="top" height={32} />
                      <Bar dataKey="setup" name="Set-Up (min)" stackId="a" fill="#fd7e14" cursor="pointer" />
                      <Bar dataKey="paradas" name="Fallas / Paradas (min)" stackId="a" fill="#0d6efd" radius={[4, 4, 0, 0]} cursor="pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Sin datos</div>}
              </div>
            </div>

            {/* Comparativa 2: Maquinista vs Maquinista (Set-Up vs Fallas Apiladas) */}
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.08)' }}>
              <h3 style={{ marginTop: 0, color: '#1e293b', textAlign: 'center', marginBottom: '5px' }}>👷 Desempeño por Maquinista (SMED vs. Paradas)</h3>
              <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.82rem', marginTop: 0, marginBottom: '15px' }}>
                Hacé clic en un maquinista para auditar su historial individual
              </p>
              <div style={{ width: '100%', height: 280 }}>
                {dataOperadores.length > 0 ? (
                  <ResponsiveContainer>
                    <BarChart
                      data={dataOperadores}
                      margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                      onClick={(estado) => {
                        if (estado && estado.activeLabel) {
                          setOperadorSeleccionado(prev => prev === estado.activeLabel ? 'TODOS' : estado.activeLabel);
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#334155', fontWeight: 'bold', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#64748b' }} />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px' }} />
                      <Legend verticalAlign="top" height={32} />
                      <Bar dataKey="setup" name="Set-Up (min)" stackId="op" fill="#f59e0b" cursor="pointer" />
                      <Bar dataKey="paradas" name="Paradas Operativas (min)" stackId="op" fill="#6f42c1" radius={[4, 4, 0, 0]} cursor="pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Sin datos</div>}
              </div>
            </div>
          </div>

          {/* =========================================================================
              🏆 RANKING DE PARETO DE INCIDENCIAS + EFICIENCIA DE MAQUINISTAS
             ========================================================================= */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
            
            {/* Pareto 80/20 de Motivos de Parada */}
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.08)' }}>
              <h3 style={{ marginTop: 0, color: '#1e293b', marginBottom: '15px' }}>🎯 Ranking Pareto de Causas de Parada</h3>
              {dataMotivosCompleta.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Sin causas registradas</div>
              ) : (
                <div style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: '5px' }}>
                  {dataMotivosCompleta.map((m, idx) => {
                    const pct = totalMinutosPerdidos > 0 ? Math.round((m.value / totalMinutosPerdidos) * 100) : 0;
                    return (
                      <div key={idx} style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 'bold', marginBottom: '4px', color: '#334155' }}>
                          <span>{idx + 1}. {m.name} <small style={{ color: '#64748b' }}>({m.eventos} ev.)</small></span>
                          <span style={{ color: '#dc2626' }}>{m.value} min ({pct}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: COLORES_PIE[idx % COLORES_PIE.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tabla Comparativa de Eficiencia por Maquinista (Promedios SMED) */}
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.08)' }}>
              <h3 style={{ marginTop: 0, color: '#1e293b', marginBottom: '15px' }}>⏱️ Indicadores de Velocidad por Maquinista</h3>
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '10px' }}>Maquinista</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Eventos</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Prom. Set-Up</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Total Min.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataOperadores.map((op, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#6f42c1' }}>{op.name}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>{op.eventos}</td>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#d97706' }}>
                          {op.promedioSetup > 0 ? `${op.promedioSetup} min` : '—'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#dc2626' }}>{op.minutos} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* =========================================================================
              📋 BITÁCORA DE AUDITORÍA Y LIMPIEZA DE PRUEBAS (CON CHECKBOXES)
             ========================================================================= */}
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0, color: '#334155' }}>
                📋 Bitácora de Auditoría ({tiemposFiltrados.length} registros visibles)
              </h3>

              {Object.keys(seleccionadosAuditoria).length > 0 && (
                <button
                  onClick={eliminarSeleccionadosMasivo}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  🗑️ Eliminar seleccionados ({Object.keys(seleccionadosAuditoria).length})
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '12px', textAlign: 'center', width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={tiemposFiltrados.length > 0 && tiemposFiltrados.every(p => seleccionadosAuditoria[p.id])}
                        onChange={() => {
                          const todos = tiemposFiltrados.every(p => seleccionadosAuditoria[p.id]);
                          if (todos) {
                            setSeleccionadosAuditoria({});
                          } else {
                            const nuevo = {};
                            tiemposFiltrados.forEach(p => { nuevo[p.id] = true; });
                            setSeleccionadosAuditoria(nuevo);
                          }
                        }}
                        style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#495057' }}>Fecha / Hora</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#495057' }}>Máquina</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#6f42c1' }}>Maquinista</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#495057' }}>Orden / Producto</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#495057' }}>Motivo Oficial</th>
                    <th style={{ padding: '12px', textAlign: 'center', color: '#dc3545' }}>Minutos</th>
                    <th style={{ padding: '12px', textAlign: 'center', color: '#495057' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tiemposFiltrados.map(parada => (
                    <tr key={parada.id} style={{ borderBottom: '1px solid #dee2e6', backgroundColor: seleccionadosAuditoria[parada.id] ? '#fff5f5' : 'white' }}>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={!!seleccionadosAuditoria[parada.id]}
                          onChange={() => {
                            setSeleccionadosAuditoria(prev => {
                              const copia = { ...prev };
                              if (copia[parada.id]) delete copia[parada.id];
                              else copia[parada.id] = true;
                              return copia;
                            });
                          }}
                          style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                        <strong>{new Date(parada.fecha_registro).toLocaleDateString()}</strong><br/>
                        <span style={{ color: '#6c757d', fontSize: '0.82rem' }}>{parada.hora_inicio} a {parada.hora_fin}</span>
                      </td>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#0284c7' }}>{parada.maquina}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#6f42c1' }}>
                        {parada.operador || 'Anónimo'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                        <strong>OP: {parada.numero_orden}</strong><br/>
                        <span style={{ color: '#555', fontSize: '0.82rem' }}>{parada.producto}</span>
                      </td>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#334155' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.82rem',
                          backgroundColor: esParadaSetup(parada.codigo_parada) ? '#fff3cd' : '#f8d7da',
                          color: esParadaSetup(parada.codigo_parada) ? '#856404' : '#842029'
                        }}>
                          {parada.codigo_parada}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.15rem', color: '#dc3545' }}>
                        {parada.minutos_duracion}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button onClick={() => setParadaEditando(parada)} style={{ padding: '7px 11px', marginRight: '5px', backgroundColor: '#ffc107', border: 'none', borderRadius: '5px', cursor: 'pointer' }} title="Editar minutos o motivo">✏️</button>
                        <button onClick={() => eliminarParada(parada.id)} style={{ padding: '7px 11px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }} title="Eliminar parada">🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MODAL DE EDICIÓN CON SELECTOR DE LAS 64 INCIDENCIAS */}
          {paradaEditando && (
            <div style={{ position: 'fixed', top: 0, left: '0', width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
              <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '10px', width: '90%', maxWidth: '520px' }}>
                <h3 style={{ marginTop: 0, color: '#dc3545' }}>Editar Tiempo Muerto</h3>
                <form onSubmit={guardarEdicion} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ fontWeight: 'bold' }}>Minutos de Duración:</label>
                  <input 
                    type="number" 
                    min="0"
                    required
                    value={paradaEditando.minutos_duracion} 
                    onChange={(e) => setParadaEditando({...paradaEditando, minutos_duracion: e.target.value})} 
                    style={{ padding: '10px', fontSize: '1.2rem', borderRadius: '5px', border: '1px solid #ccc' }} 
                  />

                  <label style={{ fontWeight: 'bold' }}>Motivo de la Parada (Código Oficial):</label>
                  <select
                    required
                    value={paradaEditando.codigo_parada || ''}
                    onChange={(e) => setParadaEditando({ ...paradaEditando, codigo_parada: e.target.value })}
                    style={{
                      padding: '12px',
                      fontSize: '1.05rem',
                      borderRadius: '5px',
                      border: '2px solid #0d6efd',
                      backgroundColor: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    {paradaEditando.codigo_parada && !listaCodigosParada.includes(paradaEditando.codigo_parada) && (
                      <option value={paradaEditando.codigo_parada}>{paradaEditando.codigo_parada}</option>
                    )}
                    {listaCodigosParada.map((inc, idx) => (
                      <option key={idx} value={inc}>{inc}</option>
                    ))}
                  </select>

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