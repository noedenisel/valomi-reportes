import type { NextConfig } from 'next';

// Solo en producción: el modo de desarrollo de Next necesita evaluar código.
const POLITICA_CONTENIDO = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const config: NextConfig = {
  // El Preview del proyecto de demostración también usa datos locales del navegador.
  // Compilar este valor mantiene alineados el servidor y el cliente.
  ...(process.env.VERCEL_ENV === 'preview'
    && process.env.VERCEL_PROJECT_ID === 'prj_wMEsSpWxE9yZ2skvXAIBifpU8Goz'
    ? { env: { NEXT_PUBLIC_VALOMI_DEMO: 'navegador' } }
    : {}),
  // Permite compilar en otra carpeta sin pisar la del servidor de desarrollo (NEXT_DIST_DIR=.next-prueba).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // La ubicación solo se pide desde esta app; cámara y micrófono no se usan (los archivos se eligen con el selector).
          { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=()' },
          ...(process.env.NODE_ENV === 'production' ? [{ key: 'Content-Security-Policy', value: POLITICA_CONTENIDO }] : []),
        ],
      },
      { source: '/api/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
      ...['/moderacion', '/entrar/:path*', '/api/moderacion/:path*', '/api/observatorio', '/api/sesion/:path*'].map((source) => ({
        source,
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      })),
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};

export default config;
