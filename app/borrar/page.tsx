import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FormularioBorrado } from '@/components/FormularioBorrado';

export const metadata: Metadata = { title: 'Pedir que se borre un reporte' };

export default function Borrar() {
  return (
    <Suspense>
      <FormularioBorrado />
    </Suspense>
  );
}
