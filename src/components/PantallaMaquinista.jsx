import { useState, useEffect, useRef } from 'react';
import PantallaCIP from './PantallaCIP';
import ModalScrap from './ModalScrap';
import { apiFetch } from '../services/api'; // 👈 IMPORTACIÓN CENTRALIZADA

const STORAGE_KEY = 'nexo_estado_maquinista_v1';
const TURNOS_HISTORIAL_KEY = 'nexo_historial_turnos_v1';

// Respaldo completo de las 64 incidencias oficiales (Tipos_Incidencias.csv) + Set-Up
export const INCIDENCIAS_RESPALDO = [
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
  
  // ⏱️ ESTADOS DE TURNO REAL DE MÁQUINA (APERTURA Y CIERRE DE HORAS OPERATIVAS)
  const [turnoActivo, setTurnoActivo] = useState(estadoGuardado?.turnoActivo || null);
  const [segundosTurno, setSegundosTurno] = useState(() => {
    if (estadoGuardado?.turnoActivo?.inicioMs) {
      return Math.max(0, Math.floor((Date.now() - estadoGuardado.turnoActivo.inicioMs) / 1000));
    }
    return 0;
  });
  const [mostrarModalFinTurno, setMostrarModalFinTurno] = useState(false);
  const [cajasAvanceRelevo, setCajasAvanceRelevo] = useState('');

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
      turnoActivo,
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
    turnoActivo,
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

  // Cronómetro del Turno Activo
  useEffect(() => {
    if (!turnoActivo?.inicioMs) {
      setSegundosTurno(0);
      return;
    }
    setSegundosTurno(Math.max(0, Math.floor((Date.now() - turnoActivo.inicioMs) / 1000)));
    const intTurno = setInterval(() => {
      setSegundosTurno(Math.max(0, Math.floor((Date.now() - turnoActivo.inicioMs) / 1000)));
    }, 1000);
    return () => clearInterval(intTurno);
  }, [turnoActivo]);

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
            'en proceso',
            'pausada',
            'finalizada parcial',
            'parcial'
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

  // 🛰️ SINCRONIZACIÓN CON MONITOR TV EN VIVO
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
          segundos_fase: Number(segundosFaseVal) || 0
        })
      });
    } catch (err) {
      console.error("Error al sincronizar estado en vivo con TV:", err);
    }
  };

  useEffect(() => {
    if (!maquinaSeleccionada) return;

    const enviarLatido = () => {
      let estadoActual = turnoActivo ? 'ESPERA' : 'INACTIVA';
      let velActual = 0;
      
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

    enviarLatido();
    const latido = setInterval(enviarLatido, 2000);

    return () => clearInterval(latido);
  }, [
    maquinaSeleccionada,
    operadorSeleccionado,
    turnoActivo,
    enSetup,
    produccionActiva,
    mostrarModalParada,
    cantidadFabricada,
    ordenActiva,
    velocidadOperativa,
    inicioFaseMs
  ]);

  // ⏱️ CRONÓMETRO DE FASE
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

  // =========================================================================
  // 🟢 LÓGICA DE APERTURA Y CIERRE DE TURNO REAL + RELEVO DE ORDEN EN CURSO
  // =========================================================================
  const detectarEtiquetaTurno = () => {
    const hora = new Date().getHours();
    if (hora >= 6 && hora < 14) return 'Turno Mañana (06 a 14 hs)';
    if (hora >= 14 && hora < 22) return 'Turno Tarde (14 a 22 hs)';
    return 'Turno Noche (22 a 06 hs)';
  };

  const iniciarTurnoMaquina = async () => {
    if (!maquinaSeleccionada || !operadorSeleccionado) {
      alert('⚠️ Selecciona primero tu Nombre y la Máquina.');
      return;
    }

    const ahora = new Date();
    const horaStr = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fechaISO = ahora.toISOString();

    const nuevoTurno = {
      id_local: Date.now(),
      id_bd: null,
      maquina: maquinaSeleccionada,
      operador: operadorSeleccionado,
      etiqueta_turno: detectarEtiquetaTurno(),
      fecha_inicio: fechaISO,
      hora_inicio: horaStr,
      inicioMs: Date.now()
    };

    try {
      const res = await apiFetch('/api/pedidos/turnos/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maquina: maquinaSeleccionada,
          operador: operadorSeleccionado,
          etiqueta_turno: nuevoTurno.etiqueta_turno,
          hora_inicio: horaStr,
          fecha_inicio: fechaISO
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.id) nuevoTurno.id_bd = data.id;
      }
    } catch (err) {
      console.warn('Guardando inicio de turno en modo local:', err);
    }

    setTurnoActivo(nuevoTurno);
  };

  const abrirConfirmacionFinTurno = () => {
    if (mostrarModalParada) {
      alert('⚠️ Tienes la ventana de Registrar Parada abierta. Guarda o cancela la parada antes de cerrar tu turno.');
      return;
    }
    setCajasAvanceRelevo(String(cantidadFabricada || 0));
    setMostrarModalFinTurno(true);
  };

  const confirmarCierreDeTurno = async (modoRelevo = 'SIN_ORDEN') => {
    if (!turnoActivo) return;

    const ahora = new Date();
    const horaFinStr = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const minutosRealesTurno = Math.max(1, Math.round((Date.now() - turnoActivo.inicioMs) / 60000));

    // 1. Si el maquinista estaba en mitad de un Set-Up al terminar su turno, imputamos esos minutos a su turno
    if (enSetup && ordenActiva) {
      const minSetupParcial = Math.max(1, Math.floor(segundosTranscurridos / 60));
      try {
        await apiFetch('/api/pedidos/tiempos-muertos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            maquina: maquinaSeleccionada,
            codigo_parada: '00 - Set-Up Inicial (Fin de Turno)',
            motivo: '00 - Set-Up Inicial (Fin de Turno)',
            minutos_duracion: minSetupParcial,
            numero_orden: ordenActiva.numero_orden,
            operador: operadorSeleccionado
          })
        });
      } catch (e) {
        console.error(e);
      }
    }

    // 2. Si tenía una orden en Producción y elige "DEJAR EN MÁQUINA PARA EL RELEVO (14:00 hs)"
    if (produccionActiva && ordenActiva && modoRelevo === 'RELEVO_CONTINUA') {
      const cajasDeEsteTurno = Math.max(0, Number(cajasAvanceRelevo) || 0);
      const acumuladoAnterior = Number(ordenActiva.cantidad_fabricada_previa || ordenActiva.cantidad_fabricada || 0);
      const nuevoTotalAcumulado = acumuladoAnterior + cajasDeEsteTurno;
      const descProductoReal = ordenActiva.descripcion_producto || ordenActiva.producto_descripcion || 'Producto';

      try {
        // Actualizamos la orden con estado "En Producción" para que NO desaparezca de la máquina y guarde el avance
        await apiFetch(`/api/pedidos/${ordenActiva.numero_orden}/produccion`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cantidad_fabricada: nuevoTotalAcumulado,
            estado: 'En Producción',
            paradas: listaParadas,
            maquina: maquinaSeleccionada,
            operador: operadorSeleccionado
          })
        });

        // Enviamos a Expedición los pallets que fabricó este turno que se retira
        if (cajasDeEsteTurno > 0) {
          await apiFetch('/api/expedicion/pallets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              numero_orden: ordenActiva.numero_orden,
              maquina: maquinaSeleccionada,
              operador: operadorSeleccionado,
              cliente: ordenActiva.cliente,
              producto_descripcion: descProductoReal,
              cantidad_unidades: cajasDeEsteTurno,
              capacidad_standard: Math.max(1, Number(capacidadPalletStandard) || 1000)
            })
          }).catch(() => {});
        }
      } catch (err) {
        console.error('Error al guardar avance de relevo:', err);
      }

      // La orden queda preparada en pantalla con el saldo actualizado para el maquinista que entra a las 14 hs
      const ordenActualizadaParaRelevo = {
        ...ordenActiva,
        estado: 'En Producción',
        cantidad_fabricada: nuevoTotalAcumulado,
        cantidad_fabricada_previa: nuevoTotalAcumulado,
        vieneDeRelevo: true,
        operadorAnterior: operadorSeleccionado
      };

      setOrdenActiva(ordenActualizadaParaRelevo);
      setEnSetup(false);
      setProduccionActiva(false);
      setCantidadFabricada(0);
      setSegundosTranscurridos(0);
      setInicioFaseMs(null);
      setListaParadas([]);
    }

    // 3. Si al cerrar el turno la orden ya se había terminado por completo
    if (produccionActiva && ordenActiva && modoRelevo === 'FINALIZAR_ORDEN_TOTAL') {
      const cajasDeEsteTurno = Math.max(0, Number(cajasAvanceRelevo) || 0);
      const acumuladoAnterior = Number(ordenActiva.cantidad_fabricada_previa || ordenActiva.cantidad_fabricada || 0);
      const totalFinal = acumuladoAnterior + cajasDeEsteTurno;
      await cerrarOrdenProduccion('Finalizada', totalFinal, cajasDeEsteTurno);
    }

    // 4. Registrar el cierre del turno en Backend + Historial Local (para OEE exacto)
    const registroCerrado = {
      ...turnoActivo,
      hora_fin: horaFinStr,
      fecha_fin: ahora.toISOString(),
      minutos_totales: minutosRealesTurno,
      estado: 'CERRADO'
    };

    try {
      await apiFetch('/api/pedidos/turnos/finalizar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: turnoActivo.id_bd,
          maquina: maquinaSeleccionada,
          operador: operadorSeleccionado,
          hora_inicio: turnoActivo.hora_inicio,
          hora_fin: horaFinStr,
          fecha_inicio: turnoActivo.fecha_inicio,
          minutos_totales: minutosRealesTurno
        })
      });
    } catch (err) {
      console.warn('Cierre de turno guardado en almacenamiento local:', err);
    }

    try {
      const histPrevio = JSON.parse(localStorage.getItem(TURNOS_HISTORIAL_KEY) || '[]');
      histPrevio.push(registroCerrado);
      localStorage.setItem(TURNOS_HISTORIAL_KEY, JSON.stringify(histPrevio));
    } catch (e) {
      console.error(e);
    }

    alert(`🔴 Turno cerrado correctamente.\n👤 Maquinista: ${operadorSeleccionado}\n⚙️ Máquina: ${maquinaSeleccionada}\n⏱️ Tiempo real abierto: ${minutosRealesTurno} min (${(minutosRealesTurno / 60).toFixed(1)} hs)`);

    setTurnoActivo(null);
    setSegundosTurno(0);
    setMostrarModalFinTurno(false);
    setOperadorSeleccionado(''); // Libera el operador para que ingrese el relevo de las 14 hs
    cargarColaDeTrabajo(maquinaSeleccionada);
    notificarEstadoEnVivo('INACTIVA', 0, 0, ordenActiva);
  };

  // =========================================================================
  // CÁLCULO DE METAS Y TIEMPOS DE COACH
  // =========================================================================
  const avancePrevioOrden = Number(ordenActiva?.cantidad_fabricada_previa || ordenActiva?.cantidad_fabricada || 0);
  const metaRestanteOrden = Math.max(0, Number(ordenActiva?.cantidad_programada || 0) - avancePrevioOrden);

  let tiempoObjetivoMinutos = 0;
  let mensajeCoachProd = "";
  let colorCoachProd = "";

  if (ordenActiva && produccionActiva) {
    const VELOCIDAD_ESTANDAR = Number(velocidadEstandarMaq) || 120; 
    const cantidadObjetivoTurno = metaRestanteOrden > 0 ? metaRestanteOrden : Number(ordenActiva.cantidad_programada || 0);
    tiempoObjetivoMinutos = Math.ceil(cantidadObjetivoTurno / VELOCIDAD_ESTANDAR);
    const minutosBrutos = Math.floor(segundosTranscurridos / 60);
    
    const totalMinutosParadosEnProduccion = listaParadas
      .filter(p => !String(p.codigo || '').toLowerCase().includes('set-up'))
      .reduce((acc, parada) => acc + (Number(parada.minutos) || 0), 0);
    
    let minutosNetos = minutosBrutos - totalMinutosParadosEnProduccion;
    if (minutosNetos < 0) minutosNetos = 0; 

    if (minutosNetos < tiempoObjetivoMinutos * 0.7) {
      mensajeCoachProd = `🔥 ¡Velocidad Pura! Tiempo Neto: ${minutosNetos}m | Ideal para completar: ${tiempoObjetivoMinutos}m.`;
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
    if (!turnoActivo) {
      alert('⚠️ Primero debes tocar el botón verde "🟢 INICIAR TURNO EN MÁQUINA" para registrar tus horas de trabajo.');
      return;
    }
    const cantYaHecha = Number(pedido.cantidad_fabricada || 0);
    const est = String(pedido.estado || '').toLowerCase();
    const esRelevo = cantYaHecha > 0 || est === 'en producción' || est === 'en produccion' || est === 'en proceso';

    setOrdenActiva({
      ...pedido,
      cantidad_fabricada_previa: cantYaHecha,
      vieneDeRelevo: esRelevo
    });
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
    notificarEstadoEnVivo(turnoActivo ? 'ESPERA' : 'INACTIVA', 0, 0, null);
  };

  const iniciarSetup = () => {
    if (!turnoActivo) {
      alert('⚠️ Primero debes iniciar tu turno en el panel superior.');
      return;
    }
    const ahora = new Date();
    setHoraInicio(ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    setInicioFaseMs(Date.now());
    setSegundosTranscurridos(0);
    setEnSetup(true); 
    notificarEstadoEnVivo('SETUP', 0, 0);
  };

  // ⚡ NUEVA FUNCIÓN: CONTINUAR PRODUCCIÓN DIRECTO (PARA EL RELEVO DE LAS 14:00 HS SIN SET-UP FALSO)
  const continuarProduccionRelevoSinSetup = () => {
    if (!turnoActivo) {
      alert('⚠️ Primero debes tocar "🟢 INICIAR TURNO EN MÁQUINA" para comenzar a producir.');
      return;
    }
    const ahora = new Date();
    const horaActual = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setHoraInicio(horaActual);
    setInicioFaseMs(Date.now());
    setSegundosTranscurridos(0);
    setEnSetup(false);
    setProduccionActiva(true);
    notificarEstadoEnVivo('PRODUCIENDO', Number(velocidadOperativa) || velocidadEstandarMaq, 0);
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

  const capPalletSegura = Math.max(1, Number(capacidadPalletStandard) || 1);

  // Función unificada para cierre Total o Parcial (Suma lo hecho en el turno anterior si viene de relevo)
  const cerrarOrdenProduccion = async (estadoDestino = 'Finalizada', totalOverride = null, cajasTurnoOverride = null) => {
    if (!ordenActiva) return;
    const cajasHechasEnEsteTurno = cajasTurnoOverride !== null ? Number(cajasTurnoOverride) : (Number(cantidadFabricada) || 0);
    const cantTotalOrden = totalOverride !== null ? Number(totalOverride) : (avancePrevioOrden + cajasHechasEnEsteTurno);
    const descProductoReal = ordenActiva.descripcion_producto || ordenActiva.producto_descripcion || 'Producto';

    try {
      const respuesta = await apiFetch(`/api/pedidos/${ordenActiva.numero_orden}/produccion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cantidad_fabricada: cantTotalOrden, 
          estado: estadoDestino,
          paradas: listaParadas,
          maquina: maquinaSeleccionada,
          operador: operadorSeleccionado
        })
      });

      if (respuesta.ok) {
        if (cajasHechasEnEsteTurno > 0) {
          await apiFetch('/api/expedicion/pallets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              numero_orden: ordenActiva.numero_orden,
              maquina: maquinaSeleccionada,
              operador: operadorSeleccionado,
              cliente: ordenActiva.cliente,
              producto_descripcion: descProductoReal,
              cantidad_unidades: cajasHechasEnEsteTurno,
              capacidad_standard: capPalletSegura
            })
          }).catch(err => console.error("Error al registrar pallet automático:", err));
        }

        alert(
          `✅ Orden ${ordenActiva.numero_orden} registrada como "${estadoDestino}".\n` +
          `👤 Maquinista: ${operadorSeleccionado}\n` +
          `📦 Fabricadas en este turno: ${cajasHechasEnEsteTurno} u.\n` +
          `📊 Total acumulado de la orden: ${cantTotalOrden} / ${ordenActiva.cantidad_programada} u.`
        );
        cancelarOrden();
        cargarColaDeTrabajo(maquinaSeleccionada);
      } else {
        const errData = await respuesta.json().catch(() => ({}));
        alert(`❌ No se pudo cerrar la orden: ${errData.error || respuesta.status}`);
      }
    } catch (error) { 
      console.error('Error al cerrar orden:', error);
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

  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif', width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>⚙️ Terminal de Operador en Planta</h1>
      
      {/* SELECTOR DE OPERADOR Y MÁQUINA */}
      <div style={{ marginBottom: '1.2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '10px', border: '2px solid #dee2e6', display: 'flex', gap: '2rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '1.2rem', fontWeight: 'bold', marginRight: '10px', color: '#495057' }}>👤 Maquinista:</label>
          <select 
            disabled={!!turnoActivo || enSetup || produccionActiva}
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
            disabled={!!turnoActivo || enSetup || produccionActiva}
            value={maquinaSeleccionada} 
            onChange={(e) => setMaquinaSeleccionada(e.target.value)} 
            style={{ padding: '10px', fontSize: '1.2rem', borderRadius: '5px', border: '2px solid #0d6efd' }}
          >
            <option value="">-- Seleccione Máquina --</option>
            {listaMaquinas.map(maq => <option key={maq.id} value={maq.codigo_maquina}>{maq.codigo_maquina}</option>)}
          </select>
        </div>
      </div>

      {/* =========================================================================
          ⏱️ BARRA DE CONTROL DE TURNO REAL (APERTURA Y CIERRE DE HORAS DE MÁQUINA)
         ========================================================================= */}
      {maquinaSeleccionada && operadorSeleccionado && (
        <div style={{
          marginBottom: '2rem',
          padding: '1.2rem 1.8rem',
          borderRadius: '12px',
          backgroundColor: turnoActivo ? '#0f172a' : '#fff3cd',
          color: turnoActivo ? 'white' : '#856404',
          border: turnoActivo ? '3px solid #10b981' : '3px solid #ffc107',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
        }}>
          {!turnoActivo ? (
            <>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>🔴 Máquina con Turno Cerrado</div>
                <div style={{ fontSize: '0.95rem' }}>
                  Iniciá tu turno para habilitar la producción y contabilizar las horas reales de apertura en OEE.
                </div>
              </div>
              <button
                onClick={iniciarTurnoMaquina}
                style={{
                  padding: '14px 28px',
                  fontSize: '1.15rem',
                  fontWeight: 'bold',
                  backgroundColor: '#198754',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.15)'
                }}
              >
                🟢 INICIAR TURNO EN MÁQUINA
              </button>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ backgroundColor: '#10b981', color: '#0f172a', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.82rem' }}>
                    🟢 TURNO ACTIVO
                  </span>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#38bdf8' }}>
                    {turnoActivo.etiqueta_turno}
                  </span>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '5px' }}>
                  Apertura: <strong>{turnoActivo.hora_inicio} hs</strong> | Maquinista: <strong>{turnoActivo.operador}</strong> | Máquina: <strong>{turnoActivo.maquina}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>TIEMPO ABIERTO DEL TURNO</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', fontFamily: 'monospace', color: '#4ade80' }}>
                    {formatearTiempo(segundosTurno)}
                  </div>
                </div>

                <button
                  onClick={abrirConfirmacionFinTurno}
                  style={{
                    padding: '12px 22px',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  🔴 FINALIZAR TURNO
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {(!maquinaSeleccionada || !operadorSeleccionado) && (
        <h3 style={{ color: '#dc3545', backgroundColor: '#f8d7da', padding: '15px', borderRadius: '8px', display: 'inline-block' }}>👆 Por favor, seleccione su Nombre y Máquina para comenzar.</h3>
      )}

      {(maquinaSeleccionada && operadorSeleccionado && !ordenActiva) && (
        <div style={{ textAlign: 'left', backgroundColor: 'white', padding: '2rem', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', opacity: turnoActivo ? 1 : 0.65 }}>
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
                  <th style={{ padding: '15px', textAlign: 'center' }}>Meta / Avance</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {colaPedidos.map((pedido, index) => {
                  const yaHechas = Number(pedido.cantidad_fabricada || 0);
                  const esRelevo = yaHechas > 0 || String(pedido.estado || '').toLowerCase() === 'en producción';

                  return (
                    <tr key={pedido.numero_orden} style={{ borderBottom: '1px solid #dee2e6', backgroundColor: index === 0 ? '#fff3cd' : 'white' }}>
                      <td style={{ padding: '15px', fontWeight: 'bold', color: index === 0 ? '#d39e00' : '#6c757d' }}>
                        {index === 0 ? '▶ PRÓXIMA' : index + 1}
                        {esRelevo && (
                          <div style={{ fontSize: '0.72rem', backgroundColor: '#0dcaf0', color: '#000', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', display: 'inline-block' }}>
                            🔄 EN MÁQUINA (RELEVO)
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '15px', fontWeight: 'bold', fontSize: '1.2rem' }}>{pedido.numero_orden}</td>
                      <td style={{ padding: '15px' }}>
                        <strong>{pedido.cliente}</strong><br/>
                        <span style={{ fontSize: '0.9rem', color: '#555' }}>{pedido.descripcion_producto || pedido.producto_descripcion}</span>
                      </td>
                      <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold' }}>
                        <div>{pedido.cantidad_programada} u.</div>
                        {yaHechas > 0 && (
                          <div style={{ fontSize: '0.8rem', color: '#198754' }}>
                            Hechas: {yaHechas} u. (Resta: {Math.max(0, Number(pedido.cantidad_programada) - yaHechas)})
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '15px', textAlign: 'center' }}>
                        <button
                          onClick={() => seleccionarOrdenParaProducir(pedido)}
                          disabled={index !== 0 || !turnoActivo}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: (index === 0 && turnoActivo) ? (esRelevo ? '#0d6efd' : '#28a745') : '#e9ecef',
                            color: (index === 0 && turnoActivo) ? 'white' : '#adb5bd',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: (index === 0 && turnoActivo) ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold'
                          }}
                        >
                          {esRelevo ? '🔄 Continuar Relevo' : 'Preparar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {ordenActiva && !enSetup && !produccionActiva && (
        <div style={{ marginTop: '2rem', backgroundColor: 'white', padding: '2rem', borderRadius: '15px', boxShadow: '0px 8px 15px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '1rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ margin: 0, color: '#0056b3' }}>Orden Seleccionada: {ordenActiva.numero_orden}</h2>
            {avancePrevioOrden > 0 && (
              <span style={{ backgroundColor: '#d1e7dd', color: '#0f5132', padding: '6px 14px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.95rem' }}>
                🔄 Continuación de Turno Anterior (Ya fabricadas: {avancePrevioOrden} u.)
              </span>
            )}
          </div>

          <div style={{ textAlign: 'left', fontSize: '1.3rem', lineHeight: '2' }}>
            <p><strong>Cliente:</strong> {ordenActiva.cliente}</p>
            <p><strong>Producto:</strong> {ordenActiva.descripcion_producto || ordenActiva.producto_descripcion}</p>
            <p>
              <strong>Cant. Programada Total:</strong>{' '}
              <span style={{ color: '#dc3545', fontWeight: 'bold' }}>{ordenActiva.cantidad_programada} unid.</span>
              {avancePrevioOrden > 0 && (
                <span style={{ marginLeft: '15px', color: '#0d6efd', fontWeight: 'bold' }}>
                  | Saldo por fabricar en este turno: {metaRestanteOrden} unid.
                </span>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap' }}>
            <button onClick={cancelarOrden} style={{ padding: '15px 25px', fontSize: '1.1rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              VOLVER A LA COLA
            </button>

            {/* Si viene de un relevo o ya estaba en máquina, permite continuar sin cargar un Set-Up falso */}
            {(ordenActiva.vieneDeRelevo || avancePrevioOrden > 0) && (
              <button
                onClick={continuarProduccionRelevoSinSetup}
                style={{ padding: '15px 30px', fontSize: '1.2rem', backgroundColor: '#198754', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.15)' }}
              >
                ⚡ CONTINUAR PRODUCCIÓN DIRECTO (Sin Set-Up)
              </button>
            )}

            <button onClick={iniciarSetup} style={{ padding: '15px 30px', fontSize: '1.2rem', backgroundColor: '#fd7e14', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              ▶ COMENZAR SET-UP (Preparación)
            </button>
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
            <p style={{ margin: 0, fontSize: '1.2rem' }}>{ordenActiva.descripcion_producto || ordenActiva.producto_descripcion}</p>
            {avancePrevioOrden > 0 && (
              <p style={{ margin: '8px 0 0 0', fontSize: '1rem', color: '#0f5132', backgroundColor: '#d1e7dd', padding: '6px 12px', borderRadius: '6px', display: 'inline-block', fontWeight: 'bold' }}>
                🔄 Avance del turno anterior: {avancePrevioOrden} cajas | Restan fabricar: {metaRestanteOrden} cajas
              </p>
            )}
          </div>

          {/* --- SECCIÓN DE CONTROL DE PALLETS PARA EXPEDICIÓN --- */}
          <div style={{ backgroundColor: '#ffffff', border: '2px dashed #0d6efd', padding: '15px', borderRadius: '10px', marginBottom: '2rem', textAlign: 'left', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#0d6efd', fontSize: '1.2rem' }}>📦 Control de Pallets para Expedición (De este turno)</h4>
            
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
                📊 <strong>Cálculo Automático (De tu turno):</strong> {' '}
                <span style={{ color: '#0b5ed7', fontWeight: 'bold' }}>
                  {Math.floor((Number(cantidadFabricada) || 0) / capPalletSegura)} pallets completos
                </span>{' '}
                de {capPalletSegura} u. y{' '}
                <span style={{ color: '#b02a37', fontWeight: 'bold' }}>
                  {((Number(cantidadFabricada) || 0) % capPalletSegura) > 0 ? `1 pallet parcial de ${(Number(cantidadFabricada) || 0) % capPalletSegura} unidades` : 'sin remanente parcial'}.
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            
            <button onClick={abrirModal} style={{ flex: 1, padding: '30px 15px', fontSize: '1.2rem', backgroundColor: '#ffc107', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              ⏸ REGISTRAR PARADA
            </button>

            <button onClick={() => setMostrarModalScrap(true)} style={{ flex: 1, padding: '30px 15px', fontSize: '1.2rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <span>⚠️ REGISTRAR</span>
              <span>SCRAP (Kg)</span>
            </button>

            <div style={{ flex: 1.5, backgroundColor: 'white', padding: '1.2rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <label style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '5px' }}>
                Cajas Fabricadas en TU Turno:
              </label>
              
              <div style={{ fontSize: '0.85rem', color: '#495057', marginBottom: '8px', textAlign: 'center', backgroundColor: '#e9ecef', padding: '5px 10px', borderRadius: '6px', width: '90%' }}>
                <span>Meta Total: <strong>{ordenActiva.cantidad_programada}</strong></span>
                {avancePrevioOrden > 0 && (
                  <span> | Restante: <strong style={{ color: '#0d6efd' }}>{metaRestanteOrden}</strong></span>
                )}
                {' '}| <span style={{ color: '#d97706' }}>Máx. (+10%): <strong>{Math.round(Number(ordenActiva.cantidad_programada || 0) * 1.10)}</strong></span>
              </div>

              <input 
                type="number" 
                value={cantidadFabricada} 
                onChange={(e) => setCantidadFabricada(e.target.value)} 
                style={{ fontSize: '1.8rem', width: '80%', textAlign: 'center', padding: '8px', border: '2px solid #28a745', borderRadius: '8px', marginBottom: '10px' }} 
              />
              
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <button 
                  onClick={() => cerrarOrdenProduccion('Finalizada Parcial')} 
                  style={{ flex: 1, padding: '12px 8px', fontSize: '0.9rem', backgroundColor: '#fd7e14', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                  title="Cierra la orden con faltante (ej. falta de plancha) y envía a programación"
                >
                  ⏸ CIERRE C/ FALTANTE
                </button>
                <button 
                  onClick={() => cerrarOrdenProduccion('Finalizada')} 
                  style={{ flex: 1.3, padding: '12px 8px', fontSize: '1rem', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ✅ FINALIZAR ORDEN
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          🔴 MODAL DE CIERRE DE TURNO Y ENTREGA DE RELEVO (14:00 HS)
         ========================================================================= */}
      {mostrarModalFinTurno && turnoActivo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1500 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '15px', width: '92%', maxWidth: '560px', textAlign: 'left', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
            <h2 style={{ marginTop: 0, color: '#dc3545' }}>🔴 Finalizar Turno de Máquina</h2>
            <p style={{ color: '#495057', fontSize: '1rem', marginBottom: '1rem' }}>
              Maquinista: <strong>{operadorSeleccionado}</strong> | Máquina: <strong>{maquinaSeleccionada}</strong><br/>
              Tiempo abierto contabilizado: <strong>{Math.max(1, Math.round(segundosTurno / 60))} minutos ({formatearTiempo(segundosTurno)})</strong>
            </p>

            {produccionActiva && ordenActiva ? (
              <div style={{ backgroundColor: '#fff3cd', border: '2px solid #ffc107', padding: '1.2rem', borderRadius: '10px', marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#856404' }}>
                  🔄 Tienes la Orden #{ordenActiva.numero_orden} en curso ({ordenActiva.cliente})
                </h4>
                <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#664d03' }}>
                  Indica cuántas cajas dejás fabricadas en tu turno. Si la orden queda incompleta, el próximo turno podrá continuarla directamente sin hacer Set-Up de nuevo:
                </p>

                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                  Cajas producidas en TU turno (Meta restante: {metaRestanteOrden} u.):
                </label>
                <input
                  type="number"
                  min="0"
                  value={cajasAvanceRelevo}
                  onChange={(e) => setCajasAvanceRelevo(e.target.value)}
                  style={{ width: '100%', padding: '10px', fontSize: '1.4rem', fontWeight: 'bold', textAlign: 'center', borderRadius: '6px', border: '2px solid #0d6efd', boxSizing: 'border-box', marginBottom: '12px' }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => confirmarCierreDeTurno('RELEVO_CONTINUA')}
                    style={{ padding: '14px', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}
                  >
                    🔄 Dejar Orden en Máquina para el Relevo y Cerrar mi Turno
                  </button>

                  <button
                    type="button"
                    onClick={() => confirmarCierreDeTurno('FINALIZAR_ORDEN_TOTAL')}
                    style={{ padding: '12px', backgroundColor: '#198754', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer' }}
                  >
                    ✅ La Orden ya se terminó completa: Finalizar Orden y Cerrar Turno
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '8px', color: '#495057' }}>
                ¿Confirmás el cierre de tu turno en <strong>{maquinaSeleccionada}</strong>?
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setMostrarModalFinTurno(false)}
                style={{ padding: '12px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Volver
              </button>

              {!(produccionActiva && ordenActiva) && (
                <button
                  type="button"
                  onClick={() => confirmarCierreDeTurno('SIN_ORDEN')}
                  style={{ padding: '12px 24px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
                >
                  🔴 Confirmar Fin de Turno
                </button>
              )}
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