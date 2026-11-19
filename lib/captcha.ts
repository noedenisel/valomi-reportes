// Captcha (Cloudflare Turnstile), siempre comprobado en el servidor.
// En producción sin clave nadie pasa: mejor frenar los envíos que abrirlos a los robots por un error de configuración.
import { createHmac, timingSafeEqual } from 'node:crypto';

const VERIFICAR = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const VIGENCIA_PASE_MS = 3600_000;

export const MENSAJE_CAPTCHA = 'No se pudo comprobar que no sos un robot. Esperá unos segundos y probá de nuevo.';

export async function captchaValido(token: unknown, secreto = process.env.TURNSTILE_SECRET_KEY) {
  if (!secreto) return process.env.NODE_ENV !== 'production';
  if (typeof token !== 'string' || !token) return false;
  try {
    // No se manda la IP: es un dato opcional de la verificación.
    const r = await fetch(VERIFICAR, { method: 'POST', body: new URLSearchParams({ secret: secreto, response: token }) });
    return (await r.json()).success === true;
  } catch {
    return false;
  }
}

const firmar = (valor: string, secreto: string) => createHmac('sha256', secreto).update(valor).digest('base64url');

// Cada captcha sirve una sola vez. Con archivos se gasta al pedir los enlaces de subida: este pase prueba que
// esos archivos ya lo superaron, y le sirve al reporte una vez que el teléfono terminó de subirlos.
export function crearPase(ids: string[], ahora = Date.now(), secreto = process.env.VALOMI_SESION_SECRETO ?? '') {
  const vence = ahora + VIGENCIA_PASE_MS;
  return `${vence}.${firmar(`${vence}|${[...ids].sort().join('|')}`, secreto)}`;
}

export function paseValido(pase: unknown, ids: string[], ahora = Date.now(), secreto = process.env.VALOMI_SESION_SECRETO ?? '') {
  if (typeof pase !== 'string' || !secreto || !ids.length) return false;
  const [vence, firma, ...resto] = pase.split('.');
  if (!vence || !firma || resto.length || !(ahora < Number(vence))) return false;
  const a = Buffer.from(firma);
  const b = Buffer.from(firmar(`${vence}|${[...ids].sort().join('|')}`, secreto));
  return a.length === b.length && timingSafeEqual(a, b);
}
