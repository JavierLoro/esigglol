# Auditoría frontal — administración

28/09/2026, CT112. El subagente revisó el panel con un torneo vacío; la prueba Playwright de esta sesión complementa ese alcance con dos torneos publicados y partidos. Véase el [informe consolidado](README.md).

1. **Contexto y estado vacío — correctos.** El selector identifica el torneo activo y no elige automáticamente un partido. No hay fases que fijar si aún no existe contenido publicado.
2. **Selección y guardado — correctos.** La prueba recorre selección, guardado explícito, recuperación tras recargar, fijar fase/grupo/página y volver a seguir al partido. Las fuentes abiertas conservan sus URLs y actualizan su contenido.
3. **Opciones visuales — correctas.** Los presets conservan los logos como esenciales. Las casillas y modos de clasificación/partidos persisten por torneo y no desplazan los componentes restantes.
4. **Copiar URL — fallo confirmado y corregido.** En la URL LAN HTTP el navegador no expone `navigator.clipboard`. Se añadió la misma alternativa nativa que ya utilizan otras pantallas, con retirada del campo temporal y restauración del foco. La regresión comprueba el evento de copia, la URL seleccionada y el foco.

[Panel con contenido y configuración guardada](../capturas/lol-admin.png).

El ancho limitado del formulario es una elección de lectura, no un bloqueo del flujo. Las capturas de página completa pueden situar visualmente la navegación fija a mitad de la imagen: no prueban que tape controles durante el uso normal. Se descartaron esas observaciones como fallos no demostrados.

Los controles tienen etiquetas accesibles y se revisó el orden básico de teclado. No se certifica WCAG completo: faltan lector de pantalla, zoom 200% y contraste automatizado.
