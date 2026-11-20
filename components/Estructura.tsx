'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icono, Triangulo } from './Iconos';
import { BotonInstalar } from './Instalar';

const SECCIONES = [
  { href: '/', texto: 'Inicio', icono: 'inicio' },
  { href: '/mapa', texto: 'Mapa', icono: 'mapa' },
  { href: '/reportar', texto: 'Reportar', icono: 'reportar' },
  { href: '/mas', texto: 'Más', icono: 'mas' },
];

/** Aviso permanente: no se puede cerrar y está en todas las pantallas. */
export function Aviso911() {
  return (
    <div className="aviso911" role="note">
      <span>¿Es una emergencia? Llamá al 911</span>
      <a href="tel:911" aria-label="Llamar al 911">Llamar</a>
    </div>
  );
}

export function Encabezado() {
  const ruta = usePathname();
  return (
    <header className="encabezado">
      <div className="encabezado__interior">
        <Link href="/" className="marca" aria-label="Gabriel Lombardo – VaLoMi, inicio">
          <Triangulo />
          <span>Gabriel Lombardo<small>VaLoMi</small></span>
        </Link>
        <div className="encabezado__acciones">
          <nav className="nav-superior" aria-label="Principal">
            {SECCIONES.map((s) => s.href === '/reportar' ? (
              <a key={s.href} href={s.href} aria-current={activa(ruta, s.href) ? 'page' : undefined}>{s.texto}</a>
            ) : (
              <Link key={s.href} href={s.href} aria-current={activa(ruta, s.href) ? 'page' : undefined}>{s.texto}</Link>
            ))}
          </nav>
          <BotonInstalar />
        </div>
      </div>
    </header>
  );
}

export function NavInferior() {
  const ruta = usePathname();
  if (ruta.startsWith('/moderacion')) return null;
  return (
    <nav className="nav-inferior" aria-label="Principal">
      {SECCIONES.map((s) =>
        s.href === '/reportar' ? (
          <a key={s.href} href={s.href} className="reportar" aria-current={activa(ruta, s.href) ? 'page' : undefined}>
            <span className="circulo"><Icono nombre="reportar" /></span>
            {s.texto}
          </a>
        ) : (
          <Link key={s.href} href={s.href} aria-current={activa(ruta, s.href) ? 'page' : undefined}>
            <Icono nombre={s.icono} />
            {s.texto}
          </Link>
        )
      )}
    </nav>
  );
}

const activa = (ruta: string, href: string) => (href === '/' ? ruta === '/' : ruta.startsWith(href));
