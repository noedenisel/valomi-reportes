import type { Metadata } from 'next';
import { PantallaMapa } from '@/components/PantallaMapa';

export const metadata: Metadata = { title: 'Mapa' };

export default function Mapa() {
  return <PantallaMapa />;
}
