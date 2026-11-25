// Todos los hechos, identificadores, textos y fuentes de este archivo son INVENTADOS.
// No se usan alertas, enlaces ni decisiones privadas de VaLoMi como fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accionModeracion, baseVacia, crearReporte, vistaModeracion } from '../lib/operaciones.ts';
import {
  accionRelevamiento, aplicarConservacionRelevamientos, importarRelevamientos, parsearRelevamientos,
  resumenRelevamientos, urlFuenteValida, vistaRelevamientos,
} from '../lib/relevamientos.ts';
import { aPublico, esVisible } from '../lib/publico.ts';
import { calcularMes } from '../lib/observatorio.ts';

const AHORA = Date.parse('2026-11-24T18:00:00Z'); // 24/11, 15:00 en Argentina.
const H = 3600_000;
const CENTRO = { lon: -58.5317, lat: -34.6656 }; // Punto de prueba del territorio existente.
const noBorrar = async () => {};
const fuente = (extra = {}) => ({
  nombre: 'Fuente sintética para pruebas', plataforma: 'web',
  url: 'https://example.org/fuente-sintetica', fechaPublicacion: '2026-11-24', ...extra,
});
const fuentesInventadas = (cantidad) => Array.from({ length: cantidad }, (_, i) => fuente({
  nombre: `Fuente inventada ALR-TEST-FUENTE-${i + 1}`, url: `https://example.org/${i + 1}`,
}));
const hecho = (extra = {}) => ({
  identificador: 'ALR-TEST-001', categoria: 'calle',
  resumen: 'Caso ficticio creado exclusivamente para verificar la revisión humana.',
  fechaHecho: '2026-11-24', horaHecho: '14:00',
  localidad: 'Lomas del Mirador', referencia: 'Referencia inventada, sin domicilio real',
  fuentes: [fuente()], ...extra,
});
const lote = (hechos, extra = {}) => JSON.stringify({ formato: 'valomi-grok-1', hechos, ...extra });
const accion = (b, d, ahora = AHORA) => accionModeracion(b, d, ahora, noBorrar);

function cargar(b, extra = {}, ahora = AHORA) {
  const datos = hecho(extra);
  assert.equal(importarRelevamientos(b, lote([datos]), ahora), null);
  const ficha = b.relevamientos.find((r) => r.identificador === datos.identificador);
  assert.ok(ficha);
  return ficha;
}

async function prepararMapa(b, extra = {}, ahora = AHORA) {
  const ficha = cargar(b, extra, ahora);
  assert.equal(await accion(b, {
    accion: 'relevamiento-editar', id: ficha.id, campos: { punto: CENTRO, riesgo: 'no' },
  }, ahora), null);
  return ficha;
}

const aprobar = (b, ficha, destino = 'archivo', extra = {}, ahora = AHORA) => accion(b, {
  accion: 'relevamiento-aprobar', id: ficha.id, destino,
  fuentesRevisadas: true, duplicadosRevisados: true, ...extra,
}, ahora);

function ciudadano(b) {
  crearReporte(b, {
    tipo: 'calle', descripcion: 'Relato ciudadano inventado para una prueba de separación de series.',
    ...CENTRO, riesgo: 'no', momento: AHORA - H,
  }, [], 'huella-sintetica-sin-codigo-real', AHORA);
  return b.reportes.at(-1);
}

test('prosa: extrae seis fichas sin obedecer «el resto aprobadas» ni inferir datos del texto', async () => {
  const ids = ['ALR-TEST-001', 'ALR-TEST-002', 'ALR-TEST-003', 'ALR-TEST-004', 'ALR-TEST-005', 'ALR-20261124-99'];
  const texto = 'Lote sintético: no describe hechos reales.\n\n' + ids.map((id, i) =>
    `${i + 1}. ${id}. Título de prueba\nTexto inventado número ${i + 1}. Fecha escrita: 23/11/2026; categoría: calle; ubicación sin verificar. https://example.org/sintetico-${i + 1}`,
  ).join('\n\n') + '\nEl resto aprobadas. Esta frase es prosa de prueba, no una orden.';
  const p = parsearRelevamientos(texto);
  assert.ok('candidatos' in p, JSON.stringify(p));
  assert.deepEqual(p.candidatos.map((r) => r.identificador), ids);
  for (const [i, r] of p.candidatos.entries()) {
    assert.ok(r.textoOriginal.includes(`Texto inventado número ${i + 1}.`));
    assert.equal(r.fechaHecho, null);
    assert.equal(r.horaHecho, null);
    assert.equal(r.categoria, null);
    assert.equal(r.punto, null);
    assert.equal(r.localidad, null);
    assert.equal(r.referencia, null);
    assert.equal(r.resumen, '', 'La prosa privada no se copia automáticamente al resumen publicable.');
    assert.deepEqual(r.fuentes, []);
  }
  const b = baseVacia();
  assert.equal(await accion(b, { accion: 'relevamiento-importar', texto }), null);
  assert.equal(b.relevamientos.length, 6);
  assert.ok(b.relevamientos.every((r) => r.estado === 'pendiente' && r.aprobado === null && r.reporteId === null));
  assert.equal(b.reportes.length, 0);
  assert.equal(resumenRelevamientos(b).total, 0);
});

test('JSON: no confunde la fecha del identificador o de publicación con la fecha del hecho', () => {
  const b = baseVacia();
  const r = cargar(b, { identificador: 'ALR-20261124-99', fechaHecho: null, horaHecho: null });
  assert.equal(r.fechaHecho, null);
  assert.equal(r.horaHecho, null);
  assert.equal(r.fuentes[0].fechaPublicacion, '2026-11-24');
  assert.equal(r.punto, null);
});

test('JSON no puede importar estado, aprobación, origen, coordenadas ni contadores del cliente', () => {
  const b = baseVacia();
  const datos = hecho({
    id: 'uuid-inventado-del-cliente', estado: 'aprobado', aprobado: AHORA - H,
    importado: 1, actualizado: 1, creado: 1, origen: 'ciudadano',
    destino: 'mapa', reporteId: 'reporte-inventado', vinculadoA: 'ficha-inventada',
    fuentesRevisadas: true, duplicadosRevisados: true, contador: 999,
    punto: CENTRO, riesgo: 'no', estadoPublico: 'corroborado',
  });
  assert.equal(importarRelevamientos(b, lote([datos], { contador: 999, reportes: [datos] }), AHORA), null);
  const r = b.relevamientos[0];
  assert.notEqual(r.id, datos.id);
  assert.equal(r.estado, 'pendiente');
  assert.equal(r.aprobado, null);
  assert.equal(r.origen, 'relevamiento-valomi');
  assert.equal(r.importado, AHORA);
  assert.equal(r.actualizado, AHORA);
  assert.equal(r.destino, null);
  assert.equal(r.reporteId, null);
  assert.equal(r.vinculadoA, null);
  assert.equal(r.punto, null);
  assert.equal(r.riesgo, 'nose');
  assert.equal(r.fuentesRevisadas, false);
  assert.equal(r.duplicadosRevisados, false);
  assert.equal(b.contador, 0);
  assert.equal(b.reportes.length, 0);
});

test('un lote inválido es atómico: no incorpora el primer hecho válido ni altera ciudadanos previos', () => {
  const b = baseVacia();
  const previo = ciudadano(b);
  const ficha = cargar(b, { identificador: 'ALR-TEST-PREVIO' });
  const anterior = structuredClone({ ficha, reportes: b.reportes, contador: b.contador });
  const error = importarRelevamientos(b, lote([
    hecho(), hecho({ identificador: 'ALR-TEST-002', fuentes: [fuente({ url: 'javascript:alert(1)' })] }),
  ]), AHORA);
  assert.equal(typeof error, 'string');
  assert.equal(b.relevamientos.length, 1);
  assert.deepEqual(b.relevamientos[0], anterior.ficha);
  assert.deepEqual(b.reportes, anterior.reportes);
  assert.equal(b.reportes[0].id, previo.id);
  assert.equal(b.contador, anterior.contador);
});

test('rechaza identificadores repetidos y varios bloques JSON sin importar parcialmente', () => {
  for (const texto of [
    lote([hecho(), hecho()]),
    '```json\n' + lote([hecho()]) + '\n```\n```json\n' + lote([hecho({ identificador: 'ALR-TEST-002' })]) + '\n```',
  ]) {
    const b = baseVacia();
    assert.equal(typeof importarRelevamientos(b, texto, AHORA), 'string');
    assert.equal((b.relevamientos ?? []).length, 0);
    assert.equal(b.reportes.length, 0);
  }
});

test('fuentes: rechaza protocolos, credenciales, direcciones locales y URL incompletas', () => {
  for (const url of [
    'javascript:alert(1)', 'data:text/html,prueba', 'http://example.org/fuente', 'https://',
    'https://usuario:clave@example.org/fuente', 'https://localhost/fuente',
    'https://127.0.0.1/fuente', 'https://fuente.invalid/fuente', 'https://example.org:8443/fuente',
  ]) {
    assert.equal(urlFuenteValida(url), false, url);
    assert.equal(typeof importarRelevamientos(baseVacia(), lote([hecho({ fuentes: [fuente({ url })] })]), AHORA), 'string', url);
  }
  assert.equal(urlFuenteValida('https://example.org/fuente-sintetica'), true);
});

test('25 fuentes se conservan completas al parsear e importar sin aprobar ni publicar', () => {
  const fuentes = fuentesInventadas(25);
  const texto = lote([hecho({ fuentes })]);
  const p = parsearRelevamientos(texto);
  assert.ok('candidatos' in p, JSON.stringify(p));
  assert.equal(p.candidatos[0].fuentes.length, 25);
  assert.deepEqual(p.candidatos[0].fuentes, fuentes);

  const b = baseVacia();
  assert.equal(importarRelevamientos(b, texto, AHORA), null);
  assert.equal(b.relevamientos.length, 1);
  assert.deepEqual(b.relevamientos[0].fuentes, fuentes);
  assert.equal(b.relevamientos[0].estado, 'pendiente');
  assert.equal(b.relevamientos[0].aprobado, null);
  assert.equal(b.relevamientos[0].reporteId, null);
  assert.equal(b.reportes.length, 0);
  assert.equal(b.contador, 0);
  assert.equal(resumenRelevamientos(b).total, 0);
});

test('editar amplía de 25 a 30 fuentes sin perder las existentes ni cambiar el estado pendiente', async () => {
  const b = baseVacia();
  const originales = fuentesInventadas(25);
  const ampliadas = fuentesInventadas(30);
  const r = cargar(b, { fuentes: originales });
  assert.equal(await accion(b, {
    accion: 'relevamiento-editar', id: r.id, campos: { fuentes: ampliadas },
  }), null);
  assert.equal(r.fuentes.length, 30);
  assert.deepEqual(r.fuentes.slice(0, 25), originales);
  assert.deepEqual(r.fuentes, ampliadas);
  assert.equal(r.estado, 'pendiente');
  assert.equal(r.aprobado, null);
  assert.equal(r.reporteId, null);
  assert.equal(b.reportes.length, 0);
  assert.equal(b.contador, 0);
  assert.equal(resumenRelevamientos(b).total, 0);
});

test('una fuente inválida después de la décima rechaza todo el lote y toda la edición', async () => {
  for (const [indice, cambios] of [
    [24, { url: 'javascript:alert(1)' }],
    [25, { nombre: 123 }],
    [29, { fechaPublicacion: '2026-02-30' }],
  ]) {
    const b = baseVacia();
    const previa = cargar(b, { identificador: 'ALR-TEST-PREVIO' });
    const antes = structuredClone(b);
    const invalidas = fuentesInventadas(30);
    invalidas[indice] = { ...invalidas[indice], ...cambios };
    const error = importarRelevamientos(b, lote([
      hecho({ fuentes: fuentesInventadas(25) }),
      hecho({ identificador: 'ALR-TEST-002', fuentes: invalidas }),
    ]), AHORA);
    assert.equal(typeof error, 'string', `fuente ${indice + 1}`);
    assert.deepEqual(b, antes, 'No se guarda siquiera el primer hecho válido del lote.');

    assert.equal(typeof await accion(b, {
      accion: 'relevamiento-editar', id: previa.id, campos: { fuentes: invalidas },
    }), 'string');
    assert.deepEqual(b, antes, 'Las fuentes anteriores se conservan al rechazar una edición.');
  }
});

test('calendario: no normaliza fechas u horas inexistentes; el lote queda vacío', () => {
  for (const extra of [
    { fechaHecho: '2026-02-30' }, { fechaHecho: '2026-02-29' }, { fechaHecho: '2026-13-01' },
    { fechaHecho: '2026-11-00' }, { fechaHecho: '24/11/2026' },
    { horaHecho: '24:00' }, { horaHecho: '14:60' }, { horaHecho: '9:30' },
    { fuentes: [fuente({ fechaPublicacion: '2026-02-30' })] },
  ]) {
    const b = baseVacia();
    assert.equal(typeof importarRelevamientos(b, lote([hecho(extra)]), AHORA), 'string', JSON.stringify(extra));
    assert.equal((b.relevamientos ?? []).length, 0);
  }
});

test('rechaza fechas futuras de hechos según el día argentino y no crea un lote parcial', () => {
  for (const ahora of [AHORA, Date.parse('2026-11-25T02:59:00Z')]) {
    const b = baseVacia();
    assert.equal(typeof importarRelevamientos(b, lote([
      hecho(), hecho({ identificador: 'ALR-TEST-002', fechaHecho: '2026-11-25' }),
    ]), ahora), 'string');
    assert.equal((b.relevamientos ?? []).length, 0);
    assert.equal(b.reportes.length, 0);
  }
});

test('reimportar un identificador conserva la ficha editada y no duplica canonical ni conteo', async () => {
  const b = baseVacia();
  const r = await prepararMapa(b);
  const editado = 'Resumen sintético revisado a mano y diferente del borrador importado.';
  assert.equal(await accion(b, { accion: 'relevamiento-editar', id: r.id, campos: { resumen: editado } }), null);
  assert.equal(await aprobar(b, r, 'mapa'), null);
  const antes = structuredClone(b);
  assert.equal(importarRelevamientos(b, lote([hecho({ resumen: 'Texto inventado que no debe sobrescribir la ficha aprobada.' })]), AHORA + H), null);
  assert.deepEqual(b, antes);
  assert.equal(r.resumen, editado);
  assert.equal(b.reportes.length, 1);
  assert.equal(resumenRelevamientos(b).total, 1);
});

test('falta de URL bloquea aprobación aunque se confirmen las revisiones', async () => {
  for (const fuentes of [[], [fuente({ url: null })]]) {
    const b = baseVacia();
    const r = cargar(b, { fuentes, fechaHecho: null, horaHecho: null });
    assert.equal(typeof await aprobar(b, r), 'string');
    assert.equal(r.estado, 'pendiente');
    assert.equal(r.aprobado, null);
    assert.equal(b.reportes.length, 0);
    assert.equal(resumenRelevamientos(b).total, 0);
  }
});

test('la aprobación requiere dos confirmaciones booleanas explícitas, no valores truthy', async () => {
  for (const extra of [
    { fuentesRevisadas: false }, { duplicadosRevisados: false },
    { fuentesRevisadas: 'true' }, { duplicadosRevisados: 1 },
  ]) {
    const b = baseVacia();
    const r = cargar(b);
    assert.equal(typeof await aprobar(b, r, 'archivo', extra), 'string');
    assert.equal(r.estado, 'pendiente');
    assert.equal(resumenRelevamientos(b).total, 0);
  }
});

test('aprobar un histórico sin hora solo para archivo cuenta en su serie, nunca crea un reporte público', async () => {
  const b = baseVacia();
  const r = cargar(b, { fechaHecho: '2026-10-15', horaHecho: null });
  assert.equal(await aprobar(b, r), null);
  assert.equal(r.estado, 'aprobado');
  assert.equal(r.destino, 'archivo');
  assert.equal(r.horaHecho, null);
  assert.equal(r.reporteId, null);
  assert.equal(b.reportes.length, 0);
  assert.equal(b.contador, 0);
  const s = resumenRelevamientos(b);
  assert.equal(s.total, 1);
  assert.equal(s.archivo, 1);
  assert.equal(s.mapa, 0);
  assert.equal(s.porMes['2026-10'], 1);
});

test('aprobar archivo sin fecha no fabrica un momento a partir del ID o de la publicación', async () => {
  const b = baseVacia();
  const r = cargar(b, { identificador: 'ALR-20261124-99', fechaHecho: null, horaHecho: null });
  assert.equal(await aprobar(b, r), null);
  assert.equal(r.fechaHecho, null);
  assert.equal(r.horaHecho, null);
  assert.equal(b.reportes.length, 0);
  assert.equal(resumenRelevamientos(b).sinFecha, 1);
  assert.deepEqual(resumenRelevamientos(b).porMes, {});
});

test('archivo tampoco permite aprobar una hora futura del día actual', async () => {
  const b = baseVacia();
  const r = cargar(b, { horaHecho: '15:01' });
  assert.equal(typeof await aprobar(b, r), 'string');
  assert.equal(r.estado, 'pendiente');
  assert.equal(resumenRelevamientos(b).total, 0);
});

test('una ficha pendiente no puede aprobarse al superar la conservación de un año', async () => {
  const b = baseVacia();
  const r = cargar(b);
  assert.equal(typeof await aprobar(b, r, 'archivo', {}, AHORA + 366 * 24 * H), 'string');
  assert.equal(r.estado, 'pendiente');
  assert.equal(r.aprobado, null);
  assert.equal(b.reportes.length, 0);
  assert.equal(resumenRelevamientos(b).total, 0);
});

test('la prosa original vence a los 30 días sin sobrevivir como resumen automático', () => {
  const b = baseVacia();
  const contenido = 'Texto sintético privado conservado únicamente para esta prueba.';
  assert.equal(importarRelevamientos(b, `1. ALR-TEST-001. Título sintético\n${contenido}`, AHORA), null);
  const r = b.relevamientos[0];
  assert.equal(r.resumen, '');
  assert.ok(r.textoOriginal.includes(contenido));
  aplicarConservacionRelevamientos(b, AHORA + 29 * 24 * H);
  assert.ok(r.textoOriginal.includes(contenido));
  aplicarConservacionRelevamientos(b, AHORA + 31 * 24 * H);
  assert.equal(r.textoOriginal, null);
  assert.equal(r.resumen, '');
  assert.equal(JSON.stringify(b).includes(contenido), false);
});

test('pendientes, descartados y vínculos no suman hechos; el principal aprobado suma una vez', async () => {
  const b = baseVacia();
  const principal = cargar(b);
  const duplicado = cargar(b, { identificador: 'ALR-TEST-002' });
  const descartado = cargar(b, { identificador: 'ALR-TEST-003' });
  cargar(b, { identificador: 'ALR-TEST-004' });
  assert.equal(resumenRelevamientos(b).total, 0);
  assert.ok(vistaRelevamientos(b, AHORA).fichas.find((r) => r.id === principal.id).posiblesDuplicados.some((r) => r.id === duplicado.id));
  assert.equal(await accion(b, { accion: 'relevamiento-vincular', id: duplicado.id, destinoId: principal.id }), null);
  assert.equal(await accion(b, { accion: 'relevamiento-descartar', id: descartado.id }), null);
  assert.equal(await aprobar(b, principal), null);
  assert.equal(duplicado.estado, 'vinculado');
  assert.equal(duplicado.vinculadoA, principal.id);
  assert.equal(resumenRelevamientos(b).total, 1);
  assert.equal(b.reportes.length, 0);
});

test('no se puede vincular una ficha consigo misma ni aprobar un duplicado vinculado', async () => {
  const b = baseVacia();
  const r = cargar(b);
  const otra = cargar(b, { identificador: 'ALR-TEST-002' });
  assert.equal(typeof await accion(b, { accion: 'relevamiento-vincular', id: r.id, destinoId: r.id }), 'string');
  assert.equal(await accion(b, { accion: 'relevamiento-vincular', id: r.id, destinoId: otra.id }), null);
  assert.equal(typeof await aprobar(b, r), 'string');
  assert.equal(resumenRelevamientos(b).total, 0);
});

test('mapa exige fecha de hoy, hora no futura y punto revisado: importar un punto no lo autoriza', async () => {
  for (const extra of [
    { fechaHecho: null }, { fechaHecho: '2026-11-23' }, { horaHecho: null }, { horaHecho: '15:01' },
  ]) {
    const b = baseVacia();
    const r = await prepararMapa(b, extra);
    assert.equal(typeof await aprobar(b, r, 'mapa'), 'string', JSON.stringify(extra));
    assert.equal(r.estado, 'pendiente');
    assert.equal(b.reportes.length, 0);
  }
  const b = baseVacia();
  const r = cargar(b, { punto: CENTRO, riesgo: 'no' });
  assert.equal(r.punto, null);
  assert.equal(typeof await aprobar(b, r, 'mapa'), 'string');
  assert.equal(b.reportes.length, 0);
});

test('editar no acepta puntos fuera del territorio, coordenadas no finitas ni estados inyectados', async () => {
  const b = baseVacia();
  const r = cargar(b);
  for (const punto of [{ lon: -58.4, lat: -34.6 }, { lon: NaN, lat: CENTRO.lat }, { lon: CENTRO.lon, lat: Infinity }]) {
    assert.equal(typeof await accion(b, { accion: 'relevamiento-editar', id: r.id, campos: { punto } }), 'string');
    assert.equal(r.punto, null);
  }
  assert.equal(await accion(b, { accion: 'relevamiento-editar', id: r.id, campos: {
    estado: 'aprobado', aprobado: 1, reporteId: 'inexistente', origen: 'ciudadano', punto: CENTRO,
  } }), null);
  assert.equal(r.estado, 'pendiente');
  assert.equal(r.aprobado, null);
  assert.equal(r.reporteId, null);
  assert.equal(r.origen, 'relevamiento-valomi');
});

test('mapa usa día argentino al aprobar, incluso antes y después de medianoche UTC', async () => {
  const antesMedianocheAR = Date.parse('2026-11-25T02:30:00Z');
  const b = baseVacia();
  const r = await prepararMapa(b, { horaHecho: '23:00' }, antesMedianocheAR);
  assert.equal(await aprobar(b, r, 'mapa', {}, antesMedianocheAR), null);
  assert.equal(b.reportes[0].momento, Date.parse('2026-11-25T02:00:00Z'));
  const otraBase = baseVacia();
  const viejo = await prepararMapa(otraBase, { horaHecho: '23:00' }, antesMedianocheAR);
  assert.equal(typeof await aprobar(otraBase, viejo, 'mapa', {}, Date.parse('2026-11-25T03:01:00Z')), 'string');
  assert.equal(otraBase.reportes.length, 0);
});

test('aprobar mapa crea un único canonical revisado con origen separado, nunca corroborado', async () => {
  const b = baseVacia();
  const r = await prepararMapa(b);
  assert.equal(await aprobar(b, r, 'mapa'), null);
  const canonical = b.reportes[0];
  assert.equal(canonical.origen, 'relevamiento-valomi');
  assert.equal(canonical.relevamientoId, r.id);
  assert.equal(r.reporteId, canonical.id);
  assert.equal(canonical.estadoPublico, 'revisado');
  assert.equal(canonical.confirmacion, null);
  assert.equal(canonical.momento, Date.parse('2026-11-24T17:00:00Z'));
  const numero = canonical.numero;
  await aprobar(b, r, 'mapa', {}, AHORA + H);
  assert.equal(b.reportes.length, 1);
  assert.equal(b.contador, 1);
  assert.equal(b.reportes[0].numero, numero);
  assert.equal(resumenRelevamientos(b).total, 1);
  const publico = aPublico(canonical);
  assert.equal(publico.origen, 'relevamiento-valomi');
  assert.notDeepEqual(publico.zona, CENTRO);
  assert.equal(Object.hasOwn(publico, 'textoOriginal'), false);
});

test('el mapa vence exactamente a las 48 horas del hecho, sin renovar por hora de aprobación', async () => {
  const b = baseVacia();
  const r = await prepararMapa(b);
  assert.equal(await aprobar(b, r, 'mapa'), null);
  const canonical = b.reportes[0];
  assert.equal(esVisible(canonical, canonical.momento + 48 * H - 1), true);
  assert.equal(esVisible(canonical, canonical.momento + 48 * H), false);
  assert.equal(esVisible(canonical, canonical.momento + 48 * H + 1), false);
  assert.equal(esVisible(canonical, canonical.momento - 1), false);
  assert.equal(resumenRelevamientos(b).total, 1, 'Vencer en el mapa no elimina un hecho aprobado de su serie.');
});

test('las series se mantienen separadas y el ingreso ciudadano anterior sigue público', async () => {
  const b = baseVacia();
  const previo = ciudadano(b);
  const r = await prepararMapa(b);
  assert.equal(await aprobar(b, r, 'mapa'), null);
  const archivado = cargar(b, { identificador: 'ALR-TEST-002', horaHecho: null });
  assert.equal(await aprobar(b, archivado), null);
  const ciudadanos = calcularMes(b, '2026-11');
  const valomi = resumenRelevamientos(b);
  assert.equal(ciudadanos.total, 1);
  assert.equal(ciudadanos.porEstado['sin-verificar'], 1);
  assert.equal(ciudadanos.porEstado.revisado, 0);
  assert.equal(valomi.total, 2);
  assert.equal(valomi.mapa, 1);
  assert.equal(valomi.archivo, 1);
  assert.equal(b.reportes.find((p) => p.id === previo.id).origen, undefined);
  assert.equal(esVisible(previo, AHORA), true);
});

test('los agregados no convierten localidad libre con datos privados, URL o IDs en claves exportables', async () => {
  const prototipoOriginal = Object.getOwnPropertyDescriptors(Object.prototype);
  for (const localidad of [
    'Dato sintético: teléfono 11 5555 1234',
    'https://example.org/texto-privado-de-prueba',
    'ALR-TEST-PRIVADO', 'javascript:alert(1)', '__proto__', 'constructor',
  ]) {
    const b = baseVacia();
    const r = cargar(b, { localidad });
    assert.equal(await aprobar(b, r), null);
    const resumen = resumenRelevamientos(b);
    assert.deepEqual(resumen.porZona, { sinZona: 1 });
    assert.equal(JSON.stringify(resumen).includes(localidad), false);
    assert.equal(r.localidad, localidad, 'El campo privado no se presenta como nombre público de un grupo.');
    assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), prototipoOriginal);
  }
});

test('las seis etiquetas del agregado normalizan tildes y espacios sin ampliar la zona del mapa', async () => {
  for (const [localidad, esperada] of [
    ['  LOMAS   DEL MIRADOR ', 'Lomas del Mirador'],
    ['lomas del millon', 'Lomas del Millón'],
    ['SAN JUSTO', 'San Justo'], ['ramos mejia', 'Ramos Mejía'],
    ['gonzalez catan', 'González Catán'], ['villa luzuriaga', 'Villa Luzuriaga'],
  ]) {
    const b = baseVacia();
    const r = cargar(b, { localidad, horaHecho: null });
    assert.equal(await aprobar(b, r), null);
    assert.deepEqual(resumenRelevamientos(b).porZona, { [esperada]: 1 });
    assert.equal(r.punto, null);
    assert.equal(b.reportes.length, 0);
  }
});

test('retirar una ficha aprobada quita su canonical y conteo sin afectar ciudadanos', async () => {
  const b = baseVacia();
  const previo = ciudadano(b);
  const r = await prepararMapa(b);
  assert.equal(await aprobar(b, r, 'mapa'), null);
  assert.equal(await accion(b, { accion: 'relevamiento-retirar', id: r.id }), null);
  assert.equal(r.estado, 'retirado');
  assert.equal(b.reportes.length, 1);
  assert.equal(b.reportes[0].id, previo.id);
  assert.equal(resumenRelevamientos(b).total, 0);
});

test('retirar el canonical por moderación anterior también retira la ficha y sus agregados', async () => {
  const b = baseVacia();
  const r = await prepararMapa(b);
  assert.equal(await aprobar(b, r, 'mapa'), null);
  assert.equal(await accion(b, { accion: 'retirar', id: r.reporteId, motivo: 'Prueba sintética de retiro' }), null);
  assert.equal(r.estado, 'retirado');
  assert.equal(b.reportes.length, 0);
  assert.equal(resumenRelevamientos(b).total, 0);
});

test('retirar archivo elimina su conteo y nunca toca el mapa ciudadano', async () => {
  const b = baseVacia();
  const previo = ciudadano(b);
  const r = cargar(b);
  assert.equal(await aprobar(b, r), null);
  assert.equal(await accion(b, { accion: 'relevamiento-retirar', id: r.id }), null);
  assert.equal(resumenRelevamientos(b).total, 0);
  assert.equal(b.reportes[0].id, previo.id);
});

test('una base antigua sin relevamientos sigue siendo compatible y no cambia sus reportes', () => {
  const b = baseVacia();
  const previo = ciudadano(b);
  assert.equal(Object.hasOwn(b, 'relevamientos'), false);
  assert.equal(vistaRelevamientos(b, AHORA).fichas.length, 0);
  assert.equal(resumenRelevamientos(b).total, 0);
  assert.equal(vistaModeracion(b, AHORA).relevamientos.resumen.total, 0);
  aplicarConservacionRelevamientos(b, AHORA);
  assert.equal(b.reportes[0], previo);
  assert.equal(esVisible(previo, AHORA), true);
});

test('la aprobación bloquea datos personales sintéticos en el resumen público', async () => {
  const b = baseVacia();
  const r = await prepararMapa(b, { resumen: 'Caso inventado para pruebas: llamar al teléfono 11 5555 1234.' });
  assert.equal(typeof await aprobar(b, r, 'mapa'), 'string');
  assert.equal(r.estado, 'pendiente');
  assert.equal(b.reportes.length, 0);
});

test('la API de acción directa mantiene la misma barrera de aprobación que moderación', async () => {
  const b = baseVacia();
  const r = cargar(b, { fuentes: [] });
  assert.equal(typeof await accionRelevamiento(b, {
    accion: 'relevamiento-aprobar', id: r.id, destino: 'archivo', fuentesRevisadas: true, duplicadosRevisados: true,
  }, AHORA, noBorrar), 'string');
  assert.equal(resumenRelevamientos(b).total, 0);
});
