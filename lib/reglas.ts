// Reglas aprobadas en la especificación (29–31/10/2026). Las usan el formulario y el servidor:
// el teléfono avisa enseguida, pero la validación que vale es la del servidor.

export const TIPOS = [
  { id: 'calle', nombre: 'Robo o arrebato en la calle', icono: 'calle' },
  { id: 'motochorros', nombre: 'Motochorros', icono: 'motochorros' },
  { id: 'vivienda', nombre: 'Robo en vivienda o comercio', icono: 'vivienda' },
  { id: 'vehiculo', nombre: 'Robo de vehículo, moto o autopartes', icono: 'vehiculo' },
  { id: 'agresion', nombre: 'Agresión o amenaza', icono: 'agresion' },
  { id: 'disparos', nombre: 'Disparos', icono: 'disparos' },
  { id: 'sospechosa', nombre: 'Situación sospechosa', icono: 'sospechosa' },
  { id: 'otro', nombre: 'Otro hecho de inseguridad', icono: 'otro' },
] as const;
export type TipoId = (typeof TIPOS)[number]['id'];
export const nombreTipo = (id: string) => TIPOS.find((t) => t.id === id)?.nombre ?? 'Hecho de inseguridad';

export const RANGOS = [
  { id: 'recien', nombre: 'Recién', horas: 0.5 },
  { id: '1-3', nombre: 'Hace 1 a 3 h', horas: 2 },
  { id: '3-6', nombre: 'Hace 3 a 6 h', horas: 4.5 },
  { id: '6-12', nombre: 'Hace 6 a 12 h', horas: 9 },
  { id: '12-24', nombre: 'Hace 12 a 24 h', horas: 18 },
  { id: '24-48', nombre: 'Hace 24 a 48 h', horas: 36 },
] as const;
export type RangoId = (typeof RANGOS)[number]['id'];

export const RIESGOS = [
  { id: 'no', nombre: 'No' },
  { id: 'si', nombre: 'Sí' },
  { id: 'nose', nombre: 'No sé' },
] as const;
export type RiesgoId = (typeof RIESGOS)[number]['id'];

export const VISIBLE_HORAS = 48;
const FECHA_ARGENTINA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Día calendario en Argentina, independiente de la zona horaria del dispositivo o servidor. */
export function fechaArgentina(ahora = Date.now()): string {
  return Number.isFinite(ahora) ? FECHA_ARGENTINA.format(ahora) : '';
}

/** La visibilidad pública vence al cumplir 48 horas desde el hecho, sin renovar por moderación. */
export function esMomentoVisible(momento: number, ahora = Date.now()): boolean {
  const edad = ahora - momento;
  return Number.isFinite(momento) && Number.isFinite(ahora) && edad >= 0 && edad < VISIBLE_HORAS * 3600_000;
}
export const PLAZO_REVISION_H = 12;
export const DESCRIPCION_MIN = 20;
export const DESCRIPCION_MAX = 500;
export const FOTOS_MAX = 4;
export const FOTO_MAX_MB = 10;
export const VIDEOS_MAX = 1;
export const VIDEO_MAX_MB = 50;
export const VIDEO_MAX_S = 30;
export const MOTIVO_BORRADO_MIN = 10;
export const MOTIVO_BORRADO_MAX = 1000;

export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
export const TIPOS_VIDEO = ['video/mp4', 'video/quicktime'];

const LINK = /(https?:\/\/|www\.)\S+|\b[\w-]+\.(com|ar|net|org|io|ly|me)(\/\S*)?\b/i;

export function errorDescripcion(texto: string): string | null {
  const t = texto.trim();
  if (t.length < DESCRIPCION_MIN) return `Escribí al menos ${DESCRIPCION_MIN} caracteres para que se entienda qué pasó.`;
  if (t.length > DESCRIPCION_MAX) return `Hasta ${DESCRIPCION_MAX} caracteres.`;
  if (LINK.test(t)) return 'Sacá los links: no se publican.';
  return null;
}

/**
 * Momento de un hecho de hoy, en horario de Argentina. Las opciones anteriores que resuelvan
 * a otro día se rechazan también del lado del servidor, aunque alguien modifique el formulario.
 * La fecha explícita evita reinterpretar como "hoy" un formulario abierto antes de medianoche.
 */
export function momentoDelHecho(
  datos: { fecha?: string | null; rango?: string | null; dia?: 'hoy' | 'ayer' | 'anteayer' | null; hora?: string | null },
  ahora = Date.now()
): number | null {
  const hoy = fechaArgentina(ahora);
  if (!hoy || (datos.fecha != null && datos.fecha !== hoy) || (datos.dia != null && datos.dia !== 'hoy')) return null;
  if (datos.hora) {
    if (!/^\d{2}:\d{2}$/.test(datos.hora)) return null;
    const [h, m] = datos.hora.split(':').map(Number);
    if (h > 23 || m > 59) return null;
    // Argentina usa UTC−3 todo el año.
    const local = new Date(ahora - 3 * 3600_000);
    const base = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), h, m) + 3 * 3600_000;
    return base;
  }
  const r = RANGOS.find((x) => x.id === datos.rango);
  const momento = r ? ahora - r.horas * 3600_000 : null;
  return momento !== null && fechaArgentina(momento) === hoy ? momento : null;
}

export function errorMomento(momento: number | null, ahora = Date.now()): string | null {
  if (momento === null || !Number.isFinite(momento) || !Number.isFinite(ahora)) return 'Elegí una hora válida de hoy, en horario de Argentina.';
  if (momento > ahora) return 'Esa hora todavía no pasó.';
  if (fechaArgentina(momento) !== fechaArgentina(ahora)) return 'Solo se aceptan hechos de hoy, en horario de Argentina.';
  return null;
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
