// =====================================================================
// Helpers compartidos para formatear una solicitud (todos los tipos) en las
// Edge Functions que generan PDF/correo (notificar, comprobante-pdf,
// maestro-pdf). Espejo, en Deno, de src/ui/solicitud-format.js y
// src/config.js del frontend -- se duplica porque cada Edge Function se
// despliega por separado y no puede importar código de src/.
// Igual que el frontend, sigue mostrando los campos de las solicitudes
// antiguas (Horario, sueldos/bonos de traslado, etc.): las filas vacías se
// omiten, así que una solicitud nueva no las muestra.
// =====================================================================

export const TIPO_LABELS: Record<string, string> = {
  ingreso: 'Ingreso',
  traslado: 'Traslado',
  aumento_sueldo: 'Aumento de sueldo',
  bono: 'Bono',
  cambio_cargo: 'Cambio de cargo',
  cambio_turno: 'Cambio de turno',
  renovacion: 'Renovación',
  desvinculacion: 'Desvinculación',
};

export function tipoTxt(t: string) {
  return (TIPO_LABELS[t] ?? t ?? '').toLowerCase();
}

// Código fijo del formulario (SGC) + prefijo del folio correlativo, por tipo.
// Debe coincidir con DOCUMENTO_CODIGOS en src/config.js.
export const DOCUMENTO_CODIGOS: Record<string, { codigo: string; folioPrefijo: string }> = {
  ingreso:        { codigo: 'RRH-FOR-CON-006', folioPrefijo: 'RRH-ING-' },
  traslado:       { codigo: 'RRH-FOR-TRA-002', folioPrefijo: 'RRH-TRA-' },
  aumento_sueldo: { codigo: 'RRH-FOR-VAR-001', folioPrefijo: 'RRH-VAR-' },
  bono:           { codigo: 'RRH-FOR-VAR-002', folioPrefijo: 'RRH-BON-' },
  cambio_cargo:   { codigo: 'RRH-FOR-VAR-003', folioPrefijo: 'RRH-CAR-' },
  cambio_turno:   { codigo: 'RRH-FOR-VAR-005', folioPrefijo: 'RRH-TUR-' }, // provisorio
  renovacion:     { codigo: 'RRH-FOR-CON-007', folioPrefijo: 'RRH-REN-' },
  desvinculacion: { codigo: 'RRH-FOR-VAR-004', folioPrefijo: 'RRH-DES-' },
};
export const MAESTRO_SOLICITUDES_CODIGO = 'RRH-FOR-SOL-001';

// Debe coincidir con TIPO_RENOVACION_LABELS en src/config.js.
export const TIPO_RENOVACION_LABELS: Record<string, string> = {
  plazo: 'A plazo',
  obra_faena: 'Por obra o faena',
  indefinido: 'Pasa a indefinido',
};

export function pesos(n: any) {
  const v = Number(n);
  if (isNaN(v)) return String(n ?? '—');
  return '$ ' + v.toLocaleString('es-CL');
}

export function detalleLineas(sol: any): [string, string][] {
  const d = sol.detalle || {};
  let pares: [string, any][];
  switch (sol.tipo) {
    case 'ingreso':
      pares = [
        ['Cargo', d.cargo], ['Cantidad', d.cantidad],
        ['Sueldo líquido pactado', d.sueldo_liquido != null ? pesos(d.sueldo_liquido) : null],
        ['Tipo de contrato', d.tipo_contrato], ['Plazo', d.plazo], ['Turno', d.turno],
        ['Horario de colación', d.colacion],
        ['Horario', d.horario], ['Fecha de ingreso', d.fecha_ingreso], ['Cliente', d.cliente],
      ];
      break;
    case 'traslado':
      pares = [
        ['Cargo', d.cargo], ['Fecha de traslado', d.fecha_traslado],
        ['Modificaciones', d.modificaciones_contractuales], ['Turno', d.turno], ['Horario', d.horario],
        ['Sueldo líquido actual', d.sueldo_liquido_actual != null ? pesos(d.sueldo_liquido_actual) : null],
        ['Nuevo sueldo líquido', d.nuevo_sueldo_liquido != null ? pesos(d.nuevo_sueldo_liquido) : null],
        ['Bono nocturno', !d.bono_nocturno ? null : d.bono_nocturno.aplica ? `Sí (${d.bono_nocturno.porcentaje ?? '—'} · ${d.bono_nocturno.periodo ?? '—'})` : 'No'],
        ['Bono trato', !d.bono_trato ? null : d.bono_trato.aplica ? `Sí (${d.bono_trato.monto != null ? pesos(d.bono_trato.monto) : '—'} · ${d.bono_trato.dias_asignacion ?? '—'} días)` : 'No'],
      ];
      break;
    case 'aumento_sueldo':
      pares = [
        ['Monto del aumento', d.monto_aumento != null ? pesos(d.monto_aumento) : null],
        ['Sueldo líquido actual', d.sueldo_actual != null ? pesos(d.sueldo_actual) : null],
        ['Nuevo sueldo líquido', d.sueldo_nuevo != null ? pesos(d.sueldo_nuevo) : null],
        ['Fecha efectiva', d.fecha_efectiva], ['Motivo', d.motivo],
      ];
      break;
    case 'bono':
      pares = [
        ['Tipo de bono', d.tipo_bono], ['Monto', d.monto != null ? pesos(d.monto) : null],
        ['Período / fecha', d.periodo], ['Motivo', d.motivo],
      ];
      break;
    case 'cambio_cargo':
      pares = [
        ['Cargo actual', d.cargo_actual], ['Cargo nuevo', d.cargo_nuevo],
        ['Fecha efectiva', d.fecha_efectiva], ['Motivo', d.motivo],
      ];
      break;
    case 'cambio_turno':
      pares = [['Turno nuevo', d.turno_nuevo], ['Motivo', d.motivo]];
      break;
    case 'renovacion':
      pares = d.tipo_renovacion
        ? [
          ['Tipo de contrato actual', d.tipo_contrato_actual],
          ['Fecha de término actual', d.fecha_termino_actual],
          ['Tipo de renovación', TIPO_RENOVACION_LABELS[d.tipo_renovacion] ?? d.tipo_renovacion],
          ['Fecha de culminación', d.tipo_renovacion === 'plazo' ? d.nueva_fecha_termino : null],
          ['Hito de la obra', d.tipo_renovacion === 'obra_faena' ? d.hito_obra : null],
          ['Motivo', d.motivo],
        ]
        : [ // renovaciones anteriores a oct. 2026 (sin tipo_renovacion)
          ['Fecha de término actual', d.fecha_termino_actual],
          ['Nueva condición', d.indefinido ? 'Pasa a indefinido (sin fecha de término)' : null],
          ['Nueva fecha de término', d.indefinido ? null : d.nueva_fecha_termino],
          ['Nuevo plazo', d.indefinido ? null : d.nuevo_plazo],
          ['Motivo', d.motivo],
        ];
      break;
    case 'desvinculacion':
      pares = [
        ['Causal', d.causal],
        ['Fecha de desvinculación', d.fecha_desvinculacion],
        ['Documento adjunto', d.adjunto?.nombre || (d.adjunto?.path ? 'Documento adjunto' : null)],
        ['Observaciones', d.observaciones],
      ];
      break;
    default:
      pares = [];
  }
  return pares.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => [k, String(v)]);
}
