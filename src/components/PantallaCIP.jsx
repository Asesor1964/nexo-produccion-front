import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api'; // 👈 IMPORTACIÓN CENTRALIZADA

// Nómina oficial de Supervisores de Planta
const LISTA_SUPERVISORES = [
  "OLEA JULIO",
  "MARTINEZ ELVIO",
  "CRUZ WALTER",
  "SERGIO SANCHEZ"
];

// Los 69 colores oficiales extraídos de Maestro_Productos.csv (ordenados por frecuencia en planta)
export const CATALOGO_COLORES_MAESTRO = [
  "SIN IMPRESION / VACIO",
  "GCMI 90", "GCMI 75", "GCMI 10", "GCMI 39", "GCMI 25", 
  "GCMI 29", "GCMI 24", "GCMI 81", "GCMI 394", "GCMI 2081", 
  "GCMI 387", "GCMI 609", "GCMI 908", "GCMI 13", "MAGENTA", 
  "GCMI 103", "PU 2746", "GCMI 31", "GCMI 52", "AMA PROC", 
  "GCMI 91", "NEGRO PREMIUM", "GCMI 49", "GCMI 2110", "CYAN PROC", 
  "GCMI 80", "GCMI 970", "NEG FOTOCROMO", "GCMI 21", "PU 2685", 
  "GCMI 50", "GCMI 2014", "GCMI 9002", "CEL LED", "GCMI 984", 
  "GCMI 388", "GCMI 76", "GCMI 73", "PU 427", "GCMI 33", 
  "GCMI 74", "GCMI 30", "PU 7458", "GCMI 11", "PU 3945", 
  "GCMI 900", "GCMI 40", "GCMI 3213", "COOL GRAY 2", "AZUL FOTOCROMO", 
  "PU 315", "GCMI 978", "BARNIZ", "PU 587", "VER LIM", 
  "GCMI 517", "GCMI 20", "VIOLETA", "CYAN", "GCMI 3086", 
  "GCMI 918", "PU 208", "PU 7489", "PU 464", "PU 7473", 
  "GRIS FECOVITA", "PU 376", "PU 2567", "PU 2757"
];

export default function PantallaCIP({
  ordenActiva,
  operador,
  maquina,
  onCerrar,
  datosCIP,
  setDatosCIP,
  verificacion,
  setVerificacion,
  inspeccionPaquetes,
  setInspeccionPaquetes
}) {
  const [guardando, setGuardando] = useState(false);

  // Autocompletar colores desde ordenActiva.colores si la planilla está en blanco
  useEffect(() => {
    if (!ordenActiva?.colores) return;
    const sinTintasCargadas =
      !datosCIP.tinta1Color &&
      !datosCIP.tinta2Color &&
      !datosCIP.tinta3Color &&
      !datosCIP.tinta4Color &&
      !datosCIP.tinta5Color &&
      !datosCIP.tinta6Color;

    if (sinTintasCargadas) {
      const coloresReceta = String(ordenActiva.colores)
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      if (coloresReceta.length > 0) {
        setDatosCIP((prev) => ({
          ...prev,
          tinta1Color: coloresReceta[0] || '',
          tinta2Color: coloresReceta[1] || '',
          tinta3Color: coloresReceta[2] || '',
          tinta4Color: coloresReceta[3] || '',
          tinta5Color: coloresReceta[4] || '',
          tinta6Color: coloresReceta[5] || ''
        }));
      }
    }
  }, [ordenActiva, datosCIP.tinta1Color, datosCIP.tinta2Color, datosCIP.tinta3Color, datosCIP.tinta4Color, datosCIP.tinta5Color, datosCIP.tinta6Color, setDatosCIP]);

  const actualizarPaquete = (index, campo, valor) => {
    const nuevaMatriz = [...inspeccionPaquetes];
    nuevaMatriz[index][campo] = valor;
    setInspeccionPaquetes(nuevaMatriz);
  };

  const handleCellClick = (index, campo) => {
    if (!inspeccionPaquetes[index][campo]) {
      actualizarPaquete(index, campo, 'OK');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ordenActiva) return;

    setGuardando(true);
    try {
      const respuesta = await apiFetch('/api/cip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_orden: ordenActiva.numero_orden,
          operador: operador || 'Operador Planta',
          supervisor: datosCIP.supervisor,
          turno: datosCIP.turno,
          maquina: maquina || 'IMP-JS',
          tipo_onda: datosCIP.tipoOnda,
          tipo_chapeton: datosCIP.chapeton,
          hendido_desplazado: datosCIP.hendidoDesplazado,
          liner_externo: datosCIP.linerExterno,
          tipo_cierre: datosCIP.tipoCierre,
          tintas_detalle: {
            tinta1: { color: datosCIP.tinta1Color, lote: datosCIP.tinta1Lote },
            tinta2: { color: datosCIP.tinta2Color, lote: datosCIP.tinta2Lote },
            tinta3: { color: datosCIP.tinta3Color, lote: datosCIP.tinta3Lote },
            tinta4: { color: datosCIP.tinta4Color, lote: datosCIP.tinta4Lote },
            tinta5: { color: datosCIP.tinta5Color, lote: datosCIP.tinta5Lote },
            tinta6: { color: datosCIP.tinta6Color, lote: datosCIP.tinta6Lote }
          },
          verificacion_items: verificacion,
          inspeccion_paquetes: inspeccionPaquetes,
          observaciones: datosCIP.observaciones
        })
      });

      if (respuesta.ok) {
        alert("✅ Protocolo CIP (RE-PRO 009) guardado correctamente en la base de datos.");
        if (onCerrar) onCerrar();
      } else {
        alert("⚠️ Error al guardar el protocolo CIP en el servidor.");
      }
    } catch (error) {
      console.error("Error de red al guardar CIP:", error);
      alert("❌ Error de conexión con el backend.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#fff', padding: '2rem', maxWidth: '1000px', margin: '0 auto', border: '2px solid #333', fontFamily: 'Arial, sans-serif', color: '#000', textAlign: 'left', borderRadius: '8px' }}>
      
      <div style={{ border: '2px solid #000', padding: '10px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem' }}>CONTROL DE PROCESO DE CONVERSIÓN</h2>
          <small style={{ fontWeight: 'bold' }}>RE-PRO 009 Rev.01 | Vigencia: 22/11/2017</small>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.85rem', border: '1px solid #000', padding: '4px 8px', backgroundColor: '#fff' }}>REGISTRO A4</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '15px', fontSize: '0.9rem', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
          <div><strong>OPERADOR:</strong><br/>{operador || 'No asignado'}</div>
          <div>
            <strong>SUPERVISOR:</strong><br/>
            <select
              required
              value={datosCIP.supervisor || ''}
              onChange={(e) => setDatosCIP({ ...datosCIP, supervisor: e.target.value })}
              style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #495057', backgroundColor: '#fff', fontWeight: 'bold' }}
            >
              <option value="" disabled>-- Seleccione Supervisor --</option>
              {LISTA_SUPERVISORES.map((sup, idx) => (
                <option key={idx} value={sup}>{sup}</option>
              ))}
            </select>
          </div>
          <div>
            <strong>TURNO:</strong><br/>
            <select value={datosCIP.turno} onChange={e=>setDatosCIP({...datosCIP, turno: e.target.value})} style={{width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #495057'}}>
              <option value="M">Mañana (M)</option>
              <option value="T">Tarde (T)</option>
              <option value="N">Noche (N)</option>
            </select>
          </div>
          <div><strong>MÁQUINA:</strong><br/>{maquina || 'Sin máquina'}</div>
        </div>

        <div style={{ backgroundColor: '#e9ecef', padding: '12px', marginBottom: '15px', border: '1px solid #ced4da', fontSize: '0.95rem', borderRadius: '4px' }}>
          <p style={{ margin: '0 0 5px 0' }}><strong>Pedido N°:</strong> {ordenActiva?.numero_orden || 'S/N'} | <strong>Cliente:</strong> {ordenActiva?.cliente || 'Cliente General'}</p>
          <p style={{ margin: 0 }}><strong>Descripción Producto:</strong> {ordenActiva?.producto_descripcion || ordenActiva?.descripcion || 'Caja corrugada estándar'}</p>
          {ordenActiva?.colores && (
            <p style={{ margin: '6px 0 0 0', color: '#0056b3', fontWeight: 'bold' }}>
              🎨 Receta Maestro de Productos: {ordenActiva.colores}
            </p>
          )}
        </div>

        <div style={{ border: '1px solid #000', marginBottom: '15px', padding: '12px' }}>
          <h4 style={{ margin: '0 0 10px 0', backgroundColor: '#343a40', color: '#fff', padding: '6px', fontSize: '1rem' }}>CONTROLES AL INICIO DE LA PRODUCCIÓN</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '0.9rem', marginBottom: '10px' }}>
            <div>
              <label><strong>Tipo de Onda:</strong></label>
              <select value={datosCIP.tipoOnda} onChange={e=>setDatosCIP({...datosCIP, tipoOnda: e.target.value})} style={{width:'100%', padding: '5px'}}>
                <option value="B">Onda B</option>
                <option value="C">Onda C</option>
                <option value="CB">Onda CB</option>
                <option value="E">Onda E</option>
              </select>
            </div>
            <div>
              <label><strong>Tipo de Cierre:</strong></label>
              <select value={datosCIP.tipoCierre} onChange={e=>setDatosCIP({...datosCIP, tipoCierre: e.target.value})} style={{width:'100%', padding: '5px'}}>
                <option value="Pegado">Pegado</option>
                <option value="Abrochado">Abrochado</option>
              </select>
            </div>
            <div>
              <label><strong>Liner Externo:</strong></label>
              <select value={datosCIP.linerExterno} onChange={e=>setDatosCIP({...datosCIP, linerExterno: e.target.value})} style={{width:'100%', padding: '5px'}}>
                <option value="Kraft">Kraft</option>
                <option value="Blanco">Blanco</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ border: '1px solid #000', marginBottom: '15px', padding: '12px' }}>
          <h4 style={{ margin: '0 0 10px 0', backgroundColor: '#343a40', color: '#fff', padding: '6px', fontSize: '1rem' }}>PROVEEDOR Y CÓDIGO DE TINTAS (6 Bloques)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '0.85rem' }}>
            {[1, 2, 3, 4, 5, 6].map(num => {
              const valorActual = datosCIP[`tinta${num}Color`] || '';
              // Si por receta viene un color que no esté en el array base, lo incluimos dinámicamente para no perderlo
              const opcionesColor = valorActual && !CATALOGO_COLORES_MAESTRO.includes(valorActual)
                ? [valorActual, ...CATALOGO_COLORES_MAESTRO]
                : CATALOGO_COLORES_MAESTRO;

              return (
                <div key={num} style={{ border: '1px solid #ddd', padding: '8px', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
                  <label><strong>{num}° Color:</strong></label>
                  <select
                    value={valorActual}
                    onChange={e => setDatosCIP({ ...datosCIP, [`tinta${num}Color`]: e.target.value })}
                    style={{ width: '100%', padding: '6px', marginBottom: '6px', borderRadius: '4px', border: '1px solid #adb5bd', backgroundColor: '#fff', fontWeight: valorActual ? 'bold' : 'normal' }}
                  >
                    <option value="">-- Color / Tacho --</option>
                    {opcionesColor.map((col, idx) => (
                      <option key={idx} value={col}>{col}</option>
                    ))}
                  </select>

                  <label><strong>Lote {num}:</strong></label>
                  <input
                    type="text"
                    placeholder="N° Lote"
                    value={datosCIP[`tinta${num}Lote`] || ''}
                    onChange={e => setDatosCIP({ ...datosCIP, [`tinta${num}Lote`]: e.target.value })}
                    style={{ width: '100%', padding: '5px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #adb5bd' }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ border: '1px solid #000', marginBottom: '15px', padding: '12px' }}>
          <h4 style={{ margin: '0 0 10px 0', backgroundColor: '#343a40', color: '#fff', padding: '6px', fontSize: '1rem' }}>¿CONTROLÓ USTED? (Verificación de Arranque)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.9rem' }}>
            <label><input type="checkbox" checked={verificacion.troquelClises} onChange={e=>setVerificacion({...verificacion, troquelClises: e.target.checked})} /> Verificar Troquel y clises en el boceto</label>
            <label><input type="checkbox" checked={verificacion.coloresBoceto} onChange={e=>setVerificacion({...verificacion, coloresBoceto: e.target.checked})} /> Verificar Colores en el Boceto</label>
            <label><input type="checkbox" checked={verificacion.medidasPlancha} onChange={e=>setVerificacion({...verificacion, medidasPlancha: e.target.checked})} /> Las medidas de la plancha</label>
            <label><input type="checkbox" checked={verificacion.ubicacionJaladores} onChange={e=>setVerificacion({...verificacion, ubicacionJaladores: e.target.checked})} /> La ubicación de jaladores</label>
            <label><input type="checkbox" checked={verificacion.aperturaRodillo} onChange={e=>setVerificacion({...verificacion, aperturaRodillo: e.target.checked})} /> Apertura rodillo de alimentación</label>
            <label><input type="checkbox" checked={verificacion.ubicacionCuchillas} onChange={e=>setVerificacion({...verificacion, ubicacionCuchillas: e.target.checked})} /> La ubicación de las cuchillas</label>
            <label><input type="checkbox" checked={verificacion.presionesImpision} onChange={e=>setVerificacion({...verificacion, presionesImpision: e.target.checked})} /> Presiones rodillos de impresión</label>
            <label><input type="checkbox" checked={verificacion.limpiezaCortes} onChange={e=>setVerificacion({...verificacion, limpiezaCortes: e.target.checked})} /> La limpieza de los cortes</label>
            <label><input type="checkbox" checked={verificacion.sentidoOnda} onChange={e=>setVerificacion({...verificacion, sentidoOnda: e.target.checked})} /> El sentido de onda</label>
            <label><input type="checkbox" checked={verificacion.presionCorteHendido} onChange={e=>setVerificacion({...verificacion, presionCorteHendido: e.target.checked})} /> Presión cuerpo corte y hendido</label>
          </div>
        </div>

        <div style={{ border: '1px solid #000', marginBottom: '15px', padding: '12px' }}>
          <h4 style={{ margin: '0 0 10px 0', backgroundColor: '#28a745', color: '#fff', padding: '6px', fontSize: '1rem' }}>INSPECCIÓN SOBRE LA MARCHA: Un paquete cada 1000 cajas / Pallets</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'center' }}>
              <thead>
                <tr style={{ backgroundColor: '#e9ecef', borderBottom: '2px solid #000' }}>
                  <th style={{ padding: '6px', textAlign: 'left' }}>Parámetro / Paquete</th>
                  {inspeccionPaquetes.map((_, idx) => (
                    <th key={idx} style={{ padding: '6px' }}>Pqt {idx + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '6px', textAlign: 'left', fontWeight: 'bold' }}>Medidas del envase</td>
                  {inspeccionPaquetes.map((p, idx) => (
                    <td key={idx} style={{ padding: '4px' }}>
                      <input type="text" value={p.medidas} onClick={() => handleCellClick(idx, 'medidas')} onChange={e => actualizarPaquete(idx, 'medidas', e.target.value)} style={{ width: '35px', textAlign: 'center' }} />
                    </td>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '6px', textAlign: 'left', fontWeight: 'bold' }}>Pegado interno/externo</td>
                  {inspeccionPaquetes.map((p, idx) => (
                    <td key={idx} style={{ padding: '4px' }}>
                      <input type="text" value={p.pegadoInt} onClick={() => handleCellClick(idx, 'pegadoInt')} onChange={e => actualizarPaquete(idx, 'pegadoInt', e.target.value)} style={{ width: '35px', textAlign: 'center' }} />
                    </td>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '6px', textAlign: 'left', fontWeight: 'bold' }}>Tonos de tintas / Registro</td>
                  {inspeccionPaquetes.map((p, idx) => (
                    <td key={idx} style={{ padding: '4px' }}>
                      <input type="text" value={p.tonosTintas} onClick={() => handleCellClick(idx, 'tonosTintas')} onChange={e => actualizarPaquete(idx, 'tonosTintas', e.target.value)} style={{ width: '35px', textAlign: 'center' }} />
                    </td>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid #000', backgroundColor: '#fff3cd' }}>
                  <td style={{ padding: '6px', textAlign: 'left', fontWeight: 'bold', color: '#856404' }}>BCT Ensayo (kgf)</td>
                  {inspeccionPaquetes.map((p, idx) => (
                    <td key={idx} style={{ padding: '4px' }}>
                      <input type="number" value={p.bctEnsayo} onChange={e => actualizarPaquete(idx, 'bctEnsayo', e.target.value)} style={{ width: '45px', textAlign: 'center', fontWeight: 'bold', color: '#0056b3' }} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#666' }}>
            * <strong>DE SER REQUERIDO INGRESE EL VALOR ENSAYADO</strong> (Clic en las casillas para poner "OK" o escribir directamente).
          </div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label><strong>OBSERVACIONES:</strong></label><br/>
          <textarea rows="3" placeholder="Detalles o novedades del proceso..." value={datosCIP.observaciones} onChange={e=>setDatosCIP({...datosCIP, observaciones: e.target.value})} style={{width: '100%', padding: '8px'}} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
          {onCerrar && (
            <button type="button" onClick={onCerrar} style={{ padding: '12px 25px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '1rem', cursor: 'pointer' }}>
              Cerrar Planilla
            </button>
          )}
          <button type="submit" disabled={guardando} style={{ padding: '12px 30px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', marginLeft: 'auto' }}>
            {guardando ? 'Guardando...' : '💾 Guardar y Emitir Protocolo RE-PRO 009'}
          </button>
        </div>
      </form>
    </div>
  );
}