-- Central de Contatos · pré-checagem somente leitura.
-- Resultado esperado antes da primeira instalação: ready_to_apply = true.

with expected_tables(table_name) as (
  values
    ('contact_records'),
    ('contact_categories'),
    ('contact_record_categories'),
    ('contact_relationships'),
    ('contact_interactions'),
    ('contact_followups')
), prototype_tables(table_name) as (
  values
    ('crm_contacts'),
    ('crm_organizations'),
    ('crm_contact_organization_links'),
    ('crm_tags'),
    ('crm_contact_tags'),
    ('crm_organization_tags'),
    ('crm_interactions')
), current_state as (
  select
    table_name,
    to_regclass(format('public.%I', table_name)) is not null as already_exists
  from expected_tables
), prototype_state as (
  select
    table_name,
    to_regclass(format('public.%I', table_name)) is not null as already_exists
  from prototype_tables
), module_summary as (
  select
    count(*) filter (where already_exists) as existing_count,
    coalesce(string_agg(table_name, ', ' order by table_name) filter (where already_exists), 'nenhuma') as existing_names
  from current_state
), prototype_summary as (
  select
    count(*) filter (where already_exists) as existing_count,
    coalesce(string_agg(table_name, ', ' order by table_name) filter (where already_exists), 'nenhuma') as existing_names
  from prototype_state
)
select
  to_regprocedure('public.current_app_role()') is not null as current_app_role_exists,
  to_regprocedure('public.can_edit_crm()') is not null as can_edit_crm_exists,
  to_regrole('anon') is not null as anon_role_exists,
  to_regrole('authenticated') is not null as authenticated_role_exists,
  to_regrole('service_role') is not null as service_role_exists,
  to_regprocedure('gen_random_uuid()') is not null as gen_random_uuid_exists,
  exists (select 1 from pg_publication where pubname = 'supabase_realtime') as realtime_publication_exists,
  module_summary.existing_count as existing_module_tables,
  module_summary.existing_names as tables_already_present,
  prototype_summary.existing_count as old_prototype_tables,
  prototype_summary.existing_names as old_prototype_tables_present,
  (
    to_regprocedure('public.current_app_role()') is not null
    and to_regprocedure('public.can_edit_crm()') is not null
    and to_regrole('anon') is not null
    and to_regrole('authenticated') is not null
    and to_regrole('service_role') is not null
    and to_regprocedure('gen_random_uuid()') is not null
    and exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and module_summary.existing_count = 0
    and prototype_summary.existing_count = 0
  ) as ready_to_apply
from module_summary
cross join prototype_summary;
