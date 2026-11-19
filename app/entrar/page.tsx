import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PedirEnlace } from '@/components/EntradaModeracion';
import { supabaseConfigurado } from '@/lib/almacen-supabase';

export const metadata: Metadata = { title: 'Entrar', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function Entrar() {
  if (!supabaseConfigurado()) notFound();
  return <PedirEnlace />;
}
