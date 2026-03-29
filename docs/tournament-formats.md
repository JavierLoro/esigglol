# Formatos de torneo — ESIgg.lol

ESIgg.lol soporta 5 tipos de fase (`PhaseType`). Cada fase tiene su propia colección de partidos en la tabla `matches`.

---

## 1. `groups` — Fase de grupos

Todos los equipos dentro de cada grupo se enfrentan entre sí (round-robin).

### Configuración relevante

| Campo | Tipo | Descripción |
|---|---|---|
| `groups` | `GroupConfig[]` | Definición de grupos con sus `teamIds` |
| `bo` | `1\|2\|3\|5` | BO por defecto para todos los partidos |
| `advanceCount` | `number` | Equipos que pasan de cada grupo |

### Convención de `round`

Cada partido tiene `round = 1`. No hay rondas múltiples; todos los partidos son simultáneos.

### Generación

`POST /api/admin/fases/generate` crea un partido por cada par de equipos dentro de cada grupo.

### Visibilidad pública

Los grupos y partidos son visibles inmediatamente (no hay confirmación necesaria).

---

## 2. `swiss` — Sistema suizo

Emparejamiento W-L: cada ronda enfrenta equipos con el mismo registro de victorias/derrotas.

### Configuración relevante

| Campo | Tipo | Descripción |
|---|---|---|
| `swissTeamIds` | `string[]` | Pool de equipos en el suizo |
| `swissSize` | `8\|16` | Tamaño del cuadro |
| `rounds` | `number` | Número máximo de rondas |
| `advanceWins` | `number` | Victorias para clasificarse |
| `eliminateLosses` | `number` | Derrotas para eliminarse |
| `roundBo` | `Record<string, 1\|2\|3\|5>` | BO por ronda específica (clave = string del número de ronda) |
| `confirmedRounds` | `number[]` | Rondas visibles al público |
| `bo` | `1\|2\|3\|5` | BO por defecto (si una ronda no está en `roundBo`) |

### Convención de `round`

Cada ronda suiza se numera `1, 2, 3, ...`. Los partidos de la ronda N tienen `round = N`.

### Flujo de administración

1. Admin genera la ronda siguiente: `POST /api/admin/fases/generate`
2. Los partidos de la nueva ronda son visibles **solo para el admin** hasta ser confirmados.
3. Admin revisa los emparejamientos y confirma: añade el número de ronda a `confirmedRounds`.
4. La ronda confirmada pasa a ser visible para el público.

### Visibilidad pública

Solo las rondas en `confirmedRounds` son visibles. Rondas no confirmadas están ocultas al público.

---

## 3. `elimination` — Eliminación directa

Bracket de eliminación simple. Los perdedores quedan fuera; el ganador avanza a la siguiente ronda.

### Configuración relevante

| Campo | Tipo | Descripción |
|---|---|---|
| `bracketTeamIds` | `string[]` | Equipos en el bracket (potencia de 2: 2, 4, 8, 16...) |
| `bo` | `1\|2\|3\|5` | BO para todos los partidos |
| `confirmedBracket` | `boolean` | Bracket visible al público |

### Convención de `round`

Rondas positivas ascendentes:
- `round = 1` → primera ronda (más equipos)
- `round = 2` → segunda ronda
- …
- `round = N` → final (2 equipos)

Ejemplo con 8 equipos: rounds 1 (×4), 2 (×2), 3 (×1)

### Slots TBD

Los partidos se generan desde el inicio con `team1Id = 'TBD'` y `team2Id = 'TBD'` para las rondas futuras. `advanceWinner()` en `lib/bracket.ts` rellena los slots al reportar resultados.

### Visibilidad pública

El bracket es público solo si `confirmedBracket = true`.

---

## 4. `final-four` — Final a cuatro

Formato fijo: 2 semifinales + final + partido opcional de 3.º puesto.

### Configuración relevante

| Campo | Tipo | Descripción |
|---|---|---|
| `bracketTeamIds` | `string[]` | Exactamente 4 equipos |
| `bo` | `1\|2\|3\|5` | BO para todos los partidos |
| `include3rdPlace` | `boolean` | Si `true`, genera partido de 3.º puesto |
| `confirmedBracket` | `boolean` | Bracket visible al público |

### Convención de `round`

| `round` | Partido |
|---|---|
| `1` | Semifinal 1 y Semifinal 2 |
| `2` | Final |
| `98` | 3.º puesto (si `include3rdPlace = true`) |

El número `98` es intencional para separar el partido de 3.º puesto del resto del bracket sin interferir con la lógica de `advanceWinner()`.

---

## 5. `upper-lower` — Doble eliminación

Bracket con rama alta (upper) y rama baja (lower). Un equipo necesita dos derrotas para ser eliminado.

### Configuración relevante

| Campo | Tipo | Descripción |
|---|---|---|
| `bracketTeamIds` | `string[]` | 4 u 8 equipos |
| `bo` | `1\|2\|3\|5` | BO para todos los partidos |
| `confirmedBracket` | `boolean` | Bracket visible al público |

### Convención de `round`

- **Valores positivos** → partidos de la rama alta (upper bracket)
- **Valores negativos** → partidos de la rama baja (lower bracket)
- **`round = 99`** → grand final

#### Con 4 equipos

| Round | Descripción |
|---|---|
| `1` (×2) | Upper R1 |
| `2` (×1) | Upper final |
| `-1` (×1) | Lower R1 |
| `-2` (×1) | Lower final |
| `99` (×1) | Grand final |

#### Con 8 equipos

| Round | Descripción |
|---|---|
| `1` (×4) | Upper R1 |
| `2` (×2) | Upper R2 |
| `3` (×1) | Upper final |
| `-1` (×2) | Lower R1 |
| `-2` (×2) | Lower R2 |
| `-3` (×1) | Lower semifinal |
| `-4` (×1) | Lower final |
| `99` (×1) | Grand final |

### Flujo de `advanceWinner`

- Ganador de upper → siguiente ronda de upper
- Perdedor de upper → lower (ronda equivalente)
- Ganador de lower → siguiente ronda de lower
- Perdedor de lower → eliminado
- Ganador de upper final → grand final (team1)
- Ganador de lower final → grand final (team2)

---

## Resumen comparativo

| Formato | Rondas múltiples | Eliminados | Confirmación admin |
|---|---|---|---|
| `groups` | No (todos simultáneos) | Según `advanceCount` | No necesaria |
| `swiss` | Sí (secuenciales) | Según `eliminateLosses` | Sí (por ronda) |
| `elimination` | Sí (automático con TBD) | Tras cada derrota | Sí (bracket completo) |
| `final-four` | Sí (semifinal → final) | Tras cada derrota | Sí (bracket completo) |
| `upper-lower` | Sí (con rama baja) | Tras 2 derrotas | Sí (bracket completo) |
