'use client';

// Solo en la demostración: se carga aparte para que la versión real no incluya la demo en lo que descarga el teléfono.
// Mientras carga, los pedidos esperan: ninguna pantalla llega al servidor antes de que la demo esté instalada.
if (process.env.NEXT_PUBLIC_VALOMI_DEMO === 'navegador' && typeof window !== 'undefined') {
  const original = window.fetch;
  const lista = import('@/lib/demo-navegador').then((m) => {
    window.fetch = original;
    m.instalarDemoNavegador();
  });
  window.fetch = (...args) => lista.then(() => window.fetch(...args));
}

export function ModoDemo() {
  return null;
}
