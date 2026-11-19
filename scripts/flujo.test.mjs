// Prueba del recorrido completo con las reglas compartidas (las mismas del servidor y de la demo):
// reportar, retener, moderar, corroborar, borrar, conservar y generar el informe mensual.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accionModeracion, aplicarConservacion, baseVacia, crearReporte, crearSolicitud, hashCodigo, validarReporte, vistaModeracion,
} from '../lib/operaciones.ts';
import { calcularMes, generarInforme, limitesMes, periodoDe } from '../lib/observatorio.ts';
import { aPublico, esVisible } from '../lib/publico.ts';
import { fechaArgentina } from '../lib/reglas.ts';

const H = 3600_000;
const CENTRO = { lon: -58.5317, lat: -34.6656 };
const campos = (extra = {}, ahora = Date.now()) => ({
  tipo: 'calle', descripcion: 'Me sacaron el celular cerca de la parada del colectivo', ...CENTRO, riesgo: 'no',
  fecha: fechaArgentina(ahora), rango: null, dia: 'hoy', hora: '00:00', acepto: true, fotos: [], videos: [], ...extra,
});
const sinBorrar = async () => {};

async function nuevo(b, extra, ahora = Date.now(), codigo = 'VLM-TEST-0001') {
  const v = validarReporte(campos(extra, ahora), ahora);
  assert.ok('datos' in v, JSON.stringify(v));
  return crearReporte(b, v.datos, [], await hashCodigo(codigo), ahora);
}

test('un reporte válido se publica enseguida como «Sin verificar» y sin punto exacto en lo público', async () => {
  const b = baseVacia();
  const r = await nuevo(b);
  assert.equal(r.retenido, false);
  const rep = b.reportes[0];
  assert.equal(rep.estadoPublico, 'sin-verificar');
  assert.ok(esVisible(rep));
  const pub = aPublico(rep);
  assert.equal(JSON.stringify(pub).includes(String(CENTRO.lon)), false);
  assert.notEqual(pub.zona.lon, CENTRO.lon);
});

test('con posibles datos personales queda retenido y no se ve en el mapa', async () => {
  const b = baseVacia();
  const r = await nuevo(b, { descripcion: 'El que me robó dejó el teléfono 11 5555 1234 anotado' });
  assert.equal(r.retenido, true);
  assert.equal(esVisible(b.reportes[0]), false);
  assert.equal(vistaModeracion(b, Date.now()).pendientes[0].estado, 'retenido');
});

test('«Sí» o «No sé» al riesgo de identificación suprimen la zona', async () => {
  const b = baseVacia();
  await nuevo(b, { riesgo: 'nose' });
  assert.equal(aPublico(b.reportes[0]).zona, null);
});

test('la validación del servidor rechaza fechas anteriores, ausentes y futuros manipulados', () => {
  const ahora = Date.parse('2026-11-20T18:00:00Z');
  assert.ok('datos' in validarReporte(campos({}, ahora), ahora));
  for (const extra of [
    { fecha: null }, { fecha: '2026-11-19' }, { fecha: '2026-11-21' },
    { dia: 'ayer' }, { dia: 'anteayer' }, { dia: 'mañana' },
    { hora: '15:01' }, { hora: '24:00' }, { hora: '00:99' },
    { hora: null, rango: '24-48' },
  ]) {
    const v = validarReporte(campos(extra, ahora), ahora);
    assert.ok('error' in v, JSON.stringify(extra));
    assert.equal(v.error.status, 400);
    assert.equal(v.error.campo, 'cuando');
  }
});

test('un formulario elegido antes de medianoche no se reinterpreta como hecho del nuevo día', () => {
  const elegido = Date.parse('2026-11-20T02:59:00Z'); // 19/11 a las 23:59 en Argentina
  const enviado = Date.parse('2026-11-20T03:01:00Z'); // 20/11 a las 00:01
  const datos = campos({ hora: '23:58' }, elegido);
  assert.equal(datos.fecha, '2026-11-19');
  const v = validarReporte(datos, enviado);
  assert.ok('error' in v);
  assert.equal(v.error.campo, 'cuando');
});

test('el mapa deja de mostrar un hecho al cumplir 48 h, aunque recién se modere o publique', async () => {
  const ahora = Date.parse('2026-11-20T18:00:00Z');
  const b = baseVacia();
  await nuevo(b, { hora: '10:00' }, ahora);
  const r = b.reportes[0];
  assert.equal(esVisible(r, r.momento + 48 * H - 1), true);
  await accionModeracion(b, { accion: 'revisar', id: r.id }, r.momento + 48 * H - 1, sinBorrar);
  assert.equal(esVisible(r, r.momento + 48 * H), false);
  assert.equal(esVisible(r, r.momento + 49 * H), false);
  assert.equal(b.reportes.length, 1, 'ocultar no elimina los datos internos');
  assert.notEqual(r.exacto, null, 'no se cambia el plazo de conservación privada');
});

test('estados: corroborar exige revisar antes y registra el método', async () => {
  const b = baseVacia();
  await nuevo(b);
  const id = b.reportes[0].id;
  assert.match(await accionModeracion(b, { accion: 'corroborar', id, metodo: 'visita' }, Date.now(), sinBorrar), /Revisado por VaLoMi/);
  assert.equal(await accionModeracion(b, { accion: 'revisar', id }, Date.now(), sinBorrar), null);
  assert.equal(b.reportes[0].estadoPublico, 'revisado');
  assert.equal(await accionModeracion(b, { accion: 'corroborar', id, metodo: 'contacto' }, Date.now(), sinBorrar), null);
  assert.equal(b.reportes[0].estadoPublico, 'corroborado');
  assert.deepEqual(b.reportes[0].confirmacion, { metodo: 'contacto', fuente: null });
});

test('borrado: la solicitud con código encuentra el reporte, no lo oculta, y al aceptarla se borra', async () => {
  const b = baseVacia();
  await nuevo(b, {}, Date.now(), 'VLM-ABCD-2345');
  const s = await crearSolicitud(b, { relacion: 'autor', referencia: 'vlm-abcd-2345', motivo: 'Lo cargué por error' }, Date.now());
  assert.ok('numero' in s);
  assert.equal(b.solicitudes[0].reporteId, b.reportes[0].id);
  assert.ok(esVisible(b.reportes[0]), 'sigue visible mientras se revisa');
  await accionModeracion(b, { accion: 'resolver-solicitud', solicitudId: b.solicitudes[0].id, resultado: 'borrado' }, Date.now(), sinBorrar);
  assert.equal(b.reportes.length, 0);
});

test('conservación: el punto exacto se borra a los 30 días del hecho', async () => {
  const b = baseVacia();
  await nuevo(b);
  b.reportes[0].momento -= 31 * 24 * H;
  await aplicarConservacion(b, Date.now(), sinBorrar);
  assert.equal(b.reportes[0].exacto, null);
});

test('informe mensual: cuenta por estado, excluye retenidos y retirados, y separa los sin zona', async () => {
  const b = baseVacia();
  const ahora = Date.now();
  const { desde } = limitesMes(periodoDe(ahora - 40 * 24 * H));
  const periodo = periodoDe(desde);
  const enElMes = async (extra) => {
    await nuevo(b, extra);
    b.reportes.at(-1).momento = desde + b.reportes.length * H;
  };
  await enElMes({});
  await enElMes({ tipo: 'vivienda' });
  await enElMes({ tipo: 'vivienda', riesgo: 'si' });
  await enElMes({ descripcion: 'El teléfono del sospechoso es 11 5555 1234' }); // retenido: no cuenta
  await enElMes({ tipo: 'otro' });
  await accionModeracion(b, { accion: 'revisar', id: b.reportes[1].id }, ahora, sinBorrar);
  await accionModeracion(b, { accion: 'retirar', id: b.reportes[4].id, motivo: 'Duplicado o spam' }, ahora, sinBorrar);

  const d = calcularMes(b, periodo);
  assert.equal(d.total, 3);
  assert.deepEqual(d.porEstado, { 'sin-verificar': 2, revisado: 1, corroborado: 0 });
  assert.equal(d.porCategoria.vivienda.revisado, 1);
  assert.equal(d.sinZona, 1);
  assert.equal(d.celdas.reduce((s, c) => s + c.cantidad, 0), 2);
  assert.equal(d.total, d.porEstado['sin-verificar'] + d.porEstado.revisado + d.porEstado.corroborado);
});

test('informe mensual: no se genera con el mes abierto y uno aprobado no se pisa', async () => {
  const b = baseVacia();
  const ahora = Date.now();
  assert.match(generarInforme(b, periodoDe(ahora), ahora), /no cerró/);
  const anterior = periodoDe(limitesMes(periodoDe(ahora)).desde - H);
  assert.equal(generarInforme(b, anterior, ahora + 13 * H), null);
  await accionModeracion(b, { accion: 'aprobar-informe', informeId: b.informes[0].id }, ahora, sinBorrar);
  assert.equal(b.informes[0].estado, 'aprobado');
  assert.match(generarInforme(b, anterior, ahora + 13 * H), /ya tiene un informe aprobado/);
});

test('la demo siempre trae un mes cerrado para probar el informe, también el primer día del mes', async () => {
  const { sembrarDemo } = await import('../lib/operaciones.ts');
  const { mesCerrado, mesesConReportes } = await import('../lib/observatorio.ts');
  for (const ahora of [Date.UTC(2026, 10, 1, 4), Date.UTC(2026, 10, 15, 12), Date.UTC(2027, 0, 1, 5)]) {
    const b = await sembrarDemo(ahora, async () => crypto.randomUUID(), 1);
    assert.ok(mesesConReportes(b).some((m) => mesCerrado(m, ahora)), new Date(ahora).toISOString());
  }
});
