import { AlmacenNoDisponible, transaccion } from '@/lib/almacen';
import { MENSAJE_CAPTCHA, captchaValido } from '@/lib/captcha';
import { origen, registrarEnvio } from '@/lib/limite-envios';
import { crearSolicitud, nuevoCodigo } from '@/lib/operaciones';

const error = (status: number, mensaje: string, campo?: string) => Response.json({ mensaje, campo }, { status });

/** Solicitud de borrado: la revisa Gabriel a mano en 5 días hábiles. El reporte sigue visible mientras tanto. */
export async function POST(req: Request) {
  const d = await req.json().catch(() => null);
  if (!d || typeof d !== 'object') return error(400, 'No se pudo leer el formulario.');
  if (d.sitio) return Response.json({ numero: nuevoCodigo('BOR') });
  if (!(await captchaValido(d.captcha))) return error(403, MENSAJE_CAPTCHA);
  try {
    if (!(await registrarEnvio(`${origen(req)}:borrado`))) {
      return error(429, 'Enviaste varias solicitudes seguidas. Esperá unos minutos y probá de nuevo.');
    }
    const r = await transaccion((b) => crearSolicitud(b, d, Date.now()));
    return 'error' in r ? error(r.error.status, r.error.mensaje, r.error.campo) : Response.json({ numero: r.numero });
  } catch (e) {
    if (e instanceof AlmacenNoDisponible) return error(503, 'El servicio todavía no está habilitado.');
    console.error(e);
    return error(500, 'El servicio no responde. Probá de nuevo en unos minutos.');
  }
}
