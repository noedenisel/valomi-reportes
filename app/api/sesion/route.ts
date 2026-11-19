import { cookies } from 'next/headers';
import { correoDeTokenSupabase, supabaseConfigurado } from '@/lib/almacen-supabase';
import { COOKIE_SESION, DURACION_SESION_S, correoHabilitado, crearSesion } from '@/lib/sesion';

/** Canjea el enlace del correo por la sesión del panel. Solo vale para los correos de la moderación. */
export async function POST(req: Request) {
  if (!supabaseConfigurado()) return new Response('No encontrado', { status: 404 });
  const d = await req.json().catch(() => null);
  const correo = typeof d?.token === 'string' ? await correoDeTokenSupabase(d.token) : null;
  if (!correo || !correoHabilitado(correo)) {
    return Response.json({ mensaje: 'El enlace venció o ya se usó. Pedí uno nuevo.' }, { status: 401 });
  }
  (await cookies()).set(COOKIE_SESION, crearSesion(correo), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACION_SESION_S,
  });
  return Response.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete(COOKIE_SESION);
  return Response.json({ ok: true });
}
