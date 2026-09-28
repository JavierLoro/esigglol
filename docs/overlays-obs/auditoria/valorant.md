# Auditoría frontal de overlays Valorant

Auditoría realizada el 28/09/2026 sobre el torneo aislado `f592d432-454a-4261-b038-d7e2cab7f4cb`, con capturas nuevas del servidor de CT112. Se revisaron marcador, previa y fase en 1920×1080 y 1280×720, con fondo transparente.

## Resultado

El conjunto es utilizable para OBS: el lienzo queda transparente y los paneles conservan contraste sobre fondos claros u oscuros. El resumen de grupos muestra la clasificación completa del grupo A disponible en los datos: 10 filas, con seis páginas de partidos que conservan la clasificación. No se ha reproducido una pérdida de filas.

## Evidencia

1. **Marcador — correcto.** Franja compacta, logos, nombres largos y resultado de serie visibles; el BO aparece como BO5 cuando corresponde. [1920×1080](valorant/1920x1080-marcador-transparent.png) · [1280×720](valorant/1280x720-marcador-transparent.png)
2. **Previa finalizada — correcta.** El 2:0 queda centrado y los mapas registrados de Valorant aparecen con rondas (Ascent 13:7, Haven 14:12); el nombre largo se parte en dos líneas sin desbordar. [1920×1080](valorant/1920x1080-previa-transparent.png) · [1280×720](valorant/1280x720-previa-transparent.png)
3. **Fase de grupos — correcta en el alcance probado.** Se ven las 10 posiciones, V/D/Pts, logos y cuatro partidos por columna. [1920×1080 grupos](valorant/1920-fase-grupos.png) · [1280×720 grupos](valorant/1280-fase-grupos.png)
4. **BO5 de cinco mapas — correcto.** Se creó un fixture aislado con resultado 3:2 y cinco mapas; todos se muestran en una sola fila, sin solaparse ni salirse del lienzo en ambas resoluciones. [1920×1080](valorant/1920x1080-previa-bo5-5maps.png) · [1280×720](valorant/1280x720-previa-bo5-5maps.png)
5. **Fase pendiente de upper/lower — estado neutro.** Los equipos aún no determinados se muestran con sustituto visual y no rompen la composición. [1920×1080](valorant/1920-fase.png)

## Hallazgos priorizados

- **P2 — Densidad en 1280×720:** la clasificación y dos columnas de partidos siguen siendo legibles, pero los nombres largos y los metadatos de cada tarjeta quedan cerca del límite práctico. Conviene validar una fuente OBS real con escalado 100% antes de añadir más elementos opcionales.
- **P3 — Cinco mapas en una sola fila:** el BO5 cabe correctamente, aunque las tarjetas son estrechas a 1280×720. Si se necesitan nombres de mapa más largos o más metadatos, convendría permitir una segunda fila configurable.

## Límites de la auditoría

- El fixture BO5 de cinco mapas usado para esta revisión se creó temporalmente en el torneo aislado; no representa datos competitivos reales.
- No se comprobó la lectura con espectadores reales, escalado del sistema operativo ni captura dentro de OBS; se comprobó Chromium a las dos resoluciones indicadas.
- Las capturas con sufijo `transparent` se tomaron con `omitBackground: true`; el negro visible representa transparencia en el visor, no un fondo añadido por la aplicación.
