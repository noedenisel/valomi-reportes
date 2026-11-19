'use client';

import { useEffect, useState } from 'react';
import { Icono } from './Iconos';

type EventoInstalar = Event & { prompt: () => Promise<void> };

/** «Instalar»: usa el diálogo del navegador; en iPhone explica cómo agregarla al inicio. Desaparece si ya está instalada. */
export function BotonInstalar() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [esIphone, setEsIphone] = useState(false);
  const [instalada, setInstalada] = useState(true);
  const [ayuda, setAyuda] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
    setInstalada(Boolean(standalone));
    setEsIphone(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const alPedir = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
    };
    const alInstalar = () => setInstalada(true);
    window.addEventListener('beforeinstallprompt', alPedir);
    window.addEventListener('appinstalled', alInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', alPedir);
      window.removeEventListener('appinstalled', alInstalar);
    };
  }, []);

  if (instalada || (!evento && !esIphone)) return null;

  return (
    <>
      <button
        type="button"
        className="boton boton--texto boton--chico"
        onClick={async () => {
          if (evento) {
            await evento.prompt();
            setEvento(null);
          } else setAyuda(true);
        }}
      >
        <Icono nombre="instalar" /> Instalar
      </button>
      {ayuda && (
        <div className="dialogo-fondo" role="dialog" aria-modal="true" aria-labelledby="instalar-titulo">
          <div className="dialogo">
            <h2 id="instalar-titulo">Instalar en el iPhone</h2>
            <p>Tocá el botón «Compartir» de Safari y después «Agregar a inicio».</p>
            <button type="button" autoFocus className="boton boton--primario" onClick={() => setAyuda(false)}>Entendido</button>
          </div>
        </div>
      )}
    </>
  );
}
