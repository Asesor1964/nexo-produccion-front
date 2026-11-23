import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';

export default function PantallaMaquinistaCorrugadora() {
  const [cola, setCola] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ultimaActualizacion, setUltimaActualizacion] = useState('');

  const cargarCola = async () => {
    try {
      const res = await apiFetch('/api/corrugadora/cola-maquinista');
      if (res.ok) {
        const data = await res.json();
        setCola(data.cola || []);
        setUltimaActualizacion(new Date().toLocaleTimeString('es-AR'));
      }
    } catch (e) {
      console.error('Error cargando cola corrugadora:', e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarCola();
    const timer = setInterval(cargarCola, 10000); // Refresco en vivo cada 10s
    return () => clearInterval(timer);
  }, []);

  const iniciarCorrida = async (prog) => {
    if (!window.confirm(`▶️ ¿Iniciar corrida ${prog.codigo_tirada} (Bobina ${prog.ancho_bobina_mm} mm)?`)) return;
    await apiFetch(`/api/corrugadora/programas/${prog.id}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'En Proceso' })
    });
    cargarCola();
  };

  const finalizarCorrida = async (prog) => {
    const mts = window.prompt(
      `✅ Finalizar tirada ${prog.codigo_tirada}\nIngresá los metros lineales reales producidos:`,
      String(prog.metros_lineales)
    );
    if (mts === null) return;
    await apiFetch(`/api/corrugadora/programas/${prog.id}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Finalizada', metros_reales: Number(mts) || Number(prog.metros_lineales) })
    });
    cargarCola();
  };

  const activa = cola[0] || null;
  const siguientes = cola.slice(1);

  const renderPortabobinas = (prog) => {
    const receta = prog.receta;
    if (!receta) {
      return (
        <div style={{ backgroundColor: '#0f172a', padding: '10px 14px', borderRadius: '8px', color: '#fbbf24', fontSize: '0.92rem', border: '1px dashed #f59e0b' }}>
          ⚠️ Clave <strong>{prog.clave_material}</strong> sin receta en CLAVES.csv. Verificar papeles con Programación.
        </div>
      );
    }

    const asignados = prog.portabobinas_asignados || {};
    const armarEstacion = (key, titulo, papelIdeal, grIdeal, resMin, esBlanco = false) => {
      const alt = asignados[key];
      if (alt) {
        return {
          titulo,
          papel: `${alt.codigo} — ${alt.nombre}`,
          gr: alt.gramaje || grIdeal,
          res: '🔄 ASIGNADO POR PCP',
          esBlanco,
          esAsignado: true
        };
      }
      return { titulo, papel: papelIdeal, gr: grIdeal, res: resMin, esBlanco, esAsignado: false };
    };

    const estaciones = [
      armarEstacion('liner_ext', '1. LINER EXT', prog.es_blanco ? `BLANCO (${receta?.liner_ext_ideal || 'Liner'})` : (receta?.liner_ext_ideal || 'Estándar'), receta?.liner_ext_gramaje, receta?.liner_ext_rct ? `RCT ${receta.liner_ext_rct}` : '', prog.es_blanco),
      armarEstacion('onda_1', '2. ONDA 1', receta?.medium_ideal || 'Onda', receta?.onda1_gramaje, receta?.onda1_cct ? `CCT ${receta.onda1_cct}` : ''),
      ...(receta?.es_doble_onda || asignados.entretapa || asignados.onda_2 ? [
        armarEstacion('entretapa', '3. ENTRETAPA', receta?.entretapa_ideal || 'Entretapa', receta?.entretapa_gramaje, receta?.entretapa_rct ? `RCT ${receta.entretapa_rct}` : ''),
        armarEstacion('onda_2', '4. ONDA 2', receta?.onda2_ideal || 'Onda', receta?.onda2_gramaje, receta?.onda2_cct ? `CCT ${receta.onda2_cct}` : '')
      ] : []),
      armarEstacion('liner_int', (receta?.es_doble_onda || asignados.entretapa) ? '5. LINER INT' : '3. LINER INT', receta?.liner_int_ideal || 'Liner Int', receta?.liner_int_gramaje, receta?.liner_int_rct ? `RCT ${receta.liner_int_rct}` : '')
    ];

    return (
      <div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <span style={{ backgroundColor: '#334155', color: '#e2e8f0', padding: '3px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 'bold' }}>
            {receta.es_doble_onda ? '🧱 DOBLE ONDA (5 PAPELES)' : `📄 SIMPLE ONDA ${receta.onda || 'C'} (3 PAPELES)`}
          </span>
          {prog.es_rh && (
            <span style={{ backgroundColor: '#0284c7', color: '#fff', padding: '3px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 'bold' }}>
              💧 ADHESIVO RH (RESISTENTE A HUMEDAD)
            </span>
          )}
          {prog.es_blanco && (
            <span style={{ backgroundColor: '#f8fafc', color: '#0f172a', padding: '3px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 'bold' }}>
              ⚪ TAPA EXTERIOR BLANCA
            </span>
          )}
          {Number(prog.consumo_estimado_kg) > 0 && (
            <span style={{ backgroundColor: '#1e293b', color: '#a7f3d0', padding: '3px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 'bold', border: '1px solid #334155' }}>
              ⚖️ Consumo est.: ~{Math.round(prog.consumo_estimado_kg)} kg
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${estaciones.length}, 1fr)`, gap: '10px' }}>
          {estaciones.map((est, i) => (
            <div key={i} style={{
              backgroundColor: est.esBlanco ? '#f8fafc' : '#0f172a',
              color: est.esBlanco ? '#0f172a' : '#fff',
              border: est.esBlanco ? '2px solid #cbd5e1' : '1px solid #334155',
              borderRadius: '8px',
              padding: '10px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.75rem', color: est.esBlanco ? '#0369a1' : '#38bdf8', fontWeight: 'bold' }}>
                {est.titulo}
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 'bold', marginTop: '4px' }}>
                {est.papel}
              </div>
              {Number(est.gr) > 0 && (
                <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: est.esBlanco ? '#1e293b' : '#fbbf24', marginTop: '2px' }}>
                  {est.gr} g/m²
                </div>
              )}
              {est.res && (
                <div style={{ fontSize: '0.76rem', color: est.esBlanco ? '#475569' : '#94a3b8', marginTop: '2px' }}>
                  Mín: {est.res}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '1.2rem 1.5rem', maxWidth: '1440px', margin: '0 auto', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '88vh', borderRadius: '12px', fontFamily: 'sans-serif' }}>
      {/* CABECERA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #334155', paddingBottom: '12px', marginBottom: '1.2rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#38bdf8', fontSize: '1.8rem' }}>🏭 Cabina Corrugadora — Hoja de Corrida en Vivo</h2>
          <small style={{ color: '#94a3b8' }}>Sincronización automática con PCP · Última actualización: {ultimaActualizacion || '...'}</small>
        </div>
        <button
          onClick={cargarCola}
          style={{ padding: '10px 16px', backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #38bdf8', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          🔄 Actualizar Ahora
        </button>
      </div>

      {cargando ? (
        <p style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Cargando programa de corrugadora...</p>
      ) : !activa ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', backgroundColor: '#1e293b', borderRadius: '10px' }}>
          <div style={{ fontSize: '3rem' }}>⏸️</div>
          <h3 style={{ color: '#e2e8f0' }}>Sin tiradas programadas en cola</h3>
          <p style={{ color: '#94a3b8' }}>Apenas Programación (PCP) apruebe una tirada, aparecerá automáticamente aquí.</p>
        </div>
      ) : (
        <>
          {/* BLOQUE 1: TIRADA ACTIVA (#1) */}
          <div style={{ backgroundColor: '#1e293b', border: activa.estado === 'En Proceso' ? '3px solid #22c55e' : '3px solid #38bdf8', borderRadius: '12px', padding: '1.2rem 1.4rem', marginBottom: '1.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{
                  padding: '5px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9rem',
                  backgroundColor: activa.estado === 'En Proceso' ? '#16a34a' : '#0284c7', color: '#fff'
                }}>
                  {activa.estado === 'En Proceso' ? '🟢 CORRIENDO AHORA' : '⏳ PRÓXIMA A ARRANCAR (#1)'}
                </span>
                <strong style={{ fontSize: '1.5rem', color: '#fff' }}>{activa.codigo_tirada}</strong>
                <span style={{ fontSize: '1.3rem', color: '#fbbf24', fontWeight: 'bold' }}>Clave: {activa.clave_material}</span>
                <span style={{ fontSize: '1.3rem', color: '#38bdf8', fontWeight: 'bold' }}>Bobina: {activa.ancho_bobina_mm} mm</span>
                <span style={{ fontSize: '1.2rem', color: '#a7f3d0', fontWeight: 'bold' }}>{activa.metros_lineales} mts</span>
                <span style={{ fontSize: '1rem', color: '#cbd5e1' }}>Trim: {activa.trim_mm} mm ({activa.trim_porcentaje}%)</span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                {activa.estado !== 'En Proceso' ? (
                  <button onClick={() => iniciarCorrida(activa)} style={{ padding: '12px 22px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.05rem', cursor: 'pointer' }}>
                    ▶️ Iniciar Corrida
                  </button>
                ) : (
                  <button onClick={() => finalizarCorrida(activa)} style={{ padding: '12px 22px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.05rem', cursor: 'pointer' }}>
                    ✅ Finalizar Tirada
                  </button>
                )}
              </div>
            </div>

            {/* BANNER POKA-YOKE DE PAPEL ALTERNATIVO */}
            {activa.es_alternativa_manual && (
              <div style={{ backgroundColor: '#fef08a', color: '#713f12', padding: '10px 14px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', marginBottom: '12px', border: '2px solid #eab308' }}>
                ⚠️ ATENCIÓN PORTABOBINAS — USAR PAPEL ALTERNATIVO: {activa.papel_utilizado}
                {activa.motivo_alternativa ? ` · Motivo: ${activa.motivo_alternativa}` : ''}
              </div>
            )}

            {/* BLOQUE 2: MAPA DE PORTABOBINAS */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '6px' }}>🧻 MONTAJE DE PORTABOBINAS</div>
              {renderPortabobinas(activa)}
            </div>

            {/* BLOQUE 3: SLITTER (MÁX 5) Y GUILLOTINA DUAL (MÁX 2 LARGOS) */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 'bold', marginBottom: '6px' }}>✂️ CONFIGURACIÓN DE SLITTER (CUCHILLAS LONGITUDINALES)</div>
              <div style={{ width: '100%', height: '38px', backgroundColor: '#7f1d1d', borderRadius: '8px', overflow: 'hidden', display: 'flex', border: '2px solid #475569' }}>
                {(activa.pistas_detalle || []).map((p, i) => {
                  const pct = (Number(p.ancho_ocupado_mm) / Number(activa.ancho_bobina_mm)) * 100;
                  return (
                    <div key={i} style={{
                      width: `${pct}%`, backgroundColor: i === 0 ? '#2563eb' : '#0d9488',
                      color: '#fff', fontWeight: 'bold', fontSize: '0.95rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '3px solid #0f172a'
                    }}>
                      OP #{p.numero_orden} · {p.salidas} × {p.ancho_mm} mm
                    </div>
                  );
                })}
                <div style={{ flex: 1, color: '#fecaca', fontWeight: 'bold', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {activa.trim_mm}mm
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '12px' }}>
              {(activa.pistas_detalle || []).map((p, i) => (
                <div key={i} style={{ backgroundColor: '#0f172a', border: `2px solid ${i === 0 ? '#3b82f6' : '#14b8a6'}`, borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '0.8rem', color: i === 0 ? '#60a5fa' : '#2dd4bf', fontWeight: 'bold' }}>
                    🔪 GUILLOTINA — CUCHILLA {i + 1} ({p.salidas} salida/s)
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', margin: '4px 0' }}>
                    OP #{p.numero_orden} · Largo: {p.largo_mm} mm · Ancho: {p.ancho_mm} mm
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: '0.92rem' }}>
                    {p.cliente} — <strong>{p.planchas_tirada} planchas</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* BLOQUE 4: COLA PROGRAMADA EN VIVO (#2, #3, #4...) */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '10px', padding: '1rem 1.2rem', border: '1px solid #334155' }}>
            <h3 style={{ marginTop: 0, marginBottom: '10px', color: '#e2e8f0', fontSize: '1.1rem' }}>
              📋 Próximas Tiradas en Cola ({siguientes.length}) — Preparación de Bobinas
            </h3>
            {siguientes.length === 0 ? (
              <p style={{ color: '#94a3b8', margin: 0 }}>No hay más tiradas cargadas detrás de la actual.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {siguientes.map((prog, idx) => (
                  <div key={prog.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', backgroundColor: '#0f172a', padding: '10px 14px', borderRadius: '8px', borderLeft: '4px solid #38bdf8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ backgroundColor: '#334155', color: '#38bdf8', padding: '3px 9px', borderRadius: '6px', fontWeight: 'bold' }}>#{idx + 2}</span>
                      <strong>{prog.codigo_tirada}</strong>
                      <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{prog.clave_material}</span>
                      <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>Bobina {prog.ancho_bobina_mm} mm</span>
                      <span>{prog.metros_lineales} mts</span>
                      {prog.es_alternativa_manual && <span style={{ color: '#facc15', fontWeight: 'bold' }}>⚠️ Papel Alt.</span>}
                    </div>
                    <div style={{ fontSize: '0.88rem', color: '#cbd5e1' }}>
                      {(prog.pistas_detalle || []).map(p => `#${p.numero_orden} (${p.salidas}×${p.ancho_mm}mm)`).join('  +  ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}