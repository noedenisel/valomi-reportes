'use client';

import { useEffect, useRef } from 'react';
import type { Map as MapaML, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Mapa propio: calles y límite salen de /public/mapa (datos de OpenStreetMap). Ningún servicio externo recibe
// la ubicación ni las búsquedas. Sin servidor de tipografías, los nombres de las avenidas se dibujan como etiquetas HTML.

// Margen amplio alrededor de la zona: si es muy justo, en pantallas angostas el mapa no puede alejarse lo suficiente.
export const LIMITES_MAPA: [[number, number], [number, number]] = [[-58.61, -34.735], [-58.49, -34.615]];
export const ENCUADRE_BARRIO: [[number, number], [number, number]] = [[-58.59, -34.715], [-58.512, -34.634]];

const ESTILO: StyleSpecification = {
  version: 8,
  sources: {
    calles: { type: 'geojson', data: '/mapa/calles.geojson' },
    limite: { type: 'geojson', data: '/mapa/limite.geojson' },
  },
  layers: [
    { id: 'fondo', type: 'background', paint: { 'background-color': '#eceef0' } },
    { id: 'barrio', type: 'fill', source: 'limite', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.7 } },
    {
      id: 'calles', type: 'line', source: 'calles', filter: ['==', ['get', 'clase'], 'calle'],
      paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1, 17, 7] },
    },
    {
      id: 'calles-borde', type: 'line', source: 'calles', filter: ['==', ['get', 'clase'], 'calle'],
      paint: { 'line-color': '#d4d8dd', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.4, 17, 1] },
    },
    {
      id: 'principales', type: 'line', source: 'calles', filter: ['==', ['get', 'clase'], 'principal'],
      paint: { 'line-color': '#c2c7cd', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1.6, 17, 9] },
    },
    {
      id: 'avenidas', type: 'line', source: 'calles', filter: ['==', ['get', 'clase'], 'avenida'],
      paint: { 'line-color': '#9aa1a9', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2.4, 17, 12] },
    },
    {
      id: 'limite-linea', type: 'line', source: 'limite',
      paint: { 'line-color': '#c8102e', 'line-width': 2.5, 'line-dasharray': [3, 2] },
    },
  ],
};

type Props = {
  className?: string;
  alListo?: (mapa: MapaML, ml: typeof import('maplibre-gl')) => void;
  etiquetas?: boolean;
  etiquetaAccesible: string;
};

export function MapaBase({ className = 'mapa-lienzo', alListo, etiquetas = true, etiquetaAccesible }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const listo = useRef(alListo);
  listo.current = alListo;

  useEffect(() => {
    let mapa: MapaML | null = null;
    let cancelado = false;
    (async () => {
      const ml = await import('maplibre-gl');
      if (cancelado || !ref.current) return;
      mapa = new ml.Map({
        container: ref.current,
        style: ESTILO,
        bounds: ENCUADRE_BARRIO,
        fitBoundsOptions: { padding: 16 },
        maxBounds: LIMITES_MAPA,
        minZoom: 12.5,
        maxZoom: 18,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });
      mapa.touchZoomRotate.disableRotation();
      mapa.on('load', async () => {
        if (!mapa) return;
        if (etiquetas) await ponerEtiquetas(mapa, ml);
        listo.current?.(mapa, ml);
      });
    })();
    return () => {
      cancelado = true;
      mapa?.remove();
    };
  }, [etiquetas]);

  return (
    <>
      <div ref={ref} className={className} role="region" aria-label={etiquetaAccesible} />
      <span className="atribucion">© colaboradores de OpenStreetMap</span>
    </>
  );
}

/** Nombres de avenidas y calles principales: una etiqueta por nombre, en el medio de su tramo más largo. */
async function ponerEtiquetas(mapa: MapaML, ml: typeof import('maplibre-gl')) {
  const datos = await fetch('/mapa/calles.geojson').then((r) => r.json());
  const mejor = new Map<string, number[][]>();
  for (const f of datos.features) {
    const { nombre, clase } = f.properties;
    if (!nombre || clase === 'calle') continue;
    const c = f.geometry.coordinates as number[][];
    if ((mejor.get(nombre)?.length ?? 0) < c.length) mejor.set(nombre, c);
  }
  const marcadores: import('maplibre-gl').Marker[] = [];
  for (const [nombre, c] of mejor) {
    const el = document.createElement('span');
    el.className = 'etiqueta-calle';
    el.textContent = nombre.replace(/^Avenida /, 'Av. ');
    el.setAttribute('aria-hidden', 'true');
    marcadores.push(new ml.Marker({ element: el }).setLngLat(c[Math.floor(c.length / 2)] as [number, number]).addTo(mapa));
  }
  const ajustar = () => marcadores.forEach((m) => (m.getElement().style.display = mapa.getZoom() >= 14.5 ? '' : 'none'));
  mapa.on('zoomend', ajustar);
  ajustar();
}
