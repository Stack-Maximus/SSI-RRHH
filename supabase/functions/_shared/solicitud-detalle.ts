// =====================================================================
// Helpers compartidos para formatear una solicitud (los 6 tipos) en las
// Edge Functions que generan PDF/correo (notificar, comprobante-pdf,
// maestro-pdf). Espejo, en Deno, de src/ui/solicitud-format.js y
// src/config.js del frontend -- se duplica porque cada Edge Function se
// despliega por separado y no puede importar código de src/.
// =====================================================================

export const TIPO_LABELS: Record<string, string> = {
  ingreso: 'Ingreso',
  traslado: 'Traslado',
  aumento_sueldo: 'Aumento de sueldo',
  bono: 'Bono',
  cambio_cargo: 'Cambio de cargo',
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
  renovacion:     { codigo: 'RRH-FOR-CON-007', folioPrefijo: 'RRH-REN-' },
  desvinculacion: { codigo: 'RRH-FOR-VAR-004', folioPrefijo: 'RRH-DES-' },
};
export const MAESTRO_SOLICITUDES_CODIGO = 'RRH-FOR-SOL-001';

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
        ['Horario', d.horario], ['Fecha de ingreso', d.fecha_ingreso], ['Cliente', d.cliente],
      ];
      break;
    case 'traslado':
      pares = [
        ['Cargo', d.cargo], ['Fecha de traslado', d.fecha_traslado],
        ['Modificaciones', d.modificaciones_contractuales], ['Turno', d.turno], ['Horario', d.horario],
        ['Sueldo líquido actual', d.sueldo_liquido_actual != null ? pesos(d.sueldo_liquido_actual) : null],
        ['Nuevo sueldo líquido', d.nuevo_sueldo_liquido != null ? pesos(d.nuevo_sueldo_liquido) : null],
        ['Bono nocturno', d.bono_nocturno?.aplica ? `Sí (${d.bono_nocturno.porcentaje ?? '—'} · ${d.bono_nocturno.periodo ?? '—'})` : 'No'],
        ['Bono trato', d.bono_trato?.aplica ? `Sí (${d.bono_trato.monto != null ? pesos(d.bono_trato.monto) : '—'} · ${d.bono_trato.dias_asignacion ?? '—'} días)` : 'No'],
      ];
      break;
    case 'aumento_sueldo':
      pares = [
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
    case 'renovacion':
      pares = [
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
        ['Observaciones', d.observaciones],
      ];
      break;
    default:
      pares = [];
  }
  return pares.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => [k, String(v)]);
}
