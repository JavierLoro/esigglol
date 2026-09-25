# Assets de Valorant

`npm run sync-valorant` descubre el ZIP publicado en https://developer.riotgames.com/docs/valorant y sincroniza el catálogo local en `public/valorant/`. No necesita API key y no consulta cuentas ni historiales.

- Agentes (retratos pequeños), tarjetas (iconos pequeños), mapas y nombres españoles: catálogo oficial de Riot.
- Insignias de rango: https://valorant-api.com/v1/competitivetiers y su CDN `media.valorant-api.com`. Es una fuente comunitaria de imágenes estáticas, equivalente al uso de CommunityDragon para emblemas de LoL. No proporciona estadísticas de participantes.
- El manifiesto registra versión, fecha, fuentes e índices por UUID o competitiveTier.
- El ranking utiliza exclusivamente el rango y las estadísticas devueltos por Riot. No asigna una tarjeta por nombre ni infiere agentes favoritos. El avatar del participante es el logo de su equipo; si no tiene logo, se muestran las iniciales del equipo. Las tarjetas quedan disponibles en el catálogo, pero no se utilizan en el ranking.

`predev` y `prebuild` ejecutan la sincronización con `--optional`: un fallo conserva el catálogo anterior y permite arrancar con texto/avatar neutro si aún no existe. El comando manual devuelve error cuando falla. El entorno de pruebas usa estos mismos archivos; no es necesario reiniciarlo ni volver a introducir la key para actualizar imágenes.

El ZIP oficial ocupa aproximadamente 1,5 GB. Se descarga únicamente cuando cambia el enlace de versión o se usa `--force`; se procesa archivo a archivo y solo se extraen recursos seleccionados. El ZIP temporal se elimina al terminar. Puede reutilizarse una descarga con `npm run sync-valorant -- --zip ruta/catalogo.zip`. El contenido de ese ZIP debe corresponder a la versión oficial actual.

Las versiones se guardan en directorios distintos y el manifiesto se sustituye únicamente tras validar agentes, tarjetas y los 25 rangos. Los assets anteriores permanecen para no romper páginas abiertas. `public/valorant/` no se versiona en Git; Docker incluye los archivos generados durante el build al copiar `public/`.

Riot actualiza el catálogo manualmente: puede ir por detrás del parche del juego. Los IDs desconocidos no generan URLs rotas ni datos inventados.
