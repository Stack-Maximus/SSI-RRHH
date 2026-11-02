// =====================================================================
// sql.mjs -- corre un archivo .sql contra la base de Supabase desde CMD,
// sin instalar PostgreSQL (usa Node, que ya está para la app).
//
// Una sola vez, en la carpeta del proyecto:
//     npm install --no-save pg
//
// Uso (desde la carpeta del proyecto):
//     node supabase\mantencion\sql.mjs <archivo.sql>             (REVISIÓN: corre y DESHACE)
//     node supabase\mantencion\sql.mjs <archivo.sql> --aplicar   (corre y GUARDA)
//
// - Todo el archivo va en UNA transacción: sin --aplicar termina en ROLLBACK
//   (muestra cómo quedaría y no guarda nada); con --aplicar, en COMMIT. Si
//   algo falla, no se guarda nada en ningún caso.
// - Conexión: la variable DB (URL del Session pooler) o, si no está, la que
//   guardó el CLI de Supabase en supabase/.temp/pooler-url. La contraseña de
//   la base (Project Settings -> Database) se pide sin mostrarla en pantalla,
//   o se toma de la variable PGPASSWORD.
// - SSL: la conexión va siempre cifrada. Para además verificar el
//   certificado de Supabase, descarga el "SSL certificate" (Project
//   Settings -> Database) y pon su ruta en la variable PGSSLROOTCERT.
// - Muestra el resultado de cada SELECT (en orden: Resultado 1, 2...) y los
//   avisos (RAISE NOTICE).
// - Solo archivos SQL "planos": sin comandos de psql (\set, \if...) ni
//   begin/commit propios.
// - OJO: el ROLLBACK no deshace los cambios de numeración de secuencias
//   (setval). Por eso 03_reiniciar_numeracion.sql se corre directo con --aplicar.
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const salir = (msg) => { console.error(msg); process.exit(1); };

let pg;
try {
  pg = (await import('pg')).default;
} catch {
  salir('Falta el paquete "pg". En la carpeta del proyecto corre una vez:  npm install --no-save pg');
}

const args = process.argv.slice(2);
const archivo = args.find((a) => !a.startsWith('--'));
const aplicar = args.includes('--aplicar');
const desconocidas = args.filter((a) => a.startsWith('--') && a !== '--aplicar');
if (!archivo || desconocidas.length) {
  salir('Uso: node supabase\\mantencion\\sql.mjs <archivo.sql> [--aplicar]');
}
if (!fs.existsSync(archivo)) salir(`No encuentro el archivo: ${archivo}`);
const sql = fs.readFileSync(archivo, 'utf8').replace(/^﻿/, '');

// Este runner ya abre y cierra la transacción: no se aceptan comandos de psql
// ni begin/commit dentro del archivo (romperían el modo revisión).
const lineas = sql.split(/\r?\n/);
const meta = lineas.findIndex((l) => /^\s*\\/.test(l));
if (meta >= 0) salir(`El archivo trae comandos de psql (línea ${meta + 1}: ${lineas[meta].trim()}). Este runner solo acepta SQL plano.`);
const tx = lineas.findIndex((l) => /^\s*(begin|commit|rollback|start\s+transaction)\s*;/i.test(l));
if (tx >= 0) salir(`El archivo trae su propio ${lineas[tx].trim()} (línea ${tx + 1}). Quítalo: el runner ya maneja la transacción.`);

// URL de conexión
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let url = process.env.DB;
if (!url) {
  const guardada = path.join(raiz, 'supabase', '.temp', 'pooler-url');
  if (fs.existsSync(guardada)) url = fs.readFileSync(guardada, 'utf8').trim();
}
if (!url) salir('Falta la URL de conexión: define la variable DB con la URL del Session pooler.');
let u;
try { u = new URL(url); } catch { salir('La URL de conexión (variable DB) no es válida.'); }

const host = u.hostname.replace(/^\[|\]$/g, '');
const local = ['localhost', '127.0.0.1', '::1'].includes(host);

function pedirClave(pregunta) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(pregunta)) process.stdout.write(s); };   // no muestra lo que se escribe
    rl.question(pregunta, (r) => { rl.close(); process.stdout.write('\n'); resolve(r); });
  });
}
const password = decodeURIComponent(u.password) || process.env.PGPASSWORD || await pedirClave('Contraseña de la base de datos: ');

const ssl = local ? false
  : process.env.PGSSLROOTCERT ? { ca: fs.readFileSync(process.env.PGSSLROOTCERT, 'utf8') }
  : { rejectUnauthorized: false };

// Parámetros sueltos (no connectionString): así la contraseña y el SSL de
// arriba no se pisan con lo que venga en la URL.
const client = new pg.Client({
  host,
  port: Number(u.port || 5432),
  database: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  user: decodeURIComponent(u.username) || 'postgres',
  password,
  ssl,
  application_name: 'ssi-rrhh-mantencion',
  connectionTimeoutMillis: 20000,
});
client.on('notice', (n) => {
  if (/(does not exist|already exists), skipping$/.test(n.message)) return;   // ruido normal de "if exists / if not exists"
  console.log(`AVISO: ${n.message}`);
});

// Tabla de texto simple (sin comillas ni índice, a diferencia de console.table)
function texto(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toLocaleString('es-CL');
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
function imprimirTabla(campos, filas) {
  const cols = campos.map((f) => f.name);
  const datos = filas.map((r) => cols.map((c) => texto(r[c]).replace(/\s+/g, ' ')));
  const ancho = cols.map((c, i) => Math.min(60, Math.max(c.length, ...datos.map((d) => d[i].length))));
  const fmt = (vals) => ' ' + vals.map((v, i) => (v.length > ancho[i] ? v.slice(0, ancho[i] - 1) + '…' : v.padEnd(ancho[i]))).join(' | ');
  console.log(fmt(cols));
  console.log('-' + ancho.map((w) => '-'.repeat(w)).join('-+-') + '-');
  for (const d of datos) console.log(fmt(d));
}

const linea = '='.repeat(70);
let ok = false;
try {
  await client.connect();
  console.log(`${linea}\n${path.basename(archivo)}  ->  ${host}  (${aplicar ? 'APLICAR: se guardan los cambios' : 'REVISIÓN: no se guarda nada'})\n${linea}`);
  await client.query('begin');
  // Marca (solo dentro de esta transacción) para los scripts que piden
  // confirmación escrita en el archivo: con este runner ya hay revisión previa.
  await client.query("select set_config('mantencion.runner', 'sql.mjs', true)");
  const res = await client.query(sql);
  const lista = Array.isArray(res) ? res : [res];
  let n = 0;
  for (const r of lista) {
    if (r.command === 'SELECT' && r.fields?.length && !(r.fields.length === 1 && r.fields[0].name === 'set_config')) {
      n++;
      console.log(`\n-- Resultado ${n} (${r.rowCount} fila(s))`);
      if (r.rows.length) imprimirTabla(r.fields, r.rows); else console.log('(sin filas)');
    }
  }
  await client.query(aplicar ? 'commit' : 'rollback');
  ok = true;
  console.log(`\n${linea}\n${aplicar ? '>>> CAMBIOS GUARDADOS.' : '>>> REVISIÓN: no se guardó nada. Si está bien, vuelve a correrlo agregando --aplicar'}\n${linea}`);
} catch (e) {
  try { await client.query('rollback'); } catch { /* conexión caída */ }
  let msg = e.message;
  if (e.code === '28P01' || /password authentication failed/i.test(msg)) msg += '  (revisa la contraseña de la base: Project Settings -> Database)';
  if (e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT' || e.code === 'ECONNREFUSED') msg += '  (revisa la URL del Session pooler y tu conexión a internet)';
  console.error(`\n${linea}\nERROR: ${msg}\nNo se guardó nada.\n${linea}`);
} finally {
  await client.end().catch(() => {});
}
process.exit(ok ? 0 : 1);
