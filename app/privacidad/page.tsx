import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacidad y términos de uso' };

export default function Privacidad() {
  return (
    <div className="contenedor texto">
      <h1>Privacidad y términos de uso</h1>
      <p className="ayuda">Última actualización: 19 de noviembre de 2026</p>

      <h2>1. ¿Qué es VaLoMi?</h2>
      <p>
        VaLoMi es una asociación civil que creó una plataforma comunitaria de información y alertas vecinales sobre hechos de
        inseguridad en la zona de Lomas del Mirador y áreas de cobertura habilitadas.
      </p>
      <p>Su finalidad es facilitar la circulación de información entre vecinos y contribuir a la prevención comunitaria.</p>
      <p>
        VaLoMi no es un organismo público, policial ni judicial. No recibe denuncias penales formales, no realiza
        investigaciones judiciales y no reemplaza los canales oficiales de emergencia o denuncia.
      </p>

      <h2>2. Privacidad: lo que necesitás saber</h2>
      <ul>
        <li>No necesitás crear una cuenta ni proporcionar tu nombre para enviar un reporte.</li>
        <li>Al enviar un reporte, la aplicación no solicita datos personales identificatorios del remitente.</li>
        <li>
          La aplicación no almacena la dirección IP en su propia base de reportes. Para limitar los envíos automatizados puede
          utilizarse información técnica de conexión protegida mediante mecanismos criptográficos, que se conserva durante un
          máximo de una hora.
        </li>
        <li>La ubicación que aparece en el mapa público es aproximada. La ubicación exacta queda restringida al equipo de moderación.</li>
        <li>El contenido que escribís en el formulario no se conserva como borrador en tu dispositivo.</li>
        <li>No utilizamos cookies publicitarias ni herramientas de seguimiento comercial.</li>
      </ul>
      <p>
        La ausencia de registro de usuarios no garantiza el anonimato absoluto. Los proveedores tecnológicos pueden procesar o
        conservar determinados datos técnicos de conexión conforme a sus propias políticas y obligaciones.
      </p>

      <h2>3. ¿Qué información recopilamos?</h2>
      <p>Cuando enviás un reporte, podemos recibir:</p>
      <ul>
        <li>Descripción del hecho informado.</li>
        <li>Fecha y hora aproximadas del acontecimiento.</li>
        <li>Ubicación geográfica del hecho.</li>
        <li>Fotografías y videos aportados voluntariamente.</li>
        <li>Información técnica necesaria para el funcionamiento y la seguridad de la plataforma.</li>
      </ul>
      <p>No solicitamos que identifiques a presuntos responsables ni que proporciones información personal de terceros.</p>

      <h2>4. ¿Quién puede ver la información?</h2>
      <p>
        La información se utiliza para la recepción, evaluación, moderación y publicación de alertas comunitarias.
      </p>
      <p>
        El equipo de moderación puede acceder a los reportes originales, incluidos su ubicación exacta y sus archivos
        multimedia.
      </p>
      <p>
        Los usuarios de la aplicación pueden consultar únicamente las versiones públicas que hayan superado el proceso de
        moderación.
      </p>
      <p>
        Antes de su publicación, los contenidos pueden ser editados, desidentificados o modificados para proteger la
        privacidad y seguridad de las personas.
      </p>
      <p>
        La publicación de un reporte no implica que el hecho haya sido comprobado por una autoridad ni que exista una
        investigación judicial.
      </p>

      <h2>5. ¿Cuánto tiempo conservamos los datos?</h2>
      <p>Solo recibimos hechos del día actual en Argentina. En el mapa y la lista pública, cada reporte y sus archivos publicados se muestran hasta 48 horas desde la hora del hecho; una revisión no reinicia ese plazo. La visibilidad pública es distinta de la conservación interna indicada a continuación.</p>
      <p>Aplicamos los siguientes plazos de conservación:</p>
      <ul>
        <li>
          Información original del reporte: la ubicación exacta y las fotografías y videos originales se conservan durante un
          máximo de 30 días desde la fecha del hecho.
        </li>
        <li>
          Reporte público: la versión revisada, con ubicación aproximada y archivos multimedia tratados para proteger la
          identidad de las personas, se conserva durante un máximo de un año.
        </li>
        <li>
          Solicitudes de eliminación y registros de moderación: se conservan durante un año desde su resolución, con acceso
          restringido.
        </li>
      </ul>
      <p>
        Los reportes rechazados o retirados se eliminan de los sistemas activos. Los plazos de eliminación de copias de
        respaldo y registros técnicos de proveedores pueden estar sujetos a sus respectivos ciclos de conservación.
      </p>
      <p>
        Antes de almacenar fotografías y videos, se eliminan sus metadatos de ubicación y del dispositivo, en la medida
        técnicamente posible.
      </p>

      <h2>6. Proveedores tecnológicos</h2>
      <p>Para prestar el servicio utilizamos infraestructura tecnológica de terceros, entre ellos:</p>
      <ul>
        <li>Vercel: alojamiento y funcionamiento de la aplicación.</li>
        <li>Supabase: almacenamiento y gestión de información.</li>
        <li>Cloudflare Turnstile: mecanismo de verificación para prevenir envíos automatizados y abusos.</li>
      </ul>
      <p>
        Estos proveedores pueden procesar información técnica necesaria para prestar y proteger sus servicios, conforme a sus
        condiciones y políticas de privacidad.
      </p>
      <p>
        La información puede ser procesada en infraestructura ubicada fuera de Argentina. Su tratamiento y eventual
        transferencia internacional deberán ajustarse a la legislación aplicable en materia de protección de datos personales.
      </p>
      <p>No comercializamos los datos personales ni utilizamos los reportes para publicidad personalizada.</p>

      <h2>7. Uso responsable de la plataforma</h2>
      <p>Al utilizar VaLoMi, te comprometés a:</p>
      <ul>
        <li>Informar hechos que hayas observado o vivido, o identificar claramente cuando se trate de información de terceros.</li>
        <li>No presentar rumores como hechos comprobados.</li>
        <li>No utilizar la plataforma para realizar amenazas, hostigamientos o acusaciones personales.</li>
        <li>No publicar nombres, teléfonos, domicilios particulares ni otros datos que permitan identificar a presuntos responsables.</li>
        <li>No utilizar imágenes para escrachar, perseguir o exponer a personas.</li>
        <li>No enviar información deliberadamente falsa ni utilizar la aplicación para perjudicar a terceros.</li>
      </ul>
      <p>
        VaLoMi puede rechazar, editar, ocultar o retirar cualquier contenido que incumpla estas condiciones o pueda afectar
        derechos de otras personas.
      </p>
      <p>La moderación no implica una verificación policial o judicial del hecho informado.</p>

      <h2>8. Solicitudes de revisión y eliminación</h2>
      <p>
        Cualquier persona puede solicitar la revisión o eliminación de un reporte que considere inexacto, perjudicial o que
        afecte sus derechos.
      </p>
      <p>
        Para ello debe utilizar la opción «Pedir que se borre un reporte», indicando cuál es el contenido cuestionado y los
        motivos de su solicitud. Si querés recibir la respuesta, podés dejar un correo electrónico opcional; se conserva
        junto con la solicitud durante un año.
      </p>
      <p>
        Las solicitudes de eliminación o rectificación serán evaluadas y recibirán respuesta dentro de un plazo máximo de
        cinco días hábiles, sin perjuicio de los plazos y derechos establecidos por la Ley 25.326.
      </p>

      <h2>9. Tus derechos sobre los datos personales</h2>
      <p>De acuerdo con la Ley 25.326 de Protección de los Datos Personales, podés solicitar:</p>
      <ul>
        <li>Acceso a los datos personales que sean objeto de tratamiento.</li>
        <li>Rectificación o actualización de información inexacta o incompleta.</li>
        <li>Supresión de datos cuando corresponda legalmente.</li>
      </ul>
      <p>Estos derechos también pueden ser ejercidos por personas cuyos datos aparezcan en un reporte publicado.</p>
      <p>Responsable de la base de datos: Gabriel Lombardo.</p>
      <p>Domicilio: Lomas del Mirador, La Matanza, provincia de Buenos Aires.</p>
      <p>
        Contacto para consultas sobre privacidad y datos personales:{' '}
        <a href="mailto:privacidad@valomi.com.ar">privacidad@valomi.com.ar</a>.
      </p>
      <p>La Agencia de Acceso a la Información Pública (AAIP) es el organismo de control de la Ley 25.326.</p>

      <h2>10. Importante: emergencias y denuncias formales</h2>
      <p>VaLoMi no es un canal de emergencias ni de denuncias penales.</p>
      <p>Si estás ante una emergencia o un delito en curso, comunicate inmediatamente con el 911.</p>
      <p>Para realizar una denuncia formal, acudí a la comisaría o a la fiscalía correspondiente.</p>
      <p>No te expongas, no persigas sospechosos ni intervengas en situaciones de riesgo para obtener información o imágenes.</p>

      <h2>11. Mapas y cartografía</h2>
      <p>La representación cartográfica utiliza datos y servicios de OpenStreetMap y sus colaboradores.</p>
      <p className="ayuda">© Colaboradores de OpenStreetMap. Datos disponibles bajo licencia Open Database License (ODbL).</p>
    </div>
  );
}
