-- Talents 4 CRM V2 · Pré-checagem somente leitura
-- Execute separadamente no SQL Editor. Este arquivo não cria, altera ou remove objetos.

with required_objects(object_type, object_name, exists_now) as (
  values
    ('table', 'public.candidatos', to_regclass('public.candidatos') is not null),
    ('table', 'public.employers', to_regclass('public.employers') is not null),
    ('table', 'public.employer_openings', to_regclass('public.employer_openings') is not null),
    ('table', 'public.contact_records', to_regclass('public.contact_records') is not null),
    ('table', 'public.contact_followups', to_regclass('public.contact_followups') is not null),
    ('table', 'public.german_course_classes', to_regclass('public.german_course_classes') is not null),
    ('table', 'public.german_course_enrollments', to_regclass('public.german_course_enrollments') is not null),
    ('function', 'public.current_app_role()', to_regprocedure('public.current_app_role()') is not null),
    ('function', 'public.can_edit_crm()', to_regprocedure('public.can_edit_crm()') is not null)
)
select
  object_type as tipo,
  object_name as objeto,
  exists_now as existe,
  case when exists_now then 'OK' else 'BLOQUEIA_MIGRATION' end as resultado
from required_objects
order by object_type, object_name;

select
  object_name as objeto_v2,
  case when object_kind = 'table' then to_regclass('public.' || object_name) is not null
       else to_regprocedure('public.' || object_name || '()') is not null end as ja_existe,
  case when object_kind = 'table' then 'A migration usa CREATE TABLE IF NOT EXISTS.'
       else 'A migration substitui apenas a função técnica com o mesmo nome.' end as observacao
from (values
  ('table', 'crm_activities'),
  ('table', 'talent_opportunity_matches'),
  ('function', 't4_v2_touch_updated_at'),
  ('function', 't4_v2_sync_match_employer'),
  ('function', 't4_v2_sync_contact_followup')
) as expected(object_kind, object_name)
order by object_kind, object_name;

select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'candidatos' and column_name in ('id', 'nome_completo', 'nivel_alemao', 'em_curso_de_alemao'))
    or (table_name = 'employers' and column_name in ('id', 'nome', 'ativo'))
    or (table_name = 'employer_openings' and column_name in ('id', 'employer_id', 'title', 'status'))
    or (table_name = 'contact_records' and column_name in ('id', 'display_name', 'source_system', 'source_record_id'))
    or (table_name = 'german_course_enrollments' and column_name in ('id', 'candidate_id', 'current_level'))
  )
order by table_name, ordinal_position;
