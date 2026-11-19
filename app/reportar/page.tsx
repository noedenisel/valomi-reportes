import type { Metadata } from 'next';
import { FormularioReporte } from '@/components/FormularioReporte';
import { esModeracion } from '@/lib/moderacion-acceso';

export const metadata: Metadata = { title: 'Reportar un hecho' };

export default async function Reportar() {
  return <FormularioReporte moderacion={await esModeracion()} />;
}
