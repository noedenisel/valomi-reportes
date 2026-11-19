// Prueba: reglas aprobadas de territorio, grilla, plazo de 48 horas y aviso de datos personales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { celda, dentroDelTerritorio, distanciaAlBorde } from '../lib/geo.mjs';
import { errorMomento, errorDescripcion, esMomentoVisible, fechaArgentina, momentoDelHecho } from '../lib/reglas.ts';
import { posiblesDatosPersonales } from '../lib/datos-personales.ts';

const anillo = JSON.parse(readFileSync(new URL('../lib/limite-datos.json', import.meta.url)));

test('un punto del centro del barrio se acepta; uno de Capital, no', () => {
  assert.equal(dentroDelTerritorio(-58.5317, -34.6656, anillo), true);
  assert.equal(dentroDelTerritorio(-58.505, -34.65, anillo), false);
});

test('tolerancia de 30 m por fuera del borde', () => {
  // Se busca un punto justo afuera, desplazándose desde un vértice hacia afuera del barrio.
  const [lon, lat] = anillo[0];
  const centro = [-58.5317, -34.6656];
  const fuera = (m) => [lon + (lon - centro[0]) * m, lat + (lat - centro[1]) * m];
  let a20 = null, a40 = null;
  for (let k = 0.0001; k < 0.05; k += 0.0001) {
    const [x, y] = fuera(k);
    const d = distanciaAlBorde(x, y, anillo);
    if (!a20 && d >= 18 && d <= 22) a20 = [x, y];
    if (!a40 && d >= 38 && d <= 45) a40 = [x, y];
  }
  assert.ok(a20 && a40, 'no se encontraron puntos de prueba');
  assert.equal(dentroDelTerritorio(...a20, anillo), true);
  assert.equal(dentroDelTerritorio(...a40, anillo), false);
});

test('la grilla devuelve el centro de una celda fija de 200 m, igual para puntos cercanos', () => {
  const a = celda(-58.53170, -34.66560);
  const b = celda(-58.53175, -34.66562);
  assert.equal(a.id, b.id);
  assert.notEqual(a.lon, -58.5317);
});

test('el día se determina por Argentina, también entre medianoche UTC y medianoche argentina', () => {
  assert.equal(fechaArgentina(Date.parse('2026-11-20T02:59:59Z')), '2026-11-19');
  assert.equal(fechaArgentina(Date.parse('2026-11-20T03:00:00Z')), '2026-11-20');
});

test('se acepta hoy desde las 00:00 y se rechaza ayer aunque hayan pasado pocos minutos', () => {
  const ahora = Date.parse('2026-11-20T03:05:00Z'); // 00:05 en Argentina
  const hoy = Date.parse('2026-11-20T03:00:00Z');
  const ayer = Date.parse('2026-11-20T02:59:00Z');
  assert.equal(errorMomento(hoy, ahora), null);
  assert.match(errorMomento(ayer, ahora), /hoy/);
  assert.equal(momentoDelHecho({ fecha: '2026-11-20', dia: 'hoy', hora: '00:00' }, ahora), hoy);
  assert.equal(momentoDelHecho({ fecha: '2026-11-19', dia: 'hoy', hora: '23:59' }, ahora), null);
  assert.equal(momentoDelHecho({ fecha: '2026-11-20', dia: 'ayer', hora: '23:59' }, ahora), null);
  assert.equal(momentoDelHecho({ fecha: '2026-11-20', dia: 'anteayer', hora: '23:59' }, ahora), null);
});

test('las horas imposibles no se normalizan a otra hora o día', () => {
  const ahora = Date.parse('2026-11-20T22:00:00Z');
  for (const hora of ['24:00', '25:10', '00:60', '12:99', '99:99', '7:00', '-1:00', 'abc']) {
    assert.equal(momentoDelHecho({ fecha: '2026-11-20', dia: 'hoy', hora }, ahora), null, hora);
  }
  assert.match(errorMomento(NaN, ahora), /hora válida/);
});

test('no se aceptan horas ni fechas futuras, tampoco dentro de cinco minutos', () => {
  const ahora = Date.parse('2026-11-20T12:00:00Z');
  assert.match(errorMomento(ahora + 1, ahora), /todavía no pasó/);
  assert.equal(momentoDelHecho({ fecha: '2026-11-21', hora: '00:00' }, ahora), null);
  assert.match(errorMomento(momentoDelHecho({ fecha: '2026-11-20', hora: '09:01' }, ahora), ahora), /todavía no pasó/);
});

test('un rango rápido que cruza la medianoche argentina se rechaza', () => {
  const madrugada = Date.parse('2026-11-20T03:10:00Z');
  assert.equal(momentoDelHecho({ fecha: '2026-11-20', rango: 'recien' }, madrugada), null);
  const tarde = Date.parse('2026-11-20T18:00:00Z');
  assert.equal(errorMomento(momentoDelHecho({ fecha: '2026-11-20', rango: '1-3' }, tarde), tarde), null);
  assert.equal(momentoDelHecho({ fecha: '2026-11-20', rango: '24-48' }, tarde), null);
});

test('visibilidad: 47 h 59 min sí; al cumplir 48 h y después, no', () => {
  const ahora = Date.parse('2026-11-20T18:00:00Z');
  assert.equal(esMomentoVisible(ahora - (47 * 60 + 59) * 60_000, ahora), true);
  assert.equal(esMomentoVisible(ahora - 48 * 3600_000, ahora), false);
  assert.equal(esMomentoVisible(ahora - 48 * 3600_000 - 1, ahora), false);
  assert.equal(esMomentoVisible(ahora + 1, ahora), false);
  assert.equal(esMomentoVisible(NaN, ahora), false);
});

test('descripción: 20 a 500 caracteres y sin links', () => {
  assert.match(errorDescripcion('corto'), /20 caracteres/);
  assert.match(errorDescripcion('Mirá lo que pasó en www.ejemplo.com ayer'), /links/);
  assert.equal(errorDescripcion('Me arrebataron el celular en la parada del colectivo'), null);
});

test('aviso de posibles datos personales', () => {
  assert.ok(posiblesDatosPersonales('mi número es 11 5555 1234').length > 0);
  assert.ok(posiblesDatosPersonales('la patente era AB123CD').length > 0);
  assert.equal(posiblesDatosPersonales('Me robaron el celular en la parada').length, 0);
});
