# Auditoría frontal — LoL

28/09/2026, CT112. Revisión delegada en un torneo aislado, contrastada con la matriz Playwright de esta misma sesión. Véase el [informe consolidado](README.md).

1. **Marcador y previa — correctos.** Logos, nombres largos y resultados permanecen legibles. El «VS» duplicado de los encuentros pendientes se ha corregido. [Previa pendiente](../capturas/lol-previa-pending-1920.png).
2. **Grupos — corregido.** El grupo de prueba tiene diez equipos: ahora aparecen los diez en cada página de partidos. El fallo anterior cortaba la clasificación al cambiar de página. [Grupo completo](../capturas/lol-groups-1280.png), [página 2](../capturas/lol-auto-page-2.png).
3. **Suizo y cuadros — correctos en los casos probados.** La matriz complementa la revisión inicial del subagente con Final Four y Upper/Lower publicados. [Suizo](../capturas/lol-swiss-1280.png), [eliminación](../capturas/lol-elimination-1280.png), [Final Four](../capturas/lol-final-four-1280.png), [Upper/Lower](../capturas/lol-upper-lower-1280.png).

La única columna centrada en eliminación corresponde a una sola ronda generada, con cuatro encuentros por página; no demuestra un fallo de composición. Los sustitutos E0/E1 proceden de nombres sintéticos similares; el nombre completo acompaña al logo y sigue identificando cada equipo. Se descartan ambos como defectos funcionales.

La comprobación de transparencia usa el canal alfa de los píxeles, además de las propiedades CSS. Que un PNG sea RGBA no basta por sí solo para probar transparencia.

Se revisaron 1920×1080 y 1280×720. La legibilidad tras compresión y escalado de una emisión real queda pendiente de una prueba dentro de OBS.
