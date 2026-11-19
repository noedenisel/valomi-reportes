import { AlmacenNoDisponible, leerArchivo, transaccion } from '@/lib/almacen';
import { esModeracion, rechazoModeracion } from '@/lib/moderacion-acceso';
import { esVisible } from '@/lib/publico';

export const dynamic = 'force-dynamic';

/**
 * Público: solo la copia difuminada de un adjunto que Gabriel aprobó.
 * ?original=1: el archivo original, únicamente para la moderación.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const original = new URL(req.url).searchParams.get('original') === '1';
  if (original) {
    const rechazo = await rechazoModeracion();
    if (rechazo) return rechazo;
  }
  try {
    const encontrado = await transaccion((b) => {
      const reporte = b.reportes.find((r) => r.adjuntos.some((a) => a.id === id));
      return reporte ? { reporte, adjunto: reporte.adjuntos.find((a) => a.id === id)! } : null;
    });
    if (!encontrado || (!original && !esVisible(encontrado.reporte) && !(await esModeracion()))) {
      return new Response('No encontrado', { status: 404, headers: { 'cache-control': 'no-store' } });
    }
    const adj = encontrado.adjunto;
    const archivo = original ? adj?.original : adj?.estado === 'publicado' ? adj.publico : null;
    if (!archivo) return new Response('No encontrado', { status: 404, headers: { 'cache-control': 'no-store' } });
    const datos = await leerArchivo(archivo);
    return new Response(new Uint8Array(datos), {
      headers: {
        'content-type': original ? adj.mime : adj.clase === 'foto' ? 'image/jpeg' : 'video/mp4',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (e) {
    if (e instanceof AlmacenNoDisponible) return new Response('No disponible', { status: 503 });
    return new Response('No encontrado', { status: 404 });
  }
}
