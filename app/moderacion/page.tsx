import type { Metadata } from 'next';
import { PanelModeracion } from '@/components/PanelModeracion';
import { exigirModeracion } from '@/lib/moderacion-acceso';

export const metadata: Metadata = { title: 'Moderación', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function Moderacion() {
  await exigirModeracion();
  return <PanelModeracion />;
}
