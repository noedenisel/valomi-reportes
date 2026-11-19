# VaLoMi · mapa de reportes

Código preparado a partir de `app-reportes` del ZIP entregado por VaLoMi. Incluye la actualización solicitada el 19 de noviembre de 2026:

- Solo admite hechos del día actual en Argentina, con validación en el servidor.
- Los reportes y sus adjuntos públicos dejan de verse al cumplir 48 horas desde el hecho.
- La expiración también se aplica a fichas abiertas y a los datos que permanecen en memoria sin conexión.

## Estado de publicación

La dirección `https://valomi-reportes.vercel.app` muestra actualmente una demo de datos ficticios guardados solo en cada navegador. No confundirla con el servicio real de `valomi.online` / `valomi-prueba.vercel.app`. El nombre de este repositorio no obliga a desplegarlo en el proyecto de la demo.

**Preparado y probado; todavía no publicado en el mapa.** No se pudo recuperar el código actualmente desplegado ni verificar la configuración del proyecto de Vercel. La conexión respondió 403 para el equipo conocido y la autorización de equipo respondió «Team not found».

`vercel.json` incluye temporalmente `git.deploymentEnabled: false` para que cargar este código no sustituya automáticamente la aplicación pública. Antes de habilitar despliegues, identificar el proyecto del servicio real (`https://valomi.online`, con formulario en `https://valomi-prueba.vercel.app/reportar`), comparar o confirmar su código vigente y verificar su configuración existente. No crear otro proyecto ni reemplazar sus variables a ciegas.

## Desarrollo y comprobaciones

```sh
npm ci
npm run probar
npm run typecheck
npm run build
npm run dev
```

Las 36 pruebas y la compilación pasan. Se probaron la medianoche argentina, las fechas manipuladas, el límite exacto de 48 horas y el vencimiento de ficha/foto sin conexión con un reloj de dispositivo atrasado. Las pruebas usaron datos ficticios locales o solicitudes interceptadas; no se enviaron reportes públicos.

[Detalle de los cambios y sus límites](REVISION-DIA-48H.md).

Capturas de las pruebas locales, con datos ficticios:

- [Formulario: solo hechos de hoy](docs/vistas/formulario-solo-hoy.png).
- [Bloqueo al cruzar la medianoche argentina](docs/vistas/medianoche-bloqueado.png).
- [Mapa después del vencimiento de 48 horas, sin conexión](docs/vistas/vencido-offline-movil.png).

No se incluyen credenciales, datos locales de reportantes ni archivos de configuración de cuentas. El servicio real de almacenamiento y los accesos de moderación deben conservar la configuración del proyecto actual. La retención interna y el Observatorio se mantienen; ocultar un reporte del mapa no elimina sus registros internos.
