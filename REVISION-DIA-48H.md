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

## Publicación del 20 de noviembre

La usuaria conectó el repositorio a los proyectos existentes `valomi-reportes` y `valomi-prueba`. La integración de GitHub confirmó ambos proyectos y generó vistas previas Ready. El servicio real atiende `valomi.online` y el formulario `valomi-prueba.vercel.app/reportar`; el proyecto `valomi-reportes` es una demo.

La publicación se limita mediante `ignoreCommand` al ID del proyecto real y la rama `main`. Los despliegues de producción de la demo, las identidades desconocidas, las configuraciones incompletas y el modo demo en el proyecto real se omiten. Las vistas previas están permitidas en ambos proyectos. Se añadieron seis pruebas para esta separación de destinos y sus códigos de salida.

La conexión directa de Vercel sigue sin acceso al equipo; el despliegue se ejecuta mediante la conexión Git existente. No se modifican dominios, credenciales, variables del proyecto ni datos de reportantes. Las vistas previas están protegidas por autenticación de Vercel: Ready acredita la compilación; las comprobaciones públicas se harán sobre el servicio real después de la publicación.
