import { transaccion } from '@/lib/almacen';
import { limpiarTemporalesSupabase, supabaseConfigurado } from '@/lib/almacen-supabase';

export const dynamic = 'force-dynamic';

/** Una vez por día (vercel.json): aplica los plazos de conservación aunque nadie entre a la app, y limpia lo temporal. */
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get('authorization') !== `Bearer ${secreto}`) return new Response('No autorizado', { status: 401 });
  if (!supabaseConfigurado()) return new Response('No disponible', { status: 503 });
  await transaccion(() => null);
  return Response.json({ temporalesBorrados: await limpiarTemporalesSupabase(Date.now()) });
}
