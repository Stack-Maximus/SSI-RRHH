import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
  },
  resolve: {
    // Los archivos compartidos con las Edge Functions (supabase/functions/_shared)
    // importan con especificadores de Deno ("npm:pdf-lib@1.17.1"). En el
    // navegador se resuelven al paquete instalado ("pdf-lib"). Ver
    // src/ui/pdf-solicitudes.js (PDF del comprobante y del maestro).
    alias: [{ find: /^npm:(@?[^@]+)@.*$/, replacement: "$1" }],
  },
});
