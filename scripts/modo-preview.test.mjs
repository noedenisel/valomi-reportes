import { test } from 'node:test';
import assert from 'node:assert/strict';

const demo = 'prj_wMEsSpWxE9yZ2skvXAIBifpU8Goz';
const real = 'prj_4CNMQesFHuLyoX18BtWHHUiWnsID';
let version = 0;

async function configuracion(entorno) {
  const nombres = ['VERCEL_PROJECT_ID', 'VERCEL_ENV', 'NEXT_PUBLIC_VALOMI_DEMO'];
  const anterior = Object.fromEntries(nombres.map((n) => [n, process.env[n]]));
  try {
    for (const n of nombres) {
      if (entorno[n] === undefined) delete process.env[n];
      else process.env[n] = entorno[n];
    }
    return (await import(`../next.config.ts?caso=${++version}`)).default;
  } finally {
    for (const n of nombres) {
      if (anterior[n] === undefined) delete process.env[n];
      else process.env[n] = anterior[n];
    }
  }
}

test('Preview del proyecto demo compila servidor y navegador en modo local sin la variable de Production', async () => {
  const c = await configuracion({ VERCEL_PROJECT_ID: demo, VERCEL_ENV: 'preview' });
  assert.deepEqual(c.env, { NEXT_PUBLIC_VALOMI_DEMO: 'navegador' });
});

test('la configuración automática no habilita demo en proyecto real, producción ni proyectos desconocidos', async () => {
  for (const e of [
    { VERCEL_PROJECT_ID: real, VERCEL_ENV: 'preview' },
    { VERCEL_PROJECT_ID: real, VERCEL_ENV: 'production' },
    { VERCEL_PROJECT_ID: demo, VERCEL_ENV: 'production' },
    { VERCEL_PROJECT_ID: demo, VERCEL_ENV: 'development' },
    { VERCEL_PROJECT_ID: 'otro-proyecto', VERCEL_ENV: 'preview' },
    { VERCEL_ENV: 'preview' }, {},
  ]) assert.equal((await configuracion(e)).env, undefined);
});

test('fuera del Preview demo se conserva la variable explícita sin sobrescribirla', async () => {
  for (const valor of ['navegador', '']) {
    assert.equal((await configuracion({ VERCEL_PROJECT_ID: demo, VERCEL_ENV: 'production', NEXT_PUBLIC_VALOMI_DEMO: valor })).env, undefined);
  }
});
