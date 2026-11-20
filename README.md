# VaLoMi · mapa de reportes

Código preparado a partir de `app-reportes` del ZIP entregado por VaLoMi. Incluye la actualización solicitada el 19 de noviembre de 2026:

- Solo admite hechos del día actual en Argentina, con validación en el servidor.
- Los reportes y sus adjuntos públicos dejan de verse al cumplir 48 horas desde el hecho.
- La expiración también se aplica a fichas abiertas y a los datos que permanecen en memoria sin conexión.

## Proyectos y publicación

El repositorio está conectado a dos proyectos existentes del equipo `noedenisels-projects`:

- `valomi-prueba` (`prj_4CNMQesFHuLyoX18BtWHHUiWnsID`): servicio real que atiende `valomi.online`; su formulario abre `valomi-prueba.vercel.app/reportar`.
- `valomi-reportes` (`prj_wMEsSpWxE9yZ2skvXAIBifpU8Goz`): demo con datos ficticios guardados en cada navegador.

`ignoreCommand` ejecuta `scripts/permitir-despliegue.mjs` para separar los destinos: permite producción únicamente en el proyecto real y desde `main`, y permite vistas previas en ambos proyectos. Si falta la identidad del proyecto o no coincide con los destinos conocidos, omite el despliegue. El script no modifica dominios, variables ni datos.

Los despliegues de `main` están habilitados y la guardia permite publicar únicamente en el proyecto real, siempre que no esté configurado como demo. El proyecto de la demo omite producción. Se conservan los dominios y las variables existentes. La conexión directa de Vercel sigue sin acceso al equipo, por lo que el estado de los despliegues se consulta mediante la integración de GitHub.

## Desarrollo y comprobaciones

```sh
npm ci
npm run probar
npm run typecheck
npm run build
npm run dev
```

Las 42 pruebas funcionales y de despliegue pasan, al igual que la compilación. Se probaron la medianoche argentina, las fechas manipuladas, el límite exacto de 48 horas y el vencimiento de ficha/foto sin conexión con un reloj de dispositivo atrasado. Las pruebas usaron datos ficticios locales o solicitudes interceptadas; no se enviaron reportes públicos.

[Detalle de los cambios y sus límites](REVISION-DIA-48H.md).

Capturas de las pruebas locales, con datos ficticios:

- [Formulario: solo hechos de hoy](docs/vistas/formulario-solo-hoy.png).
- [Bloqueo al cruzar la medianoche argentina](docs/vistas/medianoche-bloqueado.png).
- [Mapa después del vencimiento de 48 horas, sin conexión](docs/vistas/vencido-offline-movil.png).

No se incluyen credenciales, datos locales de reportantes ni archivos de configuración de cuentas. El servicio real de almacenamiento y los accesos de moderación deben conservar la configuración del proyecto actual. La retención interna y el Observatorio se mantienen; ocultar un reporte del mapa no elimina sus registros internos.


## Vistas previas de revisión

La conexión con el proyecto real fue confirmada por la usuaria y por el despliegue de la rama `preview/dia-48h` en ambos proyectos el 20 de noviembre de 2026:

- [Vista previa del proyecto real](https://valomi-prueba-git-preview-dia-48h-noedenisels-projects.vercel.app/).
- [Vista previa de la demo](https://valomi-reportes-git-preview-dia-48h-noedenisels-projects.vercel.app/).

Las vistas previas exigen una sesión de Vercel autorizada. El estado Ready confirma la compilación, pero no equivale a una comprobación autenticada del formulario o a un alta completa. Las pruebas funcionales locales usaron datos ficticios y solicitudes interceptadas.
