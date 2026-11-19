import { supabaseConfigurado, urlSubidaSupabase } from '@/lib/almacen-supabase';
import { MENSAJE_CAPTCHA, captchaValido, crearPase } from '@/lib/captcha';
import { origen, registrarEnvio } from '@/lib/limite-envios';
import { esModeracion } from '@/lib/moderacion-acceso';
import { errorAdjunto, nuevoId } from '@/lib/operaciones';
import { FOTOS_MAX, VIDEOS_MAX } from '@/lib/reglas';

export const dynamic = 'force-dynamic';

const MAXIMO_POR_HORA = 6; // Más que los 3 reportes: un envío fallido se puede reintentar.
const error = (status: number, mensaje: string) => Response.json({ mensaje }, { status });

/** Enlaces firmados para subir los archivos directo a Supabase. Sin Supabase, el formulario los manda con el reporte. */
export async function POST(req: Request) {
  if (!supabaseConfigurado()) return Response.json({ directa: false });
  const d = await req.json().catch(() => null);
  const archivos: { clase: 'foto' | 'video'; mime: string; bytes: number }[] = Array.isArray(d?.archivos) ? d.archivos : [];
  const cuantos = (clase: string) => archivos.filter((a) => a?.clase === clase).length;
  if (!archivos.length || archivos.length !== cuantos('foto') + cuantos('video')) return error(400, 'No se pudieron leer los archivos.');
  if (cuantos('foto') > FOTOS_MAX || cuantos('video') > VIDEOS_MAX) return error(400, 'Podés subir hasta 4 fotos y 1 video.');
  for (const a of archivos) {
    const mal = errorAdjunto(a.clase, String(a.mime), Number(a.bytes));
    if (mal) return error(400, mal);
  }
  const moderacion = await esModeracion();
  if (!moderacion && !(await captchaValido(d?.captcha))) return error(403, MENSAJE_CAPTCHA);
  try {
    if (!moderacion && !(await registrarEnvio(`${origen(req)}:subidas`, Date.now(), MAXIMO_POR_HORA))) {
      return error(429, 'Enviaste varios reportes seguidos. Esperá unos minutos y probá de nuevo.');
    }
    const subidas = await Promise.all(
      archivos.map(async (a) => {
        const id = `temporal/${nuevoId()}`;
        return { id, clase: a.clase, mime: a.mime, url: await urlSubidaSupabase(id) };
      })
    );
    return Response.json({ directa: true, subidas, pase: crearPase(subidas.map((s) => s.id)) });
  } catch (e) {
    console.error(e);
    return error(500, 'El servicio no responde. Probá de nuevo en unos minutos.');
  }
}
