# Cambios de datos durante la auditoría

| Momento | Entidad | Acción | Identificador / nombre | Estado de reversión |
|---|---|---|---|---|
| Inicio | — | Ninguno | Línea base existente intacta | N/A |
| Bloque equipos | Equipo | Alta | `QA Luna & Co` con 3 jugadores (`Luna Top`, `Luna Jungle`, `Luna Sub`) | Persistente; conservar para trazabilidad |
| Bloque equipos | Equipo | Intento de alta rechazado | `Freakpay` duplicado | No persistió tras recarga; tarjeta optimista temporal |

| Bloque fases | Fase | Alta + generación | `QA Grupos Luna`, 2 grupos de 4 | Persistente; generó 1 partido pendiente |
| Bloque fases | Fase | Alta + generación + confirmación | `QA Eliminacion Luna`, 4 equipos | Persistente; generó 2 semifinales; una recibió resultado 1–0 |
| Bloque partidos | Partido | Edición | Código `BADCODE` en partido QA | No persistió tras recarga; sin error visible |
| Bloque fases | Fase | Alta + generación + confirmación | `QA UpperLower Luna`, 4 equipos | Persistente; generó 2 semifinales, sin lower bracket visible |
| Bloque fases | Fase | Alta + generación + confirmación | `QA FinalFour Luna`, 4 equipos, tercer puesto activado | Persistente; generó 2 semifinales; no progresó tras dos resultados |
| Bloque dashboard | Configuración | Intento de registro | `QA Luna Tournament` en Tournament API STUB | Rechazado con `Error de conexión`; sigue sin configurar |
| Bloque equipos | Alta incidental | Registro vacío `Nuevo equipo` | Persistente tras el flujo de alta fallido | No eliminado; borrado bloqueado por confirmación inmediata |

Se documentará cada alta, edición o eliminación intencionada. No se registran secretos ni valores completos de API keys.
