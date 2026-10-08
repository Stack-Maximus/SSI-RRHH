// =====================================================================
// PDF del "Maestro de solicitudes" (RRH-FOR-SOL-001) con el diseño
// "Concept 3": encabezado en cada página, sección 1 con la identificación
// del registro (total y período) y sección 2 con la tabla de todas las
// solicitudes, que se corta entre páginas repitiendo su fila de títulos.
// Complementa (no reemplaza) el Excel, que trae el detalle fila por fila.
// =====================================================================

import { componerDocumento } from './sgc-layout.js';
import { documentoMaestro } from './sgc-documentos.js';
import { pdfDeDocumento } from './sgc-pdf.ts';
import { MAESTRO_SOLICITUDES_CODIGO, TIPO_LABELS } from './solicitud-detalle.ts';

export interface FilaMaestro {
  folio: string | null;
  codigo: string | null;
  tipo: string;
  estado: string;
  solicitante: string;
  trabajador: string;
  centro: string;
  creada: string; // AAAA-MM-DD
  aprobResumen: string;
}

export async function construirMaestroPdf(filas: FilaMaestro[]): Promise<Uint8Array> {
  const doc = documentoMaestro(filas, { tipoLabels: TIPO_LABELS, codigoMaestro: MAESTRO_SOLICITUDES_CODIGO });
  return pdfDeDocumento((medir) => componerDocumento(doc, medir));
}
