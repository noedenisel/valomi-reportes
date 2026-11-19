'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapaML } from 'maplibre-gl';
import { MapaBase } from './MapaBase';
import { Icono } from './Iconos';
import { dentroDelTerritorio } from '@/lib/geo.mjs';
import LIMITE from '@/lib/limite-datos.json';
import { normalizar } from '@/lib/formato';

type Esquina = { a: string; b: string; lon: number; lat: number };
export type Punto = { lon: number; lat: number };

const anillo = LIMITE as [number, number][];
export const puntoValido = (p: Punto | null) => Boolean(p && dentroDelTerritorio(p.lon, p.lat, anillo));

/**
 * El punto se fija moviendo el mapa bajo un pin central. La ubicación del teléfono se pide solo al tocar el botón.
 * La esquina se busca en la lista de cruces del barrio (datos propios, sin servicios externos).
 */
export function UbicacionPaso({ punto, alCambiar, error }: { punto: Punto | null; alCambiar: (p: Punto) => void; error: string | null }) {
  const mapa = useRef<MapaML | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [texto, setTexto] = useState('');
  const [esquinas, setEsquinas] = useState<Esquina[]>([]);
  const alCambiarRef = useRef(alCambiar);
  alCambiarRef.current = alCambiar;
  const puntoRef = useRef(punto);
  puntoRef.current = punto;

  useEffect(() => {
    fetch('/mapa/esquinas.json').then((r) => r.json()).then(setEsquinas).catch(() => undefined);
  }, []);

  const sugerencias = useMemo(() => {
    const partes = normalizar(texto).split(/\s+y\s+|,/).map((x) => x.trim()).filter(Boolean);
    if (!partes.length || texto.length < 3) return [];
    return esquinas
      .filter((e) => partes.every((p) => normalizar(e.a).includes(p) || normalizar(e.b).includes(p)))
      .slice(0, 6);
  }, [texto, esquinas]);

  const elegido = useRef(Boolean(punto));
  // La esquina o el GPS fijan el punto directamente, aunque el mapa todavía no haya terminado de cargar.
  const irA = (p: Punto) => {
    elegido.current = true;
    alCambiarRef.current(p);
    mapa.current?.jumpTo({ center: [p.lon, p.lat], zoom: 17 });
  };

  return (
    <>
      <div className="mapa-mini">
        <MapaBase
          etiquetas={false}
          etiquetaAccesible="Mapa para marcar dónde pasó. Mové el mapa hasta que el pin quede en el lugar."
          alListo={(m) => {
            mapa.current = m;
            if (puntoRef.current) m.jumpTo({ center: [puntoRef.current.lon, puntoRef.current.lat], zoom: 17 });
            // El punto se toma solo cuando la persona mueve el mapa, elige una esquina o usa su ubicación:
            // el centro inicial no cuenta como respuesta.
            m.on('dragstart', () => (elegido.current = true));
            m.on('moveend', () => {
              if (!elegido.current) return;
              const c = m.getCenter();
              alCambiarRef.current({ lon: c.lng, lat: c.lat });
            });
          }}
        />
        <svg className="pin" viewBox="0 0 22 30" aria-hidden="true">
          <path d="M11 29s9-9.6 9-17A9 9 0 0 0 2 12c0 7.4 9 17 9 17z" fill="#1b1e22" />
          <circle cx="11" cy="11.5" r="3.4" fill="#fff" />
        </svg>
      </div>
      <p className="ayuda">Mové el mapa para que el pin quede donde pasó.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <button
        type="button"
        className="boton boton--secundario"
        disabled={buscando}
        onClick={() => {
          setAviso(null);
          if (!('geolocation' in navigator)) {
            setAviso('Este teléfono no permite usar la ubicación. Marcá el punto en el mapa o escribí una esquina.');
            return;
          }
          setBuscando(true);
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setBuscando(false);
              const p = { lon: pos.coords.longitude, lat: pos.coords.latitude };
              irA(p);
              setAviso(puntoValido(p) ? 'Revisá que el pin esté en el lugar correcto.' : null);
            },
            (e) => {
              setBuscando(false);
              setAviso(
                e.code === e.PERMISSION_DENIED
                  ? 'No se pudo usar tu ubicación porque no diste permiso. Podés marcar el punto en el mapa o escribir una esquina.'
                  : 'No se pudo obtener tu ubicación. Podés marcar el punto en el mapa o escribir una esquina.'
              );
            },
            { enableHighAccuracy: true, timeout: 15_000 }
          );
        }}
      >
        <Icono nombre="mira" /> {buscando ? 'Buscando tu ubicación…' : 'Usar mi ubicación'}
      </button>
      {aviso && <p className="caja caja--gris" role="status">{aviso}</p>}
      <div className="campo">
        <label htmlFor="esquina">O escribí una esquina</label>
        <input
          id="esquina"
          className="entrada"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Por ejemplo: Calle A y Calle B"
          autoComplete="off"
        />
        {texto.length >= 3 && (
          sugerencias.length ? (
            <ul className="lista-reportes" aria-label="Esquinas encontradas">
              {sugerencias.map((e) => (
                <li key={`${e.a}|${e.b}`}>
                  <button type="button" onClick={() => { irA(e); setTexto(`${e.a} y ${e.b}`); }}>
                    {e.a} y {e.b}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ayuda">Esa esquina no aparece en la zona del mapa. Probá marcarla en el mapa.</p>
          )
        )}
      </div>
    </>
  );
}
