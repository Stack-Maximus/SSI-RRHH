-- Comprobación del paso 2 (migracion_eva_acta_v2.sql)
select 'ítems del checklist v2.0' as que, count(*) as hay, 26 as debe,
       case when count(*)=26 then 'OK' else '>>> REVISAR' end as estado
  from eva_checklist_items where activo and codigo like 'V2-%'
union all
select 'de ésos, obligatorios', count(*), 22, case when count(*)=22 then 'OK' else '>>> REVISAR' end
  from eva_checklist_items where activo and obligatorio
union all
select 'ítems v1.1 desactivados', count(*), 24, case when count(*)=24 then 'OK' else '>>> REVISAR' end
  from eva_checklist_items where not activo
union all
select 'declaraciones de firma (con Bienestar)', count(*), 4, case when count(*)=4 then 'OK' else '>>> REVISAR' end
  from eva_declaraciones where vigente
union all
select 'roles que pueden firmar el acta',
       (select count(*) from (select unnest(string_to_array(
          replace(replace(pg_get_constraintdef(oid),'CHECK ((rol_firmante = ANY (ARRAY[',''),'])))',''), ',')) x
        from pg_constraint where conname='eva_firmas_rol_firmante_check') s),
       4, case when (select count(*) from (select unnest(string_to_array(
          replace(replace(pg_get_constraintdef(oid),'CHECK ((rol_firmante = ANY (ARRAY[',''),'])))',''), ',')) x
        from pg_constraint where conname='eva_firmas_rol_firmante_check') s)=4
        then 'OK' else '>>> REVISAR' end
order by estado desc, que;
