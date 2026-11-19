import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VaLoMi · Reportes vecinales',
    short_name: 'VaLoMi',
    description: 'Reportes ciudadanos y mapa de seguridad de Lomas del Mirador, Lomas del Millón, San Justo y Ramos Mejía. Ante una emergencia, llamá al 911.',
    lang: 'es-AR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#c8102e',
    icons: [
      { src: '/icono.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
