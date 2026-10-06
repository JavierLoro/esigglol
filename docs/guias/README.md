# Mantenimiento de las guías

La fuente única del contenido es [index.md](index.md). GitHub Pages genera
la web con Jekyll y su índice automático; no usa el servidor Next.js ni la base
de datos. Actualizar el documento y publicarlo regenera las guías. El contenido
se actualiza con cada despliegue, no mediante una conexión en vivo a otro documento.

## Editar

1. Edita `docs/guias/index.md` en GitHub o localmente.
2. Conserva el bloque inicial `layout: default` y los identificadores
   `admin-global` y `admin-equipo` para mantener los enlaces de navegación.
3. Usa encabezados `##` y `###`, listas y tablas Markdown. El índice se genera solo.
4. Revisa y publica el cambio. El workflow `Guías · GitHub Pages` genera el sitio
   y comprueba el HTML, el índice, ambos roles y la hoja de estilos.

El diseño vive en `_layouts/default.html` y `assets/style.css`.
No añadas información privada: el sitio publicado es documentación pública.

## Primera publicación

Tras la aprobación de publicación:

1. En el repositorio, configura **Settings → Pages → Source → GitHub Actions**.
2. Configura el entorno `github-pages` para permitir publicar desde esa rama
   si sus reglas de protección lo requieren.
3. Sube la rama `feature/github-pages-guias`. El push genera y publica las guías
   sin activar el despliegue de la aplicación, que escucha solamente `main`.
4. Comprueba la URL que devuelve el job `deploy` y ambos enlaces de rol.

URL prevista sin dominio personalizado: `https://javierloro.github.io/esigglol/`.
La URL efectiva es la que devuelve GitHub Pages. No publiques encima de un sitio
Pages existente sin revisar antes su configuración.

## Actualizaciones y validación

Las PR a `main` que toquen estas guías generan y verifican el sitio sin publicarlo.
Los cambios a `docs/guias/**` en `feature/github-pages-guias` o `main` publican
automáticamente. Tras integrar la rama, elimínala para mantener `main` como
única fuente de publicación. Una vez integrado el workflow en `main`, también
puedes ejecutarlo manualmente para una rama autorizada por `github-pages`.

El CI/CD existente también reacciona a cualquier push a `main` y redespliega la
aplicación. Hasta autorizar esa integración, mantén los cambios en esta rama y
publica las guías haciendo push a esta rama, sin hacer merge a `main`.

El workflow de guías solo sube `docs/guias` renderizado, no el resto de `docs`
ni archivos de configuración de la aplicación.
