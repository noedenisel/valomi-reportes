import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Cómo se revisan los reportes' };

export default function ComoSeRevisan() {
  return (
    <div className="contenedor texto">
      <h1>Cómo se revisan los reportes</h1>
      <p>
        Cada reporte aparece en el mapa apenas se envía, como «Sin verificar». Después lo revisa Gabriel Lombardo, en 12
        horas como máximo.
      </p>
      <h2>Qué significa cada estado</h2>
      <ul>
        <li><span className="estado estado--sin-verificar">Sin verificar</span> Un vecino lo reportó y todavía nadie lo revisó.</li>
        <li><span className="estado estado--revisado">Revisado por VaLoMi</span> Se revisó y cumple las reglas de publicación. No confirma que el hecho haya ocurrido.</li>
        <li>
          <span className="estado estado--corroborado">Corroborado</span> Además, está confirmado: por una fuente oficial, una
          nota de prensa, una prueba revisada, o porque Gabriel fue al lugar o habló con el vecino damnificado.
        </li>
      </ul>
      <p>Que varios reportes coincidan no prueba que un hecho haya ocurrido: nunca cambia un estado por sí solo.</p>
      <h2>Qué nunca se publica</h2>
      <ul>
        <li>Nombres, caras, patentes ni números de casa.</li>
        <li>Datos de menores.</li>
        <li>Rasgos de una persona: aspecto, origen o vestimenta.</li>
        <li>El punto exacto: el mapa muestra una zona de unas dos manzanas, o nada si mostrarla puede identificar a alguien.</li>
      </ul>
      <p>
        Si el texto parece tener datos personales, el reporte no se publica hasta que se revise. Esa detección automática
        puede fallar: por eso siempre hay una revisión a mano. Las fotos y los videos se publican solo después de revisarlos
        y de difuminar caras y patentes.
      </p>
      <h2>Cuánto tiempo se muestra</h2>
      <p>Los reportes aceptados se muestran en el mapa y la lista pública hasta 48 horas desde la hora del hecho, aunque cambie el día. Una revisión o corroboración no reinicia ese plazo. Al vencer, tampoco se ofrecen sus fotos públicas.</p>
      <h2>Cuándo se retira un reporte</h2>
      <p>
        Si queda fuera del barrio, al enviarlo no correspondía al día actual en Argentina, no es un hecho de inseguridad, acusa a una persona identificable,
        tiene datos personales que no se pueden quitar, discrimina, es contenido partidario o publicidad, o está repetido.
      </p>
    </div>
  );
}
