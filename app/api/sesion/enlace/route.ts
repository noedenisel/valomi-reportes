import { enviarEnlaceSupabase, supabaseConfigurado } from '@/lib/almacen-supabase';
import { origen, registrarEnvio } from '@/lib/limite-envios';
import { correoHabilitado } from '@/lib/sesion';

const MENSAJE = 'Si ese correo está habilitado, te llega un enlace para entrar.';

/** Pide el enlace al correo. La respuesta es la misma para cualquier correo: no revela cuál está habilitado. */
export async function POST(req: Request) {
  if (!supabaseConfigurado()) return new Response('No encontrado', { status: 404 });
  const d = await req.json().catch(() => null);
  const correo = String(d?.correo ?? '').trim().toLowerCase();
  if (d?.sitio || !correo) return Response.json({ mensaje: MENSAJE });
  if (!(await registrarEnvio(`${origen(req)}:entrada`))) {
    return Response.json({ mensaje: 'Pediste varios enlaces seguidos. Esperá unos minutos y probá de nuevo.' }, { status: 429 });
  }
  if (correoHabilitado(correo)) {
    await enviarEnlaceSupabase(correo, new URL('/entrar/confirmar', req.url).href).catch((e) => console.error('No se pudo enviar el enlace', e));
  }
  return Response.json({ mensaje: MENSAJE });
}
