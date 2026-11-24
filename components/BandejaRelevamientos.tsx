'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { CamposRelevamiento, FichaRelevamientoVista, FuenteRelevamiento, ResumenRelevamientos, VistaRelevamientos } from '@/lib/tipos';
import { parsearRelevamientos, urlFuenteValida } from '@/lib/relevamientos';
import { DEMO_NAVEGADOR } from '@/lib/modo';
import { DESCRIPCION_MAX, TIPOS, errorDescripcion, errorMomento, fechaArgentina, momentoDelHecho, nombreTipo } from '@/lib/reglas';
import { UbicacionPaso, puntoValido } from './UbicacionPaso';

type Accion = (cuerpo: Record<string, unknown>) => Promise<void>;
type Resultado = ReturnType<typeof parsearRelevamientos>;
type Mensaje = { texto: string; error: boolean };
type Filtro = FichaRelevamientoVista['estado'] | 'todos';

const ESTADOS = {
  pendiente: 'Pendiente de revisión',
  aprobado: 'Aprobado',
  vinculado: 'Vinculado como duplicado',
  descartado: 'Descartado',
  retirado: 'Retirado',
} as const;

function camposDe(f: FichaRelevamientoVista): CamposRelevamiento {
  return {
    resumen: f.resumen, categoria: f.categoria, fechaHecho: f.fechaHecho, horaHecho: f.horaHecho,
    localidad: f.localidad, referencia: f.referencia, punto: f.punto ? { ...f.punto } : null,
    riesgo: f.riesgo, fuentes: f.fuentes.map((fuente) => ({ ...fuente })),
  };
}

function fechaTexto(fecha: string | null) {
  return fecha ? fecha.split('-').reverse().join('/') : 'Sin fecha del hecho';
}

function enlaceSeguro(valor: string | null) {
  if (!valor || !urlFuenteValida(valor)) return null;
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function listaDeConteos(valores: Record<string, number>) {
  return Object.fromEntries(Object.entries(valores).filter(([, n]) => Number.isSafeInteger(n) && n >= 0));
}

/** Exportación por lista de campos: nunca incluye fichas, textos, fuentes, identificadores ni coordenadas. */
function descargarResumen(resumen: ResumenRelevamientos) {
  const datos = {
    origen: 'relevamiento-valomi', demo: DEMO_NAVEGADOR,
    total: resumen.total, mapa: resumen.mapa, archivo: resumen.archivo, sinFecha: resumen.sinFecha,
    porFecha: listaDeConteos(resumen.porFecha), porMes: listaDeConteos(resumen.porMes),
    porCategoria: listaDeConteos(resumen.porCategoria), porLocalidad: listaDeConteos(resumen.porZona),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = DEMO_NAVEGADOR ? 'valomi-relevamientos-resumen-DEMO.json' : 'valomi-relevamientos-resumen.json';
  enlace.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BandejaRelevamientos({ datos, accion }: { datos: VistaRelevamientos; accion: Accion }) {
  const id = useId();
  const [texto, setTexto] = useState('');
  const [vista, setVista] = useState<Resultado | null>(null);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const enCurso = useRef(false);
  const [filtro, setFiltro] = useState<Filtro>('pendiente');
  const [mapaAbierto, setMapaAbierto] = useState<string | null>(null);
  const [ahora, setAhora] = useState<number | null>(null);

  useEffect(() => {
    if (window.location.hash === '#relevamientos') document.getElementById('relevamientos')?.scrollIntoView();
  }, []);

  useEffect(() => {
    const actualizar = () => setAhora(Date.now());
    actualizar();
    const reloj = window.setInterval(actualizar, 30_000);
    window.addEventListener('focus', actualizar);
    document.addEventListener('visibilitychange', actualizar);
    return () => {
      window.clearInterval(reloj);
      window.removeEventListener('focus', actualizar);
      document.removeEventListener('visibilitychange', actualizar);
    };
  }, []);

  async function realizar(clave: string, cuerpo: Record<string, unknown>, exito: string) {
    if (enCurso.current) return false;
    enCurso.current = true;
    setOcupado(clave);
    setMensaje(null);
    try {
      await accion(cuerpo);
      setMensaje({ texto: exito, error: false });
      return true;
    } catch (e) {
      setMensaje({ texto: e instanceof Error ? e.message : 'No se pudo guardar. Revisá la conexión y probá de nuevo.', error: true });
      return false;
    } finally {
      enCurso.current = false;
      setOcupado(null);
    }
  }

  const fichas = datos.fichas.filter((f) => filtro === 'todos' || f.estado === filtro);
  const candidatos = vista && 'candidatos' in vista ? vista.candidatos : null;
  const pendientes = datos.fichas.filter((f) => f.estado === 'pendiente').length;

  return (
    <section id="relevamientos" className="caja relevamientos" aria-labelledby={id + '-titulo'} aria-busy={ocupado !== null}>
      <h2 id={id + '-titulo'}>Relevamientos de VaLoMi</h2>
      {DEMO_NAVEGADOR && <p className="ayuda"><strong>DEMO · pruebas guardadas sólo en este navegador.</strong> No modifican el mapa público.</p>}
      <p className="ayuda">Bandeja privada para revisar mensajes ALR o JSON del bot. Pegar o importar un mensaje no lo publica ni lo suma a las estadísticas.</p>
      <p className="ayuda">Origen: Relevamiento VaLoMi. Se distingue de los reportes enviados por vecinos y no constituye una estadística oficial de delitos.</p>

      <p className="ayuda">Se acepta el mensaje ALR actual y el JSON estructurado para futuros hallazgos. Las fechas no se deducen de la prosa. <a href="/formatos/prompt-grok.txt" download>Indicaciones para Grok</a></p>
      <p className="ayuda">Los identificadores ya importados se omiten y conservan sus datos. Para completar una ficha existente, usá «Editar los datos antes de decidir».</p>

      <form className="caja caja--gris" onSubmit={(e) => {
        e.preventDefault();
        setMensaje(null);
        try { setVista(parsearRelevamientos(texto)); }
        catch { setVista({ error: 'No se pudo leer el mensaje. Revisá el formato ALR o JSON.' }); }
      }}>
        <label className="campo" htmlFor={id + '-mensaje'}>
          <span>Mensaje completo o JSON del bot</span>
          <textarea id={id + '-mensaje'} className="entrada" value={texto} disabled={ocupado !== null}
            onChange={(e) => { setTexto(e.target.value); setVista(null); }} spellCheck={false} maxLength={200_000}
            placeholder="Pegá el mensaje completo para revisar qué fichas se extraen." />
        </label>
        <div className="fila-botones">
          <button type="submit" className="boton boton--secundario" disabled={!texto.trim() || ocupado !== null}>Previsualizar sin guardar</button>
          {vista && <button type="button" className="boton boton--texto" disabled={ocupado !== null} onClick={() => setVista(null)}>Cerrar vista previa</button>}
        </div>
        {vista && 'error' in vista && <p className="error" role="alert">{vista.error}</p>}
        {candidatos && (
          <div className="relevamientos__previa">
            <p role="status"><strong>{candidatos.length} ficha(s) detectada(s).</strong> Todavía no se guardaron. Los datos ausentes se mantienen sin completar; ninguna frase del bot equivale a una aprobación.</p>
            <ol className="relevamientos__lista">
              {candidatos.map((c, indice) => (
                <li key={indice} className="caja">
                  <strong>{c.identificador || 'Sin identificador'}</strong>
                  {datos.fichas.some((f) => f.identificador === c.identificador) && <p className="ayuda">Esta ficha ya está importada: se conservará sin crear otra ni reemplazar sus datos.</p>}
                  <p>{c.resumen || 'Sin resumen: deberá completarse.'}</p>
                  <p className="ayuda">{fechaTexto(c.fechaHecho)} · {c.horaHecho || 'Sin hora'} · {c.localidad || 'Sin localidad'}</p>
                  <details><summary>Texto original de esta ficha</summary><pre className="relevamientos__original" tabIndex={0} aria-label="Texto original recibido">{c.textoOriginal || 'No se recibió texto original.'}</pre></details>
                </li>
              ))}
            </ol>
            <button type="button" className="boton boton--primario" disabled={!candidatos.length || ocupado !== null} onClick={async () => {
              const ok = await realizar('importar', { accion: 'relevamiento-importar', texto }, 'Importación guardada. Los nuevos ingresos quedan pendientes privados; importarlos no los aprueba ni publica.');
              if (ok) { setTexto(''); setVista(null); setFiltro('pendiente'); }
            }}>{ocupado === 'importar' ? 'Importando…' : 'Importar como pendientes privados'}</button>
          </div>
        )}
      </form>

      {mensaje && <p className={mensaje.error ? 'error' : 'ayuda'} role={mensaje.error ? 'alert' : 'status'}>{mensaje.texto}</p>}

      <Resumen datos={datos.resumen} ocupado={ocupado !== null} />
      <label className="campo relevamientos__filtro" htmlFor={id + '-filtro'}>
        <span>Ver fichas ({pendientes} pendientes)</span>
        <select id={id + '-filtro'} className="entrada" value={filtro} disabled={ocupado !== null} onChange={(e) => { setFiltro(e.target.value as Filtro); setMapaAbierto(null); }}>
          <option value="pendiente">Pendientes</option>
          <option value="aprobado">Aprobadas</option>
          <option value="vinculado">Vinculadas como duplicado</option>
          <option value="descartado">Descartadas</option>
          <option value="retirado">Retiradas</option>
          <option value="todos">Todas</option>
        </select>
      </label>
      {!fichas.length && <p className="ayuda">No hay fichas con este estado.</p>}
      <div className="relevamientos__fichas">
        {fichas.map((ficha) => <Ficha key={ficha.id + ':' + ficha.actualizado} ficha={ficha} todas={datos.fichas}
          ocupado={ocupado !== null} guardando={ocupado === ficha.id} ahora={ahora}
          mostrarMapa={mapaAbierto === ficha.id} abrirMapa={(abrir) => setMapaAbierto(abrir ? ficha.id : null)} realizar={realizar} />)}
      </div>
    </section>
  );
}

function Resumen({ datos, ocupado }: { datos: ResumenRelevamientos; ocupado: boolean }) {
  return (
    <details className="caja">
      <summary>Resumen estadístico privado · {datos.total} fichas aprobadas</summary>
      <p className="ayuda">Sólo cuentan las fichas aprobadas. Pendientes, duplicadas, descartadas y retiradas quedan fuera. La fecha del hecho no se deduce de la fecha de una publicación.</p>
      <div className="relevamientos__totales">
        <div><strong>{datos.total}</strong><span>Total aprobado</span></div>
        <div><strong>{datos.mapa}</strong><span>Aprobados para mapa</span></div>
        <div><strong>{datos.archivo}</strong><span>Archivo privado</span></div>
        <div><strong>{datos.sinFecha}</strong><span>Sin fecha del hecho</span></div>
      </div>
      <div className="relevamientos__tablas">
        <Conteos titulo="Por mes del hecho" valores={datos.porMes} />
        <Conteos titulo="Por categoría" valores={datos.porCategoria} categorias />
        <Conteos titulo="Por localidad" valores={datos.porZona} />
      </div>
      <p className="ayuda">Las fichas se conservan hasta un año. Exportá el resumen agregado para mantener el histórico. Salir del mapa a las 48 horas no borra por sí solo el registro estadístico aprobado.</p>
      <button type="button" className="boton boton--secundario" disabled={ocupado} onClick={() => descargarResumen(datos)}>Exportar resumen JSON agregado</button>
      <p className="ayuda">La descarga contiene cantidades agrupadas; no incluye textos, fuentes, identificadores ni puntos exactos.</p>
    </details>
  );
}

function Conteos({ titulo, valores, categorias = false }: { titulo: string; valores: Record<string, number>; categorias?: boolean }) {
  const filas = Object.entries(valores).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="relevamientos__conteos">
      <table className="tabla-mod">
        <caption>{titulo}</caption>
        <thead><tr><th scope="col">Grupo</th><th scope="col">Cantidad</th></tr></thead>
        <tbody>{filas.length ? filas.map(([nombre, n]) => <tr key={nombre}><th scope="row">{nombre === 'sinZona' ? 'Sin localidad catalogada' : nombre === 'sinCategoria' ? 'Sin categoría' : categorias && TIPOS.some((t) => t.id === nombre) ? nombreTipo(nombre) : nombre}</th><td>{n}</td></tr>) : <tr><td colSpan={2}>Sin fichas aprobadas en este grupo.</td></tr>}</tbody>
      </table>
    </div>
  );
}

function Ficha({ ficha, todas, ocupado, guardando, ahora, mostrarMapa, abrirMapa, realizar }: {
  ficha: FichaRelevamientoVista; todas: FichaRelevamientoVista[]; ocupado: boolean; guardando: boolean; ahora: number | null;
  mostrarMapa: boolean; abrirMapa: (abrir: boolean) => void;
  realizar: (clave: string, cuerpo: Record<string, unknown>, exito: string) => Promise<boolean>;
}) {
  const id = useId();
  const [campos, setCampos] = useState<CamposRelevamiento>(() => camposDe(ficha));
  const [fuentesRevisadas, setFuentesRevisadas] = useState(false);
  const [duplicadosRevisados, setDuplicadosRevisados] = useState(false);
  const [destinoId, setDestinoId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pendiente = ficha.estado === 'pendiente';
  const modificado = JSON.stringify(campos) !== JSON.stringify(camposDe(ficha));
  const momento = ahora !== null ? momentoDelHecho({ fecha: campos.fechaHecho, hora: campos.horaHecho }, ahora) : null;
  const momentoValido = ahora !== null && !errorMomento(momento, ahora);
  const resumenValido = !errorDescripcion(campos.resumen);
  const fuenteConEnlace = campos.fuentes.some((f) => enlaceSeguro(f.url));
  const instanteInformado = campos.fechaHecho && campos.horaHecho ? Date.parse(campos.fechaHecho + 'T' + campos.horaHecho + ':00-03:00') : null;
  const fechaNoFutura = ahora !== null && (!campos.fechaHecho || campos.fechaHecho <= fechaArgentina(ahora))
    && (instanteInformado === null || (Number.isFinite(instanteInformado) && instanteInformado <= ahora));
  const puedeArchivo = pendiente && !modificado && resumenValido && fuenteConEnlace && ficha.avisoDatos.length === 0 && fechaNoFutura;
  const fechaYHoraDeHoy = ahora !== null && campos.fechaHecho === fechaArgentina(ahora)
    && Boolean(campos.horaHecho && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(campos.horaHecho));
  const categoriaValida = TIPOS.some((t) => t.id === campos.categoria);
  const puedeMapa = puedeArchivo && fechaYHoraDeHoy && categoriaValida && momentoValido && puntoValido(campos.punto);
  const revisado = fuentesRevisadas && duplicadosRevisados;
  const destinos = todas.filter((f) => f.id !== ficha.id && (f.estado === 'pendiente' || f.estado === 'aprobado'));

  function cambiar<K extends keyof CamposRelevamiento>(campo: K, valor: CamposRelevamiento[K]) {
    setCampos((previos) => ({ ...previos, [campo]: valor }));
    setFuentesRevisadas(false);
    setDuplicadosRevisados(false);
    setError(null);
  }
  function cambiarFuente(indice: number, campo: keyof FuenteRelevamiento, valor: string | null) {
    cambiar('fuentes', campos.fuentes.map((f, i) => i === indice ? { ...f, [campo]: valor } : f));
  }
  async function aprobar(destino: 'archivo' | 'mapa') {
    if (ocupado || modificado || !revisado || (destino === 'mapa' ? !puedeMapa : !puedeArchivo)) return;
    await realizar(ficha.id, { accion: 'relevamiento-aprobar', id: ficha.id, destino, fuentesRevisadas: true, duplicadosRevisados: true },
      destino === 'mapa' ? 'Ficha aprobada para el mapa de hoy. Su visibilidad termina a las 48 horas del hecho.' : 'Ficha aprobada para el archivo estadístico.');
  }

  return (
    <article className="tarjeta-mod relevamientos__ficha" aria-busy={guardando}>
      <div className="tarjeta-mod__meta">
        <strong>{ficha.identificador}</strong>
        <span className={'estado estado--' + (pendiente ? 'sin-verificar' : ficha.estado === 'aprobado' ? 'revisado' : 'sin-verificar')}>{ESTADOS[ficha.estado]}</span>
        <span>Relevamiento VaLoMi</span>
      </div>
      <h3>{ficha.resumen || 'Sin resumen'}</h3>
      <p className="ayuda">{fechaTexto(ficha.fechaHecho)} · {ficha.horaHecho || 'Sin hora'} · {ficha.localidad || 'Sin localidad'} · {ficha.categoria ? nombreTipo(ficha.categoria) : 'Sin categoría'}</p>
      {ficha.referencia && <p>Referencia: {ficha.referencia}</p>}
      {ficha.punto && <p className="ayuda">Punto exacto privado: {ficha.punto.lat.toFixed(5)}, {ficha.punto.lon.toFixed(5)}. Revisalo antes de elegir el destino mapa.</p>}
      {ficha.destino && <p className="ayuda">Destino aprobado: {ficha.destino === 'mapa' ? 'Mapa de hoy y registro estadístico' : 'Archivo estadístico'}.</p>}
      {ficha.vinculadoA && <p className="ayuda">Duplicado de {todas.find((f) => f.id === ficha.vinculadoA)?.identificador || 'otra ficha del archivo'}. No agrega otro conteo.</p>}
      {ficha.faltantes.length > 0 && (
        <div className="caja caja--roja"><strong>Falta completar o revisar</strong><ul className="relevamientos__lista">{ficha.faltantes.map((f) => <li key={f}>{f}</li>)}</ul></div>
      )}
      {ficha.avisoDatos.length > 0 && <p className="error">Revisá posibles datos personales: {ficha.avisoDatos.join(', ')}. El aviso automático puede fallar.</p>}
      {ficha.posiblesDuplicados.length > 0 && <p className="ayuda"><strong>Posibles duplicados:</strong> {ficha.posiblesDuplicados.map((f) => f.identificador).join(', ')}. La coincidencia automática no decide qué ocurrió.</p>}

      <details><summary>Texto original recibido</summary><pre className="relevamientos__original" tabIndex={0} aria-label="Texto original recibido">{ficha.textoOriginal || 'El texto original no está disponible.'}</pre></details>
      <details>
        <summary>Fuentes ({ficha.fuentes.length})</summary>
        {ficha.fuentes.length === 0 ? <p className="ayuda">No se recibieron fuentes identificadas.</p> : <ul className="relevamientos__lista">
          {ficha.fuentes.map((fuente, i) => <li key={i}>
            <strong>{fuente.nombre || 'Fuente sin nombre'}</strong>{fuente.plataforma ? ' · ' + fuente.plataforma : ''}
            {fuente.fechaPublicacion && <span> · Publicación: {fechaTexto(fuente.fechaPublicacion)}</span>}
            {fuente.url && (enlaceSeguro(fuente.url) ? <a className="relevamientos__url" href={fuente.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{fuente.url}</a> : <p className="error">URL para revisar: {fuente.url}</p>)}
          </li>)}
        </ul>}
      </details>

      {pendiente && (
        <>
          <details className="caja caja--gris">
            <summary>Editar los datos antes de decidir</summary>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (ocupado || !modificado) return;
              if (campos.fuentes.some((f) => f.url && !enlaceSeguro(f.url))) { setError('Revisá las URL: usá enlaces HTTPS completos o dejá el campo sin completar.'); return; }
              const ok = await realizar(ficha.id, { accion: 'relevamiento-editar', id: ficha.id, campos }, 'Cambios guardados. Revisá las fuentes y los duplicados antes de aprobar.');
              if (ok) abrirMapa(false);
            }}>
              <fieldset className="campo relevamientos__edicion" disabled={ocupado}>
                <label className="campo" htmlFor={id + '-categoria'}><span>Categoría</span>
                  <select id={id + '-categoria'} className="entrada" value={campos.categoria || ''} onChange={(e) => cambiar('categoria', e.target.value || null)}>
                    <option value="">Sin categoría</option>
                    {campos.categoria && !TIPOS.some((t) => t.id === campos.categoria) && <option value={campos.categoria}>{campos.categoria} (importada, revisar)</option>}
                    {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </label>
                <label className="campo" htmlFor={id + '-resumen'}><span>Resumen</span>
                  <textarea id={id + '-resumen'} className="entrada" value={campos.resumen || ''} onChange={(e) => cambiar('resumen', e.target.value)} maxLength={DESCRIPCION_MAX} />
                </label>
                <p className="ayuda">El resumen puede publicarse si aprobás el destino mapa. Quitá datos personales y referencias que identifiquen a una persona.</p>
                <div className="relevamientos__dos">
                  <label className="campo" htmlFor={id + '-fecha'}><span>Fecha del hecho</span><input id={id + '-fecha'} className="entrada" type="date" value={campos.fechaHecho || ''} onChange={(e) => cambiar('fechaHecho', e.target.value || null)} /></label>
                  <label className="campo" htmlFor={id + '-hora'}><span>Hora del hecho (Argentina)</span><input id={id + '-hora'} className="entrada" type="time" value={campos.horaHecho || ''} onChange={(e) => cambiar('horaHecho', e.target.value || null)} /></label>
                </div>
                <p className="ayuda">Si no consta la fecha o la hora del hecho, dejala vacía. La fecha de una noticia no completa la del hecho.</p>
                <label className="campo" htmlFor={id + '-localidad'}><span>Localidad</span><input id={id + '-localidad'} className="entrada" maxLength={100} value={campos.localidad || ''} onChange={(e) => cambiar('localidad', e.target.value || null)} /></label>
                <label className="campo" htmlFor={id + '-referencia'}><span>Referencia del lugar</span><input id={id + '-referencia'} className="entrada" maxLength={300} value={campos.referencia || ''} onChange={(e) => cambiar('referencia', e.target.value || null)} /></label>
                <p className="ayuda">Escribir una referencia no elige un punto en el mapa.</p>
                <div className="fila-botones">
                  <button type="button" className="boton boton--secundario" onClick={() => abrirMapa(!mostrarMapa)}>{mostrarMapa ? 'Cerrar selector de punto' : campos.punto ? 'Revisar punto en el mapa' : 'Marcar punto en el mapa'}</button>
                  {campos.punto && <button type="button" className="boton boton--texto" onClick={() => { cambiar('punto', null); abrirMapa(false); }}>Quitar punto</button>}
                </div>
                {campos.punto ? <p className="ayuda">Punto exacto privado: {campos.punto.lat.toFixed(5)}, {campos.punto.lon.toFixed(5)}.</p> : <p className="ayuda">Sin punto elegido. Se necesita uno para aprobar el destino mapa.</p>}
                {mostrarMapa && <UbicacionPaso punto={campos.punto} alCambiar={(punto) => cambiar('punto', punto)} error={campos.punto && !puntoValido(campos.punto) ? 'El punto queda fuera de la zona habilitada para el mapa.' : null} />}
                <label className="campo" htmlFor={id + '-riesgo'}><span>¿Mostrar la zona puede identificar a alguien?</span>
                  <select id={id + '-riesgo'} className="entrada" value={campos.riesgo} onChange={(e) => cambiar('riesgo', e.target.value as CamposRelevamiento['riesgo'])}><option value="nose">No sé</option><option value="no">No</option><option value="si">Sí</option></select>
                </label>
                <h4>Fuentes de la ficha</h4>
                {campos.fuentes.map((fuente, i) => (
                  <fieldset key={i} className="caja">
                    <legend>Fuente {i + 1}</legend>
                    <label className="campo"><span>Nombre o identificador</span><input className="entrada" maxLength={160} value={fuente.nombre} onChange={(e) => cambiarFuente(i, 'nombre', e.target.value)} /></label>
                    <label className="campo"><span>Plataforma o medio</span><input className="entrada" maxLength={40} value={fuente.plataforma} onChange={(e) => cambiarFuente(i, 'plataforma', e.target.value)} /></label>
                    <label className="campo"><span>URL original (HTTPS)</span><input className="entrada" type="text" inputMode="url" autoComplete="off" maxLength={2048} value={fuente.url || ''} onChange={(e) => cambiarFuente(i, 'url', e.target.value || null)} /></label>
                    <label className="campo"><span>Fecha de publicación, si consta</span><input className="entrada" type="date" value={fuente.fechaPublicacion || ''} onChange={(e) => cambiarFuente(i, 'fechaPublicacion', e.target.value || null)} /></label>
                    <button type="button" className="boton boton--texto" onClick={() => cambiar('fuentes', campos.fuentes.filter((_, indice) => indice !== i))}>Quitar esta fuente</button>
                  </fieldset>
                ))}
                <button type="button" className="boton boton--secundario" disabled={campos.fuentes.length >= 10} onClick={() => cambiar('fuentes', [...campos.fuentes, { nombre: '', plataforma: '', url: null, fechaPublicacion: null }])}>Añadir fuente</button>
                {error && <p className="error" role="alert">{error}</p>}
                <div className="fila-botones">
                  <button type="submit" className="boton boton--primario" disabled={!modificado}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
                  <button type="button" className="boton boton--texto" disabled={!modificado} onClick={() => { setCampos(camposDe(ficha)); setError(null); setFuentesRevisadas(false); setDuplicadosRevisados(false); abrirMapa(false); }}>Deshacer cambios sin guardar</button>
                </div>
              </fieldset>
            </form>
          </details>
          <fieldset className="campo relevamientos__decision" disabled={ocupado || modificado}>
            <legend>Decisión individual</legend>
            <label className="casilla"><input type="checkbox" checked={fuentesRevisadas} onChange={(e) => setFuentesRevisadas(e.target.checked)} /><span>Revisé las fuentes y sus límites. Una afirmación del bot no equivale a confirmación oficial.</span></label>
            <label className="casilla"><input type="checkbox" checked={duplicadosRevisados} onChange={(e) => setDuplicadosRevisados(e.target.checked)} /><span>Revisé posibles duplicados y confirmé que esta aprobación no sumará otra vez el mismo hecho.</span></label>
            <div className="fila-botones">
              <button type="button" className="boton boton--primario" disabled={!revisado || !puedeArchivo} onClick={() => aprobar('archivo')}>Aprobar para archivo estadístico</button>
              <button type="button" className="boton boton--secundario" disabled={!revisado || !puedeMapa} onClick={() => aprobar('mapa')}>Aprobar para mapa de hoy</button>
            </div>
          </fieldset>
          {modificado && <p className="error">Hay cambios sin guardar. Guardalos antes de aprobar o vincular.</p>}
          {!puedeArchivo && <p className="ayuda">Para aprobar, guardá un resumen de 20 a 500 caracteres sin datos personales ni enlaces, y al menos una fuente HTTPS. Las fechas y horas informadas no pueden ser futuras.</p>}
          {!puedeMapa && <p className="ayuda">Para el mapa: fecha de hoy en Argentina, hora ya transcurrida, punto elegido dentro de la zona y una fuente HTTPS. El resumen público admite hasta {DESCRIPCION_MAX} caracteres. Los hechos anteriores o sin fecha se revisan para el archivo estadístico.</p>}
          <details className="caja">
            <summary>Vincular como duplicado o descartar</summary>
            <label className="campo" htmlFor={id + '-duplicado'}><span>Ficha que ya representa el mismo hecho</span>
              <select id={id + '-duplicado'} className="entrada" value={destinoId} disabled={ocupado || modificado} onChange={(e) => setDestinoId(e.target.value)}><option value="">Elegí una ficha existente</option>{destinos.map((f) => <option key={f.id} value={f.id}>{f.identificador} · {f.resumen || 'Sin resumen'}</option>)}</select>
            </label>
            <div className="fila-botones">
              <button type="button" className="boton boton--secundario" disabled={ocupado || modificado || !destinoId} onClick={() => realizar(ficha.id, { accion: 'relevamiento-vincular', id: ficha.id, destinoId }, 'Ficha vinculada como duplicado; no agrega otro conteo.')}>Vincular como duplicado</button>
              <button type="button" className="boton boton--texto" disabled={ocupado} onClick={() => realizar(ficha.id, { accion: 'relevamiento-descartar', id: ficha.id }, 'Ficha descartada; no se publica ni cuenta.')}>Descartar ficha</button>
            </div>
          </details>
        </>
      )}
      {ficha.estado === 'aprobado' && <button type="button" className="boton boton--texto" disabled={ocupado} onClick={() => realizar(ficha.id, { accion: 'relevamiento-retirar', id: ficha.id }, 'Ficha retirada del destino aprobado y del resumen estadístico.')}>Retirar ficha aprobada</button>}
      {Number.isFinite(ficha.anclaConservacion) && <p className="ayuda">Conservación de esta ficha: hasta {new Date(ficha.anclaConservacion + 365 * 86400_000).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}. Exportá los agregados para conservar el histórico.</p>}
    </article>
  );
}
