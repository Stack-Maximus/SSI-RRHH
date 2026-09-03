# Cambios de esta entrega

Este zip es el proyecto completo, con la misma estructura que ya tenías. Abajo,
solo lo que cambió.

## Cómo aplicarlo

1. Descomprime encima de `C:\Proyectos\SGC-Metalium` reemplazando los archivos.
   El zip **no** incluye `node_modules`, `dist` ni tu `.env`.
2. Corre en el SQL Editor de Supabase, en este orden:
   - `database/migracion_ficha_trabajador.sql` *(opcional — ver más abajo)*
   - `database/migracion_eva_flujo_bienestar.sql` **(obligatoria)**
   - `database/migracion_prov_gol_cartas.sql` **(obligatoria si usas Proveedores)**
   - `database/migracion_eva_motor_pdi.sql` **(obligatoria — nueva)**
   - `database/migracion_eva_acta_v2.sql` **(obligatoria — nueva)**
   - `database/migracion_eva_motor_secciones.sql` **(obligatoria — nueva)**
   - `database/migracion_eva_fortalezas.sql` **(obligatoria — nueva)**
   - `database/migracion_eva_filtro_cargo.sql` **(obligatoria)**
   - `database/migracion_eva_cargos_no_evaluables.sql` **(obligatoria — nueva)**
   - `database/parche_guardias_nulas.sql` **(obligatoria — nueva, es de seguridad: ver punto 13)**
   - `database/migracion_eva_expediente_trabajador.sql` **(obligatoria — nueva)**
   - `database/migracion_eva_maestro_ciclo.sql` **(obligatoria — nueva)**
3. **Vuelve a desplegar la Edge Function `send-email`**:
   `supabase functions deploy send-email --no-verify-jwt`. Se le agregaron parámetros
   opcionales; sin esto las cartas a proveedores salen con el pie de «no responder
   este correo», que contradice el propio texto de la carta.
4. `npm run dev`. No hay dependencias nuevas: `package.json` no cambió.

Para comprobar que las migraciones quedaron completas:
`database/verificar_migracion_flujo.sql` — devuelve OK o «>>> FALTA» por objeto.

---

# 1. Nuevo flujo de cierre de la Evaluación de Personal

## El orden cambió

Antes, al recibir el resultado el trabajador veía los puntajes y respondía
«¿estás conforme?» en el mismo formulario — sin haber conversado nunca con su
jefatura. Ahora la conversación va en medio:

```
consolidada
  → entregada_trabajador    RRHH entrega el resultado
  → resultados_aceptados    el trabajador ve sus puntajes y confirma recepción
  → reunion_agendada        la jefatura fija la 1:1 (≥5 días hábiles)
  → reunion_realizada       la 1:1 ya ocurrió
  → reflexiones_enviadas    RECIÉN AHORA responde las 4 preguntas + conformidad
  → pendiente_firmas        la jefatura define el plan de acción
  → cerrada_conforme | cerrada_disconformidad   con la tercera firma del acta
```

Los estados viejos se conservan todos: **ninguna evaluación ya cerrada cambia**
por esta migración.

## El «confirmo que recibí» NO es conformidad

Es deliberado y está escrito en la pantalla. Si confirmar fuera aceptar, la
reunión no serviría para nada: ya estaría decidido. Coincide con la declaración
literal de la Hoja 7 de tu planilla: *«Mi firma no implica necesariamente acuerdo
con la calificación; implica que se me comunicaron los resultados»*.

## Reunión 1:1 con la pauta real

Al agendar se pide fecha, hora, duración, modalidad (Presencial / Videollamada
Teams) y sala o enlace, tal como la Hoja 10. Si faltan menos de 5 días hábiles
avisa, pero **no bloquea** — hay urgencias reales y quien agenda sabe más que el
sistema. Se puede descargar un `.ics` para el calendario de ambos.

## Checklist de la entrevista (Hoja 10) — los 24 ítems

Los tres bloques de la pauta RRHH-INS-EVA-AD-002 quedaron dentro del flujo, cada
uno en su momento:

| Bloque | Ítems | Se llena |
|---|---|---|
| Antes de la reunión | 8 | al agendar la entrevista |
| Durante la reunión | 9 | al marcarla como realizada |
| Después de la reunión | 7 | al definir el plan y cerrar |

Tres respuestas por ítem igual que en la planilla (SÍ / NO / N/A) más
observaciones. Los N/A no cuentan en el denominador; los NO quedan como
pendientes de regularizar. El resumen de cumplimiento («17 de 23») aparece en el
acta. **El evaluado no ve el checklist** — es la pauta de trabajo de su jefatura,
y eso lo garantiza RLS, no la interfaz.

## Planes de acción recomendados

Al terminar las reflexiones, el evaluador ya no redacta desde cero. El sistema
mira la **categoría obtenida** y la **dimensión donde salió más bajo**, y propone
acciones del catálogo `eva_planes_catalogo` (19 acciones sembradas con las
redacciones de la Hoja 6 y los descriptores de la rúbrica de la Hoja 9). Marca
las que apliquen, las edita si quiere, agrega las suyas.

Ejemplo real con el caso de tu planilla (Francisco Aguilera, 2,88, «por debajo»,
más débil en Competencias Funcionales con 1,67): propone las 3 acciones de esa
dimensión primero, y después el PMD obligatorio y la capacitación del plan anual.

Son sugerencias, no imposiciones: se puede guardar un plan enteramente escrito a
mano. Lo que sí se valida es el mínimo de 3 y el máximo de 8 acciones que pide la
planilla.

## Catálogos que salieron de tu Excel, no inventados

- **`eva_rangos`** — los 5 rangos de la Hoja 8 (4,5–5 Excepcional … 1–1,99
  Crítico) con su decisión asociada. Antes estaban clavados dentro de una función
  SQL; ahora es una tabla que RRHH puede editar, y `eva_categoria_y_decision` la
  lee.
- **`eva_recomendaciones`** — las 10 opciones de «ListaRecom» (Continuar en el
  cargo … Desvinculación RRHH-PRO-10). `recomendacion_final` era texto libre;
  ahora es una lista cerrada, así los informes se pueden agrupar.
- **Lectura de la brecha** — los mismos cortes que la fórmula de tu Hoja 5:
  |b| ≥ 1 «discrepancia significativa», ≥ 0,5 «diferencia moderada», si no
  «visiones alineadas».
- **`acuerdo_trabajador`** ahora admite las tres respuestas de la Hoja 7
  («Sí / Parcialmente / No»), no dos como antes.

---

# 2. Acta de cierre firmada (Hoja 7)

El cierre formal necesita **tres firmas**: el trabajador, su supervisor directo y
la Jefatura de RRHH — en ese orden, porque el visto bueno de RRHH va al final.
**Con la tercera firma la evaluación se cierra sola.**

## Cómo se firma

Cada persona entra con su cuenta, lee la declaración textual de su rol, escribe
su nombre y su RUT y confirma. Queda registrado quién estaba autenticado, la
fecha, la hora y **el texto exacto de la declaración vigente en ese momento** —
para que dentro de dos años se sepa qué se firmó, aunque el texto haya cambiado
después.

## Lo que está garantizado en la base, no en la pantalla

Lo verifiqué corriendo la migración contra un Postgres real:

- RRHH **no puede** firmar antes que los otros dos → error explícito.
- Nadie puede firmar en nombre de otro → *«No te corresponde firmar como
  trabajador»*.
- Nadie puede firmar dos veces (unicidad por evaluación y rol).
- Una firma **no se puede modificar ni borrar** — lo impide un trigger. Lo probé
  incluso como superusuario de la base: 3 firmas intactas, 0 alteradas.
- El cierre es atómico con la última firma: no puede quedar una evaluación con
  tres firmas sin cerrar, ni cerrada sin las tres firmas.

## El acta descargable

Con las tres firmas se descarga un HTML autocontenido, listo para imprimir o
guardar como PDF desde el navegador: identificación, resultado, PDI acordado,
declaración del trabajador y las tres firmas con RUT y sello de tiempo. No sumé
una librería de PDF al bundle — el documento es simple y no lo justifica.

---

# 3. Rol «Crecimiento y Bienestar»

Un rol nuevo del módulo Personal: `crecimiento_bienestar`. No evalúa a nadie; se
encarga de que los planes de desarrollo que definió cada jefatura efectivamente
se pongan en marcha.

## Su vista

Está **agrupada por persona**, no como tabla plana: quien hace seguimiento no
piensa en «acciones», piensa en «tengo que llamar a Francisco». Las personas se
ordenan por urgencia — primero quien tiene acciones vencidas.

Cada persona muestra su avance, y cada acción su plazo, su estado de seguimiento
(sin revisar / 1 de 2 controles / 2 de 2) y el botón que corresponde. Arriba, KPIs
de avance, vencidas, las que vencen en 14 días, sin revisar y personas con plan.

## Lo que puede y lo que no

Registra los dos controles de seguimiento y mueve el estado de cada acción.
**No puede reescribir la acción ni agregar nuevas**: el plan lo acordaron el
evaluador y el trabajador en la reunión, y cambiarlo por detrás sería pasar por
encima de ese acuerdo.

No es solo la interfaz. En la base tiene lectura del PDI y escribe únicamente por
la función `eva_pdi_registrar_control`, que solo toca los campos de seguimiento.
Lo probé con el rol real: un `UPDATE` directo sobre el texto de una acción
modifica **0 filas**, un `DELETE` borra **0 filas**, y un `INSERT` es rechazado
por RLS. El evaluador de esa evaluación y RRHH también pueden registrar controles;
un empleado cualquiera, no.

RRHH y el admin tienen un botón «🌱 Seguimiento de planes» para mirar el mismo
panel.

---

# 4. Correo a RRHH al terminar el ciclo

Cuando se cierra la **última** evaluación de un ciclo, un trigger manda el correo
solo y marca el ciclo como cerrado. No depende de que alguien se acuerde de
cerrarlo a mano.

El correo lleva el resumen: cuántas evaluaciones, cuántas conformes, cuántas con
disconformidad, el promedio del ciclo y la distribución por categoría. Va a todos
los `rol='rrhh'` del módulo más los admin.

Lo probé con dos evaluaciones en un ciclo: al cerrar la primera **no** sale nada
(correcto, queda una abierta); al cerrar la segunda sale el correo, el ciclo pasa
a `cerrado`, y un update posterior **no** lo repite.

## Otros avisos que se agregaron

Todos entran por la tabla `notificaciones`, así que heredan gratis el despacho por
correo que ya tenías:

| Cuándo | A quién |
|---|---|
| El trabajador confirma que recibió sus resultados | a su jefatura, para agendar la 1:1 |
| Se agenda la reunión | al trabajador, con fecha, hora, modalidad y enlace |
| Se marca la reunión como realizada | al trabajador, para responder las preguntas de cierre |
| El trabajador envía sus reflexiones | a la jefatura, para definir el plan |
| El plan queda definido | al trabajador y al supervisor, para firmar el acta |
| Firmaron trabajador y supervisor | a RRHH, para el visto bueno |
| Una evaluación cierra con disconformidad | a RRHH — es el ítem C.5 del checklist |

---

---

# 5. Evaluación de Proveedores: GOL reemplaza al comité y la carta se gestiona en el sistema

## El comité ya no existe

Quien revisa el consolidado y comunica el resultado es **GOL directamente**. La
migración pasa a `gol` a cualquier usuario que hoy tenga el rol `comite` en el
módulo — si no se migraran quedarían sin panel, porque de acá en adelante nada
mira ese rol.

GOL ya era una de las 6 áreas evaluadoras, así que ahora hace las dos cosas:
califica su área y además comunica. Para eso se ajustó la política de `prov_detalle`,
que con el rol `gol` lo habría dejado viendo **solo su propia área** — necesita ver
las 6 para revisar el consolidado.

**Sobre el estado `en_comite`**: se conserva el valor tal cual, a propósito. Lo
escribe `intentar_consolidar_proveedor` y puede haber evaluaciones vivas con ese
valor; renombrarlo obligaría a migrar filas y tocar la RPC para un beneficio
puramente cosmético. En pantalla se lee **«Pendiente de comunicar»**.

## Dos cosas que encontré revisando

**«Comunicar al proveedor» no enviaba nada.** Solo cambiaba el estado y ponía la
fecha. No había carta, ni correo, ni registro de qué se le dijo; la columna
`url_carta` estaba en el esquema desde el principio y nunca se llenó.

**`send-email` le ponía a TODOS los correos el pie** *«Notificación automática del
Sistema de Gestión de Calidad. No responder este correo»*. Para un aviso interno
está bien; en una carta formal a un proveedor —sobre todo una D que lo invita
explícitamente a presentar antecedentes en 10 días hábiles— se contradice con el
propio texto. Le agregué parámetros opcionales (`pie`, `responder_a`, `guardar`,
`ancho`), todos con el comportamiento anterior por defecto: los avisos internos
siguen igual, las cartas llevan un pie que indica a quién responder, van con
Reply-To al correo de quien las envía y quedan en Elementos enviados.

## Cómo funciona ahora

GOL abre «Revisar y comunicar» y ve:

1. **El consolidado** — las 6 notas por área con su lectura (bajo el estándar /
   cumple / sobre el estándar), el total, la clasificación, la tendencia respecto
   del período anterior, y el aviso si se aplicó veto por criterio crítico.
2. **La carta ya redactada**, precargada con la plantilla de la clasificación
   obtenida y todos los datos resueltos: proveedor, período, notas por área, total,
   decisión asociada, plazo del plan (10 días hábiles calculados) y fecha de
   reevaluación (90 días).
3. **La edita libremente** en un editor WYSIWYG — lo que ve es lo que va a recibir
   el proveedor. Hay un botón para restaurar la plantilla si se arrepiente.
4. **Ajusta destinatarios y copias.** Se precarga el correo del maestro pero se
   puede corregir y agregar más, incluidos internos en copia. Se envía **un correo
   por destinatario** en vez de uno con todos en copia, así el proveedor no ve las
   direcciones internas expuestas en el encabezado.
5. **Al enviar**, la carta queda registrada en `prov_cartas` con el texto exacto,
   a quién, quién la envió y cuándo. Una carta enviada **no se puede modificar ni
   borrar** (lo impide un trigger): si hay que rectificar, se envía una nueva.

El envío, el cambio de estado y la actualización de la clasificación vigente del
proveedor ocurren en **una sola transacción**. Antes eran dos updates separados
desde el frontend que podían quedar a medias si el segundo fallaba.

## Cuatro plantillas, no una

Una carta de «condicionado con plan de acción a 10 días» y una de «proveedor
preferente» no se parecen en nada. Están en `prov_carta_plantillas`, una por
clasificación (A/B/C/D), editables por GOL desde la base. Las de C y D incluyen la
variante con veto, la consecuencia concreta y —en la D— el derecho a presentar
antecedentes.

Los textos salen de las decisiones asociadas que ya tenías sembradas en
`prov_rangos`, no de invención mía.

## Plan de acción obligatorio para C y D

`prov_planes_accion` existía en el esquema desde el principio pero **nada la usaba**.
Ahora, para condicionado y no aprobado, GOL registra los compromisos, el plazo y la
fecha de reevaluación, y hasta que no lo haga **la evaluación no se puede cerrar**.
La validación está en `prov_cerrar_evaluacion`, no solo en la pantalla, para que no
se pueda cerrar por otra vía una evaluación que quedó sin compromisos.

Además, al comunicar una C o D se avisa al módulo completo: son las clasificaciones
que arrastran trabajo para adquisiciones (visto del Jefe GOL en el caso C, bloqueo
de nuevas OC en el caso D).

## Verificado contra la base

- Un delegado que no es GOL intenta enviar la carta → *«Solo GOL puede comunicar el
  resultado a un proveedor»*.
- Un usuario que era `comite` queda como `gol` después de la migración.
- Se envía a 2 destinatarios + 1 copia → 3 correos despachados, cada uno con
  Reply-To a GOL, guardado en enviados y con el pie formal. Los avisos internos del
  mismo flujo conservan el pie automático.
- La evaluación pasa a `comunicada` y el proveedor queda con su clasificación
  vigente y la fecha.
- Una carta enviada no se puede modificar ni borrar.
- Cerrar una C sin plan → rechazado. Con el plan registrado → cierra.

# 6. Ficha del Trabajador (entrega anterior)

Cada persona tiene una ficha que responde: **¿mejoró o empeoró, y en qué?**

Se abre desde **Trabajadores** (clic en el nombre o «Ver ficha»), desde
**Evaluación de Personal** con «📈 Ver mi evolución» (cada quien la suya), y con
el botón «Ficha» de cada fila del panel de RRHH.

Muestra el veredicto en palabras (regresión sobre todos los ciclos, no el último
salto), KPIs con sparkline, la evolución del total con la autoevaluación
superpuesta, **un panel por dimensión** en la misma escala para poder compararlos,
las brechas del último ciclo en barras divergentes, el historial, el PDI acumulado
y su huella en NC, Postventa y auditorías.

Sin dependencias nuevas: los gráficos son SVG generado a mano en
`src/ui/charts.js`. La paleta pasó por un validador de contraste y daltonismo
contra fondo blanco — los hex de la constante `VIZ` conviene no cambiarlos a ojo.
Todo gráfico trae hover con crosshair, foco de teclado y **una tabla equivalente**:
ningún valor existe solo en el tooltip.

---

# 7. Correcciones incluidas

## `views/trabajadores.js` — import roto al crear un trabajador

Llamaba a `enviarCorreoInvitacion` importándola de `ui/importar-trabajadores.js`,
pero ese módulo nunca la exportó: crear un trabajador reventaba con
*«enviarCorreoInvitacion is not a function»* justo después de crear la cuenta.

Además era redundante: `create-user` ya inserta la notificación de bienvenida y el
trigger la despacha. El correo ya salía solo.

## `supabase/functions/create-user/index.ts` — agregada al repo

El frontend la invocaba pero el repo solo tenía `crear-usuario`, con otro contrato.

## `migracion_eva_flujo_bienestar.sql` — un bug que encontré reintentándola

La primera versión hacía `delete from eva_planes_catalogo` antes de sembrar. Eso
funciona la primera vez, pero en cuanto una acción del PDI referencia un plan del
catálogo, el delete viola la FK y **la migración deja de ser repetible**. Lo cambié
a `on conflict do nothing`, que además respeta las ediciones que RRHH haya hecho
desde la app. Verificado: tres pases seguidos sin error y el PDI intacto.

---

# Archivos

## Nuevos

| Archivo | |
|---|---|
| `database/migracion_eva_flujo_bienestar.sql` | flujo, checklist, acta, catálogos, rol y avisos |
| `database/migracion_prov_gol_cartas.sql` | GOL, plantillas de carta, envío y cierre de Proveedores |
| `database/verificar_migracion_flujo.sql` | comprueba que las migraciones quedaron completas |
| `src/views/proveedores-comunicar.js` | redactar, editar y enviar la carta al proveedor |
| `database/migracion_ficha_trabajador.sql` | opcional, visibilidad de la ficha |
| `src/views/personal-flujo.js` | estados, etiquetas y reglas del flujo, en un solo lugar |
| `src/views/personal-resultado.js` | lo que ve el evaluado, por etapas |
| `src/views/personal-reunion.js` | agendar la 1:1 y marcarla realizada, con `.ics` |
| `src/views/personal-checklist.js` | los 24 ítems de la Hoja 10 |
| `src/views/personal-plan-accion.js` | recomendador de planes y cierre |
| `src/views/personal-acta.js` | acta de firmas (Hoja 7) y su descarga |
| `src/views/personal-bienestar.js` | panel del rol Crecimiento y Bienestar |
| `src/views/trabajador-ficha.js` | la ficha |
| `src/ui/charts.js` | gráficos SVG sin dependencias |
| `src/styles/eva-flujo.css`, `src/styles/ficha.css` | |

## Modificados

`src/views/personal.js` (enrutado por rol y por paso del flujo),
`src/views/personal-autoevaluacion.js` (se le sacó la pantalla de conformidad),
`src/views/personal-pdi.js` y `src/views/trabajador-ficha.js` (importan del módulo
compartido), `src/views/trabajadores.js`, `src/styles/main.css`,
`src/views/proveedores.js` (GOL en vez de comité, nuevos botones del flujo),
`supabase/functions/send-email/index.ts` (**requiere redespliegue**),
`database/ORDEN_EJECUCION.md`.

---

# Para decidir

1. **`migracion_ficha_trabajador.sql` es opcional.** Solo hace falta si tu usuario
   admin **no** tiene fila en `modulo_accesos` para `personal` — en ese caso hoy
   abrirías la ficha y la verías vacía. Vale revisar ese dato antes de correrla.

2. **`crear-usuario` quedó huérfana.** Ya nadie la llama. Conviene borrarla del
   repo y, si sigue desplegada, `supabase functions delete crear-usuario`.

3. **`create-user` cambió quién puede crear usuarios.** `crear-usuario` permitía
   `es_admin` **o** rol `rrhh`; `create-user` exige solo `es_admin`. Si RRHH da de
   alta gente sin ser admin global, hoy recibe un 403.

4. **`create-user` está desplegada con `--no-verify-jwt` y
   `Access-Control-Allow-Origin: *`.** La autorización real la hace la función
   chequeando `es_admin()`, pero el endpoint queda invocable desde cualquier
   origen. Vale restringirlo a tu dominio en producción.

5. **El trabajador ve su propia serie histórica.** Técnicamente ya podía leer sus
   evaluaciones, pero mostrarle la curva de varios años es decisión de RRHH. Si
   prefieren que solo vea el ciclo vigente, se cierra quitando el botón «Ver mi
   evolución» de `src/views/personal.js` — sin tocar RLS.

6. **Para asignar el rol nuevo**: en Trabajadores → Gestionar accesos → Evaluación
   de Personal, escribir `crecimiento_bienestar`.

7. **Revisa quién quedó como `gol` en Proveedores** después de correr la migración
   28. Los que tenían `comite` pasaron a `gol` automáticamente, pero vale
   confirmarlo — es el rol que ahora comunica y cierra.

8. **Las 4 plantillas de carta son editables** desde `prov_carta_plantillas`. Están
   redactadas con el tono que me pareció apropiado, pero convendría que las lea
   alguien de GOL antes del primer envío real — sobre todo la D, que tiene
   consecuencias contractuales.

---

# 6. El motor de PDI: del puntaje al plan de acción

Esto reemplaza el recomendador que había. El anterior miraba la categoría global
y la dimensión más débil, y proponía acciones de un catálogo de 19 planes que yo
había redactado — porque en ese momento no tenía la batería real. Ahora sí la
tengo, y el motor es el de la planilla oficial.

## La regla, tal como está escrita

> «La nota propone, la conversación decide, el sello compromete y el Comité
> financia. Ninguna brecha detectada queda sin acción; ninguna capacitación se
> contrata sin una brecha que la justifique.»
> — RRHH-PRO-EVA-PDI-001 rev. 00

Lo importante de esa frase es que reparte responsabilidades: el sistema propone,
el evaluador decide, y las dos cosas quedan registradas por separado.

## Cómo funciona

Lo que manda es la nota de **cada criterio**, no el promedio. Un promedio de 3,1
puede esconder un 1 en dominio del cargo, y con la regla del promedio ese 1 se
diluye. Acá cada criterio bajo arrastra sus propios cursos:

| Nota | Prioridad | Qué pasa | Plazo |
|---|---|---|---|
| 1 | **P1** | Brecha crítica. Entran todos los cursos mapeados al criterio. | Dentro del trimestre |
| 2 | **P2** | Brecha de desempeño. Entran los cursos mapeados. | Dentro del semestre |
| 3 | **P4** | Refuerzo opcional, sólo si el Comité tiene fondo. | Si el Comité lo prioriza |
| 4 | — | No genera nada. Se reconoce en la entrevista con ejemplos concretos. | — |
| 5 | — | No genera curso. Genera candidatura a relator interno N4. | — |

Y aparte, sin depender de ninguna nota:

| — | **P3** | Cursos obligatorios de la batería del cargo que la persona todavía no tiene, incluidos los habilitantes por ley. | Dentro del año del plan |

## La excepción que hace que esto no sea una tabla de multiplicar

Ocho de los treinta criterios son **conductuales**: asistencia, puntualidad,
jornada, Reglamento Interno, presentación personal, honestidad, respeto y
disposición a capacitarse. Una nota baja ahí **no se resuelve con un curso**, y
el sistema no ofrece capacitación: ofrece el texto del compromiso.

Con nota 1 o 2, el formulario **no deja sellar el PDI** sin un compromiso
verificable con fecha para cada uno. Con nota 3 el criterio sale en la propuesta
marcado como «abordar en la conversación», y explícitamente no genera línea de
PDI — porque la pauta dice que ahí se refuerza la expectativa y nada más.

## Los datos salen leídos de las planillas, no transcritos

Todo lo que siembra `migracion_eva_motor_pdi.sql` lo generé leyendo los dos
archivos que me pasaste, con un script. No hay nada tecleado a mano:

| | |
|---|---|
| Cursos de la batería corporativa | 160 |
| Celdas de la matriz curso × familia de cargos | 626 (334 obligatorios, 292 recomendados) |
| Mapeos criterio × curso | 92 |
| Cursos distintos que la evaluación puede gatillar | 51 |
| Horas de esa batería gatillable | 646 |
| Costo de referencia de esa batería | $7.015.000 |
| Cargos del catálogo | 54, en 11 familias |

Los tres últimos números coinciden exactamente con el resumen de la hoja 01 de tu
listado, que es la comprobación de que la lectura fue fiel. El verificador los
vuelve a contar en tu base: si algo no cuadra, lo dice.

## Dos cosas donde me aparté de la planilla a propósito

**1. Cuando dos criterios piden el mismo curso, gana la prioridad más alta.**

La hoja 06 se queda con la primera aparición en el orden de los criterios. Eso
tiene una consecuencia mala: si TC1 sale 3 (P4, «opcional si hay fondo») y SS1
sale 1 (P1, «brecha crítica»), y las dos mapean el mismo curso, la planilla lo
deja en P4 — y la brecha crítica se queda sin financiamiento asegurado. En el
sistema gana P1, y la línea dice qué otros criterios pedían el mismo curso.

**2. «¿Ya lo tiene?» se calcula, no se marca a mano.**

La planilla tiene una columna donde se marca si la persona ya hizo el curso. El
sistema lo deduce del historial y de la recurrencia del catálogo: un curso Anual
hecho hace tres años vuelve a estar pendiente; uno «Único» o «Al ingreso» no
caduca nunca. Eso necesita que cargues el historial en `eva_capacitaciones` —
hasta que lo hagas, el motor va a proponer obligatorios que la gente ya tiene.

## Lo que ve el evaluador

La propuesta llega agrupada por prioridad, con una barra izquierda de distinto
grosor por grupo y la sigla siempre escrita (P1, P2, P3, P4) — no hay nada que se
distinga sólo por color. Cada línea muestra qué criterio la gatilló y con qué
nota, si otro criterio también la pedía, si el curso está en la batería
obligatoria de su cargo, la modalidad, las horas, el costo y si es franquiciable
SENCE.

Los P1 y los habilitantes por ley vienen marcados. **Desmarcar uno obliga a
escribir por qué** — es el ítem B8 del checklist de la entrevista («cada línea
quitada quedó justificada por escrito») y queda guardado en el expediente, visible
en el acta.

Los obligatorios del cargo (P3) van en un bloque plegado, porque son muchos: un
Administrativo de Obra tiene 55 cursos obligatorios en su familia. Eso no es una
brecha de esta evaluación, es la batería del puesto que el Comité prioriza a lo
largo del año, y la vista lo dice así.

**Se fue el rango de «entre 3 y 8 acciones».** Con la batería real un cargo puede
tener 40 obligatorios pendientes; un techo arbitrario obligaría a dejar brechas
afuera, que es justo lo que la regla prohíbe. En su lugar hay un aviso cuando el
plan pasa de 12 líneas, explicando por qué eso no se sigue en la práctica.

Al final, un resumen con lo que el Comité necesita para presupuestar: líneas por
brecha, obligatorios pendientes, cuántas son P1, habilitantes por ley, horas
totales, costo estimado y cuánto de eso es franquiciable.

## Un hueco de privacidad que encontré y cerré

Las funciones del motor son `security definer` — tienen que serlo, porque leen el
catálogo, la matriz por familia y el historial de capacitación, y ningún
evaluador tiene permiso directo sobre todo eso a la vez. Pero `definer` significa
que salta la RLS: sin reja, **cualquier usuario autenticado podía pedir la
propuesta de PDI de cualquier evaluación**, y de la propuesta se deduce quién
sacó 1 en qué.

Ahora las tres funciones verifican adentro que quien pregunta sea el evaluado, su
evaluador, RRHH, Bienestar y Crecimiento o un administrador. Lo comprobé con un
usuario ajeno: recibe «No tiene permiso para ver la propuesta de PDI de esta
evaluación».

`eva_planes_sugeridos`, de la entrega anterior, tenía el mismo hueco en menor
escala — su resultado deja ver la categoría obtenida. Le puse la misma reja.

Efecto secundario a tener presente: si abres el SQL Editor de Supabase y llamas
`select * from eva_motor_pdi('...')` a pelo, te va a rechazar, porque ahí no hay
usuario autenticado. Para depurar hay que simular uno:
`set request.jwt.claim.sub = '<uuid de la persona>';` antes de la consulta.

---

# 7. Reconciliación con la v2.0 del formulario

La entrega anterior se sembró con la v1.1 de `RRHH-FOR-EVA-AD-001`, que era la
que existía entonces. La v2.0 que me pasaste cambió cuatro cosas.

## El checklist pasó de 24 a 26 ítems, y ahora dice cuáles son obligatorios

Es el cambio que más importa. La v2.0 marca 22 de los 26 ítems como obligatorios
y dice que sin ellos «la entrevista no se considera realizada conforme a la
pauta». El resumen anterior contaba todo por igual, así que un evaluador podía ir
22 de 24 e ir incumpliendo justamente los dos que importaban.

Ahora los obligatorios se cuentan aparte, se marcan en cada ítem y el resumen del
acta dice si la entrevista quedó conforme a la pauta o cuántos faltan. No bloquea
el cierre — un ítem en «No» nunca bloqueó nada — pero queda registrado.

Un detalle deliberado: un «N/A» en un ítem obligatorio **no** lo salva. Si de
verdad no aplica, RRHH le saca la marca de obligatorio al ítem en el catálogo; no
se lo salta el evaluador caso a caso.

## El acta pasó de tres firmas a cuatro

Se agrega la **Jefatura de Bienestar y Crecimiento**, y es la que cierra. El
orden es:

1. Trabajador evaluado y supervisor directo, en cualquier orden
2. Jefatura de RRHH — visto bueno del proceso
3. Jefatura de Bienestar y Crecimiento — recibe el expediente y cierra

Bienestar va al final porque su declaración dice que recibió el expediente para
cargar las líneas en la DNC del programa anual: firmar eso antes del visto bueno
de RRHH sería recibir algo que todavía puede cambiar. El orden está validado en
la base, no en la pantalla — probé que firmar fuera de turno se rechaza, y que un
supervisor no puede firmar como Bienestar aunque lo intente.

Cuando RRHH firma, Bienestar recibe el aviso automático con cuántas líneas de PDI
le van a llegar.

## Aparece la derivación del expediente como registro

Fecha de envío a RRHH, fecha de envío a Bienestar, cuántas líneas se cargaron en
la DNC y con qué número de acta del Comité se aprobaron. Las tres primeras se
llenan solas con cada firma; el número de acta lo escribe Bienestar o RRHH cuando
el Comité asigna fondo.

## Los criterios VH2, VH3 y VH6 cambiaron de significado

La v1.1 tenía «Adaptabilidad», «Compromiso» y «Trabajo en equipo». La v2.0 los
alinea con los valores HACER: **Austeridad**, **Cercanía** y «Compromiso y
adaptabilidad». Los códigos no cambiaron, así que la migración reescribe el texto
de los 30 criterios desde la hoja 11 de la v2.0.

Ojo con esto: si ya tienes evaluaciones cerradas con la redacción vieja, sus
notas quedan asociadas al texto nuevo. Si te importa preservar qué decía el
criterio cuando se firmó, dímelo y lo dejo versionado en lugar de sobreescrito —
es un cambio chico pero hay que decidirlo, no asumirlo.

---

# 8. Lo que queda por hacer de tu lado

Dos cosas que el sistema no puede adivinar:

**1. La familia de cargos de cada persona.** El motor la deduce comparando el
texto del cargo con el catálogo de 54 cargos de la planilla, sin acentos ni
mayúsculas. Si alguien tiene «Adm. de obra» en vez de «Administrativo de Obra»,
no la encuentra, y esa persona no recibe los cursos obligatorios de su puesto. La
vista lo avisa en rojo cuando pasa, pero hay que corregirlo: o dejas el cargo
escrito igual que en el catálogo, o le fijas la familia a mano en el perfil
(`perfiles.familia_codigo`).

**2. El historial de capacitación.** Hay una tabla nueva, `eva_capacitaciones`,
que es de donde el motor saca el «¿ya lo tiene?». Vacía, el motor propone todos
los obligatorios del cargo a todo el mundo. La escriben RRHH y Bienestar y
Crecimiento; cada persona ve sólo la suya.

---

# 9. La lectura por SECCIÓN, y una aclaración importante

Me preguntaste cómo se comporta el sistema según el puntaje de cada sección.
Hasta la entrega anterior la respuesta era incómoda: **no se comportaba por
sección**. El motor leía la nota de cada criterio y agrupaba por prioridad, así
que las cinco secciones quedaban mezcladas en un mismo listado de P1, P2 y P4.

La regla por sección sí existe en tu propio listado — está en las hojas 06 y 07,
y no la tenía implementada. Ahora sí.

## Las cinco secciones y sus tramos

| Promedio de la sección | Sigla | Categoría | Qué recomienda | Filtro de cursos |
|---|---|---|---|---|
| 1,00 – 1,99 | **NC** | Crítico | Paquete completo con prioridad P1, dentro del trimestre. PMD con acompañamiento de RRHH | Legal · Crítica · Alta · Media · Baja |
| 2,00 – 2,99 | **PD** | Por debajo | Paquete acotado con P2, dentro del semestre. PMD obligatorio + seguimiento mensual 3 meses | Legal + Crítica + Alta |
| 3,00 – 3,99 | **C** | Satisfactorio | Sólo el núcleo con P4, si el Comité tiene fondo. Foco en los criterios bajo 3 | Legal + Crítica |
| 4,00 – 4,49 | **SE** | Destacado | Nada por brecha. PDI de profundización | ninguno (sólo P3) |
| 4,50 – 5,00 | **EX** | Excepcional | Nada por brecha. Reconocimiento y candidatura a relator N4 | ninguno (sólo P3) |

Y cada sección trae además su advertencia de composición, calculada — no escrita
a mano — de cuántos de sus criterios son capacitables:

| Sección | Peso | CAP / CON | Qué implica |
|---|---|---|---|
| Competencias Funcionales del Cargo | 35% | 6 / 0 | El promedio se puede cerrar con capacitación |
| Organización y Cumplimiento | 20% | 6 / 0 | Igual |
| **Disciplina Laboral** | 15% | **1 / 5** | **Un promedio bajo acá NO se cierra con capacitación** |
| Valores HACER | 15% | 4 / 2 | Dos criterios no se cierran con curso |
| Calidad y Mejora | 15% | 5 / 1 | Uno no se cierra con curso |

Disciplina Laboral es el caso que importa: 5 de sus 6 criterios son
conductuales. Si la pantalla no lo dice, el evaluador va a buscar un curso que no
existe. Ahora lo dice arriba de la sección, antes de mostrar cualquier línea.

## Cómo se comporta, con las notas puestas

Corrí cinco evaluaciones completas, una con **todos** los criterios en cada nota,
para poder mostrarte la conducta real y no describirla:

| Nota en todo | Sección | Tramo | Prioridad | Cursos | Compromisos | Horas | Costo |
|---|---|---|---|---|---|---|---|
| **1** | TC | NC | P1 | 20 | 0 | 264 | $2.570.000 |
| | SS | NC | P1 | 10 | 0 | 126 | $1.300.000 |
| | DL | NC | P1 | 2 | **5** | 20 | $180.000 |
| | VH | NC | P1 | 7 | **2** | 80 | $985.000 |
| | CM | NC | P1 | 6 | **1** | 96 | $1.300.000 |
| **2** | TC | PD | P2 | 20 | 0 | 264 | $2.570.000 |
| | DL | PD | P2 | 2 | **5** | 20 | $180.000 |
| **3** | TC | C | P4 | 7 | 0 | 96 | $980.000 |
| | SS | C | P4 | 8 | 0 | 116 | $1.230.000 |
| | DL | C | P4 | 1 | 0 | 16 | $180.000 |
| **4** | las cinco | SE | — | 0 | 0 | 0 | $0 |
| **5** | las cinco | EX | — | 0 | 0 | 0 | $0 |

Lo que se lee en esa tabla: con todo en 1, Disciplina Laboral propone **2 cursos
y 5 compromisos conductuales** — no 15 cursos. Con todo en 4 o 5 no se recomienda
nada por brecha en ninguna sección. Y el paquete se angosta al subir el promedio:
Competencias pasa de 20 cursos en NC a 7 en C, porque el filtro de criticidad se
cierra.

## Las dos lecturas conviven, y ninguna manda en silencio

Acá está la decisión de diseño que más te conviene revisar. La nota del
**criterio** y el promedio de la **sección** pueden discrepar, y cuando discrepan
las dos tienen razón en algo distinto.

El caso que lo muestra: probé una evaluación con TC1 en 1 y los otros cinco
criterios de esa sección en 5. El promedio de la sección sale **4,33 · tramo SE ·
«sin cursos por brecha»**, y sin embargo TC1 en 1 pide cinco cursos con prioridad
P1.

No elegí una. La sección muestra su lectura arriba («no se recomienda curso por
brecha: corresponde PDI de profundización»), y justo debajo aparecen los cursos
de TC1 con P1, cada uno marcado: *«Fuera del filtro del tramo SE de su sección
(promedio 4,33): la pide la nota de TC1, no el promedio.»*

Las dos cosas son ciertas. La persona está muy bien en esa sección **y** tiene un
punto ciego concreto. Que el sistema esconda una de las dos sería peor que
mostrarlas juntas y dejar que tú resuelvas.

## Nada bloquea. Cambié eso.

Me dijiste que todo son recomendaciones y que quien designa qué hacer es el
evaluador. Tenías razón y el formulario no lo respetaba: en la entrega anterior
puse **dos bloqueos duros** que impedían sellar el PDI. No se podía sellar si un
criterio conductual con nota 1 o 2 quedaba sin compromiso, ni si se quitaba una
brecha crítica sin escribir por qué.

Los saqué. Ahora ninguna de las dos cosas impide sellar. Lo que hace el sistema
en su lugar:

- **Las nombra en la confirmación**, con código y todo. Por ejemplo: *«Quedan
  fuera 1 línea que la regla marca como no postergable (E-01), y 1 sin motivo
  escrito. DL2, VH1, CM4 tienen nota baja en un criterio conductual y quedan sin
  compromiso registrado.»* Así quitar algo importante es una decisión consciente y
  no un descuido.
- **Deja constancia de todo**, incluso de lo que no se justificó. Antes la tabla
  de descartes exigía motivo, así que un descarte sin explicación simplemente no
  se guardaba. Ahora se guarda igual: «se quitó y no se escribió por qué» también
  es información para quien revise el caso después.
- Lo único que sigue impidiendo guardar es una línea marcada **sin texto** — eso
  no es una decisión, es un formulario a medio llenar.

Arriba de la propuesta hay una banda que lo dice explícito: *«Todo lo de abajo es
una recomendación. El sistema propone según las notas y explica de dónde sale cada
línea; qué entra al PDI lo decides tú, y lo que dejes fuera queda registrado tal
cual.»*

## Cómo se ve

La propuesta ahora se recorre **por sección**, en el orden fijo de la entrevista
(TC → SS → DL → VH → CM), que es el mismo orden del ítem B3 del checklist. Cada
sección es una tarjeta con su promedio grande, su tramo, la frase de qué se
recomienda, la regla completa desplegable, su advertencia de composición si tiene
criterios conductuales, y dentro las líneas agrupadas por prioridad.

Los compromisos conductuales dejaron de estar en un bloque aparte: ahora van
dentro de su sección, justo debajo del promedio que los explica. Y arriba de todo
hay una tabla de las cinco secciones para ver de un vistazo por dónde va a doler
la conversación.

Los tramos se distinguen por **forma** además de color — ■ crítico, ▲ mínimo, ✔
destacado, ★ excepcional — y la sigla va siempre escrita, así que nada depende de
poder distinguir un rojo de un ámbar.

---

# 10. Qué pasa cuando sale bien

Me preguntaste qué pasa con una nota EX, y la respuesta honesta era: **nada**.
Lo comprobé en la base antes de tocar código. Con los 30 criterios en 5, el
motor devolvía **cero líneas**. Las tarjetas decían «corresponde reconocimiento y
candidatura a relator interno N4», pero eso era una frase: no se registraba en
ninguna parte, nadie recibía aviso, y no llegaba al PDI ni al acta.

Había un segundo hueco al lado, del que no me había dado cuenta: el tramo **SE
(4,00–4,49)** dice «PDI de profundización y desarrollo» y tampoco producía nada.
Y algo peor de tono: una sección con 5,00 mostraba literalmente *«No se
recomienda ninguna acción en esta sección»*. Para alguien excelente, esa es una
respuesta fría y además falsa según tu propia regla.

Construí todo el motor mirando brechas. La regla tiene dos mitades y yo había
implementado una.

## Qué es un relator interno N4 (porque a mí tampoco me quedaba claro)

Lo armé juntando cuatro piezas de tus propias planillas:

| Dónde | Qué dice |
|---|---|
| `CATALOGO` · columna «Nivel meta» | N1 a N4. Sólo **4 de los 160 cursos** son N4 |
| `CONFIG` del programa anual | **«Valor hora de referencia del relator interno: $25.000»** · *«Para valorizar la inversión interna»* |
| `PRESUPUESTO` · línea 3 | «Inversión interna valorizada (Academia) — Horas de relatores internos y producción de tutoriales — **No consume caja**: visibiliza el esfuerzo real del programa» |
| `CATALOGO` · L-08 | «Formación de relatores internos (metodología N4)» — *«Habilitar al experto para enseñar: diseño de sesión y evaluación»*. 16 h, $190.000, franquiciable |

O sea: alguien de Metalium que en vez de recibir capacitación la **entrega**, y
cuyas horas se valorizan a $25.000 en el presupuesto sin gastar caja. De ahí que
la regla diga que un 5 no genera curso sino candidatura: si alguien sacó 5 en
«Dominio de las funciones del cargo», no hay nada que enseñarle ahí — lo que
corresponde es que él lo enseñe.

## Qué hace ahora el sistema

| Situación | Antes | Ahora |
|---|---|---|
| Criterio con nota **5** | nada | Candidatura a relator interno N4, agrupada por dominio |
| Criterio con nota **4** | nada | Aparece en «para reconocer en la entrevista» con ejemplos concretos |
| Sección en **EX** (≥4,50) | frase suelta | Línea de reconocimiento formal en el PDI |
| Sección en **SE** (4,00–4,49) | nada | Línea de PDI de profundización y desarrollo |
| Alguien con candidaturas | nada | Se sugiere **L-08** para habilitarlo a relatar |

## Un resultado inútil que corregí en el camino

La primera versión devolvía **una candidatura por criterio**. Con los 30
criterios en 5 salían **35 candidaturas para una sola persona**, que no sirve
para nada: nadie es relator de treinta cosas.

Lo consolidé por **dominio de la batería**, que es la unidad en que realmente se
relata un curso. El mismo caso extremo baja de 35 a 10, ordenadas por cuántos
criterios las respaldan. Y en un caso realista — tres notas 5 — salen **tres
candidaturas**, una por dominio, cada una diciendo qué criterio la respalda.

Además cada candidatura muestra lo que está en juego, calculado de tu catálogo:
*«La batería tiene 12 cursos en este dominio (304 h, $2.960.000 de costo externo
de referencia): eso es lo que podría relatarse internamente.»* Esa es tu línea 3
del presupuesto hecha número.

## Una candidatura no nombra relator a nadie

Tiene su propia tabla y su propio ciclo: **propuesta → aceptada / postergada /
descartada / formado**. La propone el evaluador al sellar; la resuelve **RRHH o
Bienestar y Crecimiento**, no el supervisor directo — el Comité decide a quién
forma como relator. Postergar y descartar exigen decir por qué. Todo eso está
validado en la base, no en la pantalla: probé que un supervisor recibe
*«Sólo RRHH o Bienestar y Crecimiento resuelven las candidaturas a relator»*.

Cuando aparece una candidatura, RRHH y Bienestar reciben el aviso automático. La
persona ve las suyas — es reconocimiento, no un expediente reservado — y quedan
en el acta, resueltas o no. Si sólo quedara la lista de brechas, el expediente de
alguien excelente diría únicamente lo que le falta.

## Lo que marqué como inferencia mía

La línea de **L-08** para formar al relator **no es una regla de tus
documentos**. Tus planillas dicen «candidatura a relator N4» pero no dicen que
haya que capacitarlo para relatar. Me pareció que no se puede nombrar relator a
alguien y no enseñarle a enseñar — y el curso existe en tu catálogo sin que nada
lo proponga nunca — así que lo sugiero, y la pantalla dice textualmente que es
sugerencia del sistema y no regla tuya.

Si el Comité prefiere decidir la formación aparte: en
`eva_config_fortalezas`, el valor `curso_formacion_relator` a `null` y la
sugerencia desaparece.

## Dos defectos que sólo aparecieron con estos datos

**Una sección se contradecía consigo misma.** Organización y Cumplimiento con
promedio 3,83 decía «se recomienda capacitación con prioridad P4» y dos líneas
más abajo «no se recomienda ninguna acción». Pasa porque el tramo mira el
promedio y las líneas las gatilla el criterio: el tramo admitía refuerzo y no
había criterio que lo justificara. Ahora esa combinación tiene su propia frase, y
cuando los cursos de una sección se fueron al bloque P3 la sección lo dice en vez
de quedarse muda.

**La advertencia de conductuales salía en una sección perfecta.** Disciplina
Laboral con 5,00 mostraba el aviso amarillo «un promedio bajo aquí no se cierra
con capacitación», que con esa nota es ruido y se lee como un reproche. Ahora
sólo sale cuando el promedio está efectivamente bajo.

Y una tercera, menor: los montos salían como «2,960,000» en vez de «$2.960.000»,
porque `to_char` de Postgres usa el separador de la configuración regional del
servidor y en Supabase es la anglosajona.

---

# 11. Filtrar por cargo

Tenías razón y era el hueco más grande que quedaba: el motor proponía cursos sin
mirar el cargo. Lo comprobé con tu propio ejemplo — un **Analista TI** con nota 1
en TC1 recibía los mismos cinco cursos que un **Modelador/Proyectista**, incluido
`D-12 Auranet (ERP) nivel avanzado`, que en tu matriz MAPA_CARGO **no aplica** a
la familia F9.

## El tamaño del ruido, contado

Sobre los 51 cursos que la evaluación puede gatillar:

| Familia | No aplican | |
|---|---|---|
| F11 Servicios de obra | 43 de 51 | **84%** |
| F5 Maestros y especialidades | 38 de 51 | **75%** |
| F10 Licitaciones y comercial | 36 de 51 | 71% |
| F6 Taller Liray | 29 de 51 | 57% |
| F7 Logística y bodega | 28 de 51 | 55% |
| F8 Finanzas y contabilidad | 25 de 51 | 49% |
| F4 Supervisión y prevención | 20 de 51 | 39% |
| F3 Oficina Técnica | 17 de 51 | 33% |
| F9 RRHH y JDE (TI/SGC) | 17 de 51 | 33% |
| F1 Gerencias y jefaturas | 12 de 51 | 24% |
| F2 Administración de obra | 5 de 51 | 10% |

## Por qué no filtré a secas

Porque medí lo otro también, y es peor. Con un filtro duro, un **Jornal/Ayudante
se queda con 17 de sus 22 criterios capacitables sin ningún curso** — incluido
TC1, «dominio de las funciones del cargo». Maestros, 10 de 22. Eso cambia un
problema de ruido por uno grave: brechas reales sin ninguna acción, justo en las
familias operativas donde menos margen hay.

Así que los cursos que no aplican **se degradan, no se esconden**: bloque aparte
plegado, desmarcados, con la insignia «No aplica a su cargo» y el motivo escrito.
Para F11 y F5 ese bloque es casi todo lo que existe, y esconderlo dejaría al
supervisor sin nada que ofrecer.

Y el resumen del Comité los deja **fuera de la cuenta**: *«Los totales de arriba
no incluyen 6 cursos que no aplican a la familia de su cargo (64 h, $620.000)»*.
Si se sumaran, el presupuesto estimado quedaría inflado con cursos ajenos.

## La matriz criterio × familia

Elegiste que la evaluación también filtre criterios, así que existe
`eva_criterio_familia` — 330 cruces, los 30 criterios × las 11 familias.

**Nace entera en «sí aplica».** Correr la migración no cambia nada de
comportamiento. Es RRHH quien va marcando lo que no corresponde: SS5 «plazos
legales y reportes obligatorios» a un Jornal, SS2 «confidencialidad de la
información» a un Pintor. No la sembré yo con criterio propio — son 330 juicios
sobre qué le toca a cada oficio, y ésos no me corresponden.

Quitar un criterio **exige decir por qué**: el motivo queda en el registro,
porque alguien lo va a preguntar en una auditoría.

El formulario carga los criterios de la familia de la persona, y lo hace en los
**dos modos**: si el evaluado y su jefatura respondieran conjuntos distintos, las
brechas por dimensión dejarían de significar nada. Probado con un Jornal: se le
preguntan 25 en vez de 30, y la sección SS le queda con un solo criterio.

## Dos cosas que encontré revisando la matemática

**El promedio se salva por poco.** La consolidación divide por
`criteriosDim.length`, no por 6 fijo, así que quitar criterios ajusta solo.
Verifiqué el total con un Jornal de 25 criterios todos en 4: da **4,00 exacto**,
los pesos no se desvían. Si hubiera dividido por 6, un Jornal habría tenido techo
4,17 en vez de 5,00 y nadie se habría dado cuenta.

**El borde que sí rompe.** Dejar una sección **entera** sin criterios da 0/0 y el
total ponderado sale NaN. No es una preferencia de diseño, es una división por
cero esperando. Lo impide un trigger en la base: probé quitar los 6 criterios de
SS para F11 y frena en el sexto — *«No se puede dejar la sección Organización y
Cumplimiento sin ningún criterio para la familia Servicios de obra»*.

## Una fuga que cerré

Si RRHH quita un criterio **después** de que alguien ya lo calificó, la nota
vieja se quedaba en la tabla y seguía pesando en el promedio de su sección. Ahora
el promedio la ignora, y la sección avisa: *«1 nota registrada en esta sección
corresponde a un criterio que RRHH marcó como no aplicable a esta familia. No se
cuenta en el promedio.»* El formulario la limpia en el siguiente guardado, pero
las evaluaciones en vuelo quedaban a medio camino.

## La pantalla para curarla

Está en **Evaluación de Personal → 🎯 Criterios por cargo**, sólo para RRHH.

Se trabaja **una familia a la vez**, no la cuadrícula de 30 × 11: con 330
casillas en pantalla no cabe el motivo de cada exclusión, y el motivo es
obligatorio. Cada criterio muestra dos datos que sin ellos la decisión se toma a
ciegas:

- **CAP o CON.** Un criterio conductual — asistencia, honestidad, respeto —
  aplica a cualquier oficio: quitarlo casi nunca tiene sentido, y la pantalla lo
  dice.
- **Cuántos cursos de la batería de esa familia cerrarían el criterio si sale
  bajo.** Un 0 ahí *no* significa que el criterio no aplique: significa que si
  sale bajo habrá que escribir la acción a mano.

El botón del último criterio activo de una sección aparece **deshabilitado**, con
el texto «No se puede quitar» y la razón. La base lo rechazaría igual, pero
ofrecer un botón que va a fallar es peor que no ofrecerlo.

---

# 12. El cargo dejó de ser texto libre

Tenías razón y era urgente por una razón que va más allá de la comodidad: **de
qué se escriba en ese campo depende que la persona reciba o no sus cursos
obligatorios.**

El cargo se compara contra el catálogo de 54 cargos para deducir la familia, y de
la familia salen los P3 y el filtro de criterios. Un «Adm. de obra» tecleado en
vez de «Administrativo de Obra» no encuentra familia — y **no da ningún error**:
la persona queda creada, entra al sistema, se evalúa normal, y la sección de
cursos obligatorios de su puesto simplemente aparece vacía. Es el peor tipo de
falla: silenciosa y con consecuencias reales sobre la plata de capacitación.

## Qué cambió

**El campo es un desplegable**, en los dos formularios — nuevo trabajador y
editar. Las 54 opciones vienen agrupadas por familia en `optgroup`, así que quien
elige ve la consecuencia de su elección: «F2 · Administración de obra» encima de
los cargos de esa familia.

**Un cargo guardado que no está en el catálogo no se pierde ni se corrige solo.**
Entra como opción seleccionada, marcada con ⚠ y el texto «no está en el
catálogo», más la explicación de qué se está perdiendo. Sobreescribirlo en
silencio sería peor: nadie sabría qué decía antes.

**La lista de trabajadores tiene columna de Familia.** Cada persona muestra su
familia deducida, o una insignia: «Cargo no reconocido» en rojo si el texto no
coincide, «Sin cargo» en ámbar si está vacío. Y arriba de la tabla, el conteo:
*«3 personas activas sin familia de cargo. A esas personas el motor de PDI no les
propone los cursos obligatorios de su puesto… No da error: simplemente esa parte
queda vacía.»*

Un detalle que corregí al mirarlo: al principio quien no tenía cargo escrito
mostraba un guion inofensivo mientras el aviso de arriba lo contaba — el número
no cuadraba con la tabla. Sin cargo y con cargo no reconocido son el mismo
problema para el motor, así que ahora los dos llevan insignia.

## El importador masivo

Era el otro camino de entrada de texto libre, y lo cerré:

- **La plantilla trae una hoja «Cargos válidos»** con los 54 cargos y su familia,
  y la columna Cargo tiene validación de lista de Excel apuntando a ese rango.
  (No inline: Excel limita la fórmula a 255 caracteres y 54 cargos no caben.)
- **Al importar se valida antes de crear a nadie.** Si algún cargo no está en el
  catálogo, no se crea ninguna fila y se listan las que fallan. Dejarlo pasar
  crearía gente sin familia, que es exactamente el problema que este cambio viene
  a evitar.
- Los cargos que sí coinciden se guardan con **la grafía exacta del catálogo**,
  aunque en el Excel vinieran con otra capitalización o sin acentos.

## Y algo que estaba prometido y no estaba hecho

Revisando esto encontré que `eva_evaluaciones.cargo_actual` y `familia_codigo`
**nunca se llenaban**. Existían las columnas — las creé para que el expediente
firmado conservara con qué batería se evaluó a la persona — pero nada las
escribía, así que el motor deducía la familia en vivo del perfil.

La consecuencia: si alguien cambiaba de cargo, un expediente **ya firmado**
empezaba a decir que se había evaluado con la batería de su cargo nuevo. Ahora
las dos se congelan al asignar la evaluación.

## Lo que dejé como está

Los **roles de módulo** siguen siendo texto libre, con placeholder de ejemplo. Es
el mismo defecto en el mismo formulario, y tiene una consecuencia concreta:
escribir `bienestar` en vez de `crecimiento_bienestar` no da error y deja el acta
sin quién ponga la cuarta firma. No lo cambié porque pediste los cargos, no los
roles — pero es media hora de trabajo y el problema desaparece de raíz.

---

# 13. El Gerente General, y un agujero de seguridad que apareció probándolo

## Lo que pediste

Que el Gerente General exista en el catálogo para que la consulta lo encuentre,
aunque a él no se lo evalúe.

Antes de agregarlo lo comprobé en tu propia hoja: **«Gerente General» no está en
13_MAESTROS**. Los cinco gerentes que figuran ahí son Operaciones, Ingeniería,
Finanzas Corporativas, Operaciones Logísticas y SST. Así que no es que se me
haya perdido al leer la planilla — el hueco es del dato maestro, y conviene
arreglarlo también ahí.

## Cómo quedó

El catálogo gana la columna `evaluable`. El Gerente General entra marcado como no
evaluable, con el motivo escrito: *«Cabeza de la línea jerárquica: no tiene
jefatura que lo evalúe. Evalúa a las gerencias.»*

**No se lo esconde, se lo marca.** Al asignar una evaluación aparece en la lista
de «trabajador a evaluar» pero deshabilitado, con el motivo al lado, y arriba se
dice quién quedó gris. Si desapareciera sin explicación, RRHH lo buscaría
pensando que falta cargarlo — y el paso siguiente sería escribir el cargo a mano,
que es justo lo que cerramos en el punto 12.

Como **evaluador** sigue disponible sin restricción: el Gerente General evalúa a
sus gerencias, y la pantalla de asignación ahora autocompleta su cargo desde su
perfil en vez de pedirlo escrito.

## Y ahora RRHH puede agregar cargos sin pedírmelo

Tu hoja maestra ya estaba incompleta en uno; va a volver a pasar. En la pantalla
«Criterios por cargo» hay ahora un bloque por familia con sus cargos, cuánta
gente activa tiene cada uno y cuántas evaluaciones en curso, un botón para
marcar que un cargo no se evalúa (exige el motivo por escrito) y un formulario
para agregar uno nuevo.

Se rechaza el duplicado con el mismo criterio de comparación que usa el motor —
sin acentos ni mayúsculas — porque «Jefe de Obra» y «jefe de obra» serían dos
filas distintas compitiendo por el mismo match de familia.

Un detalle: cuando marcas que un cargo deja de evaluarse, si hay evaluaciones en
curso de gente con ese cargo, **el número te lo dice en el diálogo, antes de que
decidas**. La base también lo avisa, pero con un `raise notice` que no llega al
navegador; ahí no servía de nada.

---

## El agujero

Probando esto encontré algo que no tiene que ver con el Gerente General y es más
grave que todo lo anterior. **Está corregido en `parche_guardias_nulas.sql`, y es
la migración más importante de esta entrega.**

Las funciones que exigen un rol estaban escritas así:

```sql
if not (es_admin() or rol_en_modulo('personal') = 'rrhh') then
  raise exception 'Sólo RRHH ...';
end if;
```

Parece correcto. No lo es. `rol_en_modulo()` devuelve **NULL** cuando el usuario
no tiene ninguna fila en `modulo_accesos` para ese módulo. Y en SQL:

```
NULL = 'rrhh'            →  NULL     (no false: «no sé»)
false or NULL            →  NULL
not NULL                 →  NULL
if NULL then … end if    →  no entra
```

La guardia rechazaba a quien tenía el rol **equivocado** y dejaba pasar a quien
**no tenía ninguno**. Al revés de lo que hace falta.

**Por qué no lo vi antes.** Todas las pruebas de permisos las hice con usuarios
que sí tenían un rol en el módulo: supervisor, bienestar, RRHH, y también con
gente ajena a *esa evaluación*. Con `'supervisor'` la comparación da false de
verdad y la guardia salta bien — por eso todas esas pruebas pasaron y me dieron
confianza. El agujero sólo se abre con un usuario **sin ningún rol en el
módulo**, que es exactamente el perfil de cualquier trabajador recién creado.

**Qué pudo hacer, comprobado en base real** con un usuario así — autenticado, con
perfil, sin una sola fila en `modulo_accesos`:

- agregar cargos al catálogo;
- marcar «Jefe SST» como cargo que no se evalúa;
- quitarle el criterio TC1 a toda la familia F1 — o sea, cambiar qué se le
  pregunta a un grupo entero de trabajadores;
- registrar el acta del Comité;
- resolver candidaturas a relator;
- cargar controles de seguimiento de PDI;
- y **firmar el acta como RRHH**: el visto bueno que cierra la evaluación de otra
  persona. Lo único que lo frenaba era el orden de las firmas, y sólo mientras
  faltaran las del trabajador y el supervisor. Con esas dos puestas — el estado
  normal a esa altura del flujo — la firma entró: dejé el registro con
  «Ajeno Cualquiera» en el lugar de RRHH para verlo, y después lo borré.

**Qué no estaba mal.** Las políticas RLS (`using` / `with check`) no tienen este
problema: ahí un NULL se trata como false y la fila se filtra. Por eso ese mismo
usuario **no podía leer** el catálogo aunque sí podía escribirlo por función. El
parche no las toca.

**La corrección.** La condición de la guardia pasa a ser estrictamente booleana:

```sql
if not coalesce(<condición>, false) then
```

Con `coalesce` un NULL vale false y la excepción salta: falla cerrado, que es
como tiene que fallar una guardia. Se aplica también a las ramas que comparan
identidad (`evaluado_id = auth.uid()`), que serían NULL si el token no trae
sujeto. Queda además `sgc_rol()`, que nunca devuelve NULL, para que el código
nuevo no vuelva a caer en lo mismo.

Se reemplazan 5 funciones ya desplegadas: `eva_firmar_acta`,
`eva_registrar_acta_comite`, `eva_marcar_criterio_familia`,
`eva_resolver_candidatura` y `eva_pdi_registrar_control`. Los cuerpos **se
extrajeron de tus propias migraciones, no se transcribieron a mano**: cambia la
guardia y nada más. Las dos funciones nuevas del punto 34 ya salen corregidas.

**Cómo sé que quedó cerrado.** Repetí las siete operaciones con el mismo usuario:
las siete rechazan con su mensaje. Después verifiqué el otro lado, que es donde
un parche de permisos suele romper cosas: RRHH sigue pudiendo hacer las cuatro
que le tocan, Bienestar sigue pudiendo registrar el acta del Comité pero no tocar
el catálogo, el supervisor sigue rechazado con el mensaje que corresponde, y RRHH
firmó el acta sobre la misma evaluación donde el ajeno había sido rechazado.

**El verificador ahora revisa cómo están escritas esas siete guardias**, no sólo
que existan: lee el cuerpo de la función y marca `>>> AGUJERO ABIERTO` si vuelve
a aparecer el patrón viejo. Lo probé reinyectando a mano la versión vulnerable de
`eva_firmar_acta`: la detecta. Sirve para el caso realista de que alguien
reaplique una migración vieja encima del parche.

De paso: en el verificador los fallos ahora salen **arriba** de cada bloque. Con
86 filas de objetos, un `>>> FALTA` ordenado al final no lo ve nadie — y era
exactamente lo que hacía.

---

# 14. El Excel del trabajador, con la identidad de Metalium

## El membrete era un placeholder

`src/assets/letterhead-metalium.png` era un archivo de relleno que decía
literalmente **«REEMPLAZAR CON EL letterhead-metalium.png REAL»**, y eso venía
saliendo impreso en la cabecera de cada Excel exportado.

## Ahora es tu encabezado, dibujado punto por punto

Me pasaste el encabezado «Sistema de Gestión Interno» como SVG. Excel no acepta
SVG (ExcelJS trabaja con png/jpeg/gif), así que lo **dibujo en un canvas** y lo
incrusto como PNG en la primera fila.

Las coordenadas están copiadas una a una de tu SVG — viewBox `0 0 1400 173` —
no reinterpretadas:

```
franja azul fila 1     polígono 365,0 · 1400,0 · 1400,32 · 357,32
franja azul fila 4     polígono 908,125 · 1400,125 · 1400,173 · 896,173
diagonales principales 365→320 · 941→896 · 1202→1157   (#6B7590, 1.3)
diagonales suaves      941→933 · 1202→1194 · 1169→1157 (#5CB2E0, 1)
separador horizontal   921,78 → 1400,78                (#8791AA, 1)
borde exterior         #1B2340, 1.5
```

Las cuatro filas quedan como en el tuyo:

```
SISTEMA DE GESTIÓN INTERNO  │ CÓDIGO   │ RRHH-FOR-EVA-AD-001   (azul)
                            │ FECHA    │ 01/09/2026
                            │ REVISIÓN │ 02
                            │ RRH      │ METALIUM              (azul)
```

**Lo comprobé, no lo supuse.** Rendericé tu SVG y mi canvas al mismo tamaño y los
comparé píxel a píxel: los límites de las franjas azules, su altura, las tres
diagonales (x = 341, 917, 1178 a media altura) y el borde exterior salen
**idénticos**. La diferencia que queda —un 3% de los píxeles, concentrada
exactamente sobre los textos— es el suavizado de fuentes: `fillText` del canvas y
el texto SVG no colocan los glifos en el mismo subpíxel. No hay diferencia
estructural.

Se dibuja a **escala 2×** (2800 × 346 px). A 1400 el PNG se ve pixelado al
imprimir el Excel; al doble, no. Está en una constante por si hace falta más.

Y **se agregó Poppins** a `index.html`: es la tipografía de tu encabezado y el
proyecto no la cargaba.

Para reutilizarlo en otro formulario no hay que tocar `letterhead.js`: se le pasan
`titulo`, `codigo`, `fecha`, `revision` y `area`.

## El logo

El base64 de tu SVG me llegó cortado, así que usé el logo de tu propio
`encabezado.xlsx` — el mismo trazo, 527 × 110 px en vez de 278 × 68, o sea más
resolución. Tu caja del SVG es de 225 × 55 (proporción 4,09) y el logo real tiene
4,79: lo ajusto a lo alto conservando la proporción en vez de estirarlo, porque un
logo deformado es lo primero que se nota en un documento corporativo.

## Dos cosas del control documental que necesito que confirmes

**El código.** Tu encabezado trae como ejemplo `RRH-FOR-CON.001` — tres letras y
un punto antes del número. Tu portada de la evaluación dice
`RRHH-FOR-EVA-AD-001` — cuatro letras y guiones. Son dos convenciones distintas y
no me consta cuál manda, así que dejé la de la portada, que es la que está escrita
en el formulario oficial de la evaluación. Si la nueva es la vigente, es una línea
en `exportar-evaluacion.js`.

**«iNTERNO».** En tu SVG la banda superior dice `SISTEMA DE GESTIÓN iNTERNO`, con
la i minúscula. Lo escribí en mayúscula porque parece un desliz de tipeo y va
impreso en todos los documentos. Si era a propósito, está en una constante al
principio de `letterhead.js`.

## Y el pie, que no estaba

Tu portada dice: *«RESERVADO — Ley 19.628 y Ley 21.719. Uso restringido a RRHH, la
jefatura directa y Bienestar y Crecimiento»*. El Excel salía sin eso.

Ahora lleva la advertencia en una banda al final del documento **y** en el pie de
página impreso, porque quien imprime el expediente y lo deja sobre un escritorio
no ve la celda.

## El expediente creció

- **Las firmas del acta**, con rol, nombre y RUT declarados, fecha y hora y el
  texto completo de la declaración que firmó cada uno. Si el acta está incompleta
  lo dice y nombra quién falta, en vez de mostrar tres firmas como si fueran todas.
- **Ciclo evaluado** y **estado del expediente** en los datos.
- La categoría ya no sale como `satisfactorio` sino «Satisfactorio»: el valor
  interno de la base no va en un documento que firma una persona. Las etiquetas se
  leen de `personal-flujo.js`, la misma fuente que usa la pantalla.

## Arreglos que salieron de mirarlo impreso

Generé el archivo, lo convertí a PDF y lo miré. Cuatro cosas estaban mal:

- **El membrete era un 14% más angosto que la tabla.** El ancho salía de los
  anchos de columna, pero después las columnas 2 y 5 se retocaban — el cálculo
  usaba números viejos. Ahora se fijan una sola vez y de ahí sale la imagen.
- **La altura de la fila del membrete estaba en píxeles** donde Excel espera
  puntos (1 px = 0,75 pt).
- **«Prom. Autoevaluación» se cortaba** a media palabra.
- **En el resultado, los números aparecían a media hoja de su etiqueta** (celda
  combinada, número alineado a la derecha), y en la tabla de firmas el rol y el
  nombre quedaban pegados al fondo de una fila de diez líneas.

Una cosa que **no** quedó perfecta: en LibreOffice el membrete se ve un poco más
angosto que la tabla, porque calcula el ancho de columna con métricas de fuente
distintas a Excel. Forzarlo a calzar siempre implicaba estirar la imagen al rango
de celdas, y eso deforma el logo un 17% en Excel. Preferí la proporción correcta.

## Por qué no se veía el encabezado en Excel

Esto lo tenías razón en reportarlo y lo tenía mal. **El membrete estaba en el
archivo y Excel lo descartaba entero, sin decir nada.**

ExcelJS 4.4.0 escribe siempre el atributo `editAs` en el nodo de anclaje de la
imagen, también cuando es de una sola celda:

```
lib/xlsx/xform/drawing/one-cell-anchor-xform.js:29
xmlStream.openNode(this.tag, {editAs: model.range.editAs || 'oneCell'});
```

En el esquema OOXML `editAs` sólo existe en `<xdr:twoCellAnchor>`. En
`<xdr:oneCellAnchor>` es inválido, y los lectores estrictos —Excel entre ellos—
descartan el dibujo completo: el archivo abre sin ningún aviso y la imagen no
está.

**Lo aislé con un experimento, no lo deduje.** Tomé el archivo generado y le quité
únicamente ese atributo, sin tocar nada más. Contando las imágenes que logra leer
un lector estricto:

```
oneCellAnchor tal cual ExcelJS  →  0 imágenes
el mismo, sin el atributo       →  1 imagen
```

Y por qué se me pasó: **revisé el resultado convirtiéndolo a PDF con LibreOffice,
que ignora el atributo desconocido y muestra la imagen igual.** Validé en la
herramienta equivocada. El archivo que te mandé antes tenía el membrete
efectivamente invisible en Excel.

La corrección está en `src/ui/xlsx-anclaje.js`: después de generar el .xlsx se
reescribe ese nodo. Se mantiene el anclaje de una celda —y no el de dos, que no
tiene el bug— porque el de dos celdas estira la imagen al rango, y entonces la
proporción del membrete depende de cuántos píxeles mide una columna, que no es lo
mismo en cada lector. Medido en LibreOffice: proporción 5,26 en vez de 8,09, un
35% de deformación. Con el anclaje de una celda la imagen conserva su tamaño.

**Esto sí cambia `package.json`**, por primera vez en el proyecto: se declara
`jszip ^3.10.1`. No es una dependencia nueva en la práctica — ExcelJS ya la trae
y es la que usa para armar el .xlsx —, pero ahora se importa directamente y
corresponde declararlo. Hay que correr `npm install` una vez.

## Dónde se descarga

En las tres partes que pediste:

1. **«Tu evaluación»** — la pantalla donde el trabajador ve sus puntajes. Botón
   arriba, al lado del estado, con el aviso de que es un documento reservado.
2. **La Ficha del Trabajador** — el bloque «Historial de evaluaciones» gana una
   columna «Expediente» con un botón por ciclo. Los ciclos que todavía no se
   pueden bajar dicen «aún no» en vez de no mostrar nada.
3. **«Mis evaluaciones»** — la lista propia, botón por fila.

Desde **que RRHH le entrega el resultado**, como elegiste. `consolidada` queda
fuera a propósito: ahí los puntajes ya existen pero nadie se los ha comunicado
todavía, y el orden del flujo es parte del diseño. RRHH sí sigue exportando desde
`consolidada` — eso no cambió.

Las tres pantallas comparten un solo cargador (`cargarExpediente()`), y de paso
quedó eliminado el cargador de catálogo que tenía `personal.js` para lo mismo.

**La lista de estados está escrita en dos lados** — en la base y en cada pantalla
— y eso es a propósito: la base es la que decide de verdad, la pantalla sólo
decide si dibuja el botón. Si alguien llamara la descarga antes de tiempo, RLS le
devolvería un expediente vacío en lugar de datos.

## Los dos permisos que faltaban

Están en el punto 36 del `ORDEN_EJECUCION.md` con el detalle y los números
medidos. En corto: el trabajador no podía leer **sus propias respuestas de
autoevaluación** una vez enviadas, ni **las notas de su jefatura durante todo el
medio del flujo** — incluida la reunión one-to-one, que es la conversación sobre
esas notas. Las dos cosas habrían salido como columnas vacías en el Excel, sin
ningún error. Corregidas, y el verificador ahora comprueba qué estados cubre cada
política, no sólo que exista: lo probé reinyectando la política vieja y la detecta.

---

# 15. El plan de acción: el motor propone, el evaluador desmarca

Pediste que no fuera tan manual, que fuera más una recomendación y que no fuera
tan invasivo. Antes de tocar nada lo medí, y tenías razón con creces.

## Cómo estaba

Con un caso real de 56 líneas propuestas:

```
8,6 pantallas de scroll   (7.751 px de alto)
348 campos de formulario abiertos a la vez
1.707 palabras
15 tarjetas, 63 líneas
```

Cada línea de PDI abría seis campos: la acción redactada, el responsable, los
recursos, la fecha de inicio y la de cierre — **todos ya rellenos correctamente
por el motor**, pero presentados como formulario. O sea: el evaluador tenía que
mirar 348 controles para, casi siempre, no cambiar ninguno.

## Cómo quedó

```
4,8 pantallas   (4.357 px)   −44%
0 campos abiertos al cargar  (los 62 siguen ahí, detrás de «Ajustar»)
1.039 palabras               −39%
```

Cada línea es ahora una fila que se lee:

```
☑ D-09  Excel intermedio: tablas, funciones y validaciones
        P2 · TC2 sacó 2 · 24 h        [fuera del tramo SE]
        PROPUESTO  01/09/26 → 28/02/27 · Bienestar y Crecimiento ·
                   $130.000 · franquiciable SENCE          [Ajustar]
```

El camino normal es no tocar nada: se lee, se desmarca lo que no corresponde y
se sella. **Comprobado:** cargué la pantalla, no toqué una sola línea, completé
sólo los dos campos que el cierre exige y sellé. Entraron 11 líneas al PDI, todas
con acción redactada, responsable, recursos y fechas: `sin_accion: 0`,
`sin_inicio: 0`, `sin_cierre: 0`, `sin_responsable: 0`.

Lo que antes eran cuatro párrafos por línea ahora es una línea; el texto completo
está en el título emergente, al pasar el cursor.

## Un agujero que apareció al mirar esto

Los criterios conductuales —los ocho que no generan curso— tenían el campo de
compromiso **vacío**, y la regla era: si lo dejas en blanco, la línea no entra al
PDI. Sin aviso.

O sea que una nota 1 en «asistencia sin ausencias injustificadas» se quedaba sin
ninguna acción **por no haber tecleado**, en una pantalla donde había otros 347
campos compitiendo por la atención. Medido con un caso que tiene 4 conductuales:
las 4 se perdían.

Ahora el compromiso viene redactado a partir del propio criterio:

> «Se acuerda sostener asistencia sin ausencias injustificadas durante el próximo
> período, sin observaciones. La jefatura directa lo revisa en la fecha de
> verificación y deja constancia del resultado.»

Se acepta tal cual o se corrige. Y si el evaluador lo borra a propósito, el texto
de arriba cambia a «Sin compromiso: esta línea no entra al PDI» en rojo — la
decisión sigue siendo suya, pero deja de ser un descuido. Con el mismo caso, las
4 conductuales ahora entran.

## Qué más se plegó

Tres bloques que ocupaban más que todo el resto y que casi siempre se aceptan
tal cual:

| Bloque | Antes | Ahora |
|---|---|---|
| Candidaturas a relator interno | 1.119 px | 139 px · «Ver las 3» |
| Lo que respondió en el cierre | 359 px | 98 px · «Leer las 4» |
| Lo que el Comité va a ver | 296 px | 98 px · «Ver los totales» |

Nada se eliminó: todo sigue a un clic. Y cuando una sección tiene una sola línea
de fortaleza, se le quita el encabezado de grupo — un título para anunciar una
línea ocupaba tanto como la línea.

## Lo que no cambió

La regla de siempre: **el sistema no compromete nada por su cuenta y no bloquea
el sello.** Sigue marcando por defecto sólo lo que la regla considera exigible
(P1, P2 y los habilitantes por ley), sigue dejando P3 y P4 desmarcados, sigue sin
marcar lo que no aplica al cargo, y sigue pidiendo por escrito el motivo cuando
se quita una brecha crítica. Lo que cambió es cuánto hay que hacer para aceptar
lo que ya estaba bien propuesto.

---

# 16. El maestro del ciclo, y la numeración

## La numeración

Queda `RRH-FOR-EVA-NNN`, con NNN correlativo dentro de la familia EVA. Los
códigos vigentes están en **un solo lugar** — `DOCS`, al principio de
`src/ui/xlsx-metalium.js` — para que no aparezcan dos documentos con el mismo
correlativo:

| Código | Documento | Revisión |
|---|---|---|
| `RRH-FOR-EVA-001` | Evaluación de Desempeño (expediente individual) | 02 |
| `RRH-FOR-EVA-002` | Maestro del ciclo de evaluación | 00 |

El expediente individual cambió de `RRHH-FOR-EVA-AD-001` a `RRH-FOR-EVA-001`.
Los archivos que se descarguen desde ahora llevan el código nuevo en el nombre.

## «El mismo estandarizado» es el mismo código

Los dos documentos comparten `src/ui/xlsx-metalium.js`: el membrete, la paleta,
las bandas de sección, los encabezados de tabla, el pie de confidencialidad y la
descarga. No son dos formatos que se parecen — es uno.

Quien agregue el tercer documento escribe sólo su contenido:

```js
const { wb, sheet, ultimaCol } = await nuevoLibro({ nombreHoja, cols, doc });
// ... filas ...
ponerPie(sheet, doc, ultimaCol);
await descargar(wb, "nombre.xlsx");
```

De paso, el expediente individual quedó 100 líneas más corto: todo lo que ahora
está en el módulo común lo tenía duplicado.

## Qué trae el maestro

Se descarga desde el panel de RRHH, con el botón **📋 Maestro** en la fila de
cada ciclo. Va apaisado, porque son once columnas de nómina.

1. **El ciclo** — cuándo se habilitó, cuándo cierra la autoevaluación y la
   evaluación.
2. **Avance** — asignadas, autoevaluadas, evaluadas por jefatura, consolidadas,
   cerradas, disconformidades, promedio general, líneas de PDI. La única cifra
   resaltada es «NO se autoevaluaron».
3. **Pendientes de autoevaluación** — antes de la nómina completa, a propósito.
   Es lo único del documento sobre lo que se puede actuar hoy; al final, detrás
   de catorce filas de tabla, no lo miraría nadie. Cada fila trae **los días que
   lleva habilitado el período y el nombre de la jefatura**, porque «falta» no
   mueve a nadie y «falta hace 25 días, y su jefe es fulano» sí. Si el plazo ya
   venció, lo dice arriba en rojo.
4. **Estado de cada evaluación** — la nómina, con «Autoevaluó» en rojo cuando es
   NO.
5. **Revisar: autoevaluaciones sin fecha de envío** — ver abajo.

Al descargarlo, el aviso en pantalla ya dice cuántos faltan y si el plazo venció:
muchas veces es lo único que se quería saber.

## Cómo sabe quién no se autoevaluó, y por qué no es obvio

Lo natural sería mirar `eva_evaluaciones.fecha_envio_autoeval`. **Es la respuesta
equivocada.** Ese campo puede estar vacío en evaluaciones que sí tienen
autoevaluación. Medido en tu propia base:

```
estado             evaluaciones  con respuestas  con fecha_envio
cerrada_conforme        1              1               0
```

Una evaluación cerrada, con las respuestas cargadas, y sin fecha de envío. El
formulario sí escribe esa fecha (`personal-autoevaluacion.js:216` y
`db/personal.js:70`), pero cualquier fila que entre por otro camino —la carga
masiva, una corrección directa en el SQL Editor, una migración— la deja nula.

Un maestro que se fiara sólo de la fecha habría reportado como «no se autoevaluó»
a gente que sí lo hizo, precisamente en el documento que sirve para perseguir a
los que faltan. Se paga en tiempo de RRHH y en credibilidad del sistema.

Se decide por evidencia, en este orden: respuestas cargadas → estado ya avanzado
→ fecha registrada → no se autoevaluó. Y el documento trae una sección al final
con las filas cuyo registro quedó incompleto, diciendo de cuál de las tres
señales se dedujo. No las esconde: se cuentan como autoevaluadas, pero quedan
listadas para arreglarlas.

Comprobado con un caso montado a propósito: 14 evaluaciones, 3 sin autoevaluarse,
plazo vencido hace 4 días. El maestro las lista con sus 25 días de habilitado, y
las 11 restantes aparecen en la sección de «revisar» porque efectivamente ninguna
tiene la fecha.

## Permisos

`eva_maestro_ciclo()` y `eva_maestro_resumen()` devuelven **cero filas** a quien
no sea RRHH o admin. Probado con un supervisor y con un usuario sin ningún rol en
el módulo: 0 y 0.
