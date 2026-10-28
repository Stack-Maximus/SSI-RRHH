// =====================================================================
// Contenido de los instructivos por rol (SSI-RRHH). Cada texto se revisó
// contra el código de la app (vistas, mensajes y correos de `notificar`).
// =====================================================================

const hoy = (() => {
  const o = {};
  for (const x of new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date())) o[x.type] = x.value;
  return `${o.day}/${o.month}/${o.year}`;
})();

// ---------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------
function identificacion(rol, codigo, dirigido, objetivo) {
  return {
    titulo: 'Identificación del registro',
    fichas: [
      { etiqueta: 'Registro', valor: `Instructivo de uso · Rol ${rol}`, icono: 'file-text' },
      { etiqueta: 'Fecha del documento', valor: hoy, icono: 'calendar-days' },
      { etiqueta: 'Código', valor: codigo, icono: 'barcode' },
      { etiqueta: 'Revisión', valor: '00', icono: 'settings' },
      { etiqueta: 'Sistema', valor: 'SSI-RRHH · Solicitudes de Ingreso y Traslado', icono: 'monitor' },
      { etiqueta: 'Dirigido a', valor: dirigido, icono: 'users' },
      { etiqueta: 'Objetivo', valor: objetivo, icono: 'flag', ancho: 'completo' },
    ],
  };
}

function ingreso(rolTxt) {
  return {
    titulo: 'Ingresar al sistema',
    bloques: [
      { t: 'pasos', items: [
        { titulo: 'Abre el sistema', txt: 'Entra con el enlace de SSI-RRHH que te entregó el administrador, desde Chrome o Edge (computador o celular). Tu cuenta la crea el administrador: él define tu rol y tu obra.' },
        { titulo: 'Inicia sesión', txt: 'Escribe tu **Correo** y tu **Contraseña** y presiona **Iniciar sesión**.' },
        { titulo: 'Si olvidaste la contraseña', txt: 'Presiona **¿Olvidaste tu contraseña?**, escribe tu correo y presiona **Enviar enlace**. Te llega un correo (puede tardar 1 a 2 minutos; revisa el spam). El enlace abre **Nueva contraseña**: escríbela dos veces y presiona **Cambiar contraseña**. Debe tener al menos 8 caracteres, 1 mayúscula, 1 letra y 1 símbolo.' },
      ] },
      { t: 'img2', a: { src: 'c-login' }, b: { src: 'c-olvido' }, maxAlto: 400, pie: 'Inicio de sesión y recuperación de contraseña' },
      { t: 'texto', txt: `Al entrar verás la pantalla de **Inicio**, con tu nombre, tu rol (**${rolTxt}**) y un acceso directo a cada una de tus opciones. El menú de la izquierda tiene las mismas opciones; el botón con la flecha circular (arriba a la derecha) recarga la pantalla con los datos más recientes.` },
      { t: 'aviso', tipo: 'alerta', titulo: 'Cierre de sesión', txt: 'La sesión se cierra sola tras **30 minutos sin actividad**. Para salir antes, haz clic en tu nombre (arriba a la derecha) y confirma **Cerrar sesión**.' },
    ],
  };
}

const COLS_CORREOS = [
  { titulo: 'Cuándo llega', icono: 'bell', w: 300, estilo: 'normal' },
  { titulo: 'Asunto del correo', icono: 'mail', w: 360, estilo: 'fuerte' },
  { titulo: 'Qué hacer', icono: 'list-checks', w: 380, estilo: 'normal' },
];
const correos = (filas) => ({ titulo: 'Correos que recibirás', tabla: { columnas: COLS_CORREOS, filas, tam: { sReg: 18, sBold: 18.5, sHead: 19, lh: 24 } } });

const preguntas = (items) => ({
  titulo: 'Preguntas frecuentes',
  bloques: items.map(([titulo, txt]) => ({ t: 'aviso', tipo: 'consejo', titulo, txt, gap: 14 })),
});

const documento = (codigo, rol) => ({
  encabezado: { titulo: `Instructivo de uso · ${rol}`, codigo, fecha: hoy, revision: '00' },
  pie: { codigo, nombre: `Instructivo de uso SSI-RRHH · Rol ${rol}` },
});

// Compartido por Solicitante y Supervisor -------------------------------
const seguimiento = (shotMis, conCandidatos) => ({
  titulo: 'Seguir tus solicitudes',
  bloques: [
    { t: 'texto', txt: 'En **Mis solicitudes** ves todas las que creaste, de la más nueva a la más antigua. Cada tarjeta muestra el **N° de solicitud** (SOL-AAAA-NNNN), el tipo, el **estado** (Pendiente, Aprobada o Rechazada), un resumen, los aprobadores en orden (**Aprobador 1, 2, 3**) con lo que decidió cada uno, y los botones **Editar** (si todavía se puede) y **Ver comprobante**.' },
    { t: 'img', src: shotMis, maxAlto: 620, pie: 'Mis solicitudes' },
    ...(conCandidatos ? [{ t: 'aviso', tipo: 'info', txt: 'Si RRHH te envió candidatos para una solicitud de Ingreso, aparecen en un recuadro destacado arriba (ver "Elegir un candidato").' }] : []),
  ],
});

const editar = (shot) => ({
  titulo: 'Corregir una solicitud pendiente',
  bloques: [
    { t: 'lado', src: shot, ancho: 450, pie: 'Editar una solicitud', estilo: 'pasos',
      intro: 'Puedes corregirla mientras esté **Pendiente** y **ningún aprobador haya decidido**. Cuando el primero decide, el botón **Editar** desaparece.',
      items: [
        { txt: 'En **Mis solicitudes**, presiona **Editar** en la tarjeta.' },
        { txt: 'Se abre el mismo formulario con los datos guardados; arriba se indica qué solicitud estás editando.' },
        { txt: 'Corrige y presiona **Guardar cambios**. Los cambios quedan sobre la misma solicitud.' },
        { titulo: 'Campos fijos', txt: 'El **tipo**, el **trabajador** y el **centro de costo u obras** aparecen como **fijo**: definen quién aprueba. Si alguno está mal, pídele al aprobador que la rechace y crea una nueva.' },
      ] },
  ],
});

const comprobante = (shot, volverA) => ({
  titulo: 'Ver y descargar el comprobante',
  bloques: [
    { t: 'lado', src: shot, ancho: 540, pie: 'Comprobante (igual al PDF)', estilo: 'pasos',
      intro: 'Cada solicitud tiene su comprobante con el formato del Sistema de Gestión de Calidad: código, folio, datos de la solicitud y la tabla de **aprobaciones con los tiempos de respuesta**.',
      items: [
        { txt: 'Presiona **Ver comprobante** en la tarjeta de la solicitud.' },
        { txt: 'Revisa las páginas en pantalla. Para guardarlo o enviarlo, presiona **Descargar PDF**.' },
        { txt: `Presiona **Volver** para regresar a ${volverA}.` },
        { titulo: 'Por correo', txt: 'Cuando la solicitud queda aprobada, el mismo comprobante llega en PDF adjunto al correo de aprobación.' },
      ] },
  ],
});

const formulariosCambio = (incluyeTraslado) => ({
  titulo: incluyeTraslado ? 'Solicitudes sobre un trabajador' : 'Completar cada tipo de solicitud',
  bloques: [
    { t: 'texto', txt: 'Estos tipos se hacen sobre un trabajador que ya está en el maestro: lo eliges en la lista **Trabajador** (nombre y cargo). Si no aparece, pídele a RRHH o al administrador que lo cargue.' },
    ...(incluyeTraslado ? [
      { t: 'lado', src: 'sol-traslado', ancho: 450, pie: 'Formulario de Traslado', estilo: 'lista',
        intro: '**Traslado:** mover a un trabajador de una obra a otra.',
        items: [
          'Elige el **Trabajador**: el sistema completa su **Cargo** y la **Obra origen** (donde está hoy).',
          'Elige la **Obra destino** (distinta a la de origen), la **Fecha de traslado** y el **Turno**.',
          'En **Modificaciones contractuales** describe, si corresponde, qué cambia en el contrato.',
          'Desde que se aprueba, el traslado demora **hasta 3 días hábiles** (lo recuerda el aviso de arriba).',
          { titulo: 'Si aparece un mensaje en rojo', txt: 'El trabajador tiene contrato **Obra o Faena** sin anexo de renovación al día y el botón **Crear solicitud** queda bloqueado. Primero hay que crear y aprobar una **Renovación** para ese trabajador.' },
        ] },
    ] : []),
    { t: 'sub', txt: 'Aumento de sueldo' },
    { t: 'lista', items: [
      'Elige el **Trabajador** y escribe el **Monto del aumento de sueldo ($)**: solo cuánto sube, no el sueldo final (por ejemplo 50000). El **Motivo** es opcional, pero ayuda al aprobador.',
    ] },
    { t: 'sub', txt: 'Cambio de cargo' },
    { t: 'lista', items: [
      'Al elegir el **Trabajador**, el **Cargo actual** se completa solo. Elige el **Cargo nuevo** y la **Fecha efectiva**. Desde que se aprueba, demora **hasta 3 días hábiles**.',
    ] },
    { t: 'lado', src: 'sol-renovacion-obra', ancho: 500, pie: 'Renovación por obra o faena', estilo: 'lista',
      intro: '**Renovación:** renovar o extender el contrato.',
      items: [
        'Al elegir el **Trabajador** se completan su **Tipo de contrato actual** y su **Fecha de término actual** (la fecha se puede corregir).',
        '**Tipo de renovación:** **A plazo** pide la **Fecha de culminación** (posterior a la actual); **Por obra o faena** pide el **Hito de la obra** con que termina el contrato, como dice el anexo; **Pasa a indefinido** no pide nada más.',
        'Al aprobarse, el sistema actualiza solo el contrato del trabajador.',
      ] },
    { t: 'sub', txt: 'Desvinculación' },
    { t: 'lista', items: [
      'Elige el **Trabajador**, la **Causal** (renuncia voluntaria, mutuo acuerdo, vencimiento del plazo, conclusión del trabajo o faena, necesidades de la empresa u otra) y la **Fecha de desvinculación**. En **Observaciones** agrega el detalle; si elegiste "Otra causal", explícala ahí.',
    ] },
  ],
});

const PREGUNTAS_SOLICITUD = [
  ['No encuentro al trabajador en la lista', 'La lista muestra solo trabajadores activos del maestro. Pídele a RRHH o al administrador que lo agregue o lo active.'],
  ['Aparece "no tiene administrador de obra asignado"', 'La obra del trabajador no tiene aprobador configurado. Avísale al administrador del sistema para que lo asigne en Centros de costo.'],
];

// =====================================================================
// INSTRUCTIVO ÚNICO · todos los módulos (reemplaza a los 5 por rol)
// =====================================================================
const R = { sol: 'Solicitante', sup: 'Supervisor', apr: 'Aprobador', rrhh: 'RRHH', prev: 'Prevencionista', adm: 'Administrador' };
const COD = 'RRH-INS-SSI-001';
const SISTEMA = 'Solicitud de Servicio Interno Recursos Humanos - Homologación (SSI-RRHH-SST)';

const GENERAL = {
  archivo: 'Instructivo_SSI-RRHH-SST.pdf',
  doc: {
    encabezado: { titulo: 'Instructivo de uso SSI-RRHH-SST', codigo: COD, fecha: hoy, revision: '00' },
    pie: { codigo: COD, nombre: 'Instructivo de uso SSI-RRHH-SST · Todos los módulos' },
    secciones: [
      {
        titulo: 'Identificación del registro',
        fichas: [
          { etiqueta: 'Registro', valor: 'Instructivo de uso · Todos los módulos', icono: 'file-text' },
          { etiqueta: 'Fecha del documento', valor: hoy, icono: 'calendar-days' },
          { etiqueta: 'Código', valor: COD, icono: 'barcode' },
          { etiqueta: 'Revisión', valor: '00', icono: 'settings' },
          { etiqueta: 'Sistema', valor: SISTEMA, icono: 'monitor', ancho: 'completo' },
          { etiqueta: 'Dirigido a', valor: 'Todos los usuarios del sistema (los seis roles)', icono: 'users', ancho: 'completo' },
          { etiqueta: 'Objetivo', valor: 'Explicar paso a paso cómo se usa cada módulo de SSI-RRHH-SST y qué le toca a cada rol en las solicitudes de ingreso, traslado y cambios del personal', icono: 'flag', ancho: 'completo' },
        ],
      },
      {
        titulo: 'Roles del sistema',
        tabla: {
          columnas: [
            { titulo: 'Rol', icono: 'user-check', w: 210, estilo: 'fuerte' },
            { titulo: 'Quién lo tiene', icono: 'users', w: 400, estilo: 'normal' },
            { titulo: 'Módulos de su menú', icono: 'layers', w: 560, estilo: 'normal' },
          ],
          filas: [
            ['Solicitante', 'Quien pide personal o cambios para su obra', 'Inicio, Nueva solicitud (los seis tipos) y Mis solicitudes'],
            ['Supervisor', 'Quien pide cambios sobre trabajadores ya contratados', 'Inicio, Nueva solicitud (aumento de sueldo, cambio de cargo, renovación y desvinculación) y Mis solicitudes'],
            ['Aprobador', 'Administradores de obra y Gerente de Operaciones', 'Inicio y Bandeja'],
            ['RRHH', 'Equipo de Recursos Humanos', 'Inicio, Solicitudes, Historial, Contratación y SLA Contratación'],
            ['Prevencionista', 'Prevencionistas de riesgos de obra y Gerente de Prevención', 'Inicio, Homologación SST y SLA Homologación'],
            ['Administrador', 'Responsable del sistema', 'Todos los módulos anteriores, más Checklist documentos, Usuarios, Centros de costo, Cargos, Trabajadores y Dashboard'],
          ],
          tam: { sReg: 18, sBold: 19, sHead: 19, lh: 24, hMin: 70, padV: 30 },
        },
      },
      {
        titulo: 'Índice',
        indice: true,
        tabla: {
          columnas: [
            { titulo: 'N°', w: 80, estilo: 'numero', alinear: 'centro' },
            { titulo: 'Sección', icono: 'file-text', w: 560, estilo: 'fuerte' },
            { titulo: 'Lo usan', icono: 'users', w: 520, estilo: 'normal' },
            { titulo: 'Pág.', w: 90, estilo: 'numero', alinear: 'centro' },
          ],
          filas: [],
          tam: { sReg: 17.5, sBold: 18, sHead: 18.5, lh: 22, hMin: 40, padV: 21 },
        },
      },
      {
        titulo: 'Ingresar al sistema',
        bloques: [
          { t: 'pasos', items: [
            { titulo: 'Abre el sistema', txt: 'Entra con el enlace de SSI-RRHH-SST desde Chrome o Edge, en el computador o en el celular. Tu cuenta la crea el administrador: él define tu rol y tu obra, y te llega el correo **"Invitación a SSI-RRHH · Metalium"**; con el botón **Activar mi cuenta** defines tu contraseña.' },
            { titulo: 'Inicia sesión', txt: 'Escribe tu **Correo** y tu **Contraseña** y presiona **Iniciar sesión**.' },
            { titulo: 'Si olvidaste la contraseña', txt: 'Presiona **¿Olvidaste tu contraseña?**, escribe tu correo y presiona **Enviar enlace**. Te llega un correo (puede tardar 1 a 2 minutos; revisa el spam). El enlace abre **Nueva contraseña**: escríbela dos veces y presiona **Cambiar contraseña**. Debe tener al menos 8 caracteres, 1 mayúscula, 1 letra y 1 símbolo.' },
          ] },
          { t: 'img2', a: { src: 'c-login' }, b: { src: 'c-olvido' }, maxAlto: 400, pie: 'Inicio de sesión y recuperación de contraseña' },
        ],
      },
      {
        titulo: 'La pantalla principal',
        bloques: [
          { t: 'lado', src: 'ad-menu', ancho: 165, estilo: 'lista', pie: 'Menú del Administrador',
            intro: 'Al entrar ves la pantalla de **Inicio**, con tu nombre, tu rol y un acceso directo a cada módulo de tu menú.',
            items: [
              { titulo: 'El menú', txt: 'A la izquierda están los módulos de tu rol (ver la tabla de la sección 2). La figura muestra el del Administrador, que los tiene todos. En el celular, el menú se abre con el botón de tres líneas de arriba a la izquierda.' },
              { titulo: 'Actualizar', txt: 'El botón con la **flecha circular**, arriba a la derecha, recarga la pantalla con los datos más recientes.' },
              { titulo: 'Cerrar sesión', txt: 'Haz clic en tu nombre (arriba a la derecha) y confirma **Cerrar sesión**. La sesión también se cierra sola tras **30 minutos sin actividad**.' },
              { titulo: 'Guardado automático', txt: 'En las tablas de administración (Usuarios, Centros de costo, Cargos, Trabajadores y Checklist documentos) cada cambio se guarda solo (al salir del campo o al marcar una casilla) y aparece el aviso **Guardado**.' },
              { titulo: 'Desactivar en vez de borrar', txt: 'Usuarios, obras, cargos y documentos no se borran: se desactivan con la casilla **Activo**. Así dejan de aparecer en las listas sin perder el historial.' },
            ] },
        ],
      },
      {
        titulo: 'Cómo avanza una solicitud',
        bloques: [
          { t: 'pasos', items: [
            { titulo: 'Se crea la solicitud', txt: 'Se crea en **Nueva solicitud**: queda **Pendiente** y el primer aprobador recibe un correo.' },
            { titulo: 'Se aprueba en orden', txt: 'Cada aprobador decide en su **Bandeja** cuando le llega el turno; el sistema registra cuánto demoró cada uno. Los aprobadores los asigna el sistema según el tipo y la obra (ver la sección 12).' },
            { titulo: 'Queda Aprobada o Rechazada', txt: 'Si **todos** aprueban, queda **Aprobada** y el solicitante, los aprobadores y RRHH reciben un correo con el comprobante en PDF. Si **uno solo** rechaza, toda la solicitud queda **Rechazada** y se avisa al solicitante.' },
            { titulo: 'RRHH hace su parte', txt: 'Meta: **3 días hábiles**. Contrata a la persona (ingreso), sube 3 documentos (traslado) o gestiona el cambio y lo marca como procesado (demás tipos).' },
            { titulo: 'Prevención homologa (ingreso y traslado)', txt: 'Meta: **9 días hábiles**. El prevencionista de la obra revisa los documentos y autoriza el ingreso a obra; el solicitante recibe el aviso de que el trabajador ya puede ingresar.' },
          ] },
        ],
      },
      {
        titulo: 'Nueva solicitud',
        roles: [R.sol, R.sup, R.adm],
        bloques: [
          { t: 'pasos', items: [
            { txt: 'En el menú, presiona **Nueva solicitud**.' },
            { txt: 'Arriba, elige el **Tipo de solicitud** haciendo clic en su tarjeta. El formulario cambia según el tipo.' },
            { txt: 'Completa los campos. Los marcados con asterisco (*) son obligatorios; si falta alguno, el sistema te indica cuál.' },
            { txt: 'Presiona **Crear solicitud**. Aparece un aviso con el N° de solicitud (por ejemplo SOL-2026-0425) y vuelves al Inicio. **Cancelar** sale sin guardar.' },
          ] },
          { t: 'aviso', tipo: 'info', txt: 'El **Solicitante** y el **Administrador** ven los seis tipos: Ingreso, Traslado, Aumento de sueldo, Cambio de cargo, Renovación y Desvinculación. El **Supervisor** ve solo los cuatro últimos.' },
          { t: 'lado', src: 'sol-ingreso', ancho: 450, pie: 'Nueva solicitud de Ingreso', estilo: 'lista',
            intro: '**Ingreso:** pedir personal nuevo para una obra.',
            items: [
              '**Cargo** y **Cantidad** de personas (obligatorios).',
              '**Centro de Costo (obra)**: viene tu obra; puedes cambiarla. Define quién aprueba.',
              '**Cliente**, **Tipo de contrato** (Plazo Fijo o Indefinido) y **Plazo** (por ejemplo 3 meses).',
              '**Turno**: uno de los tres turnos de la empresa o **Artículo 22** (sin limitación de jornada). El turno ya define el horario.',
              '**Horario de colación**: 30 o 60 minutos (obligatorio).',
              '**Sueldo líquido pactado**, **Fecha de ingreso a obra** y **Motivo / observaciones**.',
            ] },
        ],
      },
      {
        titulo: 'Solicitudes sobre un trabajador',
        roles: [R.sol, R.sup, R.adm],
        bloques: [
          { t: 'texto', txt: 'Estos tipos se hacen sobre un trabajador que ya está en el maestro: lo eliges en la lista **Trabajador** (nombre y cargo). La lista muestra solo trabajadores activos.' },
          { t: 'lado', src: 'sol-traslado', ancho: 450, pie: 'Formulario de Traslado', estilo: 'lista',
            intro: '**Traslado** (Solicitante y Administrador): mover a un trabajador de una obra a otra.',
            items: [
              'Elige el **Trabajador**: el sistema completa su **Cargo** y la **Obra origen** (donde está hoy).',
              'Elige la **Obra destino** (distinta a la de origen), la **Fecha de traslado** y el **Turno**.',
              'En **Modificaciones contractuales** describe, si corresponde, qué cambia en el contrato.',
              'Desde que se aprueba, el traslado demora **hasta 3 días hábiles** (lo recuerda el aviso de arriba).',
              { titulo: 'Si aparece un mensaje en rojo', txt: 'El trabajador tiene contrato **Obra o Faena** sin anexo de renovación al día y el botón **Crear solicitud** queda bloqueado. Primero hay que crear y aprobar una **Renovación** para ese trabajador.' },
            ] },
          { t: 'sub', txt: 'Aumento de sueldo' },
          { t: 'lista', items: [
            'Elige el **Trabajador** y escribe el **Monto del aumento de sueldo ($)**: solo cuánto sube, no el sueldo final (por ejemplo 50000). El **Motivo** es opcional, pero ayuda al aprobador.',
          ] },
          { t: 'sub', txt: 'Cambio de cargo' },
          { t: 'lista', items: [
            'Al elegir el **Trabajador**, el **Cargo actual** se completa solo. Elige el **Cargo nuevo** y la **Fecha efectiva**. Desde que se aprueba, demora **hasta 3 días hábiles**.',
          ] },
          { t: 'lado', src: 'sol-renovacion-obra', ancho: 500, pie: 'Renovación por obra o faena', estilo: 'lista',
            intro: '**Renovación:** renovar o extender el contrato.',
            items: [
              'Al elegir el **Trabajador** se completan su **Tipo de contrato actual** y su **Fecha de término actual** (la fecha se puede corregir).',
              '**Tipo de renovación:** **A plazo** pide la **Fecha de culminación** (posterior a la actual); **Por obra o faena** pide el **Hito de la obra** con que termina el contrato, como dice el anexo; **Pasa a indefinido** no pide nada más.',
              'Al aprobarse, el sistema actualiza solo el contrato del trabajador y, si estaba bloqueado, habilita su traslado.',
            ] },
          { t: 'sub', txt: 'Desvinculación' },
          { t: 'lista', items: [
            'Elige el **Trabajador**, la **Causal** (renuncia voluntaria, mutuo acuerdo, vencimiento del plazo, conclusión del trabajo o faena, necesidades de la empresa u otra) y la **Fecha de desvinculación**. En **Observaciones** agrega el detalle; si elegiste "Otra causal", explícala ahí.',
            'Al aprobarse, el trabajador queda **inactivo** y deja de aparecer en las listas.',
          ] },
        ],
      },
      {
        titulo: 'Mis solicitudes: seguir y corregir',
        roles: [R.sol, R.sup, R.adm],
        bloques: [
          { t: 'texto', txt: 'En **Mis solicitudes** ves todas las que creaste, de la más nueva a la más antigua. Cada tarjeta muestra el **N° de solicitud** (SOL-AAAA-NNNN), el tipo, el **estado** (Pendiente, Aprobada o Rechazada), un resumen, los aprobadores en orden (**Aprobador 1, 2, 3**) con lo que decidió cada uno, y los botones **Editar** (si todavía se puede) y **Ver comprobante**.' },
          { t: 'img', src: 'sol-mis', maxAlto: 620, pie: 'Mis solicitudes' },
          { t: 'lado', src: 'sol-editar', ancho: 450, pie: 'Editar una solicitud', estilo: 'pasos',
            intro: '**Corregir una solicitud:** se puede mientras esté **Pendiente** y **ningún aprobador haya decidido**. Cuando el primero decide, el botón **Editar** desaparece.',
            items: [
              { txt: 'En **Mis solicitudes**, presiona **Editar** en la tarjeta.' },
              { txt: 'Se abre el mismo formulario con los datos guardados; arriba se indica qué solicitud estás editando.' },
              { txt: 'Corrige y presiona **Guardar cambios**. Los cambios quedan sobre la misma solicitud.' },
              { titulo: 'Campos fijos', txt: 'El **tipo**, el **trabajador** y el **centro de costo u obras** aparecen como **fijo**: definen quién aprueba. Si alguno está mal, pídele al aprobador que la rechace y crea una nueva.' },
            ] },
        ],
      },
      {
        titulo: 'Elegir un candidato',
        roles: [R.sol, R.adm],
        bloques: [
          { t: 'texto', txt: 'Para algunas vacantes de Ingreso, RRHH hace un proceso de **Reclutamiento y selección**: busca candidatos y se los envía a quien creó la solicitud para que elija. Llega el correo **"Candidatos para tu solicitud SOL-…"** y, en **Mis solicitudes**, aparece arriba un recuadro con los candidatos.' },
          { t: 'lado', src: 'sol-candidatos', ancho: 600, estilo: 'pasos', pie: 'Candidatos enviados por RRHH',
            items: [
              { txt: 'Abre el **CV** de cada candidato haciendo clic en el nombre del archivo.' },
              { txt: 'Presiona **Elegir** en el candidato que quieres y confirma. Se crea la contratación y RRHH recibe un aviso para seguir el proceso.' },
              { txt: 'Si un candidato no te sirve, presiona **Rechazar** y confirma. Si rechazas a todos, RRHH recibe un aviso para enviarte otra tanda.' },
            ] },
          { t: 'aviso', tipo: 'alerta', txt: 'Elegir o rechazar **no se puede deshacer**. Revisa los CV antes de decidir.' },
        ],
      },
      {
        titulo: 'El comprobante de una solicitud',
        roles: [R.sol, R.sup, R.apr, R.rrhh, R.adm],
        bloques: [
          { t: 'lado', src: 'sol-comprobante', ancho: 540, pie: 'Comprobante (igual al PDF)', estilo: 'pasos',
            intro: 'Cada solicitud tiene su comprobante con el formato del Sistema de Gestión de Calidad: código, folio, datos de la solicitud y la tabla de **aprobaciones con los tiempos de respuesta**.',
            items: [
              { txt: 'Presiona **Ver comprobante** en la tarjeta de la solicitud (en Mis solicitudes, Bandeja, Solicitudes, Historial o el perfil de un trabajador).' },
              { txt: 'Revisa las páginas en pantalla. Para guardarlo o enviarlo, presiona **Descargar PDF**.' },
              { txt: 'Presiona **Volver** para regresar a la pantalla anterior.' },
              { titulo: 'Por correo', txt: 'Cuando la solicitud queda aprobada, el mismo comprobante llega en PDF adjunto al correo de aprobación.' },
            ] },
        ],
      },
      {
        titulo: 'Bandeja de aprobación',
        roles: [R.apr, R.adm],
        bloques: [
          { t: 'texto', txt: 'Cuando una solicitud tiene varios aprobadores, deciden **en orden**: la solicitud aparece en tu **Bandeja**, y te llega el correo **"Solicitud SOL-… pendiente de tu aprobación"**, recién cuando los anteriores ya aprobaron. La bandeja muestra solo las solicitudes en que es **tu turno**, de la más antigua a la más nueva.' },
          { t: 'img', src: 'apr-bandeja', maxAlto: 540, pie: 'Bandeja de aprobación' },
          { t: 'lado', src: 'apr-tarjeta', estilo: 'lista', pie: 'Una tarjeta de la bandeja',
            intro: 'Cada tarjeta muestra el **N° de solicitud** y el tipo, **"Tu turno: aprobador N"** (tu lugar en el orden), el resumen, todos los datos del formulario, la fecha, **Ver comprobante** y los botones **Rechazar** y **Aprobar**.',
            items: [
              { titulo: 'Quién aprueba cada tipo', txt: 'Lo asigna el sistema. **Ingreso:** el administrador de obra del centro de costo y luego el Gerente de Operaciones. **Traslado:** los administradores de obra de la obra de origen y de la de destino, y el Gerente de Operaciones. **Aumento de sueldo, Cambio de cargo, Renovación y Desvinculación:** solo el administrador de obra del centro de costo del trabajador.' },
              { titulo: 'Dónde se configura', txt: 'Los administradores de obra, en **Centros de costo**; el Gerente de Operaciones, en **Usuarios**.' },
              { titulo: 'Tiempo de respuesta', txt: 'El sistema mide cuánto demoras en decidir desde que te llega el turno; queda en el comprobante y en el Dashboard.' },
            ] },
        ],
      },
      {
        titulo: 'Aprobar o rechazar',
        roles: [R.apr, R.adm],
        bloques: [
          { t: 'sub', txt: 'Aprobar' },
          { t: 'pasos', items: [
            { txt: 'Revisa los datos de la tarjeta (o el comprobante completo con **Ver comprobante**).' },
            { txt: 'Presiona **Aprobar** y luego **Aprobar** en la ventana de confirmación.' },
            { txt: 'Tu aprobación queda registrada con fecha y hora. Si faltan aprobadores, el siguiente recibe un correo; si eras el último, la solicitud queda **Aprobada** y el correo con el comprobante PDF les llega al solicitante, a los aprobadores y a RRHH.' },
          ] },
          { t: 'img2', a: { src: 'apr-confirmar-aprobar' }, b: { src: 'apr-confirmar-rechazar' }, maxAlto: 330, pie: 'Confirmación al aprobar y al rechazar' },
          { t: 'sub', txt: 'Rechazar' },
          { t: 'pasos', items: [
            { txt: 'Presiona **Rechazar** y luego **Rechazar** en la ventana de confirmación.' },
            { txt: 'La **solicitud completa** queda rechazada (aunque otros ya hayan aprobado), no pasa a los siguientes aprobadores y el solicitante recibe un correo.' },
          ] },
          { t: 'aviso', tipo: 'alerta', titulo: 'El sistema no pide un motivo al rechazar', txt: 'Avísale directamente al solicitante por qué la rechazaste, para que corrija y cree una nueva. Tu decisión, aprobada o rechazada, **no se puede cambiar** después.' },
        ],
      },
      {
        titulo: 'Solicitudes e Historial',
        roles: [R.rrhh, R.adm],
        bloques: [
          { t: 'texto', txt: 'Cuando una solicitud queda aprobada por todos, RRHH recibe el correo **"Solicitud SOL-… aprobada — respaldo"** con el comprobante en PDF. Desde ese momento corre su plazo: **3 días hábiles** (no cuentan fines de semana ni feriados de Chile). Cada tipo se cierra con una acción distinta:' },
          { t: 'lista', items: [
            '**Ingreso:** se inicia la contratación en **Contratación**; el plazo se cierra al subir el **Contrato de Trabajo**.',
            '**Traslado:** se suben **Contrato de Trabajo, Anexo de Contrato y Cédula de identidad** en el detalle de la solicitud.',
            '**Aumento de sueldo, Cambio de cargo, Renovación y Desvinculación:** se gestiona el cambio y se presiona **Marcar como procesado**.',
          ] },
          { t: 'pasos', items: [
            { txt: 'Entra a **Solicitudes**. Usa las pestañas **Todas, Pendientes, Aprobadas, Rechazadas** y el buscador (por N° de solicitud o nombre del solicitante).' },
            { txt: 'Cada tarjeta muestra tipo, estado, resumen, solicitante, fecha y cuántas aprobaciones lleva. **Ver detalle** despliega los datos, los aprobadores, **Ver comprobante** y, si está aprobada, la acción pendiente de RRHH.' },
            { txt: 'Para un reporte completo usa **Exportar maestro (Excel)** o **Exportar maestro (PDF)**: traen todas las solicitudes, no solo las filtradas. **Historial** funciona igual, pero solo con las finalizadas (aprobadas y rechazadas).' },
          ] },
          { t: 'img', src: 'rrhh-solicitudes', maxAlto: 520, pie: 'Solicitudes' },
        ],
      },
      {
        titulo: 'Cerrar traslados y cambios',
        roles: [R.rrhh, R.adm],
        bloques: [
          { t: 'lado', src: 'rrhh-traslado-docs', estilo: 'pasos', pie: 'Documentos de un traslado aprobado',
            intro: '**Traslado: subir los 3 documentos**',
            items: [
              { txt: 'En **Solicitudes**, abre **Ver detalle** del traslado aprobado.' },
              { txt: 'En **Documentos para homologación (Prevención)** presiona **Subir** en Contrato de Trabajo, Anexo de Contrato y Cédula de identidad, y elige el archivo (PDF, JPG, PNG o Word).' },
              { txt: 'Cada documento queda con su nombre y fecha; ábrelo con un clic o cámbialo con **Reemplazar**.' },
              { txt: 'Al subir el tercero se cierra el plazo de RRHH, el solicitante recibe el aviso y Prevención de la obra destino puede autorizar el ingreso.' },
            ] },
          { t: 'lado', src: 'rrhh-procesar', estilo: 'pasos', pie: 'Marcar como procesado',
            intro: '**Aumento de sueldo, cambio de cargo, renovación y desvinculación**',
            items: [
              { txt: 'Gestiona el cambio pedido (anexo, liquidación, finiquito, etc.) con los procesos habituales.' },
              { txt: 'En **Solicitudes**, abre **Ver detalle** de la solicitud aprobada y presiona **Marcar como procesado**.' },
              { txt: 'Confirma. Queda el mensaje "Procesado por RRHH el …", se cierra el plazo y el solicitante recibe un correo.' },
              { titulo: 'Renovación', txt: 'En una renovación aprobada, el sistema ya actualizó solo el tipo de contrato y la fecha de término del trabajador.' },
            ] },
        ],
      },
      {
        titulo: 'Contratación de un ingreso',
        roles: [R.rrhh, R.adm],
        bloques: [
          { t: 'lado', src: 'rrhh-contratacion', estilo: 'lista', maxAlto: 760, pie: 'Tarjeta de un ingreso aprobado',
            intro: 'En **Contratación** hay una tarjeta por cada solicitud de Ingreso aprobada. Muestra:',
            items: [
              'El N° de solicitud, el cargo, la cantidad y la obra, el solicitante y cuántas contrataciones van iniciadas respecto de las personas pedidas (por ejemplo **1/2**).',
              'Las contrataciones ya iniciadas, con su estado y el botón **Ver** para abrir el expediente.',
              'Los procesos de reclutamiento, con sus candidatos y lo que decidió el solicitante.',
              { titulo: 'Dos caminos por persona', txt: '**Contratación directa** si ya se sabe quién entra (por ejemplo una recomendación), o **reclutamiento y selección** si se buscan candidatos para que elija el solicitante. Si la solicitud pide varias personas, se pueden combinar.' },
            ] },
          { t: 'lado', src: 'rrhh-iniciar-contratacion', estilo: 'pasos', pie: 'Iniciar una contratación directa',
            intro: '**Contratación directa**',
            items: [
              { txt: 'Presiona **+ Iniciar contratación** en la tarjeta de la solicitud.' },
              { txt: 'Completa **Nombres** y **Apellido paterno** (obligatorios), apellido materno, RUT, teléfono y correo, el **Canal** y el **Tipo de trabajador** (Administrativo u Operativo: define el checklist de documentos).' },
              { txt: 'Presiona **Crear contratación**. El prevencionista de la obra recibe el correo "Nueva contratación para homologar".' },
              { titulo: 'Obra sin prevencionista', txt: 'La contratación se crea igual, pero el sistema avisa que no pudo notificar a Prevención: hay que asignarlo en **Centros de costo**.' },
            ] },
          { t: 'lado', src: 'rrhh-iniciar-reclutamiento', estilo: 'pasos', pie: 'Crear un proceso de reclutamiento',
            intro: '**Reclutamiento y selección**',
            items: [
              { txt: 'Presiona **+ Iniciar reclutamiento y selección**, elige el **Tipo de trabajador** y presiona **Crear proceso**.' },
              { txt: 'Presiona **+ Agregar candidatos**: nombres, apellidos y su **CV** (obligatorio). Con **+ Agregar otro candidato** sumas más.' },
              { txt: 'Presiona **Enviar candidatos**. El solicitante recibe un correo y elige desde Mis solicitudes (sección 10).' },
              { txt: 'Si elige a uno, la contratación se crea sola y RRHH recibe **"Candidato elegido"**. Si los rechaza a todos, llega **"Se rechazaron todos los candidatos"** y se envía otra con **+ Agregar otra tanda**.' },
            ] },
        ],
      },
      {
        titulo: 'Expediente de la contratación',
        roles: [R.rrhh, R.adm],
        bloques: [
          { t: 'pasos', items: [
            { txt: 'En la tarjeta de la solicitud, presiona **Ver** junto al nombre de la persona.' },
            { txt: 'En **Datos de la contratación** se corrigen los datos con **Guardar cambios**. A la derecha está la solicitud de origen.' },
            { txt: 'En **Checklist de documentos** sube cada documento con **Subir** (o cámbialo con **Reemplazar**). La barra muestra cuántos obligatorios van; los marcados **SST** son los que revisa Prevención.' },
            { txt: 'Al subir el **Contrato de Trabajo** se cierra el plazo de RRHH, el solicitante recibe el aviso y empieza el plazo de homologación de Prevención.' },
          ] },
          { t: 'img', src: 'rrhh-contratacion-detalle', maxAlto: 600, pie: 'Expediente de una contratación' },
          { t: 'sub', txt: 'Cerrar el proceso' },
          { t: 'lista', items: [
            '**Marcar como contratado:** crea al trabajador en el maestro de Trabajadores (o lo actualiza, si su RUT ya existe) y lo vincula a la contratación. Necesita el **RUT**; si faltan documentos obligatorios, el sistema pregunta si quieres continuar igual.',
            '**Anular contratación:** la deja anulada (por ejemplo, si la persona no se presentó).',
          ] },
          { t: 'sub', txt: 'Cuando Prevención rechaza un documento' },
          { t: 'texto', txt: 'Si Prevención rechaza una homologación y marca un documento con problemas, RRHH recibe el correo **"Revisar documento(s) — homologación rechazada, solicitud SOL-…"**, y la tarjeta del traslado o de la contratación muestra la marca **Revisar documento** con el motivo en rojo. Corrige el documento y súbelo de nuevo con **Reemplazar**: Prevención lo vuelve a revisar.' },
        ],
      },
      {
        titulo: 'Homologación SST',
        roles: [R.prev, R.adm],
        bloques: [
          { t: 'lista', items: [
            '**Ingreso:** cuando RRHH inicia una contratación en tu obra, te llega el correo **"Nueva contratación para homologar — (Nombre)"**.',
            '**Traslado:** los traslados aprobados hacia tu obra aparecen aquí, con los 3 documentos que sube RRHH.',
            'Cada prevencionista ve solo los casos de las obras que tiene asignadas en Centros de costo. Su acceso a los documentos es de **solo lectura** (los sube RRHH).',
          ] },
          { t: 'aviso', tipo: 'info', titulo: 'Meta: 9 días hábiles', txt: 'En ingreso, el plazo empieza cuando RRHH sube el **Contrato de Trabajo**; en traslado, cuando completa los **3 documentos**. Termina cuando se autoriza el ingreso a obra. Cada rechazo extiende el plazo del caso **3 días hábiles más** (acumulable).' },
          { t: 'texto', txt: 'En el menú, presiona **Homologación SST**. Hay una tarjeta por caso, del más nuevo al más antiguo: los **ingresos** muestran el nombre de la persona, su estado, el canal y el tipo de trabajador; los **traslados**, el trabajador, la obra de origen y la de destino. Presiona **Ver documentos** para abrir el caso.' },
          { t: 'img', src: 'prev-homologacion', maxAlto: 460, pie: 'Homologación SST' },
        ],
      },
      {
        titulo: 'Autorizar el ingreso a obra',
        roles: [R.prev, R.adm],
        bloques: [
          { t: 'pasos', items: [
            { txt: 'En **Documentos para homologación** están los requeridos: **Contrato de Trabajo** (marcado "Inicia el plazo de homologación") y **Cédula de identidad o pasaporte**. Los subidos aparecen en verde; haz clic en el nombre del archivo para abrirlo.' },
            { txt: 'Si necesitas revisar algo más del expediente, abre **Otros documentos del trabajador**.' },
            { txt: 'Si todo está en regla, en **Autorización de ingreso a obra** presiona **Autorizar ingreso a obra** y confirma. Queda registrado quién autorizó y cuándo.' },
            { txt: 'El solicitante recibe el correo **"(Nombre) ya puede ingresar a la obra — solicitud SOL-…"**.' },
          ] },
          { t: 'img', src: 'prev-detalle-ingreso', maxAlto: 600, pie: 'Documentos de un ingreso' },
          { t: 'aviso', tipo: 'alerta', txt: 'Si todavía falta un documento requerido, el sistema lo advierte, pero **no bloquea**: decide el prevencionista. La autorización **no se puede deshacer**.' },
          { t: 'sub', txt: 'Traslados' },
          { t: 'texto', txt: 'En un traslado, el detalle indica la obra de origen y la de destino, y muestra los 3 documentos que sube RRHH: **Contrato de Trabajo, Anexo de Contrato y Cédula de identidad**. Se autoriza o rechaza igual que un ingreso; la autorización es para la **obra destino**.' },
          { t: 'img', src: 'prev-detalle-traslado', maxAlto: 480, pie: 'Documentos de un traslado' },
        ],
      },
      {
        titulo: 'Rechazar una homologación',
        roles: [R.prev, R.adm],
        bloques: [
          { t: 'pasos', items: [
            { txt: 'En **Autorización de ingreso a obra**, presiona **Rechazar homologación**.' },
            { txt: 'Escribe el **Motivo del rechazo** (obligatorio). Si el problema está en un documento, márcalo en la lista: así RRHH recibe un aviso para corregirlo.' },
            { txt: 'Presiona **Rechazar homologación** y confirma.' },
          ] },
          { t: 'img', src: 'prev-rechazo', pie: 'Formulario de rechazo de homologación' },
          { t: 'aviso', tipo: 'info', titulo: 'Qué pasa después de un rechazo', txt: 'El caso **sigue abierto**: cuando se corrija, se puede autorizar o volver a rechazar. Su plazo se extiende 3 días hábiles. Siempre se avisa por correo al **solicitante** y al **Gerente de Prevención**; a **RRHH**, solo si se marcó algún documento. Cada rechazo queda en el **Historial de rechazos** del caso.' },
        ],
      },
      {
        titulo: 'Indicadores de plazo (SLA)',
        roles: [R.rrhh, R.prev, R.adm],
        bloques: [
          { t: 'texto', txt: '**SLA Contratación** (RRHH y Administrador) mide a RRHH contra la meta de 3 días hábiles: solicitudes aprobadas, en curso, **atrasadas**, porcentaje de cumplimiento y promedio de días hábiles; más abajo, por centro de costo, por tipo, por integrante de RRHH y el detalle de cada caso (incluidas las vacantes de ingreso que nadie ha iniciado). Los casos marcados **Atrasado** son los primeros que hay que atender.' },
          { t: 'img', src: 'rrhh-sla', maxAlto: 540, pie: 'SLA Contratación' },
          { t: 'texto', txt: '**SLA Homologación** (Prevencionista y Administrador) mide a Prevención contra la meta de 9 días hábiles (más 3 por cada rechazo): casos en homologación, en curso, atrasados, rechazos, porcentaje de cumplimiento y promedio de días hábiles; más abajo, por centro de costo y el detalle de cada caso.' },
          { t: 'img', src: 'prev-sla', maxAlto: 540, pie: 'SLA Homologación' },
        ],
      },
      {
        titulo: 'Dashboard',
        roles: [R.adm],
        bloques: [
          { t: 'lado', src: 'ad-kpis', ancho: 640, estilo: 'lista', pie: 'Dashboard',
            intro: 'Muestra las métricas de todas las solicitudes del sistema:',
            items: [
              '**Total, Pendientes, Aprobadas y Rechazadas.**',
              '**Tasa de aprobación**, sobre las solicitudes ya finalizadas.',
              '**Tiempo prom. de respuesta** de cada aprobación (desde que llega el turno hasta que se decide).',
              '**Por tipo** y **Volumen por centro**: cuántas solicitudes hay de cada tipo y de las obras con más movimiento.',
              '**Tiempo de respuesta por aprobador**: cuántas decisiones tomó cada uno y su tiempo promedio, del más rápido al más lento.',
            ] },
        ],
      },
      {
        titulo: 'Usuarios',
        roles: [R.adm],
        bloques: [
          { t: 'lado', src: 'ad-usuarios', ancho: 660, estilo: 'pasos', pie: 'Usuarios',
            intro: '**Invitar a una persona**',
            items: [
              { txt: 'En **Invitar usuario**, escribe su **Correo** (obligatorio) y su **Nombre**.' },
              { txt: 'Elige su **Rol** y, si corresponde, su **Centro de costo** (su obra: es la que aparece por defecto en sus solicitudes).' },
              { txt: 'Presiona **Enviar invitación**. Le llega el correo **"Invitación a SSI-RRHH · Metalium"**; con **Activar mi cuenta** define su contraseña, y entra con el rol y la obra que le asignaste.' },
            ] },
          { t: 'sub', txt: 'Cambiar permisos' },
          { t: 'lista', items: [
            'En la tabla puedes cambiar el **Rol** y el **Centro de costo** de cada persona. El cambio se guarda solo.',
            '**Gerente Op.:** marca a la persona que es Gerente de Operaciones. El sistema la agrega como aprobador de los ingresos y traslados; su rol debe ser **Aprobador** para que vea la Bandeja.',
            '**Gerente Prev.:** recibe copia por correo de todo rechazo de homologación, de cualquier obra. No aprueba nada.',
            '**Activo:** desmárcalo cuando alguien deja la empresa, en vez de borrarlo: ya no puede entrar al sistema y su fila queda gris.',
          ] },
        ],
      },
      {
        titulo: 'Centros de costo',
        roles: [R.adm],
        bloques: [
          { t: 'texto', txt: 'Cada centro de costo es una obra (u oficina). Aquí se define **quién aprueba** y **quién homologa** en cada una, así que conviene revisarlo cada vez que cambia el administrador de obra o el prevencionista.' },
          { t: 'img', src: 'ad-centros', maxAlto: 560, pie: 'Centros de costo' },
          { t: 'lista', items: [
            '**Nuevo centro de costo:** escribe **Código** y **Nombre** (obligatorios), elige el **Administrador de obra** y el **Prevencionista (homologación)**, y presiona **Crear centro**. El código no se puede repetir.',
            '**Administrador de obra:** aprueba los ingresos de la obra, los traslados que salen o llegan a ella y los cambios sobre sus trabajadores. Recibe además los avisos de contratos por vencer.',
            '**Prevencionista (homologación):** recibe las contrataciones y traslados de la obra para homologar. La lista muestra a los usuarios con rol Prevencionista.',
            'En la tabla puedes corregir el nombre, cambiar a los responsables o desmarcar **Activo** para que la obra deje de aparecer en las listas.',
          ] },
        ],
      },
      {
        titulo: 'Cargos',
        roles: [R.adm],
        bloques: [
          { t: 'lado', src: 'ad-cargos', ancho: 560, estilo: 'lista', pie: 'Cargos',
            intro: 'Es la lista de cargos que aparece en los formularios de solicitud (solo los activos).',
            items: [
              '**Agregar un cargo:** escribe el **Nombre del cargo** y presiona **Agregar cargo**.',
              '**Renombrar:** corrige el nombre en la tabla; se guarda al salir del campo.',
              '**Sacar de la lista:** desmarca **Activo**. Las solicitudes antiguas con ese cargo no cambian.',
              { titulo: 'Importar planilla', txt: 'Sube un Excel con una columna **"Cargo"** (por ejemplo el organigrama). El sistema limpia espacios y duplicados y muestra antes qué hará: cargos **nuevos**, **a reactivar**, **a renombrar**, **sin cambios** y los activos que **no están en la planilla**, que se desactivan solo si los dejas marcados. Revisa y presiona **Aplicar cambios** (o **Cancelar**).' },
            ] },
        ],
      },
      {
        titulo: 'Trabajadores',
        roles: [R.adm],
        bloques: [
          { t: 'texto', txt: 'Es el **maestro de la dotación**: de aquí salen las listas de trabajadores de las solicitudes. Se mantiene al día solo con lo que se aprueba en el sistema (traslados, renovaciones, desvinculaciones y contrataciones) y con la carga de planillas.' },
          { t: 'img', src: 'ad-trabajadores', pie: 'Maestro de trabajadores' },
          { t: 'sub', txt: 'Cargar la dotación desde Excel' },
          { t: 'pasos', items: [
            { txt: 'Presiona **Descargar plantilla**. Trae la hoja **Trabajadores** para llenar (con 2 filas de ejemplo, que debes borrar) y la hoja **Instrucciones**, con el detalle de cada columna y los códigos de centro de costo válidos.' },
            { txt: 'Llena la planilla con la **dotación completa**. El **RUT** es la clave: si ya existe se actualiza; si es nuevo se crea.' },
            { txt: 'Presiona **Importar planilla** y elige el archivo. Antes de guardar nada, el sistema muestra trabajador por trabajador si es **Nuevo**, **Modificado** (con qué cambia) o **Sin cambios**, y marca en rojo los códigos de centro inexistentes o los tipos de contrato no reconocidos.' },
            { txt: 'Revisa y presiona **Aplicar N cambio(s)**, o **Cancelar** para no cargar nada.' },
          ] },
          { t: 'img', src: 'ad-trab-import', pie: 'Vista previa de la importación' },
          { t: 'sub', txt: 'Editar y consultar' },
          { t: 'lista', items: [
            'En la tabla puedes corregir **Nombres**, **Apellidos**, **Tipo de contrato**, **Fecha término contrato** e **Indefinido**, fila por fila.',
            '**Anexo renovación** se marca solo cuando el contrato queda en **Obra o Faena** y se desmarca solo al aprobarse una **Renovación**. Mientras esté marcado, el trabajador no se puede trasladar (aparece **Bloquea traslado**).',
            '**Descargar maestro (Excel)** baja la dotación actual con el formato del SGC.',
          ] },
          { t: 'lado', src: 'ad-trab-perfil', ancho: 620, estilo: 'lista', pie: 'Perfil del trabajador',
            intro: '**Ver perfil** abre la ficha del trabajador:',
            items: [
              '**Datos del trabajador**: RUT, cargo, profesión, obra, sueldo y tipo de contrato.',
              '**Vencimiento de contrato**: en rojo si vence en 15 días o menos (o ya venció), en amarillo si vence en 30 días o menos.',
              '**Solicitudes y anexos**: todas las solicitudes hechas sobre él, con su estado y **Ver comprobante**.',
              '**Volver** regresa al maestro.',
            ] },
        ],
      },
      {
        titulo: 'Checklist de documentos',
        roles: [R.adm],
        bloques: [
          { t: 'texto', txt: 'Es el catálogo de documentos que RRHH sube en el expediente de cada contratación (sección 17).' },
          { t: 'img', src: 'ad-checklist', maxAlto: 600, pie: 'Checklist de documentos' },
          { t: 'lista', items: [
            '**Nuevo documento:** escribe un **Código** único sin espacios (por ejemplo certificado_afp) y el **Nombre**, y presiona **Agregar documento**.',
            '**Administrativo / Operativo:** en qué checklist aparece, según el tipo de trabajador que se elige al iniciar la contratación.',
            '**Obligatorio:** cuenta en la barra de avance; si falta, el sistema lo advierte al marcar como contratado.',
            '**SST / Homologación:** el prevencionista lo ve y lo revisa para autorizar el ingreso a obra.',
            '**Activo:** desmárcalo para sacarlo de los checklists nuevos sin perder los archivos ya subidos.',
          ] },
        ],
      },
      {
        titulo: 'Preguntas frecuentes',
        bloques: [
          ['No encuentro al trabajador en la lista', 'La lista muestra solo trabajadores activos del maestro (un trabajador desvinculado queda inactivo). Si falta, el administrador lo carga en **Trabajadores**.'],
          ['Aparece "no tiene administrador de obra asignado"', 'La obra no tiene aprobador configurado. El administrador lo asigna en **Centros de costo**.'],
          ['Me llegó el correo pero no la veo en la Bandeja', 'Presiona el botón de actualizar (flecha circular, arriba a la derecha). Si sigue sin aparecer, otro aprobador pudo haberla rechazado.'],
          ['Quiero que corrijan un dato antes de aprobar', 'Si **ningún aprobador** ha decidido, el solicitante puede editarla. Si no, hay que rechazarla y crear una nueva.'],
          ['No veo "Marcar como procesado"', 'Solo aparece en solicitudes **aprobadas** de aumento de sueldo, cambio de cargo, renovación y desvinculación. Ingreso y traslado se cierran con sus documentos.'],
          ['No veo un caso en Homologación SST', 'Cada prevencionista ve solo los casos de sus obras. Puede que RRHH aún no inicie la contratación o que el traslado no esté aprobado; si la obra no tiene prevencionista, el administrador lo asigna en Centros de costo.'],
          ['Se autorizó o se aprobó por error', 'Las decisiones no se pueden deshacer desde el sistema. Avísale al administrador y al solicitante.'],
          ['El enlace de invitación ya no sirve', 'Usa **¿Olvidaste tu contraseña?** en la pantalla de ingreso con el mismo correo, o pídele al administrador que te invite de nuevo.'],
        ].map(([titulo, txt]) => ({ t: 'aviso', tipo: 'consejo', titulo, txt, gap: 14 })),
      },
      {
        titulo: 'Correos del sistema',
        tabla: {
          columnas: [
            { titulo: 'Cuándo llega', icono: 'bell', w: 330, estilo: 'normal' },
            { titulo: 'Asunto del correo', icono: 'mail', w: 420, estilo: 'fuerte' },
            { titulo: 'Quién lo recibe', icono: 'users', w: 300, estilo: 'normal' },
          ],
          filas: [
            ['El administrador invita a una persona', 'Invitación a SSI-RRHH · Metalium', 'La persona invitada'],
            ['Se crea una solicitud o le llega el turno al siguiente aprobador', 'Solicitud SOL-… pendiente de tu aprobación', 'El aprobador de turno'],
            ['Todos los aprobadores aprobaron (trae el comprobante PDF)', 'Solicitud SOL-… aprobada — respaldo', 'Solicitante, aprobadores y RRHH'],
            ['Un aprobador rechazó', 'Tu solicitud SOL-… fue rechazada', 'Solicitante'],
            ['RRHH envió candidatos', 'Candidatos para tu solicitud SOL-…', 'Solicitante'],
            ['El solicitante eligió un candidato', 'Candidato elegido — solicitud SOL-…', 'RRHH'],
            ['El solicitante rechazó a todos los candidatos', 'Se rechazaron todos los candidatos — solicitud SOL-…', 'RRHH'],
            ['RRHH inició una contratación', 'Nueva contratación para homologar — (Nombre)', 'Prevencionista de la obra'],
            ['RRHH terminó su parte', 'RRHH ya procesó tu solicitud SOL-…', 'Solicitante'],
            ['Prevención autorizó el ingreso a obra', '(Nombre) ya puede ingresar a la obra — solicitud SOL-…', 'Solicitante'],
            ['Prevención rechazó la homologación', 'Se rechazó la homologación de tu solicitud SOL-…', 'Solicitante'],
            ['Prevención rechazó la homologación', 'Rechazo de homologación — solicitud SOL-…', 'Gerente de Prevención'],
            ['Prevención rechazó y marcó un documento', 'Revisar documento(s) — homologación rechazada, solicitud SOL-…', 'RRHH'],
            ['Un contrato vence en 30 o en 15 días (aviso diario automático)', 'Aviso: contrato de (Nombre) vence en N día(s)', 'RRHH, supervisores y administrador de obra del trabajador'],
          ],
          tam: { sReg: 18, sBold: 18.5, sHead: 19, lh: 24, hMin: 76, padV: 30 },
        },
      },
    ],
  },
};

// =====================================================================
// SOLICITANTE
// =====================================================================
const SOLICITANTE = {
  archivo: 'Instructivo_SSI-RRHH_Solicitante.pdf',
  doc: {
    ...documento('RRH-INS-001', 'Solicitante'),
    secciones: [
      identificacion('Solicitante', 'RRH-INS-001', 'Usuarios con rol Solicitante',
        'Crear solicitudes de personal para la obra, seguirlas y elegir candidatos'),
      ingreso('Solicitante'),
      { titulo: 'Cómo avanza una solicitud', bloques: [
        { t: 'pasos', items: [
          { titulo: 'La creas', txt: 'Queda **Pendiente** y el primer aprobador recibe un correo.' },
          { titulo: 'La aprueban en orden', txt: 'Cada aprobador decide cuando le llega su turno (Aprobador 1, luego 2, luego 3). El sistema registra cuánto demoró cada uno.' },
          { titulo: 'Queda Aprobada o Rechazada', txt: 'Si **todos** aprueban, queda **Aprobada**: a ti, a los aprobadores y a RRHH les llega un correo con el comprobante en PDF. Si **uno solo** rechaza, toda la solicitud queda **Rechazada** y te llega un correo.' },
          { titulo: 'RRHH continúa el proceso', txt: 'RRHH tiene como meta **3 días hábiles** desde la aprobación para hacer su parte (contrato, documentos o el cambio pedido). Cuando termina, te avisa por correo.' },
        ] },
        { t: 'aviso', tipo: 'info', titulo: 'Quién aprueba cada tipo (lo asigna el sistema)', txt: '**Ingreso:** el administrador de obra del centro de costo y luego el Gerente de Operaciones. **Traslado:** los administradores de obra de la obra de origen y de la de destino, y el Gerente de Operaciones. **Aumento de sueldo, Cambio de cargo, Renovación y Desvinculación:** solo el administrador de obra del centro de costo del trabajador.' },
      ] },
      { titulo: 'Crear una solicitud', bloques: [
        { t: 'pasos', items: [
          { txt: 'En el menú, presiona **Nueva solicitud**.' },
          { txt: 'Arriba, elige el **Tipo de solicitud** haciendo clic en su tarjeta: Ingreso, Traslado, Aumento de sueldo, Cambio de cargo, Renovación o Desvinculación. El formulario cambia según el tipo.' },
          { txt: 'Completa los campos. Los marcados con asterisco (*) son obligatorios; si falta alguno, el sistema te indica cuál y no deja continuar.' },
          { txt: 'Presiona **Crear solicitud**. Aparece un aviso con el N° de solicitud (por ejemplo SOL-2026-0425) y vuelves al Inicio. **Cancelar** sale sin guardar.' },
        ] },
        { t: 'lado', src: 'sol-ingreso', ancho: 450, pie: 'Nueva solicitud de Ingreso', estilo: 'lista',
          intro: '**Ingreso:** pedir personal nuevo para una obra.',
          items: [
            '**Cargo** y **Cantidad** de personas (obligatorios).',
            '**Centro de Costo (obra)**: viene tu obra; puedes cambiarla. Define quién aprueba.',
            '**Cliente**, **Tipo de contrato** (Plazo Fijo o Indefinido) y **Plazo** (por ejemplo 3 meses).',
            '**Turno**: uno de los tres turnos de la empresa o **Artículo 22** (sin limitación de jornada). El turno ya define el horario.',
            '**Horario de colación**: 30 o 60 minutos (obligatorio).',
            '**Sueldo líquido pactado**, **Fecha de ingreso a obra** y **Motivo / observaciones**.',
          ] },
      ] },
      formulariosCambio(true),
      seguimiento('sol-mis', true),
      editar('sol-editar'),
      comprobante('sol-comprobante', 'Mis solicitudes'),
      { titulo: 'Elegir un candidato', bloques: [
        { t: 'texto', txt: 'Para algunas vacantes de Ingreso, RRHH hace un proceso de **Reclutamiento y selección**: busca candidatos y te los envía para que elijas. Te llega el correo **"Candidatos para tu solicitud SOL-…"** y, en **Mis solicitudes**, aparece arriba un recuadro con los candidatos.' },
        { t: 'img', src: 'sol-candidatos', pie: 'Candidatos enviados por RRHH' },
        { t: 'pasos', items: [
          { txt: 'Abre el **CV** de cada candidato haciendo clic en el nombre del archivo.' },
          { txt: 'Presiona **Elegir** en el candidato que quieres y confirma. Se crea la contratación y RRHH recibe un aviso para seguir el proceso.' },
          { txt: 'Si un candidato no te sirve, presiona **Rechazar** y confirma. Si rechazas a todos, RRHH recibe un aviso para enviarte otra tanda.' },
        ] },
        { t: 'aviso', tipo: 'alerta', txt: 'Elegir o rechazar **no se puede deshacer**. Revisa los CV antes de decidir.' },
      ] },
      correos([
        ['Todos los aprobadores aprobaron', 'Solicitud SOL-… aprobada — respaldo', 'Nada: es tu respaldo (trae el comprobante PDF). RRHH sigue con el proceso.'],
        ['Un aprobador rechazó', 'Tu solicitud SOL-… fue rechazada', 'Conversa con el aprobador; si corresponde, crea una solicitud nueva corregida.'],
        ['RRHH envió candidatos', 'Candidatos para tu solicitud SOL-…', 'Entra a Mis solicitudes, revisa los CV y elige o rechaza.'],
        ['RRHH terminó su parte', 'RRHH ya procesó tu solicitud SOL-…', 'Informativo.'],
        ['Prevención autorizó el ingreso a obra', '(Nombre) ya puede ingresar a la obra — solicitud SOL-…', 'Coordina la llegada del trabajador a la obra.'],
        ['Prevención rechazó la homologación', 'Se rechazó la homologación de tu solicitud SOL-…', 'Lee el motivo y coordina con Prevención y RRHH lo que falta.'],
      ]),
      preguntas([
        ...PREGUNTAS_SOLICITUD,
        ['¿Puedo pedir un Bono?', 'No. Las solicitudes de Bono se quitaron del sistema; las antiguas se siguen viendo en tus solicitudes.'],
      ]),
    ],
  },
};

// =====================================================================
// SUPERVISOR
// =====================================================================
const SUPERVISOR = {
  archivo: 'Instructivo_SSI-RRHH_Supervisor.pdf',
  doc: {
    ...documento('RRH-INS-002', 'Supervisor'),
    secciones: [
      identificacion('Supervisor', 'RRH-INS-002', 'Usuarios con rol Supervisor',
        'Pedir cambios sobre trabajadores ya contratados y seguir su aprobación'),
      ingreso('Supervisor'),
      { titulo: 'Qué puedes pedir y quién lo aprueba', bloques: [
        { t: 'lado', src: 'sup-tipos', ancho: 560, estilo: 'lista', pie: 'Tipos de solicitud del Supervisor',
          intro: 'Con este rol puedes crear cuatro tipos de solicitud, siempre sobre un trabajador que ya está en el maestro:',
          items: [
            '**Aumento de sueldo:** subir su sueldo líquido pactado.',
            '**Cambio de cargo:** cambiar su cargo.',
            '**Renovación:** renovar o extender su contrato.',
            '**Desvinculación:** terminar la relación laboral.',
          ] },
        { t: 'pasos', items: [
          { titulo: 'La creas', txt: 'Queda **Pendiente** y el aprobador recibe un correo.' },
          { titulo: 'La aprueba el administrador de obra', txt: 'Los cuatro tipos los aprueba **solo el administrador de obra del centro de costo del trabajador**, asignado automáticamente. El sistema registra cuánto demoró en responder.' },
          { titulo: 'Queda Aprobada o Rechazada', txt: 'Si aprueba, a ti y a RRHH les llega el correo de aprobación con el comprobante en PDF. Si rechaza, te llega un correo de rechazo.' },
          { titulo: 'RRHH la procesa', txt: 'RRHH tiene como meta **3 días hábiles** desde la aprobación; cuando la marca como procesada, te llega un correo.' },
        ] },
        { t: 'aviso', tipo: 'info', txt: 'Las solicitudes de **Ingreso** y **Traslado** las crea el rol Solicitante. Si un trabajador con contrato **Obra o Faena** no se puede trasladar por falta de anexo, la solución es que crees una **Renovación** para él: cuando se aprueba, el traslado queda habilitado.' },
      ] },
      { titulo: 'Crear una solicitud', bloques: [
        { t: 'pasos', items: [
          { txt: 'En el menú, presiona **Nueva solicitud** y elige el **Tipo de solicitud** haciendo clic en su tarjeta.' },
          { txt: 'Elige el **Trabajador** y completa los campos (los marcados con asterisco (*) son obligatorios).' },
          { txt: 'Presiona **Crear solicitud**. Aparece un aviso con el N° de solicitud y vuelves al Inicio. **Cancelar** sale sin guardar.' },
        ] },
      ] },
      formulariosCambio(false),
      seguimiento('sup-mis', false),
      editar('sup-editar'),
      comprobante('sup-comprobante', 'Mis solicitudes'),
      correos([
        ['El administrador de obra aprobó', 'Solicitud SOL-… aprobada — respaldo', 'Nada: es tu respaldo (trae el comprobante PDF). RRHH sigue con el proceso.'],
        ['El administrador de obra rechazó', 'Tu solicitud SOL-… fue rechazada', 'Conversa con el aprobador; si corresponde, crea una solicitud nueva corregida.'],
        ['RRHH terminó su parte', 'RRHH ya procesó tu solicitud SOL-…', 'Informativo: el cambio ya quedó gestionado.'],
      ]),
      preguntas(PREGUNTAS_SOLICITUD),
    ],
  },
};

// =====================================================================
// APROBADOR
// =====================================================================
const APROBADOR = {
  archivo: 'Instructivo_SSI-RRHH_Aprobador.pdf',
  doc: {
    ...documento('RRH-INS-003', 'Aprobador'),
    secciones: [
      identificacion('Aprobador', 'RRH-INS-003', 'Administradores de obra y Gerente de Operaciones',
        'Revisar, aprobar o rechazar las solicitudes que esperan tu decisión'),
      ingreso('Aprobador'),
      { titulo: 'Cuándo te toca aprobar', bloques: [
        { t: 'texto', txt: 'Los aprobadores los asigna el sistema según el tipo y la obra. Cuando una solicitud tiene varios, deciden **en orden**: aparece en tu bandeja, y te llega el correo **"Solicitud SOL-… pendiente de tu aprobación"**, recién cuando los anteriores ya aprobaron.' },
        { t: 'lista', items: [
          '**Ingreso:** administrador de obra del centro de costo de la solicitud y luego el Gerente de Operaciones.',
          '**Traslado:** administradores de obra de la obra de origen y de la de destino, y el Gerente de Operaciones, en el orden indicado en la solicitud (Aprobador 1, 2 y 3).',
          '**Aumento de sueldo, Cambio de cargo, Renovación y Desvinculación:** solo el administrador de obra del centro de costo del trabajador.',
        ] },
        { t: 'aviso', tipo: 'info', txt: 'El sistema mide cuánto demoras en responder (desde que te llega el turno hasta que decides) y ese tiempo queda impreso en el comprobante. Si un aprobador rechaza, la solicitud queda rechazada y no pasa a los siguientes.' },
      ] },
      { titulo: 'Tu bandeja de aprobación', bloques: [
        { t: 'texto', txt: 'En el menú, presiona **Bandeja**. Ves solo las solicitudes en las que es **tu turno**, de la más antigua a la más nueva; arriba se indica cuántas tienes pendientes.' },
        { t: 'img', src: 'apr-bandeja', maxAlto: 620, pie: 'Bandeja de aprobación' },
        { t: 'lado', src: 'apr-tarjeta', estilo: 'lista', pie: 'Una tarjeta de la bandeja',
          intro: 'Cada tarjeta muestra:',
          items: [
            'El **N° de solicitud** y el tipo.',
            '**"Tu turno: aprobador N"**: en qué lugar del orden estás.',
            'El resumen (trabajador o cargo, y obra u obras).',
            'Todos los datos del formulario y el motivo, si lo hay.',
            'La fecha en que se solicitó y **Ver comprobante**.',
            'Los botones **Rechazar** y **Aprobar**.',
          ] },
      ] },
      { titulo: 'Aprobar o rechazar', bloques: [
        { t: 'sub', txt: 'Aprobar' },
        { t: 'pasos', items: [
          { txt: 'Revisa los datos de la tarjeta (o el comprobante completo con **Ver comprobante**).' },
          { txt: 'Presiona **Aprobar** y luego **Aprobar** en la ventana de confirmación.' },
          { txt: 'Tu aprobación queda registrada con fecha y hora. Si faltan aprobadores, el siguiente recibe un correo; si eras el último, la solicitud queda **Aprobada** y el correo de aprobación con el comprobante PDF les llega al solicitante, a los aprobadores y a RRHH.' },
        ] },
        { t: 'img2', a: { src: 'apr-confirmar-aprobar' }, b: { src: 'apr-confirmar-rechazar' }, maxAlto: 330, pie: 'Confirmación al aprobar y al rechazar' },
        { t: 'sub', txt: 'Rechazar' },
        { t: 'pasos', items: [
          { txt: 'Presiona **Rechazar** y luego **Rechazar** en la ventana de confirmación.' },
          { txt: 'La **solicitud completa** queda rechazada (aunque otros ya hayan aprobado) y el solicitante recibe un correo.' },
        ] },
        { t: 'aviso', tipo: 'alerta', titulo: 'El sistema no pide un motivo al rechazar', txt: 'Avísale directamente al solicitante por qué la rechazaste, para que corrija y cree una nueva. Tu decisión, aprobada o rechazada, **no se puede cambiar** después.' },
      ] },
      comprobante('apr-comprobante', 'la bandeja'),
      correos([
        ['Llega tu turno en una solicitud', 'Solicitud SOL-… pendiente de tu aprobación', 'Entra a Bandeja y aprueba o rechaza.'],
        ['La solicitud quedó aprobada por todos', 'Solicitud SOL-… aprobada — respaldo', 'Nada: es tu respaldo (trae el comprobante PDF).'],
      ]),
      preguntas([
        ['Me llegó el correo pero no la veo en la bandeja', 'Presiona el botón de actualizar (flecha circular, arriba a la derecha). Si sigue sin aparecer, otro aprobador pudo haberla rechazado.'],
        ['La solicitud no corresponde a mi obra', 'Recházala y avísale al solicitante. Si se repite, pídele al administrador que revise Centros de costo.'],
        ['Quiero que corrijan un dato antes de aprobar', 'Si **ningún aprobador** ha decidido, el solicitante puede editarla: pídele que la corrija. Si no, recházala.'],
      ]),
    ],
  },
};

// =====================================================================
// RRHH
// =====================================================================
const RRHH = {
  archivo: 'Instructivo_SSI-RRHH_RRHH.pdf',
  doc: {
    ...documento('RRH-INS-004', 'RRHH'),
    secciones: [
      identificacion('RRHH', 'RRH-INS-004', 'Equipo de Recursos Humanos',
        'Procesar las solicitudes aprobadas dentro del plazo y llevar las contrataciones'),
      ingreso('RRHH'),
      { titulo: 'Tu parte y tu plazo', bloques: [
        { t: 'texto', txt: 'Tu menú tiene **Solicitudes** (todas), **Historial** (solo aprobadas y rechazadas), **Contratación** (ingresos aprobados) y **SLA Contratación** (tiempos del equipo).' },
        { t: 'texto', txt: 'Cuando una solicitud queda aprobada por todos, te llega el correo **"Solicitud SOL-… aprobada — respaldo"** con el comprobante en PDF. Desde ese momento corre tu plazo: **3 días hábiles** (no cuentan fines de semana ni feriados de Chile). Cada tipo lo cierra con una acción distinta:' },
        { t: 'lista', items: [
          '**Ingreso:** inicias la contratación (directa o por reclutamiento) en **Contratación**; el plazo se cierra al subir el **Contrato de Trabajo**.',
          '**Traslado:** subes **Contrato de Trabajo, Anexo de Contrato y Cédula de identidad** en el detalle de la solicitud; se cierra al completar los tres.',
          '**Aumento de sueldo, Cambio de cargo, Renovación y Desvinculación:** gestionas el cambio y presionas **Marcar como procesado**.',
        ] },
        { t: 'aviso', tipo: 'info', txt: 'Al cerrar tu parte, el solicitante recibe el correo **"RRHH ya procesó tu solicitud SOL-…"**. En Ingreso y Traslado, además, Prevención puede empezar a homologar.' },
      ] },
      { titulo: 'Solicitudes e Historial', bloques: [
        { t: 'pasos', items: [
          { txt: 'Entra a **Solicitudes**. Usa las pestañas **Todas, Pendientes, Aprobadas, Rechazadas** y el buscador (por N° de solicitud o nombre del solicitante).' },
          { txt: 'Cada tarjeta muestra tipo, estado, resumen, solicitante, fecha y cuántas aprobaciones lleva. **Ver detalle** despliega los datos, los aprobadores, **Ver comprobante** y, si está aprobada, tu acción pendiente.' },
          { txt: 'Para un reporte completo usa **Exportar maestro (Excel)** o **Exportar maestro (PDF)**: traen todas las solicitudes, no solo las filtradas. **Historial** funciona igual, pero solo con las finalizadas.' },
        ] },
        { t: 'img', src: 'rrhh-solicitudes', maxAlto: 520, pie: 'Solicitudes' },
      ] },
      { titulo: 'Traslado: subir los 3 documentos', bloques: [
        { t: 'lado', src: 'rrhh-traslado-docs', estilo: 'pasos', pie: 'Documentos de un traslado aprobado',
          items: [
            { txt: 'En **Solicitudes**, abre **Ver detalle** del traslado aprobado.' },
            { txt: 'En **Documentos para homologación (Prevención)** aparecen Contrato de Trabajo, Anexo de Contrato y Cédula de identidad. Presiona **Subir** en cada uno y elige el archivo (PDF, JPG, PNG o Word).' },
            { txt: 'Cada documento queda con su nombre y fecha; ábrelo con un clic o cámbialo con **Reemplazar**.' },
            { txt: 'Al subir el tercero se cierra tu plazo, el solicitante recibe el aviso y Prevención de la obra destino puede autorizar el ingreso.' },
          ] },
      ] },
      { titulo: 'Aumento, cargo, renovación y desvinculación', bloques: [
        { t: 'lado', src: 'rrhh-procesar', estilo: 'pasos', pie: 'Marcar como procesado',
          items: [
            { txt: 'Gestiona el cambio pedido (anexo, liquidación, finiquito, etc.) con tus procesos habituales.' },
            { txt: 'En **Solicitudes**, abre **Ver detalle** de la solicitud aprobada y presiona **Marcar como procesado**.' },
            { txt: 'Confirma. Queda el mensaje "Procesado por RRHH el …", se cierra tu plazo y el solicitante recibe un correo.' },
            { titulo: 'Renovación', txt: 'En una renovación aprobada, el sistema ya actualizó solo el tipo de contrato y la fecha de término del trabajador.' },
          ] },
      ] },
      { titulo: 'Contratación de un ingreso', bloques: [
        { t: 'lado', src: 'rrhh-contratacion', estilo: 'lista', maxAlto: 760, pie: 'Tarjeta de un ingreso aprobado',
          intro: 'En **Contratación** hay una tarjeta por cada solicitud de Ingreso aprobada. Muestra:',
          items: [
            'El N° de solicitud, el cargo, la cantidad y la obra, el solicitante y cuántas contrataciones van iniciadas respecto de las personas pedidas (por ejemplo **1/2**).',
            'Las contrataciones ya iniciadas, con su estado y el botón **Ver** para abrir el expediente.',
            'Los procesos de reclutamiento, con sus candidatos y lo que decidió el solicitante.',
            { titulo: 'Dos caminos por persona', txt: '**Contratación directa** si ya sabes quién entra (por ejemplo una recomendación), o **reclutamiento y selección** si buscas candidatos para que elija el solicitante. Si la solicitud pide varias personas, puedes combinarlos.' },
          ] },
        { t: 'lado', src: 'rrhh-iniciar-contratacion', estilo: 'pasos', pie: 'Iniciar una contratación directa',
          intro: '**Contratación directa**',
          items: [
            { txt: 'Presiona **+ Iniciar contratación** en la tarjeta de la solicitud.' },
            { txt: 'Completa **Nombres** y **Apellido paterno** (obligatorios), apellido materno, RUT, teléfono y correo, el **Canal** y el **Tipo de trabajador** (Administrativo u Operativo: define el checklist de documentos).' },
            { txt: 'Presiona **Crear contratación**. El prevencionista de la obra recibe el correo "Nueva contratación para homologar".' },
            { titulo: 'Obra sin prevencionista', txt: 'La contratación se crea igual, pero el sistema avisa que no pudo notificar a Prevención: pídele al administrador que lo asigne en Centros de costo.' },
          ] },
        { t: 'lado', src: 'rrhh-iniciar-reclutamiento', estilo: 'pasos', pie: 'Crear un proceso de reclutamiento',
          intro: '**Reclutamiento y selección**',
          items: [
            { txt: 'Presiona **+ Iniciar reclutamiento y selección**, elige el **Tipo de trabajador** y presiona **Crear proceso**.' },
            { txt: 'Presiona **+ Agregar candidatos**: nombres, apellidos y su **CV** (obligatorio). Con **+ Agregar otro candidato** sumas más.' },
            { txt: 'Presiona **Enviar candidatos**. El solicitante recibe un correo y elige desde Mis solicitudes.' },
            { txt: 'Si elige a uno, la contratación se crea sola y te llega **"Candidato elegido"**. Si los rechaza a todos, te llega **"Se rechazaron todos los candidatos"** y envías otra con **+ Agregar otra tanda**.' },
          ] },
      ] },
      { titulo: 'Expediente de la contratación', bloques: [
        { t: 'pasos', items: [
          { txt: 'En la tarjeta de la solicitud, presiona **Ver** junto al nombre de la persona.' },
          { txt: 'En **Datos de la contratación** puedes corregir los datos y presionar **Guardar cambios**. A la derecha ves la solicitud de origen.' },
          { txt: 'En **Checklist de documentos** sube cada documento con **Subir** (o cámbialo con **Reemplazar**). La barra muestra cuántos obligatorios van; los marcados **SST** son los que revisa Prevención.' },
          { txt: 'Al subir el **Contrato de Trabajo** se cierra tu plazo, el solicitante recibe el aviso y empieza el plazo de homologación de Prevención.' },
        ] },
        { t: 'img', src: 'rrhh-contratacion-detalle', maxAlto: 600, pie: 'Expediente de una contratación' },
        { t: 'sub', txt: 'Cerrar el proceso' },
        { t: 'lista', items: [
          '**Marcar como contratado:** crea al trabajador en el maestro de Trabajadores (o lo actualiza, si su RUT ya existe) y lo vincula a la contratación. Necesita el **RUT**; si faltan documentos obligatorios, el sistema pregunta si quieres continuar igual.',
          '**Anular contratación:** la deja anulada (por ejemplo, si la persona no se presentó).',
        ] },
        { t: 'img', src: 'rrhh-cerrar-proceso', pie: 'Cerrar el proceso' },
      ] },
      { titulo: 'Cuando Prevención rechaza un documento', bloques: [
        { t: 'texto', txt: 'Si Prevención rechaza una homologación y marca un documento con problemas, te llega el correo **"Revisar documento(s) — homologación rechazada, solicitud SOL-…"**. La tarjeta del traslado (en Solicitudes) o de la contratación (en Contratación) muestra la marca **Revisar documento**, y el detalle, un recuadro rojo con el motivo y el documento señalado.' },
        { t: 'pasos', items: [
          { txt: 'Abre el detalle y lee el motivo.' },
          { txt: 'Corrige el documento y súbelo de nuevo con **Reemplazar**. Prevención lo vuelve a revisar.' },
        ] },
        { t: 'aviso', tipo: 'info', txt: 'Si el rechazo no marca ningún documento, es un tema entre Prevención y el solicitante: no te llega correo ni aparece la marca.' },
      ] },
      { titulo: 'SLA Contratación', bloques: [
        { t: 'texto', txt: 'En **SLA Contratación** ves los tiempos de RRHH contra la meta de 3 días hábiles: solicitudes aprobadas, en curso, **atrasadas**, porcentaje de cumplimiento y promedio de días hábiles; más abajo, por centro de costo, por tipo, por integrante de RRHH y el detalle de cada caso (incluidas las vacantes de ingreso que nadie ha iniciado). Los casos marcados **Atrasado** en la columna SLA son los primeros que hay que atender.' },
        { t: 'img', src: 'rrhh-sla', maxAlto: 560, pie: 'SLA Contratación' },
      ] },
      correos([
        ['Una solicitud quedó aprobada', 'Solicitud SOL-… aprobada — respaldo', 'Haz tu parte según el tipo (máximo 3 días hábiles).'],
        ['El solicitante eligió un candidato', 'Candidato elegido — solicitud SOL-…', 'En Contratación, abre la nueva contratación y sube los documentos.'],
        ['El solicitante rechazó a todos', 'Se rechazaron todos los candidatos — solicitud SOL-…', 'Envía otra tanda con + Agregar otra tanda.'],
        ['Prevención rechazó y marcó un documento', 'Revisar documento(s) — homologación rechazada, solicitud SOL-…', 'Corrige y reemplaza el documento marcado.'],
      ]),
      preguntas([
        ['No veo "Marcar como procesado"', 'Solo aparece en solicitudes **aprobadas** de aumento de sueldo, cambio de cargo, renovación y desvinculación. Ingreso y traslado se cierran con sus documentos.'],
        ['Necesito corregir un documento ya subido', 'Usa **Reemplazar** en ese documento.'],
        ['La solicitud pide 2 personas', 'Inicia una contratación (o un reclutamiento) por cada persona. La tarjeta muestra cuántas van, por ejemplo 1/2.'],
        ['"Marcar como contratado" pide el RUT', 'Complétalo en Datos de la contratación y presiona Guardar cambios antes de cerrar.'],
      ]),
    ],
  },
};

// =====================================================================
// PREVENCIONISTA
// =====================================================================
const PREVENCIONISTA = {
  archivo: 'Instructivo_SSI-RRHH_Prevencionista.pdf',
  doc: {
    ...documento('RRH-INS-005', 'Prevencionista'),
    secciones: [
      identificacion('Prevencionista', 'RRH-INS-005', 'Prevencionistas de riesgos de obra',
        'Revisar los documentos de cada ingreso y traslado y autorizar el ingreso a obra'),
      ingreso('Prevencionista'),
      { titulo: 'Qué te llega y cuál es tu plazo', bloques: [
        { t: 'lista', items: [
          '**Ingreso:** cuando RRHH inicia una contratación en tu obra, te llega el correo **"Nueva contratación para homologar — (Nombre)"**.',
          '**Traslado:** los traslados aprobados hacia tu obra aparecen en Homologación SST, con 3 documentos que sube RRHH.',
          'Tu acceso a los documentos es de **solo lectura**: no puedes subir, reemplazar ni borrar archivos (eso lo hace RRHH).',
        ] },
        { t: 'aviso', tipo: 'info', titulo: 'Meta: 9 días hábiles', txt: 'En ingreso, el plazo empieza cuando RRHH sube el **Contrato de Trabajo**; en traslado, cuando completa los **3 documentos**. Termina cuando autorizas el ingreso a obra. Cada rechazo extiende el plazo del caso **3 días hábiles más** (acumulable).' },
      ] },
      { titulo: 'La bandeja de Homologación SST', bloques: [
        { t: 'texto', txt: 'En el menú, presiona **Homologación SST**. Hay una tarjeta por caso, del más nuevo al más antiguo: los **ingresos** muestran el nombre de la persona, su estado, el canal y el tipo de trabajador; los **traslados**, el trabajador, la obra de origen y la de destino, y si está Pendiente o Autorizado. Presiona **Ver documentos** para abrir el caso.' },
        { t: 'img', src: 'prev-homologacion', maxAlto: 460, pie: 'Homologación SST' },
      ] },
      { titulo: 'Revisar y autorizar un ingreso', bloques: [
        { t: 'pasos', items: [
          { txt: 'En **Documentos para homologación** están los requeridos: **Contrato de Trabajo** (marcado "Inicia el plazo de homologación") y **Cédula de identidad o pasaporte**. Los subidos aparecen en verde; haz clic en el nombre del archivo para abrirlo.' },
          { txt: 'Si necesitas revisar algo más del expediente, abre **Otros documentos del trabajador**.' },
          { txt: 'Si todo está en regla, en **Autorización de ingreso a obra** presiona **Autorizar ingreso a obra** y confirma. Queda registrado quién autorizó y cuándo.' },
          { txt: 'El solicitante recibe el correo **"(Nombre) ya puede ingresar a la obra — solicitud SOL-…"**.' },
        ] },
        { t: 'img', src: 'prev-detalle-ingreso', maxAlto: 600, pie: 'Documentos de un ingreso' },
        { t: 'aviso', tipo: 'alerta', txt: 'Si todavía falta un documento requerido, el sistema te lo advierte, pero **no te bloquea**: tú decides. La autorización **no se puede deshacer**.' },
      ] },
      { titulo: 'Rechazar la homologación', bloques: [
        { t: 'pasos', items: [
          { txt: 'En **Autorización de ingreso a obra**, presiona **Rechazar homologación**.' },
          { txt: 'Escribe el **Motivo del rechazo** (obligatorio). Si el problema está en un documento, márcalo en la lista: así RRHH recibe un aviso para corregirlo.' },
          { txt: 'Presiona **Rechazar homologación** y confirma.' },
        ] },
        { t: 'img', src: 'prev-rechazo', pie: 'Formulario de rechazo de homologación' },
        { t: 'aviso', tipo: 'info', titulo: 'Qué pasa después de un rechazo', txt: 'El caso **sigue abierto**: cuando se corrija, lo puedes autorizar o volver a rechazar. Su plazo se extiende 3 días hábiles. Siempre se avisa por correo al **solicitante** y al **Gerente de Prevención**; a **RRHH**, solo si marcaste algún documento. Cada rechazo queda en el **Historial de rechazos** del caso.' },
      ] },
      { titulo: 'Revisar un traslado', bloques: [
        { t: 'texto', txt: 'En un traslado, el detalle indica la obra de origen y la de destino, y muestra los 3 documentos que sube RRHH: **Contrato de Trabajo, Anexo de Contrato y Cédula de identidad**. Se autoriza o rechaza igual que un ingreso; la autorización es para la **obra destino**.' },
        { t: 'img', src: 'prev-detalle-traslado', maxAlto: 600, pie: 'Documentos de un traslado' },
      ] },
      { titulo: 'SLA Homologación', bloques: [
        { t: 'texto', txt: 'En **SLA Homologación** ves los tiempos de Prevención contra la meta de 9 días hábiles (más 3 por cada rechazo): casos en homologación, en curso, atrasados, rechazos, porcentaje de cumplimiento y promedio de días hábiles; más abajo, por centro de costo y el detalle de cada caso.' },
        { t: 'img', src: 'prev-sla', maxAlto: 560, pie: 'SLA Homologación' },
      ] },
      correos([
        ['RRHH inició una contratación en tu obra', 'Nueva contratación para homologar — (Nombre)', 'Espera el Contrato de Trabajo y revisa el caso en Homologación SST.'],
        ['Se rechazó una homologación (solo Gerente de Prevención)', 'Rechazo de homologación — solicitud SOL-…', 'Informativo: trae quién rechazó, el motivo y los documentos marcados.'],
      ]),
      preguntas([
        ['No veo un caso que esperaba', 'Solo ves los casos de tus obras. Puede que RRHH aún no haya iniciado la contratación o que el traslado no esté aprobado. Si la obra no te tiene asignado, avísale al administrador.'],
        ['Falta un documento', 'Espera a que RRHH lo suba, o rechaza la homologación marcando ese documento para que RRHH reciba el aviso.'],
        ['Autoricé por error', 'La autorización no se puede deshacer desde el sistema. Avísale al administrador y al solicitante.'],
      ]),
    ],
  },
};

export const INSTRUCTIVOS_POR_ROL = { solicitante: SOLICITANTE, supervisor: SUPERVISOR, aprobador: APROBADOR, rrhh: RRHH, prevencionista: PREVENCIONISTA };
export { GENERAL };
export const INSTRUCTIVOS = { general: GENERAL };

