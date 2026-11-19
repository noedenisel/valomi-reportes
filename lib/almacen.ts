// Almacén de reportes del servidor.
// - En desarrollo: un archivo local (data/).
// - En producción: Supabase (lib/almacen-supabase.ts), solo si están configuradas sus variables. Hoy no lo están:
//   en producción todo responde «no disponible» y nunca se guardan reportes en un archivo del servidor.
// Las reglas viven en lib/operaciones.ts y son las mismas que usa la demostración en el navegador.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  borrarArchivoSupabase, guardarArchivoSupabase, leerArchivoSupabase, supabaseConfigurado, transaccionSupabase,
} from './almacen-supabase';
import { aplicarConservacion, baseVacia } from './operaciones';
import type { Base } from './tipos';

export type * from './tipos';

const DIR = join(process.cwd(), 'data');
const ARCHIVO = join(DIR, 'base.json');
const DIR_ADJUNTOS = join(DIR, 'adjuntos');

export class AlmacenNoDisponible extends Error {}

const local = () => process.env.NODE_ENV !== 'production' && !supabaseConfigurado();

export function almacenDisponible() {
  return supabaseConfigurado() || process.env.NODE_ENV !== 'production';
}

export async function guardarArchivo(nombre: string, datos: Uint8Array, mime: string) {
  if (!local()) return guardarArchivoSupabase(nombre, datos, mime);
  await mkdir(DIR_ADJUNTOS, { recursive: true });
  await writeFile(join(DIR_ADJUNTOS, nombre), datos);
}

export async function leerArchivo(nombre: string): Promise<Uint8Array> {
  return local() ? new Uint8Array(await readFile(join(DIR_ADJUNTOS, nombre))) : leerArchivoSupabase(nombre);
}

export const borrarArchivo = (nombre: string) =>
  local() ? rm(join(DIR_ADJUNTOS, nombre), { force: true }) : borrarArchivoSupabase(nombre);

let cola: Promise<unknown> = Promise.resolve();

async function leer(): Promise<Base> {
  try {
    return JSON.parse(await readFile(ARCHIVO, 'utf8'));
  } catch {
    return baseVacia();
  }
}

/** Lee, aplica los plazos de conservación, deja modificar y guarda. Una operación por vez. */
export function transaccion<T>(fn: (b: Base) => T | Promise<T>): Promise<T> {
  if (!almacenDisponible()) return Promise.reject(new AlmacenNoDisponible());
  if (!local()) return transaccionSupabase(fn, (b) => aplicarConservacion(b, Date.now(), borrarArchivo));
  const tarea = cola.then(async () => {
    const base = await leer();
    await aplicarConservacion(base, Date.now(), borrarArchivo);
    const r = await fn(base);
    await mkdir(DIR, { recursive: true });
    await writeFile(ARCHIVO, JSON.stringify(base, null, 1));
    return r;
  });
  cola = tarea.catch(() => undefined);
  return tarea;
}
