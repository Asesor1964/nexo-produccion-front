import { useState, useEffect, useRef } from 'react';
import PantallaCIP from './PantallaCIP';
import ModalScrap from './ModalScrap';
import { apiFetch } from '../services/api'; // 👈 IMPORTACIÓN CENTRALIZADA

const STORAGE_KEY = 'nexo_estado_maquinista_v1';

// Respaldo completo de las 64 incidencias oficiales (Tipos_Incidencias.csv)
const INCIDENCIAS_RESPALDO = [
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

const CIP_INICIAL = {
  supervisor: '',
  turno: 'M',
  tipoOnda: 'CB',
  chapeton: 'Normal',
  hendidoDesplazado: 'NO',
  linerExterno: 'Kraft',
  tipoCierre: 'Pegado',
  tinta1Color: '', tinta1Lote: '',
  tinta2Color: '', tinta2Lote: '',
  tinta3Color: '', tinta3Lote: '',
  tinta4Color: '', tinta4Lote: '',
  tinta5Color: '', tinta5Lote: '',
  tinta6Color: '', tinta6Lote: '',
  observaciones: ''
};

const VERIFICACION_INICIAL = {
  troquelClises: false,
  coloresBoceto: false,
  medidasPlancha: false,
  ubicacionJaladores: false,
  aperturaRodillo: false,
  ubicacionCuchillas: false,
  presionesImpision: false,
  limpiezaCortes: false,
  sentidoOnda: false,
  presionCorteHendido: false,
  presionCueroTroquel: false
};

const crearPaquetesIniciales = () =>
  Array.from({ length: 10 }, () => ({
    medidas: '',
    pegadoInt: '',
    pegadoExt: '',
    tonosTintas: '',
    registroImp: '',
    bctEnsayo: ''
  }));

export default function PantallaMaquinista() {
  const estadoGuardado = (() => {
    try {
      const item = localStorage.getItem(STORAGE_KEY);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  })();

  const [maquinaSeleccionada, setMaquinaSeleccionada] = useState(estadoGuardado?.maquinaSeleccionada || ''); 
  const [operadorSeleccionado, setOperadorSeleccionado] = useState(estadoGuardado?.operadorSeleccionado || '');
  const [colaPedidos, setColaPedidos] = useState([]); 
  
  const [ordenActiva, setOrdenActiva] = useState(estadoGuardado?.ordenActiva || null);
  const [enSetup, setEnSetup] = useState(estadoGuardado?.enSetup || false);
  const [produccionActiva, setProduccionActiva] = useState(estadoGuardado?.produccionActiva || false);
  
  const [horaInicio, setHoraInicio] = useState(estadoGuardado?.horaInicio || '');
  const [inicioFaseMs, setInicioFaseMs] = useState(estadoGuardado?.inicioFaseMs || null);
  const [cantidadFabricada, setCantidadFabricada] = useState(estadoGuardado?.cantidadFabricada || 0);
  
  // 📦 Estado para la capacidad estándar del pallet (persistido en localStorage)
  const [capacidadPalletStandard, setCapacidadPalletStandard] = useState(estadoGuardado?.capacidadPalletStandard ?? 1000);

  const [segundosTranscurridos, setSegundosTranscurridos] = useState(() => {
    if ((estadoGuardado?.enSetup || estadoGuardado?.produccionActiva) && estadoGuardado?.inicioFaseMs) {
      return Math.max(0, Math.floor((Date.now() - estadoGuardado.inicioFaseMs) / 1000));
    }
    return 0;
  });

  // Referencia para enviar siempre los segundos en vivo sin reiniciar el intervalo de latido
  const segundosRef = useRef(segundosTranscurridos);
  useEffect(() => {
    segundosRef.current = segundosTranscurridos;
  }, [segundosTranscurridos]);

  const [motivoDemoraSetup, setMotivoDemoraSetup] = useState(estadoGuardado?.motivoDemoraSetup || '');
  const [mostrarModalParada, setMostrarModalParada] = useState(false);
  const [listaParadas, setListaParadas] = useState(estadoGuardado?.listaParadas || []);
  const [nuevaParada, setNuevaParada] = useState({ horaInicioParada: '', horaFinParada: '', codigo: '' });
  
  const [mostrarModalCIP, setMostrarModalCIP] = useState(false);
  const [mostrarModalScrap, setMostrarModalScrap] = useState(false);

  const [modoCaptura, setModoCaptura] = useState(estadoGuardado?.modoCaptura || 'MANUAL'); 
  const [velocidadEstandarMaq, setVelocidadEstandarMaq] = useState(estadoGuardado?.velocidadEstandarMaq || 120);
  const [tiempoSetupEstandarMaq, setTiempoSetupEstandarMaq] = useState(estadoGuardado?.tiempoSetupEstandarMaq || 15);
  const [velocidadOperativa, setVelocidadOperativa] = useState(estadoGuardado?.velocidadOperativa || 120);

  const maquinaInicializadaRef = useRef(estadoGuardado?.maquinaSeleccionada || '');

  const [datosCIP, setDatosCIP] = useState(estadoGuardado?.datosCIP || CIP_INICIAL);
  const [verificacion, setVerificacion] = useState(estadoGuardado?.verificacion || VERIFICACION_INICIAL);
  const [inspeccionPaquetes, setInspeccionPaquetes] = useState(estadoGuardado?.inspeccionPaquetes || crearPaquetesIniciales());

  const [listaMaquinas, setListaMaquinas] = useState([]);
  const [listaOperadores, setListaOperadores] = useState([]);
  const [listaCodigosParada, setListaCodigosParada] = useState(INCIDENCIAS_RESPALDO);

  useEffect(() => {
    const estadoParaGuardar = {
      maquinaSeleccionada,
      operadorSeleccionado,
      ordenActiva,
      enSetup,
      produccionActiva,
      horaInicio,
      inicioFaseMs,
      cantidadFabricada,
      capacidadPalletStandard,
      motivoDemoraSetup,
      listaParadas,
      modoCaptura,
      velocidadEstandarMaq,
      tiempoSetupEstandarMaq,
      velocidadOperativa,
      datosCIP,
      verificacion,
      inspeccionPaquetes
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estadoParaGuardar));
  }, [
    maquinaSeleccionada,
    operadorSeleccionado,
    ordenActiva,
    enSetup,
    produccionActiva,
    horaInicio,
    inicioFaseMs,
    cantidadFabricada,
    capacidadPalletStandard,
    motivoDemoraSetup,
    listaParadas,
    modoCaptura,
    velocidadEstandarMaq,
    tiempoSetupEstandarMaq,
    velocidadOperativa,
    datosCIP,
    verificacion,
    inspeccionPaquetes
  ]);

  useEffect(() => {
    const cargarMaestros = async () => {
      try {
        const resMaquinas = await apiFetch('/api/pedidos/recursos/maquinas');
        if (resMaquinas.ok) setListaMaquinas(await resMaquinas.json());
        
        const resOperadores = await apiFetch('/api/pedidos/recursos/operadores');
        if (resOperadores.ok) setListaOperadores(await resOperadores.json());

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
              setListaCodigosParada(formateadas);
            }
          }
        }
      } catch (error) { 
        console.error("Error al cargar maestros:", error); 
      }
    };
    cargarMaestros();
  }, []);

  useEffect(() => {
    if (!maquinaSeleccionada) return;

    const sincronizarConfigIngenieria = async () => {
      try {
        const res = await apiFetch('/api/pedidos/recursos/maquinas');
        if (res.ok) {
          const maquinas = await res.json();
          setListaMaquinas(maquinas);
          const actual = maquinas.find(m => m.codigo_maquina === maquinaSeleccionada);
          
          if (actual) {
            const modoDB = (actual.modo_captura || 'MANUAL').toUpperCase();
            const velEstDB = Number(actual.velocidad_estandar !== undefined ? actual.velocidad_estandar : 120);
            const setupEstDB = Number(actual.tiempo_setup_estandar !== undefined ? actual.tiempo_setup_estandar : 15);

            setModoCaptura(modoDB);
            setVelocidadEstandarMaq(velEstDB);
            setTiempoSetupEstandarMaq(setupEstDB);

            if (maquinaInicializadaRef.current !== maquinaSeleccionada) {
              setVelocidadOperativa(velEstDB);
              maquinaInicializadaRef.current = maquinaSeleccionada;
            } else if (modoDB === 'AUTOMATICO') {
              setVelocidadOperativa(actual.velocidad_actual !== undefined ? Number(actual.velocidad_actual) : velEstDB);
            }
          }
        }
      } catch (err) {
        console.error("Error al sincronizar configuración de máquina:", err);
      }
    };

    sincronizarConfigIngenieria();
    const intervaloConfig = setInterval(sincronizarConfigIngenieria, 3000);
    return () => clearInterval(intervaloConfig);
  }, [maquinaSeleccionada]);

  const cargarColaDeTrabajo = async (maquina) => {
    if (!maquina) return;
    try {
      const respuesta = await apiFetch(`/api/pedidos/cola/${encodeURIComponent(maquina)}`, {
        cache: 'no-store'
      });
      if (respuesta.ok) {
        const datos = await respuesta.json();
        const soloHabilitadas = datos.filter(p => {
          const est = (p.estado || '').trim().toLowerCase();
          return [
            'habilitada', 
            'en preparacion', 
            'en preparación', 
            'en produccion', 
            'en producción', 
            'pausada'
          ].includes(est);
        });
        setColaPedidos(soloHabilitadas);
      }
    } catch (error) { 
      console.error('Error al cargar cola:', error); 
    }
  };

  useEffect(() => {
    if (!maquinaSeleccionada) return;
    cargarColaDeTrabajo(maquinaSeleccionada);
    const intervaloCola = setInterval(() => {
      cargarColaDeTrabajo(maquinaSeleccionada);
    }, 3000);
    return () => clearInterval(intervaloCola);
  }, [maquinaSeleccionada]);

  // 🛰️ FUNCIÓN CORREGIDA: Ahora recibe segundosFaseVal y lo envía en segundos_fase
  const notificarEstadoEnVivo = async (
    estadoNuevo,
    velocidadVal = 0,
    segundosFaseVal = segundosRef.current,
    ordenOverride = ordenActiva
  ) => {
    if (!maquinaSeleccionada) return;
    try {
      await apiFetch(`/api/pedidos/maquinas/${encodeURIComponent(maquinaSeleccionada)}/estado-vivo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: estadoNuevo,
          orden: ordenOverride?.numero_orden || '',
          operador: operadorSeleccionado,
          cajas: Number(cantidadFabricada) || 0,
          velocidad: Number(velocidadVal) || 0,
          segundos_fase: Number(segundosFaseVal) || 0 // 👈 ¡Ahora sí viaja al backend!
        })
      });
    } catch (err) {
      console.error("Error al sincronizar estado en vivo con TV:", err);
    }
  };

  // 🛰️ LATIDO BLINDADO: Sincroniza el estado y los segundos en vivo cada 2 segundos con el Monitor TV
  useEffect(() => {
    if (!maquinaSeleccionada) return;

    const enviarLatido = () => {
      let estadoActual = 'ESPERA';
      let velActual = 0;
      
      // Calculamos al vuelo desde inicioFaseMs para máxima exactitud
      const segsReales = (enSetup || produccionActiva) && inicioFaseMs
        ? Math.max(0, Math.floor((Date.now() - inicioFaseMs) / 1000))
        : segundosRef.current;

      if (mostrarModalParada) {
        estadoActual = 'PARADA';
        velActual = 0;
      } else if (enSetup) {
        estadoActual = 'SETUP';
        velActual = 0;
      } else if (produccionActiva) {
        estadoActual = 'PRODUCIENDO';
        velActual = Number(velocidadOperativa) || 0;
      }

      notificarEstadoEnVivo(estadoActual, velActual, segsReales, ordenActiva);
    };

    enviarLatido(); // Envía de inmediato al montar/cambiar de fase
    const latido = setInterval(enviarLatido, 2000);

    return () => clearInterval(latido);
  }, [
    maquinaSeleccionada,
    operadorSeleccionado,
    enSetup,
    produccionActiva,
    mostrarModalParada,
    cantidadFabricada,
    ordenActiva,
    velocidadOperativa,
    inicioFaseMs
  ]);

  // ⏱️ CRONÓMETRO DE FASE (Alta precisión basada en milisegundos reales)
  useEffect(() => {
    let intervalo = null;
    if ((enSetup || produccionActiva) && inicioFaseMs) {
      setSegundosTranscurridos(Math.max(0, Math.floor((Date.now() - inicioFaseMs) / 1000)));
      intervalo = setInterval(() => {
        setSegundosTranscurridos(Math.max(0, Math.floor((Date.now() - inicioFaseMs) / 1000)));
      }, 1000);
    } else {
      clearInterval(intervalo);
    }
    return () => clearInterval(intervalo);
  }, [enSetup, produccionActiva, inicioFaseMs]);

  const formatearTiempo = (totalSegundos) => {
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
  };

  let tiempoObjetivoMinutos = 0;
  let mensajeCoachProd = "";
  let colorCoachProd = "";

  if (ordenActiva && produccionActiva) {
    const VELOCIDAD_ESTANDAR = Number(velocidadEstandarMaq) || 120; 
    tiempoObjetivoMinutos = Math.ceil(ordenActiva.cantidad_programada / VELOCIDAD_ESTANDAR);
    const minutosBrutos = Math.floor(segundosTranscurridos / 60);
    
    // Sumamos solo las paradas registradas que ocurrieron en la fase de producción actual
    const totalMinutosParadosEnProduccion = listaParadas
      .filter(p => !String(p.codigo || '').toLowerCase().includes('set-up'))
      .reduce((acc, parada) => acc + (Number(parada.minutos) || 0), 0);
    
    let minutosNetos = minutosBrutos - totalMinutosParadosEnProduccion;
    if (minutosNetos < 0) minutosNetos = 0; 

    if (minutosNetos < tiempoObjetivoMinutos * 0.7) {
      mensajeCoachProd = `🔥 ¡Velocidad Pura! Tiempo Neto: ${minutosNetos}m | Ideal: ${tiempoObjetivoMinutos}m.`;
      colorCoachProd = "#28a745"; 
    } else if (minutosNetos <= tiempoObjetivoMinutos) {
      const qRestantes = tiempoObjetivoMinutos - minutosNetos;
      mensajeCoachProd = `⚡ ¡Mantener el ritmo! Quedan ${qRestantes}m netos.`;
      colorCoachProd = "#ffc107"; 
    } else {
      mensajeCoachProd = `⚠️ Velocidad estándar superada (Neto: ${minutosNetos}m > Límite: ${tiempoObjetivoMinutos}m).`;
      colorCoachProd = "#dc3545"; 
    }
  }

  const TIEMPO_IDEAL_SETUP = Number(tiempoSetupEstandarMaq) || 15; 
  let mensajeCoachSetup = "";
  let colorCoachSetup = "";
  let pideExplicacion = false;
  let minutosSetupActual = 0;

  if (enSetup) {
    minutosSetupActual = Math.floor(segundosTranscurridos / 60);
    if (minutosSetupActual < TIEMPO_IDEAL_SETUP * 0.7) {
      mensajeCoachSetup = `✅ Estás en buen tiempo (Límite: ${TIEMPO_IDEAL_SETUP} min).`;
      colorCoachSetup = "#28a745"; 
    } else if (minutosSetupActual <= TIEMPO_IDEAL_SETUP) {
      mensajeCoachSetup = `⚡ Tu cambio está lento. ¡Acelera! (Límite: ${TIEMPO_IDEAL_SETUP} min).`;
      colorCoachSetup = "#ffc107"; 
    } else {
      mensajeCoachSetup = `🚨 Ocupaste demasiado tiempo (> ${TIEMPO_IDEAL_SETUP} min). Indica el motivo del atraso.`;
      colorCoachSetup = "#dc3545"; 
      pideExplicacion = true;
    }
  }

  const limpiarBorradorCIP = () => {
    setDatosCIP(CIP_INICIAL);
    setVerificacion(VERIFICACION_INICIAL);
    setInspeccionPaquetes(crearPaquetesIniciales());
  };

  const seleccionarOrdenParaProducir = (pedido) => {
    setOrdenActiva(pedido);
    setCantidadFabricada(0);
    setVelocidadOperativa(velocidadEstandarMaq);
    limpiarBorradorCIP();
  };

  const cancelarOrden = () => {
    setOrdenActiva(null);
    setEnSetup(false);
    setProduccionActiva(false);
    setListaParadas([]);
    setSegundosTranscurridos(0);
    setInicioFaseMs(null);
    setMotivoDemoraSetup('');
    setCantidadFabricada(0);
    limpiarBorradorCIP();
    notificarEstadoEnVivo('ESPERA', 0, 0, null);
  };

  const iniciarSetup = () => {
    const ahora = new Date();
    setHoraInicio(ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    setInicioFaseMs(Date.now());
    setSegundosTranscurridos(0);
    setEnSetup(true); 
    notificarEstadoEnVivo('SETUP', 0, 0);
  };

  const finalizarSetup = async () => {
    let minutosSetup = Math.floor(segundosTranscurridos / 60);
    
    if (minutosSetup > TIEMPO_IDEAL_SETUP && !motivoDemoraSetup) {
      alert("⚠️ Superaste el tiempo estándar. Por favor, selecciona el motivo del atraso en el recuadro rojo antes de iniciar la producción.");
      return;
    }

    const ahora = new Date();
    const horaFinSetup = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (minutosSetup === 0) minutosSetup = 1;

    const codigoFinalSetup = motivoDemoraSetup 
      ? `00 - Set-Up (Atraso: ${motivoDemoraSetup})` 
      : '00 - Set-Up Inicial';

    let guardadaOk = false;
    try {
      const res = await apiFetch('/api/pedidos/tiempos-muertos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maquina: maquinaSeleccionada,
          codigo_parada: codigoFinalSetup,
          motivo: codigoFinalSetup,
          minutos_duracion: minutosSetup,
          numero_orden: ordenActiva?.numero_orden,
          operador: operadorSeleccionado || 'Sin Operador'
        })
      });
      guardadaOk = res.ok;
    } catch (err) {
      console.error('Error al guardar Set-Up en vivo:', err);
    }

    const paradaSetup = {
      horaInicioParada: horaInicio,
      horaFinParada: horaFinSetup,
      codigo: codigoFinalSetup,
      minutos: minutosSetup,
      minutos_duracion: minutosSetup,
      operador: operadorSeleccionado || 'Sin Operador',
      guardadaEnBD: guardadaOk
    };

    setListaParadas([...listaParadas, paradaSetup]);
    
    setHoraInicio(horaFinSetup); 
    setInicioFaseMs(Date.now()); 
    setSegundosTranscurridos(0);
    setEnSetup(false);
    setMotivoDemoraSetup('');
    setProduccionActiva(true); 
    notificarEstadoEnVivo('PRODUCIENDO', Number(velocidadOperativa) || velocidadEstandarMaq, 0);
  };

  const finalizarOrdenBD = async () => {
    if (!ordenActiva) return;
    const cantFabReal = Number(cantidadFabricada) || 0;
    
    try {
      // 1. Finalizar la orden en producción
      const respuesta = await apiFetch(`/api/pedidos/${ordenActiva.numero_orden}/produccion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cantidad_fabricada: cantFabReal, 
          estado: 'Finalizada',
          paradas: listaParadas,
          maquina: maquinaSeleccionada,
          operador: operadorSeleccionado
        })
      });

      if (respuesta.ok) {
        // 2. Disparar automáticamente la creación del pallet en Expedición/Galpón
        if (cantFabReal > 0) {
          await apiFetch('/api/expedicion/pallets', { // 👈 RUTA CORREGIDA A /api/expedicion/pallets
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              numero_orden: ordenActiva.numero_orden,
              maquina: maquinaSeleccionada,
              operador: operadorSeleccionado,
              cliente: ordenActiva.cliente,
              producto_descripcion: ordenActiva.producto_descripcion,
              cantidad_unidades: cantFabReal,
              capacidad_standard: capPalletSegura
            })
          }).catch(err => console.error("Error al registrar pallet automático al finalizar:", err));
        }

        alert(`✅ Orden ${ordenActiva.numero_orden} Finalizada y enviada a Expedición.\n👤 Operador: ${operadorSeleccionado}\n📦 Cajas: ${cantFabReal}\n⏱️ Producción Pura: ${formatearTiempo(segundosTranscurridos)}`);
        localStorage.removeItem(STORAGE_KEY);
        cancelarOrden();
        cargarColaDeTrabajo(maquinaSeleccionada);
      } else {
        const errData = await respuesta.json().catch(() => ({}));
        alert(`❌ No se pudo finalizar la orden: ${errData.error || respuesta.status}`);
      }
    } catch (error) { 
      console.error('Error al finalizar orden:', error);
      alert('❌ Error de conexión con el servidor.');
    }
  };

  const abrirModal = () => {
    const ahora = new Date();
    const horas = String(ahora.getHours()).padStart(2, '0');
    const minutos = String(ahora.getMinutes()).padStart(2, '0');
    setNuevaParada({ horaInicioParada: `${horas}:${minutos}`, horaFinParada: '', codigo: '' });
    setMostrarModalParada(true);
    notificarEstadoEnVivo('PARADA', 0, segundosRef.current);
  };

  const guardarParada = async (e) => {
    e.preventDefault();
    if (!nuevaParada.horaInicioParada || !nuevaParada.horaFinParada || !nuevaParada.codigo) {
      alert('Por favor, complete la hora de inicio, hora de fin y el código de parada.');
      return;
    }

    const [hInicio, mInicio] = nuevaParada.horaInicioParada.split(':').map(Number);
    const [hFin, mFin] = nuevaParada.horaFinParada.split(':').map(Number);
    
    const totalMinutosInicio = (hInicio * 60) + mInicio;
    const totalMinutosFin = (hFin * 60) + mFin;
    let minutosPerdidos = totalMinutosFin - totalMinutosInicio;
    if (minutosPerdidos < 0) minutosPerdidos = 0; 

    let guardadaOk = false;
    try {
      const res = await apiFetch('/api/pedidos/tiempos-muertos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maquina: maquinaSeleccionada,
          codigo_parada: nuevaParada.codigo,
          motivo: nuevaParada.codigo,
          minutos_duracion: minutosPerdidos,
          numero_orden: ordenActiva?.numero_orden,
          operador: operadorSeleccionado || 'Sin Operador'
        })
      });
      guardadaOk = res.ok;
    } catch (err) {
      console.error('Error al guardar parada en vivo:', err);
    }

    const paradaConOperador = {
      ...nuevaParada,
      minutos: minutosPerdidos,
      minutos_duracion: minutosPerdidos,
      operador: operadorSeleccionado || 'Sin Operador',
      guardadaEnBD: guardadaOk
    };

    setListaParadas([...listaParadas, paradaConOperador]);
    setMostrarModalParada(false); 
    notificarEstadoEnVivo('PRODUCIENDO', Number(velocidadOperativa) || velocidadEstandarMaq, segundosRef.current);
  };

  // Divisor seguro para el cálculo de pallets (evita división por cero si el input está vacío)
  const capPalletSegura = Math.max(1, Number(capacidadPalletStandard) || 1);

  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif', width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>⚙️ Terminal de Operador en Planta</h1>
      
      <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '10px', border: '2px solid #dee2e6', display: 'flex', gap: '2rem', justifyContent: 'center', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '1.2rem', fontWeight: 'bold', marginRight: '10px', color: '#495057' }}>👤 Operador:</label>
          <select 
            disabled={enSetup || produccionActiva}
            value={operadorSeleccionado} 
            onChange={(e) => setOperadorSeleccionado(e.target.value)} 
            style={{ padding: '10px', fontSize: '1.2rem', borderRadius: '5px', border: '2px solid #0d6efd' }}
          >
            <option value="">-- Seleccione su Nombre --</option>
            {listaOperadores.map(op => <option key={op.id} value={op.nombre}>{op.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '1.2rem', fontWeight: 'bold', marginRight: '10px', color: '#495057' }}>⚙️ Máquina:</label>
          <select 
            disabled={enSetup || produccionActiva}
            value={maquinaSeleccionada} 
            onChange={(e) => setMaquinaSeleccionada(e.target.value)} 
            style={{ padding: '10px', fontSize: '1.2rem', borderRadius: '5px', border: '2px solid #0d6efd' }}
          >
            <option value="">-- Seleccione Máquina --</option>
            {listaMaquinas.map(maq => <option key={maq.id} value={maq.codigo_maquina}>{maq.codigo_maquina}</option>)}
          </select>
        </div>
      </div>

      {(!maquinaSeleccionada || !operadorSeleccionado) && (
        <h3 style={{ color: '#dc3545', backgroundColor: '#f8d7da', padding: '15px', borderRadius: '8px', display: 'inline-block' }}>👆 Por favor, seleccione su Nombre y Máquina para comenzar.</h3>
      )}

      {(maquinaSeleccionada && operadorSeleccionado && !ordenActiva) && (
        <div style={{ textAlign: 'left', backgroundColor: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0, color: '#0056b3', borderBottom: '2px solid #0056b3', paddingBottom: '10px' }}>Cola de Producción ({colaPedidos.length})</h2>
          {colaPedidos.length === 0 ? (
            <p style={{ fontSize: '1.2rem', color: '#28a745', fontWeight: 'bold' }}>No hay órdenes pendientes. ¡Buen trabajo!</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#e9ecef' }}>
                  <th style={{ padding: '15px', textAlign: 'left' }}># Secuencia</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>N° Orden</th>
                  <th style={{ padding: '15px', textAlign: 'left' }}>Cliente / Producto</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>Cant. Pedida</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {colaPedidos.map((pedido, index) => (
                  <tr key={pedido.numero_orden} style={{ borderBottom: '1px solid #dee2e6', backgroundColor: index === 0 ? '#fff3cd' : 'white' }}>
                    <td style={{ padding: '15px', fontWeight: 'bold', color: index === 0 ? '#d39e00' : '#6c757d' }}>{index === 0 ? '▶ PRÓXIMA' : index + 1}</td>
                    <td style={{ padding: '15px', fontWeight: 'bold', fontSize: '1.2rem' }}>{pedido.numero_orden}</td>
                    <td style={{ padding: '15px' }}><strong>{pedido.cliente}</strong><br/><span style={{ fontSize: '0.9rem', color: '#555' }}>{pedido.producto_descripcion}</span></td>
                    <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold' }}>{pedido.cantidad_programada}</td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <button onClick={() => seleccionarOrdenParaProducir(pedido)} disabled={index !== 0} style={{ padding: '10px 20px', backgroundColor: index === 0 ? '#28a745' : '#e9ecef', color: index === 0 ? 'white' : '#adb5bd', border: 'none', borderRadius: '5px', cursor: index === 0 ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>Preparar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {ordenActiva && !enSetup && !produccionActiva && (
        <div style={{ marginTop: '2rem', backgroundColor: 'white', padding: '2rem', borderRadius: '15px', boxShadow: '0px 8px 15px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, color: '#0056b3' }}>Orden Seleccionada: {ordenActiva.numero_orden}</h2>
          </div>
          <div style={{ textAlign: 'left', fontSize: '1.3rem', lineHeight: '2' }}>
            <p><strong>Cliente:</strong> {ordenActiva.cliente}</p>
            <p><strong>Producto:</strong> {ordenActiva.producto_descripcion}</p>
            <p><strong>Cant. Programada:</strong> <span style={{ color: '#dc3545', fontWeight: 'bold' }}>{ordenActiva.cantidad_programada} unid.</span></p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '2rem' }}>
            <button onClick={cancelarOrden} style={{ padding: '15px 30px', fontSize: '1.2rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>VOLVER A LA COLA</button>
            <button onClick={iniciarSetup} style={{ padding: '15px 30px', fontSize: '1.2rem', backgroundColor: '#fd7e14', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>▶ COMENZAR SET-UP (Preparación)</button>
          </div>
        </div>         
      )}

      {enSetup && ordenActiva && (
        <div style={{ marginTop: '2rem', backgroundColor: '#fff3cd', border: '4px solid #fd7e14', padding: '2rem', borderRadius: '15px' }}>
          <div style={{ backgroundColor: '#fd7e14', color: 'white', padding: '1rem', borderRadius: '10px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>🟠 SET-UP Y CALIBRACIÓN EN CURSO</h2>
            <span style={{ fontSize: '2.5rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatearTiempo(segundosTranscurridos)}</span>
          </div>

          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <button onClick={() => setMostrarModalCIP(true)} style={{ padding: '14px 30px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              📋 Abrir Planilla CIP (RE-PRO 009)
            </button>
          </div>

          <div style={{ backgroundColor: colorCoachSetup, color: colorCoachSetup === '#ffc107' ? 'black' : 'white', padding: '15px', borderRadius: '8px', marginBottom: '2rem', fontWeight: 'bold', fontSize: '1.2rem' }}>
            {mensajeCoachSetup}
            {pideExplicacion && (
              <div style={{ marginTop: '15px', padding: '15px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '8px' }}>
                <label style={{ display: 'block', marginBottom: '10px' }}>Obligatorio: Indique por qué se excedió el tiempo:</label>
                <select value={motivoDemoraSetup} onChange={(e) => setMotivoDemoraSetup(e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '1.1rem', borderRadius: '5px' }}>
                  <option value="">-- Seleccione justificación ({listaCodigosParada.length} códigos) --</option>
                  {listaCodigosParada.map((inc, idx) => (
                    <option key={idx} value={inc}>{inc}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={cancelarOrden} style={{ padding: '15px 30px', fontSize: '1.2rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancelar Orden</button>
            <button onClick={finalizarSetup} style={{ padding: '20px 40px', fontSize: '1.4rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>✅ SET-UP LISTO: INICIAR PRODUCCIÓN</button>
          </div>
        </div>
      )}

      {produccionActiva && ordenActiva && (
        <div style={{ marginTop: '2rem', backgroundColor: '#e9ecef', border: '4px solid #28a745', padding: '2rem', borderRadius: '15px' }}>
          <div style={{ backgroundColor: '#212529', color: 'white', padding: '1rem', borderRadius: '10px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: '#28a745' }}>🟢 PRODUCCIÓN PURA EN CURSO</h2>
            <span style={{ fontSize: '2.5rem', fontWeight: 'bold', fontFamily: 'monospace', color: '#0dcaf0' }}>{formatearTiempo(segundosTranscurridos)}</span>
          </div>

          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <button onClick={() => setMostrarModalCIP(true)} style={{ padding: '14px 30px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              📋 Ver / Completar Planilla CIP sobre la Marcha (RE-PRO 009)
            </button>
          </div>

          <div style={{ backgroundColor: '#212529', padding: '1.5rem', borderRadius: '10px', color: 'white', textAlign: 'left', marginBottom: '2rem', border: '1px solid #444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '1rem', color: '#adb5bd' }}>
                ⚡ VELOCIDAD ACTUAL DE MÁQUINA (Estándar: {velocidadEstandarMaq} cajas/min)
              </span>
              <span style={{ fontSize: '0.85rem', padding: '4px 10px', backgroundColor: modoCaptura === 'AUTOMATICO' ? '#0dcaf0' : '#ffc107', color: '#000', borderRadius: '4px', fontWeight: 'bold' }}>
                {modoCaptura === 'AUTOMATICO' ? '🤖 MODO AUTOMÁTICO (Sensor)' : '🖐️ MODO MANUAL (Tablet)'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '15px' }}>
              {modoCaptura === 'MANUAL' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input 
                    type="number" 
                    min="0"
                    max="500"
                    value={velocidadOperativa} 
                    onChange={(e) => setVelocidadOperativa(e.target.value)} 
                    style={{ fontSize: '2.5rem', width: '140px', textAlign: 'center', backgroundColor: '#343a40', color: '#ffc107', border: '2px solid #ffc107', borderRadius: '8px', fontWeight: 'bold' }}
                  />
                  <span style={{ fontSize: '1.2rem', color: '#ffc107' }}>golpes/min (Control por Operador)</span>
                </div>
              ) : (
                <div>
                  <span style={{ fontSize: '2.5rem', fontWeight: 'bold', fontFamily: 'monospace', color: '#0dcaf0' }}>
                    {velocidadOperativa}
                  </span>
                  <span style={{ fontSize: '1.2rem', color: '#adb5bd', marginLeft: '10px' }}>golpes/min (Lectura bloqueada — Vía Sensor IIoT)</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ backgroundColor: colorCoachProd, color: colorCoachProd === '#ffc107' ? 'black' : 'white', padding: '15px', borderRadius: '8px', marginBottom: '2rem', fontWeight: 'bold', fontSize: '1.2rem' }}>
            {mensajeCoachProd}
          </div>
          
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', textAlign: 'left', marginBottom: '2rem', borderLeft: '5px solid #0056b3' }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '1.5rem' }}><strong>Orden {ordenActiva.numero_orden}</strong> | {ordenActiva.cliente}</p>
            <p style={{ margin: 0, fontSize: '1.2rem' }}>{ordenActiva.producto_descripcion}</p>
          </div>

          {/* --- SECCIÓN DE CONTROL DE PALLETS PARA EXPEDICIÓN (CÁLCULO VISUAL EN VIVO) --- */}
          <div style={{ backgroundColor: '#ffffff', border: '2px dashed #0d6efd', padding: '15px', borderRadius: '10px', marginBottom: '2rem', textAlign: 'left', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#0d6efd', fontSize: '1.2rem' }}>📦 Control de Pallets para Expedición</h4>
            
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: '0.95rem', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Capacidad Estándar del Pallet (Unidades):</label>
                <input 
                  type="number"
                  min="1"
                  max="10000"
                  value={capacidadPalletStandard} 
                  onChange={(e) => setCapacidadPalletStandard(e.target.value)}
                  placeholder="Ej: 300, 600, 1000..."
                  style={{ padding: '8px', fontSize: '1.2rem', borderRadius: '5px', border: '2px solid #0d6efd', width: '180px', textAlign: 'center', fontWeight: 'bold' }}
                />
              </div>

              <div style={{ flex: 1, backgroundColor: '#e7f5ff', padding: '12px', borderRadius: '8px', fontSize: '1.05rem', border: '1px solid #74c0fc' }}>
                📊 <strong>Cálculo Automático (Se registrará al finalizar la orden):</strong> {' '}
                <span style={{ color: '#0b5ed7', fontWeight: 'bold' }}>
                  {Math.floor((Number(cantidadFabricada) || 0) / capPalletSegura)} pallets completos
                </span>{' '}
                de {capPalletSegura} u. y un{' '}
                <span style={{ color: '#b02a37', fontWeight: 'bold' }}>
                  {((Number(cantidadFabricada) || 0) % capPalletSegura) > 0 ? `pallet parcial de ${(Number(cantidadFabricada) || 0) % capPalletSegura} unidades` : 'sin remanente parcial'}.
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', alignItems: 'center' }}>
            
            <button onClick={abrirModal} style={{ flex: 1, padding: '30px 15px', fontSize: '1.2rem', backgroundColor: '#ffc107', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              ⏸ REGISTRAR PARADA
            </button>

            <button onClick={() => setMostrarModalScrap(true)} style={{ flex: 1, padding: '30px 15px', fontSize: '1.2rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <span>⚠️ REGISTRAR</span>
              <span>SCRAP (Kg)</span>
            </button>

            <div style={{ flex: 1.5, backgroundColor: 'white', padding: '1.2rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <label style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '5px' }}>Cant. Fabricada Real (Cajas):</label>
              
              <div style={{ fontSize: '0.85rem', color: '#495057', marginBottom: '8px', textAlign: 'center', backgroundColor: '#e9ecef', padding: '5px 10px', borderRadius: '6px', width: '90%' }}>
                <span>Meta: <strong>{ordenActiva.cantidad_programada}</strong></span> | &nbsp;
                <span style={{ color: '#d97706' }}>Máx. (+10%): <strong>{Math.round(Number(ordenActiva.cantidad_programada || 0) * 1.10)}</strong></span>
              </div>

              <input 
                type="number" 
                value={cantidadFabricada} 
                onChange={(e) => setCantidadFabricada(e.target.value)} 
                style={{ fontSize: '1.8rem', width: '80%', textAlign: 'center', padding: '8px', border: '2px solid #28a745', borderRadius: '8px', marginBottom: '10px' }} 
              />
              
              <button onClick={finalizarOrdenBD} style={{ width: '100%', padding: '12px', fontSize: '1.1rem', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                ✅ FINALIZAR ORDEN Y CERRAR
              </button>
            </div>

          </div>
        </div>
      )}

      {mostrarModalScrap && (
        <ModalScrap 
          ordenId={ordenActiva?.id} 
          maquina={maquinaSeleccionada} 
          ordenActiva={ordenActiva} 
          onClose={() => setMostrarModalScrap(false)} 
          onGuardado={() => {
            console.log('Scrap guardado correctamente');
          }}
        />
      )}

      {mostrarModalParada && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '15px', width: '90%', maxWidth: '500px' }}>
            <h2 style={{ color: '#dc3545', marginTop: 0 }}>Registrar Tiempo Muerto</h2>
            <form onSubmit={guardarParada} style={{ textAlign: 'left', marginTop: '1.5rem' }}>
              <label>Hora de Inicio:</label>
              <input type="time" required value={nuevaParada.horaInicioParada} onChange={(e) => setNuevaParada({...nuevaParada, horaInicioParada: e.target.value})} style={{ width: '100%', padding: '15px', fontSize: '1.5rem', marginBottom: '20px' }} />
              <label>Hora de Fin:</label>
              <input type="time" required value={nuevaParada.horaFinParada} onChange={(e) => setNuevaParada({...nuevaParada, horaFinParada: e.target.value})} style={{ width: '100%', padding: '15px', fontSize: '1.5rem', marginBottom: '20px' }} />
              <label>Código de Parada:</label>
              <select required value={nuevaParada.codigo} onChange={(e) => setNuevaParada({...nuevaParada, codigo: e.target.value})} style={{ width: '100%', padding: '15px', fontSize: '1.1rem', marginBottom: '30px' }}>
                <option value="" disabled>-- Seleccione un código ({listaCodigosParada.length} disponibles) --</option>
                {listaCodigosParada.map((inc, idx) => (
                  <option key={idx} value={inc}>{inc}</option>
                ))}
              </select>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" onClick={() => setMostrarModalParada(false)} style={{ padding: '15px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ padding: '15px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar Parada</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mostrarModalCIP && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, overflowY: 'auto', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '10px', maxWidth: '1050px', width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}>
            <button onClick={() => setMostrarModalCIP(false)} style={{ position: 'sticky', top: '10px', float: 'right', marginRight: '15px', marginTop: '15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '50%', width: '35px', height: '35px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', zIndex: 2010 }}>✕</button>
            <div style={{ padding: '20px' }}>
              <PantallaCIP 
                ordenActiva={ordenActiva} 
                operador={operadorSeleccionado} 
                maquina={maquinaSeleccionada} 
                onCerrar={() => setMostrarModalCIP(false)}
                datosCIP={datosCIP}
                setDatosCIP={setDatosCIP}
                verificacion={verificacion}
                setVerificacion={setVerificacion}
                inspeccionPaquetes={inspeccionPaquetes}
                setInspeccionPaquetes={setInspeccionPaquetes}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}