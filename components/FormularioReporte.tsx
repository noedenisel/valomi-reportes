'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CLAVE_CAPTCHA, Captcha } from './Captcha';
import { Icono } from './Iconos';
import { UbicacionPaso, puntoValido, type Punto } from './UbicacionPaso';
import { posiblesDatosPersonales } from '@/lib/datos-personales';
import { DEMO_NAVEGADOR } from '@/lib/modo';
import {
  DESCRIPCION_MAX, FOTO_MAX_MB, FOTOS_MAX, RIESGOS, TIPOS, TIPOS_FOTO, TIPOS_VIDEO, VIDEO_MAX_MB, VIDEO_MAX_S,
  errorDescripcion, errorMomento, fechaArgentina, momentoDelHecho, nombreTipo,
} from '@/lib/reglas';

// Lo que se escribe vive solo en la memoria de esta pantalla: nunca se guarda en el teléfono (decisión aprobada).
type Adjunto = { id: string; clase: 'foto' | 'video'; archivo: File; vista: string };
type Datos = {
  tipo: string; descripcion: string; punto: Punto | null; riesgo: string;
  fecha: string; hora: string; adjuntos: Adjunto[]; acepto: boolean;
};
type Errores = Partial<Record<'tipo' | 'descripcion' | 'ubicacion' | 'riesgo' | 'cuando' | 'adjuntos' | 'acepto', string>>;
type Envio = { tipo: 'nada' } | { tipo: 'enviando'; progreso: number } | { tipo: 'error'; mensaje: string } | { tipo: 'listo'; codigo: string; retenido: boolean };

const VACIO: Datos = { tipo: '', descripcion: '', punto: null, riesgo: '', fecha: '', hora: '', adjuntos: [], acepto: false };
const TITULOS = ['Qué pasó', 'Dónde', 'Cuándo', 'Fotos y envío'];

const SIN_CONEXION = 'No hay conexión. Lo que cargaste sigue acá: revisá la señal y tocá «Reintentar».';

function subirArchivo(url: string, archivo: File, alAvanzar: (bytes: number) => void) {
  return new Promise<void>((resolver, rechazar) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', archivo.type);
    xhr.upload.onprogress = (ev) => ev.lengthComputable && alAvanzar(ev.loaded);
    xhr.onload = () => (xhr.status < 300 ? resolver() : rechazar(new Error('No se pudo subir un archivo. Probá de nuevo.')));
    xhr.onerror = () => rechazar(new Error(SIN_CONEXION));
    xhr.send(archivo);
  });
}

/** Con Supabase los archivos van directo al almacenamiento y el servidor los procesa al recibir el reporte. Devuelve si fue así. */
async function subirDirecto(adjuntos: Adjunto[], form: FormData, captcha: string, alAvanzar: (progreso: number) => void) {
  if (!adjuntos.length) return false;
  const r = await fetch('/api/reportes/subidas', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ captcha, archivos: adjuntos.map((a) => ({ clase: a.clase, mime: a.archivo.type, bytes: a.archivo.size })) }),
  }).catch(() => {
    throw new Error(SIN_CONEXION);
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.mensaje ?? 'El servicio no responde. Probá de nuevo en unos minutos.');
  if (!datos.directa) return false;
  form.set('pase', datos.pase);
  const total = adjuntos.reduce((s, a) => s + a.archivo.size, 0);
  let listos = 0;
  for (const [i, a] of adjuntos.entries()) {
    const s = datos.subidas[i];
    await subirArchivo(s.url, a.archivo, (bytes) => alAvanzar((listos + bytes) / total));
    listos += a.archivo.size;
    form.append('subidas', JSON.stringify({ id: s.id, clase: s.clase, mime: s.mime }));
  }
  return true;
}

export function FormularioReporte({ moderacion = false }: { moderacion?: boolean }) {
  const router = useRouter();
  const trampaRef = useRef<HTMLInputElement>(null);
  const [captcha, setCaptcha] = useState('');
  const [reinicioCaptcha, setReinicioCaptcha] = useState(0);
  const [paso, setPaso] = useState(1);
  const [d, setD] = useState<Datos>(VACIO);
  const [errores, setErrores] = useState<Errores>({});
  const [avisoDatos, setAvisoDatos] = useState<string[] | null>(null);
  const [salir, setSalir] = useState(false);
  const [desdeResumen, setDesdeResumen] = useState(false);
  const [envio, setEnvio] = useState<Envio>({ tipo: 'nada' });
  const [sinConexion, setSinConexion] = useState(false);
  const [hoyArgentina, setHoyArgentina] = useState('');
  const resumenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const actualizar = () => { setSinConexion(!navigator.onLine); setHoyArgentina(fechaArgentina()); };
    actualizar();
    window.addEventListener('online', actualizar);
    window.addEventListener('offline', actualizar);
    window.addEventListener('focus', actualizar);
    document.addEventListener('visibilitychange', actualizar);
    const reloj = window.setInterval(actualizar, 10_000);
    return () => { window.clearInterval(reloj); window.removeEventListener('online', actualizar); window.removeEventListener('offline', actualizar); window.removeEventListener('focus', actualizar); document.removeEventListener('visibilitychange', actualizar); };
  }, []);

  const cambiar = <K extends keyof Datos>(k: K, v: Datos[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setErrores((e) => ({ ...e, [clave(k)]: undefined }));
  };

  function validar(n: number): Errores {
    const e: Errores = {};
    if (n === 1) {
      if (!d.tipo) e.tipo = 'Elegí el tipo de hecho.';
      const err = errorDescripcion(d.descripcion);
      if (err) e.descripcion = err;
    }
    if (n === 2) {
      if (!d.punto) e.ubicacion = 'Marcá en el mapa dónde pasó.';
      else if (!puntoValido(d.punto)) e.ubicacion = 'Ese punto queda fuera de la zona del mapa (Lomas del Mirador, Lomas del Millón, San Justo y Ramos Mejía). Por ahora solo se aceptan reportes de esa zona.';
      if (!d.riesgo) e.riesgo = 'Indicá si mostrar la zona puede identificar a alguien.';
    }
    if (n === 3) {
      const err = errorMomento(momentoDelHecho({ fecha: d.fecha || null, hora: d.hora || null }));
      if (err) e.cuando = err;
    }
    if (n === 4 && !d.acepto) e.acepto = 'Para enviar, confirmá que leíste la política de privacidad.';
    return e;
  }

  function siguiente(saltarAviso = false) {
    const e = validar(paso);
    setErrores(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], .resumen-errores')?.focus());
      return;
    }
    if (paso === 1 && !saltarAviso) {
      const posibles = posiblesDatosPersonales(d.descripcion);
      if (posibles.length) { setAvisoDatos(posibles); return; }
    }
    setAvisoDatos(null);
    if (desdeResumen) { setDesdeResumen(false); setPaso(4); }
    else setPaso(paso + 1);
    window.scrollTo(0, 0);
  }

  async function agregar(archivos: FileList | null, clase: 'foto' | 'video') {
    if (!archivos?.length) return;
    const nuevos: Adjunto[] = [];
    let error: string | undefined;
    for (const f of Array.from(archivos)) {
      const fotos = d.adjuntos.filter((a) => a.clase === 'foto').length + nuevos.filter((a) => a.clase === 'foto').length;
      const videos = d.adjuntos.filter((a) => a.clase === 'video').length + nuevos.filter((a) => a.clase === 'video').length;
      if ((clase === 'foto' && fotos >= FOTOS_MAX) || (clase === 'video' && videos >= 1)) { error = 'Podés subir hasta 4 fotos y 1 video.'; break; }
      if (clase === 'foto') {
        if (!TIPOS_FOTO.includes(f.type)) { error = 'Ese formato no se puede subir. Probá con una foto JPG o un video MP4.'; continue; }
        if (f.size > FOTO_MAX_MB * 1024 * 1024) { error = 'La foto pesa más de 10 MB.'; continue; }
        // Se vuelve a codificar en el teléfono: así se descartan los metadatos (ubicación GPS, modelo, fecha).
        const limpia = await recodificar(f).catch(() => null);
        if (!limpia) { error = 'No se pudo leer esa foto. Probá con otra.'; continue; }
        nuevos.push({ id: crypto.randomUUID(), clase, archivo: limpia, vista: URL.createObjectURL(limpia) });
      } else {
        if (!TIPOS_VIDEO.includes(f.type)) { error = 'Ese formato no se puede subir. Probá con una foto JPG o un video MP4.'; continue; }
        const duracion = await duracionVideo(f).catch(() => Infinity);
        if (f.size > VIDEO_MAX_MB * 1024 * 1024 || duracion > VIDEO_MAX_S + 0.5) { error = 'El video dura más de 30 segundos o pesa más de 50 MB.'; continue; }
        nuevos.push({ id: crypto.randomUUID(), clase, archivo: f, vista: URL.createObjectURL(f) });
      }
    }
    setD((x) => ({ ...x, adjuntos: [...x.adjuntos, ...nuevos] }));
    setErrores((e) => ({ ...e, adjuntos: error }));
  }

  function enviar() {
    const e = validar(4);
    // La fecha se vuelve a controlar al enviar: puede cambiar el día mientras se completa.
    const cuando = validar(3);
    setErrores({ ...e, ...cuando });
    if (Object.keys(e).length || Object.keys(cuando).length) return;
    const form = new FormData();
    form.set('tipo', d.tipo);
    form.set('descripcion', d.descripcion.trim());
    form.set('lon', String(d.punto!.lon));
    form.set('lat', String(d.punto!.lat));
    form.set('riesgo', d.riesgo);
    form.set('hora', d.hora);
    form.set('fecha', d.fecha);
    form.set('dia', 'hoy');
    form.set('acepto', 'si');
    form.set('sitio', trampaRef.current?.value ?? '');
    form.set('captcha', captcha);
    const adjuntarAlFormulario = () => {
      for (const a of d.adjuntos) form.append(a.clase === 'foto' ? 'fotos' : 'videos', a.archivo);
    };

    if (CLAVE_CAPTCHA && !captcha && !moderacion) {
      setEnvio({ tipo: 'error', mensaje: 'Todavía se está comprobando que no sos un robot. Esperá unos segundos y tocá «Reintentar».' });
      return;
    }

    setEnvio({ tipo: 'enviando', progreso: 0 });
    if (DEMO_NAVEGADOR) {
      adjuntarAlFormulario();
      // En la demostración no hay subida real: el envío lo atiende el propio navegador.
      fetch('/api/reportes', { method: 'POST', body: form })
        .then(async (r) => {
          const datos = await r.json().catch(() => ({}));
          if (r.ok) {
            d.adjuntos.forEach((a) => URL.revokeObjectURL(a.vista));
            setD(VACIO);
            setEnvio({ tipo: 'listo', codigo: datos.codigo, retenido: datos.retenido });
            window.scrollTo(0, 0);
          } else {
            if (datos.campo) setErrores({ [datos.campo]: datos.mensaje });
            setEnvio({ tipo: 'error', mensaje: datos.mensaje ?? 'El servicio no responde. Probá de nuevo en unos minutos.' });
          }
        })
        .catch(() => setEnvio({ tipo: 'error', mensaje: 'No se pudo enviar. Probá de nuevo.' }));
      return;
    }
    subirDirecto(d.adjuntos, form, captcha, (progreso) => setEnvio({ tipo: 'enviando', progreso }))
      .then((directa) => {
        if (!directa) adjuntarAlFormulario();
        enviarFormulario(form, directa);
      })
      .catch((err: Error) => setEnvio({ tipo: 'error', mensaje: err.message }));
  }

  function enviarFormulario(form: FormData, directa: boolean) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/reportes');
    if (!directa) xhr.upload.onprogress = (ev) => ev.lengthComputable && setEnvio({ tipo: 'enviando', progreso: ev.loaded / ev.total });
    xhr.onload = () => {
      const r = (() => { try { return JSON.parse(xhr.responseText); } catch { return {}; } })();
      if (xhr.status === 200) {
        d.adjuntos.forEach((a) => URL.revokeObjectURL(a.vista));
        setD(VACIO);
        setEnvio({ tipo: 'listo', codigo: r.codigo, retenido: r.retenido });
        window.scrollTo(0, 0);
      } else {
        if (r.campo) setErrores({ [r.campo]: r.mensaje });
        setEnvio({ tipo: 'error', mensaje: r.mensaje ?? 'El servicio no responde. Probá de nuevo en unos minutos.' });
      }
    };
    xhr.onerror = () => setEnvio({ tipo: 'error', mensaje: SIN_CONEXION });
    xhr.send(form);
  }

  // Cada captcha sirve una sola vez: si el envío falló después de usarlo, se pide otro para el reintento.
  useEffect(() => {
    if (envio.tipo !== 'error' || !captcha) return;
    setCaptcha('');
    setReinicioCaptcha((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envio]);

  if (envio.tipo === 'listo') return <Confirmacion codigo={envio.codigo} retenido={envio.retenido} />;

  const hayErrores = Object.values(errores).filter(Boolean).length;

  return (
    <div className="contenedor">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.2rem' }}>Reportar un hecho</h1>
        <button type="button" className="boton boton--texto boton--chico" onClick={() => (JSON.stringify(d) === JSON.stringify(VACIO) ? router.push('/') : setSalir(true))}>
          Salir
        </button>
      </div>
      <div className="progreso" aria-hidden="true">{[1, 2, 3, 4].map((n) => <i key={n} className={n <= paso ? 'hecho' : ''} />)}</div>
      <p className="paso">Paso {paso} de 4 · {TITULOS[paso - 1]}</p>
      {moderacion && <p className="caja caja--gris" role="status">Estás cargando desde el panel de moderación: sin captcha y sin tope de envíos. El reporte entra como cualquier otro, «Sin verificar».</p>}
      {sinConexion && <p className="caja caja--gris" role="status">Sin conexión. Podés seguir completando, pero para enviar necesitás conexión.</p>}
      {d.fecha && hoyArgentina && d.fecha !== hoyArgentina && <p className="caja caja--roja" role="alert">Cambió el día en Argentina. Este hecho corresponde al día anterior y ya no se puede enviar. Solo se admiten hechos de hoy.</p>}
      {hayErrores > 0 && (
        <p className="resumen-errores" role="alert" tabIndex={-1}>
          {hayErrores === 1 ? 'Falta 1 dato para seguir' : `Faltan ${hayErrores} datos para seguir`}
        </p>
      )}

      {paso === 1 && (
        <>
          <fieldset className="campo">
            <legend className="titulo-paso">¿Qué pasó?</legend>
            <div className="chips">
              {TIPOS.map((t) => (
                <label key={t.id} className="chip">
                  <input type="radio" name="tipo" value={t.id} checked={d.tipo === t.id} onChange={() => cambiar('tipo', t.id)} aria-invalid={Boolean(errores.tipo)} />
                  <span><Icono nombre={t.icono} />{t.nombre}</span>
                </label>
              ))}
            </div>
            {errores.tipo && <p className="error">{errores.tipo}</p>}
          </fieldset>
          <div className="campo">
            <label htmlFor="descripcion">Contá brevemente qué pasó</label>
            <textarea
              id="descripcion" className="entrada" value={d.descripcion} maxLength={DESCRIPCION_MAX}
              onChange={(e) => cambiar('descripcion', e.target.value)} aria-invalid={Boolean(errores.descripcion)} aria-describedby="descripcion-ayuda"
            />
            <span className="contador">{d.descripcion.trim().length} / {DESCRIPCION_MAX}</span>
            {errores.descripcion && <p className="error">{errores.descripcion}</p>}
            <p id="descripcion-ayuda" className="caja caja--gris ayuda">No escribas nombres, teléfonos, patentes ni direcciones exactas. Describí lo que pasó, no cómo es una persona.</p>
          </div>
        </>
      )}

      {paso === 2 && (
        <>
          <h2 className="titulo-paso">¿Dónde pasó?</h2>
          <UbicacionPaso punto={d.punto} alCambiar={(p) => cambiar('punto', p)} error={errores.ubicacion ?? null} />
          <fieldset className="campo">
            <legend>¿Mostrar la zona puede identificar a alguien?</legend>
            <div className="chips">
              {RIESGOS.map((r) => (
                <label key={r.id} className="chip">
                  <input type="radio" name="riesgo" checked={d.riesgo === r.id} onChange={() => cambiar('riesgo', r.id)} aria-invalid={Boolean(errores.riesgo)} />
                  <span>{r.nombre}</span>
                </label>
              ))}
            </div>
            {errores.riesgo && <p className="error">{errores.riesgo}</p>}
            <p className="ayuda">En el mapa público se muestra una zona aproximada, nunca el punto exacto. Si respondés «Sí» o «No sé», la zona no se muestra.</p>
          </fieldset>
        </>
      )}

      {paso === 3 && (
        <>
          <div className="campo">
            <label htmlFor="hora-hecho" className="titulo-paso">¿A qué hora pasó hoy?</label>
            <p id="fecha-hecho" className="ayuda">Solo se aceptan hechos del día actual en Argentina{hoyArgentina ? ` (${hoyArgentina})` : ''}.</p>
            <input
              id="hora-hecho" type="time" className="entrada" value={d.hora}
              onChange={(e) => {
                const hora = e.target.value;
                setD((x) => ({ ...x, hora, fecha: hora ? fechaArgentina() : '' }));
                setErrores((x) => ({ ...x, cuando: undefined }));
              }}
              aria-invalid={Boolean(errores.cuando)} aria-describedby="fecha-hecho error-cuando" required
            />
          </div>
          {errores.cuando && <p id="error-cuando" className="error" role="alert">{errores.cuando}</p>}
          <p className="caja caja--gris">Indicá una hora que ya pasó hoy, en horario de Argentina. Los reportes se muestran hasta 48 horas desde el hecho. Para hechos de otros días, podés hacer la denuncia en la comisaría o en la fiscalía.</p>
        </>
      )}

      {paso === 4 && (
        <>
          <h2 className="titulo-paso">Fotos o videos (opcional)</h2>
          <div className="fila-botones">
            <label className="boton boton--secundario">
              <Icono nombre="foto" /> Agregar foto
              <input type="file" accept="image/*" multiple hidden onChange={(e) => { agregar(e.target.files, 'foto'); e.target.value = ''; }} />
            </label>
            <label className="boton boton--secundario">
              <Icono nombre="video" /> Agregar video
              <input type="file" accept="video/mp4,video/quicktime" hidden onChange={(e) => { agregar(e.target.files, 'video'); e.target.value = ''; }} />
            </label>
          </div>
          {d.adjuntos.length > 0 && (
            <div className="miniaturas">
              {d.adjuntos.map((a) => (
                <div key={a.id} className="miniatura">
                  {a.clase === 'foto' ? <img src={a.vista} alt="Foto cargada" /> : <video src={a.vista} muted aria-label="Video cargado" />}
                  <button type="button" aria-label="Quitar" onClick={() => { URL.revokeObjectURL(a.vista); cambiar('adjuntos', d.adjuntos.filter((x) => x.id !== a.id)); }}>✕</button>
                </div>
              ))}
            </div>
          )}
          {errores.adjuntos && <p className="error" role="alert">{errores.adjuntos}</p>}
          <p className="ayuda">Hasta 4 fotos y 1 video de 30 segundos. Evitá caras, patentes y números de casa. A los archivos se les quitan los datos de ubicación antes de guardarlos.</p>

          <div className="caja resumen" ref={resumenRef}>
            <Resumen etiqueta="Qué" valor={nombreTipo(d.tipo)} alEditar={() => { setDesdeResumen(true); setPaso(1); }} />
            <Resumen etiqueta="Dónde" valor={d.riesgo === 'no' ? 'Zona aproximada en el mapa' : 'Ubicación no publicada'} alEditar={() => { setDesdeResumen(true); setPaso(2); }} />
            <Resumen etiqueta="Cuándo" valor={d.hora ? `${d.fecha} a las ${d.hora} (Argentina)` : ''} alEditar={() => { setDesdeResumen(true); setPaso(3); }} />
          </div>

          <div className="trampa" aria-hidden="true">
            <label htmlFor="sitio">No completar</label>
            <input id="sitio" name="sitio" ref={trampaRef} tabIndex={-1} autoComplete="off" />
          </div>

          {!moderacion && <Captcha alCambiar={setCaptcha} reinicio={reinicioCaptcha} />}

          <label className="casilla">
            <input type="checkbox" checked={d.acepto} onChange={(e) => cambiar('acepto', e.target.checked)} aria-invalid={Boolean(errores.acepto)} />
            <span>Leí la <Link href="/privacidad">política de privacidad</Link> y lo que cuento lo vi o lo viví.</span>
          </label>
          {errores.acepto && <p className="error">{errores.acepto}</p>}

          {envio.tipo === 'enviando' && (
            <div className="caja" role="status">
              <strong>Enviando tu reporte…</strong>
              <div className="barra-carga"><i style={{ width: `${Math.round(envio.progreso * 100)}%` }} /></div>
              <span className="ayuda">No cierres la app hasta que termine.</span>
            </div>
          )}
          {envio.tipo === 'error' && (
            <div className="caja caja--roja" role="alert">
              <strong>No se pudo enviar el reporte</strong>
              <span>{envio.mensaje}</span>
              <span className="ayuda">Si cambia el día en Argentina antes de que se pueda enviar, el reporte ya no se acepta. Revisá la fecha y la hora antes de reintentar.</span>
            </div>
          )}
        </>
      )}

      <div className="fila-botones">
        {paso > 1 && !desdeResumen && <button type="button" className="boton boton--secundario" onClick={() => setPaso(paso - 1)}>Atrás</button>}
        {paso < 4 ? (
          <button type="button" className="boton boton--primario" onClick={() => siguiente()}>{desdeResumen ? 'Volver al resumen' : 'Siguiente'}</button>
        ) : (
          <button type="button" className="boton boton--primario" disabled={envio.tipo === 'enviando' || sinConexion} onClick={enviar}>
            {envio.tipo === 'enviando' ? 'Enviando…' : envio.tipo === 'error' ? 'Reintentar' : 'Enviar reporte'}
          </button>
        )}
      </div>

      {avisoDatos && (
        <div className="dialogo-fondo" role="dialog" aria-modal="true" aria-labelledby="aviso-datos">
          <div className="dialogo">
            <h2 id="aviso-datos">¿Hay datos personales?</h2>
            <p>El texto parece tener {avisoDatos.join(', ')}. Revisalo antes de seguir.</p>
            <p className="ayuda">Esta revisión automática puede no detectar todo y también puede marcar datos que no lo son. Si seguís igual, el reporte no se publica enseguida: queda retenido hasta que lo revisen.</p>
            <button type="button" autoFocus className="boton boton--primario" onClick={() => { setAvisoDatos(null); document.getElementById('descripcion')?.focus(); }}>Corregir</button>
            <button type="button" className="boton boton--texto" onClick={() => siguiente(true)}>Seguir igual</button>
          </div>
        </div>
      )}

      {salir && (
        <div className="dialogo-fondo" role="dialog" aria-modal="true" aria-labelledby="salir-titulo">
          <div className="dialogo">
            <h2 id="salir-titulo">¿Salir sin enviar?</h2>
            <p>Se pierde lo que cargaste.</p>
            <button type="button" autoFocus className="boton boton--primario" onClick={() => setSalir(false)}>Seguir cargando</button>
            <button type="button" className="boton boton--texto" onClick={() => router.push('/')}>Salir</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Resumen({ etiqueta, valor, alEditar }: { etiqueta: string; valor: string; alEditar: () => void }) {
  return (
    <div>
      <span><strong>{etiqueta}:</strong> {valor}</span>
      <button type="button" className="boton boton--texto boton--chico" onClick={alEditar}>Editar</button>
    </div>
  );
}

function Confirmacion({ codigo, retenido }: { codigo: string; retenido: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="contenedor" style={{ textAlign: 'center' }}>
      <span className="icono-exito"><Icono nombre="check" /></span>
      <h1 className="titulo-paso">Reporte recibido</h1>
      <p>
        {retenido
          ? 'Como el texto podría tener datos personales, se revisa antes de publicarse: aparece en el mapa después de la revisión, en 12 horas como máximo.'
          : 'Ya aparece en el mapa como «Sin verificar». Después se revisa: si tiene datos personales se editan, y si no cumple las reglas se retira.'}
      </p>
      <strong>Tu código de reporte</strong>
      <div className="codigo" ref={ref}>{codigo}</div>
      <button
        type="button"
        className="boton boton--secundario"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(codigo);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2500);
          } catch {
            const sel = window.getSelection();
            if (ref.current && sel) { const r = document.createRange(); r.selectNodeContents(ref.current); sel.removeAllRanges(); sel.addRange(r); }
          }
        }}
      >
        <Icono nombre="copiar" /> Copiar código
      </button>
      <p className="ayuda">Guardalo: lo vas a necesitar si después querés pedir que se borre. No se vuelve a mostrar.</p>
      <p className="caja caja--roja" style={{ textAlign: 'left' }}>Si la situación sigue en curso, llamá al 911.</p>
      <Link href="/mapa" className="boton boton--primario">Ver el mapa</Link>
      <Link href="/" className="boton boton--texto">Volver al inicio</Link>
      {copiado && <p className="toast" role="status">Código copiado</p>}
    </div>
  );
}

const clave = (k: keyof Datos): keyof Errores =>
  (({ punto: 'ubicacion', hora: 'cuando', fecha: 'cuando' }) as Record<string, keyof Errores>)[k] ?? (k as keyof Errores);

/** Vuelve a codificar la foto como JPEG (máx. 2560 px): descarta los metadatos y achica el envío. */
async function recodificar(f: File): Promise<File> {
  const bmp = await createImageBitmap(f);
  const escala = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * escala);
  c.height = Math.round(bmp.height * escala);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.88));
  if (!blob) throw new Error('sin imagen');
  return new File([blob], 'foto.jpg', { type: 'image/jpeg' });
}

function duracionVideo(f: File): Promise<number> {
  return new Promise((ok, mal) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { ok(v.duration); URL.revokeObjectURL(v.src); };
    v.onerror = () => mal(new Error('video'));
    v.src = URL.createObjectURL(f);
  });
}
