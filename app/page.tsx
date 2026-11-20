import Link from 'next/link';
import { Creditos } from '@/components/Creditos';

export default function Inicio() {
  return (
    <div className="contenedor">
      <h1 className="lema">
        Todos sabemos lo que pasa. <span>Con voluntad y sin corrupción, se resuelve.</span>
      </h1>
      <p>Contá lo que viste o te pasó en Lomas del Mirador, Lomas del Millón, San Justo o Ramos Mejía. Sin cuenta y sin dar tu nombre.</p>
      <a href="/reportar" className="boton boton--primario boton--grande boton--ancho">Reportar un hecho</a>
      <Link href="/mapa" className="boton boton--secundario boton--ancho">Ver el mapa</Link>
      <section className="caja caja--gris" aria-labelledby="como-titulo">
        <h2 id="como-titulo">Cómo funciona</h2>
        <ol className="pasos-inicio">
          <li>Contás qué pasó hoy, dónde y a qué hora, en horario de Argentina.</li>
          <li>Aparece enseguida en el mapa como «Sin verificar», en una zona aproximada.</li>
          <li>Después se revisa: se quitan datos personales y, si no cumple las reglas, se retira.</li>
        </ol>
        <Link href="/como-se-revisan">Cómo se revisan los reportes</Link>
      </section>
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
