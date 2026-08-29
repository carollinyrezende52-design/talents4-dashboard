-- Central de Contatos · verificação depois da migration.
-- Resultado esperado: seis linhas com resultado = OK e category_count >= 10.

with expected_tables(table_name) as (
  values
    ('contact_records'),
    ('contact_categories'),
    ('contact_record_categories'),
    ('contact_relationships'),
    ('contact_interactions'),
    ('contact_followups')
), table_state as (
  select
    e.table_name,
    c.oid is not null as table_exists,
    coalesce(c.relrowsecurity, false) as rls_enabled,
    case when c.oid is null then null else has_table_privilege('anon', format('public.%I', e.table_name), 'SELECT') end as anon_select,
    case when c.oid is null then null else has_table_privilege('authenticated', format('public.%I', e.table_name), 'SELECT') end as authenticated_select,
    case when c.oid is null then null else has_table_privilege('authenticated', format('public.%I', e.table_name), 'DELETE') end as authenticated_delete,
    case when c.oid is null then null else has_table_privilege('service_role', format('public.%I', e.table_name), 'SELECT') end as service_role_select,
    (
      select count(*)
      from pg_policies p
      where p.schemaname = 'public' and p.tablename = e.table_name
    ) as policy_count,
    exists (
      select 1
      from pg_publication_tables ppt
      where ppt.pubname = 'supabase_realtime'
        and ppt.schemaname = 'public'
        and ppt.tablename = e.table_name
    ) as realtime_enabled
  from expected_tables e
  left join pg_class c
    on c.relname = e.table_name
   and c.relnamespace = 'public'::regnamespace
)
select
  table_name,
  table_exists,
  rls_enabled,
  anon_select,
  authenticated_select,
  authenticated_delete,
  service_role_select,
  policy_count,
  realtime_enabled,
  case
    when table_exists
      and rls_enabled
      and anon_select = false
      and authenticated_select = true
      and authenticated_delete = (table_name in ('contact_record_categories', 'contact_relationships'))
      and service_role_select = true
      and policy_count = 4
      and realtime_enabled
    then 'OK'
    else 'REVISAR'
  end as resultado
from table_state
order by table_name;

select count(*) as category_count
from public.contact_categories
where is_active = true;
