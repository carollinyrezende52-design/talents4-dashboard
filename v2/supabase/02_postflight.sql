-- Talents 4 CRM V2 · Verificação somente leitura após a migration

with targets(table_name) as (
  values ('crm_activities'), ('talent_opportunity_matches')
)
select
  t.table_name,
  to_regclass('public.' || t.table_name) is not null as existe,
  coalesce(c.relrowsecurity, false) as rls_habilitado,
  has_table_privilege('anon', 'public.' || t.table_name, 'SELECT') as anon_select,
  has_table_privilege('authenticated', 'public.' || t.table_name, 'SELECT') as authenticated_select,
  has_table_privilege('authenticated', 'public.' || t.table_name, 'INSERT') as authenticated_insert,
  has_table_privilege('authenticated', 'public.' || t.table_name, 'UPDATE') as authenticated_update,
  has_table_privilege('authenticated', 'public.' || t.table_name, 'DELETE') as authenticated_delete,
  case
    when to_regclass('public.' || t.table_name) is null then 'FALHA_OBJETO'
    when not coalesce(c.relrowsecurity, false) then 'FALHA_RLS'
    when has_table_privilege('anon', 'public.' || t.table_name, 'SELECT') then 'FALHA_ANON'
    when not has_table_privilege('authenticated', 'public.' || t.table_name, 'SELECT') then 'FALHA_AUTH'
    when has_table_privilege('authenticated', 'public.' || t.table_name, 'DELETE') then 'FALHA_DELETE'
    else 'OK'
  end as resultado
from targets t
left join pg_class c on c.oid = to_regclass('public.' || t.table_name)
order by t.table_name;

select
  expected.table_name,
  expected.column_name,
  c.data_type,
  case when c.column_name is null then 'FALHA_AUSENTE' else 'OK' end as resultado
from (values
  ('employer_openings', 'location'),
  ('employer_openings', 'area'),
  ('employer_openings', 'language_requirement'),
  ('employer_openings', 'recognition_requirement'),
  ('german_course_classes', 'teacher_contact_id')
) as expected(table_name, column_name)
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = expected.table_name
 and c.column_name = expected.column_name
order by expected.table_name, expected.column_name;

select
  trigger_name,
  event_object_table,
  action_timing,
  string_agg(event_manipulation, ', ' order by event_manipulation) as eventos,
  'OK' as resultado
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'crm_activities_touch_updated_at',
    'talent_opportunity_matches_touch_updated_at',
    'talent_opportunity_matches_sync_employer',
    'contact_followups_sync_crm_activity'
  )
group by trigger_name, event_object_table, action_timing
order by trigger_name;

select
  count(*) filter (where contact_followup_id is not null) as followups_espelhados,
  (select count(*) from public.contact_followups) as followups_origem,
  case
    when count(*) filter (where contact_followup_id is not null) = (select count(*) from public.contact_followups) then 'OK'
    else 'REVISAR_CONTAGEM'
  end as resultado
from public.crm_activities;
