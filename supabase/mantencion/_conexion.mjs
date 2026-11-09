// =====================================================================
// _conexion.mjs -- conexión a la base de Supabase para los scripts de
// mantención en Node (mismas reglas que sql.mjs): variable DB o la URL que
// guardó el CLI en supabase/.temp/pooler-url, contraseña por PGPASSWORD o
// pedida sin mostrarla, SSL siempre (PGSSLROOTCERT para verificar el
// certificado de Supabase).
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function salir(msg) { console.error(msg); process.exit(1); }

function pedirClave(pregunta) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(pregunta)) process.stdout.write(s); };
    rl.question(pregunta, (r) => { rl.close(); process.stdout.write('\n'); resolve(r); });
  });
}

export async function conectar(applicationName = 'ssi-rrhh-mantencion') {
  let pg;
  try { pg = (await import('pg')).default; }
  catch { salir('Falta el paquete "pg". En la carpeta del proyecto corre una vez:  npm install --no-save pg'); }

  let url = process.env.DB;
  if (!url) {
    const guardada = path.join(RAIZ, 'supabase', '.temp', 'pooler-url');
    if (fs.existsSync(guardada)) url = fs.readFileSync(guardada, 'utf8').trim();
  }
  if (!url) salir('Falta la URL de conexión: define la variable DB con la URL del Session pooler.');
  let u;
  try { u = new URL(url); } catch { salir('La URL de conexión (variable DB) no es válida.'); }

  const host = u.hostname.replace(/^\[|\]$/g, '');
  const local = ['localhost', '127.0.0.1', '::1'].includes(host);
  const password = decodeURIComponent(u.password) || process.env.PGPASSWORD || await pedirClave('Contraseña de la base de datos: ');
  const ssl = local ? false
    : process.env.PGSSLROOTCERT ? { ca: fs.readFileSync(process.env.PGSSLROOTCERT, 'utf8') }
    : { rejectUnauthorized: false };

  const client = new pg.Client({
    host,
    port: Number(u.port || 5432),
    database: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
    user: decodeURIComponent(u.username) || 'postgres',
    password, ssl, application_name: applicationName, connectionTimeoutMillis: 20000,
  });
  try {
    await client.connect();
  } catch (e) {
    let msg = e.message;
    if (e.code === '28P01' || /password authentication failed/i.test(msg)) msg += '  (revisa la contraseña de la base: Project Settings -> Database)';
    if (['ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'].includes(e.code)) msg += '  (revisa la URL del Session pooler y tu conexión a internet)';
    salir(`ERROR al conectar: ${msg}`);
  }
  return { client, host };
}
