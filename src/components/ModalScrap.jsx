import { useState } from 'react';
import { apiFetch } from '../services/api'; // 👈 IMPORTACIÓN CENTRALIZADA

export default function ModalScrap({ ordenId, maquina, ordenActiva, onClose, onGuardado }) {
  const [tipoZona, setTipoZona] = useState('feed'); // 'feed' (laminas) o 'salida' (cajas)
  const [cantidadPiezas, setCantidadPiezas] = useState('');
  const [motivo, setMotivo] = useState('COMBA');
  const [observaciones, setObservaciones] = useState('');
  const [mensaje, setMensaje] = useState('');

  // 📐 Obtenemos datos de la orden activa (multiplicador, dimensiones, gramaje estimado)
  const multiplicadorCajas = ordenActiva?.multiplicador || ordenActiva?.up_por_plancha || 1;
  
  // Peso estimado por plancha madre (en kg) basado en los datos de la orden o un estándar de planta
  const pesoPlanchaBaseKg = ordenActiva?.peso_plancha_kg || 0.500; // 500 gramos por plancha por defecto si no está especificado

  // ⚖️ CÁLCULO AUTOMÁTICO DE LA BALANZA VIRTUAL EN KILOS
  let pesoCalculadoKg = 0;
  const cant = Number(cantidadPiezas) || 0;

  if (tipoZona === 'feed') {
    // En el feed se descartan láminas completas
    pesoCalculadoKg = cant * pesoPlanchaBaseKg;
  } else {
    // En la salida se descartan cajas. Dividimos el peso de la plancha por el multiplicador de cajas por lámina
    const pesoUnitarioCajaKg = pesoPlanchaBaseKg / (multiplicadorCajas > 0 ? multiplicadorCajas : 1);
    pesoCalculadoKg = cant * pesoUnitarioCajaKg;
  }

  const motivosScrap = [
    { id: 'COMBA', label: '1. Comba / Deformación de plancha' },
    { id: 'DESPEGADO', label: '2. Plancha Despegada' },
    { id: 'PAPEL_NC', label: '3. Papel No Conforme (Bobina)' },
    { id: 'PROBLEMA_PAPEL', label: '4. Problemas de Papel (Decapado, rulos, etc)' },
    { id: 'CORTE_DEF', label: '5. Corte Defectuoso / Mal refilado' },
    { id: 'ERROR_MEDIDA', label: '6. Error de Medida (Mal corte o hendido)' },
    { id: 'ONDA_LAMINADA', label: '7. Onda Laminada / Defecto estructural' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cant <= 0) {
      alert('Por favor ingrese una cantidad válida.');
      return;
    }

    try {
      const res = await apiFetch('/api/scrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orden_id: ordenId,
          codigo_maquina: maquina,
          zona: tipoZona,
          cantidad_piezas: cant,
          peso_kg: Number(pesoCalculadoKg.toFixed(2)),
          motivo,
          observaciones
        })
      });

      if (res.ok) {
        setMensaje(`✅ Scrap registrado: ${cant} ${tipoZona === 'feed' ? 'láminas' : 'cajas'} (${pesoCalculadoKg.toFixed(2)} Kg).`);
        setTimeout(() => {
          onGuardado();
          onClose();
        }, 1800);
      } else {
        alert('Error al registrar el scrap en el servidor.');
      }
    } catch (err) {
      console.error('Error de red:', err);
      alert('No se pudo conectar con el servidor.');
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '550px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '10px', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.3rem' }}>⚖️ Balanza Virtual de Scrap (Nivel NASA)</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>

        {mensaje ? (
          <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '15px', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold' }}>
            {mensaje}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            
            {/* SELECCIÓN DE ZONA */}
            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#334155' }}>Zona de Control:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setTipoZona('feed'); setCantidadPiezas(''); }}
                  style={{ padding: '10px', fontWeight: 'bold', borderRadius: '6px', border: '2px solid #0f172a', backgroundColor: tipoZona === 'feed' ? '#0f172a' : 'white', color: tipoZona === 'feed' ? 'white' : '#0f172a', cursor: 'pointer' }}
                >
                  📥 Entrada / Feed (Láminas)
                </button>
                <button
                  type="button"
                  onClick={() => { setTipoZona('salida'); setCantidadPiezas(''); }}
                  style={{ padding: '10px', fontWeight: 'bold', borderRadius: '6px', border: '2px solid #0f172a', backgroundColor: tipoZona === 'salida' ? '#0f172a' : 'white', color: tipoZona === 'salida' ? 'white' : '#0f172a', cursor: 'pointer' }}
                >
                  📤 Salida / Máquina (Cajas)
                </button>
              </div>
            </div>

            {/* INGRESO DE CANTIDAD DE PIEZAS */}
            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#334155' }}>
                {tipoZona === 'feed' ? '📥 Cantidad de Láminas Descartadas:' : '📤 Cantidad de Cajas Descartadas:'}
              </label>
              <input 
                type="number"
                required
                min="1"
                value={cantidadPiezas}
                onChange={(e) => setCantidadPiezas(e.target.value)}
                placeholder="Ej: 15"
                style={{ width: '100%', padding: '12px', fontSize: '1.2rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', textAlign: 'center', fontWeight: 'bold' }}
              />
            </div>

            {/* 📊 PANEL DE BALANZA TEÓRICA EN TIEMPO REAL */}
            <div style={{ backgroundColor: '#f8fafc', border: '2px dashed #cbd5e1', padding: '12px', borderRadius: '8px', marginBottom: '1.2rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>⚖️ Peso Calculado por la Balanza Virtual:</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#0284c7' }}>
                {pesoCalculadoKg.toFixed(2)} Kg
              </span>
              {tipoZona === 'salida' && (
                <span style={{ fontSize: '0.8rem', color: '#d97706', display: 'block', marginTop: '4px' }}>
                  (Multiplicador de conversión aplicado: 1 lámina = {multiplicadorCajas} cajas)
                </span>
              )}
            </div>

            {/* MOTIVO OFICIAL */}
            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#334155' }}>Motivo Oficial (Estándar RE-PRO 014):</label>
              <select 
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
              >
                {motivosScrap.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* OBSERVACIONES */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#334155' }}>Observaciones (Opcional):</label>
              <input 
                type="text"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Detalle adicional del defecto..."
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>

            {/* ACCIONES */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                onClick={onClose}
                style={{ padding: '10px 20px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Cancelar
              </button>
              <button 
                type="submit"
                style={{ padding: '10px 25px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                💾 Registrar Scrap en Kilos
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}