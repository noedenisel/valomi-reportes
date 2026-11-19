'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Adjunto, DatosMes, InformeMensual, LineaRegistro, MetodoConfirmacion, Reporte, Solicitud } from '@/lib/tipos';
import { nombreMes } from '@/lib/observatorio';
import { DEMO_NAVEGADOR } from '@/lib/modo';
import { ETIQUETA_ESTADO, haceCuando, horaAR } from '@/lib/formato';
import { TIPOS, nombreTipo } from '@/lib/reglas';

// En la demostración online, los archivos vienen como direcciones del propio navegador (urlOriginal).
type ReporteMod = Omit<Reporte, 'adjuntos'> & { plazoMs: number | null; adjuntos: (Adjunto & { urlOriginal?: string | null })[] };
const urlOriginal = (a: { id: string; urlOriginal?: string | null }) => a.urlOriginal ?? `/api/adjuntos/${a.id}?original=1`;
type Datos = {
  pendientes: ReporteMod[]; revisados: ReporteMod[]; solicitudes: (Solicitud & { reporteNumero: string | null })[]; registro: LineaRegistro[];
  observatorio: { meses: { periodo: string; cerrado: boolean }[]; informes: InformeMensual[] };
};

const METODOS: { id: MetodoConfirmacion; nombre: string }[] = [
  { id: 'fuente-oficial', nombre: 'Fuente oficial' },
  { id: 'prensa', nombre: 'Nota de prensa' },
  { id: 'prueba', nombre: 'Prueba revisada' },
  { id: 'visita', nombre: 'Visita al lugar' },
  { id: 'contacto', nombre: 'Contacto con el damnificado' },
];
const MOTIVOS = [
  'Fuera del barrio', 'Hecho de otro día', 'No es un hecho de inseguridad', 'Acusa a una persona identificable',
  'Datos personales que no se pueden quitar', 'Discriminación o discurso de odio', 'Contenido partidario o publicidad', 'Duplicado o spam',
];

export function PanelModeracion() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(() => {
    fetch('/api/moderacion')
      .then((r) => {
        if (r.status === 401) location.href = '/entrar';
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setDatos)
      .catch(() => setMensaje('No se pudo cargar el panel.'));
  }, []);
  useEffect(cargar, [cargar]);

  const accion = async (cuerpo: Record<string, unknown>) => {
    const r = await fetch('/api/moderacion', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
    if (r.status === 401) {
      location.href = '/entrar';
      return;
    }
    const d = await r.json().catch(() => ({}));
    setMensaje(r.ok ? 'Listo.' : d.mensaje ?? 'No se pudo hacer.');
    cargar();
  };

  const salir = async () => {
    await fetch('/api/sesion', { method: 'DELETE' }).catch(() => undefined);
    location.href = '/entrar';
  };

  if (!datos) return <div className="panel"><p>{mensaje ?? 'Cargando…'}</p></div>;

  return (
    <div className="panel">
      <h1>Moderación</h1>
      {DEMO_NAVEGADOR ? (
        <div className="caja caja--gris">
          <p>
            Demostración: este panel trabaja con datos ficticios guardados solo en este navegador. En la versión real, Gabriel entra
            con un enlace que le llega a su correo y ve los reportes de todos los vecinos.
          </p>
          <button type="button" className="boton boton--secundario boton--chico" style={{ justifySelf: 'start' }} onClick={() => accion({ accion: 'reiniciar-demo' })}>
            Reiniciar la demostración
          </button>
        </div>
      ) : process.env.NODE_ENV !== 'production' ? (
        <p className="caja caja--gris">
          Panel de desarrollo local. Sin Supabase trabaja con el archivo de esta computadora; para volver a los datos ficticios
          iniciales: npm run demo.
        </p>
      ) : (
        <button type="button" className="boton boton--secundario boton--chico" style={{ justifySelf: 'start' }} onClick={salir}>
          Salir del panel
        </button>
      )}
      <Link href="/reportar" className="boton boton--primario boton--chico" style={{ justifySelf: 'start' }}>Cargar reporte</Link>
      {mensaje && <p role="status" className="ayuda">{mensaje}</p>}

      <section className="grilla-mod" aria-labelledby="pend">
        <h2 id="pend" style={{ gridColumn: '1 / -1' }}>Para revisar ({datos.pendientes.length})</h2>
        {datos.pendientes.length === 0 && <p className="ayuda">No hay reportes pendientes.</p>}
        {datos.pendientes.map((r) => <Tarjeta key={r.id} r={r} accion={accion} recargar={cargar} />)}
      </section>

      <section className="grilla-mod" aria-labelledby="sol">
        <h2 id="sol" style={{ gridColumn: '1 / -1' }}>Solicitudes de borrado ({datos.solicitudes.length})</h2>
        {datos.solicitudes.length === 0 && <p className="ayuda">No hay solicitudes pendientes.</p>}
        {datos.solicitudes.map((s) => {
          const vence = venceSolicitud(s.creada);
          return (
            <article key={s.id} className={`tarjeta-mod${s.prioridad ? ' tarjeta-mod--retenido' : ''}`}>
              <div className="tarjeta-mod__meta">
                <strong>{s.numero}</strong>
                {s.prioridad && <span className="estado estado--revisado">Prioridad: dice que identifica a alguien</span>}
                <span className={`plazo${vence < Date.now() ? ' plazo--vencido' : ''}`}>
                  {vence < Date.now() ? 'Plazo vencido' : `Quedan ${diasHabilesHasta(vence)} días hábiles`}
                </span>
              </div>
              <p>Reporte: {s.reporteNumero ? `N.º ${s.reporteNumero}` : `no encontrado (${s.referencia})`} · Relación: {s.relacion}</p>
              <p>{s.motivo}</p>
              {s.correo && <p className="ayuda">Avisar a: {s.correo}</p>}
              <div className="fila-botones">
                <button type="button" className="boton boton--primario boton--chico" onClick={() => accion({ accion: 'resolver-solicitud', solicitudId: s.id, resultado: 'borrado' })}>Borrar el reporte</button>
                <button type="button" className="boton boton--secundario boton--chico" onClick={() => accion({ accion: 'resolver-solicitud', solicitudId: s.id, resultado: 'rechazada' })}>Rechazar</button>
              </div>
            </article>
          );
        })}
      </section>

      <Observatorio datos={datos.observatorio} accion={accion} />

      <section className="grilla-mod" aria-labelledby="rev">
        <h2 id="rev" style={{ gridColumn: '1 / -1' }}>Revisados ({datos.revisados.length})</h2>
        {datos.revisados.map((r) => <Tarjeta key={r.id} r={r} accion={accion} recargar={cargar} />)}
      </section>

      <section aria-labelledby="reg" className="caja">
        <h2 id="reg">Registro de moderación (últimos 30)</h2>
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          {datos.registro.map((l, i) => (
            <li key={i}>{horaAR(l.fecha)} · {l.accion}{l.numero ? ` · N.º ${l.numero}` : ''}{l.detalle ? ` · ${l.detalle}` : ''}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Tarjeta({ r, accion, recargar }: { r: ReporteMod; accion: (c: Record<string, unknown>) => Promise<void>; recargar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(r.descripcion);
  const [metodo, setMetodo] = useState<MetodoConfirmacion>('visita');
  const [fuente, setFuente] = useState('');
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const retenido = r.estado === 'retenido';
  return (
    <article className={`tarjeta-mod${retenido ? ' tarjeta-mod--retenido' : ''}`}>
      <div className="tarjeta-mod__meta">
        <strong>N.º {r.numero}</strong>
        <span>{retenido ? 'Retenido (posibles datos personales)' : r.estado === 'publicado-revisado' ? 'Publicado, revisado' : 'Publicado, sin revisar'}</span>
        <span className={`estado estado--${r.estadoPublico}`}>{ETIQUETA_ESTADO[r.estadoPublico]}</span>
        {r.demo && <span className="demo">DEMO</span>}
        {r.plazoMs !== null && (
          <span className={`plazo${r.plazoMs < 0 ? ' plazo--vencido' : ''}`}>
            {r.plazoMs < 0 ? 'Plazo de 12 h vencido' : `Quedan ${Math.floor(r.plazoMs / 3600_000)} h ${Math.floor((r.plazoMs % 3600_000) / 60_000)} min`}
          </span>
        )}
      </div>
      <p><strong>{nombreTipo(r.tipo)}</strong> · {haceCuando(r.momento)} · zona {r.zonaSuprimida ? 'suprimida' : r.celda.id}</p>
      {r.exacto && <p className="ayuda">Punto exacto (solo moderación): {r.exacto.lat.toFixed(5)}, {r.exacto.lon.toFixed(5)}</p>}
      {r.avisoDatos.length > 0 && <p className="error">Aviso automático: posible {r.avisoDatos.join(', ')}. Puede fallar: revisalo a mano.</p>}
      {editando ? (
        <>
          <textarea className="entrada" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Texto del reporte" />
          <div className="fila-botones">
            <button type="button" className="boton boton--primario boton--chico" onClick={async () => { await accion({ accion: 'editar', id: r.id, descripcion: texto }); setEditando(false); }}>Guardar texto editado</button>
            <button type="button" className="boton boton--texto boton--chico" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </>
      ) : (
        <p>{r.descripcion}{r.editado && <span className="ayuda"> [texto editado para quitar datos personales]</span>}</p>
      )}

      {r.adjuntos.length > 0 && (
        <div className="grilla-mod">
          {r.adjuntos.map((a) => (
            <div key={a.id} className="caja">
              <span className="ayuda">{a.clase === 'foto' ? 'Foto' : 'Video'} · {a.estado === 'publicado' ? 'publicada' : a.estado === 'no-publicar' ? 'no se publica' : 'en revisión'}</span>
              {a.original && a.clase === 'foto' && a.estado === 'en-revision' && <EditorFoto reporteId={r.id} adjuntoId={a.id} src={urlOriginal(a)} alTerminar={recargar} />}
              {a.original && a.clase === 'video' && (
                <>
                  <video src={urlOriginal(a)} controls style={{ maxWidth: '100%' }} />
                  <p className="ayuda">El difuminado automático de videos (EgoBlur, en un servidor propio) todavía no está configurado: por ahora los videos sirven solo para verificar.</p>
                </>
              )}
              {a.estado === 'en-revision' && (
                <button type="button" className="boton boton--texto boton--chico" onClick={() => accion({ accion: 'no-publicar-adjunto', id: r.id, adjuntoId: a.id })}>No publicar</button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="fila-botones">
        {r.estado !== 'publicado-revisado' && (
          <button type="button" className="boton boton--primario boton--chico" onClick={() => accion({ accion: 'revisar', id: r.id })}>
            {retenido ? 'Revisado: publicar' : 'Marcar revisado'}
          </button>
        )}
        <button type="button" className="boton boton--secundario boton--chico" onClick={() => setEditando(true)}>Editar texto</button>
        <button type="button" className="boton boton--secundario boton--chico" onClick={() => accion({ accion: 'zona', id: r.id, suprimir: !r.zonaSuprimida })}>
          {r.zonaSuprimida ? 'Mostrar zona' : 'Suprimir zona'}
        </button>
      </div>

      {r.estado === 'publicado-revisado' && r.estadoPublico !== 'corroborado' && (
        <div className="caja caja--gris">
          <label className="campo"><span>Cómo lo confirmaste</span>
            <select className="entrada" value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoConfirmacion)}>
              {METODOS.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </label>
          <label className="campo"><span>Fuente (opcional, no se publica)</span>
            <input className="entrada" value={fuente} onChange={(e) => setFuente(e.target.value)} />
          </label>
          <button type="button" className="boton boton--secundario boton--chico" onClick={() => accion({ accion: 'corroborar', id: r.id, metodo, fuente })}>Marcar Corroborado</button>
        </div>
      )}
      {r.confirmacion && <p className="ayuda">Confirmado por: {METODOS.find((m) => m.id === r.confirmacion!.metodo)?.nombre}{r.confirmacion.fuente ? ` · ${r.confirmacion.fuente}` : ''}</p>}

      <div className="fila-botones">
        <select className="entrada" value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo">
          {MOTIVOS.map((m) => <option key={m}>{m}</option>)}
        </select>
        <button type="button" className="boton boton--texto boton--chico" onClick={() => accion({ accion: 'retirar', id: r.id, motivo })}>
          {retenido ? 'Rechazar' : 'Retirar'}
        </button>
      </div>
    </article>
  );
}

/** Difuminado manual de fotos: Gabriel marca recuadros sobre caras y patentes; se publica la copia difuminada. */
function EditorFoto({ reporteId, adjuntoId, src, alTerminar }: { reporteId: string; adjuntoId: string; src: string; alTerminar: () => void }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement | null>(null);
  const [zonas, setZonas] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const [estado, setEstado] = useState('');

  useEffect(() => {
    const i = new Image();
    i.onload = () => { img.current = i; dibujar([]); };
    i.src = src;
  }, [src]);

  function dibujar(z: typeof zonas, final = false) {
    const c = lienzo.current;
    const i = img.current;
    if (!c || !i) return;
    c.width = i.naturalWidth;
    c.height = i.naturalHeight;
    const g = c.getContext('2d')!;
    g.drawImage(i, 0, 0);
    for (const r of z) {
      // Pixelado fuerte: se reduce la zona a bloques grandes y se vuelve a ampliar.
      const bloque = Math.max(12, Math.round(Math.max(r.w, r.h) / 8));
      const chico = document.createElement('canvas');
      chico.width = Math.max(1, Math.round(r.w / bloque));
      chico.height = Math.max(1, Math.round(r.h / bloque));
      chico.getContext('2d')!.drawImage(c, r.x, r.y, r.w, r.h, 0, 0, chico.width, chico.height);
      g.imageSmoothingEnabled = false;
      g.drawImage(chico, 0, 0, chico.width, chico.height, r.x, r.y, r.w, r.h);
      g.imageSmoothingEnabled = true;
      if (!final) { g.strokeStyle = '#c8102e'; g.lineWidth = Math.max(3, c.width / 300); g.strokeRect(r.x, r.y, r.w, r.h); }
    }
  }

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = lienzo.current!;
    const b = c.getBoundingClientRect();
    return { x: ((e.clientX - b.left) / b.width) * c.width, y: ((e.clientY - b.top) / b.height) * c.height };
  };

  return (
    <div className="editor-foto">
      <canvas
        ref={lienzo}
        aria-label="Foto original. Arrastrá para marcar un recuadro sobre cada cara o patente."
        onPointerDown={(e) => { inicio.current = punto(e); (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId); }}
        onPointerUp={(e) => {
          const a = inicio.current;
          inicio.current = null;
          if (!a) return;
          const b = punto(e);
          const r = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
          if (r.w < 8 || r.h < 8) return;
          const z = [...zonas, r];
          setZonas(z);
          dibujar(z);
        }}
      />
      <p className="ayuda">Arrastrá para marcar un recuadro sobre cada cara, patente o número de casa. {zonas.length} marcado(s).</p>
      <div className="fila-botones">
        <button type="button" className="boton boton--texto boton--chico" onClick={() => { setZonas([]); dibujar([]); }}>Deshacer todo</button>
        <button
          type="button"
          className="boton boton--primario boton--chico"
          onClick={async () => {
            dibujar(zonas, true);
            const blob = await new Promise<Blob | null>((ok) => lienzo.current!.toBlob(ok, 'image/jpeg', 0.9));
            dibujar(zonas);
            if (!blob) return;
            const form = new FormData();
            form.set('reporteId', reporteId);
            form.set('adjuntoId', adjuntoId);
            form.set('archivo', new File([blob], 'difuminada.jpg', { type: 'image/jpeg' }));
            setEstado('Publicando…');
            const r = await fetch('/api/moderacion/foto', { method: 'POST', body: form });
            setEstado(r.ok ? 'Publicada.' : 'No se pudo publicar.');
            if (r.ok) alTerminar();
          }}
        >
          Publicar copia difuminada
        </button>
      </div>
      {estado && <p className="ayuda" role="status">{estado}</p>}
    </div>
  );
}

// 5 días hábiles (lunes a viernes; los feriados no se descuentan todavía).
function venceSolicitud(creada: number) {
  const d = new Date(creada);
  let habiles = 0;
  while (habiles < 5) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) habiles++;
  }
  return d.getTime();
}
function diasHabilesHasta(vence: number) {
  const d = new Date();
  let n = 0;
  while (d.getTime() < vence) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) n++;
  }
  return n;
}

const ESTADOS_PUBLICOS = ['sin-verificar', 'revisado', 'corroborado'] as const;
const ETIQUETA_INFORME = { borrador: 'Borrador', aprobado: 'Aprobado', retirado: 'Retirado' } as const;

/** Observatorio Vecinal: vista previa del mes, borrador, aprobación de Gabriel y archivos para la web. */
function Observatorio({ datos, accion }: { datos: Datos['observatorio']; accion: (c: Record<string, unknown>) => Promise<void> }) {
  const [periodo, setPeriodo] = useState(datos.meses.find((m) => m.cerrado)?.periodo ?? datos.meses[0]?.periodo ?? '');
  const [vista, setVista] = useState<{ datos: DatosMes; cerrado: boolean } | null>(null);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    if (!periodo) return;
    fetch(`/api/observatorio?periodo=${periodo}`).then((r) => r.json()).then(setVista).catch(() => setVista(null));
  }, [periodo, datos.informes.length]);

  const descargar = async (id: string, tipo: 'pdf' | 'datos', nombre: string) => {
    const r = await fetch(`/api/observatorio?${tipo}=${id}`);
    if (!r.ok) return setAviso('No se pudo descargar.');
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(await r.blob());
    enlace.download = `${nombre}.${tipo === 'pdf' ? 'pdf' : 'json'}`;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 5000);
  };

  return (
    <section className="caja" aria-labelledby="obs">
      <h2 id="obs">Observatorio Vecinal · informe mensual</h2>
      <p className="ayuda">Reportes ciudadanos recibidos por VaLoMi. No son estadísticas oficiales ni registros de delitos. Se excluyen los retirados y rechazados.</p>
      {datos.meses.length === 0 ? (
        <p className="ayuda">Todavía no hay reportes para armar un informe.</p>
      ) : (
        <>
          <label className="campo" style={{ maxWidth: 280 }}>
            <span>Mes</span>
            <select className="entrada" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              {datos.meses.map((m) => <option key={m.periodo} value={m.periodo}>{nombreMes(m.periodo)}{m.cerrado ? '' : ' (sin cerrar)'}</option>)}
            </select>
          </label>
          {vista && (
            <>
              {!vista.cerrado && <p className="caja caja--gris">Vista previa: el mes no cerró o no venció el plazo de revisión de sus últimos reportes. Todavía no se puede generar el informe.</p>}
              <div className="tabla-obs" style={{ overflowX: 'auto' }}>
                <table className="tabla-mod">
                  <caption className="oculto-visual">Reportes ciudadanos recibidos por categoría y estado, {nombreMes(periodo)}</caption>
                  <thead><tr><th scope="col">Categoría</th>{ESTADOS_PUBLICOS.map((e) => <th key={e} scope="col">{ETIQUETA_ESTADO[e]}</th>)}<th scope="col">Total</th></tr></thead>
                  <tbody>
                    {TIPOS.map((t) => {
                      const f = vista.datos.porCategoria[t.id];
                      return (
                        <tr key={t.id}><th scope="row">{t.nombre}</th>{ESTADOS_PUBLICOS.map((e) => <td key={e}>{f?.[e] ?? 0}</td>)}<td>{ESTADOS_PUBLICOS.reduce((a, e) => a + (f?.[e] ?? 0), 0)}</td></tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr><th scope="row">Total</th>{ESTADOS_PUBLICOS.map((e) => <td key={e}>{vista.datos.porEstado[e]}</td>)}<td>{vista.datos.total}</td></tr></tfoot>
                </table>
              </div>
              <p className="ayuda">Mapa de calor: {vista.datos.celdas.length} zonas de 200 m con reportes. Sin zona publicada: {vista.datos.sinZona}.</p>
              <button
                type="button"
                className="boton boton--primario boton--chico"
                style={{ justifySelf: 'start' }}
                disabled={!vista.cerrado}
                onClick={() => accion({ accion: 'generar-informe', periodo })}
              >
                Generar borrador de {nombreMes(periodo)}
              </button>
            </>
          )}
        </>
      )}

      {datos.informes.length > 0 && (
        <div className="grilla-mod">
          {datos.informes.map((i) => {
            const nombre = `observatorio-vecinal-${i.periodo}${i.estado === 'borrador' ? '-borrador' : ''}`;
            return (
              <article key={i.id} className="tarjeta-mod">
                <div className="tarjeta-mod__meta">
                  <strong>{nombreMes(i.periodo)}</strong>
                  <span>{ETIQUETA_INFORME[i.estado]}</span>
                  {i.demo && <span className="demo">DEMO</span>}
                </div>
                <p className="ayuda">
                  Generado a las {horaAR(i.generado)} del {new Date(i.generado).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })} · {i.datos.total} reportes
                  {i.aprobado ? ` · aprobado por ${i.aprobado.por}` : ''}
                </p>
                <div className="fila-botones">
                  {i.estado === 'borrador' && <button type="button" className="boton boton--primario boton--chico" onClick={() => accion({ accion: 'aprobar-informe', informeId: i.id })}>Aprobar</button>}
                  {i.estado === 'aprobado' && <button type="button" className="boton boton--texto boton--chico" onClick={() => accion({ accion: 'retirar-informe', informeId: i.id })}>Retirar</button>}
                  <button type="button" className="boton boton--secundario boton--chico" onClick={() => descargar(i.id, 'pdf', nombre)}>PDF</button>
                  {i.estado === 'aprobado' && <button type="button" className="boton boton--secundario boton--chico" onClick={() => descargar(i.id, 'datos', nombre)}>Datos para la web</button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {aviso && <p className="error" role="alert">{aviso}</p>}
    </section>
  );
}
