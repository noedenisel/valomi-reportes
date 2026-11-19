'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { CLAVE_CAPTCHA, Captcha } from './Captcha';
import { Icono } from './Iconos';
import { EMAIL, MOTIVO_BORRADO_MAX, MOTIVO_BORRADO_MIN } from '@/lib/reglas';

const RELACIONES = [
  { id: 'autor', nombre: 'Lo hice yo' },
  { id: 'afectado', nombre: 'Me menciona o me afecta' },
  { id: 'otra', nombre: 'Otra' },
];
type Errores = Partial<Record<'relacion' | 'referencia' | 'motivo' | 'correo', string>>;

export function FormularioBorrado() {
  const router = useRouter();
  const numero = useSearchParams().get('numero') ?? '';
  const [relacion, setRelacion] = useState('');
  const [referencia, setReferencia] = useState(numero);
  const [motivo, setMotivo] = useState('');
  const [correo, setCorreo] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [captcha, setCaptcha] = useState('');
  const [reinicioCaptcha, setReinicioCaptcha] = useState(0);
  const [estado, setEstado] = useState<{ tipo: 'nada' | 'enviando' } | { tipo: 'error'; mensaje: string } | { tipo: 'listo'; numero: string }>({ tipo: 'nada' });

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const err: Errores = {};
    if (!relacion) err.relacion = 'Elegí tu relación con el reporte.';
    if (!referencia.trim()) err.referencia = 'Escribí el código de reporte o el número público.';
    if (motivo.trim().length < MOTIVO_BORRADO_MIN || motivo.trim().length > MOTIVO_BORRADO_MAX) err.motivo = `Contá el motivo en ${MOTIVO_BORRADO_MIN} a ${MOTIVO_BORRADO_MAX} caracteres.`;
    if (correo.trim() && !EMAIL.test(correo.trim())) err.correo = 'Revisá el correo: parece que no está bien escrito.';
    setErrores(err);
    if (Object.keys(err).length) return;
    if (CLAVE_CAPTCHA && !captcha) {
      setEstado({ tipo: 'error', mensaje: 'Todavía se está comprobando que no sos un robot. Esperá unos segundos y tocá «Reintentar».' });
      return;
    }
    // Cada captcha sirve una sola vez: si el envío falla, se pide otro para el reintento.
    const pedirOtroCaptcha = () => {
      setCaptcha('');
      setReinicioCaptcha((n) => n + 1);
    };
    setEstado({ tipo: 'enviando' });
    const form = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/borrado', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ relacion, referencia, motivo, correo, sitio: form.get('sitio'), captcha }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setEstado({ tipo: 'listo', numero: d.numero });
      else {
        if (d.campo) setErrores({ [d.campo]: d.mensaje });
        pedirOtroCaptcha();
        setEstado({ tipo: 'error', mensaje: d.mensaje ?? 'El servicio no responde. Probá de nuevo en unos minutos.' });
      }
    } catch {
      pedirOtroCaptcha();
      setEstado({ tipo: 'error', mensaje: 'No hay conexión. Lo que escribiste sigue acá: tocá «Reintentar».' });
    }
  }

  if (estado.tipo === 'listo') {
    return (
      <div className="contenedor" style={{ textAlign: 'center' }}>
        <span className="icono-exito"><Icono nombre="check" /></span>
        <h1 className="titulo-paso">Solicitud recibida</h1>
        <p className="ayuda">Número de solicitud</p>
        <div className="codigo" style={{ fontSize: '1.2rem' }}>{estado.numero}</div>
        <p>Se revisa a mano en 5 días hábiles como máximo. {correo.trim() ? 'Se te avisa el resultado por correo.' : ''}</p>
        <p className="caja caja--gris" style={{ textAlign: 'left' }}>El reporte sigue visible hasta que se revise la solicitud.</p>
        <Link href="/" className="boton boton--primario">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <form className="contenedor" onSubmit={enviar} noValidate>
      <h1 className="titulo-paso">Pedir que se borre un reporte</h1>
      <p className="ayuda">La solicitud la revisa una persona. No hace falta tener cuenta.</p>
      <fieldset className="campo">
        <legend>¿Cuál es tu relación con el reporte?</legend>
        <div className="chips">
          {RELACIONES.map((r) => (
            <label key={r.id} className="chip">
              <input type="radio" name="relacion" checked={relacion === r.id} onChange={() => setRelacion(r.id)} aria-invalid={Boolean(errores.relacion)} />
              <span>{r.nombre}</span>
            </label>
          ))}
        </div>
        {errores.relacion && <p className="error">{errores.relacion}</p>}
      </fieldset>
      <div className="campo">
        <label htmlFor="referencia">Código de reporte o número público</label>
        <input id="referencia" className="entrada" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="VLM-XXXX-XXXX o 000123" autoComplete="off" aria-invalid={Boolean(errores.referencia)} />
        <span className="ayuda">Si no tenés el código, escribí el número de reporte público que figura en el mapa.</span>
        {errores.referencia && <p className="error">{errores.referencia}</p>}
      </div>
      <div className="campo">
        <label htmlFor="motivo">¿Por qué querés que se borre?</label>
        <textarea id="motivo" className="entrada" value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-invalid={Boolean(errores.motivo)} />
        {errores.motivo && <p className="error">{errores.motivo}</p>}
      </div>
      <div className="campo">
        <label htmlFor="correo">Correo para avisarte (opcional)</label>
        <input id="correo" type="email" inputMode="email" autoComplete="email" className="entrada" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@correo.com" aria-invalid={Boolean(errores.correo)} />
        {errores.correo && <p className="error">{errores.correo}</p>}
      </div>
      <div className="trampa" aria-hidden="true">
        <label htmlFor="sitio">No completar</label>
        <input id="sitio" name="sitio" tabIndex={-1} autoComplete="off" />
      </div>
      <Captcha alCambiar={setCaptcha} reinicio={reinicioCaptcha} />
      {estado.tipo === 'error' && <p className="caja caja--roja" role="alert">{estado.mensaje}</p>}
      <button type="submit" className="boton boton--primario" disabled={estado.tipo === 'enviando'}>
        {estado.tipo === 'enviando' ? 'Enviando…' : estado.tipo === 'error' ? 'Reintentar' : 'Enviar solicitud'}
      </button>
      <button type="button" className="boton boton--texto" onClick={() => router.back()}>Cancelar</button>
    </form>
  );
}
