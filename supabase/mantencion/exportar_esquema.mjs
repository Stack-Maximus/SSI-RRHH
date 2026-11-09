// =====================================================================
// exportar_esquema.mjs -- SOLO LECTURA. Exporta la ESTRUCTURA de la base de
// producción (sin datos) a supabase/mantencion/esquema_produccion.log:
// enums, tablas (columnas, restricciones), vistas, funciones, triggers,
// políticas RLS (public y storage) y tareas programadas (pg_cron).
//
// Para qué: parte del esquema base (crear_solicitud, mi_bandeja, el trigger
// de aprobaciones, las políticas originales) se creó directo en Supabase y
// no está en supabase/migrations. Con esto se puede revisar y corregir con
// la versión real a la vista.
//
// Uso (en la carpeta del proyecto):
//     node supabase\mantencion\exportar_esquema.mjs
//
// - No guarda ni cambia nada en la base (transacción de solo lectura).
// - El archivo termina en .log a propósito: el .gitignore ignora *.log, así
//   que no se sube a GitHub. Igual se tapan con <REDACTADO> los textos que
//   parecen claves (JWT, "Bearer ...", sk_...), por si alguna función o
//   trigger las trae escritas.
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import { conectar, RAIZ } from './_conexion.mjs';

const SALIDA = path.join(RAIZ, 'supabase', 'mantencion', 'esquema_produccion.log');

const redactar = (s) => String(s ?? '')
  .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '<REDACTADO>')
  .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]{20,}/gi, '$1<REDACTADO>')
  .replace(/\b(sk|rk|re|pk)_(live|test)?_?[A-Za-z0-9]{16,}\b/g, '<REDACTADO>');
const arr = (v) => Array.isArray(v) ? v : String(v ?? '').replace(/^\{|\}$/g, '').split(',').filter(Boolean);

const { client, host } = await conectar('ssi-rrhh-exportar-esquema');
const out = [];
const sec = (t) => out.push('', '-- ' + '='.repeat(69), `-- ${t}`, '-- ' + '='.repeat(69));
const q = async (sql) => (await client.query(sql)).rows;
const cuenta = {};

try {
  await client.query('begin transaction read only');
  const [{ ahora, version }] = await q("select to_char(now() at time zone 'America/Santiago', 'DD-MM-YYYY HH24:MI') as ahora, current_setting('server_version') as version");
  out.push('-- esquema_produccion.log -- ESTRUCTURA de la base (sin datos)', `-- Exportado: ${ahora} (hora de Chile) desde ${host}, Postgres ${version}`,
    '-- Generado por supabase/mantencion/exportar_esquema.mjs. Solo referencia: NO correr este archivo.');

  sec('ENUMS');
  const enums = await q(`
    select t.typname, string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder) as valores
    from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' group by t.typname order by 1`);
  for (const e of enums) out.push(`create type public.${e.typname} as enum (${e.valores});`);
  cuenta.enums = enums.length;

  sec('TABLAS (columnas y restricciones)');
  const tablas = await q(`
    select c.oid, c.relname, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1`);
  const cols = await q(`
    select a.attrelid as oid, a.attname, format_type(a.atttypid, a.atttypmod) as tipo, a.attnotnull, pg_get_expr(d.adbin, d.adrelid) as defecto
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where n.nspname = 'public' and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
    order by a.attrelid, a.attnum`);
  const cons = await q(`
    select conrelid as oid, conname, pg_get_constraintdef(oid) as def
    from pg_constraint where connamespace = 'public'::regnamespace and contype in ('p', 'u', 'f', 'c', 'x')
    order by conrelid, contype, conname`);
  for (const t of tablas.sort((a, b) => a.relname.localeCompare(b.relname))) {
    const lineas = cols.filter((c) => c.oid === t.oid).map((c) =>
      `  ${c.attname} ${c.tipo}${c.attnotnull ? ' not null' : ''}${c.defecto ? ' default ' + c.defecto : ''}`);
    cons.filter((c) => c.oid === t.oid).forEach((c) => lineas.push(`  constraint ${c.conname} ${c.def}`));
    out.push('', `create table public.${t.relname} (`, lineas.join(',\n'), `);${t.rls ? `\nalter table public.${t.relname} enable row level security;` : '  -- SIN RLS'}`);
  }
  cuenta.tablas = tablas.length;

  sec('VISTAS');
  const vistas = await q("select viewname, definition from pg_views where schemaname = 'public' order by 1");
  for (const v of vistas) out.push('', `create or replace view public.${v.viewname} as`, redactar(v.definition));
  cuenta.vistas = vistas.length;

  sec('FUNCIONES (public, sin las de extensiones)');
  const funcs = await q(`
    select p.oid::regprocedure::text as firma, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    order by p.proname, 1`);
  for (const f of funcs) out.push('', `-- ${f.firma}`, redactar(f.def).trimEnd() + ';');
  cuenta.funciones = funcs.length;

  sec('TRIGGERS (tablas de public, y los de auth/storage que llaman funciones de public)');
  const trigs = await q(`
    select tg.tgrelid::regclass::text as tabla, tg.tgname, pg_get_triggerdef(tg.oid) as def
    from pg_trigger tg
    join pg_class c on c.oid = tg.tgrelid join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = tg.tgfoid join pg_namespace pn on pn.oid = p.pronamespace
    where not tg.tgisinternal and (n.nspname = 'public' or pn.nspname = 'public')
    order by 1, 2`);
  for (const t of trigs) out.push(redactar(t.def) + ';');
  cuenta.triggers = trigs.length;

  sec('POLITICAS RLS (public y storage)');
  const pols = await q(`
    select schemaname, tablename, policyname, permissive, roles::text[] as roles, cmd, qual, with_check
    from pg_policies where schemaname in ('public', 'storage') order by 1, 2, 3`);
  for (const p of pols) {
    out.push('', `create policy "${p.policyname}" on ${p.schemaname}.${p.tablename}`,
      `  as ${p.permissive.toLowerCase()} for ${p.cmd.toLowerCase()} to ${arr(p.roles).join(', ')}` +
      (p.qual ? `\n  using (${redactar(p.qual)})` : '') + (p.with_check ? `\n  with check (${redactar(p.with_check)})` : '') + ';');
  }
  cuenta.politicas = pols.length;

  sec('TAREAS PROGRAMADAS (pg_cron)');
  const [{ hay }] = await q("select to_regclass('cron.job') is not null as hay");
  if (hay) {
    const jobs = await q('select jobid, jobname, schedule, active, command from cron.job order by jobid');
    for (const j of jobs) out.push(`-- [${j.jobid}] ${j.jobname ?? '(sin nombre)'} | ${j.schedule} | ${j.active ? 'activa' : 'INACTIVA'}`, redactar(j.command).trimEnd(), '');
    cuenta.tareas = jobs.length;
  } else {
    out.push('-- (pg_cron no está instalado)');
    cuenta.tareas = 0;
  }

  await client.query('rollback');
  fs.writeFileSync(SALIDA, out.join('\n') + '\n', 'utf8');
  console.log(`Listo: ${path.relative(RAIZ, SALIDA)}`);
  console.log(Object.entries(cuenta).map(([k, v]) => `${v} ${k}`).join(' · '));
  console.log('No se cambió nada en la base.');
} catch (e) {
  console.error(`ERROR: ${e.message}\nNo se cambió nada en la base.`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
