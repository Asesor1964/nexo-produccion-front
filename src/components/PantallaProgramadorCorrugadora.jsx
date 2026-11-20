import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';

export default function PantallaProgramadorCorrugadora() {
  const [anchos, setAnchos] = useState([]);
  const [claves, setClaves] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [programas, setProgramas] = useState([]);
  const [papelesStock, setPapelesStock] = useState([]);
  const [origenPedidos, setOrigenPedidos] = useState('');
  const [importandoCSV, setImportandoCSV] = useState(false);
  const [cargando, setCargando] = useState(true);

  // Filtros y Parámetros del Cerebro IA
  const [claveSeleccionada, setClaveSeleccionada] = useState('');
  const [clavesCompatiblesExtra, setClavesCompatiblesExtra] = useState([]);
  const [trimMaxPct, setTrimMaxPct] = useState(5.0);
  const [forzarOrdenId, setForzarOrdenId] = useState('');
  const [forzarAnchoBobina, setForzarAnchoBobina] = useState('');

  // Propuestas calculadas por la IA
  const [propuestasIA, setPropuestasIA] = useState([]);
  const [calculandoIA, setCalculandoIA] = useState(false);

  // 🛠️ MESA DE FORZADO / OVERRIDE MANUAL & PAPEL ALTERNATIVO
  const [modoVista, setModoVista] = useState('IA'); // 'IA' | 'MANUAL' | 'MATRIZ_CLAVES'
  const [bobinaManual, setBobinaManual] = useState(2050);
  const [pistasManuales, setPistasManuales] = useState([]); // [{ orden, salidas }]
  const [metrosManuales, setMetrosManuales] = useState(500);

  // Selector de Papel Ideal vs Papel Alternativo Manual (Reserva de Stock)
  const [usarPapelAlternativo, setUsarPapelAlternativo] = useState(false);
  const [papelAlternativoElegido, setPapelAlternativoElegido] = useState('');
  const [motivoAlternativa, setMotivoAlternativa] = useState('');
  const [habilitarConversionAlAprobar, setHabilitarConversionAlAprobar] = useState(true);

  // Nuevo ancho de bobina para sumar al catálogo
  const [nuevoAnchoInput, setNuevoAnchoInput] = useState('');

  // Edición de Matriz de Equivalencias por Clave (TMC1, TMC5...)
  const [claveEditando, setClaveEditando] = useState(null);
  const [nuevaAlternativaTexto, setNuevaAlternativaTexto] = useState('');

  const cargarContexto = async () => {
    setCargando(true);
    try {
      const res = await apiFetch('/api/corrugadora/contexto');
      if (res.ok) {
        const data = await res.json();
        setAnchos(data.anchos || []);
        setClaves(data.claves || []);
        setPedidos(data.pedidos || []);
        setProgramas(data.programas || []);
        setPapelesStock(data.papeles_stock || []);
        setOrigenPedidos(data.origen_pedidos || '');

        if (!claveSeleccionada && data.claves && data.claves.length > 0) {
          setClaveSeleccionada(data.claves[0].clave);
        }
      }
    } catch (error) {
      console.error('Error cargando contexto de corrugadora:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarContexto();
  }, []);

  const anchosActivos = anchos.filter(a => a.activo).map(a => a.ancho_mm);
  const infoClaveActual = claves.find(c => c.clave === claveSeleccionada) || null;

  // Agregar nuevo ancho de bobina al pañol
  const handleAgregarAncho = async (e) => {
    e.preventDefault();
    const val = parseInt(nuevoAnchoInput, 10);
    if (!val) return;
    try {
      const res = await apiFetch('/api/corrugadora/anchos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ancho_mm: val })
      });
      if (res.ok) {
        setNuevoAnchoInput('');
        cargarContexto();
      }
    } catch (e) {}
  };

  const toggleAnchoBobina = async (id) => {
    try {
      await apiFetch(`/api/corrugadora/anchos/${id}/toggle`, { method: 'PUT' });
      cargarContexto();
    } catch (e) {}
  };

  const handleImportarCSVCorrugadora = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setImportandoCSV(true);

  const parseNumAR = (v) => {
    if (!v) return 0;
    const n = parseFloat(String(v).replace(/"/g, '').replace(/\./g, '').replace(',', '.').trim());
    return isNaN(n) ? 0 : n;
  };

  const procesarTexto = async (textoRaw) => {
    try {
      const texto = String(textoRaw || '').replace(/^\uFEFF/, '');
      const lineas = texto.split(/\r\n|\n/).filter(l => l.trim());
      if (lineas.length < 2) throw new Error('Archivo vacío');

      const header = lineas[0].toLowerCase();

      // 1. Detectar CLAVES.csv
      if (header.includes('liner.ext') && header.includes('clave')) {
        const clavesPayload = lineas.slice(1).map(l => {
          const c = l.split(';');
          return {
            clave: c[0]?.trim(),
            liner_ext_ideal: c[1]?.trim(), liner_ext_gramaje: parseNumAR(c[2]), liner_ext_rct: parseNumAR(c[3]),
            medium_ideal: c[4]?.trim(), onda1_gramaje: parseNumAR(c[5]), onda1_cct: parseNumAR(c[6]),
            liner_int_ideal: c[7]?.trim(), liner_int_gramaje: parseNumAR(c[8]), liner_int_rct: parseNumAR(c[9]),
            onda2_ideal: c[10]?.trim(), onda2_gramaje: parseNumAR(c[11]), onda2_cct: parseNumAR(c[12]),
            entretapa_ideal: c[13]?.trim(), entretapa_gramaje: parseNumAR(c[14]), entretapa_rct: parseNumAR(c[15])
          };
        }).filter(x => x.clave);

        const res = await apiFetch('/api/corrugadora/importar-claves', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claves: clavesPayload })
        });
        const data = await res.json();
        alert(res.ok ? `✅ ${data.mensaje}` : `❌ ${data.error}`);
      }
      // 2. Detectar REGISTRO DE PAPELES.csv o Bobinas.csv
      else if (header.includes('tipo de papel') && header.includes('stock')) {
        const papelesPayload = lineas.slice(1).map(l => {
          const c = l.split(';');
          return {
            codigo: c[0]?.trim(), nombre: c[1]?.trim(), precio_kg: parseNumAR(c[2]),
            fabricante: c[3]?.trim(), proveedor: c[4]?.trim(), color: c[5]?.trim(),
            gramaje: parseNumAR(c[6]), tipo_papel: c[7]?.trim(), punto_pedido_kg: parseNumAR(c[8]),
            stock_kg: parseNumAR(c[9]), valor_stock: parseNumAR(c[10]), fsc: c[11]?.trim()
          };
        }).filter(x => x.codigo);

        const res = await apiFetch('/api/corrugadora/importar-papeles', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ papeles: papelesPayload })
        });
        const data = await res.json();
        alert(res.ok ? `✅ ${data.mensaje}` : `❌ ${data.error}`);
      }
      // 3. Detectar PENDIENTES DE CORRUGADORA.csv
      else if (header.includes('planchas necesarias') || header.includes('corrugado')) {
        const pendientesPayload = lineas.slice(1).map(l => {
          const c = l.split(';');
          return {
            numero_orden: parseInt(String(c[0] || '').replace(/\./g, ''), 10),
            fecha_pedido: c[1]?.trim(), fecha_entrega: c[2]?.trim(), clave_material: c[3]?.trim(),
            ancho_pref_mm: parseNumAR(c[4]) || null, codigo_producto: c[5]?.trim(),
            cliente: c[6]?.trim(), descripcion: c[7]?.trim(),
            largo_mm: parseNumAR(c[8]), ancho_mm: parseNumAR(c[9]),
            cant_pedido: parseNumAR(c[10]), cajas: parseNumAR(c[11]),
            planchas_necesarias: parseNumAR(c[12]), pendiente: parseNumAR(c[13]),
            m2_pendientes: parseNumAR(c[14]),
            primer_pedido: String(c[15] || '').toUpperCase().includes('VERDAD'),
            progr_siguiente: parseNumAR(c[16])
          };
        }).filter(x => x.numero_orden && x.pendiente > 0);

        const res = await apiFetch('/api/corrugadora/importar-pendientes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pendientes: pendientesPayload, reemplazar_cola: true })
        });
        const data = await res.json();
        alert(res.ok ? `✅ ${data.mensaje}` : `❌ ${data.error}`);
      } else {
        alert('⚠️ No se reconoció el formato. Subí CLAVES.csv, REGISTRO DE PAPELES.csv, Bobinas.csv o PENDIENTES DE CORRUGADORA.csv.');
      }
      await cargarContexto();
    } catch (err) {
      alert('❌ Error procesando CSV: ' + err.message);
    } finally {
      setImportandoCSV(false);
      e.target.value = '';
    }
  };

  const reader = new FileReader();
  reader.onload = (ev) => procesarTexto(ev.target.result);
  reader.readAsText(file, 'UTF-8');
};

  // 🧠 EJECUTAR MOTOR DE OPTIMIZACIÓN IA
  const ejecutarCerebroIA = async () => {
    setCalculandoIA(true);
    setModoVista('IA');
    try {
      const res = await apiFetch('/api/corrugadora/optimizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clave_objetivo: claveSeleccionada,
          claves_compatibles: clavesCompatiblesExtra,
          anchos_disponibles: anchosActivos,
          trim_maximo_pct: Number(trimMaxPct) || 5.5,
          forzar_ancho_bobina: forzarAnchoBobina ? Number(forzarAnchoBobina) : null,
          forzar_orden_id: forzarOrdenId ? Number(forzarOrdenId) : null
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPropuestasIA(data.propuestas || []);
      }
    } catch (error) {
      alert('❌ Error al consultar el motor optimizador.');
    } finally {
      setCalculandoIA(false);
    }
  };

  // Cargar una propuesta de la IA en la Mesa Manual para retocarla si se desea
  const llevarPropuestaAMesaManual = (prop) => {
    setBobinaManual(prop.ancho_bobina_mm);
    setMetrosManuales(prop.metros_lineales);
    const pistasMapeadas = prop.pistas.map(p => {
      const ordFull = pedidos.find(x => Number(x.numero_orden) === Number(p.numero_orden)) || p;
      return { orden: ordFull, salidas: p.salidas };
    });
    setPistasManuales(pistasMapeadas);
    setModoVista('MANUAL');
  };

  // Agregar orden a la Mesa Manual
  const agregarOrdenAMesaManual = (ord) => {
    if (pistasManuales.some(p => Number(p.orden.numero_orden) === Number(ord.numero_orden))) return;
    setPistasManuales([...pistasManuales, { orden: ord, salidas: 1 }]);
    setModoVista('MANUAL');
  };

  const cambiarSalidasManual = (idx, delta) => {
    const copia = [...pistasManuales];
    const nueva = Math.max(1, Math.min(6, copia[idx].salidas + delta));
    copia[idx].salidas = nueva;
    setPistasManuales(copia);
  };

  const quitarPistaManual = (idx) => {
    setPistasManuales(pistasManuales.filter((_, i) => i !== idx));
  };

  // Cálculos en vivo de la Mesa Manual
  const anchoOcupadoManual = pistasManuales.reduce((acc, p) => acc + (Number(p.orden.ancho_mm) || 0) * p.salidas, 0);
  const trimManualMm = Number(bobinaManual) - anchoOcupadoManual;
  const trimManualPct = Number(bobinaManual) > 0 ? Number(((trimManualMm / Number(bobinaManual)) * 100).toFixed(2)) : 0;

  // Aprobar y enviar tirada (tanto desde Propuesta IA como desde Mesa Manual)
  const aprobarTirada = async (datosTirada) => {
    if (usarPapelAlternativo && !papelAlternativoElegido.trim()) {
      alert('⚠️ Indicá qué papel/gramaje alternativo vas a utilizar o destildá la opción de papel alternativo.');
      return;
    }

    const papelFinal = usarPapelAlternativo
      ? `ALTERNATIVO: ${papelAlternativoElegido.trim()}`
      : `IDEAL (${datosTirada.clave_material}): ${infoClaveActual?.liner_ext_ideal || 'Estándar'}`;

    const confirmar = window.confirm(
      `🚀 ¿Confirmás programar esta tirada en Corrugadora?\n\n` +
      `• Bobina Madre: ${datosTirada.ancho_bobina_mm} mm\n` +
      `• Trim / Refile: ${datosTirada.trim_mm} mm (${datosTirada.trim_porcentaje}%)\n` +
      `• Corrida: ${datosTirada.metros_lineales} metros lineales\n` +
      `• Papel: ${papelFinal}`
    );
    if (!confirmar) return;

    try {
      const res = await apiFetch('/api/corrugadora/aprobar-tirada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...datosTirada,
          papel_utilizado: papelFinal,
          es_alternativa_manual: usarPapelAlternativo,
          motivo_alternativa: motivoAlternativa,
          habilitar_en_conversion: habilitarConversionAlAprobar
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.mensaje}`);
        setUsarPapelAlternativo(false);
        setMotivoAlternativa('');
        cargarContexto();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      alert('❌ Error de conexión con el servidor.');
    }
  };

  // Guardar Matriz de Equivalencias de Clave
  const guardarMatrizClave = async (e) => {
    e.preventDefault();
    if (!claveEditando) return;
    try {
      const res = await apiFetch(`/api/corrugadora/claves/${encodeURIComponent(claveEditando.clave)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(claveEditando)
      });
      if (res.ok) {
        alert(`✅ Matriz de papeles y alternativas guardada para la clave ${claveEditando.clave}.`);
        setClaveEditando(null);
        cargarContexto();
      }
    } catch (e) {}
  };

  const pedidosFiltradosClave = pedidos.filter(p => {
    if (!claveSeleccionada) return true;
    return p.clave_material === claveSeleccionada || clavesCompatiblesExtra.includes(p.clave_material);
  });

  const colorTrim = (pct) => {
    if (pct < 0) return '#dc2626';
    if (pct <= 2.5) return '#059669';
    if (pct <= 4.5) return '#d97706';
    return '#dc2626';
  };

  return (
    <div style={{ padding: '1.2rem 1.5rem', maxWidth: '1480px', margin: '0 auto', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
      
      {/* CABECERA DEDICADA CORRUGADORA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '3px solid #7c3aed', paddingBottom: '10px', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '2.4rem' }}>🧠</span>
          <div>
            <h2 style={{ margin: 0, color: '#4c1d95', fontSize: '1.8rem' }}>Cerebro de Programación — Línea Corrugadora</h2>
            <small style={{ color: '#64748b', fontWeight: 'bold' }}>
              Optimización de Anchos de Bobina, Trim Ideal, Claves de Material (TMC) y Sustitución Manual por Reserva de Stock
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setModoVista('IA')}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: '2px solid #7c3aed',
              backgroundColor: modoVista === 'IA' ? '#7c3aed' : '#fff',
              color: modoVista === 'IA' ? '#fff' : '#7c3aed',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🤖 Sugerencias IA (Trim)
          </button>
          <button
            onClick={() => setModoVista('MANUAL')}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: '2px solid #0284c7',
              backgroundColor: modoVista === 'MANUAL' ? '#0284c7' : '#fff',
              color: modoVista === 'MANUAL' ? '#fff' : '#0284c7',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🛠️ Mesa Manual / Override ({pistasManuales.length})
          </button>
          <button
            onClick={() => {
              setClaveEditando(infoClaveActual || claves[0] || null);
              setModoVista('MATRIZ_CLAVES');
            }}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: '2px solid #d97706',
              backgroundColor: modoVista === 'MATRIZ_CLAVES' ? '#d97706' : '#fff',
              color: modoVista === 'MATRIZ_CLAVES' ? '#fff' : '#b45309',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >

          <label style={{
            padding: '9px 14px', borderRadius: '8px', backgroundColor: '#0f766e', color: '#fff',
            fontWeight: 'bold', cursor: 'pointer', fontSize: '0.86rem'
          }}>
            {importandoCSV ? '⏳ Importando...' : '📥 Importar CSV (Claves / Papeles / Pendientes)'}
            <input type="file" accept=".csv" disabled={importandoCSV} onChange={handleImportarCSVCorrugadora} style={{ display: 'none' }} />
            </label>

            📜 Matriz Claves y Gramajes
          </button>
        </div>
      </div>

      {/* BARRA DE BOBINAS DISPONIBLES EN PAÑOL */}
      <div style={{ backgroundColor: '#fff', padding: '12px 16px', borderRadius: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', marginBottom: '1.2rem', borderLeft: '5px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>🧻 Formatos de Bobina Activos:</strong>
          {anchos.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleAnchoBobina(a.id)}
              style={{
                padding: '5px 11px',
                borderRadius: '20px',
                border: a.activo ? '2px solid #0f172a' : '1px solid #cbd5e1',
                backgroundColor: a.activo ? '#0f172a' : '#f1f5f9',
                color: a.activo ? '#38bdf8' : '#64748b',
                fontWeight: 'bold',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
              title="Clic para activar/desactivar este ancho según stock de bobinas"
            >
              {a.activo ? '✓ ' : ''}{a.ancho_mm} mm
            </button>
          ))}
        </div>

        <form onSubmit={handleAgregarAncho} style={{ display: 'flex', gap: '6px' }}>
          <input
            type="number"
            min="600"
            max="3200"
            placeholder="+ Ancho mm (ej. 2200)"
            value={nuevoAnchoInput}
            onChange={(e) => setNuevoAnchoInput(e.target.value)}
            style={{ width: '155px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
          />
          <button
            type="submit"
            style={{ padding: '6px 12px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.82rem', cursor: 'pointer' }}
          >
            + Sumar Formato
          </button>
        </form>
      </div>

      {/* VISTA 3: MATRIZ DE EQUIVALENCIAS DE CLAVES Y PAPELES */}
      {modoVista === 'MATRIZ_CLAVES' && (
        <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.06)', borderTop: '5px solid #d97706', marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0, color: '#92400e' }}>📜 Configuración de Claves de Material (TMC) y Papeles Alternativos Aprobados</h3>
          <p style={{ fontSize: '0.88rem', color: '#475569' }}>
            Definí la receta ideal de cada clave y cargá qué combinaciones de papel/gramaje alternativo cumplen técnicamente cuando reservamos el papel ideal para otro producto.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
            <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '1rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {claves.map(c => (
                <button
                  key={c.clave}
                  onClick={() => setClaveEditando(c)}
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    borderRadius: '6px',
                    border: claveEditando?.clave === c.clave ? '2px solid #d97706' : '1px solid #cbd5e1',
                    backgroundColor: claveEditando?.clave === c.clave ? '#fef3c7' : '#f8fafc',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {c.clave} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({c.onda || 'Onda C'})</span>
                </button>
              ))}
            </div>

            {claveEditando && (
              <form onSubmit={guardarMatrizClave}>
                <h4 style={{ marginTop: 0 }}>Editando Clave: <span style={{ color: '#d97706' }}>{claveEditando.clave}</span></h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Tipo Onda:</label>
                    <select
                      value={claveEditando.onda || 'C'}
                      onChange={e => setClaveEditando({ ...claveEditando, onda: e.target.value })}
                      style={{ width: '100%', padding: '7px' }}
                    >
                      <option value="B">Onda B</option>
                      <option value="C">Onda C</option>
                      <option value="CB">Doble Onda CB</option>
                      <option value="E">Micro Onda E</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Liner Exterior Ideal:</label>
                    <input
                      type="text"
                      value={claveEditando.liner_ext_ideal || ''}
                      onChange={e => setClaveEditando({ ...claveEditando, liner_ext_ideal: e.target.value })}
                      placeholder="Ej: Kraft 150g"
                      style={{ width: '100%', padding: '7px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Onda / Medium Ideal:</label>
                    <input
                      type="text"
                      value={claveEditando.medium_ideal || ''}
                      onChange={e => setClaveEditando({ ...claveEditando, medium_ideal: e.target.value })}
                      placeholder="Ej: Semiquímico 120g"
                      style={{ width: '100%', padding: '7px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Liner Interior Ideal:</label>
                    <input
                      type="text"
                      value={claveEditando.liner_int_ideal || ''}
                      onChange={e => setClaveEditando({ ...claveEditando, liner_int_ideal: e.target.value })}
                      placeholder="Ej: Testliner 140g"
                      style={{ width: '100%', padding: '7px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '12px' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                    🔄 Papeles / Gramajes Alternativos Aprobados por Stock (para reservar el ideal):
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Ej: Kraft 165g + Onda 125g + Kraft 150g (Mayor resistencia)"
                      value={nuevaAlternativaTexto}
                      onChange={e => setNuevaAlternativaTexto(e.target.value)}
                      style={{ flex: 1, padding: '7px', borderRadius: '5px', border: '1px solid #ccc' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!nuevaAlternativaTexto.trim()) return;
                        const prev = Array.isArray(claveEditando.alternativas_aprobadas) ? claveEditando.alternativas_aprobadas : [];
                        setClaveEditando({ ...claveEditando, alternativas_aprobadas: [...prev, nuevaAlternativaTexto.trim()] });
                        setNuevaAlternativaTexto('');
                      }}
                      style={{ padding: '7px 14px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      + Agregar Alternativa
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(Array.isArray(claveEditando.alternativas_aprobadas) ? claveEditando.alternativas_aprobadas : []).map((alt, i) => (
                      <span key={i} style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {alt}
                        <button
                          type="button"
                          onClick={() => {
                            const filtradas = claveEditando.alternativas_aprobadas.filter((_, idx) => idx !== i);
                            setClaveEditando({ ...claveEditando, alternativas_aprobadas: filtradas });
                          }}
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          ✖
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  style={{ padding: '10px 20px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  💾 Guardar Configuración de Clave {claveEditando.clave}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* GRILLA PRINCIPAL DE TRABAJO (2 COLUMNAS: PEDIDOS POR CLAVE | MOTOR IA & MESA MANUAL) */}
      {modoVista !== 'MATRIZ_CLAVES' && (
        <div style={{ display: 'grid', gridTemplateColumns: '430px 1fr', gap: '1.4rem', alignItems: 'start' }}>
          
          {/* COLUMNA IZQUIERDA: PEDIDOS PENDIENTES AGRUPADOS POR CLAVE */}
          <div style={{ backgroundColor: '#fff', padding: '1.2rem', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.06)', borderTop: '5px solid #7c3aed' }}>
            <h4 style={{ marginTop: 0, marginBottom: '8px', color: '#4c1d95' }}>1. Pedidos Pendientes por Clave</h4>
            
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {claves.map(c => {
                const count = pedidos.filter(p => p.clave_material === c.clave).length;
                return (
                  <button
                    key={c.clave}
                    onClick={() => setClaveSeleccionada(c.clave)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: claveSeleccionada === c.clave ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                      backgroundColor: claveSeleccionada === c.clave ? '#ede9fe' : '#f8fafc',
                      color: claveSeleccionada === c.clave ? '#5b21b6' : '#334155',
                      fontWeight: 'bold',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    {c.clave} ({count})
                  </button>
                );
              })}
            </div>

            {infoClaveActual && (
              <div style={{ backgroundColor: '#f5f3ff', padding: '8px 10px', borderRadius: '6px', fontSize: '0.78rem', marginBottom: '10px', border: '1px solid #ddd6fe' }}>
                <strong>Receta Ideal {infoClaveActual.clave}:</strong> {infoClaveActual.liner_ext_ideal} / {infoClaveActual.medium_ideal} / {infoClaveActual.liner_int_ideal}
              </div>
            )}

            <div style={{ maxHeight: '560px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cargando ? (
                <p style={{ color: '#64748b', textAlign: 'center' }}>Cargando pedidos...</p>
              ) : pedidosFiltradosClave.length === 0 ? (
                <p style={{ color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>No hay pedidos pendientes para esta clave.</p>
              ) : (
                pedidosFiltradosClave.map(ord => (
                  <div
                    key={ord.numero_orden}
                    style={{
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#fff',
                      fontSize: '0.82rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#1e40af', fontSize: '0.92rem' }}>#{ord.numero_orden} · {ord.clave_material}</strong>
                      <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.75rem' }}>
                        {ord.ancho_mm} × {ord.largo_mm} mm
                      </span>
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#1e293b', marginTop: '2px' }}>{ord.cliente}</div>
                    <div style={{ color: '#64748b', fontSize: '0.76rem' }}>{ord.producto_descripcion}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #e2e8f0' }}>
                      <span>Planchas: <strong>{ord.planchas_necesarias}</strong> ({ord.cantidad_pendiente} caj.)</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setForzarOrdenId(String(ord.numero_orden));
                            ejecutarCerebroIA();
                          }}
                          style={{ padding: '3px 7px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer' }}
                          title="Pedir a la IA combinaciones que incluyan esta orden"
                        >
                          🧠 Combinar
                        </button>
                        <button
                          type="button"
                          onClick={() => agregarOrdenAMesaManual(ord)}
                          style={{ padding: '3px 7px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer' }}
                          title="Enviar a la Mesa Manual para armar tirada a dedo"
                        >
                          + Mesa
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA: CEREBRO IA / MESA MANUAL + SUSTITUCIÓN DE PAPEL */}
          <div style={{ backgroundColor: '#fff', padding: '1.4rem', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.06)', borderTop: `5px solid ${modoVista === 'IA' ? '#7c3aed' : '#0284c7'}` }}>
            
            {/* PANEL DE OVERRIDE DE PAPEL (RESERVA DE STOCK) SIEMPRE ACCESIBLE */}
            <div style={{ backgroundColor: usarPapelAlternativo ? '#fffbeb' : '#f8fafc', border: usarPapelAlternativo ? '2px solid #f59e0b' : '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <label style={{ fontWeight: 'bold', color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={usarPapelAlternativo}
                    onChange={(e) => setUsarPapelAlternativo(e.target.checked)}
                  />
                  🔄 Usar Papel / Gramaje Alternativo Manual (reservar el papel ideal para otro producto)
                </label>

                <label style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#065f46', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={habilitarConversionAlAprobar}
                    onChange={(e) => setHabilitarConversionAlAprobar(e.target.checked)}
                  />{' '}
                  Habilitar órdenes en Conversión al aprobar
                </label>
              </div>

              {usarPapelAlternativo && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #f59e0b' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                      Papel / Gramaje Alternativo a Consumir:
                    </label>
                    <input
                      type="text"
                      list="lista-alternativas-clave"
                      placeholder="Elegí o escribí papel (ej. Kraft 165g + Onda 125g)..."
                      value={papelAlternativoElegido}
                      onChange={(e) => setPapelAlternativoElegido(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #f59e0b', boxSizing: 'border-box', fontWeight: 'bold' }}
                    />
                    <datalist id="lista-alternativas-clave">
                      {(infoClaveActual?.alternativas_aprobadas || []).map((alt, idx) => (
                        <option key={idx} value={alt} />
                      ))}
                      {papelesStock.map((pap) => (
                        <option key={pap.codigo} value={`${pap.codigo} — ${pap.nombre} (${Math.round(pap.stock_kg)} kg disp.)`} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                      Motivo / Reserva de Stock (Auditoría):
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Reservamos Kraft 150g para pedido exportación..."
                      value={motivoAlternativa}
                      onChange={(e) => setMotivoAlternativa(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* MODO 1: SUGERENCIAS DE LA IA */}
            {modoVista === 'IA' && (
              <>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'end', flexWrap: 'wrap', marginBottom: '1.2rem', backgroundColor: '#f5f3ff', padding: '12px', borderRadius: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Trim Máx (%):</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="15"
                      value={trimMaxPct}
                      onChange={(e) => setTrimMaxPct(e.target.value)}
                      style={{ width: '85px', padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Forzar Bobina (Opcional):</label>
                    <select
                      value={forzarAnchoBobina}
                      onChange={(e) => setForzarAnchoBobina(e.target.value)}
                      style={{ padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
                    >
                      <option value="">-- Todas las activas --</option>
                      {anchosActivos.map(a => <option key={a} value={a}>{a} mm</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Incluir Orden # (Opcional):</label>
                    <input
                      type="number"
                      placeholder="Ej: 48341"
                      value={forzarOrdenId}
                      onChange={(e) => setForzarOrdenId(e.target.value)}
                      style={{ width: '110px', padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={ejecutarCerebroIA}
                    disabled={calculandoIA}
                    style={{
                      padding: '9px 18px',
                      backgroundColor: '#7c3aed',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '0.92rem'
                    }}
                  >
                    {calculandoIA ? '⏳ Calculando Trim...' : '⚡ Calcular Combinaciones Óptimas'}
                  </button>
                </div>

                {propuestasIA.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🤖</div>
                    <h4 style={{ margin: '0 0 6px 0', color: '#334155' }}>Listo para optimizar la clave {claveSeleccionada}</h4>
                    <p style={{ margin: 0, fontSize: '0.88rem' }}>
                      Presioná <strong>"Calcular Combinaciones Óptimas"</strong> para que el motor cruce anchos de bobina, salidas en slitter y metros de corrida.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {propuestasIA.map((prop, idx) => (
                      <div key={idx} style={{ border: '2px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', backgroundColor: idx === 0 ? '#f0fdf4' : '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ backgroundColor: '#4c1d95', color: '#fff', padding: '3px 9px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                              Score IA: {prop.score_ia}/100
                            </span>
                            <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                              Bobina {prop.ancho_bobina_mm} mm
                            </strong>
                            <span style={{ color: colorTrim(prop.trim_porcentaje), fontWeight: 'bold', fontSize: '0.9rem' }}>
                              · Trim: {prop.trim_mm} mm ({prop.trim_porcentaje}%)
                            </span>
                            <span style={{ color: '#0284c7', fontWeight: 'bold', fontSize: '0.9rem' }}>
                              · Corrida: {prop.metros_lineales} mts
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => llevarPropuestaAMesaManual(prop)}
                              style={{ padding: '6px 10px', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #0284c7', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}
                            >
                              ✏️ Retocar en Mesa
                            </button>
                            <button
                              type="button"
                              onClick={() => aprobarTirada(prop)}
                              style={{ padding: '6px 14px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.82rem', cursor: 'pointer' }}
                            >
                              🚀 Aprobar Tirada
                            </button>
                          </div>
                        </div>

                        {/* Barra visual de ocupación del ancho de bobina */}
                        <div style={{ width: '100%', height: '22px', backgroundColor: '#fee2e2', borderRadius: '6px', overflow: 'hidden', display: 'flex', marginBottom: '8px', border: '1px solid #cbd5e1' }}>
                          {prop.pistas.map((p, iP) => {
                            const pctAncho = (p.ancho_ocupado_mm / prop.ancho_bobina_mm) * 100;
                            return (
                              <div
                                key={iP}
                                style={{
                                  width: `${pctAncho}%`,
                                  backgroundColor: iP === 0 ? '#2563eb' : '#0d9488',
                                  color: '#fff',
                                  fontSize: '0.74rem',
                                  fontWeight: 'bold',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRight: '2px solid #fff'
                                }}
                              >
                                #{p.numero_orden} ({p.salidas}×{p.ancho_mm}mm)
                              </div>
                            );
                          })}
                          <div style={{ flex: 1, fontSize: '0.7rem', color: '#991b1b', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {prop.trim_mm}mm
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px', fontSize: '0.8rem' }}>
                          {prop.pistas.map((p, iP) => (
                            <div key={iP} style={{ backgroundColor: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              <strong>OP #{p.numero_orden}</strong> ({p.cliente}) — {p.salidas} salida(s) · <strong>{p.planchas_tirada}</strong> planchas ({p.cumplimiento_pct}% del pedido)
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* MODO 2: MESA MANUAL / OVERRIDE DEL PROGRAMADOR */}
            {modoVista === 'MANUAL' && (
              <div>
                <h4 style={{ marginTop: 0, color: '#0369a1' }}>🛠️ Mesa Manual de Combinación de Bobina y Pistas</h4>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem', backgroundColor: '#f0f9ff', padding: '12px', borderRadius: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block' }}>Bobina Madre (mm):</label>
                    <select
                      value={bobinaManual}
                      onChange={e => setBobinaManual(Number(e.target.value))}
                      style={{ padding: '8px', borderRadius: '5px', border: '2px solid #0284c7', fontWeight: 'bold', fontSize: '1rem' }}
                    >
                      {anchos.map(a => <option key={a.id} value={a.ancho_mm}>{a.ancho_mm} mm</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block' }}>Metros Lineales a Correr:</label>
                    <input
                      type="number"
                      min="10"
                      value={metrosManuales}
                      onChange={e => setMetrosManuales(Number(e.target.value))}
                      style={{ width: '120px', padding: '8px', borderRadius: '5px', border: '1px solid #0284c7', fontWeight: 'bold', fontSize: '1rem' }}
                    />
                  </div>

                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.82rem', color: '#475569', display: 'block' }}>Ancho Ocupado: <strong>{anchoOcupadoManual} / {bobinaManual} mm</strong></span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: colorTrim(trimManualPct) }}>
                      {trimManualMm < 0 ? `❌ EXCEDE ANCHO POR ${Math.abs(trimManualMm)} mm` : `Trim Resultante: ${trimManualMm} mm (${trimManualPct}%)`}
                    </span>
                  </div>
                </div>

                {pistasManuales.length === 0 ? (
                  <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem', border: '2px dashed #cbd5e1', borderRadius: '8px' }}>
                    Hacé clic en <strong>"+ Mesa"</strong> en cualquier pedido de la columna izquierda para armar tu combinación manual.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
                    {pistasManuales.map((pm, idx) => {
                      const planchasTirada = Math.floor((metrosManuales * 1000) / (pm.orden.largo_mm || 1000)) * pm.salidas;
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                          <div>
                            <strong>#{pm.orden.numero_orden}</strong> · {pm.orden.cliente} ({pm.orden.ancho_mm}×{pm.orden.largo_mm} mm · Clave {pm.orden.clave_material})
                            <div style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 'bold' }}>
                              Produce {planchasTirada} planchas en {metrosManuales} mts
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button type="button" onClick={() => cambiarSalidasManual(idx, -1)} style={{ padding: '4px 9px', fontWeight: 'bold' }}>-</button>
                            <strong>{pm.salidas} salida(s) = {pm.orden.ancho_mm * pm.salidas} mm</strong>
                            <button type="button" onClick={() => cambiarSalidasManual(idx, 1)} style={{ padding: '4px 9px', fontWeight: 'bold' }}>+</button>
                            <button type="button" onClick={() => quitarPistaManual(idx)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 'bold', cursor: 'pointer', marginLeft: '6px' }}>✖</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {pistasManuales.length > 0 && trimManualMm >= 0 && (
                  <button
                    type="button"
                    onClick={() => aprobarTirada({
                      clave_material: pistasManuales[0].orden.clave_material,
                      ancho_bobina_mm: bobinaManual,
                      ancho_utilizado_mm: anchoOcupadoManual,
                      trim_mm: trimManualMm,
                      trim_porcentaje: trimManualPct,
                      metros_lineales: metrosManuales,
                      pistas: pistasManuales.map(pm => ({
                        numero_orden: pm.orden.numero_orden,
                        cliente: pm.orden.cliente,
                        ancho_mm: pm.orden.ancho_mm,
                        largo_mm: pm.orden.largo_mm,
                        salidas: pm.salidas,
                        ancho_ocupado_mm: pm.orden.ancho_mm * pm.salidas,
                        planchas_tirada: Math.floor((metrosManuales * 1000) / (pm.orden.largo_mm || 1000)) * pm.salidas
                      }))
                    })}
                    style={{ width: '100%', padding: '12px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}
                  >
                    🚀 Aprobar Tirada Manual y Enviar a Corrugadora
                  </button>
                )}
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}