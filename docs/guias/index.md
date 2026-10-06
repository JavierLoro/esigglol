---
layout: default
---

# Guías de uso de ESIgg.lol

Organiza el torneo y gestiona tu equipo paso a paso. Este manual cubre
League of Legends y Valorant; las opciones disponibles dependen del juego
y de la edición seleccionada.

**Elige tu guía:** [Admin global](#admin-global) · [Admin de equipo](#admin-equipo).

## Índice

* Contenido
{:toc}

## Antes de empezar

La aplicación está en [esigglol.jlc-dev.me](https://esigglol.jlc-dev.me).
Las rutas de este manual corresponden a esa aplicación. Las guías se pueden
consultar sin iniciar sesión.

| Operación | Admin global | Admin de equipo |
| --- | --- | --- |
| Crear, publicar, archivar y eliminar torneos | Sí | No |
| Gestionar equipos, fases y resultados | Sí | No |
| Generar o desactivar accesos de equipos | Sí | No |
| Modificar roles de su plantilla | Sí | Sí, se aplica al momento |
| Cambiar titular/suplente en Valorant | Sí | Sí, se aplica al momento |
| Fijar fecha de un partido pendiente publicado | Sí | Sí, si participa su equipo |
| Cambiar logo, Riot ID o incorporar jugadores | Directamente | Mediante solicitud |
| Aprobar o rechazar solicitudes | Sí | No |
| Configurar la emisión y la apariencia | Sí | No |

## Guía del admin global
{: #admin-global}

### 1. Entrar y seleccionar la edición

1. Abre [Acceso de administración](https://esigglol.jlc-dev.me/admin/login).
2. Introduce la contraseña de administración facilitada por la organización.
3. En las pantallas del torneo, revisa **Edición activa**: nombre, juego y estado.
4. Selecciona la edición que quieres gestionar antes de modificar datos.

**Torneos** y **Apariencia** son pantallas globales. **Dashboard**, **Equipos**,
**Solicitudes**, **Fases**, **Partidos** y **Emisión / OBS** trabajan con la
edición seleccionada. En móvil están disponibles en el menú inferior.

> Un torneo archivado se consulta en modo lectura. Para editarlo, entra en
> **Torneos** y pulsa **Reabrir torneo**.

### 2. Crear y publicar un torneo

1. En **Torneos**, escribe un nombre y elige LoL o Valorant.
2. Pulsa **Crear borrador**. Los torneos se crean para PC y Europa.
3. Abre **Gestionar participantes** para preparar sus equipos.
4. Configura las fases y comprueba los emparejamientos antes de anunciarlos.
5. En **Torneos**, selecciona **Publicado / reabrir** y pulsa **Guardar**.
6. Comprueba la edición en la web pública.

El estado del torneo y la confirmación de los cuadros controlan su publicación.
Al finalizar la competición, usa **Archivar torneo** para conservar la edición
y bloquear su edición.

Para borrar una edición definitivamente, en **Torneos** pulsa **Eliminar torneo**
en su ficha y revisa el nombre del aviso antes de confirmar. Puedes cancelar
para conservarla. Esta opción solo está disponible para el admin global y
funciona con torneos en borrador, publicados o archivados.

La eliminación no se puede deshacer: borra sus equipos, accesos, solicitudes,
fases, partidos, estadísticas y configuración de emisión. Los demás torneos
se conservan. Si quieres mantener los datos, usa **Archivar torneo**.

### 3. Preparar equipos y jugadores

1. En **Equipos**, pulsa el botón para añadir un equipo.
2. Despliega su ficha y completa el nombre, el logo y la plantilla.
3. Introduce cada Riot ID con el formato `Nick#TAG` y asigna sus roles.
4. En Valorant, indica también si el jugador es titular o suplente.
5. Guarda los cambios y espera la confirmación de guardado.

Para cambiar el logo de un equipo guardado, pulsa **Subir logo** y espera
**Logo guardado**. Después puedes guardar los demás cambios o eliminar el
equipo sin recargar la página. Mientras se sube el archivo, esas acciones
permanecen desactivadas. Solo se pueden eliminar equipos sin referencias
en fases o partidos.

Comprueba los datos antes de crear fases. Si aparece un error de validación,
corrige el campo indicado; una ficha visible en el formulario no garantiza
que ya esté guardada.

### 4. Entregar y mantener los accesos de equipo

1. En la ficha guardada del equipo, pulsa **Gestionar acceso**.
2. Si todavía no tiene acceso, pulsa **Generar acceso**.
3. Usa **Copiar credenciales** para obtener la invitación con equipo,
   contraseña y enlace de acceso a su edición.
4. Entrega esa invitación al responsable del equipo por un canal privado.
5. Si el navegador impide copiar, selecciona los datos del cuadro de copia manual.

**Regenerar contraseña** invalida la anterior. El control **Acceso activo**
permite desactivar el acceso. Revisa el último acceso si necesitas comprobar
si el responsable ya ha entrado.

> No incluyas invitaciones, contraseñas ni claves reales en este manual público.

### 5. Configurar fases y publicar cruces

1. En **Fases**, añade una fase, escribe su nombre y elige el formato.
2. Configura los participantes y el mejor de la serie (BO).
3. Guarda la fase o usa su control de generación, que guarda la configuración
   antes de generar los partidos.
4. Revisa los equipos y cruces en **Partidos**.
5. Confirma la ronda o el cuadro cuando el formato lo requiera.

| Formato | Uso | Publicación de cruces |
| --- | --- | --- |
| Grupos | Todos contra todos dentro de cada grupo | No requiere confirmar el cuadro |
| Suizo | Rondas por balance de victorias y derrotas | Confirmar cada ronda tras revisarla |
| Eliminación directa | El perdedor queda eliminado | Confirmar el cuadro |
| Final Four | Cuatro equipos, semifinales y final; tercer puesto opcional | Confirmar el cuadro |
| Upper / Lower | Doble eliminación y gran final única | Confirmar el cuadro |

En suizo, termina los resultados de una ronda antes de generar la siguiente
y confirma las rondas en orden. Los huecos **TBD** de futuras rondas se completan
al registrar los resultados anteriores. El reparto Upper / Lower permite que
algunos equipos comiencen en Lower; estos parten como si ya tuvieran una derrota.

> Eliminar una fase también elimina sus partidos asociados. Lee la confirmación
> antes de aceptar.

### 6. Gestionar horarios y resultados

1. Abre **Partidos** y localiza la fase y la ronda.
2. Revisa los equipos, el horario y el BO antes de editar.
3. Actualiza la fecha o el marcador y guarda los cambios.
4. Para una victoria directa, usa el control **Ganador** del equipo correspondiente.
5. Comprueba el resultado y los cruces siguientes en la web pública.

Un marcador parcial refleja el progreso; alcanzar las victorias necesarias
determina el ganador. El control **Ganador** establece el marcador necesario
para ganar la serie. Al corregir un resultado, revisa los cruces dependientes,
porque la aplicación recalcula la progresión.

Los responsables de los dos equipos pueden cambiar la fecha de sus partidos
pendientes publicados. Acuerda quién guardará el horario para evitar cambios
simultáneos. Las horas se muestran en la zona local del navegador.

### 7. Revisar solicitudes

1. Abre **Solicitudes** con la edición correcta seleccionada.
2. Localiza las solicitudes **Pendientes** y revisa el equipo y el cambio.
3. Comprueba el logo propuesto, el Riot ID o los datos del nuevo jugador.
4. Pulsa **Aprobar** para aplicar el cambio o **Rechazar** para descartarlo.
5. Al rechazar, puedes indicar el motivo para que el equipo lo consulte.

Una solicitud aprobada actualiza los datos del equipo. Las solicitudes de
una edición archivada requieren reabrir el torneo para resolverlas.

### 8. Preparar la emisión y las integraciones

En **Emisión / OBS**, selecciona el partido de emisión y la fase, ronda o grupo
que quieres mostrar. Ajusta la página y la visibilidad del contenido, guarda
la configuración y comprueba la vista en OBS antes del directo.

**Apariencia** permite ajustar la identidad visual del sitio. Al ser una
pantalla global, comprueba el efecto en las distintas ediciones.

Para LoL, el panel ofrece configuración de la Riot API key y de Tournament API.
Los códigos de partidas reales requieren acceso de producción autorizado por
Riot y una configuración compatible. Consulta la
[guía técnica de Tournament API](https://github.com/JavierLoro/esigglol/blob/main/docs/riot-tournament-api.md)
con la persona responsable de la instalación si los códigos son de prueba
o la integración no está disponible.

## Guía del admin de equipo
{: #admin-equipo}

### 1. Entrar en el equipo correcto

1. Pide a la organización la invitación de tu equipo y edición.
2. Abre su enlace de acceso. Si entras desde
   [Acceso de equipos](https://esigglol.jlc-dev.me/equipo/login), comprueba que
   aparece el equipo de la edición correcta; usa la invitación si no lo encuentras.
3. Selecciona el equipo, introduce la contraseña y pulsa **Entrar al panel**.
4. Confirma el nombre del equipo y la plantilla antes de cambiar datos.

El acceso de equipo es independiente del acceso del admin global. Si la
contraseña deja de funcionar, pide a la organización que revise el acceso
o que te envíe una nueva invitación.

### 2. Actualizar roles y plantilla

1. En **Plantilla**, localiza al jugador.
2. Selecciona su rol principal y, si corresponde, su rol secundario.
3. Usa **Sin segundo rol** para quitar el rol secundario.
4. En Valorant, elige **Titular** o **Suplente** cuando necesites cambiar su condición.
5. Comprueba el aviso **Rol actualizado**.

Estos cambios se aplican al momento, sin aprobación de la organización.
En LoL, el rol principal incluye la opción **Suplente**. En Valorant, la
condición de titular o suplente se gestiona por separado del rol.

### 3. Acordar la fecha de un partido

1. En **Partidos pendientes**, comprueba el rival, la fase y la ronda.
2. Acuerda la fecha y la hora con el responsable del otro equipo.
3. Elige el horario y pulsa **Guardar fecha**.
4. Comprueba el aviso **Fecha del partido guardada**.
5. Usa **Actualizar partidos** para consultar los últimos cambios.

La fecha se aplica al momento y cualquiera de los dos equipos puede cambiarla.
Las horas se muestran en la zona local de cada navegador. El panel solo lista
partidos publicados de tu equipo sin resultado ni ganador, en un torneo publicado.
Los equipos no pueden registrar resultados desde este panel.

### 4. Solicitar cambios a la organización

| Cambio | Cómo enviarlo | Qué ocurre después |
| --- | --- | --- |
| Logo del equipo | Pulsa **Solicitar logo** y elige un PNG, JPEG o WebP | La organización revisa el archivo |
| Riot ID de un jugador | Pulsa su nombre, escribe el nuevo `Nick#TAG` y envía la solicitud | Se conserva el nombre actual hasta su aprobación |
| Nuevo jugador | Pulsa **Solicitar jugador**, completa Riot ID y roles y envía | Se incorpora a la plantilla al aprobarse |

En Valorant, al solicitar un jugador indica también si es titular o suplente.
Espera el aviso de envío y consulta la sección **Solicitudes**. No vuelvas
a enviar el mismo cambio mientras haya una solicitud pendiente de ese tipo
para el mismo jugador; solo puede haber una alta de jugador pendiente a la vez.

### 5. Consultar el estado y cerrar sesión

**Pendiente** significa que la organización todavía debe revisar el cambio.
**Aprobada** significa que ya se ha aplicado. **Rechazada** significa que no se
ha aplicado; si la organización añadió un motivo, aparecerá junto a la solicitud.
Recarga el panel para consultar el estado más reciente.

Pulsa **Cerrar sesión** cuando termines, especialmente en un ordenador compartido.

## Resolver problemas

| Situación | Qué hacer |
| --- | --- |
| Un cambio avisa de que el equipo o partido cambió en otra sesión | Actualiza la lista o recarga el panel, revisa los datos y vuelve a guardar |
| No aparecen equipos al iniciar sesión | Abre la invitación de tu edición; si falla, consulta con la organización |
| No aparecen partidos pendientes | Pide al admin global que revise el estado del torneo, la confirmación de los cruces y los resultados |
| No se puede editar una edición | Comprueba si está archivada; el admin global puede reabrirla |
| El logo, Riot ID o jugador todavía no cambia | Comprueba si la solicitud sigue pendiente o fue rechazada |
| Aparece un error al guardar o se pierde la conexión | Recarga para comprobar qué quedó guardado antes de repetir el cambio |
| Una contraseña deja de funcionar | Pide al admin global que revise si fue regenerada o si el acceso se desactivó |

Para pedir ayuda, indica la edición, el equipo, la pantalla y el mensaje de error.
No envíes contraseñas ni claves en capturas o incidencias públicas.
