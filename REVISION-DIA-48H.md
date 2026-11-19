# Mapa VaLoMi: hechos de hoy y visibilidad de 48 horas

Preparación del 19 de noviembre de 2026, basada en los archivos reales de `app-reportes` del ZIP entregado. Esta copia no se publicó en el servicio real de `valomi.online` / `valomi-prueba.vercel.app`.

## Comportamiento

- El formulario solicita una hora del día actual en Argentina. No ofrece ayer ni anteayer.
- El servidor verifica la fecha de Argentina, rechaza horas futuras o imposibles y conserva la fecha elegida para impedir que un formulario abierto antes de medianoche se interprete como un hecho del día siguiente.
- El mapa, su lista, las fichas y los adjuntos públicos dejan de mostrar el reporte al cumplir 48 horas desde el hecho. La revisión o publicación posterior no reinicia el plazo.
- El mapa utiliza la hora comunicada por el servidor y programa el vencimiento de los reportes abiertos, también sin conexión. Los filtros permiten 48 o 24 horas; se retira la opción de 7 días.
- El service worker deja de guardar respuestas de API y adjuntos. Al activarse, elimina la caché anterior que podía conservar reportes. La interfaz y el mapa base conservan su uso sin conexión.
- Se mantienen la retención interna, la moderación y los datos agregados del Observatorio. Ocultar públicamente no equivale a borrar los registros internos.

## Verificación

Las 36 pruebas de `npm run probar` pasan, incluidos los límites de medianoche argentina, fechas manipuladas, horas imposibles y 47 h 59 min / 48 h exactas / más de 48 h.

En el servidor de desarrollo local, con registros expresamente ficticios, el GET de reportes devolvió únicamente los vigentes y `Cache-Control: no-store`. Cinco POST con fechas u horas inválidas devolvieron 400 sin crear registros. No se enviaron reportes a servicios públicos.

El handler de adjuntos compilado se verificó con almacén y sesión simulados: los adjuntos vencidos, futuros o retenidos devolvieron 404 sin leer el archivo; los originales requirieron autorización. Se conserva el acceso de moderación.

La compilación de producción y TypeScript terminaron correctamente. En Chromium, un reporte ficticio próximo a cumplir 48 horas desapareció junto con su ficha y foto al vencer, sin conexión y con el reloj del dispositivo atrasado un día respecto del servidor. Otro flujo, con el navegador en Honolulu, bloqueó un formulario que cruzaba la medianoche argentina y verificó el envío de la nueva fecha al elegir de nuevo la hora. Los POST del navegador se interceptaron; no se publicaron hechos reales.

La prueba aislada del service worker verificó la eliminación de la caché anterior, las respuestas JSON 503 de API sin conexión y la conservación de los datos estáticos del mapa. Una instalación antigua que estuviera completamente desconectada necesita reconectarse para recibir la nueva versión.

## Antes de publicar

El repositorio `noedenisel/valomi-reportes` estaba vacío antes de cargar esta preparación. La conexión directa de Vercel devolvió 403 para el equipo conocido y la autorización de equipo respondió «Team not found». No fue posible recuperar el código que actualmente está desplegado ni comprobar su configuración.

Hay que identificar el proyecto de Vercel, recuperar o confirmar su código vigente y comparar esta preparación antes de conectarlo al repositorio y desplegar. No reemplazar la aplicación pública basándose en que esta copia del ZIP es necesariamente su versión actual.
