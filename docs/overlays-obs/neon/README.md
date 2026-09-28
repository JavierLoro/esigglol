# Integración de la propuesta neón

Propuesta recibida en `.tmp/overlays-obs-neon.zip`, integrada en CT112 sobre `overlaysOBS`.

Los dos archivos de presentación se incorporan desde el paquete: `app/overlay/overlay.css` y `components/overlay/OverlayScene.tsx`. Las seis copias restantes del ZIP coinciden con el proyecto y no se sustituyen. La copia previa de los dos archivos está en `.tmp/overlays-before-neon.zip`.

El acabado usa paneles oscuros con diagonales y contornos neón. El rosa del ZIP es el valor inicial; el selector **Color de los overlays** permite personalizarlo por torneo y **Restablecer rosa** recuperarlo, siempre mediante guardado explícito. Las tres fuentes permanentes y las rutas fijas heredan ese color. Los bordes de recorrido siguen siendo cian continuo y ámbar discontinuo. El suizo conserva el cuadro compartido con `/fases` y las medidas de sus tarjetas. La tabla sin puntos ahora usa cuatro columnas.

El marcador pasa de un 70 % a un 88 % de ancho y de 5,8 a 7,4 cqw de alto. Si se había recortado esa fuente en OBS, el nuevo encuadre necesita tener en cuenta esas dimensiones. Los elementos ocultos conservan su espacio y el centro del marcador permanece transparente cuando torneo y BO están desactivados.

Capturas con los datos y preferencias actuales del torneo de previsualización, sin cambiar su configuración:

- [Marcador 1080p](preview-marcador-1920.png) · [720p](preview-marcador-1280.png)
- [Previa 1080p](preview-previa-1920.png) · [720p](preview-previa-1280.png)
- [Fase 1080p](preview-fase-1920.png) · [720p](preview-fase-1280.png)

Estas capturas conservan el canal alfa. Se comprobaron el fondo exterior transparente, la ausencia de scroll y de errores JavaScript a ambas resoluciones. La comprobación de superficies en Playwright admite tanto fondos de color como degradados CSS; los contenedores exteriores siguen requiriendo transparencia y ausencia de imagen de fondo.

Verificación en el proyecto: lint y TypeScript correctos; 14 pruebas de datos/componentes y las dos pruebas completas de `e2e/overlays.spec.ts` correctas. Las 56 capturas de [escenas y controles](../capturas/) y 20 de [recorridos y formatos](../recorridos/) se han actualizado con el nuevo diseño. También se comprobaron píxeles con alfa 0 fuera de los componentes y en el centro oculto del marcador, y alfa 255 dentro de los paneles, a ambas resoluciones. No se ha conectado una instancia real de OBS ni desplegado en producción.

`next build` completado correctamente con salida `.tmp/obs-build`, base de prueba `.tmp/obs-build.db` y credenciales efímeras generadas en memoria.

El selector de color se verifica en una tercera prueba Playwright: cambios cian/verde, torneo independiente morado, herencia en ambas rutas fijas, guardado explícito, persistencia y restablecimiento del rosa. Las medidas del marcador y los bordes cian/ámbar de recorrido se conservan. Las pruebas de API rechazan colores mal formados sin sobrescribir la configuración previa.

- [Selector en administración](color-admin.png)
- [Marcador con color personalizado](color-marcador-1920.png)
- [Previa con color personalizado](color-previa-1920.png)
- [Fase con color personalizado](color-fase-1920.png)
