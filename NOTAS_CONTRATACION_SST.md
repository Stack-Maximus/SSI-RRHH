# Módulo de Contratación + SST + Solicitudes de cambio — notas de entrega

## 1. Cómo desplegar

1. En Supabase → SQL Editor, correr **`supabase/migrations/0001_contratacion_rol.sql`** solo (agrega el rol
   `prevencionista`). Ejecutarlo como paso aparte — Postgres no deja usar un valor de enum recién creado
   dentro del mismo lote/transacción en que se agregó.
2. Correr **`supabase/migrations/0002_contratacion_sst.sql`** completo.
3. Correr **`supabase/migrations/0003_ajuste_checklist_homologacion.sql`** (agrega "Contrato de Trabajo" al
   checklist y deja Contrato + Cédula/Pasaporte como los destacados para el prevencionista, según la Matriz
   SST R19-PTMD-SST-07).
4. Correr **`supabase/migrations/0004_prevencionista_acceso_completo.sql`** (el prevencionista puede además
   abrir cualquier otro documento ya subido de la contratación, no solo los 2 destacados — sigue siendo de
   solo lectura).
5. Correr **`supabase/migrations/0005_rol_supervisor.sql`** solo (agrega el rol `supervisor`), como paso
   aparte por la misma razón que el paso 1.
6. Correr **`supabase/migrations/0006_solicitudes_cambios.sql`** (agrega los 4 tipos de solicitud nuevos al
   enum `tipo_solicitud` — **revisa la nota dentro del archivo**: asumí ese nombre de enum, si tu base usa
   otro nombre el `ALTER TYPE` va a fallar con un error claro y me dices el nombre real).
7. Correr **`supabase/migrations/0007_solicitudes_cambios_rpc.sql`** (el RPC `crear_solicitud_cambio()` +
   políticas de lectura para el supervisor).
8. En Supabase → Authentication → Users / pantalla **Usuarios**, asigna `rol = 'prevencionista'` y
   `rol = 'supervisor'` a quien corresponda.
9. Correr **`supabase/migrations/0008_fecha_termino_contrato.sql`** y luego
   **`supabase/migrations/0009_homologacion_por_centro.sql`** (ver detalle en la sección 5 de más abajo).
10. En **Centros de costo**, asigna el **Prevencionista (homologación)** de cada centro (columna nueva).
11. Correr **`supabase/migrations/0010_folio_documentos.sql`** (folio correlativo por tipo, ver sección 6).
12. Desplegar/re-desplegar estas Edge Functions (usan el encabezado y la codificación nuevos):
    `supabase functions deploy notificar`, `supabase functions deploy comprobante-pdf`,
    `supabase functions deploy maestro-pdf`. Las tres importan código de `supabase/functions/_shared/`
    (el CLI de Supabase lo empaqueta solo, no hace falta nada especial).
13. `npm install && npm run build` (o `npm run dev` para probar local). No hay variables `.env` nuevas.

**Importante — descomprimir el zip no despliega nada solo.** El zip son los archivos del proyecto; para
que un cambio quede activo hay que llevarlo a cada destino que le corresponda, y son **tres destinos
independientes**, no uno solo:

| Qué cambió | Dónde se aplica | Cómo |
|---|---|---|
| Una migración nueva (`supabase/migrations/000X...sql`) | Supabase → SQL Editor (o `supabase db push` si administras las migraciones por CLI) | Pegar y ejecutar el archivo |
| Una Edge Function (`supabase/functions/<nombre>/index.ts`, o algo que cambie en `_shared/`) | Supabase, por función | `supabase functions deploy <nombre>` |
| Algo en `src/`, `index.html` o `public/` (el front-end) | Vercel | Depende de cómo tengas conectado Vercel (ver abajo) |

Vercel **solo** aloja el front-end (lo que sale de `npm run build`) -- nunca toca la base de datos ni las
Edge Functions, así que un redeploy en Vercel no aplica una migración ni redespliega una función, aunque el
código ya esté actualizado en el repo.

Para el front-end, según cómo lo tengas conectado:
- **Si Vercel está conectado a un repo (GitHub/GitLab/Bitbucket)**: hay que llevar los archivos nuevos a ese
  repo (reemplazar los archivos que cambiaron y hacer commit + push a la rama que Vercel está mirando) --
  Vercel construye y publica solo con cada push, no hace falta hacer nada más ahí.
- **Si despliegas manual** (`vercel --prod` desde la carpeta del proyecto, o subiendo la carpeta `dist/` a
  mano): hay que repetir ese paso después de `npm run build` con los archivos nuevos.

Para las Edge Functions, la primera vez en una máquina hace falta instalar el CLI de Supabase y conectarlo
a tu proyecto (una sola vez):
```
npm install -g supabase
supabase login
supabase link --project-ref TU_PROJECT_REF   # Supabase → Project Settings → General
```
Después, cada `supabase functions deploy <nombre>` ya sabe a qué proyecto apuntar.

**Ojo con las Edge Functions que dependen de `_shared/`.** `notificar`, `comprobante-pdf` y `maestro-pdf`
no son autocontenidas: importan código de `supabase/functions/_shared/` (el generador de PDF y el
encabezado, entre otros). El CLI arma el paquete siguiendo esos imports y los busca en tu carpeta local, al
lado de la función -- si te falta esa carpeta o quedó desactualizada, el deploy falla con un error tipo
`Module not found ".../_shared/pdf-comprobante.ts"`. Por eso, **aunque te diga que "solo cambió tal
archivo", lo más seguro es siempre llevar la carpeta `supabase/` completa** (migraciones + functions,
incluyendo `_shared/`) del zip a tu proyecto, en vez de copiar archivo por archivo -- así nunca falta una
pieza. `notificar` en particular necesita, directa o indirectamente: `_shared/pdf-comprobante.ts`,
`_shared/pdf-encabezado.ts`, `_shared/solicitud-detalle.ts` y `_shared/logo.ts`.

**Para esta entrega puntual (rediseño del correo):** lo único que edité es
`supabase/functions/notificar/index.ts` -- no hay migración nueva ni cambios en `src/`, así que no hace
falta tocar Vercel. Pero para que `supabase functions deploy notificar` compile, tu proyecto igual necesita
tener la carpeta `_shared/` completa (ver el párrafo de arriba) -- no basta con el archivo `index.ts` solo.

**La causa real del error "Module not found" (encontrada recién): venías desplegando desde el Dashboard de
Supabase, no desde el CLI.** Confirmamos que tu carpeta `_shared/` local ya estaba idéntica a la mía *antes*
del error -- así que el contenido nunca fue el problema. El Dashboard (Supabase → Edge Functions → editor
web) edita y despliega **una función a la vez, sin acceso a otras carpetas de tu proyecto**: no tiene forma
de "ver" `_shared/`, sin importar lo que tengas en tu disco. Por eso tu `notificar` original (antes de este
rediseño) funcionaba bien ahí: no importaba nada de `_shared/`, tenía su propio generador de PDF adentro del
mismo archivo. Al rediseñarla para que reuse el generador compartido (mismo PDF que el comprobante
descargable, ver más abajo por qué), pasó a necesitar algo que el Dashboard no puede darle.

Mirando tu lista de funciones en el Dashboard, además, confirmamos que **`comprobante-pdf` y `maestro-pdf`
nunca se llegaron a desplegar** (solo aparecen `invitar-usuario` y `Notificar`) -- las dos también dependen
de `_shared/`, así que el mismo límite del Dashboard las bloqueó desde un principio. Esto explica, de paso,
el error de "CORS" al exportar el maestro en PDF: cuando una Edge Function no existe, Supabase no le devuelve
la respuesta con encabezados CORS a la solicitud previa (preflight) del navegador, y Chrome lo muestra como
si fuera un bloqueo de CORS -- aunque el problema real es que la función simplemente no está desplegada. Se
arregla desplegando `comprobante-pdf` y `maestro-pdf` igual que `notificar` (ver más abajo), no es un tema de
configuración de CORS en el código.

**Conclusión: para `notificar`, `comprobante-pdf` y `maestro-pdf` hay que usar el CLI de Supabase, no el
Dashboard.** El Dashboard sigue sirviendo perfecto para `invitar-usuario` (esa sí es autocontenida). Cómo
instalar el CLI, según tu sistema operativo (verificado contra la documentación oficial de Supabase):

- **macOS**: `brew install supabase/tap/supabase`
- **Windows**:
  ```
  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
  scoop install supabase
  ```
- **Linux**: `npm install supabase --save-dev` en la carpeta del proyecto, y despues usar `npx supabase ...`
  en vez de `supabase ...` en todos los comandos de abajo (o bajar el `.deb`/`.rpm` desde
  github.com/supabase/cli/releases).

(`npm install -g supabase`, que te sugerí en una entrega anterior, no es el método que Supabase documenta
hoy -- mejor usa el de tu sistema operativo de la lista de arriba.)

Después, desde la carpeta raíz de tu proyecto (donde tienes `supabase/`, `src/`, `package.json`):
```
supabase init
supabase login
supabase link --project-ref qpezxjcbypshdtfpcfvs
```
(`supabase init` no debería tocar tus migraciones ni funciones existentes -- solo agrega el archivo de
configuración que falta, que es lo único que le faltaba a tu proyecto para poder usar el CLI. El
`project-ref` es el que aparece en tus URLs de Supabase; confírmalo en Project Settings → General si no es
ese.)

**Importante antes del primer deploy por CLI -- el nombre no puede cambiar.** Tu función ya desplegada se
llama **`Notificar`** (con N mayúscula, así aparece en tu Dashboard), y el frontend la invoca exactamente con
ese nombre (`supabase.functions.invoke('Notificar', ...)` en `src/db/data.js`). El CLI, en cambio, despliega
usando el nombre de la carpeta local, que en el proyecto es `notificar` (minúscula) -- **si desplegás tal
cual, el CLI puede crear una función nueva y separada `notificar`, distinta de tu `Notificar` real**, y el
frontend seguiría llamando a la de siempre sin ver ningún cambio. Para evitar eso, antes de desplegar por
primera vez, renombra la carpeta local para que coincida exactamente:
```
mv supabase/functions/notificar supabase/functions/Notificar
```
Y despliega con ese mismo nombre:
```
supabase functions deploy Notificar
supabase functions deploy comprobante-pdf
supabase functions deploy maestro-pdf
```
(`comprobante-pdf` y `maestro-pdf` sí pueden ir en minúscula tal cual están, porque nunca existieron antes
en el Dashboard con otro nombre -- no hay nada que puedan pisar mal.)

## 2. Qué se agregó

- **Rol `prevencionista`**, con menú propio: solo ve **Homologación SST**.
- **Contratación** (menú de RRHH/admin): por cada solicitud de **ingreso ya aprobada**, se puede iniciar una
  o más contrataciones (una por persona, por si la solicitud pide varias vacantes). Cada contratación guarda
  el candidato, el **canal** (recomendación / reclutamiento y selección) y el **tipo de trabajador**
  (administrativo / operativo) — ambos editables mientras no esté cerrada.
- **Checklist de documentos**: catálogo único (tabla `documentos_checklist`) sembrado con las dos listas que
  diste, marcando en cuál de los dos checklists aparece cada documento. Los 9 documentos que se repetían en
  ambas listas (cédula, AFP, previsión, residencia, correo, cuenta bancaria, estado civil, finiquito,
  cotizaciones) quedaron como un solo ítem que aplica a los dos tipos.
- **Subida de documentos** a un bucket de Storage privado (`contratacion-documentos`), con progreso de
  documentos obligatorios y estado automático (`en_proceso` → `documentos_completos` vía trigger).
- **"Marcar como contratado"**: crea o actualiza (por RUT) la fila en `trabajadores` y la vincula a la
  contratación — con eso, esa persona queda en el maestro de dotación normal.
- **Homologación SST**: el prevencionista ve la lista de contrataciones en curso y, de cada una, primero los
  documentos marcados `requerido_homologacion = true` (Contrato + Cédula/Pasaporte) — a medida que RRHH los
  sube. Además, en un panel desplegable "Otros documentos del trabajador" puede abrir cualquier otro
  documento ya subido del checklist de contratación, por si necesita revisar algo puntual. Sigue siendo
  acceso de **solo lectura** (no puede subir, reemplazar ni borrar nada) — eso lo controla RLS en la base de
  datos, no solo la pantalla. Además, al iniciar la contratación le llega un **correo automático** al
  prevencionista del centro de costo avisándole (ver más abajo) — no tiene que estar revisando la pantalla a
  cada rato para enterarse de que hay un caso nuevo.
- **Checklist de documentos** (menú admin): CRUD del catálogo — qué aplica a administrativo/operativo, si es
  obligatorio, si es visible para homologación, activo/inactivo.

## 3. Decisiones que tomé y quedan abiertas para ajustar

- **`requerido_homologacion` por documento**: ajustado con la migración `0003_ajuste_checklist_homologacion.sql`
  según la Matriz SST R19-PTMD-SST-07 que confirmaste. Ahora **solo 2 documentos** quedan visibles para el
  prevencionista: **Contrato de Trabajo** (ítem nuevo, no existía en el checklist) y **Cédula de identidad o
  pasaporte, según corresponda**. El resto del checklist de contratación (AFP, previsión, título, licencia de
  conducir, carnet experto en prevención, resolución Seremi, etc.) queda con `requerido_homologacion = false`,
  porque esos documentos/certificaciones/cursos los gestiona Prevención directamente y no pasan por RRHH.
  Sigue siendo 100% editable desde **Checklist de documentos** sin tocar código ni la base, por si en el
  futuro cambia qué necesita Prevención.
- La contratación se inicia **manualmente** desde la vista Contratación (no automático al aprobarse la
  solicitud), porque quien identifica al candidato y el canal es RRHH, después del proceso de
  reclutamiento/recomendación.
- No toqué `crear_solicitud()`, el trigger de aprobaciones, ni ninguna tabla/política existente — todo lo
  nuevo es aditivo.
- La app SSI-SST (homologaciones ante clientes) queda tal cual, sin relación con este módulo — según lo
  conversado, este módulo vive solo dentro de RRHH.
- Asumí que hay una función `rol_actual()` **nueva** (no existía antes en RRHH); si ya tienes una función
  equivalente para leer el rol dentro de policies, avísame y ajusto la migración para reusarla en vez de
  crear una nueva.

## 4. Solicitudes de cambio: aumento de sueldo, bono, cambio de cargo, renovación

- **Rol nuevo `supervisor`**: mismo menú que `solicitante` (Inicio, Nueva solicitud, Mis solicitudes), pero
  en "Nueva solicitud" ve 4 pestañas distintas — Aumento de sueldo, Bono, Cambio de cargo, Renovación — sobre
  un trabajador **ya contratado** (se elige de una lista, igual que en Traslado). `admin` ve las 6 pestañas
  (las 2 de `solicitante` + las 4 de `supervisor`).
- **Aprobación**: una sola persona, el **administrador de obra** del centro de costo del trabajador (mismo
  dato `centros_costo.admin_obra_id` que ya usa ingreso/traslado) — no pasa por Gerente de Operaciones. Esa
  persona sigue siendo del rol `aprobador` de siempre y las ve en su **Bandeja** habitual, sin nada nuevo que
  configurar de su lado.
- **Notificación a RRHH**: reutiliza el mismo mecanismo que ya dispara Bandeja al aprobar/rechazar
  cualquier solicitud (`Data.notificar('cambio_estado', ...)`) — no tuve que tocar nada para que esto pase
  también con estos 4 tipos nuevos.
- **Importante — esto lo construí sin ver 4 piezas que no tengo**: la función `crear_solicitud()` que ya usan
  ingreso/traslado, el trigger que recalcula `solicitudes.estado`/tiempos al decidir una aprobación, la
  función `mi_bandeja()`, y el código de la Edge Function `notificar`. Por eso, en vez de extenderlas a
  ciegas, hice un camino **100% aditivo y separado**: un RPC nuevo (`crear_solicitud_cambio`) que hace su
  propio insert en `solicitudes` + `aprobaciones`, y de ahí en adelante todo pasa por la Bandeja / `decidir()`
  / `notificar` **existentes, sin modificarlos** — el código cliente de esas pantallas nunca distingue por
  tipo de solicitud, así que debería funcionar solo. Si al probarlo algo no aparece en la Bandeja del
  administrador de obra, o el correo a RRHH sale con el texto "raro" para estos tipos nuevos, pásame esas 4
  piezas (o el mensaje de error) y lo dejo afinado.
- Los campos de cada formulario son mínimos a propósito (trabajador + 2-3 campos + motivo). Si necesitas
  algún campo más por tipo, se agrega fácil.

**Validación pedida: ¿de verdad pasa por el aprobador del centro de costo y avisa a RRHH?** Repasé el código
(no solo lo escribí, esta vez lo releí línea por línea) para confirmarlo:

- `crear_solicitud_cambio()` (`0007_solicitudes_cambios_rpc.sql`) busca el `centro_costo_id` del trabajador,
  de ahí el `admin_obra_id` de ese centro, y crea **una sola fila** en `aprobaciones` con ese aprobador --
  exactamente el mismo dato que usa ingreso, para los 4 tipos (aumento de sueldo, bono, cambio de cargo,
  renovación). Si ese centro todavía no tiene administrador de obra asignado, la solicitud **no se crea** y
  el supervisor ve un error claro pidiendo que se asigne primero en "Centros de costo" -- para que no quede
  una solicitud creada sin quién la apruebe.
- Ya releí el código completo de la Edge Function `notificar` (antes no lo tenía; ahora sí, por el trabajo del
  encabezado) y confirmé que el tramo "aprobada" no distingue por tipo de solicitud en ningún punto -- arma el
  PDF y le escribe a solicitante + aprobadores + **todos los `perfiles` con `rol = 'rrhh'` y activos**, sea cual
  sea el tipo. `DOCUMENTO_CODIGOS`/`TIPO_LABELS`/`detalleLineas` (`_shared/solicitud-detalle.ts`) también
  tienen entradas completas para los 4 tipos nuevos, así que el PDF adjunto no sale con el código o el
  detalle en blanco.
- También releí `bandeja.js`: al aprobar o rechazar, siempre llama a `Data.notificar('cambio_estado', ...)`
  sin importar el tipo de la solicitud -- no hay ningún camino especial para ingreso/traslado que estos 4
  tipos nuevos se salten.
- La única pieza que sigue sin estar a la vista (no vive en este proyecto) es **el trigger de la base de
  datos que recalcula `solicitudes.estado`** cuando cambia una fila de `aprobaciones` -- es lo que decide
  cuándo una solicitud pasa a "aprobada". No lo puedo leer, pero como ese mismo trigger ya tiene que soportar
  2 aprobadores (ingreso) y 3 (traslado) desde antes de este módulo, casi seguro cuenta filas de forma
  genérica ("¿falta alguien por decidir?", no "¿ya decidieron exactamente 2/3?") -- con lo cual el caso de 1
  solo aprobador (estos 4 tipos) debería quedar cubierto igual, sin necesidad de tocarlo. Aun así, esto es lo
  único de esta lista que no pude confirmar leyendo código, así que la prueba real (crear una solicitud de
  aumento de sueldo, aprobarla como administrador de obra, y confirmar que pasa a "Aprobada" y que a RRHH le
  llega el correo) sigue pendiente de hacerse una vez en el ambiente real.

**Validación pedida: aviso al prevencionista al iniciar la contratación.** Acá sí encontré un vacío real (no
era solo cuestión de confirmar): **no existía ningún aviso**. Lo que hay hoy es que el prevencionista puede
entrar a "Homologación SST" y ver ahí las contrataciones en curso -- pero nada le avisaba proactivamente
cuando aparecía una nueva. Lo agregué:

- Nuevo tipo de aviso en la Edge Function `notificar` (`type: 'contratacion_iniciada'`): busca el centro de
  costo de la solicitud de ingreso, y de ahí su `centros_costo.prevencionista_id` (la columna que agregó
  `0009_homologacion_por_centro.sql`). Si lo encuentra (activo, con correo), le manda un correo con el
  nombre del candidato, el cargo, el centro/obra y un botón a "Homologación SST". Reusa el mismo mecanismo
  de correo (Microsoft Graph) que ya usan los otros dos avisos -- nada nuevo que configurar de ese lado.
- Se dispara solo, apenas RRHH aprieta "Crear contratación" (`src/views/contrataciones.js`) -- justo el
  momento que describiste: ya está en el proceso y ya cargó los datos del candidato/cargo.
- **Si el centro de costo todavía no tiene prevencionista asignado, no fallaba en silencio**: la contratación
  se crea igual (para no bloquear a RRHH), pero en vez del mensaje de éxito normal le sale un aviso en
  pantalla diciéndole que asigne un prevencionista en "Centros de costo" -- porque si no, nadie se entera
  nunca de que hay que homologar a esa persona.
- **Importante, para que lo confirmes**: hoy "Contratación" (y por lo tanto este aviso) **solo existe para
  solicitudes de tipo `ingreso`** (`Data.solicitudesIngresoAprobadas()` filtra por `tipo = 'ingreso'`) --
  Traslado mueve a alguien que ya está contratado, no pasa por "Contratación" ni por "Homologación" hoy. Tu
  mensaje decía "ingreso y traslado" -- si además quieres que un traslado dispare una homologación (por
  ejemplo, porque el centro/cliente de destino tiene sus propios requisitos SST), avísame: es un alcance
  distinto al que agregué ahora (no hay una "contratación" que crear, sería un aviso directo al prevencionista
  del centro destino cuando el traslado queda aprobado) y prefiero construirlo a propósito en vez de asumirlo.
- No pude probar el envío real del correo (necesita las credenciales de Microsoft Graph del proyecto, que no
  tengo acá) -- sí rendericé la plantilla con datos de ejemplo para confirmar que el texto y el botón se ven
  bien. Falta desplegar de nuevo la función (`supabase functions deploy notificar`) para que quede activo.

## 5. Comprobantes, maestro de solicitudes, Perfil del trabajador y aviso de vencimientos

1. Correr **`supabase/migrations/0008_fecha_termino_contrato.sql`**: agrega a `trabajadores` las columnas
   `fecha_termino_contrato` (date) y `contrato_indefinido` (boolean). Ambas son editables a mano (en
   Trabajadores, fila por fila, o por Excel) y además se actualizan solas cuando se **aprueba** una
   solicitud de **Renovación**: si trae fecha exacta, esa pasa a ser `fecha_termino_contrato`; si se marcó
   "pasa a indefinido", se limpia la fecha y `contrato_indefinido` queda en `true` (ese trabajador deja de
   aparecer en el aviso de vencimientos y se puede seguir "renovando" sin límite — sueldo, cargo, etc.).
2. Correr **`supabase/migrations/0009_homologacion_por_centro.sql`**: agrega `centros_costo.prevencionista_id`
   (mismo patrón que `admin_obra_id`) y acota el acceso de lectura del prevencionista a las contrataciones
   del/los centro(s) donde quedó asignado (antes cualquier prevencionista veía todas). Asígnalo en
   **Centros de costo**, igual que el administrador de obra.
3. `npm install && npm run build`. Sin variables `.env` nuevas para el frontend.
4. Para el aviso de vencimientos (correo, no genera documento): desplegar la Edge Function nueva
   `vencimientos-contrato` (`supabase functions deploy vencimientos-contrato --no-verify-jwt`, mismos
   secrets de Graph que ya usan `notificar`/`invitar-usuario`) y programarla para correr **una vez al día**:
   la forma más simple es Supabase Dashboard → Edge Functions → `vencimientos-contrato` → **Cron Triggers**
   (ej. `0 13 * * *`, ~10:00 Chile). Si tu plan no tiene Cron Triggers de Edge Functions, la alternativa es
   `pg_cron` + `pg_net` llamando la función por HTTP con la `service_role key` — lo dejo fuera de las
   migraciones porque cambia según el plan/proyecto; aviso si quieres que te deje ese SQL también.

**Qué se agregó:**

- **Comprobante de solicitud** (los 6 tipos): un botón "📄 Ver comprobante" en Mis solicitudes, Bandeja,
  Solicitudes e Historial, y también desde el Perfil del trabajador. Muestra código, tipo, estado, detalle
  completo y la tabla de aprobaciones con sus tiempos de respuesta (por aprobador: asignado, decidido,
  tiempo de respuesta), con el **encabezado y la codificación oficial de Metalium**. Se descarga como un
  PDF real (botón "⬇️ Descargar PDF") — el detalle está en la sección 6 de más abajo.
- **Maestro de solicitudes**: en **Solicitudes**, "Exportar maestro (Excel)" trae TODAS las solicitudes de
  los 6 tipos (independiente del filtro en pantalla), una fila por solicitud, con el detalle aplanado a
  texto y columnas de Aprobador/Decisión/Asignado/Decidido/Tiempo de respuesta por cada aprobador que haya
  tenido; "⬇️ Exportar maestro (PDF)" trae el mismo universo como un listado imprimible, con el encabezado
  Metalium en cada página (detalle en sección 6).
- **Perfil del trabajador**: se llega con "Ver perfil" desde la tabla que ahora tiene **Trabajadores**
  (antes esa pantalla solo tenía importar/exportar, sin listar personas — se agregó la tabla). Muestra los
  datos base, el vencimiento de contrato (o "Indefinido") y el historial completo de solicitudes/anexos de
  esa persona (traslado, aumento de sueldo, bono, cambio de cargo, renovación — ingreso no aplica porque
  ahí todavía no existe como trabajador), cada una con su comprobante.
- **Trabajadores**: la tabla nueva permite editar `Fecha término contrato` y `Contrato indefinido`
  directamente (auto-guarda, igual que Centros de costo); la plantilla/exportación/importación por Excel
  también suman esas dos columnas ("Fecha Término Contrato" en formato AAAA-MM-DD, "Contrato Indefinido"
  Sí/No).
- **Renovación con plazo indefinido**: el formulario de Nueva solicitud → Renovación ahora tiene un check
  "El contrato pasa a indefinido"; al marcarlo se ocultan/ignoran los campos de fecha y, al aprobarse, el
  trabajador queda con `contrato_indefinido = true` (sin fecha de término, se puede seguir "renovando" sin
  límite de veces — sueldo, cargo, bono, etc.).
- **Aviso de próximos vencimientos** (Edge Function `vencimientos-contrato`, corre sola una vez al día):
  a los **30 y 15 días** antes de `fecha_termino_contrato`, envía un correo a RRHH + Supervisores + el
  Administrador de obra del centro del trabajador. No genera ningún documento, según pediste.
- **Corregí un límite que encontré en la Edge Function `notificar`** (la que ya mandaba el correo de
  aprobación a RRHH): antes solo distinguía "ingreso" vs "traslado" a la hora de armar el PDF adjunto y el
  texto del correo — así que una solicitud de Aumento de sueldo/Bono/Cambio de cargo/Renovación aprobada
  igual disparaba el correo a RRHH (eso ya funcionaba, según lo armado en la ronda anterior), pero el PDF
  adjunto salía con el detalle vacío y etiquetado como "Traslado". Lo dejé con los 6 tipos reconocidos
  correctamente (mismo criterio que el resto de la app).

**Decisiones que tomé y quedan abiertas para ajustar:**

- El aviso de vencimientos asume que **todo** RRHH y **todo** Supervisor deben enterarse de cualquier
  vencimiento (no lo acoté por centro de costo, a diferencia del prevencionista). Si prefieres que cada
  Supervisor/RRHH solo se entere de los vencimientos de su(s) propio(s) centro(s), se puede acotar igual
  que se hizo con `centros_costo.prevencionista_id`.
- El "Perfil del trabajador" no es una vista propia del menú (es un drill-down desde Trabajadores, como ya
  existía para el detalle de una Contratación); si prefieres que tenga su propia entrada en el menú o una
  búsqueda directa por RUT, se agrega fácil.
- Los umbrales del aviso (30 y 15 días) y los destinatarios están fijos en el código de la Edge Function;
  si quieres poder cambiarlos sin re-desplegar (ej. una tabla de configuración), lo puedo mover a la base.

## 6. Encabezado corporativo, codificación y PDFs reales (Código / Folio)

A partir del Excel de ejemplo que pasaste (banda azul + logo Metalium) y de la tabla de codificación
(Registro / Código / Folio), dejé **todos los comprobantes descargables como PDF real** (no como una
impresión del navegador) y con el mismo encabezado en todos:

| Registro | Código (fijo del formulario) | Prefijo de Folio |
|---|---|---|
| Ingreso | `RRH-FOR-CON-006` | `RRH-ING-` |
| Traslado | `RRH-FOR-TRA-002` | `RRH-TRA-` |
| Aumento de sueldo | `RRH-FOR-VAR-001` | `RRH-VAR-` |
| Bono | `RRH-FOR-VAR-002` | `RRH-BON-` |
| Cambio de cargo | `RRH-FOR-VAR-003` | `RRH-CAR-` |
| Renovación | `RRH-FOR-CON-007` | `RRH-REN-` |
| Maestro de solicitudes | `RRH-FOR-SOL-001` | (sin folio propio) |
| Correo de vencimientos | — | (no es un documento, según confirmaste) |

Esta tabla vive en dos lugares que deben coincidir (los dejé idénticos): `src/config.js` →
`DOCUMENTO_CODIGOS` (para lo que se ve en pantalla) y
`supabase/functions/_shared/solicitud-detalle.ts` → `DOCUMENTO_CODIGOS` (para lo que arman las Edge
Functions). Si cambia algún código o prefijo, hay que actualizarlo en los dos archivos.

**Cómo funciona el Folio:** es un correlativo real, generado por la base de datos (no por el navegador),
para que nunca se repita ni salte aunque varias personas creen solicitudes al mismo tiempo. La migración
`0010_folio_documentos.sql` agrega la tabla `folios_correlativos` (un contador por tipo) y un trigger que,
al crear una solicitud, le asigna `RRH-XXX-000001`, `000002`, etc. según su tipo. Es 100% aditivo: no toca
la columna `codigo` que ya se genera sola (esa sigue siendo el N° interno de la solicitud); el comprobante
muestra los dos (Folio y N° de solicitud) para que quede clara la diferencia.

**Cómo funcionan los PDF reales:** en vez de depender de que cada usuario use bien la función Imprimir del
navegador (y tenga activado "imprimir gráficos de fondo", que es lo que hace que salga el color), armé el
PDF en el servidor (Supabase Edge Functions), usando la misma librería `pdf-lib` que ya usaba `notificar`
para el correo de aprobación — así el frontend no crece nada.

- **`comprobante-pdf`** (nueva): genera el PDF de una solicitud puntual con el encabezado corporativo
  incrustado. El botón "⬇️ Descargar PDF" del Comprobante la llama y descarga el archivo directo (sin pasar
  por Imprimir). Solo puede descargarlo quien creó esa solicitud, quien es uno de sus aprobadores, o
  rrhh/admin — mismo criterio que ya protege esos datos por RLS en el resto de la app. La vista en pantalla
  (antes de descargar) queda con el mismo diseño, para que se vea igual que el PDF.
- **`maestro-pdf`** (nueva): genera un PDF tabular (hoja apaisada) con TODAS las solicitudes; el mismo
  encabezado en cada página, con "Maestro de solicitudes" y el código `RRH-FOR-SOL-001`. Solo rrhh/admin.
  Complementa al Excel (que sigue siendo la mejor forma de filtrar/ordenar); el PDF es para imprimir o
  archivar tal cual.
- **`notificar`** (la que ya tenías): el PDF que se adjunta al correo de aprobación para RRHH usa exactamente
  el mismo diseño — antes era un PDF aparte, más simple y sin encabezado gráfico.
- **El Excel del maestro NO lleva el encabezado gráfico**: la librería `xlsx` gratuita que usa el frontend no
  soporta insertar imágenes/vectores en el archivo (es una función solo de la versión paga). Le agregué igual
  el código `RRH-FOR-SOL-001` como texto en la parte de arriba de la hoja, y agregué la columna `Folio`; si
  necesitas que el Excel también lleve el diseño completo, la alternativa es usar el PDF del maestro para
  eso, o cambiar a una librería paga de Excel (avísame si quieres que lo evalúe).

**Encabezado "Sistema de Gestión Integrado" (control de documentos):** siguiendo el mockup que me pasaste,
cambié el encabezado de un formato de banda/logo con Código y Folio superpuestos a un diseño de control de
documentos tipo ISO — logo + nombre del documento a la izquierda, y a la derecha un cuadro CÓDIGO / FECHA /
REVISIÓN, con la franja "SISTEMA DE GESTIÓN INTEGRADO" arriba y "RRH / METALIUM" abajo, todo con el corte
diagonal de la identidad Metalium. Se dibuja como vectores (no como imagen de fondo), así que se ve igual de
nítido a cualquier tamaño y en cualquier PDF:

- **En el PDF**: `supabase/functions/_shared/pdf-encabezado.ts` (nuevo) tiene la única función que dibuja
  este encabezado (`dibujarEncabezado`), compartida entre `_shared/pdf-comprobante.ts` y
  `_shared/pdf-maestro.ts` — evita tener la misma geometría duplicada en los dos generadores, y funciona
  igual en la página vertical del comprobante que en la horizontal del maestro. El logo (recortado, sin
  el margen transparente que traía el archivo original) va embebido en `_shared/logo.ts`, mismo mecanismo
  en base64 que ya se usaba para el banner anterior. El PNG anterior (`public/Encabezado_Metalium.png` /
  `_shared/banner.ts`) ya no se usa en estos dos documentos.
- **En pantalla**: `src/ui/encabezado-svg.js` (nuevo) arma un SVG con exactamente las mismas proporciones y
  colores que el PDF (mismas fracciones, mismo ángulo diagonal), para que el "Comprobante" que ves antes de
  descargar calce con el PDF real. Usa `public/Metalium_Logo_Header.png` (el logo recortado) y ajusta
  automáticamente el tamaño de letra si un texto no entra (nombre de tipo largo, código, etc.), igual que
  hace el PDF.
- Como el nuevo cuadro no tiene espacio para Folio y N° de solicitud (solo Código/Fecha/Revisión), ambos se
  movieron al cuerpo del comprobante, junto a Estado/Creada/Fecha de emisión — quedan igual de visibles, solo
  que debajo del encabezado en vez de dentro de él.

El título del documento va en **una sola línea** en negrita (sin cursiva), ej. "Comprobante de solicitud -
Ingreso" o "Comprobante de solicitud - Cambio de cargo" — si el nombre del tipo es largo, el texto se achica
automáticamente para que siempre entre en una línea (probado con "Cambio de cargo", el más largo de los 6
tipos). El maestro usa "Maestro de solicitudes (N)", con N = cantidad de solicitudes listadas. La fecha del
cuadro CÓDIGO/FECHA/REVISIÓN va como `DD/MM/AAAA` (con `/`, igual que en tu referencia).

**Corrección de proporciones (última revisión):** el primer ajuste al diseño de control de documentos había
quedado con el cuadro CÓDIGO/FECHA/REVISIÓN demasiado ancho (cerca de la mitad del encabezado) y no había
notado que, en tu referencia, la franja azul "SISTEMA DE GESTIÓN INTEGRADO" es más ancha que ese cuadro —
sobresale un poco más hacia la izquierda, por encima de parte de la zona blanca del título, en vez de
alinearse con el borde del cuadro de abajo. Volví a medir tu imagen de referencia píxel por píxel (con una
cuadrícula superpuesta para leer las proporciones de forma directa, no solo a ojo) y corregí ambos archivos
(`_shared/pdf-encabezado.ts` para el PDF y `src/ui/encabezado-svg.js` para la vista en pantalla) para que el
cuadro de datos sea angosto (~34% del ancho del encabezado) y la franja "SISTEMA DE GESTIÓN INTEGRADO" tenga su
propio corte diagonal, más ancho (~73%), independiente del cuadro. Verifiqué el resultado comparando mi render
lado a lado con tu imagen antes de volver a entregarlo.

**Separación logo | título y ángulo del corte (segunda corrección):** seguía faltando una línea: en tu
referencia, el logo y el nombre del documento NO comparten una sola celda blanca -- hay un corte diagonal
propio entre ellos (de arriba abajo, en toda la altura del encabezado), y es justo por encima de ese corte
donde arranca la franja "SISTEMA DE GESTIÓN INTEGRADO". Antes esa línea solo se dibujaba en el tramo de esa
franja (arriba), así que no se veía ninguna separación entre "Metalium" y el título. De paso, al remedir esa
línea encontré que el ángulo de los tres cortes diagonales (logo|título, título|código, y la línea
etiqueta|valor dentro del cuadro) también estaba equivocado: lo tenía calculado como una fracción del ancho
de la página, cuando en realidad la referencia usa un ángulo fijo (una pendiente constante), así que ahora los
tres cortes se ven igual de inclinados tanto en la hoja vertical del comprobante como en la horizontal del
maestro -- antes, sin darme cuenta, el ángulo real dependía del ancho de página y por eso se veía distinto
entre ambos. Corregí `_shared/pdf-encabezado.ts` y `src/ui/encabezado-svg.js` una vez más y volví a comparar
lado a lado contra tu imagen de referencia (no contra mi propio render anterior) antes de entregar.

**Reconstrucción desde tu HTML exacto (tercera corrección, la definitiva):** me pasaste el HTML/SVG exacto
que debía respetar, así que esta vez no volví a medir a ojo ni por píxeles sobre una imagen -- tomé las
coordenadas, colores y textos directo de ese código, que pasó a ser la fuente de verdad. Eso permitió
encontrar un error de estructura que las dos correcciones anteriores no habían detectado: el encabezado real
tiene **4 franjas, no 5**. "SISTEMA DE GESTIÓN INTEGRADO" y el bloque CÓDIGO no van en franjas separadas (una
encima de la otra) -- van **en la misma franja azul de arriba, uno al lado del otro**. Debajo van FECHA y
REVISIÓN (blancas) y al final la franja azul RRH / METALIUM. Con las coordenadas de tu SVG también corregí:

- El ángulo exacto de los tres cortes diagonales y la posición exacta de cada uno (dónde empieza el logo,
  dónde termina el título, dónde separa cada etiqueta de su valor) -- antes eran una aproximación medida
  sobre una imagen; ahora son los mismos números de tu código.
- Los colores exactos de cada línea y franja (antes eran una aproximación visual; ahora son los mismos
  códigos de color de tu HTML).
- El título ahora se centra solo en el alto de las 3 franjas de abajo (Fecha/Revisión/RRH-Metalium), no en
  el alto completo del encabezado, igual que en tu referencia.
- El alto del encabezado ahora mantiene siempre la misma proporción que tu referencia (antes tenía un alto
  fijo en puntos que no se ajustaba igual entre la hoja vertical del comprobante y la horizontal del
  maestro).
- Agregué la tipografía **Poppins** (la misma que usa tu HTML) para la vista en pantalla.

Volví a verificar renderizando tu HTML de referencia tal cual (con el mismo motor que uso para revisar el
resto de la app) y comparando el resultado, lado a lado, contra mi propio PDF -- esta vez con la certeza de
que la comparación es contra tu fuente exacta y no contra una captura de pantalla o una medición manual.

Quedan **3 diferencias menores** frente a tu HTML exacto, que prefiero dejar anotadas en vez de darlas por
cerradas:

1. **Poppins solo quedó en la vista en pantalla, no en el PDF descargado.** `pdf-lib` (la librería que arma
   el PDF) no puede tomar una fuente de Google Fonts tan directo como el navegador; el PDF sigue usando una
   fuente estándar (Helvetica) parecida pero no idéntica. Se puede agregar Poppins también ahí, empaquetando
   los archivos de la fuente dentro del proyecto -- avísame si te importa que el PDF quede idéntico en la
   tipografía y lo agrego.
2. **El logo del encabezado sigue siendo el archivo que ya teníamos** (`Metalium_Logo_Header.png`), no el
   PNG exacto que venía incrustado en tu HTML: intenté extraerlo tal cual, pero el texto codificado (base64)
   llegó cortado/dañado en la copia y no se pudo reconstruir la imagen. El que uso es prácticamente el mismo
   logo, pero no es un calco pixel a pixel. Si me compartes el logo como archivo de imagen (PNG o SVG) en vez
   de pegado dentro del HTML, lo reemplazo por el exacto.
3. **El espaciado entre letras de "SISTEMA DE GESTIÓN INTEGRADO"** (el `letter-spacing` de tu CSS) quedó
   replicado en la vista en pantalla, pero no en el PDF, porque `pdf-lib` no soporta esa propiedad
   directamente -- se puede simular escribiendo letra por letra con espacios calculados si te importa que
   se vea idéntico ahí también.

**Franja celeste sobrante debajo del encabezado (cuarta corrección):** en el PDF (comprobante y maestro,
NO en la vista en pantalla) quedaba una línea horizontal justo debajo del encabezado, entre el cuadro y el
contenido ("Estado", "Folio", etc.). No es parte de `dibujarEncabezado` -- era una línea aparte que
dibujaba cada generador de PDF por su cuenta, resabio del banner viejo (de antes del diseño tipo control de
documentos). Al revisar el color con calma encontré algo peor de lo que se veía a simple vista: esa línea
usaba un celeste distinto (`#29ABE2`) al azul real del encabezado (`#1B9BD8`) -- dos azules apenas distintos
conviviendo en el mismo documento. La saqué de raíz en los dos archivos que arman el PDF
(`_shared/pdf-comprobante.ts` y `_shared/pdf-maestro.ts`, que es de donde también sale el PDF que se adjunta
al correo de aprobación de RRHH, porque usa el mismo generador) -- ahora el encabezado pasa directo al
contenido, igual que en tu referencia, sin ninguna línea de más.

**Corrección de texto -- "Integrado", no "Interno" (quinta corrección):** la franja azul de arriba decía
"SISTEMA DE GESTIÓN INTERNO"; el nombre correcto es **"Sistema de Gestión Integrado" (SGI)**. Cambié el
texto en los dos lugares donde se dibuja (`_shared/pdf-encabezado.ts` para el PDF y `src/ui/encabezado-svg.js`
para la vista en pantalla), y de paso en los comentarios de esos archivos y de los generadores que los usan,
para que el código no quede hablando de "Interno" en ninguna parte. "Integrado" es dos letras más largo que
"Interno" -- revisé que igual entra holgado en la franja, tanto en el comprobante como en el maestro, sin
necesidad de achicar la letra.

**Decisiones que tomé y quedan abiertas para confirmar/ajustar:**

- "REVISIÓN" la dejé fija en `00` (no hay todavía un control de versiones de los formularios); si quieres que
  se pueda editar o que suba automático cuando cambie algo del formulario, lo agrego.
- El PDF del comprobante es de una sola página en casi todos los casos (rara vez una solicitud tiene tantas
  aprobaciones o tanto detalle como para no entrar); si no entra, agrega más páginas automáticamente, pero
  el encabezado solo sale en la primera hoja de cada documento (es lo normal en membretes corporativos). El
  PDF del maestro sí repite el encabezado en cada página, porque ahí es una lista larga.

## 7. Rediseño visual de los correos

Pediste mejorar el diseño de los correos -- hasta ahora todos (`pendiente_aprobador`, `cambio_estado` y el
nuevo `contratacion_iniciada` de la sección 4) salían con una plantilla mínima: texto plano, sin colores de
marca y **sin el logo** (no se estaba mandando ninguna imagen). Rediseñé la plantilla compartida en
`supabase/functions/notificar/index.ts`, así que el cambio aplica automático a los 4 correos que manda el
sistema hoy, sin tocar nada fuera de ese archivo:

- **Misma paleta que el encabezado del PDF**: el azul de marca (`#1B9BD8`), el azul oscuro para los textos
  destacados y los grises para las etiquetas -- para que un correo y un comprobante PDF se vean como parte
  del mismo sistema.
- **El logo ahora sí aparece.** Antes no se mandaba ninguna imagen. Un `<img>` con el logo pegado como texto
  base64 (que es la forma más simple) en general **Outlook/Exchange lo bloquea o lo rompe** dentro del cuerpo
  del correo -- así que lo mandé como Microsoft Graph manda las imágenes que sí se ven siempre: un adjunto
  normal (`fileAttachment`) marcado como imagen en línea (`contentId` + `isInline: true`), y en el HTML el
  `<img>` apunta a ese identificador (`cid:metalium-logo`) en vez de a un archivo. Reutiliza el mismo logo
  que ya estaba disponible en `_shared/logo.ts`, no hubo que agregar ningún archivo nuevo.
- **Tarjeta de datos en vez de puro texto corrido**: Tipo / N° de solicitud / Folio (o, en el correo al
  prevencionista, Candidato / Cargo / Centro de costo / Canal / Tipo de trabajador / Solicitud) ahora se ven
  en una tabla con etiqueta y valor, en vez de mencionados dentro de una oración -- se lee mucho más rápido
  que un párrafo con todo mezclado.
- **Estado con una etiqueta de color** ("Aprobada" en verde, "Rechazada" en rojo) en vez de solo la palabra
  suelta en el texto.
- El botón ("Ir a la bandeja" / "Ver mis solicitudes" / "Ver en SSI-RRHH" / "Ir a Homologación SST") se
  mantiene igual en su lógica -- solo aparece si `APP_URL` está configurado -- pero con el mismo azul de
  marca.

No hizo falta ninguna migración ni ningún secreto nuevo: usa las mismas credenciales de Microsoft Graph que
ya estaban configuradas. Sí hace falta **volver a desplegar la función** para que quede activo:

```
supabase functions deploy notificar
```

**Lo que no pude probar desde acá:** no tengo las credenciales de Microsoft Graph de tu proyecto en este
ambiente, así que no pude mandar un correo real y verlo en Outlook. Lo que sí hice fue renderizar las 4
plantillas con datos de ejemplo (mismo HTML que genera la función, con el logo reemplazado por el archivo
local nada más para poder verlo en esta prueba) y revisar visualmente que el diseño, los colores y el logo
se vean bien. Casi todos los clientes de correo modernos (incluido Outlook/Exchange, que es el que usa este
proyecto) soportan bien las tablas con estilos en línea que usé, así que debería verse igual en la bandeja
real -- pero te recomiendo confirmarlo con un envío de prueba una vez desplegada la función, por si Outlook
le hace algún ajuste extra a las imágenes en línea que no se puede ver en una prueba local.

## 8. Rediseño del Excel del "Maestro de solicitudes"

Pediste que el Excel del maestro tuviera el mismo diseño que un Excel de otro sistema tuyo (evaluaciones de
desempeño) que me compartiste de ejemplo, adaptado a la información de acá y con los códigos propios de cada
tipo de formulario. El Excel que se descargaba hasta ahora era texto plano -- sin colores, sin logo, título y
encabezados en letra normal -- porque la librería que se usaba para generarlo (`xlsx`, la gratuita más común
en JS) **no soporta escribir estilos de celda ni imágenes**, solo datos; lo confirmé probándolo directo antes
de tocar nada, para no prometer algo que la librería no puede dar. La cambié por otra igual de gratuita,
**ExcelJS**, que sí soporta colores de celda, texto en negrita, celdas combinadas e imágenes incrustadas.

Mi primer intento (que llegué a entregarte) rearmaba el encabezado "a mano" -- una barra de título azul
oscuro con el nombre del sistema, en vez de usar el diseño real. Cuando me mostraste de nuevo el HTML de
referencia y el Excel de evaluaciones, quedó claro que lo que corresponde es el encabezado corporativo real
("Sistema de Gestión Integrado" con el corte diagonal), el mismo que ya se usa en el comprobante en pantalla
y en el PDF -- no una versión inventada. Lo corregí: ahora el Excel usa **exactamente ese mismo encabezado**
(`src/ui/encabezado-svg.js`), convertido a imagen e incrustado arriba de la planilla.

El Excel del maestro ahora tiene:

- El **encabezado corporativo real** arriba (logo, corte diagonal, "Sistema de Gestión Integrado", título
  "Maestro de solicitudes", y el cuadro CÓDIGO / FECHA / REVISIÓN / RRH · METALIUM) -- el mismo que ves en
  pantalla al abrir un comprobante y en el PDF, no una versión distinta hecha para el Excel. El código que
  muestra es `RRH-FOR-SOL-001`, la fecha es la del día en que se genera el archivo, y la revisión queda en
  `00` (no tiene historial de revisiones propio, a diferencia de los formularios individuales).
- Debajo del encabezado, la cantidad de solicitudes incluidas (ej. "37 solicitud(es)").
- Una columna nueva, **"Código de formulario"**: el código SGC que le corresponde a cada fila según su tipo
  (por ejemplo `RRH-FOR-CON-006` para Ingreso, `RRH-FOR-TRA-002` para Traslado) -- la misma tabla de códigos
  que ya usa el PDF (`DOCUMENTO_CODIGOS` en `src/config.js`), no un valor inventado aparte.
- La columna **Estado resaltada por color**: verde para aprobada, rojo para rechazada, ámbar para pendiente
  -- se puede escanear de un vistazo sin tener que leer cada celda.
- Encabezados de columna en azul con texto blanco, filas de datos alternadas (zebra) para que sea más fácil
  seguir una fila larga, columnas con ancho ajustado al contenido (no el ancho por defecto), fila de
  encabezados congelada (`freeze panes`) para que no se pierda de vista al bajar, y un autofiltro en los
  encabezados para que puedas filtrar/ordenar directo en Excel.
- Se mantienen exactamente las mismas columnas de datos que ya tenías (Folio, N° de solicitud, Tipo, Estado,
  Solicitante, Trabajador, Centro origen, Centro destino, Fecha de creación, Detalle, Motivo, y el bloque de
  Aprobador/Decisión/Asignado/Decidido/Tiempo de respuesta por cada aprobador) -- no se perdió ningún dato,
  solo se le agregó diseño encima.

**Cómo se genera la imagen del encabezado (para quien toque este código después):** el encabezado es un SVG
(no una imagen fija), para que quede siempre igual al de pantalla/PDF aunque cambien los textos. Al exportar,
ese SVG se "convierte a foto" (se dibuja en un canvas y se saca como PNG) para poder incrustarlo en el Excel,
porque Excel no sabe dibujar SVG ni el corte diagonal directamente. Esa conversión tiene 3 detalles que no
son obvios -- no tiran error si están mal, hay que *mirar* el resultado para notarlos, y los encontré recién
al revisar la imagen ya generada, no antes:

1. El SVG del encabezado no trae ancho/alto explícitos (solo la proporción). Si no se le fijan antes de
   convertirlo, el navegador lo rasteriza primero en un tamaño chico por defecto y se pierde nitidez.
2. El logo, que va dentro de ese mismo SVG, no se pintaba de forma confiable al hacer esta conversión
   (aunque sí se ve bien si abrís el SVG como página aparte) -- así que se agrega aparte, como una segunda
   imagen sobre la misma foto final, en vez de depender de que quede incluido en el SVG.
3. La tipografía (Poppins, con Arial de respaldo) vive en una hoja de estilos aparte que no viaja con el SVG
   al convertirlo -- si no se fija a mano en ese momento, el texto sale en la fuente por defecto del
   navegador en lugar de la que corresponde.
   
   Los tres quedaron corregidos y verificados visualmente (no solo "no tira error") antes de entregar esto,
   generando el Excel real en un navegador de verdad y mirando el resultado.

**Cómo se aplica esta entrega:** cambié `src/views/solicitudes.js` (agregó el encabezado corporativo al
Excel) y `src/config.js` (nada en Supabase, sin migración ni Edge Function) y agregué una dependencia nueva
al proyecto (`exceljs`, gratuita, licencia MIT). Entonces para que quede activo: llevas los archivos
actualizados a tu proyecto, corres `npm install` (para que baje la dependencia nueva) y luego el build/deploy
de siempre en Vercel -- nada de Supabase ni del CLI para este cambio en particular.

**Costo a tener en cuenta:** `exceljs` es una librería bastante más pesada que la anterior -- el archivo
JavaScript de la app creció de ~825 KB a ~1,76 MB (antes de comprimir; comprimido son ~503 KB en vez de
~244 KB). Para una app interna como esta, con pocos usuarios, no debería notarse en la práctica, pero te lo
dejo anotado por transparencia. Si en algún momento te empieza a molestar el tiempo de carga inicial, se
puede cargar `exceljs` solo cuando se aprieta "Exportar maestro" (import dinámico) en vez de siempre -- no lo
hice ahora para no sumar complejidad sin que la hayas pedido, pero es una optimización simple si hace falta.

**Qué no toqué:** el importador/exportador de trabajadores (`src/views/trabajadores.js`, plantilla y maestro
de trabajadores) sigue usando la librería anterior (`xlsx`) tal cual estaba -- no lo pediste y prefiero no
tocar algo que no está roto sin que me lo confirmes. Si quieres que ese Excel tenga el mismo diseño, es la
misma técnica y lo puedo hacer.

## 9. Pendiente / sugerido para después

- No agregué KPIs de contratación al Dashboard (tiempos hasta "documentos completos", por canal, etc.) —
  puedo agregarlo si quieres, siguiendo el mismo patrón del dashboard actual.
- No agregué borrado de documentos ya subidos (solo "reemplazar"); si necesitas poder sacar uno sin
  reemplazarlo, lo agrego.
- Sigue abierto si un **traslado** también debería avisarle a algún prevencionista (ver sección 4) -- es un
  alcance distinto al que ya está implementado (que hoy solo cubre ingreso) y prefiero construirlo a
  propósito cuando me confirmes cómo tiene que funcionar.
