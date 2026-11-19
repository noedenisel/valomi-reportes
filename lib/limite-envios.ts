// Límite aprobado: hasta 3 reportes por hora desde una misma conexión.
// No se guarda la IP: solo una versión cifrada, en memoria, que se descarta a la hora.
// (Con Supabase este contador pasa a una tabla con la misma regla, porque en Vercel cada instancia tiene su propia memoria.)
import { createHash, randomBytes } from 'node:crypto';
import { registrarEnvioSupabase, supabaseConfigurado } from './almacen-supabase';

const VENTANA_MS = 3600_000;
const MAXIMO = 3;
// Con Supabase la sal tiene que ser fija (VALOMI_SAL_ENVIOS) para que todas las instancias cuenten igual.
const SAL = process.env.VALOMI_SAL_ENVIOS || randomBytes(16).toString('hex');
const envios = new Map<string, number[]>();

export function origen(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
  return createHash('sha256').update(SAL + ip).digest('hex');
}

/** Devuelve true si todavía puede enviar, y anota el envío. Con Supabase se cuenta en la base. */
export async function registrarEnvio(clave: string, ahora = Date.now(), maximo = MAXIMO) {
  if (supabaseConfigurado()) return registrarEnvioSupabase(clave, ahora, maximo);
  for (const [k, v] of envios) {
    const vigentes = v.filter((t) => ahora - t < VENTANA_MS);
    if (vigentes.length) envios.set(k, vigentes);
    else envios.delete(k);
  }
  const previos = envios.get(clave) ?? [];
  if (previos.length >= maximo) return false;
  envios.set(clave, [...previos, ahora]);
  return true;
}
