'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';

/** Pide el enlace al correo. */
export function PedirEnlace() {
  const [correo, setCorreo] = useState('');
  const [estado, setEstado] = useState<'nada' | 'enviando'>('nada');
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEstado('enviando');
    setMensaje(null);
    const sitio = new FormData(e.currentTarget).get('sitio');
    const r = await fetch('/api/sesion/enlace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ correo, sitio }),
    }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    setMensaje(d?.mensaje ?? 'No se pudo pedir el enlace. Probá de nuevo.');
    setEstado('nada');
  }

  return (
    <form onSubmit={enviar} className="contenedor" noValidate>
      <h1 style={{ fontSize: '1.4rem' }}>Entrar a la moderación</h1>
      <div className="campo">
        <label htmlFor="correo">Tu correo</label>
        <input id="correo" type="email" required inputMode="email" autoComplete="email" className="entrada" value={correo} onChange={(e) => setCorreo(e.target.value)} />
      </div>
      <div className="trampa" aria-hidden="true">
        <label htmlFor="sitio">No completar</label>
        <input id="sitio" name="sitio" tabIndex={-1} autoComplete="off" />
      </div>
      {mensaje && <p role="status" className="caja caja--gris">{mensaje}</p>}
      <button type="submit" className="boton boton--primario" disabled={estado === 'enviando' || !correo.trim()}>
        {estado === 'enviando' ? 'Enviando…' : 'Enviarme el enlace'}
      </button>
    </form>
  );
}

/** Destino del enlace: Supabase vuelve con la sesión en la dirección (nunca llega al servidor); se canjea y se borra de la barra. */
export function ConfirmarEntrada() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(location.hash.slice(1)).get('access_token');
    history.replaceState(null, '', location.pathname);
    if (!token) {
      setError('El enlace venció o ya se usó. Pedí uno nuevo.');
      return;
    }
    fetch('/api/sesion', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(async (r) => {
        if (r.ok) {
          location.href = '/moderacion';
          return;
        }
        const d = await r.json().catch(() => ({}));
        setError(d.mensaje ?? 'No se pudo entrar. Probá de nuevo.');
      })
      .catch(() => setError('No se pudo entrar. Probá de nuevo.'));
  }, []);

  return (
    <div className="contenedor">
      <h1 style={{ fontSize: '1.4rem' }}>Entrar a la moderación</h1>
      {error ? (
        <>
          <p role="alert" className="caja caja--roja">{error}</p>
          <Link href="/entrar" className="boton boton--secundario">Pedir otro enlace</Link>
        </>
      ) : (
        <p role="status">Entrando…</p>
      )}
    </div>
  );
}
