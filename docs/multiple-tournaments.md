# Torneos LoL y Valorant

La migración 5 crea `legacy-lol` (publicado) y asigna a esa edición los equipos,
fases, partidos, caché de ranking y configuración externa de Riot existentes.
Los IDs, versiones, contraseñas, sesiones, solicitudes y resultados se conservan.
Los enlaces antiguos se resuelven por el ID original de su entidad.

## Operación

1. Antes de desplegar, ejecutar `npm run backup` y `npm run backup:verify`.
2. Verificar la migración sobre una copia con
   `npx tsx scripts/verify-tournament-migration.ts data/esigglol.db`.
   El origen se abre solo para lectura. La copia queda en `.tmp`.
3. Desplegar. La aplicación aplica las migraciones pendientes transaccionalmente.
4. En **Admin → Torneos**, crear un borrador, añadir sus equipos y fases y publicarlo.
   La publicación del torneo no publica por sí sola brackets o rondas suizas.
5. Archivar conserva las consultas y bloquea las operaciones competitivas.
   Cambiar a publicado lo reabre. Cada edición tiene sus equipos y claves propios.

Las rutas administrativas de competición requieren `?tournament=<id>` o
`X-Tournament-Id`. Dashboard, Equipos, Solicitudes, Fases y Partidos muestran la
edición activa y su estado; el cliente completa la URL antes de montar sus
formularios. En un torneo archivado, los controles competitivos quedan
desactivados. Torneos y Apariencia son páginas globales y no muestran selector.
Las rutas del
portal derivan la edición del equipo autenticado e ignoran el selector público.
Los importadores y scripts internos operan con `inTournament(id, callback)`;
su contexto predeterminado es la edición histórica, para compatibilidad.
No usar un contexto global mutable ni compartir IDs de jugador entre plantillas.

Valorant usa PC/Europa. Los resultados de serie son mapas ganados; el detalle
opcional registra rondas por mapa. Se aceptan 13 rondas con rival hasta 11 y
prórrogas desde 14 con dos rondas de ventaja. No hay vetos, códigos ni salas.

## API oficial de Valorant

`VALORANT_API_KEY` es independiente de `RIOT_API_KEY`. Puede contener el mismo valor que la clave de desarrollo de LoL; no hay
reutilización automática. `npm run test-valorant` imprime exclusivamente disponibilidad, fecha y estado
HTTP; no escribe datos ni imprime cuerpos, identidades o secretos. Para probar
cada endpoint, proporcionar también `VALORANT_TEST_RIOT_ID`,
`VALORANT_TEST_PUUID`, `VALORANT_TEST_MATCH_ID` y `VALORANT_TEST_ACT_ID` en el entorno.

El prototipo privado `/admin/valorant` está oculto del menú, funciona solo en desarrollo y requiere
sesión de administrador. Incluye fixtures explícitos de desarrollo; nunca se
sirven por las rutas públicas. La ausencia de clave, un 401/403/429, datos
incompletos o no aparecer en la clasificación significan **no disponible**.
El rango observado en una partida no se presenta como rango actual. Solo son
comparables posiciones oficiales del mismo acto.

La publicación de datos personales permanece cerrada: no basta con configurar
una variable. Activarla requiere acceso de producción y una integración RSO
con consentimiento verificable del jugador. La gestión manual funciona sin API.
Prueba real del 24/09/2026: cuenta, contenido, estado y clasificación respondieron
200 con una clave de desarrollo; historial y partidas recientes respondieron 403.

El ranking público de participantes muestra solo datos de la clasificación oficial:
rango, RR y victorias, cuando existen. La posición mostrada es local al torneo,
ordenada por rango y RR del mismo acto, con empates compartidos. Los jugadores
sin rango disponible no reciben posición. Respeta identidades anónimas y
no consulta cuentas ni partidas. Recorre las páginas del acto activo hasta completar
la clasificación o encontrar un fallo; informa de cobertura parcial. Mantiene una
caché en memoria de diez minutos compartida únicamente para la clasificación EU,
sin plantillas, e indica fecha y datos anteriores si la actualización falla. La
caché se pierde al reiniciar. No aparecer en la tabla nunca significa sin rango.
La clave debe configurarse en el entorno; no se ha guardado la proporcionada en el chat.
Los historiales y perfiles personales siguen ocultos. La consulta privada normal
tampoco solicita historial ni detalle; el diagnóstico explícito sigue disponible.

Referencias oficiales:
- [API, endpoints, RSO y políticas de Valorant](https://developer.riotgames.com/docs/valorant)
- [Claves y portal de Riot](https://developer.riotgames.com/docs/portal)

## Entorno local de pruebas de ranking

`npm run dev:valorant-sandbox` levanta Next en `http://127.0.0.1:3200` con
SQLite en `.tmp/valorant-sandbox/sandbox.db` y compilación independiente en
`.next-valorant-sandbox`. Conserva los equipos entre reinicios y no usa la base
principal. Crea seis equipos de cinco participantes desde
`scripts/fixtures/valorant-riot-ids.json`; son Riot IDs, no PUUIDs. No importa
estadísticas del texto de origen.

Entrar por `/admin/login` con `valorant-pruebas-local`, abrir `/admin/pruebas`
y pegar la clave de desarrollo vigente. La página comprueba contenido y ranking;
la clave solo vive en la memoria del proceso hasta reiniciar. Las rutas de
introducción de clave requieren administrador, origen coincidente y
`VALORANT_SANDBOX=1`, y no están disponibles en producción. El lanzador se enlaza
exclusivamente a loopback. No usar estas credenciales de pruebas en otros entornos.
