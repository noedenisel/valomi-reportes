'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapaML, Marker } from 'maplibre-gl';
import { ENCUADRE_BARRIO, MapaBase } from './MapaBase';
import { Icono } from './Iconos';
import type { ReportePublico } from '@/lib/publico';
import { TIPOS, VISIBLE_HORAS, esMomentoVisible, nombreTipo } from '@/lib/reglas';
import { ETIQUETA_ESTADO, haceCuando, horaAR } from '@/lib/formato';

type Periodo = '24h' | '48h';
type Estado = ReportePublico['estado'];
type Carga = { tipo: 'cargando' } | { tipo: 'lento' } | { tipo: 'listo'; sinConexion: boolean; actualizado: number } | { tipo: 'error' };

const iconoTipo = (id: string) => TIPOS.find((t) => t.id === id)?.icono ?? 'otro';

export function PantallaMapa() {
  const [reportes, setReportes] = useState<ReportePublico[]>([]);
  const [carga, setCarga] = useState<Carga>({ tipo: 'cargando' });
  const [periodo, setPeriodo] = useState<Periodo>('48h');
  const [tipo, setTipo] = useState<string>('');
  const [estado, setEstado] = useState<Estado | ''>('');
  const [vista, setVista] = useState<'mapa' | 'lista'>('mapa');
  const [ahora, setAhora] = useState(0);
  const reloj = useRef<{ servidor: number; monotono: number; pared: number } | null>(null);
  const horaServidor = useCallback(() => {
    const r = reloj.current;
    return r ? r.servidor + Math.max(0, performance.now() - r.monotono, Date.now() - r.pared) : 0;
  }, []);
  const [elegido, setElegido] = useState<ReportePublico[] | null>(null);
  const [hoja, setHoja] = useState<'filtros' | 'leyenda' | null>(null);
  const mapa = useRef<{ m: MapaML; ml: typeof import('maplibre-gl') } | null>(null);
  const marcadores = useRef<Marker[]>([]);

  useEffect(() => {
    const controlador = new AbortController();
    const cargar = () => {
      const inicio = performance.now();
      return fetch('/api/reportes', { cache: 'no-store', signal: controlador.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!Array.isArray(d.reportes) || !Number.isFinite(d.actualizado)) throw new Error('Respuesta inválida');
        const servidor = Math.max(d.actualizado + Math.max(0, performance.now() - inicio), horaServidor());
        reloj.current = { servidor, monotono: performance.now(), pared: Date.now() };
        setAhora(servidor);
        setReportes(d.reportes);
        setCarga({ tipo: 'listo', sinConexion: !navigator.onLine, actualizado: d.actualizado });
      })
      .catch(() => { if (!controlador.signal.aborted) setCarga((c) => c.tipo === 'listo' ? { ...c, sinConexion: !navigator.onLine } : { tipo: 'error' }); });
    };
    const lento = window.setTimeout(() => setCarga((c) => c.tipo === 'cargando' ? { tipo: 'lento' } : c), 10_000);
    const actualizar = () => setAhora(horaServidor());
    const alVolver = () => {
      actualizar();
      if (document.visibilityState === 'visible' && navigator.onLine) void cargar();
    };
    const sinRed = () => { actualizar(); setCarga((c) => c.tipo === 'listo' ? { ...c, sinConexion: true } : c); };
    void cargar().finally(() => window.clearTimeout(lento));
    const intervalo = window.setInterval(actualizar, 30_000);
    window.addEventListener('focus', alVolver);
    window.addEventListener('online', alVolver);
    window.addEventListener('offline', sinRed);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      controlador.abort(); window.clearTimeout(lento); window.clearInterval(intervalo);
      window.removeEventListener('focus', alVolver); window.removeEventListener('online', alVolver); window.removeEventListener('offline', sinRed); document.removeEventListener('visibilitychange', alVolver);
    };
  }, [horaServidor]);

  const visibles = useMemo(() => {
    const desde = ahora - (periodo === '24h' ? 24 : VISIBLE_HORAS) * 3600_000;
    return reportes
      .filter((r) => esMomentoVisible(r.momento, ahora) && r.momento > desde && (!tipo || r.tipo === tipo) && (!estado || r.estado === estado))
      .sort((a, b) => b.momento - a.momento);
  }, [reportes, periodo, tipo, estado, ahora]);
  // Retirar cada reporte justo al vencer, también si la pestaña sigue abierta sin conexión.
  useEffect(() => {
    const limite = (periodo === '24h' ? 24 : VISIBLE_HORAS) * 3600_000;
    const tiempo = horaServidor();
    const proximos = reportes.map((r) => r.momento + limite - tiempo).filter((ms) => ms > 0);
    if (!proximos.length) return;
    const siguiente = Math.min(...proximos);
    const temporizador = window.setTimeout(() => setAhora(horaServidor()), Math.min(siguiente + 1, 2_147_483_647));
    return () => window.clearTimeout(temporizador);
  }, [reportes, periodo, ahora, horaServidor]);
  const seleccion = elegido ? visibles.filter((r) => elegido.some((e) => e.numero === r.numero)) : [];

  const hayFiltros = Boolean(tipo || estado);

  // Marcadores: uno por celda; si en la celda hay varios, un grupo con el número.
  const dibujar = useCallback(() => {
    const actual = mapa.current;
    if (!actual) return;
    marcadores.current.forEach((m) => m.remove());
    const grupos = new Map<string, ReportePublico[]>();
    for (const r of visibles) if (r.zona && r.celda) grupos.set(r.celda, [...(grupos.get(r.celda) ?? []), r]);
    marcadores.current = [...grupos.values()].map((g) => {
      const el = document.createElement('button');
      el.type = 'button';
      if (g.length > 1) {
        el.className = 'marcador marcador--grupo';
        el.textContent = String(g.length);
        el.setAttribute('aria-label', `${g.length} reportes en esta zona`);
      } else {
        el.className = `marcador marcador--${g[0].estado}`;
        el.innerHTML = svgTipo(iconoTipo(g[0].tipo));
        el.setAttribute('aria-label', `${nombreTipo(g[0].tipo)}, ${ETIQUETA_ESTADO[g[0].estado]}, ${haceCuando(g[0].momento, ahora)}`);
      }
      el.addEventListener('click', () => setElegido(g));
      return new actual.ml.Marker({ element: el }).setLngLat([g[0].zona!.lon, g[0].zona!.lat]).addTo(actual.m);
    });
  }, [visibles, ahora]);

  useEffect(dibujar, [dibujar]);

  const sinResultados = carga.tipo === 'listo' && visibles.length === 0;

  return (
    <div className="mapa-pantalla">
      <h1 className="oculto-visual">Mapa de reportes de Lomas del Mirador, Lomas del Millón, San Justo y Ramos Mejía</h1>
      {vista === 'mapa' ? (
        <MapaBase
          etiquetaAccesible="Mapa de reportes de Lomas del Mirador, Lomas del Millón, San Justo y Ramos Mejía. La misma información está en la vista de lista."
          alListo={(m, ml) => {
            mapa.current = { m, ml };
            dibujar();
          }}
        />
      ) : (
        <div className="mapa-lienzo" style={{ overflow: 'auto', background: 'var(--blanco)', padding: '64px 16px 16px' }}>
          <h2 className="oculto-visual">Lista de reportes</h2>
          {visibles.length > 0 && (
            <ul className="lista-reportes">
              {visibles.map((r) => (
                <li key={r.numero}>
                  <button type="button" onClick={() => setElegido([r])}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong>{nombreTipo(r.tipo)}</strong>
                      <span className={`estado estado--${r.estado}`}>{ETIQUETA_ESTADO[r.estado]}</span>
                    </span>
                    <span className="ayuda">
                      {haceCuando(r.momento, ahora)} · {r.zona ? 'zona aproximada' : 'Ubicación no publicada'} · N.º {r.numero}
                      {r.demo && <> · <span className="demo">DEMO · datos ficticios</span></>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="filtros">
        <button type="button" className={`filtro${periodo === '48h' ? ' filtro--activo' : ''}`} onClick={() => setHoja('filtros')}>
          {periodo === '24h' ? 'Últimas 24 h' : 'Últimas 48 h'} ▾
        </button>
        <button type="button" className={`filtro${tipo ? ' filtro--activo' : ''}`} onClick={() => setHoja('filtros')}>
          {tipo ? nombreTipo(tipo) : 'Tipo'} ▾
        </button>
        <button type="button" className={`filtro${estado ? ' filtro--activo' : ''}`} onClick={() => setHoja('filtros')}>
          {estado ? ETIQUETA_ESTADO[estado] : 'Estado'} ▾
        </button>
        <button type="button" className="filtro" onClick={() => setVista(vista === 'mapa' ? 'lista' : 'mapa')}>
          {vista === 'mapa' ? 'Lista' : 'Mapa'}
        </button>
      </div>

      {vista === 'mapa' && (
        <div className="mapa-acciones">
          <button type="button" className="filtro" onClick={() => setHoja('leyenda')}>Leyenda</button>
          <button type="button" className="filtro" aria-label="Ver toda la zona" onClick={() => mapa.current?.m.fitBounds(ENCUADRE_BARRIO, { padding: 16 })}>
            Centrar
          </button>
        </div>
      )}

      {(carga.tipo === 'cargando' || carga.tipo === 'lento') && (
        <div className="hoja" role="status">
          <strong>Cargando reportes…</strong>
          {carga.tipo === 'lento' && (
            <>
              <span className="ayuda">Está tardando más de lo normal.</span>
              <button type="button" className="boton boton--secundario" onClick={() => setVista('lista')}>Ver como lista</button>
            </>
          )}
        </div>
      )}

      {carga.tipo === 'error' && (
        <div className="hoja" role="alert">
          <strong>No se pudieron cargar los reportes.</strong>
          <span className="ayuda">Revisá tu conexión y volvé a intentar.</span>
          <button type="button" className="boton boton--primario" onClick={() => location.reload()}>Reintentar</button>
        </div>
      )}

      {carga.tipo === 'listo' && carga.sinConexion && !seleccion.length && (
        <div className="hoja" role="status">
          <strong>Sin conexión</strong>
          <span className="ayuda">Estás viendo lo último que se cargó, a las {horaAR(carga.actualizado)}. Para enviar un reporte necesitás conexión.</span>
        </div>
      )}

      {sinResultados && !seleccion.length && !hoja && (
        <div className="hoja" style={{ textAlign: 'center' }}>
          <strong>
            {hayFiltros
              ? 'No hay reportes publicados con estos filtros'
              : `No hay reportes publicados en ${periodo === '24h' ? 'las últimas 24 horas' : 'las últimas 48 horas'}`}
          </strong>
          <span className="ayuda">Que no haya reportes no significa que no haya pasado nada: muchos hechos no se reportan.</span>
          <div className="fila-botones">
            {hayFiltros ? (
              <button type="button" className="boton boton--secundario" onClick={() => { setTipo(''); setEstado(''); }}>Quitar filtros</button>
            ) : periodo === '24h' ? (
              <button type="button" className="boton boton--secundario" onClick={() => setPeriodo('48h')}>Ver últimas 48 h</button>
            ) : null}
            <a href="/reportar" className="boton boton--primario">Reportar</a>
          </div>
        </div>
      )}

      {hoja === 'filtros' && (
        <Filtros
          inicial={{ periodo, tipo, estado }}
          alAplicar={(f) => { setPeriodo(f.periodo); setTipo(f.tipo); setEstado(f.estado); setHoja(null); }}
          alCerrar={() => setHoja(null)}
        />
      )}
      {hoja === 'leyenda' && <Leyenda alCerrar={() => setHoja(null)} />}
      {seleccion.length > 0 && <Ficha reportes={seleccion} todos={visibles} ahora={ahora} alCerrar={() => setElegido(null)} alElegir={(r) => setElegido([r])} />}
    </div>
  );
}

function Filtros({ inicial, alAplicar, alCerrar }: {
  inicial: { periodo: Periodo; tipo: string; estado: Estado | '' };
  alAplicar: (f: { periodo: Periodo; tipo: string; estado: Estado | '' }) => void;
  alCerrar: () => void;
}) {
  const [f, setF] = useState(inicial);
  return (
    <div className="hoja" role="dialog" aria-label="Filtros">
      <div className="hoja__cabecera"><h2>Filtros</h2><button type="button" className="cerrar" aria-label="Cerrar" onClick={alCerrar} autoFocus>✕</button></div>
      <fieldset className="campo">
        <legend>Período</legend>
        <div className="chips">
          {(['48h', '24h'] as const).map((p) => (
            <label key={p} className="chip"><input type="radio" name="periodo" checked={f.periodo === p} onChange={() => setF({ ...f, periodo: p })} /><span>{p === '24h' ? 'Últimas 24 h' : 'Últimas 48 h'}</span></label>
          ))}
        </div>
      </fieldset>
      <fieldset className="campo">
        <legend>Tipo</legend>
        <div className="chips">
          <label className="chip"><input type="radio" name="tipo" checked={!f.tipo} onChange={() => setF({ ...f, tipo: '' })} /><span>Todos</span></label>
          {TIPOS.map((t) => (
            <label key={t.id} className="chip"><input type="radio" name="tipo" checked={f.tipo === t.id} onChange={() => setF({ ...f, tipo: t.id })} /><span><Icono nombre={t.icono} />{t.nombre}</span></label>
          ))}
        </div>
      </fieldset>
      <fieldset className="campo">
        <legend>Estado</legend>
        <div className="chips">
          <label className="chip"><input type="radio" name="estado" checked={!f.estado} onChange={() => setF({ ...f, estado: '' })} /><span>Todos</span></label>
          {(Object.keys(ETIQUETA_ESTADO) as Estado[]).map((e) => (
            <label key={e} className="chip"><input type="radio" name="estado" checked={f.estado === e} onChange={() => setF({ ...f, estado: e })} /><span>{ETIQUETA_ESTADO[e]}</span></label>
          ))}
        </div>
      </fieldset>
      <div className="fila-botones">
        <button type="button" className="boton boton--secundario" onClick={() => setF({ periodo: '48h', tipo: '', estado: '' })}>Limpiar</button>
        <button type="button" className="boton boton--primario" onClick={() => alAplicar(f)}>Aplicar</button>
      </div>
    </div>
  );
}

function Leyenda({ alCerrar }: { alCerrar: () => void }) {
  return (
    <div className="hoja" role="dialog" aria-label="Leyenda">
      <div className="hoja__cabecera"><h2>Leyenda</h2><button type="button" className="cerrar" aria-label="Cerrar" onClick={alCerrar} autoFocus>✕</button></div>
      <div className="leyenda">
        <div><span className="marcador marcador--sin-verificar"><Icono nombre="calle" /></span>Sin verificar: nadie lo revisó todavía</div>
        <div><span className="marcador marcador--revisado"><Icono nombre="calle" /></span>Revisado por VaLoMi: cumple las reglas, no confirma el hecho</div>
        <div><span className="marcador marcador--corroborado"><Icono nombre="calle" /></span>Corroborado: además, está confirmado</div>
        <div><span className="marcador marcador--grupo">3</span>Varios reportes en la misma zona</div>
      </div>
      <h3>Tipos de hecho</h3>
      <div className="leyenda">
        {TIPOS.map((t) => <div key={t.id}><span className="marcador marcador--sin-verificar"><Icono nombre={t.icono} /></span>{t.nombre}</div>)}
      </div>
      <p className="ayuda">Cada marcador está en el centro de una zona de unas dos manzanas, nunca en el punto exacto.</p>
    </div>
  );
}

function Ficha({ reportes, todos, ahora, alCerrar, alElegir }: {
  reportes: ReportePublico[]; todos: ReportePublico[]; ahora: number; alCerrar: () => void; alElegir: (r: ReportePublico) => void;
}) {
  if (reportes.length > 1) {
    return (
      <div className="hoja" role="dialog" aria-label="Reportes en esta zona">
        <div className="hoja__cabecera"><h2>{reportes.length} reportes en esta zona</h2><button type="button" className="cerrar" aria-label="Cerrar" onClick={alCerrar} autoFocus>✕</button></div>
        <ul className="lista-reportes">
          {reportes.map((r) => (
            <li key={r.numero}>
              <button type="button" onClick={() => alElegir(r)}>
                <strong>{nombreTipo(r.tipo)}</strong>
                <span className="ayuda">{haceCuando(r.momento, ahora)} · {ETIQUETA_ESTADO[r.estado]}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const r = reportes[0];
  // Reportes parecidos: mismo tipo y misma zona en las últimas 48 horas. Es una señal, nunca una prueba.
  const parecidos = r.celda ? todos.filter((x) => x.numero !== r.numero && x.celda === r.celda && x.tipo === r.tipo).length : 0;
  return (
    <div className="hoja" role="dialog" aria-label={`Reporte N.º ${r.numero}`}>
      <div className="hoja__cabecera">
        <h2>{nombreTipo(r.tipo)}</h2>
        <button type="button" className="cerrar" aria-label="Cerrar" onClick={alCerrar} autoFocus>✕</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span className={`estado estado--${r.estado}`}>{ETIQUETA_ESTADO[r.estado]}</span>
        {r.demo && <span className="demo">DEMO · datos ficticios</span>}
      </div>
      <span className="ayuda">{haceCuando(r.momento, ahora)} · {r.zona ? 'zona aproximada' : 'Ubicación no publicada'} · Reporte N.º {r.numero}</span>
      {r.estado === 'sin-verificar' && !r.revisado && <span className="ayuda">Todavía no fue revisado.</span>}
      <p>{r.descripcion}</p>
      {r.editado && <p className="ayuda">[texto editado para quitar datos personales]</p>}
      {r.fotos.length > 0 && (
        <>
          <div className="fotos-ficha">{r.fotos.map((f) => <img key={f} src={f} alt="Foto del reporte, con caras y patentes difuminadas" />)}</div>
          <span className="ayuda">Fotos revisadas · caras y patentes difuminadas</span>
        </>
      )}
      {r.adjuntosEnRevision && <span className="ayuda">Fotos o videos en revisión.</span>}
      {parecidos > 0 && (
        <span className="ayuda">
          Hay {parecidos} {parecidos === 1 ? 'reporte parecido' : 'reportes parecidos'} cerca. Que coincidan no prueba que el hecho ocurrió.
        </span>
      )}
      <a href={`/borrar?numero=${r.numero}`} className="boton boton--texto" style={{ justifySelf: 'start' }}>Pedir que se borre este reporte</a>
    </div>
  );
}

// Los marcadores son elementos HTML de MapLibre: el ícono va como texto SVG.
const RUTAS: Record<string, string> = {
  calle: '<path d="M5 9h14l-1.2 11H6.2z M9 9V7a3 3 0 0 1 6 0v2"/>',
  vivienda: '<path d="M4 11.5 12 5l8 6.5V20H4z M10 20v-5h4v5"/>',
  vehiculo: '<path d="M3 16v-3l2.5-5h13l2.5 5v3z M3 13h18"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>',
  agresion: '<path d="M13.5 3 5 13.5h6.5L10.5 21 19 10.5h-6.5z"/>',
  disparos: '<path d="M12 3l1.9 5.1L19 6.2l-2.1 5 5.1 1.8-5.1 1.8 2.1 5-5.1-1.9L12 21l-1.9-5.1L5 17.8l2.1-5L2 11l5.1-1.8L5 4.2l5.1 1.9z"/>',
  sospechosa: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  otro: '<path d="M6.5 12h.01M12 12h.01M17.5 12h.01" stroke-width="3.4"/>',
};
const svgTipo = (id: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${RUTAS[id] ?? RUTAS.otro}</svg>`;
