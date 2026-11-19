import { AlmacenNoDisponible, guardarArchivo, transaccion } from '@/lib/almacen';
import { sinMetadatos } from '@/lib/metadatos';
import { rechazoModeracion } from '@/lib/moderacion-acceso';
import { nuevoId, publicarFoto } from '@/lib/operaciones';

/** Gabriel sube la copia difuminada de una foto (hecha en el panel). Esa copia es la que se publica. */
export async function POST(req: Request) {
  const rechazo = await rechazoModeracion();
  if (rechazo) return rechazo;
  const form = await req.formData().catch(() => null);
  const archivo = form?.get('archivo');
  if (!(archivo instanceof File) || archivo.type !== 'image/jpeg') return Response.json({ mensaje: 'Falta la foto difuminada.' }, { status: 400 });
  try {
    const id = nuevoId();
    await guardarArchivo(id, sinMetadatos(Buffer.from(await archivo.arrayBuffer()), 'image/jpeg'), 'image/jpeg');
    const mensaje = await transaccion((b) => publicarFoto(b, String(form!.get('reporteId') ?? ''), String(form!.get('adjuntoId') ?? ''), id, Date.now()));
    return mensaje ? Response.json({ mensaje }, { status: 400 }) : Response.json({ ok: true });
  } catch (e) {
    if (e instanceof AlmacenNoDisponible) return Response.json({ mensaje: 'No disponible.' }, { status: 503 });
    throw e;
  }
}
