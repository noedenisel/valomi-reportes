// Prueba: el pase de los archivos solo vale firmado, vigente y para esos mismos archivos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPase, paseValido } from '../lib/captcha.ts';

const S = 'x'.repeat(40);
const AHORA = 1_800_000_000_000;
const IDS = ['temporal/a', 'temporal/b'];

test('vale para esos archivos, en cualquier orden', () => {
  const p = crearPase(IDS, AHORA, S);
  assert.equal(paseValido(p, IDS, AHORA, S), true);
  assert.equal(paseValido(p, [...IDS].reverse(), AHORA, S), true);
});

test('no vale para otros archivos, vencido, con otra firma o vacío', () => {
  const p = crearPase(IDS, AHORA, S);
  assert.equal(paseValido(p, ['temporal/a'], AHORA, S), false);
  assert.equal(paseValido(p, IDS, AHORA + 3600_001, S), false);
  assert.equal(paseValido(p, IDS, AHORA, 'y'.repeat(40)), false);
  assert.equal(paseValido(`${AHORA * 2}.${p.split('.')[1]}`, IDS, AHORA, S), false);
  assert.equal(paseValido(null, IDS, AHORA, S), false);
  assert.equal(paseValido(p, [], AHORA, S), false);
});
