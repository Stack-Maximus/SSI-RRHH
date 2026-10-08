// =====================================================================
// PDF del "Comprobante de solicitud" (todos los tipos), con el diseño
// "Concept 3". El contenido sale de sgc-documentos.js (el mismo que usa
// la vista en pantalla), la geometría de sgc-layout.js y el dibujo de
// sgc-pdf.ts. Lo usan `comprobante-pdf` (descarga) y `notificar` (adjunto
// del correo de aprobación); la firma de construirComprobantePdf() no
// cambió.
// =====================================================================

import { componerDocumento } from './sgc-layout.js';
import { documentoComprobante } from './sgc-documentos.js';
import { pdfDeDocumento } from './sgc-pdf.ts';
import { DOCUMENTO_CODIGOS, TIPO_LABELS, detalleLineas } from './solicitud-detalle.ts';

export interface ComprobanteData {
  sol: any;
  cmap: Map<any, any>;
  aprs: any[];
  pmap: Map<any, any>;
  trabNombre: string | null;
}

export async function construirComprobantePdf(data: ComprobanteData): Promise<Uint8Array> {
  const doc = documentoComprobante(data, { tipoLabels: TIPO_LABELS, documentoCodigos: DOCUMENTO_CODIGOS, detalleLineas });
  return pdfDeDocumento((medir) => componerDocumento(doc, medir));
}
