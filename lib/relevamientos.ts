// Bandeja privada. Ninguna entrada importada constituye aprobación, corroboración o publicación.
import { posiblesDatosPersonales } from './datos-personales.ts';
import { celda, dentroDelTerritorio } from './geo.mjs';
import LIMITE from './limite-datos.json' with { type: 'json' };
import { errorDescripcion, errorMomento, fechaArgentina, momentoDelHecho, TIPOS } from './reglas.ts';
import type {
  Base, CamposRelevamiento, FichaRelevamiento, FuenteRelevamiento, Reporte,
  ResumenRelevamientos, VistaRelevamientos,
} from './tipos.ts';

const DIA = 24 * 3600_000;
const MAX_TEXTO = 200_000;
const MAX_LOTE = 100;
const MAX_FICHAS = 10_000;
const MAX_ORIGINAL = 12_000;
const anillo = LIMITE as [number, number][];
// Etiquetas del archivo; no son un catálogo administrativo ni amplían el territorio del mapa.
const LOCALIDADES = ['Lomas del Mirador', 'Lomas del Millón', 'San Justo', 'Ramos Mejía', 'González Catán', 'Villa Luzuriaga'];
const nombreNormalizado = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
export type CandidatoImportado = CamposRelevamiento & { identificador: string; textoOriginal: string | null };
type Objeto = Record<string, unknown>;
const objeto = (v: unknown): v is Objeto => Boolean(v && typeof v === 'object' && !Array.isArray(v));

function texto(v: unknown, max: number, campo: string): string {
  if (v == null) return '';
  if (typeof v !== 'string' || v.length > max) throw new Error(`${campo}: texto de hasta ${max} caracteres.`);
  return v.trim();
}
const opcional = (v: unknown, max: number, campo: string) => texto(v, max, campo) || null;

function fecha(v: unknown, campo: string): string | null {
  const s = opcional(v, 10, campo);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`${campo}: usá AAAA-MM-DD o dejá vacío.`);
  const ms = Date.parse(`${s}T00:00:00-03:00`);
  if (!Number.isFinite(ms) || fechaArgentina(ms) !== s) throw new Error(`${campo}: fecha inexistente.`);
  return s;
}

function hora(v: unknown): string | null {
  const s = opcional(v, 5, 'Hora del hecho');
  if (s && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s)) throw new Error('Hora del hecho: usá HH:mm o dejá vacío.');
  return s;
}

/** Solo valida la dirección. Su existencia y pertinencia se revisan a mano, sin hacer fetch arbitrario. */
export function urlFuenteValida(s: string): boolean {
  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase().replace(/\.$/, '');
    return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443')
      && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host)
      && !/^\d+(?:\.\d+){3}$/.test(host)
      && !/(?:^|\.)(?:localhost|local|internal|invalid|test|example)$/.test(host);
  } catch { return false; }
}

function fuentes(v: unknown): FuenteRelevamiento[] {
  if (v == null) return [];
  if (!Array.isArray(v)) throw new Error('Las fuentes de cada hecho deben ser una lista.');
  return v.map((f) => {
    if (!objeto(f)) throw new Error('Revisá el formato de las fuentes.');
    const url = opcional(f.url, 2048, 'URL');
    if (url && !urlFuenteValida(url)) throw new Error('La fuente necesita una URL HTTPS pública, sin credenciales ni direcciones locales.');
    return {
      nombre: texto(f.nombre, 160, 'Nombre de la fuente'),
      plataforma: texto(f.plataforma, 40, 'Plataforma'),
      url,
      fechaPublicacion: fecha(f.fechaPublicacion, 'Fecha de publicación de la fuente'),
    };
  });
}

function campos(v: Objeto, anterior?: CamposRelevamiento): CamposRelevamiento {
  const valor = (k: keyof CamposRelevamiento) => Object.hasOwn(v, k) ? v[k] : anterior?.[k];
  const categoria = opcional(valor('categoria'), 40, 'Categoría');
  if (categoria && !TIPOS.some((t) => t.id === categoria)) throw new Error('Elegí una categoría de la lista o dejala vacía.');
  const p = valor('punto');
  let punto: CamposRelevamiento['punto'] = null;
  if (p != null) {
    if (!objeto(p) || typeof p.lon !== 'number' || typeof p.lat !== 'number'
      || !Number.isFinite(p.lon) || !Number.isFinite(p.lat) || !dentroDelTerritorio(p.lon, p.lat, anillo)) {
      throw new Error('El punto debe estar dentro de la zona del mapa.');
    }
    punto = { lon: p.lon, lat: p.lat };
  }
  const riesgo = valor('riesgo') ?? 'nose';
  if (riesgo !== 'si' && riesgo !== 'no' && riesgo !== 'nose') throw new Error('Revisá el riesgo de publicar la zona.');
  return {
    categoria, resumen: texto(valor('resumen'), 500, 'Resumen'),
    fechaHecho: fecha(valor('fechaHecho'), 'Fecha del hecho'), horaHecho: hora(valor('horaHecho')),
    localidad: opcional(valor('localidad'), 100, 'Localidad'), referencia: opcional(valor('referencia'), 300, 'Referencia'),
    punto, riesgo, fuentes: fuentes(valor('fuentes')),
  };
}

function identificador(v: unknown): string {
  const s = texto(v, 100, 'Identificador').toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._:-]*$/.test(s)) throw new Error('Cada hecho necesita un identificador externo válido.');
  return s;
}

/** JSON estructurado o secciones enumeradas ALR. La prosa nunca se interpreta como datos o instrucciones. */
export function parsearRelevamientos(entrada: string): { candidatos: CandidatoImportado[] } | { error: string } {
  try {
    if (typeof entrada !== 'string' || !entrada.trim() || entrada.length > MAX_TEXTO) {
      return { error: `Pegá un mensaje de hasta ${MAX_TEXTO} caracteres.` };
    }
    const bloques = [...entrada.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/gi)];
    if (bloques.length > 1) return { error: 'Pegá un solo bloque JSON por importación.' };
    const s = (bloques[0]?.[1] ?? entrada).trim();
    let candidatos: CandidatoImportado[];
    if (/^[{[]/.test(s)) {
      const d: unknown = JSON.parse(s);
      if (!objeto(d) || d.formato !== 'valomi-grok-1' || !Array.isArray(d.hechos)) {
        return { error: 'Se espera formato valomi-grok-1 con una lista hechos.' };
      }
      candidatos = d.hechos.map((h) => {
        if (!objeto(h)) throw new Error('Cada hecho debe ser un objeto.');
        // Los puntos, estados, aprobaciones y vínculos nunca se toman del JSON del bot.
        return { ...campos({ ...h, punto: null, riesgo: 'nose' }), identificador: identificador(h.identificador), textoOriginal: null };
      });
    } else {
      const patron = /^[ \t]*(?:#{1,6}\s+)?(?:\*{1,2})?(?:[-*]\s+|\d+[.)]\s*)?(?:\*{1,2})?(ALR-[A-Z0-9]+(?:-[A-Z0-9]+)*)(?=$|[\s.:;|*–—])/gim;
      const secciones = [...s.matchAll(patron)];
      if (!secciones.length) return { error: 'No se encontraron fichas ALR. Pegá el mensaje enumerado o el JSON valomi-grok-1.' };
      candidatos = secciones.map((m, i) => {
        const original = s.slice(m.index!, secciones[i + 1]?.index ?? s.length).trim();
        if (original.length > MAX_ORIGINAL) throw new Error(`Cada ficha ALR admite hasta ${MAX_ORIGINAL} caracteres.`);
        return {
          // El texto crudo vive solo en textoOriginal (30 días); el resumen lo redacta la persona.
          ...campos({ resumen: '' }),
          identificador: identificador(m[1]), textoOriginal: original,
        };
      });
    }
    if (!candidatos.length || candidatos.length > MAX_LOTE) return { error: `Importá entre 1 y ${MAX_LOTE} hechos por lote.` };
    const ids = new Set<string>();
    for (const c of candidatos) {
      if (ids.has(c.identificador)) return { error: `El identificador ${c.identificador} se repite dentro del lote.` };
      ids.add(c.identificador);
    }
    return { candidatos };
  } catch (e) {
    return { error: e instanceof SyntaxError ? 'El JSON no es válido. Revisá el bloque copiado.' : e instanceof Error ? e.message : 'No se pudo leer el mensaje.' };
  }
}

/** Solo para conservación: el inicio del día no se convierte en una hora del hecho. */
export function anclaConservacion(r: Pick<FichaRelevamiento, 'fechaHecho' | 'horaHecho' | 'importado'>): number {
  const conocido = r.fechaHecho ? Date.parse(`${r.fechaHecho}T${r.horaHecho ?? '00:00'}:00-03:00`) : NaN;
  return Number.isFinite(conocido) ? Math.min(conocido, r.importado) : r.importado;
}

export function aplicarConservacionRelevamientos(b: Base, ahora: number) {
  if (!b.relevamientos) return;
  for (const r of b.relevamientos) {
    if (ahora - anclaConservacion(r) > 30 * DIA) {
      r.textoOriginal = null;
      r.punto = null;
      r.referencia = null;
    }
  }
  b.relevamientos = b.relevamientos.filter((r) => ahora - anclaConservacion(r) <= 365 * DIA);
}

export function importarRelevamientos(b: Base, entrada: string, ahora: number): string | null {
  const p = parsearRelevamientos(entrada);
  if ('error' in p) return p.error;
  const existentes = new Set((b.relevamientos ?? []).map((r) => r.identificador));
  const nuevos = p.candidatos.filter((r) => !existentes.has(r.identificador));
  if ((b.relevamientos?.length ?? 0) + nuevos.length > MAX_FICHAS) return 'La bandeja alcanzó su límite. Revisá o exportá los registros conservados.';
  if (nuevos.some((r) => r.fechaHecho && r.fechaHecho > fechaArgentina(ahora))) return 'No se pueden importar hechos con fecha futura.';
  if (nuevos.some((r) => ahora - anclaConservacion({ ...r, importado: ahora }) > 365 * DIA)) return 'El lote contiene hechos que superan el plazo de conservación de un año.';
  const fichas: FichaRelevamiento[] = nuevos.map((r) => ({
    ...r, id: crypto.randomUUID(), origen: 'relevamiento-valomi', importado: ahora, actualizado: ahora,
    aprobado: null, estado: 'pendiente', destino: null, vinculadoA: null, reporteId: null,
    fuentesRevisadas: false, duplicadosRevisados: false,
  }));
  b.relevamientos = [...(b.relevamientos ?? []), ...fichas];
  aplicarConservacionRelevamientos(b, ahora);
  if (fichas.length) b.registro.push({ fecha: ahora, accion: 'Relevamientos importados como pendientes privados', detalle: `${fichas.length} nuevos` });
  return null;
}

export function resumenRelevamientos(b: Base): ResumenRelevamientos {
  const s: ResumenRelevamientos = {
    origen: 'Relevamiento VaLoMi', total: 0, mapa: 0, archivo: 0, sinFecha: 0,
    porFecha: {}, porMes: {}, porCategoria: {}, porZona: {},
  };
  const reportesPresentes = new Set(b.reportes.map((r) => r.id));
  const sumar = (d: Record<string, number>, k: string) => { Object.defineProperty(d, k, { value: (Object.hasOwn(d, k) ? d[k] : 0) + 1, writable: true, enumerable: true, configurable: true }); };
  for (const r of b.relevamientos ?? []) {
    if (r.estado !== 'aprobado') continue;
    // Un reporte borrado por otra vía tampoco permanece en el conteo privado.
    if (r.destino === 'mapa' && (!r.reporteId || !reportesPresentes.has(r.reporteId))) continue;
    s.total += 1;
    if (r.destino === 'mapa') s.mapa += 1; else s.archivo += 1;
    if (r.fechaHecho) { sumar(s.porFecha, r.fechaHecho); sumar(s.porMes, r.fechaHecho.slice(0, 7)); } else s.sinFecha += 1;
    sumar(s.porCategoria, r.categoria ?? 'sinCategoria');
    // Un valor libre mal pegado no debe convertirse en texto personal dentro del export agregado.
    const localidad = r.localidad && LOCALIDADES.find((l) => nombreNormalizado(l) === nombreNormalizado(r.localidad!));
    sumar(s.porZona, localidad || 'sinZona');
  }
  return s;
}

export function vistaRelevamientos(b: Base, ahora: number): VistaRelevamientos {
  const todas = b.relevamientos ?? [];
  const porUrl = new Map<string, { id: string; identificador: string }[]>();
  for (const r of todas) {
    if (r.estado === 'descartado' || r.estado === 'retirado') continue;
    for (const f of r.fuentes) {
      if (!f.url) continue;
      const lista = porUrl.get(f.url) ?? [];
      // Las coincidencias son sugerencias acotadas, no una relación automática entre hechos.
      if (lista.length < 21 && !lista.some((c) => c.id === r.id)) lista.push({ id: r.id, identificador: r.identificador });
      porUrl.set(f.url, lista);
    }
  }
  return {
    fichas: [...todas].sort((a, c) => c.importado - a.importado).map((r) => {
      const faltantes: string[] = [];
      if (errorDescripcion(r.resumen)) faltantes.push('Resumen válido');
      if (!r.fuentes.some((f) => f.url && urlFuenteValida(f.url))) faltantes.push('Fuente HTTPS revisable');
      if (!r.categoria) faltantes.push('Categoría para el mapa');
      if (!r.fechaHecho) faltantes.push('Fecha del hecho');
      if (!r.horaHecho) faltantes.push('Hora del hecho para el mapa');
      if (!r.punto) faltantes.push('Punto revisado para el mapa');
      if (!r.localidad) faltantes.push('Localidad sin precisar');
      const coincidencias = new Map<string, { id: string; identificador: string }>();
      for (const f of r.fuentes) for (const c of (f.url && porUrl.get(f.url)) || []) {
        if (c.id !== r.id && coincidencias.size < 20) coincidencias.set(c.id, c);
      }
      const posiblesDuplicados = [...coincidencias.values()];
      return { ...r, faltantes, posiblesDuplicados, avisoDatos: posiblesDatosPersonales(r.resumen), anclaConservacion: anclaConservacion(r) };
    }),
    resumen: resumenRelevamientos(b),
  };
}

/** Sincroniza retiradas y borrados que entran por las operaciones anteriores de moderación. */
export function retirarFichaDelReporte(b: Base, reporte: Reporte, ahora: number) {
  const ficha = b.relevamientos?.find((r) => r.id === reporte.relevamientoId && r.reporteId === reporte.id);
  if (ficha?.estado === 'aprobado') {
    ficha.estado = 'retirado';
    ficha.actualizado = ahora;
  }
}

export async function accionRelevamiento(
  b: Base, d: Record<string, unknown>, ahora: number, borrar: (archivo: string) => Promise<void>,
): Promise<string | null> {
  if (d.accion === 'relevamiento-importar') return importarRelevamientos(b, typeof d.texto === 'string' ? d.texto : '', ahora);
  const r = b.relevamientos?.find((x) => x.id === d.id);
  if (!r) return 'No se encontró la ficha de relevamiento.';
  if (d.accion === 'relevamiento-retirar') {
    if (r.estado !== 'aprobado') return 'Solo se puede retirar una ficha aprobada.';
    const rep = b.reportes.find((p) => p.id === r.reporteId && p.relevamientoId === r.id);
    if (rep) {
      for (const a of rep.adjuntos) for (const f of [a.original, a.publico]) if (f) await borrar(f);
      b.reportes = b.reportes.filter((p) => p.id !== rep.id);
    }
    r.estado = 'retirado'; r.actualizado = ahora;
    b.registro.push({ fecha: ahora, accion: 'Relevamiento retirado del mapa y de los agregados privados', detalle: r.identificador });
    return null;
  }
  if (r.estado !== 'pendiente') return 'La ficha ya fue resuelta. No se puede aprobar o modificar nuevamente.';
  if (d.accion === 'relevamiento-editar') {
    if (!objeto(d.campos)) return 'Faltan los campos de la ficha.';
    try {
      const nuevos = campos(d.campos, r);
      if (nuevos.fechaHecho && nuevos.fechaHecho > fechaArgentina(ahora)) return 'La fecha del hecho no puede ser futura.';
      if (ahora - anclaConservacion({ ...nuevos, importado: r.importado }) > 365 * DIA) return 'La fecha supera el plazo de conservación de un año.';
      Object.assign(r, nuevos, { actualizado: ahora });
      aplicarConservacionRelevamientos(b, ahora);
      b.registro.push({ fecha: ahora, accion: 'Ficha de relevamiento editada', detalle: r.identificador });
      return null;
    } catch (e) { return e instanceof Error ? e.message : 'No se pudieron validar los campos.'; }
  }
  if (d.accion === 'relevamiento-descartar') {
    r.estado = 'descartado'; r.actualizado = ahora;
    // Una ficha descartada no necesita conservar su texto original ni su punto exacto.
    r.textoOriginal = null; r.punto = null; r.referencia = null;
    b.registro.push({ fecha: ahora, accion: 'Relevamiento descartado', detalle: r.identificador });
    return null;
  }
  if (d.accion === 'relevamiento-vincular') {
    const destino = b.relevamientos?.find((x) => x.id === d.destinoId);
    if (!destino || destino.id === r.id || !['pendiente', 'aprobado'].includes(destino.estado)) return 'Elegí otra ficha pendiente o aprobada como hecho principal.';
    r.estado = 'vinculado'; r.vinculadoA = destino.id; r.actualizado = ahora;
    b.registro.push({ fecha: ahora, accion: 'Relevamiento vinculado sin crear otro hecho', detalle: r.identificador });
    return null;
  }
  if (d.accion !== 'relevamiento-aprobar') return 'Acción de relevamiento desconocida.';
  if (ahora - anclaConservacion(r) > 365 * DIA) return 'La ficha supera el plazo de conservación de un año. No se puede aprobar para este archivo.';
  if (d.destino !== 'archivo' && d.destino !== 'mapa') return 'Elegí archivo privado o mapa.';
  if (d.fuentesRevisadas !== true || d.duplicadosRevisados !== true) return 'Revisá expresamente las fuentes y los posibles duplicados antes de aprobar.';
  const desc = errorDescripcion(r.resumen);
  if (desc) return desc;
  if (posiblesDatosPersonales(r.resumen).length) return 'Quitá los posibles datos personales del resumen antes de aprobar.';
  if (!r.fuentes.some((f) => f.url && urlFuenteValida(f.url))) return 'Agregá y revisá una fuente HTTPS real antes de aprobar.';
  if (r.fechaHecho && r.fechaHecho > fechaArgentina(ahora)) return 'La fecha del hecho no puede ser futura.';
  if (r.fechaHecho && r.horaHecho && Date.parse(`${r.fechaHecho}T${r.horaHecho}:00-03:00`) > ahora) return 'La hora del hecho todavía no pasó.';
  let momento: number | null = null;
  if (d.destino === 'mapa') {
    if (!r.categoria || !TIPOS.some((t) => t.id === r.categoria)) return 'Elegí la categoría antes de publicar.';
    if (r.fechaHecho !== fechaArgentina(ahora) || !r.horaHecho) return 'El mapa solo acepta hechos de hoy en Argentina con hora revisada; los históricos van al archivo privado.';
    momento = momentoDelHecho({ fecha: r.fechaHecho, hora: r.horaHecho }, ahora);
    const err = errorMomento(momento, ahora);
    if (err) return err;
    if (!r.punto || !dentroDelTerritorio(r.punto.lon, r.punto.lat, anillo)) return 'Revisá un punto válido dentro de la zona del mapa.';
  }
  // Todas las validaciones preceden a la creación del reporte y a la transición terminal.
  if (d.destino === 'mapa') {
    const p = r.punto!;
    const id = crypto.randomUUID();
    b.contador += 1;
    const reporte: Reporte = {
      id, numero: String(b.contador).padStart(6, '0'), codigoHash: '', tipo: r.categoria!, descripcion: r.resumen, editado: false,
      exacto: { ...p }, celda: celda(p.lon, p.lat), zonaSuprimida: r.riesgo !== 'no', riesgo: r.riesgo,
      momento: momento!, creado: ahora, estado: 'publicado-revisado', estadoPublico: 'revisado', avisoDatos: [],
      adjuntos: [], confirmacion: null, origen: 'relevamiento-valomi', relevamientoId: r.id,
    };
    b.reportes.push(reporte);
    r.reporteId = id;
  }
  r.estado = 'aprobado'; r.destino = d.destino; r.aprobado = ahora; r.actualizado = ahora;
  r.fuentesRevisadas = true; r.duplicadosRevisados = true;
  aplicarConservacionRelevamientos(b, ahora);
  b.registro.push({ fecha: ahora, accion: d.destino === 'mapa' ? 'Relevamiento aprobado para el mapa' : 'Relevamiento aprobado para el archivo privado', detalle: r.identificador });
  return null;
}
