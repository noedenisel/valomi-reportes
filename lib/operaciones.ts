// Operaciones de la app sobre los datos, sin depender de dónde se guardan.
// Las usan el servidor (archivo local hoy, Supabase después) y el modo demostración en el navegador,
// así la demostración aplica exactamente las mismas reglas que la app real.
import { celda, dentroDelTerritorio } from './geo.mjs';
import LIMITE from './limite-datos.json' with { type: 'json' };
import { posiblesDatosPersonales } from './datos-personales.ts';
import {
  EMAIL, FOTO_MAX_MB, FOTOS_MAX, MOTIVO_BORRADO_MAX, MOTIVO_BORRADO_MIN, PLAZO_REVISION_H, RIESGOS, TIPOS, TIPOS_FOTO,
  TIPOS_VIDEO, VIDEO_MAX_MB, VIDEOS_MAX, errorDescripcion, errorMomento, fechaArgentina, momentoDelHecho,
} from './reglas.ts';
import type { Adjunto, Base, MetodoConfirmacion, Reporte, Solicitud } from './tipos.ts';
import { aprobarInforme, generarInforme, limitesMes, mesCerrado, mesesConReportes, periodoDe, retirarInforme } from './observatorio.ts';

const anillo = LIMITE as [number, number][];
const DIA = 24 * 3600_000;
export type ErrorApp = { status: number; mensaje: string; campo?: string };
export type BorrarArchivo = (nombre: string) => Promise<void>;

export const baseVacia = (): Base => ({ reportes: [], solicitudes: [], registro: [], contador: 0 });

// ---------- Códigos ----------
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function bloque(n: number) {
  return [...crypto.getRandomValues(new Uint8Array(n))].map((x) => ALFABETO[x % ALFABETO.length]).join('');
}
export const nuevoCodigo = (prefijo: string) => `${prefijo}-${bloque(4)}-${bloque(4)}`;
export const nuevoId = () => crypto.randomUUID();
/** Huella SHA-256 del código: el código nunca se guarda tal cual. */
export async function hashCodigo(codigo: string) {
  const datos = new TextEncoder().encode(codigo.trim().toUpperCase().replace(/\s/g, ''));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', datos))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function siguienteNumero(b: Base) {
  b.contador += 1;
  return String(b.contador).padStart(6, '0');
}

// ---------- Conservación ----------
/** Plazos aprobados: punto exacto y originales, 30 días desde el hecho; versión pública, 1 año; registro, 1 año. */
export async function aplicarConservacion(b: Base, ahora: number, borrar: BorrarArchivo) {
  for (const r of b.reportes) {
    if (ahora - r.momento > 30 * DIA) {
      r.exacto = null;
      for (const a of r.adjuntos) {
        if (a.original) await borrar(a.original);
        a.original = null;
      }
    }
  }
  for (const r of b.reportes.filter((r) => ahora - r.momento > 365 * DIA)) await borrarArchivos(r, borrar);
  b.reportes = b.reportes.filter((r) => ahora - r.momento <= 365 * DIA);
  b.solicitudes = b.solicitudes.filter((s) => !s.resuelta || ahora - s.resuelta <= 365 * DIA);
  b.registro = b.registro.filter((l) => ahora - l.fecha <= 365 * DIA);
}

async function borrarArchivos(r: Reporte, borrar: BorrarArchivo) {
  for (const a of r.adjuntos) for (const f of [a.original, a.publico]) if (f) await borrar(f);
}

// ---------- Reportes ----------
export type CamposReporte = {
  tipo: string; descripcion: string; lon: number; lat: number; riesgo: string;
  fecha: string | null; rango: string | null; dia: 'hoy' | 'ayer' | 'anteayer' | null; hora: string | null; acepto: boolean;
  fotos: { type: string; size: number }[]; videos: { type: string; size: number }[];
};
export type DatosReporte = { tipo: string; descripcion: string; lon: number; lat: number; riesgo: Reporte['riesgo']; momento: number };

export function errorAdjunto(clase: 'foto' | 'video', tipo: string, bytes: number) {
  if (!(clase === 'foto' ? TIPOS_FOTO : TIPOS_VIDEO).includes(tipo)) return 'Ese formato no se puede subir. Probá con una foto JPG o un video MP4.';
  if (clase === 'foto' && bytes > FOTO_MAX_MB * 1024 * 1024) return 'La foto pesa más de 10 MB.';
  // La duración (30 s) la controla el teléfono; acá se controla el peso.
  if (clase === 'video' && bytes > VIDEO_MAX_MB * 1024 * 1024) return 'El video dura más de 30 segundos o pesa más de 50 MB.';
  return null;
}

export function validarReporte(c: CamposReporte, ahora: number): { error: ErrorApp } | { datos: DatosReporte } {
  const mal = (mensaje: string, campo?: string) => ({ error: { status: 400, mensaje, campo } });
  if (!TIPOS.some((t) => t.id === c.tipo)) return mal('Elegí el tipo de hecho.', 'tipo');
  const descripcion = c.descripcion.trim();
  const errDesc = errorDescripcion(descripcion);
  if (errDesc) return mal(errDesc, 'descripcion');
  if (!Number.isFinite(c.lon) || !Number.isFinite(c.lat)) return mal('Marcá en el mapa dónde pasó.', 'ubicacion');
  if (!dentroDelTerritorio(c.lon, c.lat, anillo)) {
    return mal('Ese punto queda fuera de la zona del mapa (Lomas del Mirador, Lomas del Millón, San Justo y Ramos Mejía). Por ahora solo se aceptan reportes de esa zona.', 'ubicacion');
  }
  if (!RIESGOS.some((r) => r.id === c.riesgo)) return mal('Indicá si mostrar la zona puede identificar a alguien.', 'riesgo');
  // El servidor fija el día válido: no se confía en la fecha o el reloj del teléfono.
  if (c.fecha !== fechaArgentina(ahora)) return mal('Solo se aceptan hechos de hoy, en horario de Argentina. Revisá la fecha y la hora.', 'cuando');
  const momento = momentoDelHecho({ fecha: c.fecha, rango: c.rango, dia: c.dia, hora: c.hora }, ahora);
  const errMom = errorMomento(momento, ahora);
  if (errMom) return mal(errMom, 'cuando');
  if (!c.acepto) return mal('Para enviar, confirmá que leíste la política de privacidad.', 'acepto');
  if (c.fotos.length > FOTOS_MAX || c.videos.length > VIDEOS_MAX) return mal('Podés subir hasta 4 fotos y 1 video.', 'adjuntos');
  for (const [clase, lista] of [['foto', c.fotos], ['video', c.videos]] as const) {
    for (const f of lista) {
      const errAdj = errorAdjunto(clase, f.type, f.size);
      if (errAdj) return mal(errAdj, 'adjuntos');
    }
  }
  return { datos: { tipo: c.tipo, descripcion, lon: c.lon, lat: c.lat, riesgo: c.riesgo as Reporte['riesgo'], momento: momento! } };
}

export function crearReporte(b: Base, d: DatosReporte, adjuntos: Adjunto[], codigoHash: string, ahora: number) {
  const avisoDatos = posiblesDatosPersonales(d.descripcion);
  const retenido = avisoDatos.length > 0;
  const r: Reporte = {
    id: nuevoId(),
    numero: siguienteNumero(b),
    codigoHash,
    tipo: d.tipo,
    descripcion: d.descripcion,
    editado: false,
    exacto: { lon: d.lon, lat: d.lat },
    celda: celda(d.lon, d.lat),
    zonaSuprimida: d.riesgo !== 'no',
    riesgo: d.riesgo,
    momento: d.momento,
    creado: ahora,
    estado: retenido ? 'retenido' : 'publicado-sin-revisar',
    estadoPublico: 'sin-verificar',
    avisoDatos,
    adjuntos,
    confirmacion: null,
  };
  b.reportes.push(r);
  b.registro.push({ fecha: ahora, accion: retenido ? 'Reporte recibido y retenido' : 'Reporte recibido y publicado', numero: r.numero });
  return { retenido, numero: r.numero };
}

// ---------- Solicitudes de borrado ----------
const RELACIONES = ['autor', 'afectado', 'otra'] as const;

/** Solicitud de borrado: la revisa Gabriel a mano en 5 días hábiles. El reporte sigue visible mientras tanto. */
export async function crearSolicitud(b: Base, d: Record<string, unknown>, ahora: number): Promise<{ error: ErrorApp } | { numero: string }> {
  const mal = (mensaje: string, campo?: string) => ({ error: { status: 400, mensaje, campo } });
  const relacion = String(d.relacion ?? '');
  if (!RELACIONES.includes(relacion as Solicitud['relacion'])) return mal('Elegí tu relación con el reporte.', 'relacion');
  const referencia = String(d.referencia ?? '').trim().toUpperCase();
  if (!referencia) return mal('Escribí el código de reporte o el número público.', 'referencia');
  const motivo = String(d.motivo ?? '').trim();
  if (motivo.length < MOTIVO_BORRADO_MIN || motivo.length > MOTIVO_BORRADO_MAX) {
    return mal(`Contá el motivo en ${MOTIVO_BORRADO_MIN} a ${MOTIVO_BORRADO_MAX} caracteres.`, 'motivo');
  }
  const correo = String(d.correo ?? '').trim().toLowerCase() || null;
  if (correo && !EMAIL.test(correo)) return mal('Revisá el correo: parece que no está bien escrito.', 'correo');

  const huella = await hashCodigo(referencia);
  const porCodigo = b.reportes.find((r) => r.codigoHash === huella);
  const porNumero = b.reportes.find((r) => r.numero === referencia.replace(/\D/g, '').padStart(6, '0'));
  const reporte = porCodigo ?? porNumero ?? null;
  const s: Solicitud = {
    id: nuevoId(),
    numero: nuevoCodigo('BOR'),
    relacion: relacion as Solicitud['relacion'],
    referencia: porCodigo ? 'código de reporte (verificado)' : referencia,
    reporteId: reporte?.id ?? null,
    motivo,
    correo,
    // Aprobado: primero en el panel si dice que el reporte identifica a alguien.
    prioridad: relacion === 'afectado' || /identific|datos personales|mi nombre|mi casa|mi cara|mi patente/i.test(motivo),
    creada: ahora,
    estado: 'pendiente',
    resuelta: null,
  };
  b.solicitudes.push(s);
  b.registro.push({ fecha: ahora, accion: 'Solicitud de borrado recibida', numero: reporte?.numero, detalle: s.numero });
  return { numero: s.numero };
}

// ---------- Moderación ----------
const METODOS: MetodoConfirmacion[] = ['fuente-oficial', 'prensa', 'prueba', 'visita', 'contacto'];

export function vistaModeracion(b: Base, ahora: number) {
  const plazo = (r: Reporte) => r.creado + PLAZO_REVISION_H * 3600_000 - ahora;
  // Orden aprobado: primero los retenidos, después los publicados sin revisar, por el plazo que les queda.
  const pendientes = b.reportes
    .filter((r) => r.estado !== 'publicado-revisado')
    .sort((a, c) => (a.estado === c.estado ? plazo(a) - plazo(c) : a.estado === 'retenido' ? -1 : 1))
    .map((r) => ({ ...r, plazoMs: plazo(r) as number | null }));
  const revisados = b.reportes
    .filter((r) => r.estado === 'publicado-revisado')
    .sort((a, c) => c.momento - a.momento)
    .map((r) => ({ ...r, plazoMs: null as number | null }));
  const solicitudes = b.solicitudes
    .filter((s) => s.estado === 'pendiente')
    .sort((a, c) => Number(c.prioridad) - Number(a.prioridad) || a.creada - c.creada)
    .map((s) => ({ ...s, reporteNumero: b.reportes.find((r) => r.id === s.reporteId)?.numero ?? null }));
  const observatorio = {
    meses: mesesConReportes(b).map((periodo) => ({ periodo, cerrado: mesCerrado(periodo, ahora) })),
    informes: [...(b.informes ?? [])].sort((a, c) => c.periodo.localeCompare(a.periodo) || c.generado - a.generado),
  };
  return { pendientes, revisados, solicitudes, observatorio, registro: b.registro.slice(-30).reverse() };
}

/** Devuelve un mensaje de error, o null si la acción se hizo. */
export async function accionModeracion(b: Base, d: Record<string, unknown>, ahora: number, borrar: BorrarArchivo): Promise<string | null> {
  const anotar = (accion: string, numero?: string, detalle?: string) => b.registro.push({ fecha: ahora, accion, numero, detalle });
  const r = d.id ? b.reportes.find((x) => x.id === d.id) : undefined;
  const quitar = async (rep: Reporte) => {
    await borrarArchivos(rep, borrar);
    b.reportes = b.reportes.filter((x) => x.id !== rep.id);
  };

  switch (d.accion) {
    case 'revisar': // también publica un retenido
      if (!r) return 'No se encontró el reporte.';
      anotar(r.estado === 'retenido' ? 'Retenido revisado y publicado' : 'Reporte revisado', r.numero);
      r.estado = 'publicado-revisado';
      r.estadoPublico = 'revisado';
      return null;
    case 'corroborar':
      if (!r) return 'No se encontró el reporte.';
      if (r.estado !== 'publicado-revisado') return 'Primero hay que marcarlo como «Revisado por VaLoMi».';
      if (!METODOS.includes(d.metodo as MetodoConfirmacion)) return 'Elegí cómo lo confirmaste.';
      r.estadoPublico = 'corroborado';
      r.confirmacion = { metodo: d.metodo as MetodoConfirmacion, fuente: String(d.fuente ?? '').trim() || null };
      anotar('Corroborado', r.numero, String(d.metodo));
      return null;
    case 'editar': {
      if (!r) return 'No se encontró el reporte.';
      const texto = String(d.descripcion ?? '').trim();
      const err = errorDescripcion(texto);
      if (err) return err;
      r.descripcion = texto;
      r.editado = true;
      anotar('Texto editado para quitar datos personales', r.numero);
      return null;
    }
    case 'zona':
      if (!r) return 'No se encontró el reporte.';
      r.zonaSuprimida = Boolean(d.suprimir);
      anotar(r.zonaSuprimida ? 'Zona suprimida' : 'Zona publicada', r.numero);
      return null;
    case 'retirar': // publicado → retirado; retenido → rechazado. Se borra todo salvo esta línea del registro.
      if (!r) return 'No se encontró el reporte.';
      anotar(r.estado === 'retenido' ? 'Rechazado' : 'Retirado', r.numero, String(d.motivo ?? ''));
      await quitar(r);
      return null;
    case 'no-publicar-adjunto': {
      const a = r?.adjuntos.find((x) => x.id === d.adjuntoId);
      if (!r || !a) return 'No se encontró el adjunto.';
      a.estado = 'no-publicar';
      anotar('Adjunto marcado para no publicar', r.numero);
      return null;
    }
    case 'resolver-solicitud': {
      const s = b.solicitudes.find((x) => x.id === d.solicitudId);
      if (!s) return 'No se encontró la solicitud.';
      s.estado = d.resultado === 'borrado' ? 'borrado' : 'rechazada';
      s.resuelta = ahora;
      const rep = b.reportes.find((x) => x.id === s.reporteId);
      if (s.estado === 'borrado' && rep) await quitar(rep);
      anotar(s.estado === 'borrado' ? 'Solicitud aceptada: reporte borrado' : 'Solicitud rechazada', rep?.numero, s.numero);
      return null;
    }
    case 'generar-informe':
      return generarInforme(b, String(d.periodo ?? ''), ahora);
    case 'aprobar-informe':
      return aprobarInforme(b, String(d.informeId ?? ''), ahora);
    case 'retirar-informe':
      return retirarInforme(b, String(d.informeId ?? ''), ahora);
    default:
      return 'Acción desconocida.';
  }
}

/** Gabriel publica la copia difuminada de una foto. */
export function publicarFoto(b: Base, reporteId: string, adjuntoId: string, archivo: string, ahora: number): string | null {
  const r = b.reportes.find((x) => x.id === reporteId);
  const a = r?.adjuntos.find((x) => x.id === adjuntoId && x.clase === 'foto');
  if (!r || !a) return 'No se encontró la foto.';
  a.publico = archivo;
  a.estado = 'publicado';
  b.registro.push({ fecha: ahora, accion: 'Foto difuminada y publicada', numero: r.numero });
  return null;
}

// ---------- Demostración ----------
/**
 * Datos FICTICIOS para la demostración, todos marcados como DEMO.
 * guardarFoto copia la foto de demostración y devuelve el nombre del archivo guardado.
 */
export async function sembrarDemo(ahora: number, guardarFoto: () => Promise<string>, bytesFoto: number): Promise<Base> {
  const H = 3600_000;
  const b = baseVacia();
  const foto = async (estado: Adjunto['estado']): Promise<Adjunto> => {
    const original = await guardarFoto();
    const publico = estado === 'publicado' ? await guardarFoto() : null;
    return { id: nuevoId(), clase: 'foto', mime: 'image/jpeg', bytes: bytesFoto, original, publico, estado };
  };
  const reporte = async (o: {
    tipo: string; texto: string; lon: number; lat: number; horas: number; creadoHace?: number;
    estado?: Reporte['estado']; publico?: Reporte['estadoPublico']; riesgo?: Reporte['riesgo']; aviso?: string[];
    adjuntos?: Adjunto[]; confirmacion?: Reporte['confirmacion']; codigo?: string;
  }): Promise<Reporte> => ({
    id: nuevoId(),
    numero: siguienteNumero(b),
    codigoHash: o.codigo ? await hashCodigo(o.codigo) : 'demo',
    tipo: o.tipo,
    descripcion: `DEMO · ${o.texto}`,
    editado: false,
    exacto: { lon: o.lon, lat: o.lat },
    celda: celda(o.lon, o.lat),
    zonaSuprimida: (o.riesgo ?? 'no') !== 'no',
    riesgo: o.riesgo ?? 'no',
    momento: ahora - o.horas * H,
    creado: ahora - (o.creadoHace ?? o.horas - 0.1) * H,
    estado: o.estado ?? 'publicado-sin-revisar',
    estadoPublico: o.publico ?? 'sin-verificar',
    avisoDatos: o.aviso ?? [],
    adjuntos: o.adjuntos ?? [],
    confirmacion: o.confirmacion ?? null,
    demo: true,
  });

  b.reportes.push(
    await reporte({ tipo: 'calle', texto: 'Texto ficticio: dos personas en moto se llevaron un celular cerca de una parada.', lon: -58.5302, lat: -34.6631, horas: 1.5, codigo: 'VLM-DEMO-0001' }),
    await reporte({ tipo: 'calle', texto: 'Texto ficticio: arrebato de una cartera en la vereda. Tiene una foto pendiente de revisión.', lon: -58.5299, lat: -34.6634, horas: 2, adjuntos: [await foto('en-revision')] }),
    await reporte({ tipo: 'vivienda', texto: 'Texto ficticio: forzaron la persiana de un comercio durante la madrugada.', lon: -58.5212, lat: -34.6588, horas: 20, estado: 'publicado-revisado', publico: 'corroborado', confirmacion: { metodo: 'visita', fuente: null } }),
    await reporte({ tipo: 'vehiculo', texto: 'Texto ficticio: robo de una rueda de un auto estacionado. Tiene 72 horas y ya no se ve en el mapa público.', lon: -58.5401, lat: -34.6702, horas: 72, estado: 'publicado-revisado', publico: 'revisado' }),
    await reporte({ tipo: 'sospechosa', texto: 'Texto ficticio: un auto dio varias vueltas a la manzana con las luces apagadas. Su plazo de revisión está por vencer.', lon: -58.5355, lat: -34.6679, horas: 11.6, creadoHace: 11.5 }),
    await reporte({ tipo: 'agresion', texto: 'Texto ficticio: me amenazaron en la esquina, el número que me dejaron es 11 1234 5678 (número inventado).', lon: -58.5262, lat: -34.6612, horas: 1, estado: 'retenido', aviso: ['un teléfono'] }),
    await reporte({ tipo: 'disparos', texto: 'Texto ficticio: se escucharon varias detonaciones. La zona no se publica porque quien reportó indicó que podía identificar a alguien.', lon: -58.5331, lat: -34.6571, horas: 3, riesgo: 'si' }),
    await reporte({ tipo: 'otro', texto: 'Texto ficticio: rompieron la luminaria de la cuadra. Tiene una foto ya revisada y publicada.', lon: -58.5245, lat: -34.6683, horas: 8, estado: 'publicado-revisado', publico: 'revisado', adjuntos: [await foto('publicado')] }),
    await reporte({ tipo: 'calle', texto: 'Texto ficticio: intento de robo a un repartidor. Su plazo de revisión de 12 horas ya venció.', lon: -58.5426, lat: -34.6631, horas: 14, creadoHace: 13 }),
  );
  // Mes anterior: reportes ficticios para probar el informe mensual del Observatorio Vecinal.
  // No se ven en el mapa (tienen más de 48 horas), pero cuentan para el informe de ese mes.
  // Se usa el mes anterior si ya cerró (terminó y venció el plazo de 12 h); si no, el mes previo a ese.
  let periodoDemo = periodoDe(limitesMes(periodoDe(ahora)).desde - H);
  if (!mesCerrado(periodoDemo, ahora)) periodoDemo = periodoDe(limitesMes(periodoDemo).desde - H);
  const mesAnterior = limitesMes(periodoDemo).desde;
  const puntos: [number, number][] = [
    [-58.5302, -34.6631], [-58.5212, -34.6588], [-58.5401, -34.6702], [-58.5355, -34.6679],
    [-58.5262, -34.6612], [-58.5245, -34.6683], [-58.5426, -34.6631], [-58.5317, -34.6656],
  ];
  const tipos = ['calle', 'calle', 'calle', 'vivienda', 'vehiculo', 'vehiculo', 'agresion', 'sospechosa', 'otro', 'disparos'];
  const estados: [Reporte['estado'], Reporte['estadoPublico']][] = [
    ['publicado-revisado', 'revisado'], ['publicado-sin-revisar', 'sin-verificar'], ['publicado-revisado', 'corroborado'],
    ['publicado-revisado', 'revisado'], ['publicado-sin-revisar', 'sin-verificar'],
  ];
  for (let i = 0; i < 24; i++) {
    const [lon, lat] = puntos[(i * 3) % puntos.length];
    const [estado, publico] = estados[i % estados.length];
    const r = await reporte({
      tipo: tipos[i % tipos.length], texto: `Texto ficticio del mes anterior (n.º ${i + 1}), para probar el informe mensual.`,
      lon, lat, horas: 0, estado, publico, riesgo: i % 9 === 4 ? 'si' : 'no',
      confirmacion: publico === 'corroborado' ? { metodo: 'visita', fuente: null } : null,
    });
    r.momento = mesAnterior + (i * 26 + 5) * H;
    r.creado = r.momento + 0.2 * H;
    b.reportes.push(r);
  }
  const [, , , , r5, , , r8] = b.reportes;
  b.solicitudes.push(
    {
      id: nuevoId(), numero: 'BOR-DEMO-0001', relacion: 'afectado', referencia: r8.numero, reporteId: r8.id,
      motivo: 'DEMO · Solicitud ficticia: el reporte muestra el frente de mi casa y me identifica.', correo: null, prioridad: true,
      creada: ahora - 2 * H, estado: 'pendiente', resuelta: null,
    },
    {
      id: nuevoId(), numero: 'BOR-DEMO-0002', relacion: 'otra', referencia: r5.numero, reporteId: r5.id,
      motivo: 'DEMO · Solicitud ficticia: creo que el hecho no pasó así.', correo: null, prioridad: false,
      creada: ahora - 30 * H, estado: 'pendiente', resuelta: null,
    },
  );
  b.registro.push({ fecha: ahora, accion: 'Demostración cargada (datos ficticios)' });
  return b;
}
