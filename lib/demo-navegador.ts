// Modo demostración en el navegador (solo para mostrar la app online sin base de datos).
// Atiende las llamadas a /api/* dentro del propio navegador, con las mismas reglas que el servidor (lib/operaciones.ts),
// y guarda todo en el almacenamiento de ese navegador (IndexedDB). Nada sale del dispositivo de quien prueba.
import {
  accionModeracion, aplicarConservacion, crearReporte, crearSolicitud, hashCodigo, nuevoCodigo, nuevoId,
  publicarFoto, sembrarDemo, validarReporte, vistaModeracion,
} from './operaciones';
import { aPublico, esVisible } from './publico';
import LIMITE from './limite-datos.json';
import { calcularMes, exportarDatos, mesCerrado, nombreMes } from './observatorio';
import { pdfInformeMensual } from './pdf-observatorio';
import type { Adjunto, Base } from './tipos';

// Cambiar el nombre vuelve a cargar los datos ficticios en todos los navegadores (v3: suma un mes cerrado para el Observatorio).
const DB = 'valomi-demo-v3';
const VENTANA_MS = 3600_000;
const MAX_ENVIOS = 3;

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const pedido = indexedDB.open(DB, 1);
    pedido.onupgradeneeded = () => {
      pedido.result.createObjectStore('base');
      pedido.result.createObjectStore('archivos');
    };
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => mal(pedido.error);
  });
}

async function operar<T>(almacen: 'base' | 'archivos', modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const tx = db.transaction(almacen, modo);
    const pedido = fn(tx.objectStore(almacen));
    tx.oncomplete = () => ok(pedido ? (pedido.result as T) : (undefined as T));
    tx.onerror = () => mal(tx.error);
  });
}

const leerArchivo = (id: string) => operar<Blob | undefined>('archivos', 'readonly', (s) => s.get(id));
const guardarArchivo = (id: string, blob: Blob) => operar('archivos', 'readwrite', (s) => void s.put(blob, id));
const borrarArchivo = async (id: string) => {
  urls.get(id) && URL.revokeObjectURL(urls.get(id)!);
  urls.delete(id);
  await operar('archivos', 'readwrite', (s) => void s.delete(id));
};

const urls = new Map<string, string>();
async function urlDe(id: string | null) {
  if (!id) return null;
  if (!urls.has(id)) {
    const blob = await leerArchivo(id);
    if (!blob) return null;
    urls.set(id, URL.createObjectURL(blob));
  }
  return urls.get(id)!;
}

async function sembrar(): Promise<Base> {
  const foto = await fetch('/demo/foto-demo.jpg').then((r) => r.blob());
  const base = await sembrarDemo(Date.now(), async () => {
    const id = nuevoId();
    await guardarArchivo(id, foto);
    return id;
  }, foto.size);
  await operar('base', 'readwrite', (s) => void s.put(base, 'base'));
  return base;
}

let cola: Promise<unknown> = Promise.resolve();
/** Misma idea que el servidor: lee, aplica los plazos de conservación, modifica y guarda. Una operación por vez. */
function transaccion<T>(fn: (b: Base) => T | Promise<T>): Promise<T> {
  const tarea = cola.then(async () => {
    const base = (await operar<Base | undefined>('base', 'readonly', (s) => s.get('base'))) ?? (await sembrar());
    await aplicarConservacion(base, Date.now(), borrarArchivo);
    const r = await fn(base);
    await operar('base', 'readwrite', (s) => void s.put(base, 'base'));
    return r;
  });
  cola = tarea.catch(() => undefined);
  return tarea;
}

async function reiniciar() {
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear();
  await operar('archivos', 'readwrite', (s) => void s.clear());
  await sembrar();
}

/** Límite aprobado de 3 reportes por hora, contado en este navegador. */
function registrarEnvio(ahora: number) {
  let previos: number[] = [];
  try {
    previos = JSON.parse(localStorage.getItem('valomi-demo-envios') ?? '[]').filter((t: number) => ahora - t < VENTANA_MS);
  } catch {}
  if (previos.length >= MAX_ENVIOS) return false;
  try {
    localStorage.setItem('valomi-demo-envios', JSON.stringify([...previos, ahora]));
  } catch {}
  return true;
}

const json = (datos: unknown, status = 200) => Response.json(datos, { status, headers: { 'cache-control': 'no-store' } });
const error = (status: number, mensaje: string, campo?: string) => json({ mensaje, campo }, status);

async function atender(url: URL, init: RequestInit = {}): Promise<Response> {
  const metodo = (init.method ?? 'GET').toUpperCase();
  const ruta = url.pathname;
  const ahora = Date.now();

  if (ruta === '/api/reportes' && metodo === 'GET') {
    const lista = await transaccion(async (b) => {
      const visibles = b.reportes.filter((r) => esVisible(r));
      return Promise.all(
        visibles.map(async (r) => ({
          ...aPublico(r),
          fotos: (await Promise.all(r.adjuntos.filter((a) => a.estado === 'publicado').map((a) => urlDe(a.publico)))).filter(Boolean) as string[],
        }))
      );
    });
    return json({ reportes: lista, actualizado: ahora });
  }

  if (ruta === '/api/reportes' && metodo === 'POST') {
    const form = init.body as FormData;
    if (form.get('sitio')) return json({ codigo: nuevoCodigo('VLM'), retenido: false });
    const fotos = form.getAll('fotos').filter((f): f is File => f instanceof File && f.size > 0);
    const videos = form.getAll('videos').filter((f): f is File => f instanceof File && f.size > 0);
    const v = validarReporte(
      {
        tipo: String(form.get('tipo') ?? ''), descripcion: String(form.get('descripcion') ?? ''),
        lon: Number(form.get('lon')), lat: Number(form.get('lat')), riesgo: String(form.get('riesgo') ?? ''),
        fecha: form.get('fecha') as string | null, rango: form.get('rango') as string | null, dia: form.get('dia') as 'hoy' | 'ayer' | 'anteayer' | null, hora: form.get('hora') as string | null,
        acepto: form.get('acepto') === 'si', fotos, videos,
      },
      ahora
    );
    if ('error' in v) return error(v.error.status, v.error.mensaje, v.error.campo);
    if (!registrarEnvio(ahora)) return error(429, 'Enviaste varios reportes seguidos. Esperá unos minutos y probá de nuevo.');
    const codigo = nuevoCodigo('VLM');
    const resultado = await transaccion(async (b) => {
      const adjuntos: Adjunto[] = [];
      for (const [clase, lista] of [['foto', fotos], ['video', videos]] as const) {
        for (const f of lista) {
          const id = nuevoId();
          await guardarArchivo(id, f);
          adjuntos.push({ id, clase, mime: f.type, bytes: f.size, original: id, publico: null, estado: 'en-revision' });
        }
      }
      return crearReporte(b, v.datos, adjuntos, await hashCodigo(codigo), ahora);
    });
    return json({ codigo, ...resultado });
  }

  if (ruta === '/api/borrado' && metodo === 'POST') {
    const d = JSON.parse(String(init.body ?? '{}'));
    if (d.sitio) return json({ numero: nuevoCodigo('BOR') });
    const r = await transaccion((b) => crearSolicitud(b, d, ahora));
    return 'error' in r ? error(r.error.status, r.error.mensaje, r.error.campo) : json({ numero: r.numero });
  }

  if (ruta === '/api/moderacion' && metodo === 'GET') {
    const datos = await transaccion(async (b) => {
      const v = vistaModeracion(b, ahora);
      const conUrls = async <R extends { adjuntos: Adjunto[] }>(r: R) => ({
        ...r,
        adjuntos: await Promise.all(r.adjuntos.map(async (a) => ({ ...a, urlOriginal: await urlDe(a.original) }))),
      });
      return { ...v, pendientes: await Promise.all(v.pendientes.map(conUrls)), revisados: await Promise.all(v.revisados.map(conUrls)) };
    });
    return json(datos);
  }

  if (ruta === '/api/moderacion' && metodo === 'POST') {
    const d = JSON.parse(String(init.body ?? '{}'));
    if (d.accion === 'reiniciar-demo') {
      await (cola = cola.then(reiniciar));
      return json({ ok: true });
    }
    const resultado = await transaccion((b) => accionModeracion(b, d, ahora, borrarArchivo));
    return resultado ? error(400, resultado) : json({ ok: true });
  }

  if (ruta === '/api/observatorio' && metodo === 'GET') {
    const q = url.searchParams;
    return transaccion(async (b) => {
      const periodo = q.get('periodo');
      if (periodo) return json({ datos: calcularMes(b, periodo), cerrado: mesCerrado(periodo, ahora) });
      const informe = b.informes?.find((i) => i.id === (q.get('pdf') ?? q.get('datos')));
      if (!informe) return error(404, 'No se encontró el informe.');
      if (q.get('pdf')) {
        const pdf = await pdfInformeMensual(informe, LIMITE as [number, number][]);
        return new Response(new Uint8Array(pdf), { headers: { 'content-type': 'application/pdf' } });
      }
      return new Response(JSON.stringify(exportarDatos(informe, LIMITE as [number, number][]), null, 1), {
        headers: { 'content-type': 'application/json', 'x-titulo': encodeURIComponent(nombreMes(informe.periodo)) },
      });
    });
  }

  if (ruta === '/api/moderacion/foto' && metodo === 'POST') {
    const form = init.body as FormData;
    const archivo = form.get('archivo');
    if (!(archivo instanceof File)) return error(400, 'Falta la foto difuminada.');
    const id = nuevoId();
    await guardarArchivo(id, archivo);
    const mensaje = await transaccion((b) => publicarFoto(b, String(form.get('reporteId')), String(form.get('adjuntoId')), id, ahora));
    return mensaje ? error(400, mensaje) : json({ ok: true });
  }

  return error(404, 'No encontrado');
}

let instalado = false;
/** Desvía las llamadas a /api/* de esta página hacia la demostración local del navegador. */
export function instalarDemoNavegador() {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;
  const original = window.fetch.bind(window);
  window.fetch = async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url, location.href);
    if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
      try {
        return await atender(url, init);
      } catch (e) {
        console.error(e);
        return error(500, 'La demostración tuvo un problema. Probá recargar la página.');
      }
    }
    return original(entrada, init);
  };
}
