/** «Hace 2 h», «Hace 3 días». */
export function hace(momento: number, ahora = Date.now()) {
  const min = Math.max(0, Math.round((ahora - momento) / 60_000));
  if (min < 60) return min <= 1 ? 'Hace un momento' : `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Hace 1 día' : `Hace ${d} días`;
}

const FECHA_AR = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

/**
 * «Hace 2 h» y, si el hecho fue otro día (hora de Argentina), también cuándo: «Hace 30 h · ayer», «Hace 3 días · el 1/11».
 * El momento de un reporte es aproximado (sale del rango o de la hora que eligió quien reportó): por eso se muestra el día y no la hora exacta.
 */
export function haceCuando(momento: number, ahora = Date.now()) {
  const base = hace(momento, ahora);
  const dias = Math.round((Date.parse(FECHA_AR(ahora)) - Date.parse(FECHA_AR(momento))) / 86_400_000);
  if (dias <= 0) return base;
  if (dias === 1) return `${base} · ayer`;
  if (dias === 2) return `${base} · anteayer`;
  const [, m, d] = FECHA_AR(momento).split('-').map(Number);
  return `${base} · el ${d}/${m}`;
}

/** Hora de Argentina (UTC−3), por ejemplo «21:05». */
export function horaAR(ms: number) {
  return new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
}

export const ETIQUETA_ESTADO = { 'sin-verificar': 'Sin verificar', revisado: 'Revisado por VaLoMi', corroborado: 'Corroborado' } as const;

/** Para buscar calles sin depender de tildes ni mayúsculas. */
export const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
