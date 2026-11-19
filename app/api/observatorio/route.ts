import { AlmacenNoDisponible, transaccion } from '@/lib/almacen';
import LIMITE from '@/lib/limite-datos.json';
import { rechazoModeracion } from '@/lib/moderacion-acceso';
import { calcularMes, exportarDatos, mesCerrado, nombreMes } from '@/lib/observatorio';
import { pdfInformeMensual } from '@/lib/pdf-observatorio';

export const dynamic = 'force-dynamic';

/**
 * Observatorio Vecinal, solo para el panel de moderación:
 * ?periodo=AAAA-MM → vista previa del mes · ?pdf=ID → PDF del informe · ?datos=ID → archivo para cargar en la web.
 */
export async function GET(req: Request) {
  const rechazo = await rechazoModeracion();
  if (rechazo) return rechazo;
  const q = new URL(req.url).searchParams;
  try {
    return await transaccion(async (b) => {
      const periodo = q.get('periodo');
      if (periodo) return Response.json({ datos: calcularMes(b, periodo), cerrado: mesCerrado(periodo, Date.now()) });
      const informe = b.informes?.find((i) => i.id === (q.get('pdf') ?? q.get('datos')));
      if (!informe) return Response.json({ mensaje: 'No se encontró el informe.' }, { status: 404 });
      const nombre = `observatorio-vecinal-${informe.periodo}${informe.estado === 'borrador' ? '-borrador' : ''}`;
      if (q.get('pdf')) {
        const pdf = await pdfInformeMensual(informe, LIMITE as [number, number][]);
        return new Response(new Uint8Array(pdf), {
          headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${nombre}.pdf"` },
        });
      }
      return new Response(JSON.stringify(exportarDatos(informe, LIMITE as [number, number][]), null, 1), {
        headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="${nombre}.json"`, 'x-titulo': encodeURIComponent(nombreMes(informe.periodo)) },
      });
    });
  } catch (e) {
    if (e instanceof AlmacenNoDisponible) return Response.json({ mensaje: 'No disponible.' }, { status: 503 });
    throw e;
  }
}
