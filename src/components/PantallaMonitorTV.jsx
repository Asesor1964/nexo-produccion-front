import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api'; // 👈 IMPORTACIÓN CENTRALIZADA

export default function PantallaMonitorTV() {
  const [listaMaquinas, setListaMaquinas] = useState([]);
  const [maquinaSeleccionada, setMaquinaSeleccionada] = useState('');
  const [colaPedidos, setColaPedidos] = useState([]);
  const [tiemposMuertos, setTiemposMuertos] = useState([]);
  const [relojActual, setRelojActual] = useState(new Date());

  // ESTADOS SINCRONIZADOS DESDE LA TABLET DEL MAQUINISTA
  const [estadoMaquina, setEstadoMaquina] = useState('ESPERA'); // ESPERA | PRODUCIENDO | SETUP | PARADA
  const [cajasPedidoActual, setCajasPedidoActual] = useState(0);
  const [velocidadInstantanea, setVelocidadInstantanea] = useState(0);
  const [operadorEnPlanta, setOperadorEnPlanta] = useState('');

  // CRONÓMETROS EN VIVO DE TNP LOCALES
  const [segundosSetupVivo, setSegundosSetupVivo] = useState(0);
  const [segundosFallaVivo, setSegundosFallaVivo] = useState(0);

  // 1. RELOJ EN TIEMPO REAL Y CÁLCULO DE MINUTOS DEL TURNO (8 HS = 480 MIN)
  useEffect(() => {
    const timer = setInterval(() => setRelojActual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const obtenerInfoTurno = (fecha) => {
    const hora = fecha.getHours();
    const min = fecha.getMinutes();
    let horasTranscurridas = 0;
    let nombre = '';

    if (hora >= 6 && hora < 14) {
      nombre = '☀️ TURNO MAÑANA (06:00 a 14:00)';
      horasTranscurridas = hora - 6;
    } else if (hora >= 14 && hora < 22) {
      nombre = '🌤️ TURNO TARDE (14:00 a 22:00)';
      horasTranscurridas = hora - 14;
    } else {
      nombre = '🌙 TURNO NOCHE (22:00 a 06:00)';
      horasTranscurridas = hora >= 22 ? hora - 22 : hora + 2;
    }

    const minutosTranscurridosTurno = Math.max(1, (horasTranscurridas * 60) + min);
    return { nombre, minutosTranscurridosTurno };
  };

  const turnoActual = obtenerInfoTurno(relojActual);

  // 2. CARGA DE DATOS Y SINCRONIZACIÓN CON EL MAQUINISTA
  const cargarDatosPlanta = async (maq) => {
    try {
      let maquinasFinales = [];
      let todosLosPedidos = [];

      const resPed = await apiFetch('/api/pedidos');
      if (resPed.ok) {
        todosLosPedidos = await resPed.json();
      }

      try {
        const resMaq = await apiFetch('/api/pedidos/recursos/maquinas');
        if (resMaq.ok) {
          maquinasFinales = await resMaq.json();
        }
      } catch (e) {}

      if (!Array.isArray(maquinasFinales) || maquinasFinales.length === 0) {
        const rutasUnicas = Array.from(
          new Set(
            todosLosPedidos
              .map(p => p.maquina_asignada ? p.maquina_asignada.trim().toUpperCase() : '')
              .filter(m => m && isNaN(m) && !m.includes(','))
          )
        ).sort();

        maquinasFinales = rutasUnicas.map((r, i) => ({
          id: i + 1,
          codigo_maquina: r,
          velocidad_estandar: 120
        }));
      }

      setListaMaquinas(maquinasFinales);
      const maqActiva = maq || (maquinasFinales.length > 0 ? maquinasFinales[0].codigo_maquina : '');
      if (!maq && maqActiva) {
        setMaquinaSeleccionada(maqActiva);
      }

      // TNP
      try {
        const resTNP = await apiFetch('/api/pedidos/tiempos-muertos/todos');
        if (resTNP.ok) {
          setTiemposMuertos(await resTNP.json());
        }
      } catch (e) {
        setTiemposMuertos([]);
      }

      // Cola de la máquina
      if (maqActiva) {
        let colaCargada = false;
        try {
          const resCola = await apiFetch(`/api/pedidos/cola/${encodeURIComponent(maqActiva)}`);
          if (resCola.ok) {
            const cola = await resCola.json();
            setColaPedidos(cola);
            colaCargada = true;
          }
        } catch (e) {}

        if (!colaCargada && todosLosPedidos.length > 0) {
          const colaFiltradaLocal = todosLosPedidos
            .filter(p => {
              const coincideMaquina = (p.maquina_asignada || '').toUpperCase().includes(maqActiva.toUpperCase());
              const estadoLimpio = (p.estado || '').trim().toLowerCase();
              const estaHabilitada = ['habilitada', 'en produccion', 'en producción'].includes(estadoLimpio);
              return coincideMaquina && estaHabilitada;
            })
            .sort((a, b) => (a.prioridad_secuencia || 9999) - (b.prioridad_secuencia || 9999));
          setColaPedidos(colaFiltradaLocal);
        }

        // 🛰️ CONSULTAR ESTADO VIVO DESDE LA TABLET DEL MAQUINISTA
        try {
          const resVivo = await apiFetch(`/api/pedidos/maquinas/${encodeURIComponent(maqActiva)}/estado-vivo`);
          if (resVivo.ok) {
            const dataVivo = await resVivo.json();
            const estadoRecibido = dataVivo.estado || 'ESPERA';
            setEstadoMaquina(estadoRecibido);
            
            // 🎯 BLINDAJE DE CRONÓMETRO EN VIVO: Sincronizamos los segundos exactos desde la tablet
            const segundosRealesFase = Number(dataVivo.segundos_fase) || 0;
            if (estadoRecibido === 'SETUP') {
              setSegundosSetupVivo(segundosRealesFase);
              setSegundosFallaVivo(0);
            } else if (estadoRecibido === 'PARADA') {
              setSegundosFallaVivo(segundosRealesFase);
              setSegundosSetupVivo(0);
            } else {
              setSegundosSetupVivo(0);
              setSegundosFallaVivo(0);
            }

            // 🛡️ BLINDAJE: Si la máquina está en ESPERA o en SETUP, las cajas del pedido actual DEBEN ser 0
            if (['ESPERA', 'SETUP'].includes(estadoRecibido)) {
              setCajasPedidoActual(0);
            } else {
              setCajasPedidoActual(Number(dataVivo.cajas) || 0);
            }

            setVelocidadInstantanea(Number(dataVivo.velocidad) || 0);
            setOperadorEnPlanta(dataVivo.operador || '');
          }
        } catch (errVivo) {
          console.error("Error al obtener estado vivo del maquinista:", errVivo);
        }
      }
    } catch (error) {
      console.error("Error cargando monitor TV:", error);
    }
  };

  useEffect(() => {
    cargarDatosPlanta(maquinaSeleccionada);
    const refresco = setInterval(() => cargarDatosPlanta(maquinaSeleccionada), 2000);
    return () => clearInterval(refresco);
  }, [maquinaSeleccionada]);

  // OBJETO MÁQUINA ACTIVA
  const maquinaActivaObj = listaMaquinas.find(m => m.codigo_maquina === maquinaSeleccionada) || {};
  const VELOCIDAD_ESTANDAR = Number(maquinaActivaObj.velocidad_estandar) || 120;

  // ORDEN EN CURSO
  const primeraOrdenCola = colaPedidos.length > 0 ? colaPedidos[0] : null;

  const ordenEnCurso = primeraOrdenCola ? {
    numero_orden: primeraOrdenCola.numero_orden || primeraOrdenCola.id,
    cliente: primeraOrdenCola.cliente || 'Sin cliente',
    producto_descripcion: primeraOrdenCola.producto_descripcion || primeraOrdenCola.descripcion_producto || 'Sin descripción',
    cantidad_programada: Number(primeraOrdenCola.cantidad_programada) || 0,
    largo_lamina_mm: Number(primeraOrdenCola.largo_lamina_mm || primeraOrdenCola.largo) || 800,
    ancho_lamina_mm: Number(primeraOrdenCola.ancho_lamina_mm || primeraOrdenCola.ancho) || 600,
    m2_tot: Number(primeraOrdenCola.m2_totales_orden || primeraOrdenCola.m2_tot) || 0,
    ruta_asignada: primeraOrdenCola.maquina_asignada || ''
  } : {
    numero_orden: '---',
    cliente: 'SIN ÓRDENES EN COLA PARA ESTA MÁQUINA',
    producto_descripcion: 'Asigne órdenes a esta ruta en el Panel del Programador',
    cantidad_programada: 0,
    largo_lamina_mm: 0,
    ancho_lamina_mm: 0,
    m2_tot: 0,
    ruta_asignada: ''
  };

  // MULTIPLICADOR DE SALIDAS (X1, X2, X3...)
  const obtenerMultiplicadorRuta = (rutaOrden, maqMonitorizada) => {
    if (!rutaOrden) return 1;
    const rutaStr = rutaOrden.toUpperCase();
    const maqStr = (maqMonitorizada || '').toUpperCase();

    const partesRuta = rutaStr.split('-');
    for (const parte of partesRuta) {
      if (maqStr && parte.includes(maqStr.replace('COR-', ''))) {
        const matchEspecifico = parte.match(/X(\d+(?:[.,]\d+)?)/i);
        if (matchEspecifico) {
          return parseFloat(matchEspecifico[1].replace(',', '.')) || 1;
        }
      }
    }

    const matchGeneral = rutaStr.match(/X(\d+(?:[.,]\d+)?)/i);
    if (matchGeneral) {
      return parseFloat(matchGeneral[1].replace(',', '.')) || 1;
    }

    return 1;
  };

  const multiplicadorSalidas = obtenerMultiplicadorRuta(ordenEnCurso.ruta_asignada, maquinaSeleccionada);

  // SUPERFICIE m²
  const cantProgramada = Number(ordenEnCurso.cantidad_programada) || 0;
  const m2PorCaja = (ordenEnCurso.m2_tot > 0 && cantProgramada > 0)
    ? (ordenEnCurso.m2_tot / cantProgramada)
    : ((ordenEnCurso.largo_lamina_mm * ordenEnCurso.ancho_lamina_mm) / 1000000);

  // CRONÓMETROS TNP  
  useEffect(() => {
    let timerTNP = null;
    if (estadoMaquina === 'SETUP') {
      timerTNP = setInterval(() => setSegundosSetupVivo(prev => prev + 1), 1000);
    } else if (estadoMaquina === 'PARADA') {
      timerTNP = setInterval(() => setSegundosFallaVivo(prev => prev + 1), 1000);
    } else {
      clearInterval(timerTNP);
    }
    return () => clearInterval(timerTNP);
  }, [estadoMaquina]);

  const formatearMinSeg = (totalSegundos) => {
    const m = Math.floor(totalSegundos / 60);
    const s = totalSegundos % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  // CÁLCULOS OEE
  const porcentajePedido = cantProgramada > 0 ? Math.min(100, Math.round((cajasPedidoActual / cantProgramada) * 100)) : 0;
  const m2PedidoActual = Math.round(cajasPedidoActual * m2PorCaja);
  const m2ProgramadosOrden = ordenEnCurso.m2_tot > 0 ? Math.round(ordenEnCurso.m2_tot) : Math.round(cantProgramada * m2PorCaja);

  const hoyStr = relojActual.toDateString();
  const tnpTurnoMaquina = tiemposMuertos.filter(t => {
    const esMismaMaquina = !maquinaSeleccionada || t.maquina === maquinaSeleccionada;
    const fechaReg = new Date(t.fecha_registro);
    return esMismaMaquina && fechaReg.toDateString() === hoyStr;
  });

  // 🛠️ FILTRO BLINDADO: Detecta cualquier variante de Set-Up o Cambio de Orden
  const esSetupParada = (codigo) => {
    const c = (codigo || '').toLowerCase();
    return c.includes('set-up') || c.includes('setup') || c.includes('cambio de orden') || c.includes('alistamiento');
  };

  const minutosSetupTurno = tnpTurnoMaquina
    .filter(t => esSetupParada(t.codigo_parada || t.motivo))
    .reduce((acc, curr) => acc + (Number(curr.minutos_duracion) || 0), 0);

  const minutosFallasTurno = tnpTurnoMaquina
    .filter(t => !esSetupParada(t.codigo_parada || t.motivo))
    .reduce((acc, curr) => acc + (Number(curr.minutos_duracion) || 0), 0);

  const tnpMinutosTotalesConVivo = minutosSetupTurno + minutosFallasTurno + ((segundosSetupVivo + segundosFallaVivo) / 60);

  const minTurno = turnoActual.minutosTranscurridosTurno;
  const minProductivos = (estadoMaquina === 'ESPERA' && cajasPedidoActual === 0)
    ? 0 
    : Math.max(0, minTurno - tnpMinutosTotalesConVivo);
  
  const porcentajeAprovechamiento = Math.min(100, Math.max(0, Math.round((minProductivos / minTurno) * 100)));
  const porcentajeRendimiento = estadoMaquina === 'PRODUCIENDO' && VELOCIDAD_ESTANDAR > 0
    ? Math.min(100, Math.round((velocidadInstantanea / VELOCIDAD_ESTANDAR) * 100))
    : 0;

  const porcentajeCalidad = 99;
  const oeeGlobal = Math.round((porcentajeAprovechamiento / 100) * (porcentajeRendimiento / 100) * (porcentajeCalidad / 100) * 100);

  const cajasTotalesTurno = cajasPedidoActual;
  const m2TotalesTurno = Math.round(cajasTotalesTurno * m2PorCaja);

  const mapaEstados = {
    ESPERA: { color: '#64748b', fondo: '#1e293b', texto: '⚪ MÁQUINA EN ESPERA' },
    PRODUCIENDO: { color: '#10b981', fondo: '#064e3b', texto: '🟢 PRODUCCIÓN EN CURSO' },
    SETUP: { color: '#f59e0b', fondo: '#78350f', texto: '🟠 EN SET-UP / CALIBRACIÓN' },
    PARADA: { color: '#ef4444', fondo: '#7f1d1d', texto: '🔴 MÁQUINA DETENIDA (TNP ACTIVO)' }
  };
  const configEstado = mapaEstados[estadoMaquina] || mapaEstados.ESPERA;

  const colorSemaforo = (valor) => {
    if (valor >= 85) return '#10b981';
    if (valor >= 70) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div style={{ backgroundColor: '#0f172a', color: 'white', minHeight: '100vh', width: '100%', padding: '1.5rem', fontFamily: 'sans-serif', border: `8px solid ${configEstado.color}`, boxSizing: 'border-box' }}>
      
      {/* BARRA SUPERIOR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: '1rem 1.5rem', borderRadius: '12px', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '0.9rem', display: 'block' }}>MÁQUINA MONITORIZADA ({colaPedidos.length} en cola)</span>
            <select 
              value={maquinaSeleccionada} 
              onChange={(e) => setMaquinaSeleccionada(e.target.value)}
              style={{ backgroundColor: '#0f172a', color: '#38bdf8', fontSize: '1.8rem', fontWeight: 'bold', border: '2px solid #38bdf8', borderRadius: '8px', padding: '5px 15px', cursor: 'pointer' }}
            >
              {listaMaquinas.map(m => (
                <option key={m.id || m.codigo_maquina} value={m.codigo_maquina}>{m.codigo_maquina}</option>
              ))}
            </select>
          </div>

          <div style={{ borderLeft: '2px solid #334155', paddingLeft: '1.5rem' }}>
            <span style={{ color: '#fb923c', fontSize: '1.3rem', fontWeight: 'bold', display: 'block' }}>{turnoActual.nombre}</span>
            <span style={{ color: '#cbd5e1', fontSize: '1.1rem' }}>Hora Planta: {relojActual.toLocaleTimeString()}</span>
          </div>
        </div>

        {/* INDICADOR DE OPERADOR EN VIVO */}
        <div style={{ backgroundColor: '#0f172a', padding: '10px 20px', borderRadius: '10px', border: '1px solid #334155', textAlign: 'right' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem', display: 'block' }}>👤 OPERADOR EN PLANTA</span>
          <span style={{ color: '#38bdf8', fontSize: '1.2rem', fontWeight: 'bold' }}>{operadorEnPlanta || 'Sin operador asignado'}</span>
        </div>
      </div>

      {/* BANNER GIGANTE DE ESTADO Y ORDEN */}
      <div style={{ backgroundColor: configEstado.fondo, border: `3px solid ${configEstado.color}`, borderRadius: '12px', padding: '1.2rem 2rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: '900', letterSpacing: '1px' }}>{configEstado.texto}</span>
            <span style={{ backgroundColor: '#0f172a', color: '#38bdf8', border: '1px solid #38bdf8', padding: '4px 12px', borderRadius: '20px', fontSize: '1rem', fontWeight: 'bold' }}>
              ⚡ SALIDA TROQUEL: X{multiplicadorSalidas} ({multiplicadorSalidas} {multiplicadorSalidas === 1 ? 'caja/golpe' : 'cajas/golpe'})
            </span>
          </div>
          <p style={{ margin: '5px 0 0 0', fontSize: '1.4rem', color: '#e2e8f0' }}>
            <strong>OP #{ordenEnCurso.numero_orden}</strong> | {ordenEnCurso.cliente} — <span style={{ color: '#fde047' }}>{ordenEnCurso.producto_descripcion}</span>
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ color: '#cbd5e1', fontSize: '1rem' }}>Superficie Unitaria (Caja)</span>
          <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 'bold', color: '#38bdf8' }}>
            {m2PorCaja > 0 ? `${m2PorCaja.toFixed(3)} m² / caja` : '---'}
          </p>
        </div>
      </div>

      {/* BLOQUE DE EFICIENCIA Y OEE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        <div style={{ backgroundColor: '#1e293b', borderRadius: '14px', padding: '1.5rem', borderTop: `5px solid ${colorSemaforo(oeeGlobal)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '1.1rem', fontWeight: 'bold' }}>🎯 EFICIENCIA OEE GLOBAL</span>
            <span style={{ backgroundColor: '#0f172a', color: colorSemaforo(oeeGlobal), padding: '4px 10px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>Meta &ge; 85%</span>
          </div>
          <div style={{ fontSize: '3.8rem', fontWeight: '900', color: colorSemaforo(oeeGlobal), fontFamily: 'monospace', margin: '0.5rem 0' }}>
            {oeeGlobal}%
          </div>
          <div style={{ fontSize: '0.95rem', color: '#cbd5e1' }}>
            Disp ({porcentajeAprovechamiento}%) × Rend ({porcentajeRendimiento}%) × Cal ({porcentajeCalidad}%)
          </div>
        </div>

        <div style={{ backgroundColor: '#1e293b', borderRadius: '14px', padding: '1.5rem', borderTop: `5px solid ${colorSemaforo(porcentajeAprovechamiento)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '1.1rem', fontWeight: 'bold' }}>⏱️ APROVECHAMIENTO</span>
            <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{Math.round(minProductivos)} / {minTurno} min</span>
          </div>
          <div style={{ fontSize: '3.8rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: '0.5rem 0' }}>
            {porcentajeAprovechamiento}%
          </div>
          <div style={{ width: '100%', height: '14px', backgroundColor: '#ef4444', borderRadius: '7px', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${porcentajeAprovechamiento}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.5s' }} />
          </div>
        </div>

        <div style={{ backgroundColor: '#1e293b', borderRadius: '14px', padding: '1.5rem', borderTop: `5px solid ${colorSemaforo(porcentajeRendimiento)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '1.1rem', fontWeight: 'bold' }}>🚀 RENDIMIENTO</span>
            <span style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>Estándar: {VELOCIDAD_ESTANDAR} g/min</span>
          </div>
          <div style={{ fontSize: '3.8rem', fontWeight: '900', color: colorSemaforo(porcentajeRendimiento), fontFamily: 'monospace', margin: '0.5rem 0' }}>
            {porcentajeRendimiento}%
          </div>
          <div style={{ fontSize: '0.95rem', color: '#cbd5e1' }}>
            {estadoMaquina === 'PRODUCIENDO' ? `Sacando ${Math.round(velocidadInstantanea * multiplicadorSalidas)} cajas/min` : 'Esperando producción'}
          </div>
        </div>

      </div>

      {/* GRILLA CENTRAL (VELOCIDAD Y AVANCE) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        <div style={{ backgroundColor: '#1e293b', borderRadius: '15px', padding: '2rem', textAlign: 'center', borderBottom: '6px solid #38bdf8' }}>
          <h3 style={{ margin: 0, color: '#94a3b8', fontSize: '1.4rem', textTransform: 'uppercase' }}>⚡ Velocidad Actual de Máquina</h3>
          <div style={{ fontSize: '5.5rem', fontWeight: '900', color: estadoMaquina === 'PRODUCIENDO' ? '#38bdf8' : '#64748b', fontFamily: 'monospace', margin: '1rem 0' }}>
            {velocidadInstantanea} <span style={{ fontSize: '2rem', color: '#94a3b8' }}>golpes/min</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '1.25rem', color: '#cbd5e1', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
            <span>🎯 Estándar: <strong style={{ color: '#38bdf8' }}>{VELOCIDAD_ESTANDAR} g/min</strong></span>
            <span>📐 Ritmo: <strong>{Math.round(velocidadInstantanea * multiplicadorSalidas * 60 * m2PorCaja).toLocaleString()} m²/h</strong></span>
          </div>
        </div>

        <div style={{ backgroundColor: '#1e293b', borderRadius: '15px', padding: '2rem', borderBottom: '6px solid #38bdf8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 style={{ margin: 0, color: '#94a3b8', fontSize: '1.4rem', textTransform: 'uppercase' }}>📦 Avance Pedido Actual</h3>
            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>{porcentajePedido}%</span>
          </div>

          <div style={{ fontSize: '4rem', fontWeight: '900', color: 'white', fontFamily: 'monospace', margin: '1rem 0' }}>
            {cajasPedidoActual.toLocaleString()} <span style={{ fontSize: '2rem', color: '#64748b' }}>/ {cantProgramada.toLocaleString()} cajas</span>
          </div>

          <div style={{ width: '100%', height: '28px', backgroundColor: '#0f172a', borderRadius: '14px', overflow: 'hidden', marginBottom: '1.2rem', border: '1px solid #334155' }}>
            <div style={{ width: `${porcentajePedido}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.5s ease' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.35rem', color: '#38bdf8', fontWeight: 'bold' }}>
            <span>📐 Superficie del Pedido:</span>
            <span>{m2PedidoActual.toLocaleString()} / {m2ProgramadosOrden.toLocaleString()} m²</span>
          </div>
        </div>

      </div>

      {/* FILA INFERIOR: ACUMULADOS */}
      <h3 style={{ color: '#94a3b8', margin: '0 0 1rem 0', fontSize: '1.3rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
        📊 Resumen Acumulado del Turno
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        
        <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '12px', borderLeft: '6px solid #10b981' }}>
          <span style={{ color: '#94a3b8', fontSize: '1.1rem' }}>CAJAS PROCESADAS EN EL TURNO</span>
          <p style={{ margin: '10px 0 0 0', fontSize: '3.2rem', fontWeight: '900', color: '#10b981', fontFamily: 'monospace' }}>
            {cajasTotalesTurno.toLocaleString()}
          </p>
          <span style={{ color: '#64748b', fontSize: '0.95rem' }}>Suma acumulada sincronizada (Salidas X{multiplicadorSalidas})</span>
        </div>

        <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '12px', borderLeft: '6px solid #38bdf8' }}>
          <span style={{ color: '#94a3b8', fontSize: '1.1rem' }}>METROS CUADRADOS DEL TURNO</span>
          <p style={{ margin: '10px 0 0 0', fontSize: '3.2rem', fontWeight: '900', color: '#38bdf8', fontFamily: 'monospace' }}>
            {m2TotalesTurno.toLocaleString()} <span style={{ fontSize: '1.5rem' }}>m²</span>
          </p>
          <span style={{ color: '#64748b', fontSize: '0.95rem' }}>Superficie de cartón convertida hoy</span>
        </div>

        <div style={{ backgroundColor: estadoMaquina !== 'PRODUCIENDO' && estadoMaquina !== 'ESPERA' ? '#450a0a' : '#1e293b', padding: '1.5rem', borderRadius: '12px', borderLeft: '6px solid #ef4444' }}>
          <span style={{ color: '#94a3b8', fontSize: '1.1rem' }}>TNP ACUMULADO HOY</span>
          <p style={{ margin: '10px 0 0 0', fontSize: '3rem', fontWeight: '900', color: '#ef4444', fontFamily: 'monospace' }}>
            {Math.floor(tnpMinutosTotalesConVivo)} <span style={{ fontSize: '1.4rem' }}>min</span>
          </p>
          <div style={{ display: 'flex', gap: '15px', marginTop: '5px', fontSize: '1.05rem' }}>
            <span style={{ color: '#fb923c' }}>🟠 Set-Up: <strong>{formatearMinSeg((minutosSetupTurno * 60) + segundosSetupVivo)}</strong></span>
            <span style={{ color: '#f87171' }}>🔴 Fallas: <strong>{formatearMinSeg((minutosFallasTurno * 60) + segundosFallaVivo)}</strong></span>
          </div>
        </div>

      </div>

    </div>
  );
}