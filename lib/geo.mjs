// Geometría del territorio: lo usan el servidor, el formulario y el script del mapa.
// Proyección local en metros (equirectangular centrada en Lomas del Mirador): alcanza para distancias de pocos km.

const LAT0 = -34.665;
const M_POR_GRADO_LAT = 110_540;
const M_POR_GRADO_LON = 111_320 * Math.cos((LAT0 * Math.PI) / 180);

/** Origen fijo de la grilla (esquina suroeste de la zona del mapa). No cambiarlo: movería todas las celdas. */
const ORIGEN = { lon: -58.5545, lat: -34.6835 };

export const TOLERANCIA_M = 30;
export const LADO_CELDA_M = 200;

const aMetros = (lon, lat) => [(lon - ORIGEN.lon) * M_POR_GRADO_LON, (lat - ORIGEN.lat) * M_POR_GRADO_LAT];

/** anillo: [[lon, lat], ...] cerrado. */
export function puntoEnPoligono(lon, lat, anillo) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Distancia en metros desde el punto hasta el borde del polígono. */
export function distanciaAlBorde(lon, lat, anillo) {
  const [px, py] = aMetros(lon, lat);
  let min = Infinity;
  for (let i = 0; i < anillo.length - 1; i++) {
    const [ax, ay] = aMetros(...anillo[i]);
    const [bx, by] = aMetros(...anillo[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
    min = Math.min(min, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return min;
}

/** Dentro de la zona del mapa (Lomas del Mirador, Lomas del Millón, San Justo y Ramos Mejía) o a 30 m como máximo por fuera del borde (aprobado por Gabriel; recuadro de la zona desde el 3/11/2026). */
export function dentroDelTerritorio(lon, lat, anillo, tolerancia = TOLERANCIA_M) {
  return puntoEnPoligono(lon, lat, anillo) || distanciaAlBorde(lon, lat, anillo) <= tolerancia;
}

/**
 * Zona aproximada: celda fija de 200 m. Devuelve el centro de la celda, nunca el punto exacto.
 * Se calcula solo en el servidor, antes de publicar.
 */
export function celda(lon, lat) {
  const [x, y] = aMetros(lon, lat);
  const i = Math.floor(x / LADO_CELDA_M);
  const j = Math.floor(y / LADO_CELDA_M);
  return {
    id: `${i}:${j}`,
    lon: Math.round((ORIGEN.lon + ((i + 0.5) * LADO_CELDA_M) / M_POR_GRADO_LON) * 1e6) / 1e6,
    lat: Math.round((ORIGEN.lat + ((j + 0.5) * LADO_CELDA_M) / M_POR_GRADO_LAT) * 1e6) / 1e6,
  };
}
