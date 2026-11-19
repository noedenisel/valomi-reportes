'use client';

import { useEffect } from 'react';

/** Registra el service worker: hace instalable la app y guarda la interfaz y el mapa base para verlos sin conexión, sin guardar reportes ni adjuntos. */
export function RegistrarServicio() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}
