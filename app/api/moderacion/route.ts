import { AlmacenNoDisponible, borrarArchivo, transaccion } from '@/lib/almacen';
import { rechazoModeracion } from '@/lib/moderacion-acceso';
import { accionModeracion, vistaModeracion } from '@/lib/operaciones';

export const dynamic = 'force-dynamic';

const error = (status: number, mensaje: string) => Response.json({ mensaje }, { status });

export async function GET() {
  const rechazo = await rechazoModeracion();
  if (rechazo) return rechazo;
  try {
    const datos = await transaccion((b) => vistaModeracion(b, Date.now()));
    return Response.json(datos, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    if (e instanceof AlmacenNoDisponible) return error(503, 'No disponible.');
    throw e;
  }
}

export async function POST(req: Request) {
  const rechazo = await rechazoModeracion();
  if (rechazo) return rechazo;
  const d = await req.json().catch(() => null);
  if (!d?.accion) return error(400, 'Falta la acción.');
  try {
    const resultado = await transaccion((b) => accionModeracion(b, d, Date.now(), borrarArchivo));
    return resultado ? error(400, resultado) : Response.json({ ok: true });
  } catch (e) {
    if (e instanceof AlmacenNoDisponible) return error(503, 'No disponible.');
    throw e;
  }
}
