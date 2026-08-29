begin;

-- Talents 4 · Central de Contatos
-- Agenda profissional para pessoas e organizações, independente do papel exercido.

do $$
begin
  if to_regprocedure('public.current_app_role()') is null then
    raise exception 'Pré-requisito ausente: public.current_app_role()';
  end if;
  if to_regprocedure('public.can_edit_crm()') is null then
    raise exception 'Pré-requisito ausente: public.can_edit_crm()';
  end if;
end;
$$;

create table if not exists public.contact_records (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null default 'Pessoa',
  display_name text not null,
  legal_name text,
  job_title text,
  primary_organization_id uuid references public.contact_records(id) on delete set null,
  email text,
  secondary_email text,
  phone text,
  whatsapp text,
  website text,
  linkedin_url text,
  preferred_channel text,
  country text,
  city text,
  postal_code text,
  address_line text,
  language text,
  status text not null default 'Ativo',
  relationship_stage text not null default 'Novo',
  priority text not null default 'Normal',
  source text,
  owner_username text,
  notes text,
  source_system text,
  source_record_id text,
  retention_review_at date,
  last_interaction_at timestamptz,
  last_interaction_type text,
  last_interaction_summary text,
  next_followup_at timestamptz,
  archived_at timestamptz,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_records_name_nonempty check (btrim(display_name) <> ''),
  constraint contact_records_entity_type_valid check (entity_type in ('Pessoa', 'Organização')),
  constraint contact_records_status_valid check (status in ('Ativo', 'A acompanhar', 'Inativo', 'Arquivado')),
  constraint contact_records_stage_valid check (relationship_stage in ('Novo', 'Em contato', 'Relacionamento', 'Sem retorno', 'Encerrado')),
  constraint contact_records_priority_valid check (priority in ('Baixa', 'Normal', 'Alta', 'Crítica')),
  constraint contact_records_channel_valid check (
    preferred_channel is null or preferred_channel in ('E-mail', 'Telefone', 'WhatsApp', 'LinkedIn', 'Outro')
  ),
  constraint contact_records_primary_org_not_self check (primary_organization_id is distinct from id),
  constraint contact_records_source_pair_valid check (
    (source_system is null and source_record_id is null)
    or (btrim(coalesce(source_system, '')) <> '' and btrim(coalesce(source_record_id, '')) <> '')
  )
);

create table if not exists public.contact_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  color text not null default '#64748B',
  is_system boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_categories_name_nonempty check (btrim(name) <> ''),
  constraint contact_categories_slug_nonempty check (btrim(slug) <> ''),
  constraint contact_categories_color_valid check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint contact_categories_slug_unique unique (slug)
);

create table if not exists public.contact_record_categories (
  contact_id uuid not null references public.contact_records(id) on delete cascade,
  category_id uuid not null references public.contact_categories(id) on delete cascade,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (contact_id, category_id)
);

create table if not exists public.contact_relationships (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contact_records(id) on delete cascade,
  related_contact_id uuid not null references public.contact_records(id) on delete cascade,
  relationship_label text not null,
  is_primary boolean not null default false,
  notes text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_relationships_not_self check (contact_id <> related_contact_id),
  constraint contact_relationships_label_nonempty check (btrim(relationship_label) <> ''),
  constraint contact_relationships_unique unique (contact_id, related_contact_id, relationship_label)
);

create table if not exists public.contact_interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contact_records(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  interaction_type text not null default 'Nota',
  subject text,
  summary text not null,
  outcome text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_interactions_summary_nonempty check (btrim(summary) <> ''),
  constraint contact_interactions_type_valid check (
    interaction_type in ('E-mail', 'Telefone', 'WhatsApp', 'Reunião', 'LinkedIn', 'Presencial', 'Nota', 'Outro')
  )
);

create table if not exists public.contact_followups (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contact_records(id) on delete cascade,
  title text not null,
  due_at timestamptz not null,
  status text not null default 'Pendente',
  priority text not null default 'Normal',
  assigned_username text,
  notes text,
  completed_at timestamptz,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_followups_title_nonempty check (btrim(title) <> ''),
  constraint contact_followups_status_valid check (status in ('Pendente', 'Concluído', 'Cancelado')),
  constraint contact_followups_priority_valid check (priority in ('Baixa', 'Normal', 'Alta', 'Crítica'))
);

create unique index if not exists contact_categories_name_lower_uidx
  on public.contact_categories (lower(btrim(name)));
create unique index if not exists contact_records_source_uidx
  on public.contact_records (source_system, source_record_id)
  where source_system is not null and source_record_id is not null;
create index if not exists contact_records_name_idx
  on public.contact_records (lower(display_name));
create index if not exists contact_records_status_idx
  on public.contact_records (status, entity_type, relationship_stage);
create index if not exists contact_records_owner_idx
  on public.contact_records (owner_username, status);
create index if not exists contact_records_next_followup_idx
  on public.contact_records (next_followup_at)
  where next_followup_at is not null and archived_at is null;
create index if not exists contact_records_last_interaction_idx
  on public.contact_records (last_interaction_at desc)
  where archived_at is null;
create index if not exists contact_records_primary_org_idx
  on public.contact_records (primary_organization_id)
  where primary_organization_id is not null;
create index if not exists contact_records_email_idx
  on public.contact_records (lower(btrim(email)))
  where email is not null and btrim(email) <> '';
create index if not exists contact_records_phone_idx
  on public.contact_records ((regexp_replace(phone, '[^0-9]+', '', 'g')))
  where phone is not null and btrim(phone) <> '';
create index if not exists contact_record_categories_category_idx
  on public.contact_record_categories (category_id, contact_id);
create index if not exists contact_relationships_related_idx
  on public.contact_relationships (related_contact_id, contact_id);
create unique index if not exists contact_relationships_primary_uidx
  on public.contact_relationships (contact_id)
  where is_primary = true;
create index if not exists contact_interactions_timeline_idx
  on public.contact_interactions (contact_id, occurred_at desc);
create index if not exists contact_followups_due_idx
  on public.contact_followups (status, due_at)
  where status = 'Pendente';

create or replace function public.touch_contact_module_updated_at()
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

create or replace function public.validate_contact_primary_organization()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.primary_organization_id is not null and not exists (
    select 1
    from public.contact_records organization_record
    where organization_record.id = new.primary_organization_id
      and organization_record.entity_type = 'Organização'
      and organization_record.archived_at is null
  ) then
    raise exception 'O vínculo principal precisa apontar para uma organização ativa.';
  end if;
  return new;
end;
$$;

create or replace function public.protect_referenced_contact_organization()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.entity_type = 'Organização'
     and (new.entity_type <> 'Organização' or new.archived_at is not null)
     and exists (
       select 1
       from public.contact_records person_record
       where person_record.primary_organization_id = old.id
         and person_record.archived_at is null
     ) then
    raise exception 'Remova ou substitua os vínculos principais antes de alterar ou arquivar esta organização.';
  end if;
  return new;
end;
$$;

create or replace function public.normalize_contact_followup_completion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'Concluído' then
    new.completed_at = coalesce(new.completed_at, now());
  else
    new.completed_at = null;
  end if;
  return new;
end;
$$;

create or replace function public.refresh_contact_interaction_summary()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_contact_id uuid;
  latest_at timestamptz;
  latest_type text;
  latest_summary text;
begin
  for target_contact_id in
    select distinct contact_id
    from (
      select case when tg_op in ('UPDATE', 'DELETE') then old.contact_id end as contact_id
      union all
      select case when tg_op in ('INSERT', 'UPDATE') then new.contact_id end as contact_id
    ) affected
    where contact_id is not null
  loop
    select occurred_at, interaction_type, summary
    into latest_at, latest_type, latest_summary
    from public.contact_interactions
    where contact_id = target_contact_id
    order by occurred_at desc, created_at desc
    limit 1;

    update public.contact_records
    set last_interaction_at = latest_at,
        last_interaction_type = latest_type,
        last_interaction_summary = latest_summary
    where id = target_contact_id;
  end loop;

  return null;
end;
$$;

create or replace function public.refresh_contact_followup_summary()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_contact_id uuid;
  next_due_at timestamptz;
begin
  for target_contact_id in
    select distinct contact_id
    from (
      select case when tg_op in ('UPDATE', 'DELETE') then old.contact_id end as contact_id
      union all
      select case when tg_op in ('INSERT', 'UPDATE') then new.contact_id end as contact_id
    ) affected
    where contact_id is not null
  loop
    select min(due_at)
    into next_due_at
    from public.contact_followups
    where contact_id = target_contact_id
      and status = 'Pendente';

    update public.contact_records
    set next_followup_at = next_due_at
    where id = target_contact_id;
  end loop;

  return null;
end;
$$;

drop trigger if exists contact_records_touch_updated_at on public.contact_records;
create trigger contact_records_touch_updated_at
before update on public.contact_records
for each row execute function public.touch_contact_module_updated_at();

drop trigger if exists contact_records_validate_primary_org on public.contact_records;
create trigger contact_records_validate_primary_org
before insert or update of primary_organization_id on public.contact_records
for each row execute function public.validate_contact_primary_organization();

drop trigger if exists contact_records_protect_referenced_org on public.contact_records;
create trigger contact_records_protect_referenced_org
before update of entity_type, archived_at on public.contact_records
for each row execute function public.protect_referenced_contact_organization();

drop trigger if exists contact_categories_touch_updated_at on public.contact_categories;
create trigger contact_categories_touch_updated_at
before update on public.contact_categories
for each row execute function public.touch_contact_module_updated_at();

drop trigger if exists contact_relationships_touch_updated_at on public.contact_relationships;
create trigger contact_relationships_touch_updated_at
before update on public.contact_relationships
for each row execute function public.touch_contact_module_updated_at();

drop trigger if exists contact_interactions_touch_updated_at on public.contact_interactions;
create trigger contact_interactions_touch_updated_at
before update on public.contact_interactions
for each row execute function public.touch_contact_module_updated_at();

drop trigger if exists contact_followups_touch_updated_at on public.contact_followups;
create trigger contact_followups_touch_updated_at
before update on public.contact_followups
for each row execute function public.touch_contact_module_updated_at();

drop trigger if exists contact_followups_normalize_completion on public.contact_followups;
create trigger contact_followups_normalize_completion
before insert or update of status, completed_at on public.contact_followups
for each row execute function public.normalize_contact_followup_completion();

drop trigger if exists contact_interactions_refresh_summary on public.contact_interactions;
create trigger contact_interactions_refresh_summary
after insert or update or delete on public.contact_interactions
for each row execute function public.refresh_contact_interaction_summary();

drop trigger if exists contact_followups_refresh_summary on public.contact_followups;
create trigger contact_followups_refresh_summary
after insert or update or delete on public.contact_followups
for each row execute function public.refresh_contact_followup_summary();

insert into public.contact_categories (name, slug, color, is_system, sort_order)
values
  ('Candidato', 'candidato', '#2563EB', true, 10),
  ('Professor', 'professor', '#7C3AED', true, 20),
  ('Empregador', 'empregador', '#0F8F83', true, 30),
  ('Funcionário', 'funcionario', '#0F766E', true, 40),
  ('Parceiro', 'parceiro', '#D97706', true, 50),
  ('Fornecedor', 'fornecedor', '#EA580C', true, 60),
  ('Prestador', 'prestador', '#64748B', true, 70),
  ('Órgão público', 'orgao-publico', '#475569', true, 80),
  ('Cliente', 'cliente', '#0891B2', true, 90),
  ('Outro', 'outro', '#6B7280', true, 100)
on conflict (slug) do update
set name = excluded.name,
    color = excluded.color,
    is_system = true,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

alter table public.contact_records enable row level security;
alter table public.contact_categories enable row level security;
alter table public.contact_record_categories enable row level security;
alter table public.contact_relationships enable row level security;
alter table public.contact_interactions enable row level security;
alter table public.contact_followups enable row level security;

revoke all on public.contact_records from public, anon, authenticated;
revoke all on public.contact_categories from public, anon, authenticated;
revoke all on public.contact_record_categories from public, anon, authenticated;
revoke all on public.contact_relationships from public, anon, authenticated;
revoke all on public.contact_interactions from public, anon, authenticated;
revoke all on public.contact_followups from public, anon, authenticated;

grant select, insert, update on public.contact_records to authenticated;
grant select, insert, update on public.contact_categories to authenticated;
grant select, insert, delete on public.contact_record_categories to authenticated;
grant select, insert, update, delete on public.contact_relationships to authenticated;
grant select, insert, update on public.contact_interactions to authenticated;
grant select, insert, update on public.contact_followups to authenticated;

grant all on public.contact_records to service_role;
grant all on public.contact_categories to service_role;
grant all on public.contact_record_categories to service_role;
grant all on public.contact_relationships to service_role;
grant all on public.contact_interactions to service_role;
grant all on public.contact_followups to service_role;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'contact_records',
    'contact_categories',
    'contact_record_categories',
    'contact_relationships',
    'contact_interactions',
    'contact_followups'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', target_table || '_select_auth', target_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.current_app_role() = any (array[''admin''::text, ''recrutador''::text, ''viewer''::text]))',
      target_table || '_select_auth',
      target_table
    );

    execute format('drop policy if exists %I on public.%I', target_table || '_insert_editors', target_table);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.can_edit_crm())',
      target_table || '_insert_editors',
      target_table
    );

    execute format('drop policy if exists %I on public.%I', target_table || '_update_editors', target_table);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.can_edit_crm()) with check (public.can_edit_crm())',
      target_table || '_update_editors',
      target_table
    );

    execute format('drop policy if exists %I on public.%I', target_table || '_delete_editors', target_table);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (%s)',
      target_table || '_delete_editors',
      target_table,
      case
        when target_table in ('contact_record_categories', 'contact_relationships') then 'public.can_edit_crm()'
        else 'false'
      end
    );
  end loop;
end;
$$;

revoke all on function public.touch_contact_module_updated_at() from public, anon, authenticated;
revoke all on function public.validate_contact_primary_organization() from public, anon, authenticated;
revoke all on function public.protect_referenced_contact_organization() from public, anon, authenticated;
revoke all on function public.normalize_contact_followup_completion() from public, anon, authenticated;
revoke all on function public.refresh_contact_interaction_summary() from public, anon, authenticated;
revoke all on function public.refresh_contact_followup_summary() from public, anon, authenticated;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'contact_records',
    'contact_categories',
    'contact_record_categories',
    'contact_relationships',
    'contact_interactions',
    'contact_followups'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end;
$$;

do $$
declare
  target_table text;
  rls_enabled boolean;
begin
  foreach target_table in array array[
    'contact_records',
    'contact_categories',
    'contact_record_categories',
    'contact_relationships',
    'contact_interactions',
    'contact_followups'
  ]
  loop
    select c.relrowsecurity
    into rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = target_table;

    if not coalesce(rls_enabled, false) then
      raise exception 'RLS não habilitado em public.%', target_table;
    end if;

    if has_table_privilege('anon', format('public.%I', target_table), 'SELECT') then
      raise exception 'Acesso anon indevido em public.%', target_table;
    end if;

    if target_table in ('contact_records', 'contact_categories', 'contact_interactions', 'contact_followups')
       and has_table_privilege('authenticated', format('public.%I', target_table), 'DELETE') then
      raise exception 'Hard delete autenticado indevido em public.%', target_table;
    end if;
  end loop;
end;
$$;

comment on table public.contact_records is 'Cadastro geral de pessoas e organizações da Central de Contatos Talents 4.';
comment on table public.contact_categories is 'Categorias personalizáveis usadas para classificar contatos.';
comment on table public.contact_record_categories is 'Associação N:N entre contatos e categorias.';
comment on table public.contact_relationships is 'Relacionamentos profissionais entre pessoas e organizações.';
comment on table public.contact_interactions is 'Linha do tempo de comunicações e observações de cada contato.';
comment on table public.contact_followups is 'Próximas ações e lembretes vinculados aos contatos.';

commit;
