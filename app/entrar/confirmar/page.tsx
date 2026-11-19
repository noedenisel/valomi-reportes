import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConfirmarEntrada } from '@/components/EntradaModeracion';
import { supabaseConfigurado } from '@/lib/almacen-supabase';

export const metadata: Metadata = { title: 'Entrar', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function Confirmar() {
  if (!supabaseConfigurado()) notFound();
  return <ConfirmarEntrada />;
}
