import { defineConfig } from "vite";

// Los archivos compartidos con las Edge Functions (supabase/functions/_shared)
// importan con especificadores de Deno ("npm:pdf-lib@1.17.1"). En el navegador
// se resuelven al paquete instalado en node_modules ("pdf-lib"), con la ruta
// completa (así no se duplica el módulo). Si el paquete no está instalado, el
// error lo dice claro: falta correr "npm install". Ver src/ui/pdf-solicitudes.js
// (PDF del comprobante y del maestro).
const paquetesNpmDeDeno = {
  name: "paquetes-npm-de-deno",
  enforce: "pre",
  async resolveId(source, importer, options) {
    const m = /^npm:(@?[^@]+)@.*$/.exec(source);
    if (!m) return null;
    const resuelto = await this.resolve(m[1], importer, { ...options, skipSelf: true });
    if (!resuelto) {
      this.error(`Falta instalar el paquete "${m[1]}" (lo usa ${importer}). Corre "npm install" en la carpeta del proyecto y vuelve a compilar.`);
    }
    return resuelto;
  },
};

export default defineConfig({
  plugins: [paquetesNpmDeDeno],
  server: {
    port: 5173,
  },
});
