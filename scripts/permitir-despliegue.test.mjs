import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { permitirDespliegue } from './permitir-despliegue.mjs';

const REAL = 'prj_4CNMQesFHuLyoX18BtWHHUiWnsID';
const DEMO = 'prj_wMEsSpWxE9yZ2skvXAIBifpU8Goz';
const entorno = (proyecto = REAL, ambiente = 'production', rama = 'main') => ({
  VERCEL_PROJECT_ID: proyecto,
  VERCEL_ENV: ambiente,
  VERCEL_GIT_COMMIT_REF: rama,
});

test('producción se construye únicamente para el mapa real desde main', () => {
  assert.equal(permitirDespliegue(entorno()), true);
  assert.equal(permitirDespliegue(entorno(DEMO)), false);
  assert.equal(permitirDespliegue(entorno(REAL, 'production', 'preview/dia-48h')), false);
  assert.equal(permitirDespliegue(entorno(REAL, 'production', 'Main')), false);
});

test('ambos proyectos conocidos pueden generar vistas previas', () => {
  for (const proyecto of [REAL, DEMO]) {
    assert.equal(permitirDespliegue(entorno(proyecto, 'preview', 'preview/dia-48h')), true);
    assert.equal(permitirDespliegue(entorno(proyecto, 'preview', 'main')), true);
  }
});

test('el mapa real no se publica en modo demo, que sigue permitido en vistas previas', () => {
  assert.equal(permitirDespliegue({ ...entorno(), NEXT_PUBLIC_VALOMI_DEMO: 'navegador' }), false);
  for (const proyecto of [REAL, DEMO]) {
    assert.equal(permitirDespliegue({
      ...entorno(proyecto, 'preview', 'preview/dia-48h'), NEXT_PUBLIC_VALOMI_DEMO: 'navegador',
    }), true);
  }
});

test('omite proyectos desconocidos, entornos imprevistos o identidad incompleta', () => {
  assert.equal(permitirDespliegue(entorno('prj_otro')), false);
  assert.equal(permitirDespliegue(entorno('prj_otro', 'preview')), false);
  assert.equal(permitirDespliegue(entorno(REAL, 'development')), false);
  assert.equal(permitirDespliegue(entorno(REAL, 'staging')), false);
  assert.equal(permitirDespliegue(entorno(REAL, 'preview', '')), false);
  assert.equal(permitirDespliegue(entorno(REAL, 'preview', ' ')), false);
  assert.equal(permitirDespliegue(), false);
  for (const campo of ['VERCEL_PROJECT_ID', 'VERCEL_ENV', 'VERCEL_GIT_COMMIT_REF']) {
    const incompleto = entorno();
    delete incompleto[campo];
    assert.equal(permitirDespliegue(incompleto), false, campo);
  }
});

test('la orden respeta los códigos de Vercel: 1 construye y 0 omite', () => {
  const script = fileURLToPath(new URL('./permitir-despliegue.mjs', import.meta.url));
  for (const [configuracion, esperado] of [
    [entorno(), 1],
    [{ ...entorno(), NEXT_PUBLIC_VALOMI_DEMO: 'navegador' }, 0],
    [entorno(DEMO), 0],
    [entorno(REAL, 'production', 'otra'), 0],
    [entorno(REAL, 'preview', 'preview/dia-48h'), 1],
    [entorno(DEMO, 'preview', 'preview/dia-48h'), 1],
    [entorno('prj_otro', 'preview'), 0],
    [{}, 0],
  ]) {
    const resultado = spawnSync(process.execPath, [script], { env: configuracion, encoding: 'utf8' });
    assert.equal(resultado.error, undefined);
    assert.equal(resultado.status, esperado, resultado.stderr || resultado.stdout);
    assert.match(resultado.stdout, esperado === 1 ? /continuar despliegue/ : /omitir despliegue/);
  }
});

test('importar el módulo no termina el proceso ni ejecuta el despliegue', () => {
  const script = new URL('./permitir-despliegue.mjs', import.meta.url).href;
  const resultado = spawnSync(process.execPath, ['--input-type=module', '-e',
    `await import(${JSON.stringify(script)}); console.log('importacion completa');`,
  ], { env: entorno(), encoding: 'utf8' });
  assert.equal(resultado.status, 0, resultado.stderr);
  assert.equal(resultado.stdout.trim(), 'importacion completa');
});
