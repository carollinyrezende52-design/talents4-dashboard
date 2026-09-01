begin;

-- Talents 4 CRM V2 · Camada de integração aditiva
-- Não remove tabelas, não migra dados legados e não cria integração com Google.

do $$
declare
  required_table text;
begin
  foreach required_table in array array[
    'candidatos', 'employers', 'employer_openings', 'contact_records',
    'contact_followups', 'german_course_classes', 'german_course_enrollments'
  ] loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'Pré-requisito ausente: public.%', required_table;
    end if;
  end loop;
  if to_regprocedure('public.current_app_role()') is null then
    raise exception 'Pré-requisito ausente: public.current_app_role()';
  end if;
  if to_regprocedure('public.can_edit_crm()') is null then
    raise exception 'Pré-requisito ausente: public.can_edit_crm()';
  end if;
end;
$$;

alter table public.employer_openings
  add column if not exists location text,
  add column if not exists area text,
  add column if not exists external_url text,
  add column if not exists language_requirement text,
  add column if not exists recognition_requirement text,
  add column if not exists verified_at timestamptz,
  add column if not exists description text,
  add column if not exists source text;

alter table public.german_course_classes
  add column if not exists teacher_contact_id uuid references public.contact_records(id) on delete set null;

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  activity_type text not null default 'Tarefa',
  status text not null default 'Pendente',
  priority text not null default 'Normal',
  due_at timestamptz,
  completed_at timestamptz,
  owner_username text,
  talent_id text references public.candidatos(id) on delete set null,
  employer_id uuid references public.employers(id) on delete set null,
  opening_id uuid references public.employer_openings(id) on delete set null,
  contact_id uuid references public.contact_records(id) on delete set null,
  enrollment_id uuid references public.german_course_enrollments(id) on delete set null,
  contact_followup_id uuid unique references public.contact_followups(id) on delete cascade,
  notes text,
  outcome text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_activities_title_nonempty check (btrim(title) <> ''),
  constraint crm_activities_type_valid check (activity_type in ('Tarefa', 'Ligação', 'E-mail', 'Reunião', 'WhatsApp', 'Documento', 'Acompanhamento', 'Follow-up', 'Outro')),
  constraint crm_activities_status_valid check (status in ('Pendente', 'Em andamento', 'Concluída', 'Cancelada')),
  constraint crm_activities_priority_valid check (priority in ('Baixa', 'Normal', 'Alta', 'Crítica')),
  constraint crm_activities_completion_valid check (
    (status = 'Concluída' and completed_at is not null)
    or (status <> 'Concluída')
  )
);

create table if not exists public.talent_opportunity_matches (
  id uuid primary key default gen_random_uuid(),
  talent_id text not null references public.candidatos(id) on delete cascade,
  opening_id uuid not null references public.employer_openings(id) on delete cascade,
  employer_id uuid not null references public.employers(id) on delete cascade,
  stage text not null default 'Mapeado',
  status text not null default 'Ativo',
  priority integer not null default 100,
  overall_score numeric(5,2),
  professional_score numeric(5,2),
  language_score numeric(5,2),
  mobility_score numeric(5,2),
  document_score numeric(5,2),
  viability text not null default 'A validar',
  reasons text,
  barriers text,
  next_action text,
  next_action_at timestamptz,
  owner_username text,
  sent_at timestamptz,
  responded_at timestamptz,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint talent_opportunity_matches_unique unique (talent_id, opening_id),
  constraint talent_opportunity_matches_priority_valid check (priority between 1 and 9999),
  constraint talent_opportunity_matches_viability_valid check (viability in ('A validar', 'Baixa', 'Média', 'Alta')),
  constraint talent_opportunity_matches_scores_valid check (
    (overall_score is null or overall_score between 0 and 100)
    and (professional_score is null or professional_score between 0 and 100)
    and (language_score is null or language_score between 0 and 100)
    and (mobility_score is null or mobility_score between 0 and 100)
    and (document_score is null or document_score between 0 and 100)
  )
);

create index if not exists crm_activities_due_idx
  on public.crm_activities (status, due_at)
  where status in ('Pendente', 'Em andamento');
create index if not exists crm_activities_talent_idx on public.crm_activities (talent_id, due_at);
create index if not exists crm_activities_employer_idx on public.crm_activities (employer_id, due_at);
create index if not exists crm_activities_contact_idx on public.crm_activities (contact_id, due_at);
create index if not exists crm_activities_enrollment_idx on public.crm_activities (enrollment_id, due_at);
create index if not exists talent_opportunity_matches_talent_idx on public.talent_opportunity_matches (talent_id, stage, priority);
create index if not exists talent_opportunity_matches_employer_idx on public.talent_opportunity_matches (employer_id, stage, priority);
create index if not exists talent_opportunity_matches_opening_idx on public.talent_opportunity_matches (opening_id, stage, priority);
create index if not exists german_course_classes_teacher_contact_idx
  on public.german_course_classes (teacher_contact_id)
  where teacher_contact_id is not null;

create or replace function public.t4_v2_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  if tg_table_name = 'crm_activities' then
    if new.status = 'Concluída' and new.completed_at is null then new.completed_at = now(); end if;
    if new.status <> 'Concluída' then new.completed_at = null; end if;
  end if;
  return new;
end;
$$;

create or replace function public.t4_v2_sync_match_employer()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  opening_employer uuid;
begin
  select e.id
    into opening_employer
  from public.employer_openings o
  join public.employers e
    on e.id::text = o.employer_id
  where o.id = new.opening_id
    and o.deleted_at is null;

  if opening_employer is null then
    raise exception
      'A oportunidade % não possui um empregador válido vinculado.',
      new.opening_id;
  end if;

  new.employer_id = opening_employer;

  return new;
end;
$$;


create or replace function public.t4_v2_sync_contact_followup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.crm_activities where contact_followup_id = old.id;
    return old;
  end if;

  insert into public.crm_activities (
    title, activity_type, status, priority, due_at, completed_at, owner_username,
    contact_id, contact_followup_id, notes, created_by, updated_by, created_at, updated_at
  ) values (
    new.title,
    'Follow-up',
    case new.status when 'Concluído' then 'Concluída' when 'Cancelado' then 'Cancelada' else 'Pendente' end,
    new.priority,
    new.due_at,
    case when new.status = 'Concluído' then coalesce(new.completed_at, now()) else null end,
    new.assigned_username,
    new.contact_id,
    new.id,
    new.notes,
    new.created_by,
    new.updated_by,
    new.created_at,
    new.updated_at
  )
  on conflict (contact_followup_id) do update set
    title = excluded.title,
    status = excluded.status,
    priority = excluded.priority,
    due_at = excluded.due_at,
    completed_at = excluded.completed_at,
    owner_username = excluded.owner_username,
    contact_id = excluded.contact_id,
    notes = excluded.notes,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;
  return new;
end;
$$;

drop trigger if exists crm_activities_touch_updated_at on public.crm_activities;
create trigger crm_activities_touch_updated_at
before update on public.crm_activities
for each row execute function public.t4_v2_touch_updated_at();

drop trigger if exists talent_opportunity_matches_touch_updated_at on public.talent_opportunity_matches;
create trigger talent_opportunity_matches_touch_updated_at
before update on public.talent_opportunity_matches
for each row execute function public.t4_v2_touch_updated_at();

drop trigger if exists talent_opportunity_matches_sync_employer on public.talent_opportunity_matches;
create trigger talent_opportunity_matches_sync_employer
before insert or update of opening_id, employer_id on public.talent_opportunity_matches
for each row execute function public.t4_v2_sync_match_employer();

drop trigger if exists contact_followups_sync_crm_activity on public.contact_followups;
create trigger contact_followups_sync_crm_activity
after insert or update or delete on public.contact_followups
for each row execute function public.t4_v2_sync_contact_followup();

-- Importa apenas os follow-ups atuais para a agenda central. Não altera os registros de origem.
insert into public.crm_activities (
  title, activity_type, status, priority, due_at, completed_at, owner_username,
  contact_id, contact_followup_id, notes, created_by, updated_by, created_at, updated_at
)
select
  f.title,
  'Follow-up',
  case f.status when 'Concluído' then 'Concluída' when 'Cancelado' then 'Cancelada' else 'Pendente' end,
  f.priority,
  f.due_at,
  case when f.status = 'Concluído' then coalesce(f.completed_at, f.updated_at, now()) else null end,
  f.assigned_username,
  f.contact_id,
  f.id,
  f.notes,
  f.created_by,
  f.updated_by,
  f.created_at,
  f.updated_at
from public.contact_followups f
on conflict (contact_followup_id) do nothing;

alter table public.crm_activities enable row level security;
alter table public.talent_opportunity_matches enable row level security;

revoke all on public.crm_activities from public, anon, authenticated;
revoke all on public.talent_opportunity_matches from public, anon, authenticated;
grant select, insert, update on public.crm_activities to authenticated;
grant select, insert, update on public.talent_opportunity_matches to authenticated;
grant all on public.crm_activities to service_role;
grant all on public.talent_opportunity_matches to service_role;

drop policy if exists crm_activities_select_auth on public.crm_activities;
create policy crm_activities_select_auth on public.crm_activities
for select to authenticated
using (public.current_app_role() = any (array['admin'::text, 'recrutador'::text, 'viewer'::text]));
drop policy if exists crm_activities_insert_editors on public.crm_activities;
create policy crm_activities_insert_editors on public.crm_activities
for insert to authenticated with check (public.can_edit_crm());
drop policy if exists crm_activities_update_editors on public.crm_activities;
create policy crm_activities_update_editors on public.crm_activities
for update to authenticated using (public.can_edit_crm()) with check (public.can_edit_crm());

drop policy if exists talent_opportunity_matches_select_auth on public.talent_opportunity_matches;
create policy talent_opportunity_matches_select_auth on public.talent_opportunity_matches
for select to authenticated
using (public.current_app_role() = any (array['admin'::text, 'recrutador'::text, 'viewer'::text]));
drop policy if exists talent_opportunity_matches_insert_editors on public.talent_opportunity_matches;
create policy talent_opportunity_matches_insert_editors on public.talent_opportunity_matches
for insert to authenticated with check (public.can_edit_crm());
drop policy if exists talent_opportunity_matches_update_editors on public.talent_opportunity_matches;
create policy talent_opportunity_matches_update_editors on public.talent_opportunity_matches
for update to authenticated using (public.can_edit_crm()) with check (public.can_edit_crm());

revoke all on function public.t4_v2_touch_updated_at() from public, anon, authenticated;
revoke all on function public.t4_v2_sync_match_employer() from public, anon, authenticated;
revoke all on function public.t4_v2_sync_contact_followup() from public, anon, authenticated;
grant execute on function public.t4_v2_touch_updated_at() to service_role;
grant execute on function public.t4_v2_sync_match_employer() to service_role;
grant execute on function public.t4_v2_sync_contact_followup() to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_activities') then
      execute 'alter publication supabase_realtime add table public.crm_activities';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'talent_opportunity_matches') then
      execute 'alter publication supabase_realtime add table public.talent_opportunity_matches';
    end if;
  end if;
end;
$$;

do $$
declare
  target_table text;
  rls_enabled boolean;
begin
  foreach target_table in array array['crm_activities', 'talent_opportunity_matches'] loop
    select c.relrowsecurity into rls_enabled
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = target_table;
    if not coalesce(rls_enabled, false) then raise exception 'RLS não habilitado em public.%', target_table; end if;
    if has_table_privilege('anon', format('public.%I', target_table), 'SELECT') then raise exception 'Acesso anon indevido em public.%', target_table; end if;
    if not has_table_privilege('authenticated', format('public.%I', target_table), 'SELECT') then raise exception 'SELECT authenticated ausente em public.%', target_table; end if;
    if has_table_privilege('authenticated', format('public.%I', target_table), 'DELETE') then raise exception 'Hard delete authenticated indevido em public.%', target_table; end if;
  end loop;
end;
$$;

comment on table public.crm_activities is 'Agenda operacional central da V2, relacionada a Talentos, empregadores, contatos e alemão.';
comment on table public.talent_opportunity_matches is 'Compatibilidade contextual entre um Talento e uma oportunidade específica.';
comment on column public.german_course_classes.teacher_contact_id is 'Professor relacionado à Central de Contatos; teacher_name preserva compatibilidade.';

commit;
