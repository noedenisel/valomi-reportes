import type { Metadata } from 'next';
import Link from 'next/link';
import { Creditos } from '@/components/Creditos';

export const metadata: Metadata = { title: 'Más' };

export default function Mas() {
  return (
    <div className="contenedor">
      <h1 className="titulo-paso">Más</h1>
      <ul className="menu-mas">
        <li><a href="/borrar">Pedir que se borre un reporte <span aria-hidden="true">›</span></a></li>
        <li><Link href="/como-se-revisan">Cómo se revisan los reportes <span aria-hidden="true">›</span></Link></li>
        <li><Link href="/privacidad">Privacidad y términos <span aria-hidden="true">›</span></Link></li>
      </ul>
      <p className="caja caja--roja">
        <span>
          <strong>No es un canal de emergencias ni de denuncias.</strong> Ante una emergencia llamá al 911. Para hacer una
          denuncia formal, acudí a la comisaría o a la fiscalía.
        </span>
      </p>
      <Creditos />
    </div>
  );
}
