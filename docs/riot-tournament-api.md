# Riot Tournament API v5: guía de integración

Última revisión: 7 de septiembre de 2026.

Fuentes oficiales:

- [Tournament API — guía de League of Legends](https://developer.riotgames.com/docs/lol#tournament-api)
- [Referencia interactiva de APIs](https://developer.riotgames.com/apis#tournament-v5)
- [Políticas generales](https://developer.riotgames.com/policies/general)
- [Políticas específicas de League of Legends](https://developer.riotgames.com/docs/lol#developer-api-policy)

## Qué resuelve

Tournament API crea partidas personalizadas controladas mediante códigos. Permite registrar un organizador y su callback, crear un torneo, generar códigos con reglas predefinidas, auditar el lobby y recibir el identificador de la partida terminada. Con ese identificador se consultan después las estadísticas completas mediante Match-v5.

No sustituye la gestión del torneo: inscripciones, equipos, cuadro, horarios, incidencias, resultados administrativos y avance de rondas siguen siendo responsabilidad de ESIgg.lol.

## Acceso y entornos

Hay dos familias de endpoints:

| Entorno | Ruta | Uso |
|---|---|---|
| Stub | `/lol/tournament-stub/v5` | Probar provider, tournament, códigos, detalles y lobby sin crear partidas reales |
| Producción | `/lol/tournament/v5` | Códigos válidos, callbacks y consulta de partidas reales |

Ambas usan un host de **plataforma**, por ejemplo `https://euw1.api.riotgames.com`; no el clúster regional `europe.api.riotgames.com` empleado por Match-v5.

La API key se envía exclusivamente desde el servidor en `X-Riot-Token`. El portal publica el stub para pruebas, pero la disponibilidad efectiva depende de los permisos concedidos a la clave: una clave de desarrollo ordinaria puede responder `403 Forbidden` incluso contra `tournament-stub/v5`. El acceso a Tournament API de producción debe ser aprobado para el producto registrado. Un provider queda ligado a la API key: al regenerar la clave puede ser necesario registrar uno nuevo.

Configuración de ESIgg.lol:

```env
RIOT_API_KEY=RGAPI-...
RIOT_REGION=euw1
TOURNAMENT_API_MODE=stub
```

El modo predeterminado es `stub`. El cambio a producción debe ser explícito:

```env
TOURNAMENT_API_MODE=production
```

## Modelo y flujo

```text
API key + región + callback
          │
          ▼
      Provider ID
          │
          ▼
     Tournament ID
          │
          ▼
Tournament code (uno por partida)
          │
          ├── eventos de lobby
          ├── callback al terminar
          └── games/by-code → gameId → Match-v5
```

Flujo recomendado en ESIgg.lol:

1. Registrar un provider poco antes del evento con el callback público de la aplicación.
2. Crear el tournament como máximo aproximadamente una semana antes del primer partido.
3. Generar al menos un código para mantener activo el tournament.
4. Generar el resto bajo demanda, idealmente un código por partida real de cada serie.
5. Incluir en `metadata` el identificador interno del partido y un token aleatorio.
6. Entregar el código a los participantes.
7. Usar lobby events únicamente para auditoría, nunca para avanzar el cuadro o declarar derrotas automáticamente.
8. Al recibir el callback, validar código y `metadata`, guardar `gameId` de forma idempotente y responder `200` rápidamente.
9. Consultar Match-v5 para obtener estadísticas y someter el resultado al flujo normal de confirmación del torneo.
10. Si el callback no llega en cinco minutos, consultar `games/by-code` en producción como reconciliación.

## Endpoints de Riot

| Método | Ruta | Función | Stub |
|---|---|---|---|
| `POST` | `/providers` | Registra región y callback; devuelve `providerId` | Sí |
| `POST` | `/tournaments` | Crea un tournament; devuelve `tournamentId` | Sí |
| `POST` | `/codes?tournamentId=&count=` | Genera hasta 1000 códigos | Sí |
| `GET` | `/codes/{code}` | Obtiene configuración y vigencia del código | Sí |
| `PUT` | `/codes/{code}` | Actualiza mapa, draft, espectadores o participantes | Solo producción según la referencia actual |
| `GET` | `/lobby-events/by-code/{code}` | Devuelve `eventList` para auditar el lobby | Sí |
| `GET` | `/games/by-code/{code}` | Recupera partidas, PUUID y `gameId`; permite reconciliar callbacks | Solo producción |

### Generación de códigos

Campos relevantes de `TournamentCodeParametersV5`:

| Campo | Valores/uso |
|---|---|
| `mapType` | `SUMMONERS_RIFT`, `HOWLING_ABYSS`, `LEAGUE_CLASSIC` |
| `pickType` | `BLIND_PICK`, `DRAFT_MODE`, `ALL_RANDOM`, `TOURNAMENT_DRAFT` |
| `spectatorType` | `NONE`, `LOBBYONLY`, `ALL` |
| `teamSize` | Entero de 1 a 5 |
| `allowedParticipants` | PUUID cifrados admitidos; Riot valida el conjunto agregado, no cada equipo |
| `enoughPlayers` | Comprueba si hay suficientes participantes para formar los equipos completos |
| `metadata` | Cadena arbitraria que vuelve en callback y consultas; debe identificar y autenticar la asociación interna |

Configuración prevista para el torneo: `SUMMONERS_RIFT`, `TOURNAMENT_DRAFT`, espectadores `ALL`, equipos de cinco y un código distinto por game de la serie.

## Callback

Riot hace `POST` a la URL registrada cuando termina una partida. Payload representativo:

```json
{
  "startTime": 1234567890000,
  "shortCode": "EUW...",
  "metaData": "{\"matchId\":\"match-1\",\"callbackToken\":\"...\"}",
  "gameId": 1234567890,
  "gameName": "...",
  "gameType": "Practice",
  "gameMap": 11,
  "gameMode": "CLASSIC",
  "region": "EUW"
}
```

Riot reintenta si no recibe `200`. Si no llega nada en cinco minutos, se considera fallido y se debe reconciliar mediante `games/by-code`.

Restricciones heredadas del callback de Riot:

- Solo puertos estándar: HTTP 80 o HTTPS 443.
- El certificado TLS debe ser reconocido por la infraestructura de Riot.
- Algunos gTLD nuevos no están admitidos; `.com`, `.net`, `.org`, `.info` y TLD de país como `.es` sí aparecen en la lista oficial.
- Cambiar la URL exige crear un provider nuevo; los tournaments anteriores siguen apuntando al callback antiguo.

El callback no aporta una firma criptográfica propia documentada. Por eso ESIgg.lol genera un token impredecible por partido, lo incluye en `metadata` al crear los códigos y exige que regrese junto al `matchId`. Nunca se debe confiar solo en un `shortCode` recibido por un endpoint público.

## Lobby events

La respuesta tiene forma `{ "eventList": [...] }`. Cada evento contiene `timestamp`, `eventType` y, cuando corresponde, el PUUID cifrado del jugador. Entre los eventos documentados están creación de lobby, entrada, cambio de equipo, salida, inicio de selección de campeón, asignación y comienzo de partida.

Riot advierte que excepcionalmente pueden perderse eventos. Se muestran como ayuda de auditoría al administrador, pero no son fuente autoritativa para descalificar equipos ni actualizar rondas.

## Fiabilidad y seguridad

- Respetar `429` y `Retry-After`; aplicar backoff a lecturas fallidas.
- No reintentar automáticamente mutaciones que puedan duplicar providers, tournaments o códigos.
- Tratar el callback de forma idempotente: un `gameId` ya guardado no se vuelve a insertar.
- Mantener la API key solo en backend y siempre usar HTTPS.
- No registrar claves, tokens de callback ni payloads sensibles completos.
- Generar códigos cuando se necesiten. Riot puede purgar códigos inactivos y los códigos son elegibles para expirar a los tres meses.
- Crear un único match por código. Reutilizarlo puede impedir que el callback devuelva correctamente todas las estadísticas.
- No usar lobby events como automatismo decisorio.

## Estado de implementación en ESIgg.lol

| Pieza | Ubicación | Estado |
|---|---|---|
| Cliente Riot Tournament v5/stub | `lib/tournament.ts` | Implementado y seleccionable por entorno |
| Registro provider/tournament | `POST /api/admin/tournament` | Implementado, protegido como admin |
| Generación de códigos por partido/BO | `POST /api/admin/partidos/codes` | Implementado con metadata autenticada |
| Consulta de lobby | `GET /api/admin/partidos/lobby?code=...` | Implementado, protegido como admin |
| Callback | `POST /api/tournament/callback` | Implementado, idempotente y validado por metadata |
| Notificación en vivo al panel | `GET /api/admin/riot-events` | Implementado mediante SSE |
| Recuperación `games/by-code` | Cliente en `lib/tournament.ts` | Preparado para el modo producción |
| Match-v5 y estadísticas | Servicios Riot existentes | Implementados; falta automatizar la reconciliación completa |

## Plan de prueba

### Con stub

1. Configurar una API key de desarrollo y `TOURNAMENT_API_MODE=stub`.
2. Registrar provider y tournament desde administración.
3. Generar códigos para un partido y consultar cada código.
4. Consultar lobby events y verificar el contrato `{ eventList }`.
5. Simular el callback con un payload que reutilice exactamente el `metadata` del código.
6. Confirmar idempotencia enviando dos veces el mismo `gameId`.
7. Confirmar que metadata incorrecta no modifica el partido.

El stub no crea partidas reales ni dispara callbacks reales, y no ofrece `games/by-code`; esas dos partes se simulan localmente.

Los códigos creados por versiones anteriores de ESIgg.lol no contienen el token de callback. El backend los reemplaza la próxima vez que se solicita generar códigos para ese partido, aunque Riot todavía los considere activos.

### Con acceso de producción

1. Registrar un provider nuevo con dominio y certificado definitivos.
2. Crear un tournament de prueba cercano a la fecha.
3. Generar un solo código y jugar una personalizada completa.
4. Verificar callback, SSE, persistencia de `gameId` y consulta Match-v5.
5. Probar reconciliación mediante `games/by-code`.
6. Revisar límites y métricas antes de generar códigos del evento real.

## Políticas que afectan al proyecto

El producto debe registrarse y mantenerse actualizado en el Developer Portal. La clave de producción es de un solo producto y no puede distribuirse. Riot exige que los torneos no incluyan apuestas, tengan condiciones transparentes y, según la política publicada, al menos 20 participantes; si existen cuotas de entrada, al menos el 70% debe destinarse a premios. También deben revisarse las reglas regionales europeas antes del evento.
