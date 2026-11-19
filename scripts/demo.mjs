// Demostración local: borra los datos locales (data/) y carga reportes FICTICIOS, todos marcados como DEMO.
// Usa los mismos datos que la demostración en el navegador (lib/operaciones.ts). Nunca se usa en producción.
// Uso: npm run demo
import { copyFileSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sembrarDemo } from '../lib/operaciones.ts';

const raiz = join(import.meta.dirname, '..');
const DATA = join(raiz, 'data');
const ADJ = join(DATA, 'adjuntos');
const FOTO = join(raiz, 'public', 'demo', 'foto-demo.jpg');

rmSync(DATA, { recursive: true, force: true });
mkdirSync(ADJ, { recursive: true });
const base = await sembrarDemo(Date.now(), async () => {
  const id = crypto.randomUUID();
  copyFileSync(FOTO, join(ADJ, id));
  return id;
}, statSync(FOTO).size);
writeFileSync(join(DATA, 'base.json'), JSON.stringify(base, null, 1));
console.log(`Demostración lista: ${base.reportes.length} reportes y ${base.solicitudes.length} solicitudes, todos ficticios (DEMO).`);
console.log('Código de reporte para probar el borrado: VLM-DEMO-0001');
