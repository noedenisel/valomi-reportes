// Un mismo repositorio alimenta el mapa real y la demostración.
// Vercel interpreta salida 0 como «omitir» y salida 1 como «construir».
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROYECTO_REAL = 'prj_4CNMQesFHuLyoX18BtWHHUiWnsID';
const PROYECTO_DEMO = 'prj_wMEsSpWxE9yZ2skvXAIBifpU8Goz';

export function permitirDespliegue(entorno = {}) {
  const proyecto = entorno.VERCEL_PROJECT_ID;
  const ambiente = entorno.VERCEL_ENV;
  const rama = entorno.VERCEL_GIT_COMMIT_REF;
  if (![PROYECTO_REAL, PROYECTO_DEMO].includes(proyecto)) return false;
  if (typeof rama !== 'string' || !rama.trim()) return false;
  if (ambiente === 'preview') return true;
  return ambiente === 'production' && proyecto === PROYECTO_REAL && rama === 'main'
    && entorno.NEXT_PUBLIC_VALOMI_DEMO !== 'navegador';
}

// Importar la función en las pruebas no ejecuta la orden de Vercel.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const permitido = permitirDespliegue(process.env);
  console.log(`VaLoMi: ${permitido ? 'continuar' : 'omitir'} despliegue según proyecto, entorno y rama.`);
  process.exitCode = permitido ? 1 : 0;
}
