# Orden de ejecución de las migraciones

**Antes que nada**: `sgc_schema.sql` y `sgc_catalogos_seed.sql` (el esquema
completo y los catálogos) **no están en esta carpeta** — ya los ejecutaste
hace tiempo y siguen corriendo en tu proyecto de Supabase. Todo lo de aquí
son cambios incrementales sobre esa base.

Si vas a montar un proyecto de Supabase **nuevo** desde cero, necesitas
esos dos archivos primero (los tienes de entregas anteriores) — sin ellos,
ninguna de estas migraciones va a funcionar.

## Orden real (de más antigua a más reciente)

1. `migracion_es_admin.sql`
2. `migracion_delegados.sql`
3. `migracion_garantia_legal.sql`
4. `migracion_recepcion_definitiva.sql`
5. `migracion_postventa_rpc_publico.sql`
6. `migracion_notificaciones.sql`
7. `migracion_notificaciones_email_v2.sql` *(ignora `migracion_notificaciones_email.sql` sin el `_v2` — quedó obsoleta, usaba `ALTER DATABASE` que el SQL Editor no puede ejecutar)*
8. `migracion_notificar_evaluacion_asignada.sql`
9. `migracion_notificar_autoeval_enviada.sql`
10. `migracion_fix_recursion_rls.sql`
11. `migracion_fix_rls_autoeval.sql`
12. `migracion_fix_rls_eva_evaluaciones.sql`
13. `migracion_entrega_resultado.sql`
14. `migracion_fix_tokens_internos.sql`
15. `migracion_fix_alertas_multiples.sql` *(reemplaza por completo la lógica de `migracion_fix_dimension_critica.sql` — puedes saltarte esa)*
16. `migracion_fix_severidad_nullable.sql`
17. `migracion_notificar_ticket_asignado.sql`
18. `migracion_notificar_actividad_asignada.sql`
19. `migracion_notificar_accion_nc.sql`
20. `migracion_correo_detallado.sql` *(reemplaza la función del paso 19 por una versión con correo detallado)*
21. `migracion_fix_trigger_accion_nc.sql`
22. `migracion_fix_rls_sup_definitivo.sql`
23. `migracion_consolidacion_rpc.sql`
24. `migracion_buscar_perfiles_correo.sql`
25. `migracion_rls_gestion_trabajadores.sql` *(reemplaza por completo a `migracion_permisos_admin_trabajadores.sql` — puedes saltarte esa)*
26. `migracion_ficha_trabajador.sql` *(opcional — la Ficha del Trabajador funciona sin ella; abre la visibilidad del admin global sobre Personal y deja que cada persona vea sus propios registros de NC/Postventa en su ficha. Es repetible.)*
27. `migracion_eva_flujo_bienestar.sql` **(obligatoria)** — nuevo flujo de cierre de Evaluación de Personal, checklist de la entrevista, acta de firmas, catálogos de la planilla oficial y rol Crecimiento y Bienestar. Es repetible.
28. `migracion_prov_gol_cartas.sql` **(obligatoria si usas Proveedores)** — GOL reemplaza al comité y la carta al proveedor se gestiona desde el sistema. Es repetible.

29. `migracion_eva_motor_pdi.sql` **(obligatoria)** — el motor de PDI de la
    planilla oficial: la batería corporativa de 160 cursos, la matriz curso ×
    familia de cargos, el cruce criterio × curso y la regla nota → prioridad.
    Reemplaza al recomendador anterior (categoría + dimensión más débil). Es
    repetible.
30. `migracion_eva_acta_v2.sql` **(obligatoria)** — reconciliación con la v2.0
    del formulario: checklist de 26 ítems con marca de obligatorios, cuarta
    firma del acta (Jefatura de Bienestar y Crecimiento) y derivación del
    expediente. Es repetible.

31. `migracion_eva_motor_secciones.sql` **(obligatoria)** — la lectura por
    sección: el promedio de cada una de las cinco secciones cae en un tramo
    (NC/PD/C/SE/EX) y ese tramo dice qué recomendar para la sección completa.
    Sale de las hojas 06 y 07 del listado. Es repetible.

32. `migracion_eva_fortalezas.sql` **(obligatoria)** — el otro lado del motor:
    qué pasa cuando sale bien. Candidaturas a relator interno N4 desde los
    criterios con nota 5, reconocimiento formal de las secciones en EX y líneas
    de profundización para las que quedan en SE. Depende de la 29 y de la 31.
    Es repetible.

33. `migracion_eva_filtro_cargo.sql` **(obligatoria)** — filtrar por cargo. Los
    cursos que no aplican a la familia dejan de mezclarse con los que sí, y se
    agrega la matriz criterio × familia para que RRHH marque qué no corresponde
    a cada oficio. Nace entera en «sí aplica»: correrla no cambia nada hasta que
    RRHH la cure. Depende de la 29, la 31 y la 32.

34. `migracion_eva_cargos_no_evaluables.sql` **(obligatoria)** — el catálogo de
    cargos gana la columna `evaluable` y entra «Gerente General», que **no estaba
    en tu hoja 13_MAESTROS**: los cinco gerentes que figuran ahí son Operaciones,
    Ingeniería, Finanzas Corporativas, Operaciones Logísticas y SST. No es que se
    me haya perdido al leerla; el hueco es del dato maestro y conviene arreglarlo
    también en la planilla. El Gerente General queda en el catálogo marcado como
    no evaluable — es la cabeza de la línea, no tiene jefatura que lo evalúe —
    pero sigue disponible como **evaluador** sin restricción. Además deja
    `eva_agregar_cargo()` y `eva_cargos_con_uso()`, para que RRHH agregue un cargo
    desde la pantalla «Criterios por cargo» sin pedir SQL. Es repetible.

35. `parche_guardias_nulas.sql` **(obligatoria — es de seguridad)** — cierra un
    agujero real que encontré probando la 34. Las funciones que exigen un rol
    estaban escritas así:

    ```sql
    if not (es_admin() or rol_en_modulo('personal') = 'rrhh') then
      raise exception 'Sólo RRHH ...';
    end if;
    ```

    Parece correcto y no lo es. `rol_en_modulo()` devuelve **NULL** cuando el
    usuario no tiene ninguna fila en `modulo_accesos` para ese módulo, y en SQL
    `NULL = 'rrhh'` no da false: da NULL. `false or NULL` → NULL. `not NULL` →
    NULL. Y `if NULL then ... end if` **no entra**. O sea: la guardia rechazaba a
    quien tenía el rol equivocado y dejaba pasar a quien no tenía ninguno.

    Por qué no se vio antes: todas las pruebas de permisos las hice con usuarios
    que **sí** tenían un rol en el módulo (supervisor, bienestar, RRHH). Con
    'supervisor' la comparación da false de verdad y la guardia salta bien. El
    agujero sólo se abre con un usuario sin rol en el módulo — que es el perfil
    de cualquier trabajador recién creado en el sistema.

    Comprobado en base real con un usuario así. Antes del parche pudo agregar
    cargos al catálogo, marcar «Jefe SST» como cargo que no se evalúa, quitarle
    un criterio a toda una familia, registrar el acta del Comité, resolver
    candidaturas a relator, cargar controles de PDI y — la peor — **firmar el
    acta como RRHH**, que es el visto bueno que cierra la evaluación de otra
    persona. En ese último caso lo único que lo frenaba era el orden de las
    firmas, y sólo mientras faltaran las del trabajador y el supervisor; con esas
    dos puestas (el estado normal a esa altura del flujo) la firma entraba.

    Las **políticas RLS no tenían este problema**: ahí un NULL se trata como
    false y la fila se filtra. Por eso ese mismo usuario no podía *leer* el
    catálogo aunque sí podía escribirlo por función. El parche no las toca.

    Reemplaza 5 funciones ya desplegadas envolviendo la condición en
    `coalesce(..., false)` — falla cerrado — y deja `sgc_rol()`, que nunca
    devuelve NULL, para el código nuevo. Los cuerpos se extrajeron de tus propias
    migraciones, no se transcribieron a mano: cambia la guardia y nada más. Es
    repetible.

    El verificador ahora comprueba cómo están escritas esas siete guardias, no
    sólo que existan. Si alguna sale `>>> AGUJERO ABIERTO`, es que se reaplicó una
    migración vieja encima y hay que volver a correr este parche.

36. `migracion_eva_expediente_trabajador.sql` **(obligatoria)** — el trabajador
    puede descargar su propio expediente en Excel, con el membrete corporativo.
    Antes de escribir el botón revisé si podía leer todo lo que ese Excel
    necesita, y faltaban dos cosas — las dos comprobadas en base real:

    · **Sus propias respuestas de autoevaluación.** La única política que se las
      dejaba leer exigía que la evaluación estuviera en `asignada` o
      `autoevaluacion_en_curso`. O sea: una vez enviada la autoevaluación, la
      persona dejaba de poder ver lo que ella misma había contestado. Medido: con
      la evaluación entregada, veía las 5 notas de su jefe y 0 de sus 5
      respuestas. El Excel habría salido con la columna «Nota Auto» entera en «—»
      y la brecha sin explicación, sin dar ningún error.

    · **Las notas de su jefatura, en el medio del flujo.** La política listaba
      cuatro estados de trece. Contando lo que ve de sus 5 respuestas y de las 5
      notas del jefe, estado por estado:

      ```
      entregada_trabajador   5 / 5
      resultados_aceptados   5 / 0   ← las pierde
      reunion_agendada       5 / 0
      reunion_realizada      5 / 0
      reflexiones_enviadas   5 / 0
      pendiente_firmas       5 / 0
      cerrada_conforme       5 / 5   ← las recupera
      ```

      Veía las notas el día que se las entregaban, las perdía al acusar recibo, y
      las recuperaba al cerrarse el expediente. En el tramo sin acceso está la
      entrevista one-to-one, que es la conversación sobre esas notas. No era una
      decisión de diseño: es una lista de estados que quedó corta cuando el flujo
      creció de 4 a 13.

    La política de escritura NO se toca: la persona sigue sin poder modificar lo
    que contestó una vez enviado. Leer lo que uno mismo respondió no es lo mismo
    que poder cambiarlo.

    Deja además `eva_expediente_descargable()` y `eva_expedientes_de()`, para que
    las tres pantallas donde va el botón no repitan la regla cada una. Es
    repetible.

37. `migracion_eva_maestro_ciclo.sql` **(obligatoria)** — el maestro del ciclo:
    una vista general de todas las evaluaciones y, sobre todo, **quiénes no se
    autoevaluaron a pesar de tener el período habilitado**. Deja
    `eva_maestro_ciclo()` y `eva_maestro_resumen()`, ambas sólo para RRHH y el
    admin: es la nómina completa con las notas de todo el mundo.

    **Un detalle que importa más de lo que parece.** Lo obvio sería detectar al
    que no se autoevaluó mirando `fecha_envio_autoeval`. Es la respuesta
    equivocada: ese campo puede estar vacío en evaluaciones que SÍ tienen
    autoevaluación. Medido en tu base:

    ```
    estado             evaluaciones  con respuestas  con fecha_envio
    cerrada_conforme        1              1               0
    ```

    Una evaluación cerrada, con las respuestas cargadas, sin fecha de envío. El
    formulario sí escribe esa fecha; cualquier fila que entre por otro camino —la
    carga masiva, una corrección a mano, una migración— la deja nula. Un maestro
    que se fiara sólo de la fecha reportaría como «no se autoevaluó» a gente que
    sí lo hizo, en un documento cuyo propósito es justamente perseguir a los que
    faltan.

    Así que se decide por evidencia: respuestas cargadas, o estado ya avanzado, o
    fecha. Y se devuelve `como_consta` diciendo cuál de las tres fue, para que las
    filas con el registro incompleto se vean en lugar de disimularse. Es
    repetible.

Para comprobar que 27 a 37 quedaron aplicadas: `verificar_migracion_flujo.sql`.
Además de comprobar que cada objeto exista, cuenta los datos del motor — si la
batería no quedó completa, lo dice con «>>> REVISAR» y el número que falta.

**Ojo con la 28**: además hay que **volver a desplegar la Edge Function `send-email`**
(`supabase functions deploy send-email --no-verify-jwt`). Se le agregaron parámetros
opcionales para que una carta formal no salga con el pie de «no responder este correo»
que llevan los avisos automáticos. Sin redesplegarla el sistema funciona igual, pero
las cartas van a llevar ese pie, que contradice el propio texto de la carta.

**Ojo con el orden de la 29 a la 32**: la 31 depende de la 29 (necesita el tipo
CAP/CON de los criterios y el catálogo de cursos) y la 32 depende de las dos.
Todas van después de la 27.

Hay un parámetro que conviene revisar en la 32: siembra
`eva_config_fortalezas.curso_formacion_relator = 'L-08'`, que es el curso que el
sistema sugiere a quien queda como candidato a relator. Eso es **una inferencia
mía**, no una regla de tus planillas — ellas dicen «candidatura a relator N4»
pero no dicen que haya que formarlo. Si el Comité prefiere decidir la formación
aparte, se pone ese valor en `null` y la sugerencia desaparece del formulario. Tres cosas que conviene saber antes de correrlas:

- La 29 **reescribe el texto de los 30 criterios** con la redacción de la v2.0.
  Los códigos no cambian (TC1…CM6), pero VH2, VH3 y VH6 cambian de significado:
  la v1.1 decía «Adaptabilidad», «Compromiso» y «Trabajo en equipo», y la v2.0
  los alinea con los valores HACER — Austeridad, Cercanía, y «Compromiso y
  adaptabilidad». Si ya tienes evaluaciones cerradas con la redacción vieja, sus
  notas quedan asociadas al texto nuevo. Si eso te importa, dímelo y lo dejamos
  versionado en lugar de sobreescrito.

- La 29 **desactiva los 19 planes de acción genéricos** que había en
  `eva_planes_catalogo` (los redacté antes de tener la batería real). No los
  borra: siguen disponibles como acción escrita a mano y los PDI que ya los
  referencian quedan intactos.

- La 30 **desactiva los 24 ítems del checklist v1.1** y siembra los 26 de la
  v2.0 con códigos nuevos (`V2-…`). Los viejos no se borran: las respuestas que
  ya existan siguen siendo legibles en su expediente.

Después de correr las dos hay dos cosas por hacer a mano en el sistema:

1. **Asignar la familia de cargos a cada persona.** El motor la deduce del texto
   del cargo comparándolo con el catálogo de 55 cargos (54 de la planilla más el Gerente General). Si alguien
   tiene el cargo escrito distinto («Adm. de obra» en vez de «Administrativo de
   Obra»), el motor no encuentra la familia y esa persona no recibe los cursos
   obligatorios de su puesto — la vista lo avisa en rojo, pero hay que corregirlo.

2. **Cargar el historial de capacitación** en `eva_capacitaciones`. Sin eso el
   motor va a proponer año tras año los mismos obligatorios: no tiene forma de
   saber qué cursos ya tiene cada persona. Un curso cuenta como vigente según su
   recurrencia (Anual 12 meses, Bienal 24, «Única» y «Al ingreso» no caducan).

## Archivos que puedes ignorar (quedaron obsoletos, superados por otro)

- `migracion_notificaciones_email.sql` → usa `migracion_notificaciones_email_v2.sql`
- `migracion_fix_dimension_critica.sql` → usa `migracion_fix_alertas_multiples.sql`
- `migracion_permisos_admin_trabajadores.sql` → usa `migracion_rls_gestion_trabajadores.sql`

## Si ya ejecutaste todo esto conversación tras conversación

Si vienes siguiendo esta conversación completa y ya corriste cada
migración en el momento en que te la fui dando, **tu base de datos ya
tiene todo esto aplicado** — no necesitas volver a correr nada. Esta
carpeta es para el caso de que quieras levantar un proyecto de Supabase
nuevo desde cero, o para tener el registro completo y ordenado de cada
cambio.
