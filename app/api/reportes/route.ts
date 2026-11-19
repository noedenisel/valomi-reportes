import { AlmacenNoDisponible, borrarArchivo, guardarArchivo, leerArchivo, transaccion, type Adjunto } from '@/lib/almacen';
import { MENSAJE_CAPTCHA, captchaValido, paseValido } from '@/lib/captcha';
import { origen, registrarEnvio } from '@/lib/limite-envios';
import { esModeracion } from '@/lib/moderacion-acceso';
import { sinMetadatos, tipoReal } from '@/lib/metadatos';
import { crearReporte, errorAdjunto, hashCodigo, nuevoCodigo, nuevoId, validarReporte } from '@/lib/operaciones';
import { aPublico, esVisible } from '@/lib/publico';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const error = (status: number, mensaje: string, campo?: string) => Response.json({ mensaje, campo }, { status });
const noDisponible = () => error(503, 'El servicio de reportes todavía no está habilitado.');

/** Mapa público: reportes con menos de 48 horas desde el hecho, solo con la zona aproximada. */
export async function GET() {
  try {
    const resultado = await transaccion((b) => {
      const actualizado = Date.now();
      return { reportes: b.reportes.filter((r) => esVisible(r, actualizado)).map(aPublico), actualizado };
    });
    return Response.json(resultado, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    if (e instanceof AlmacenNoDisponible) return noDisponible();
    throw e;
  }
}

type Subida = { id: string; clase: 'foto' | 'video'; mime: string };

/** Archivos que el teléfono ya subió directo a la carpeta temporal (lib/almacen-supabase.ts). */
function leerSubidas(form: FormData): Subida[] | null {
  const lista: Subida[] = [];
  for (const valor of form.getAll('subidas')) {
    try {
      const s = JSON.parse(String(valor));
      if (!/^temporal\/[0-9a-f-]{36}$/.test(s.id) || (s.clase !== 'foto' && s.clase !== 'video') || typeof s.mime !== 'string') return null;
      lista.push({ id: s.id, clase: s.clase, mime: s.mime });
    } catch {
      return null;
    }
  }
  return lista;
}

class ArchivoInvalido extends Error {}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return error(400, 'No se pudo leer el formulario.');
  // Campo trampa: las personas no lo ven. Si viene completo es un robot: se responde «ok» sin guardar nada.
  if (form.get('sitio')) return Response.json({ codigo: nuevoCodigo('VLM'), retenido: false });

  const fotos = form.getAll('fotos').filter((f): f is File => f instanceof File && f.size > 0);
  const videos = form.getAll('videos').filter((f): f is File => f instanceof File && f.size > 0);
  const subidas = leerSubidas(form);
  if (!subidas) return error(400, 'No se pudieron leer los archivos.', 'adjuntos');
  const declaradas = (clase: Subida['clase']) => subidas.filter((s) => s.clase === clase).map((s) => ({ type: s.mime, size: 0 }));
  const ahora = Date.now();
  const v = validarReporte(
    {
      tipo: String(form.get('tipo') ?? ''),
      descripcion: String(form.get('descripcion') ?? ''),
      lon: Number(form.get('lon')),
      lat: Number(form.get('lat')),
      riesgo: String(form.get('riesgo') ?? ''),
      fecha: form.get('fecha') as string | null,
      rango: form.get('rango') as string | null,
      dia: form.get('dia') as 'hoy' | 'ayer' | 'anteayer' | null,
      hora: form.get('hora') as string | null,
      acepto: form.get('acepto') === 'si',
      fotos: [...fotos, ...declaradas('foto')],
      videos: [...videos, ...declaradas('video')],
    },
    ahora
  );
  if ('error' in v) return error(v.error.status, v.error.mensaje, v.error.campo);

  // Con la sesión del panel (Gabriel cargando reportes) no se pide captcha ni se cuenta el tope de envíos.
  const moderacion = await esModeracion();
  const verificado = moderacion || (subidas.length ? paseValido(form.get('pase'), subidas.map((s) => s.id), ahora) : await captchaValido(form.get('captcha')));
  if (!verificado) return error(403, MENSAJE_CAPTCHA);

  if (!moderacion && !(await registrarEnvio(origen(req), ahora))) {
    return error(429, 'Enviaste varios reportes seguidos. Esperá unos minutos y probá de nuevo.');
  }

  const codigo = nuevoCodigo('VLM');
  try {
    const adjuntos: Adjunto[] = [];
    const guardar = async (clase: Subida['clase'], mime: string, datos: Buffer) => {
      const mal = errorAdjunto(clase, mime, datos.length) ?? (tipoReal(datos, mime) ? null : 'Ese archivo no parece una foto o un video válido.');
      if (mal) throw new ArchivoInvalido(mal);
      const id = nuevoId();
      await guardarArchivo(id, sinMetadatos(datos, mime), mime);
      adjuntos.push({ id, clase, mime, bytes: datos.length, original: id, publico: null, estado: 'en-revision' });
    };
    for (const [clase, lista] of [['foto', fotos], ['video', videos]] as const) {
      for (const f of lista) await guardar(clase, f.type, Buffer.from(await f.arrayBuffer()));
    }
    for (const s of subidas) {
      const datos = await leerArchivo(s.id).catch(() => {
        throw new ArchivoInvalido('No se pudo recibir un archivo. Probá de nuevo.');
      });
      await guardar(s.clase, s.mime, Buffer.from(datos));
      await borrarArchivo(s.id);
    }
    const hash = await hashCodigo(codigo);
    const resultado = await transaccion((b) => crearReporte(b, v.datos, adjuntos, hash, ahora));
    return Response.json({ codigo, ...resultado });
  } catch (e) {
    if (e instanceof ArchivoInvalido) return error(400, e.message, 'adjuntos');
    if (e instanceof AlmacenNoDisponible) return noDisponible();
    console.error(e);
    return error(500, 'El servicio no responde. Probá de nuevo en unos minutos.');
  }
}
