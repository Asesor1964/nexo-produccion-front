import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { CATALOGO_COLORES_MAESTRO } from './PantallaCIP';

const LISTA_SUPERVISORES = [
  "SERGIO SANCHEZ",
  "OLEA JULIO",
  "MARTINEZ ELVIO",
  "CRUZ WALTER"
];

// Nómina base de respaldo por si en la BD aún no están todos cargados
const NOMINA_OPERADORES_BASE = [
  "MARTINEZ ELVIO",
  "CRUZ WALTER",
  "OLEA JULIO",
  "CARRIZO CRISTIAN",
  "ALBORNOZ LUIS",
  "SANCHEZ NELSON",
  "CZURYLO CRISTIAN",
  "QUIROGA VICTOR",
  "PRADO RAFAEL",  
  "DIAZ ADRIAN",
  "PRADO JULIO",
  "MIRANDA QUIROGA",
  "NIEVA DAVID",  
  "SPROCH JONATHAN",
  "SANCHEZ SERGIO"
];

const MAQUINAS_BASE = [
  "COR-JS",
  "IMP-JS",
  "COR-SS",
  "IMP-SS",
  "COR-WAR",
  "WARD",
  "PBO",
  "PLM",
  "PEG",
  "DIV",
  "TPL",
  "TER",
  "PLO",
  "TRA",
  "DYF",
  "CHI"
];

const CATALOGO_PARADAS_OFICIAL = [
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

export default function PantallaCargaManual() {
  const hoyISO = new Date().toISOString().split('T')[0];

  const [pedidos, setPedidos] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Formulario del Parte Diario Físico
  const [fechaProduccion, setFechaProduccion] = useState(hoyISO);
  const [turno, setTurno] = useState('M');
  const [maquina, setMaquina] = useState('COR-JS');
  const [operador, setOperador] = useState('');
  const [operadorManualExtra, setOperadorManualExtra] = useState('');
  const [supervisor, setSupervisor] = useState('SERGIO SANCHEZ');
  const [cantidadFabricada, setCantidadFabricada] = useState('');
  const [estadoCierre, setEstadoCierre] = useState('Finalizada');
  const [minutosSetup, setMinutosSetup] = useState('20');
  const [reemplazarParadas, setReemplazarParadas] = useState(true);

  // Lista dinámica de paradas registradas en el papel
  const [paradas, setParadas] = useState([]);
  const [motivoTemp, setMotivoTemp] = useState(CATALOGO_PARADAS_OFICIAL[0]);
  const [minutosTemp, setMinutosTemp] = useState('');

  // Sección opcional Planilla CIP RE-PRO 009
  const [incluirCIP, setIncluirCIP] = useState(false);
  const [datosCIP, setDatosCIP] = useState({
    tipoOnda: 'CB',
    tipoCierre: 'Pegado',
    linerExterno: 'Kraft',
    tinta1Color: '', tinta1Lote: '',
    tinta2Color: '', tinta2Lote: '',
    tinta3Color: '', tinta3Lote: '',
    tinta4Color: '', tinta4Lote: '',
    tinta5Color: '', tinta5Lote: '',
    tinta6Color: '', tinta6Lote: '',
    observaciones: ''
  });

  const cargarDatosIniciales = async () => {
    try {
      const [resPed, resMaq, resOp, resHist] = await Promise.all([
        apiFetch('/api/pedidos'),
        apiFetch('/api/pedidos/recursos/maquinas/todas'),
        apiFetch('/api/pedidos/recursos/operadores/todos'),
        apiFetch('/api/pedidos/historial').catch(() => ({ ok: false }))
      ]);

      let listaPedidos = [];
      if (resPed.ok) {
        listaPedidos = await resPed.json();
        setPedidos(listaPedidos);
      }

      // Unificamos máquinas de BD + máquinas presentes en los pedidos + catálogo base
      const setMaq = new Set(MAQUINAS_BASE);
      if (resMaq.ok) {
        const dataMaq = await resMaq.json();
        dataMaq.forEach(m => {
          if (m.codigo_maquina) setMaq.add(String(m.codigo_maquina).trim().toUpperCase());
        });
      }
      listaPedidos.forEach(p => {
        if (p.maquina_asignada && isNaN(p.maquina_asignada) && !String(p.maquina_asignada).includes(',')) {
          setMaq.add(String(p.maquina_asignada).trim().toUpperCase());
        }
      });
      setMaquinas(Array.from(setMaq).sort());

      // Unificamos todos los operadores de la tabla operadores + los que hayan operado en historial + nómina base
      const setOp = new Set();
      if (resOp.ok) {
        const dataOp = await resOp.json();
        dataOp.forEach(op => {
          if (op.nombre) setOp.add(String(op.nombre).trim().toUpperCase());
        });
      }
      if (resHist && resHist.ok) {
        const dataHist = await resHist.json();
        dataHist.forEach(h => {
          if (h.operador && h.operador !== 'General' && h.operador !== 'Sin Operador') {
            setOp.add(String(h.operador).trim().toUpperCase());
          }
        });
      }
      listaPedidos.forEach(p => {
        if (p.operador && p.operador !== 'General' && p.operador !== 'Sin Operador') {
          setOp.add(String(p.operador).trim().toUpperCase());
        }
      });
      NOMINA_OPERADORES_BASE.forEach(nombre => setOp.add(nombre));

      const listaOpFinal = Array.from(setOp).filter(Boolean).sort();
      setOperadores(listaOpFinal);
      if (listaOpFinal.length > 0 && !operador) {
        setOperador(listaOpFinal[0]);
      }
    } catch (error) {
      console.error('Error al cargar catálogos en Carga Manual:', error);
    }
  };

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  const seleccionarOrden = async (ord) => {
    setOrdenSeleccionada(ord);
    setMaquina(ord.maquina_asignada || 'COR-JS');
    if (ord.operador && ord.operador !== 'General') {
      setOperador(String(ord.operador).trim().toUpperCase());
    }
    setCantidadFabricada(
      ord.cantidad_fabricada && Number(ord.cantidad_fabricada) > 0
        ? String(ord.cantidad_fabricada)
        : String(ord.cantidad_programada || '')
    );
    setEstadoCierre('Finalizada');
    setParadas([]);

    const coloresLista = ord.colores
      ? String(ord.colores).split(',').map(c => c.trim()).filter(Boolean)
      : [];

    setDatosCIP(prev => ({
      ...prev,
      tinta1Color: ord.color_1 || coloresLista[0] || '',
      tinta2Color: ord.color_2 || coloresLista[1] || '',
      tinta3Color: ord.color_3 || coloresLista[2] || '',
      tinta4Color: ord.color_4 || coloresLista[3] || '',
      tinta5Color: ord.color_5 || coloresLista[4] || '',
      tinta6Color: ord.color_6 || coloresLista[5] || '',
      tinta1Lote: '', tinta2Lote: '', tinta3Lote: '',
      tinta4Lote: '', tinta5Lote: '', tinta6Lote: ''
    }));

    try {
      const resReceta = await apiFetch(`/api/cip/receta/${ord.numero_orden || ord.id}`);
      if (resReceta.ok) {
        const rec = await resReceta.json();
        setDatosCIP(prev => ({
          ...prev,
          tinta1Color: rec.tinta1Color || prev.tinta1Color || '',
          tinta2Color: rec.tinta2Color || prev.tinta2Color || '',
          tinta3Color: rec.tinta3Color || prev.tinta3Color || '',
          tinta4Color: rec.tinta4Color || prev.tinta4Color || '',
          tinta5Color: rec.tinta5Color || prev.tinta5Color || '',
          tinta6Color: rec.tinta6Color || prev.tinta6Color || ''
        }));
      }
    } catch (e) {}
  };

  const agregarParadaLista = () => {
    const min = parseFloat(minutosTemp);
    if (!min || min <= 0) {
      alert('⚠️ Ingresá una cantidad de minutos mayor a 0 para la parada.');
      return;
    }
    setParadas([...paradas, { codigo: motivoTemp, motivo: motivoTemp, minutos: min }]);
    setMinutosTemp('');
  };

  const quitarParadaLista = (idx) => {
    setParadas(paradas.filter((_, i) => i !== idx));
  };

  const handleGuardarParte = async (e) => {
    e.preventDefault();
    if (!ordenSeleccionada) return;

    const numOrd = ordenSeleccionada.numero_orden || ordenSeleccionada.id;
    const cantFab = parseFloat(cantidadFabricada) || 0;
    const operadorFinal = operador === '__OTRO__'
      ? operadorManualExtra.trim().toUpperCase()
      : operador;

    if (!operadorFinal) {
      alert('⚠️ Seleccioná o escribí el nombre del Maquinista / Operador.');
      return;
    }

    if (cantFab <= 0 && estadoCierre === 'Finalizada') {
      const confCero = window.confirm('⚠️ Estás por registrar la orden con 0 cajas fabricadas. ¿Continuar de todos modos?');
      if (!confCero) return;
    }

    setGuardando(true);
    try {
      const res = await apiFetch(`/api/pedidos/${numOrd}/carga-manual-historica`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_produccion: fechaProduccion,
          turno,
          maquina,
          operador: operadorFinal,
          supervisor,
          cantidad_fabricada: cantFab,
          estado_cierre: estadoCierre,
          minutos_setup: parseFloat(minutosSetup) || 0,
          paradas,
          reemplazar_paradas_previas: reemplazarParadas,
          incluir_cip: incluirCIP,
          datos_cip: {
            ...datosCIP,
            supervisor,
            verificacion: {
              troquelClises: true,
              coloresBoceto: true,
              medidasPlancha: true,
              ubicacionJaladores: true,
              aperturaRodillo: true,
              ubicacionCuchillas: true,
              presionesImpision: true,
              limpiezaCortes: true,
              sentidoOnda: true,
              presionCorteHendido: true
            }
          }
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.mensaje}\n\n• Impactó en Historial / OEE con fecha ${fechaProduccion}\n• Maquinista: ${operadorFinal}\n• Disponible en Expedición con ${cantFab} cajas.`);
        await cargarDatosIniciales();
        setOrdenSeleccionada(null);
        setBusqueda('');
      } else {
        alert(`❌ Error: ${data.error || 'No se pudo guardar el parte'}`);
      }
    } catch (error) {
      alert('❌ Error de conexión con el servidor.');
    } finally {
      setGuardando(false);
    }
  };

  const pedidosFiltrados = pedidos
    .filter(p => {
      if (!busqueda.trim()) return true;
      const q = busqueda.toLowerCase().trim();
      const idStr = String(p.numero_orden || p.id || '').toLowerCase();
      const cliStr = String(p.cliente || '').toLowerCase();
      const prodStr = String(p.descripcion_producto || p.producto_descripcion || '').toLowerCase();
      return idStr.includes(q) || cliStr.includes(q) || prodStr.includes(q);
    })
    .slice(0, 60);

  return (
    <div style={{ padding: '2rem', maxWidth: '1250px', margin: '0 auto', fontFamily: 'sans-serif', textAlign: 'left' }}>
      
      {/* CABECERA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '3px solid #fd7e14', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '2.4rem' }}>📋</span>
          <div>
            <h2 style={{ margin: 0, color: '#343a40', fontSize: '1.8rem' }}>Consola de Carga Manual de Partes Físicos</h2>
            <small style={{ color: '#6c757d', fontWeight: 'bold' }}>
              Digitalización diferida de planillas de planta (Actualiza Cola, OEE, Tiempos Muertos, CIP y Expedición)
            </small>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* COLUMNA IZQUIERDA: BUSCADOR DE PEDIDOS */}
        <div style={{ backgroundColor: '#fff', padding: '1.2rem', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.06)', borderTop: '4px solid #17a2b8' }}>
          <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#17a2b8' }}>1. Buscar Pedido en Planilla</h4>
          <input
            type="text"
            placeholder="🔍 Escribí N° Orden (ej. 48341), Cliente o Caja..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '2px solid #17a2b8', fontSize: '0.95rem', boxSizing: 'border-box', marginBottom: '12px' }}
          />

          <div style={{ maxHeight: '580px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pedidosFiltrados.map(ord => {
              const num = ord.numero_orden || ord.id;
              const activa = (ordenSeleccionada?.numero_orden || ordenSeleccionada?.id) === num;
              const esFinalizada = ['Finalizada', 'Finalizada Parcial', 'Cerrado por Acuerdo'].includes(ord.estado);

              return (
                <div
                  key={num}
                  onClick={() => seleccionarOrden(ord)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: activa ? '2px solid #fd7e14' : '1px solid #dee2e6',
                    backgroundColor: activa ? '#fff8f0' : (esFinalizada ? '#f8f9fa' : '#fff'),
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '1rem', color: '#0056b3' }}>#{num}</strong>
                    <span style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 'bold',
                      backgroundColor: ord.estado === 'Pendiente' ? '#ffefb3' : (esFinalizada ? '#d4edda' : '#cfe2ff'),
                      color: '#333'
                    }}>
                      {ord.estado} · {ord.maquina_asignada || 'S/M'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#333' }}>{ord.cliente}</div>
                  <div style={{ fontSize: '0.78rem', color: '#666' }}>{ord.descripcion_producto || ord.producto_descripcion}</div>
                  <div style={{ fontSize: '0.75rem', color: '#495057', marginTop: '4px' }}>
                    Prog: <strong>{ord.cantidad_programada}</strong> caj.
                    {Number(ord.cantidad_fabricada) > 0 && <> | Fab: <strong>{ord.cantidad_fabricada}</strong></>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMNA DERECHA: FORMULARIO DE CARGA DEL PARTE FÍSICO */}
        <div style={{ backgroundColor: '#fff', padding: '1.8rem', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.06)', borderTop: '4px solid #fd7e14' }}>
          {!ordenSeleccionada ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#6c757d' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '10px' }}>👈</div>
              <h3 style={{ margin: '0 0 8px 0', color: '#343a40' }}>Seleccioná un Pedido de la lista izquierda</h3>
              <p style={{ margin: 0 }}>Buscá por número de orden el pedido que tenés en tu planilla física para cargar sus datos de producción.</p>
            </div>
          ) : (
            <form onSubmit={handleGuardarParte}>
              {/* Resumen de la Orden Seleccionada */}
              <div style={{ backgroundColor: '#f1f8ff', border: '1px solid #b6d4fe', padding: '14px', borderRadius: '8px', marginBottom: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#004085' }}>
                      Orden N° #{ordenSeleccionada.numero_orden || ordenSeleccionada.id}
                    </span>
                    <span style={{ marginLeft: '12px', fontWeight: 'bold', color: '#333' }}>
                      | {ordenSeleccionada.cliente}
                    </span>
                  </div>
                  <span style={{ backgroundColor: '#0056b3', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    Meta Programada: {ordenSeleccionada.cantidad_programada} cajas
                  </span>
                </div>
                <div style={{ marginTop: '6px', fontSize: '0.92rem', color: '#333' }}>
                  <strong>Producto:</strong> {ordenSeleccionada.descripcion_producto || ordenSeleccionada.producto_descripcion}
                  {ordenSeleccionada.codigo_producto && <> (Cód: <strong>{ordenSeleccionada.codigo_producto}</strong>)</>}
                </div>
                {ordenSeleccionada.colores && (
                  <div style={{ marginTop: '4px', fontSize: '0.85rem', color: '#0d6efd', fontWeight: 'bold' }}>
                    🎨 Receta Colores: {ordenSeleccionada.colores}
                  </div>
                )}
              </div>

              {/* BLOQUE 1: FECHA, TURNO, MÁQUINA Y OPERADOR */}
              <h4 style={{ margin: '0 0 10px 0', color: '#343a40', borderBottom: '2px solid #eee', paddingBottom: '6px' }}>
                📅 1. Datos del Turno y Máquina Real
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '1.2rem' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Fecha Real Producción:</label>
                  <input
                    type="date"
                    required
                    value={fechaProduccion}
                    onChange={(e) => setFechaProduccion(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc', fontWeight: 'bold', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Turno:</label>
                  <select
                    value={turno}
                    onChange={(e) => setTurno(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc', fontWeight: 'bold' }}
                  >
                    <option value="M">Mañana (M)</option>
                    <option value="T">Tarde (T)</option>
                    <option value="N">Noche (N)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Máquina / Ruta:</label>
                  <select
                    value={maquina}
                    onChange={(e) => setMaquina(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {maquinas.map((m, i) => (
                      <option key={i} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Maquinista / Operador:</label>
                  <select
                    value={operador}
                    onChange={(e) => setOperador(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {operadores.map((op, i) => (
                      <option key={i} value={op}>{op}</option>
                    ))}
                    <option value="__OTRO__">➕ Escribir otro maquinista...</option>
                  </select>
                  {operador === '__OTRO__' && (
                    <input
                      type="text"
                      placeholder="Escribí Apellido y Nombre..."
                      value={operadorManualExtra}
                      onChange={(e) => setOperadorManualExtra(e.target.value.toUpperCase())}
                      style={{ width: '100%', marginTop: '6px', padding: '7px', borderRadius: '5px', border: '2px solid #fd7e14', fontWeight: 'bold', boxSizing: 'border-box' }}
                    />
                  )}
                </div>
              </div>

              {/* BLOQUE 2: CANTIDADES Y ESTADO DE CIERRE */}
              <h4 style={{ margin: '0 0 10px 0', color: '#343a40', borderBottom: '2px solid #eee', paddingBottom: '6px' }}>
                📦 2. Producción Real y Estado de Cierre
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '1.2rem' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 'bold', display: 'block', marginBottom: '4px', color: '#198754' }}>
                    Cantidad Fabricada (Cajas Buenas):
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={cantidadFabricada}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCantidadFabricada(val);
                      const num = parseFloat(val) || 0;
                      const meta = parseFloat(ordenSeleccionada.cantidad_programada) || 0;
                      if (num > 0 && num < meta) {
                        setEstadoCierre('Finalizada Parcial');
                      } else if (num >= meta) {
                        setEstadoCierre('Finalizada');
                      }
                    }}
                    style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '2px solid #198754', fontSize: '1.1rem', fontWeight: 'bold', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                    Estado al Cerrar:
                  </label>
                  <select
                    value={estadoCierre}
                    onChange={(e) => setEstadoCierre(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '0.95rem', fontWeight: 'bold' }}
                  >
                    <option value="Finalizada">✅ Finalizada (Completa)</option>
                    <option value="Finalizada Parcial">⚡ Finalizada Parcial (Con Faltante)</option>
                    <option value="Cerrado por Acuerdo">📁 Cerrado por Acuerdo Comercial</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 'bold', display: 'block', marginBottom: '4px', color: '#0d6efd' }}>
                    Tiempo de Set-Up (Minutos):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minutosSetup}
                    onChange={(e) => setMinutosSetup(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #0d6efd', fontSize: '1rem', fontWeight: 'bold', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* BLOQUE 3: PARADAS Y TIEMPOS MUERTOS DE LA PLANILLA */}
              <h4 style={{ margin: '0 0 10px 0', color: '#343a40', borderBottom: '2px solid #eee', paddingBottom: '6px' }}>
                ⏱️ 3. Tiempos Muertos / Paradas Anotadas en Planilla
              </h4>
              <div style={{ backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '8px', border: '1px solid #dee2e6', marginBottom: '1.2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 140px', gap: '10px', alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Motivo de Parada:</label>
                    <select
                      value={motivoTemp}
                      onChange={(e) => setMotivoTemp(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '0.88rem' }}
                    >
                      {CATALOGO_PARADAS_OFICIAL.map((mot, idx) => (
                        <option key={idx} value={mot}>{mot}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Minutos:</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Ej: 15"
                      value={minutosTemp}
                      onChange={(e) => setMinutosTemp(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box', fontWeight: 'bold' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={agregarParadaLista}
                    style={{ padding: '9px 12px', backgroundColor: '#fd7e14', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    + Agregar Parada
                  </button>
                </div>

                {paradas.length > 0 && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {paradas.map((p, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '6px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '0.85rem' }}>
                        <span><strong>{p.motivo}</strong> — <span style={{ color: '#dc3545', fontWeight: 'bold' }}>{p.minutos} min</span></span>
                        <button
                          type="button"
                          onClick={() => quitarParadaLista(idx)}
                          style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          ✖ Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label style={{ display: 'block', marginTop: '10px', fontSize: '0.8rem', color: '#555' }}>
                  <input
                    type="checkbox"
                    checked={reemplazarParadas}
                    onChange={(e) => setReemplazarParadas(e.target.checked)}
                  />{' '}
                  Reemplazar cualquier parada previa que se haya cargado por error en esta orden
                </label>
              </div>

              {/* BLOQUE 4: PLANILLA CIP RE-PRO 009 OPCIONAL */}
              <div style={{ marginBottom: '1.5rem', border: '1px solid #ced4da', borderRadius: '8px', padding: '12px', backgroundColor: incluirCIP ? '#fdfdfe' : '#f8f9fa' }}>
                <label style={{ fontWeight: 'bold', cursor: 'pointer', color: '#0056b3', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={incluirCIP}
                    onChange={(e) => setIncluirCIP(e.target.checked)}
                  />
                  🎨 Adjuntar también datos de Planilla CIP (RE-PRO 009 - Tintas y Lotes)
                </label>

                {incluirCIP && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #dee2e6' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 'bold' }}>Supervisor:</label>
                        <select value={supervisor} onChange={e => setSupervisor(e.target.value)} style={{ width: '100%', padding: '6px' }}>
                          {LISTA_SUPERVISORES.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 'bold' }}>Tipo Onda:</label>
                        <select value={datosCIP.tipoOnda} onChange={e => setDatosCIP({ ...datosCIP, tipoOnda: e.target.value })} style={{ width: '100%', padding: '6px' }}>
                          <option value="B">Onda B</option>
                          <option value="C">Onda C</option>
                          <option value="CB">Onda CB</option>
                          <option value="E">Onda E</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 'bold' }}>Tipo Cierre:</label>
                        <select value={datosCIP.tipoCierre} onChange={e => setDatosCIP({ ...datosCIP, tipoCierre: e.target.value })} style={{ width: '100%', padding: '6px' }}>
                          <option value="Pegado">Pegado</option>
                          <option value="Abrochado">Abrochado</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 'bold' }}>Liner Externo:</label>
                        <select value={datosCIP.linerExterno} onChange={e => setDatosCIP({ ...datosCIP, linerExterno: e.target.value })} style={{ width: '100%', padding: '6px' }}>
                          <option value="Kraft">Kraft</option>
                          <option value="Blanco">Blanco</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '0.8rem' }}>
                      {[1, 2, 3, 4, 5, 6].map(num => {
                        const valCol = datosCIP[`tinta${num}Color`] || '';
                        const opciones = valCol && !CATALOGO_COLORES_MAESTRO.includes(valCol)
                          ? [valCol, ...CATALOGO_COLORES_MAESTRO]
                          : CATALOGO_COLORES_MAESTRO;

                        return (
                          <div key={num} style={{ border: '1px solid #ddd', padding: '6px', borderRadius: '4px', backgroundColor: valCol ? '#e8f4fd' : '#fff' }}>
                            <strong>{num}° Color:</strong>
                            <select
                              value={valCol}
                              onChange={e => setDatosCIP({ ...datosCIP, [`tinta${num}Color`]: e.target.value })}
                              style={{ width: '100%', padding: '4px', margin: '4px 0' }}
                            >
                              <option value="">-- Sin Color --</option>
                              {opciones.map((c, i) => <option key={i} value={c}>{c}</option>)}
                            </select>
                            <input
                              type="text"
                              placeholder={`Lote ${num}`}
                              value={datosCIP[`tinta${num}Lote`] || ''}
                              onChange={e => setDatosCIP({ ...datosCIP, [`tinta${num}Lote`]: e.target.value })}
                              style={{ width: '100%', padding: '4px', boxSizing: 'border-box' }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={guardando}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: '#198754',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                {guardando ? 'Guardando Parte Físico en BD...' : '💾 Registrar Parte Físico Completo en Base de Datos'}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}