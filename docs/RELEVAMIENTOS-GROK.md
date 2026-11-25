# Relevamientos de Grok · primera versión para revisión

Esta rama prepara una bandeja privada dentro del panel de moderación actual. No modifica el mapa en producción ni conecta la cuenta de Grok. No contiene las seis fichas reales aportadas como ejemplo: ese material se conserva únicamente fuera del repositorio y se probará en una sesión local aislada.

## Flujo

Pegar mensaje o JSON → previsualizar → importar pendientes → revisar datos/fuentes/posibles duplicados → aprobar una ficha para archivo o mapa, descartar o vincular con otra.

Importar no publica ni incrementa estadísticas. Las instrucciones que vengan dentro del texto son contenido, incluidas frases como «el resto quedan aprobadas». Solo una acción explícita desde el panel autoriza la aprobación. El servidor fija identificadores internos, fechas de importación/aprobación y estados. Aprobar para publicación es distinto de corroborar el hecho.

Los mensajes enumerados con identificadores ALR se conservan como texto y fichas pendientes; el importador no interpreta libremente la prosa para inventar campos. El formato estructurado recomendado está en [PROMPT-GROK.txt](PROMPT-GROK.txt). Los campos desconocidos quedan en null. La persona revisora completa o confirma los datos antes de aprobar.

## Mapa y archivo

El formulario ciudadano y las reglas públicas se conservan. Solo un hecho del día en Argentina, con hora válida y punto dentro del territorio vigente, puede aprobarse para el mapa. Vence al cumplir 48 horas desde el hecho, sin renovarse al revisar o importar. Los hechos antiguos o sin hora suficiente se revisan para el archivo estadístico, fuera del mapa.

El territorio actual sigue cubriendo Lomas del Mirador, Lomas del Millón, San Justo y Ramos Mejía. Importar referencias a otras localidades no amplía el área pública; pueden conservarse como relevamientos del archivo cuando se revisen sus fuentes.

Las estadísticas de relevamientos se presentan separadas de los reportes enviados directamente por vecinos. Cuentan fichas aprobadas, excluyen pendientes/descartadas/duplicadas/retiradas y muestran por separado las fechas o zonas desconocidas. Los enlaces compartidos solo sugieren coincidencia: un artículo puede describir más de un episodio. La reimportación del mismo identificador no crea otra ficha; unir fichas no suma otro hecho.

El resumen agregado puede exportarse sin textos, identificadores de fichas, enlaces originales ni puntos exactos. Describe el relevamiento disponible de VaLoMi, no delitos totales ni tasas oficiales. La visibilidad de 48 horas y la conservación de datos son cosas distintas: punto exacto/texto original/referencia se depuran a 30 días y las filas a un año según el criterio documentado por el módulo. Se deben conservar exportaciones agregadas para series históricas; esta primera versión no promete conservar filas indefinidamente ni publicar nuevos informes mensuales automáticamente.

## Revisión y alcance

Toda prueba de escritura debe ejecutarse en memoria, en archivo de desarrollo sin Supabase o en la demo de IndexedDB de un navegador aislado. No enviar los ejemplos a la API pública ni a Supabase de producción. No incluir mensajes reales pendientes en fixtures, capturas públicas, documentación o artefactos de despliegue.

La API de moderación sigue exigiendo la sesión existente. Las fuentes se revisan como enlaces HTTPS; aceptar su sintaxis no acredita que la noticia sea verdadera o accesible. El texto se representa como texto y los campos de aprobación recibidos de Grok carecen de autoridad.


## Verificación de esta revisión

- 74 pruebas automáticas correctas, incluidas 32 nuevas sobre importación, aprobación, retención, datos faltantes, duplicados y separación de series.
- 27 comprobaciones de navegador correctas en contextos IndexedDB aislados: seis fichas de la muestra real permanecieron pendientes y no cambiaron el mapa; las aprobaciones, duplicados, retiros y exportaciones se probaron con casos inventados.
- TypeScript y compilaciones de modo demo y modo real correctas. Las pruebas no usaron Supabase, correo, Grok ni APIs de producción.
- Vista en escritorio de 1440 px y móvil de 390 px, sin desborde de página ni errores JavaScript. Acceso directo a la bandeja desde `/moderacion#relevamientos` y desde el botón del panel.
- La agrupación por localidad exporta únicamente las cuatro zonas del mapa y las etiquetas González Catán/Villa Luzuriaga reconocidas para el archivo. Los nombres libres quedan privados y se agrupan como localidad no catalogada. Ese catálogo de etiquetas no amplía el territorio ni representa un listado oficial completo.

Evidencias sin casos reales: [resumen de pruebas](verificacion-relevamientos.json), [vista de escritorio](vistas/bandeja-demo-1440.png), [vista móvil](vistas/bandeja-demo-390.png). Las cantidades de las capturas son ficticias y pertenecen a la demostración.


## Corrección del acceso a Preview · 25/11/2026

El Preview se ejecuta con NODE_ENV=production. Sin Supabase ni la variable de demostración disponible para Preview, el panel responde 404. Se reprodujo ese comportamiento antes del arreglo.

La configuración de Next fija NEXT_PUBLIC_VALOMI_DEMO=navegador durante la compilación únicamente cuando coinciden el proyecto de demostración y el entorno Preview. Servidor e interfaz reciben el mismo valor. Las variables existentes de Production se conservan; no se habilita automáticamente la demo en el proyecto real ni en otros proyectos. La precedencia de la sesión de Supabase permanece intacta.

Comprobaciones: 77 pruebas automáticas correctas; compilación de Preview sin la variable explícita de demo; panel HTTP 200 y 27 comprobaciones de navegador correctas con datos en IndexedDB. Al configurar credenciales ficticias de Supabase, sin iniciar sesión ni realizar consultas externas, el panel redirige a la entrada y su API responde 401. El panel real sin base configurada conserva su 404. La API del servidor de demo sin base responde 503; la interfaz no la utiliza porque sus operaciones se resuelven en el navegador.

Vercel mantiene la protección de la vista previa. Su comprobación autenticada remota requiere la sesión del propietario; no se desactivó la protección ni se modificó producción.


## Fuentes por hecho · 25/11/2026

Se retiró el cupo de diez fuentes por ficha tanto del importador como del botón de edición. Se conservan todas las fuentes recibidas y su orden, con validación individual de cada URL y campo. Siguen vigentes los límites de tamaño total del mensaje y del pedido, sin truncar listas automáticamente. Si el valor de fuentes no es una lista, el error ahora señala ese formato.

Verificación: 80 pruebas automáticas correctas. El navegador importó 25 fuentes y amplió la ficha a 30; una URL inválida en la última posición no reemplazó los datos guardados. La ficha permaneció pendiente, con cero aprobaciones y cero conteos. Las pruebas utilizaron únicamente datos inventados en IndexedDB local, sin envíos a servicios reales.
