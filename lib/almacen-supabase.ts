// Almacén en Supabase (San Pablo). Se activa solo si existen las variables SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY en el servidor. Esquema en supabase/esquema.sql.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Base } from './tipos';

let cliente: SupabaseClient | null = null;

export const supabaseConfigurado = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

function sb() {
  cliente ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}

/** Lee el documento, aplica la operación y guarda solo si nadie lo cambió en el medio; si no, reintenta. */
export async function transaccionSupabase<T>(fn: (b: Base) => T | Promise<T>, preparar: (b: Base) => Promise<void>): Promise<T> {
  for (let intento = 0; intento < 5; intento++) {
    const { data, error } = await sb().from('valomi_base').select('version, datos').eq('id', 1).single();
    if (error) throw error;
    const base = data.datos as Base;
    const antes = JSON.stringify(base);
    await preparar(base);
    const resultado = await fn(base);
    // Si nada cambió no se escribe: el mapa público solo lee y no compite con los que guardan.
    if (JSON.stringify(base) === antes) return resultado;
    const { data: escrito, error: errorEscritura } = await sb()
      .from('valomi_base')
      .update({ datos: base, version: data.version + 1, actualizado: new Date().toISOString() })
      .eq('id', 1)
      .eq('version', data.version)
      .select('version');
    if (errorEscritura) throw errorEscritura;
    if (escrito?.length) return resultado;
  }
  throw new Error('No se pudo guardar: demasiadas escrituras simultáneas.');
}

export async function guardarArchivoSupabase(nombre: string, datos: Uint8Array, mime: string) {
  const { error } = await sb().storage.from('adjuntos').upload(nombre, datos, { contentType: mime, upsert: false });
  if (error) throw error;
}

export async function leerArchivoSupabase(nombre: string): Promise<Uint8Array> {
  const { data, error } = await sb().storage.from('adjuntos').download(nombre);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
}

export async function borrarArchivoSupabase(nombre: string) {
  await sb().storage.from('adjuntos').remove([nombre]);
}

/** Límite aprobado de 3 reportes por hora por conexión, contado en la base (en Vercel cada instancia tiene su memoria). */
export async function registrarEnvioSupabase(clave: string, ahora: number, maximo = 3) {
  const desde = new Date(ahora - 3600_000).toISOString();
  await sb().from('valomi_envios').delete().lt('momento', desde);
  const { count, error } = await sb().from('valomi_envios').select('*', { count: 'exact', head: true }).eq('clave', clave).gte('momento', desde);
  if (error) throw error;
  if ((count ?? 0) >= maximo) return false;
  await sb().from('valomi_envios').insert({ clave, momento: new Date(ahora).toISOString() });
  return true;
}

/** Vercel no acepta cuerpos de más de 4,5 MB: los archivos van directo a Supabase, a una carpeta temporal. */
export async function urlSubidaSupabase(nombre: string) {
  const { data, error } = await sb().storage.from('adjuntos').createSignedUploadUrl(nombre);
  if (error) throw error;
  return data.signedUrl;
}

/** Limpieza diaria: subidas que nunca se convirtieron en reporte y contadores vencidos. */
export async function limpiarTemporalesSupabase(ahora: number) {
  const { data, error } = await sb().storage.from('adjuntos').list('temporal', { limit: 1000 });
  if (error) throw error;
  const viejos = (data ?? []).filter((a) => a.created_at && ahora - Date.parse(a.created_at) > 24 * 3600_000).map((a) => `temporal/${a.name}`);
  if (viejos.length) await sb().storage.from('adjuntos').remove(viejos);
  await sb().from('valomi_envios').delete().lt('momento', new Date(ahora - 3600_000).toISOString());
  return viejos.length;
}

/** Enlace al correo: un cliente aparte por pedido, porque la sesión que devuelve no debe pisar la clave de servicio. */
function clienteAuth() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function enviarEnlaceSupabase(correo: string, destino: string) {
  const { error } = await clienteAuth().auth.signInWithOtp({ email: correo, options: { shouldCreateUser: false, emailRedirectTo: destino } });
  if (error) throw error;
}

/** Devuelve el correo de la sesión que Supabase abrió con el enlace, o null si no es válida. */
export async function correoDeTokenSupabase(token: string) {
  const { data, error } = await clienteAuth().auth.getUser(token);
  return error ? null : data.user?.email?.toLowerCase() ?? null;
}
