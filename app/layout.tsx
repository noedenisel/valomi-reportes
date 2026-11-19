import type { Metadata, Viewport } from 'next';
import { Archivo, Public_Sans } from 'next/font/google';
import { Aviso911, Encabezado, NavInferior } from '@/components/Estructura';
import { RegistrarServicio } from '@/components/RegistrarServicio';
import { ModoDemo } from '@/components/ModoDemo';
import { DEMO_NAVEGADOR } from '@/lib/modo';
import './globals.css';

const titulo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--fuente-titulo', display: 'swap' });
const texto = Public_Sans({ subsets: ['latin'], variable: '--fuente-texto', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'VaLoMi · Reportes vecinales', template: '%s · VaLoMi' },
  description:
    'Reportá lo que viste o te pasó en Lomas del Mirador, Lomas del Millón, San Justo y Ramos Mejía y mirá el mapa de seguridad. Sin cuenta y sin dar tu nombre. Ante una emergencia, llamá al 911.',
  applicationName: 'VaLoMi',
  appleWebApp: { capable: true, title: 'VaLoMi', statusBarStyle: 'default' },
  icons: { icon: '/icono.svg', apple: '/icono-180.png' },
  // Copia de prueba: no se indexa hasta la publicación definitiva.
  robots: process.env.VALOMI_ENTORNO === 'produccion' ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#c8102e', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function Raiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${titulo.variable} ${texto.variable}`}>
      <body>
        <Aviso911 />
        {(process.env.NODE_ENV !== 'production' || DEMO_NAVEGADOR) && (
          <p className="aviso-demo" role="note">
            {DEMO_NAVEGADOR
              ? 'Demo · datos ficticios, solo en este navegador'
              : 'Demostración local · todos los reportes son ficticios'}
          </p>
        )}
        <ModoDemo />
        <Encabezado />
        <main id="contenido">{children}</main>
        <NavInferior />
        <RegistrarServicio />
      </body>
    </html>
  );
}
