// Prueba: la sesión de la moderación solo vale firmada, vigente y para el correo habilitado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DURACION_SESION_S, crearSesion, sesionValida } from '../lib/sesion.ts';

const SECRETO = 'x'.repeat(40);
const CORREO = 'moderacion@ejemplo.test';
const AHORA = 1_800_000_000_000;

test('una sesión correcta vale', () => {
  assert.equal(sesionValida(crearSesion(CORREO, AHORA, SECRETO), AHORA, SECRETO, CORREO), true);
});

test('vence a las 12 horas', () => {
  const s = crearSesion(CORREO, AHORA, SECRETO);
  assert.equal(sesionValida(s, AHORA + DURACION_SESION_S * 1000 + 1, SECRETO, CORREO), false);
});

test('una firma de otro secreto, alterada o vacía no vale', () => {
  const s = crearSesion(CORREO, AHORA, SECRETO);
  assert.equal(sesionValida(s, AHORA, 'y'.repeat(40), CORREO), false);
  assert.equal(sesionValida(`${s}a`, AHORA, SECRETO, CORREO), false);
  const [, firma] = s.split('.');
  const otro = Buffer.from(JSON.stringify({ c: CORREO, v: AHORA * 2 })).toString('base64url');
  assert.equal(sesionValida(`${otro}.${firma}`, AHORA, SECRETO, CORREO), false);
  assert.equal(sesionValida(undefined, AHORA, SECRETO, CORREO), false);
  assert.equal(sesionValida('basura', AHORA, SECRETO, CORREO), false);
});

test('si cambia el correo habilitado, la sesión anterior deja de valer', () => {
  assert.equal(sesionValida(crearSesion(CORREO, AHORA, SECRETO), AHORA, SECRETO, 'otra@ejemplo.test'), false);
});

test('sin correo habilitado o con un secreto corto, nadie entra', () => {
  const s = crearSesion(CORREO, AHORA, SECRETO);
  assert.equal(sesionValida(s, AHORA, SECRETO, null), false);
  assert.equal(sesionValida(s, AHORA, 'corto', CORREO), false);
  assert.throws(() => crearSesion(CORREO, AHORA, 'corto'));
});

test('con varios correos habilitados, entran todos y nadie más', () => {
  const varios = ` ${CORREO} , Otra@Ejemplo.test`;
  assert.equal(sesionValida(crearSesion(CORREO, AHORA, SECRETO), AHORA, SECRETO, varios), true);
  assert.equal(sesionValida(crearSesion('otra@ejemplo.test', AHORA, SECRETO), AHORA, SECRETO, varios), true);
  assert.equal(sesionValida(crearSesion('intruso@ejemplo.test', AHORA, SECRETO), AHORA, SECRETO, varios), false);
});
