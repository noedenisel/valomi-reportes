// Sesión de la moderación: una cookie firmada en el servidor, solo para los correos de VALOMI_CORREO_MODERACION (separados por comas).
// Supabase verifica el enlace que llega al correo; a partir de ahí la sesión es esta cookie, que el navegador no puede leer.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE_SESION = 'valomi_sesion';
export const DURACION_SESION_S = 12 * 3600;

const SECRETO_MINIMO = 32;

const lista = (correos: string | undefined | null) => (correos ?? '').split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);

export const correoHabilitado = (correo: string, habilitados = process.env.VALOMI_CORREO_MODERACION) => lista(habilitados).includes(correo.trim().toLowerCase());

const firma = (valor: string, secreto: string) => createHmac('sha256', secreto).update(valor).digest('base64url');

export function crearSesion(correo: string, ahora = Date.now(), secreto = process.env.VALOMI_SESION_SECRETO ?? '') {
  if (secreto.length < SECRETO_MINIMO) throw new Error('Falta VALOMI_SESION_SECRETO.');
  const valor = Buffer.from(JSON.stringify({ c: correo.toLowerCase(), v: ahora + DURACION_SESION_S * 1000 })).toString('base64url');
  return `${valor}.${firma(valor, secreto)}`;
}

/** true solo si la firma es correcta, no venció y es de un correo habilitado hoy. Ante cualquier duda, false. */
export function sesionValida(
  cookie: string | undefined,
  ahora = Date.now(),
  secreto = process.env.VALOMI_SESION_SECRETO ?? '',
  habilitados = process.env.VALOMI_CORREO_MODERACION
) {
  if (!cookie || secreto.length < SECRETO_MINIMO) return false;
  const [valor, recibida, ...resto] = cookie.split('.');
  if (!valor || !recibida || resto.length) return false;
  const a = Buffer.from(recibida);
  const b = Buffer.from(firma(valor, secreto));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const { c, v } = JSON.parse(Buffer.from(valor, 'base64url').toString());
    return typeof c === 'string' && correoHabilitado(c, habilitados) && typeof v === 'number' && ahora < v;
  } catch {
    return false;
  }
}
