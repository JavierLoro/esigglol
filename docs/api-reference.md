# API Reference — ESIgg.lol

Base URL: `/api`

---

## Autenticación

Los endpoints marcados con **Auth: sí** requieren la cookie `admin_session` (JWT HttpOnly).
Sin sesión válida devuelven `401 Unauthorized`.

---

## Autenticación de admin

### `POST /api/admin/login`

Crea una sesión de admin.

**Auth:** No
**Body:**
```json
{ "password": "string" }
```
**Respuesta exitosa:** `200 OK`, establece cookie `admin_session` (HttpOnly, SameSite=lax, 12h)
**Errores:**
- `400` — body inválido
- `401` — contraseña incorrecta
- `429` — demasiados intentos (rate limit por IP)

---

### `DELETE /api/admin/login`

Cierra la sesión actual.

**Auth:** No
**Respuesta:** `200 OK`, borra la cookie `admin_session`

---

## Equipos

### `GET /api/admin/equipos`

Lista todos los equipos.

**Auth:** Sí
**Respuesta:** `200 OK` → `Team[]`

---

### `POST /api/admin/equipos`

Crea un nuevo equipo.

**Auth:** Sí
**Body:** objeto `Team` sin `id` (se genera automáticamente)
**Respuesta:** `201 Created` → `Team`

---

### `PUT /api/admin/equipos`

Actualiza un equipo existente.

**Auth:** Sí
**Body:** objeto `Team` completo (incluye `id`)
**Respuesta:** `200 OK` → `Team`
**Errores:** `404` si el equipo no existe

---

### `DELETE /api/admin/equipos`

Elimina un equipo.

**Auth:** Sí
**Body:** `{ "id": "team-..." }`
**Respuesta:** `200 OK`

---

### `POST /api/admin/equipos/upload-logo`

Sube una imagen de logo para un equipo.

**Auth:** Sí
**Body:** `multipart/form-data` con campo `file` (imagen)
**Respuesta:** `200 OK` → `{ "path": "/uploads/<filename>" }`

---

## Fases

### `GET /api/admin/fases`

Lista todas las fases.

**Auth:** Sí
**Respuesta:** `200 OK` → `Phase[]`

---

### `POST /api/admin/fases`

Crea una nueva fase.

**Auth:** Sí
**Body:** objeto `Phase` sin `id`
**Respuesta:** `201 Created` → `Phase`

---

### `PUT /api/admin/fases`

Actualiza una fase existente.

**Auth:** Sí
**Body:** objeto `Phase` completo
**Respuesta:** `200 OK` → `Phase`

---

### `DELETE /api/admin/fases`

Elimina una fase y todos sus partidos.

**Auth:** Sí
**Body:** `{ "id": "phase-..." }`
**Respuesta:** `200 OK`

---

### `POST /api/admin/fases/generate`

Genera los partidos de una fase (bracket/rondas).

**Auth:** Sí
**Body:** `{ "phaseId": "phase-..." }`
**Respuesta:** `200 OK` → `Match[]` (los partidos generados)
**Lógica:** varía por tipo de fase (grupos, suizo, eliminación, etc.)

---

## Partidos

### `GET /api/admin/partidos`

Lista todos los partidos (opcionalmente filtrado por fase).

**Auth:** Sí
**Query:** `?phaseId=phase-...` (opcional)
**Respuesta:** `200 OK` → `Match[]`

---

### `POST /api/admin/partidos`

Crea un partido manualmente.

**Auth:** Sí
**Body:** objeto `Match` sin `id`
**Respuesta:** `201 Created` → `Match`

---

### `PUT /api/admin/partidos`

Actualiza un partido (resultados, datos de juego, etc.).

**Auth:** Sí
**Body:** objeto `Match` completo
**Respuesta:** `200 OK` → `Match`
**Efecto secundario:** llama a `advanceWinner()` si el partido tiene resultado

---

### `DELETE /api/admin/partidos`

Elimina uno o varios partidos.

**Auth:** Sí
**Body:** `{ "ids": ["match-..."] }`
**Respuesta:** `200 OK`

---

### `POST /api/admin/partidos/codes`

Genera tournament codes de Riot para un partido.

**Auth:** Sí
**Body:** `{ "matchId": "match-...", "count": number }`
**Respuesta:** `200 OK` → `{ "codes": string[] }`
**Requiere:** Tournament API configurada en el dashboard

---

### `GET /api/admin/partidos/lobby`

Consulta los eventos de lobby de los tournament codes de un partido.

**Auth:** Sí
**Query:** `?matchId=match-...`
**Respuesta:** `200 OK` → `{ "events": LobbyEvent[] }`

---

### `POST /api/admin/partidos/parse-screenshot`

Parsea un screenshot de fin de partida usando Claude Vision.

**Auth:** Sí
**Body:** `multipart/form-data` con campo `file` (imagen PNG/JPG) y `matchId`
**Respuesta:** `200 OK` → `GameData`
**Requiere:** `ANTHROPIC_API_KEY` configurada

---

## Settings

### `GET /api/admin/settings`

Devuelve la configuración actual (API key de Riot enmascarada).

**Auth:** Sí
**Respuesta:** `200 OK` → `{ "riotApiKey": "RGAPI-****-...-****" }`

---

### `PUT /api/admin/settings`

Actualiza la API key de Riot en runtime (persiste en DB).

**Auth:** Sí
**Body:** `{ "riotApiKey": "RGAPI-..." }`
**Respuesta:** `200 OK`

---

## Tournament API

### `POST /api/admin/tournament`

Registra un provider y tournament en la Riot Tournament API.

**Auth:** Sí
**Body:** `{ "callbackUrl": "https://...", "tournamentName": "..." }`
**Respuesta:** `200 OK` → `{ "providerId": number; "tournamentId": number }`

---

### `POST /api/tournament/callback`

Webhook receptor de eventos de Riot Tournament API.

**Auth:** No (Riot llama directamente)
**Body:** evento de Riot (JSON)
**Respuesta:** `200 OK`

---

## Datos públicos

### `GET /api/data/equipos`

Lista todos los equipos (lectura pública).

**Auth:** No
**Respuesta:** `200 OK` → `Team[]`
**Cache:** `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`

---

### `GET /api/data/fases`

Lista fases y partidos (lectura pública, filtra rondas/brackets no confirmados).

**Auth:** No
**Respuesta:** `200 OK` → `{ phases: Phase[]; matches: Match[] }`
**Cache:** `Cache-Control: public, s-maxage=30, stale-while-revalidate=120`

---

## Riot API proxy

### `GET /api/riot/summoner`

Stats de un jugador.

**Auth:** No
**Query:** `?name=Nick%23TAG`
**Respuesta:** `200 OK` → `PlayerStats`

---

### `GET /api/riot/matches`

Detalles de una partida de Riot.

**Auth:** No
**Query:** `?id=EUW1_7123456789`
**Respuesta:** `200 OK` → objeto de partida Riot (raw)

---

### `POST /api/riot/refresh-stats`

Lanza un refresh en background de las stats de todos los jugadores.

**Auth:** No
**Respuesta:** `200 OK` → `{ "started": true }` o `{ "alreadyRunning": true }`

---

### `GET /api/riot/refresh-stats`

Consulta el estado del refresh en curso.

**Auth:** No
**Respuesta:** `200 OK` → `{ "isRunning": boolean; "progress": number; "total": number; "lastUpdated": string | null }`

---

## Archivos

### `GET /api/uploads/[filename]`

Sirve archivos subidos (logos de equipos).

**Auth:** No
**Respuesta:** archivo con `Content-Type` apropiado

---

## Observabilidad

### `GET /api/health`

Health check.

**Auth:** No
**Respuesta:** `200 OK` → `{ "status": "ok" }`

---

### `GET /api/metrics`

Métricas Prometheus.

**Auth:** No
**Respuesta:** `200 OK`, formato text/plain Prometheus
