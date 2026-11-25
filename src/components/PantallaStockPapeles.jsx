import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';

export default function PantallaStockPapeles() {
  const [papeles, setPapeles] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [kpis, setKpis] = useState({ total_kg: 0, disponibles: 0, criticos: 0, sin_stock: 0, consumido_hoy_kg: 0 });
  const [cargando, setCargando] = useState(true);
  const [importandoCSV, setImportandoCSV] = useState(false);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('TODOS');
  const [anchoFiltro, setAnchoFiltro] = useState('TODOS');
  const [soloConStock, setSoloConStock] = useState(true);
  const [soloCriticos, setSoloCriticos] = useState(false);
  const [vistaTab, setVistaTab] = useState('STOCK'); // 'STOCK' | 'MOVIMIENTOS'

  // Modal de Ingreso / Ajuste
  const [papelModal, setPapelModal] = useState(null);
  const [tipoMov, setTipoMov] = useState('INGRESO');
  const [cantidadKg, setCantidadKg] = useState('');
  const [observacion, setObservacion] = useState('');

  const cargarStock = async () => {
    setCargando(true);
    try {
      const res = await apiFetch('/api/corrugadora/stock-papeles');
      if (res.ok) {
        const data = await res.json();
        setPapeles(data.papeles || []);
        setMovimientos(data.movimientos || []);
        setKpis(data.kpis || {});
      }
    } catch (e) {
      console.error('Error cargando stock de bobinas:', e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarStock();
  }, []);

  const handleImportarMacroBobinas = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportandoCSV(true);

    const parseNumAR = (v) => {
      if (!v) return 0;
      const n = parseFloat(String(v).replace(/"/g, '').replace(/\./g, '').replace(',', '.').trim());
      return isNaN(n) ? 0 : n;
    };

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const texto = String(ev.target.result || '').replace(/^\uFEFF/, '');
        const lineas = texto.split(/\r\n|\n/).filter(l => l.trim());
        if (lineas.length < 2) throw new Error('Archivo vacío');

        const header = lineas[0].toLowerCase();
        if (!(header.includes('sector') && header.includes('ancho') && header.includes('consumida'))) {
          alert('⚠️ Este botón espera el archivo MACRO_BOBINAS.csv (con columnas Sector, Ancho y Consumida).');
          return;
        }

        const vistas = new Set();
        const mapaGrupos = new Map();

        lineas.slice(1).forEach(l => {
          const c = l.split(';');
          const codBobina = c[0]?.trim();
          const tipoPapel = c[2]?.trim() || '';
          const nombrePapel = c[3]?.trim() || '';
          const proveedor = c[4]?.trim() || '';
          const fabricante = c[5]?.trim() || '';
          const anchoMm = Math.round(parseNumAR(c[6]));
          const gramaje = Math.round(parseNumAR(c[9]));
          const pesoKg = parseNumAR(c[11]);
          const color = c[16]?.trim() || '';
          const sector = (c[20] || '').trim().toUpperCase();
          const consumida = (c[23] || '').trim().toUpperCase();

          // Solo PAPEL CARTON, activas (FALSO), ancho >= 1000 mm y sin duplicados
          if (!codBobina || vistas.has(codBobina)) return;
          if (sector !== 'PAPEL CARTON') return;
          if (consumida !== 'FALSO') return;
          if (anchoMm < 1000 || pesoKg <= 0 || !nombrePapel) return;

          vistas.add(codBobina);

          const key = `${nombrePapel.toUpperCase()}|${fabricante.toUpperCase()}|${gramaje}|${anchoMm}`;
          if (!mapaGrupos.has(key)) {
            mapaGrupos.set(key, {
              tipo_papel: tipoPapel,
              nombre: nombrePapel,
              proveedor,
              fabricante,
              color,
              gramaje,
              ancho_mm: anchoMm,
              stock_kg: 0,
              cantidad_bobinas: 0
            });
          }
          const item = mapaGrupos.get(key);
          item.stock_kg += pesoKg;
          item.cantidad_bobinas += 1;
        });

        const grupos = Array.from(mapaGrupos.values());
        const res = await apiFetch('/api/corrugadora/importar-macro-bobinas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grupos })
        });
        const data = await res.json();
        alert(res.ok ? `✅ ${data.mensaje}` : `❌ ${data.error}`);
        await cargarStock();
      } catch (err) {
        alert('❌ Error procesando MACRO_BOBINAS.csv: ' + err.message);
      } finally {
        setImportandoCSV(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const tiposUnicos = ['TODOS', ...Array.from(new Set(papeles.map(p => p.tipo_papel).filter(Boolean))).sort()];
  const anchosUnicos = [
    'TODOS',
    ...Array.from(new Set(papeles.map(p => Number(p.ancho_mm) || 0).filter(a => a > 0))).sort((a, b) => a - b)
  ];

  const totalBobinasPlanta = papeles.reduce((acc, p) => acc + (Number(p.cantidad_bobinas) || 0), 0);

  const papelesFiltrados = papeles.filter(p => {
    const stock = Number(p.stock_kg) || 0;
    const pp = Number(p.punto_pedido_kg) || 0;
    const ancho = Number(p.ancho_mm) || 0;
    if (soloConStock && stock <= 0) return false;
    if (soloCriticos && !(stock > 0 && pp > 0 && stock <= pp)) return false;
    if (tipoFiltro !== 'TODOS' && p.tipo_papel !== tipoFiltro) return false;
    if (anchoFiltro !== 'TODOS' && String(ancho) !== String(anchoFiltro)) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const match =
        String(p.codigo || '').toLowerCase().includes(q) ||
        String(p.nombre || '').toLowerCase().includes(q) ||
        String(p.fabricante || '').toLowerCase().includes(q) ||
        String(ancho).includes(q);
      if (!match) return false;
    }
    return true;
  });

  const guardarMovimiento = async (e) => {
    e.preventDefault();
    if (!papelModal || cantidadKg === '') return;
    try {
      const res = await apiFetch('/api/corrugadora/stock-papeles/movimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo_papel: papelModal.codigo,
          ancho_mm: Number(papelModal.ancho_mm) || 0,
          tipo_movimiento: tipoMov,
          cantidad_kg: Number(cantidadKg),
          observacion
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.mensaje}`);
        setPapelModal(null);
        setCantidadKg('');
        setObservacion('');
        cargarStock();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (err) {
      alert('❌ Error de conexión.');
    }
  };

  const renderSemaforo = (p) => {
    const stock = Number(p.stock_kg) || 0;
    const pp = Number(p.punto_pedido_kg) || 0;
    if (stock <= 0) {
      return <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>🔴 Sin Stock</span>;
    }
    if (pp > 0 && stock <= pp) {
      return <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>🟡 Crítico</span>;
    }
    return <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>🟢 Disponible</span>;
  };

  return (
    <div style={{ padding: '1.2rem 1.5rem', maxWidth: '1480px', margin: '0 auto', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
      {/* CABECERA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #0f766e', paddingBottom: '10px', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '2.2rem' }}>🧻</span>
          <div>
            <h2 style={{ margin: 0, color: '#0f766e', fontSize: '1.75rem' }}>Stock Físico de Bobinas de Papel</h2>
            <small style={{ color: '#64748b', fontWeight: 'bold' }}>
              Sincronizado automáticamente con consumos reales de Corrugadora · Formatos (mm) e Ingresos
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setVistaTab('STOCK')}
            style={{
              padding: '9px 16px', borderRadius: '8px', border: '2px solid #0f766e',
              backgroundColor: vistaTab === 'STOCK' ? '#0f766e' : '#fff',
              color: vistaTab === 'STOCK' ? '#fff' : '#0f766e', fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            📦 Inventario ({papelesFiltrados.length})
          </button>
          <button
            onClick={() => setVistaTab('MOVIMIENTOS')}
            style={{
              padding: '9px 16px', borderRadius: '8px', border: '2px solid #0284c7',
              backgroundColor: vistaTab === 'MOVIMIENTOS' ? '#0284c7' : '#fff',
              color: vistaTab === 'MOVIMIENTOS' ? '#fff' : '#0284c7', fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            📜 Movimientos y Consumos ({movimientos.length})
          </button>
          <label style={{
            padding: '9px 14px', borderRadius: '8px', backgroundColor: '#0f172a', color: '#38bdf8',
            fontWeight: 'bold', cursor: 'pointer', fontSize: '0.86rem', display: 'flex', alignItems: 'center'
          }}>
            {importandoCSV ? '⏳ Importando...' : '📥 Importar MACRO_BOBINAS.csv'}
            <input type="file" accept=".csv" disabled={importandoCSV} onChange={handleImportarMacroBobinas} style={{ display: 'none' }} />
          </label>
          <button
            onClick={cargarStock}
            style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 'bold', cursor: 'pointer' }}
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginBottom: '1.2rem' }}>
        <div style={{ backgroundColor: '#fff', padding: '14px', borderRadius: '10px', borderLeft: '5px solid #0f766e', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold' }}>STOCK TOTAL EN PLANTA</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#0f172a' }}>{(kpis.total_kg || 0).toLocaleString('es-AR')} kg</div>
          <small style={{ color: '#0f766e', fontWeight: 'bold' }}>
            {((kpis.total_kg || 0) / 1000).toFixed(1)} toneladas
            {totalBobinasPlanta > 0 ? ` · ${totalBobinasPlanta} bobinas` : ''}
          </small>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '14px', borderRadius: '10px', borderLeft: '5px solid #16a34a', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold' }}>PAPELES DISPONIBLES</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#15803d' }}>{kpis.disponibles || 0}</div>
          <small style={{ color: '#64748b' }}>combinaciones papel + formato</small>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '14px', borderRadius: '10px', borderLeft: '5px solid #d97706', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold' }}>BAJO PUNTO DE PEDIDO</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#b45309' }}>{kpis.criticos || 0}</div>
          <small style={{ color: '#b45309' }}>requieren reposición</small>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '14px', borderRadius: '10px', borderLeft: '5px solid #7c3aed', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold' }}>CONSUMO CORRUGADORA HOY</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#5b21b6' }}>{(kpis.consumido_hoy_kg || 0).toLocaleString('es-AR')} kg</div>
          <small style={{ color: '#64748b' }}>descontado automáticamente</small>
        </div>
      </div>

      {/* VISTA 1: TABLA DE STOCK */}
      {vistaTab === 'STOCK' && (
        <div style={{ backgroundColor: '#fff', padding: '1.2rem', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="🔍 Buscar por código, nombre, fabricante o ancho..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ flex: 1, minWidth: '240px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <select
              value={anchoFiltro}
              onChange={(e) => setAnchoFiltro(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '2px solid #0f172a', fontWeight: 'bold', backgroundColor: '#f8fafc' }}
            >
              {anchosUnicos.map(a => (
                <option key={a} value={a}>
                  {a === 'TODOS' ? '📏 Todos los formatos' : `📏 ${a} mm`}
                </option>
              ))}
            </select>
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
            >
              {tiposUnicos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>
              <input type="checkbox" checked={soloConStock} onChange={(e) => setSoloConStock(e.target.checked)} /> Solo con stock &gt; 0
            </label>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#b45309', cursor: 'pointer' }}>
              <input type="checkbox" checked={soloCriticos} onChange={(e) => setSoloCriticos(e.target.checked)} /> Solo críticos
            </label>
          </div>

          {cargando ? (
            <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>Cargando inventario...</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '10px' }}>Código</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Formato</th>
                    <th style={{ padding: '10px' }}>Papel / Descripción</th>
                    <th style={{ padding: '10px' }}>Tipo</th>
                    <th style={{ padding: '10px' }}>Gramaje</th>
                    <th style={{ padding: '10px' }}>Fabricante</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Bobinas</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Stock Actual</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {papelesFiltrados.map(p => (
                    <tr key={`${p.codigo}-${p.ancho_mm || 0}-${p.id || ''}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '9px 10px', fontWeight: 'bold', color: '#1e40af' }}>{p.codigo}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                        {Number(p.ancho_mm) > 0 ? (
                          <span style={{ backgroundColor: '#0f172a', color: '#38bdf8', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem' }}>
                            {p.ancho_mm} mm
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '9px 10px', fontWeight: 'bold' }}>{p.nombre}</td>
                      <td style={{ padding: '9px 10px', color: '#475569' }}>{p.tipo_papel || '-'}</td>
                      <td style={{ padding: '9px 10px', fontWeight: 'bold' }}>{p.gramaje} g/m²</td>
                      <td style={{ padding: '9px 10px', color: '#475569' }}>{p.fabricante || '-'}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 'bold', color: '#0369a1' }}>
                        {Number(p.cantidad_bobinas) > 0 ? p.cantidad_bobinas : '-'}
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 'bold', fontSize: '0.95rem', color: Number(p.stock_kg) > 0 ? '#0f172a' : '#dc2626' }}>
                        {Math.round(Number(p.stock_kg) || 0).toLocaleString('es-AR')} kg
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'center' }}>{renderSemaforo(p)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                        <button
                          onClick={() => { setPapelModal(p); setTipoMov('INGRESO'); setCantidadKg(''); setObservacion(''); }}
                          style={{ padding: '5px 10px', backgroundColor: '#0f766e', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.78rem', cursor: 'pointer' }}
                        >
                          ± Ingreso / Ajuste
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VISTA 2: HISTORIAL DE MOVIMIENTOS */}
      {vistaTab === 'MOVIMIENTOS' && (
        <div style={{ backgroundColor: '#fff', padding: '1.2rem', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.06)' }}>
          <h3 style={{ marginTop: 0, color: '#0369a1' }}>📜 Últimos Movimientos y Consumos de Corrugadora</h3>
          {movimientos.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>Todavía no se registraron movimientos ni consumos.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '9px' }}>Fecha</th>
                    <th style={{ padding: '9px' }}>Tipo</th>
                    <th style={{ padding: '9px' }}>Papel</th>
                    <th style={{ padding: '9px', textAlign: 'right' }}>Cantidad</th>
                    <th style={{ padding: '9px', textAlign: 'right' }}>Stock Nuevo</th>
                    <th style={{ padding: '9px' }}>Tirada / Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px' }}>{new Date(m.fecha).toLocaleString('es-AR')}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>{m.tipo_movimiento}</td>
                      <td style={{ padding: '8px' }}><strong>{m.codigo_papel}</strong> · {m.nombre_papel}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: Number(m.cantidad_kg) >= 0 ? '#15803d' : '#dc2626' }}>
                        {Number(m.cantidad_kg) >= 0 ? '+' : ''}{Number(m.cantidad_kg).toLocaleString('es-AR')} kg
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{Number(m.stock_nuevo_kg).toLocaleString('es-AR')} kg</td>
                      <td style={{ padding: '8px', color: '#475569' }}>{m.codigo_tirada ? `[${m.codigo_tirada}] ` : ''}{m.observacion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL INGRESO / AJUSTE */}
      {papelModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={guardarMovimiento} style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', width: '430px', maxWidth: '92vw', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, color: '#0f766e' }}>± Movimiento de Stock</h3>
            <p style={{ fontSize: '0.88rem', color: '#334155', marginTop: 0 }}>
              <strong>{papelModal.codigo}</strong> — {papelModal.nombre}
              {Number(papelModal.ancho_mm) > 0 ? ` · Formato ${papelModal.ancho_mm} mm` : ''}<br />
              Stock actual: <strong>{Math.round(Number(papelModal.stock_kg) || 0).toLocaleString('es-AR')} kg</strong>
            </p>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Tipo de Movimiento:</label>
              <select value={tipoMov} onChange={(e) => setTipoMov(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>
                <option value="INGRESO">➕ Ingreso de Camión / Compra (+ kg)</option>
                <option value="EGRESO">➖ Egreso / Descarte Manual (- kg)</option>
                <option value="AJUSTE">🎯 Ajuste de Inventario Físico (fijar stock exacto)</option>
              </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                {tipoMov === 'AJUSTE' ? 'Nuevo Stock Físico Real (kg):' : 'Cantidad (kg):'}
              </label>
              <input type="number" step="0.1" min="0" required value={cantidadKg} onChange={(e) => setCantidadKg(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontWeight: 'bold' }} />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Observación / Remito:</label>
              <input type="text" placeholder="Ej: Remito #4512 o Recuento físico..." value={observacion} onChange={(e) => setObservacion(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setPapelModal(null)} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#0f766e', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>💾 Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}