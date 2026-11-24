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
  // Incluye el texto pegado y los campos editables; evita lotes desmedidos antes de JSON.parse.
  if (Number(req.headers.get('content-length')) > 500_000) return error(413, 'El pedido es demasiado grande. Importá un lote más chico.');
  const cuerpo = await req.text().catch(() => null);
  if (cuerpo === null || new TextEncoder().encode(cuerpo).length > 500_000) return error(413, 'El pedido es demasiado grande. Importá un lote más chico.');
  const d = (() => { try { return JSON.parse(cuerpo); } catch { return null; } })();
  if (!d?.accion) return error(400, 'Falta la acción.');
  try {
    const resultado = await transaccion((b) => accionModeracion(b, d, Date.now(), borrarArchivo));
    return resultado ? error(400, resultado) : Response.json({ ok: true });
  } catch (e) {
    if (e instanceof AlmacenNoDisponible) return error(503, 'No disponible.');
    throw e;
  }
}
