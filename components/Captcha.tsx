'use client';

import { useEffect, useRef, useState } from 'react';

// Sin clave (desarrollo y demo) no se muestra nada.
export const CLAVE_CAPTCHA = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

type Turnstile = {
  render: (lugar: HTMLElement, opciones: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window { turnstile?: Turnstile }
}

let carga: Promise<void> | null = null;
function cargarCaptcha() {
  carga ??= new Promise<void>((resolver, rechazar) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolver();
    s.onerror = () => {
      carga = null;
      rechazar(new Error());
    };
    document.head.appendChild(s);
  });
  return carga;
}

/** Normalmente no se ve: solo pide un toque si Cloudflare tiene dudas. Cambiar `reinicio` pide un captcha nuevo. */
export function Captcha({ alCambiar, reinicio }: { alCambiar: (token: string) => void; reinicio: number }) {
  const lugar = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const aviso = useRef(alCambiar);
  aviso.current = alCambiar;
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    if (!CLAVE_CAPTCHA) return;
    let vigente = true;
    cargarCaptcha()
      .then(() => {
        if (!vigente || !lugar.current || !window.turnstile) return;
        id.current = window.turnstile.render(lugar.current, {
          sitekey: CLAVE_CAPTCHA,
          language: 'es',
          appearance: 'interaction-only',
          callback: (token: string) => {
            setFallo(false);
            aviso.current(token);
          },
          'expired-callback': () => aviso.current(''),
          'error-callback': () => {
            aviso.current('');
            setFallo(true);
          },
        });
      })
      .catch(() => setFallo(true));
    return () => {
      vigente = false;
      if (id.current) window.turnstile?.remove(id.current);
      id.current = null;
    };
  }, []);

  useEffect(() => {
    if (reinicio && id.current) window.turnstile?.reset(id.current);
  }, [reinicio]);

  if (!CLAVE_CAPTCHA) return null;
  return (
    <>
      <div ref={lugar} />
      {fallo && <p className="error" role="alert">No se pudo cargar la verificación contra robots. Revisá la conexión y volvé a abrir esta pantalla.</p>}
    </>
  );
}
