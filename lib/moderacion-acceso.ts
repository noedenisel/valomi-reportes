// Acceso al panel de moderación. Aprobado: Gabriel entra con un enlace que le llega a su correo (Supabase).
// Con Supabase configurado siempre se exige la sesión, también en desarrollo. Sin Supabase, el panel solo
// funciona en desarrollo local y en la demo del navegador; en producción no existe.
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { supabaseConfigurado } from './almacen-supabase';
import { DEMO_NAVEGADOR } from './modo';
import { COOKIE_SESION, sesionValida } from './sesion';

async function haySesion() {
  return sesionValida((await cookies()).get(COOKIE_SESION)?.value);
}

function habilitadaSinSupabase() {
  // En la demostración online el panel existe, pero trabaja solo con los datos ficticios del navegador.
  return process.env.NODE_ENV !== 'production' || DEMO_NAVEGADOR;
}

/** Para páginas: lleva a la entrada si falta la sesión, o da 404 si el panel no está habilitado. */
export async function exigirModeracion() {
  if (supabaseConfigurado()) {
    if (!(await haySesion())) redirect('/entrar');
    return;
  }
  if (!habilitadaSinSupabase()) notFound();
}

/** Para rutas de la API: 401 sin sesión, 404 si el panel no está habilitado, null si puede pasar. */
export async function rechazoModeracion(): Promise<Response | null> {
  if (supabaseConfigurado()) {
    return (await haySesion()) ? null : Response.json({ mensaje: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  }
  return habilitadaSinSupabase() ? null : new Response('No encontrado', { status: 404 });
}

/** true si quien hace el pedido tiene la sesión del panel: puede cargar reportes sin captcha ni tope de envíos. */
export async function esModeracion() {
  return (await rechazoModeracion()) === null;
}
