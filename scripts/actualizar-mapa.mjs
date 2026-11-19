// Arma los datos propios del mapa a partir de OpenStreetMap (© colaboradores de OpenStreetMap, ODbL).
// - public/mapa/limite.geojson: zona del mapa. Desde el 3/11/2026 es un recuadro que cubre Lomas del Mirador, Lomas del
//   Millón, San Justo y Ramos Mejía (decidido por Gabriel). Antes era el límite de Lomas del Mirador (relación 1714693).
// - public/mapa/calles.geojson: calles de la zona, para dibujar el mapa base.
// - public/mapa/esquinas.json: cruces de calles dentro del barrio (y hasta 30 m afuera), para la búsqueda de esquinas.
// - lib/limite-datos.json: el mismo límite, para validar en el servidor.
// Se corre a mano cuando cambian las calles: npm run mapa
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(import.meta.dirname, '..');
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const BORDE = { sur: -34.715, oeste: -58.59, norte: -34.634, este: -58.512 };
const CAJA = `${BORDE.sur},${BORDE.oeste},${BORDE.norte},${BORDE.este}`; // sur, oeste, norte, este

async function consultar(q) {
  const r = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'valomi-reportes/0.1' },
    body: new URLSearchParams({ data: q }),
  });
  if (!r.ok) throw new Error(`Overpass respondió ${r.status}`);
  return (await r.json()).elements;
}

// Une los tramos externos de la relación en un anillo cerrado.
function anillo(relacion) {
  const tramos = relacion.members.filter((m) => m.role === 'outer').map((m) => m.geometry.map((p) => [p.lon, p.lat]));
  const igual = (a, b) => a[0] === b[0] && a[1] === b[1];
  const r = tramos.shift();
  while (tramos.length) {
    const fin = r[r.length - 1];
    const i = tramos.findIndex((t) => igual(t[0], fin) || igual(t[t.length - 1], fin));
    if (i < 0) throw new Error('El límite no cierra');
    const [t] = tramos.splice(i, 1);
    r.push(...(igual(t[0], fin) ? t : t.reverse()).slice(1));
  }
  return r;
}

const limite = [[BORDE.oeste, BORDE.sur], [BORDE.este, BORDE.sur], [BORDE.este, BORDE.norte], [BORDE.oeste, BORDE.norte], [BORDE.oeste, BORDE.sur]];
const ways = await consultar(
  `[out:json][timeout:90];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street)$"](${CAJA});out tags geom;`
);

const redondear = (n) => Math.round(n * 1e6) / 1e6;
const CLASE = { motorway: 'avenida', trunk: 'avenida', primary: 'avenida', secondary: 'avenida', tertiary: 'principal' };
const calles = {
  type: 'FeatureCollection',
  features: ways.map((w) => ({
    type: 'Feature',
    properties: { nombre: w.tags.name ?? '', clase: CLASE[w.tags.highway] ?? 'calle' },
    geometry: { type: 'LineString', coordinates: w.geometry.map((p) => [redondear(p.lon), redondear(p.lat)]) },
  })),
};

// Esquinas: puntos compartidos por calles con nombres distintos.
const porPunto = new Map();
for (const w of ways) {
  const nombre = w.tags.name;
  if (!nombre) continue;
  for (const p of w.geometry) {
    const clave = `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`;
    if (!porPunto.has(clave)) porPunto.set(clave, new Set());
    porPunto.get(clave).add(nombre);
  }
}
const { dentroDelTerritorio } = await import('../lib/geo.mjs');
const vistas = new Set();
const esquinas = [];
for (const [clave, nombres] of porPunto) {
  if (nombres.size < 2) continue;
  const [lon, lat] = clave.split(',').map(Number);
  if (!dentroDelTerritorio(lon, lat, limite)) continue;
  const lista = [...nombres].sort();
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const id = `${lista[i]}|${lista[j]}`;
      if (vistas.has(id)) continue;
      vistas.add(id);
      esquinas.push({ a: lista[i], b: lista[j], lon: redondear(lon), lat: redondear(lat) });
    }
  }
}

const geoLimite = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {
      nombre: 'Lomas del Mirador, Lomas del Millón, San Justo y Ramos Mejía',
      fuente: 'Recuadro que cubre las cuatro zonas; calles de OpenStreetMap',
      decidido: 'Gabriel Lombardo, 3/11/2026',
    },
    geometry: { type: 'Polygon', coordinates: [limite.map(([x, y]) => [redondear(x), redondear(y)])] },
  }],
};

writeFileSync(join(raiz, 'public/mapa/limite.geojson'), JSON.stringify(geoLimite));
writeFileSync(join(raiz, 'public/mapa/calles.geojson'), JSON.stringify(calles));
writeFileSync(join(raiz, 'public/mapa/esquinas.json'), JSON.stringify(esquinas));
writeFileSync(join(raiz, 'lib/limite-datos.json'), JSON.stringify(geoLimite.features[0].geometry.coordinates[0]));
console.log(`Límite: ${limite.length} vértices · calles: ${calles.features.length} · esquinas: ${esquinas.length}`);
