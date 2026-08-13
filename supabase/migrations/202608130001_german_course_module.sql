begin;

-- Talents 4 · Curso de Alemão
-- Modelo operacional: turma -> matrícula do candidato -> histórico de acompanhamento.

create table if not exists public.german_course_classes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  provider text,
  teacher_name text,
  level_start text not null default 'A1',
  level_target text not null default 'B1',
  start_date date,
  expected_end_date date,
  schedule_text text,
  modality text not null default 'Online',
  capacity integer not null default 20,
  status text not null default 'Planejada',
  meeting_link text,
  drive_link text,
  notes text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint german_course_classes_code_nonempty check (btrim(code) <> ''),
  constraint german_course_classes_name_nonempty check (btrim(name) <> ''),
  constraint german_course_classes_code_unique unique (code),
  constraint german_course_classes_capacity_positive check (capacity > 0),
  constraint german_course_classes_dates_valid check (
    expected_end_date is null or start_date is null or expected_end_date >= start_date
  ),
  constraint german_course_classes_modality_valid check (
    modality in ('Online', 'Presencial', 'Híbrido')
  ),
  constraint german_course_classes_status_valid check (
    status in ('Planejada', 'Ativa', 'Pausada', 'Concluída', 'Cancelada')
  ),
  constraint german_course_classes_levels_valid check (
    level_start in ('Pré-A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')
    and level_target in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
  )
);

create table if not exists public.german_course_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.german_course_classes(id) on delete cascade,
  candidate_id text not null references public.candidatos(id) on delete cascade,
  status text not null default 'Matriculado',
  enrolled_at date not null default current_date,
  completed_at date,
  current_level text,
  target_level text,
  attendance_percent numeric(5,2),
  progress_percent numeric(5,2) not null default 0,
  performance text not null default 'Sem avaliação',
  risk_level text not null default 'Baixo',
  last_assessment_score numeric(6,2),
  last_assessment_at date,
  exam_status text not null default 'Não agendado',
  next_action text,
  next_action_due date,
  owner_name text,
  notes text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint german_course_enrollments_class_candidate_unique unique (class_id, candidate_id),
  constraint german_course_enrollments_status_valid check (
    status in ('Matriculado', 'Ativo', 'Pausado', 'Concluído', 'Desistente', 'Transferido')
  ),
  constraint german_course_enrollments_level_valid check (
    current_level is null or current_level in ('Pré-A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')
  ),
  constraint german_course_enrollments_target_valid check (
    target_level is null or target_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
  ),
  constraint german_course_enrollments_attendance_valid check (
    attendance_percent is null or attendance_percent between 0 and 100
  ),
  constraint german_course_enrollments_progress_valid check (
    progress_percent between 0 and 100
  ),
  constraint german_course_enrollments_performance_valid check (
    performance in ('Sem avaliação', 'Excelente', 'Adequado', 'Atenção', 'Crítico')
  ),
  constraint german_course_enrollments_risk_valid check (
    risk_level in ('Baixo', 'Médio', 'Alto')
  ),
  constraint german_course_enrollments_exam_valid check (
    exam_status in ('Não agendado', 'Agendado', 'Aprovado', 'Reprovado')
  )
);

create table if not exists public.german_course_updates (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.german_course_enrollments(id) on delete cascade,
  event_date date not null default current_date,
  kind text not null,
  attendance_status text,
  score numeric(6,2),
  level_after text,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint german_course_updates_kind_valid check (
    kind in ('Presença', 'Avaliação', 'Evolução', 'Contato', 'Alerta')
  ),
  constraint german_course_updates_attendance_valid check (
    attendance_status is null or attendance_status in ('Presente', 'Falta justificada', 'Falta')
  ),
  constraint german_course_updates_level_valid check (
    level_after is null or level_after in ('Pré-A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')
  ),
  constraint german_course_updates_score_valid check (
    score is null or score between 0 and 100
  ),
  constraint german_course_updates_kind_fields_valid check (
    (kind = 'Presença' and attendance_status is not null)
    or (kind <> 'Presença' and attendance_status is null)
  )
);

create index if not exists german_course_classes_status_idx
  on public.german_course_classes (status, start_date);
create index if not exists german_course_enrollments_class_idx
  on public.german_course_enrollments (class_id, status);
create index if not exists german_course_enrollments_candidate_idx
  on public.german_course_enrollments (candidate_id);
create index if not exists german_course_enrollments_followup_idx
  on public.german_course_enrollments (next_action_due)
  where next_action_due is not null;
create index if not exists german_course_updates_enrollment_date_idx
  on public.german_course_updates (enrollment_id, event_date desc, created_at desc);

create or replace function public.touch_german_course_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists german_course_classes_touch_updated_at on public.german_course_classes;
create trigger german_course_classes_touch_updated_at
before update on public.german_course_classes
for each row execute function public.touch_german_course_updated_at();

drop trigger if exists german_course_enrollments_touch_updated_at on public.german_course_enrollments;
create trigger german_course_enrollments_touch_updated_at
before update on public.german_course_enrollments
for each row execute function public.touch_german_course_updated_at();

create or replace function public.touch_german_course_update_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists german_course_updates_touch_updated_at on public.german_course_updates;
create trigger german_course_updates_touch_updated_at
before update on public.german_course_updates
for each row execute function public.touch_german_course_update_updated_at();

create or replace function public.refresh_german_course_enrollment_metrics()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_enrollment uuid;
  attendance_total integer;
  attendance_present integer;
  latest_score numeric(6,2);
  latest_score_date date;
  latest_level text;
begin
  target_enrollment := case when tg_op = 'DELETE' then old.enrollment_id else new.enrollment_id end;

  select
    count(*) filter (where kind = 'Presença'),
    count(*) filter (where kind = 'Presença' and attendance_status = 'Presente')
  into attendance_total, attendance_present
  from public.german_course_updates
  where enrollment_id = target_enrollment;

  select score, event_date
  into latest_score, latest_score_date
  from public.german_course_updates
  where enrollment_id = target_enrollment
    and kind = 'Avaliação'
    and score is not null
  order by event_date desc, created_at desc
  limit 1;

  select level_after
  into latest_level
  from public.german_course_updates
  where enrollment_id = target_enrollment
    and level_after is not null
  order by event_date desc, created_at desc
  limit 1;

  update public.german_course_enrollments
  set attendance_percent = case
        when attendance_total > 0 then round(attendance_present * 100.0 / attendance_total, 2)
        else attendance_percent
      end,
      last_assessment_score = latest_score,
      last_assessment_at = latest_score_date,
      current_level = coalesce(latest_level, current_level),
      updated_at = now()
  where id = target_enrollment;

  -- O retorno é ignorado em triggers AFTER.
  return null;
end;
$$;

drop trigger if exists german_course_updates_refresh_enrollment on public.german_course_updates;
create trigger german_course_updates_refresh_enrollment
after insert or update or delete on public.german_course_updates
for each row execute function public.refresh_german_course_enrollment_metrics();

alter table public.german_course_classes enable row level security;
alter table public.german_course_enrollments enable row level security;
alter table public.german_course_updates enable row level security;

revoke all on public.german_course_classes from anon;
revoke all on public.german_course_enrollments from anon;
revoke all on public.german_course_updates from anon;

grant select, insert, update, delete on public.german_course_classes to authenticated;
grant select, insert, update, delete on public.german_course_enrollments to authenticated;
grant select, insert, update, delete on public.german_course_updates to authenticated;

drop policy if exists german_course_classes_select_auth on public.german_course_classes;
create policy german_course_classes_select_auth
on public.german_course_classes for select to authenticated
using (public.current_app_role() = any (array['admin'::text, 'recrutador'::text, 'viewer'::text]));
drop policy if exists german_course_classes_insert_editors on public.german_course_classes;
create policy german_course_classes_insert_editors
on public.german_course_classes for insert to authenticated
with check (public.can_edit_crm());
drop policy if exists german_course_classes_update_editors on public.german_course_classes;
create policy german_course_classes_update_editors
on public.german_course_classes for update to authenticated
using (public.can_edit_crm()) with check (public.can_edit_crm());
drop policy if exists german_course_classes_delete_editors on public.german_course_classes;
create policy german_course_classes_delete_editors
on public.german_course_classes for delete to authenticated
using (public.can_edit_crm());

drop policy if exists german_course_enrollments_select_auth on public.german_course_enrollments;
create policy german_course_enrollments_select_auth
on public.german_course_enrollments for select to authenticated
using (public.current_app_role() = any (array['admin'::text, 'recrutador'::text, 'viewer'::text]));
drop policy if exists german_course_enrollments_insert_editors on public.german_course_enrollments;
create policy german_course_enrollments_insert_editors
on public.german_course_enrollments for insert to authenticated
with check (public.can_edit_crm());
drop policy if exists german_course_enrollments_update_editors on public.german_course_enrollments;
create policy german_course_enrollments_update_editors
on public.german_course_enrollments for update to authenticated
using (public.can_edit_crm()) with check (public.can_edit_crm());
drop policy if exists german_course_enrollments_delete_editors on public.german_course_enrollments;
create policy german_course_enrollments_delete_editors
on public.german_course_enrollments for delete to authenticated
using (public.can_edit_crm());

drop policy if exists german_course_updates_select_auth on public.german_course_updates;
create policy german_course_updates_select_auth
on public.german_course_updates for select to authenticated
using (public.current_app_role() = any (array['admin'::text, 'recrutador'::text, 'viewer'::text]));
drop policy if exists german_course_updates_insert_editors on public.german_course_updates;
create policy german_course_updates_insert_editors
on public.german_course_updates for insert to authenticated
with check (public.can_edit_crm());
drop policy if exists german_course_updates_update_editors on public.german_course_updates;
create policy german_course_updates_update_editors
on public.german_course_updates for update to authenticated
using (public.can_edit_crm()) with check (public.can_edit_crm());
drop policy if exists german_course_updates_delete_editors on public.german_course_updates;
create policy german_course_updates_delete_editors
on public.german_course_updates for delete to authenticated
using (public.can_edit_crm());

comment on table public.german_course_classes is 'Turmas de alemão acompanhadas pela Talents 4.';
comment on table public.german_course_enrollments is 'Matrícula e estado operacional de cada candidato em uma turma.';
comment on table public.german_course_updates is 'Histórico de presença, avaliação, evolução, contato e alerta da matrícula.';

commit;
