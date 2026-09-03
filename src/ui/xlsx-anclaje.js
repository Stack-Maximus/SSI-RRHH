/**
 * Corrige el anclaje de las imágenes en un .xlsx generado con ExcelJS.
 *
 * EL PROBLEMA, EN CONCRETO
 *
 * ExcelJS 4.4.0 escribe siempre el atributo `editAs` en el nodo de anclaje,
 * también en el de una sola celda:
 *
 *     lib/xlsx/xform/drawing/one-cell-anchor-xform.js:29
 *     xmlStream.openNode(this.tag, {editAs: model.range.editAs || 'oneCell'});
 *
 * En el esquema OOXML, `editAs` existe únicamente en <xdr:twoCellAnchor>. En
 * <xdr:oneCellAnchor> es un atributo inválido, y los lectores estrictos —Excel
 * entre ellos— descartan el dibujo COMPLETO: el archivo abre sin ningún aviso y
 * la imagen simplemente no está.
 *
 * COMPROBADO, no deducido. Sobre el mismo archivo, contando las imágenes que
 * logra leer un lector estricto (openpyxl):
 *
 *     oneCellAnchor tal cual ExcelJS  →  0 imágenes
 *     el mismo, sin el atributo       →  1 imagen
 *
 * Es la diferencia entre un membrete que se ve y uno que no. LibreOffice ignora
 * el atributo desconocido y muestra la imagen igual: por eso el problema pasó
 * una revisión hecha en PDF y apareció al abrirlo en Excel, que es donde se usa.
 *
 * POR QUÉ NO SE USA EL ANCLAJE DE DOS CELDAS, QUE NO TIENE ESTE PROBLEMA
 *
 * Porque estira la imagen al rango de celdas, y entonces la proporción del
 * membrete pasa a depender de cuántos píxeles mide una columna — que no es lo
 * mismo en Excel (7 px por carácter) que en otros lectores. Medido en
 * LibreOffice: el mismo archivo dibuja el membrete con proporción 5,26 en vez de
 * 8,09, o sea un 35% de deformación. Con el anclaje de una celda la imagen
 * conserva su tamaño en píxeles y se ve igual en todas partes.
 *
 * Así que se mantiene el anclaje de una celda y se le quita el atributo que
 * ExcelJS no debería escribir.
 *
 * jszip no es una dependencia nueva de verdad: ExcelJS ya la trae (declara
 * ^3.10.1) y es la que usa para armar el .xlsx. Queda anotada en package.json
 * para que quien lea el proyecto sepa que se usa directamente.
 */

import JSZip from "jszip";

const NODO_MAL = /<xdr:oneCellAnchor(\s+editAs="[^"]*")\s*>/g;

/**
 * @param {ArrayBuffer} buffer  Lo que devuelve wb.xlsx.writeBuffer().
 * @returns {Promise<ArrayBuffer>} El mismo archivo con el anclaje válido. Si no
 *          había nada que corregir, devuelve el original sin recomprimir.
 */
export async function corregirAnclajeImagenes(buffer) {
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    // Si por cualquier motivo no se puede abrir, se devuelve el archivo tal
    // cual: mejor un membrete que no se ve que una descarga que falla.
    return buffer;
  }

  const dibujos = Object.keys(zip.files).filter((n) => /^xl\/drawings\/drawing\d+\.xml$/.test(n));
  let corregidos = 0;

  for (const nombre of dibujos) {
    const xml = await zip.file(nombre).async("string");
    const limpio = xml.replace(NODO_MAL, "<xdr:oneCellAnchor>");
    if (limpio !== xml) {
      zip.file(nombre, limpio);
      corregidos++;
    }
  }

  if (!corregidos) return buffer;

  return zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
