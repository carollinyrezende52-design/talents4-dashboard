-- TALENTS 4 · CORES PERSONALIZADAS DAS PASTAS DE DOCUMENTAÇÃO
-- Aplicar manualmente somente no projeto Supabase de produção.
-- A alteração é aditiva: não remove nem modifica registros existentes.

begin;

alter table public.documentation_nodes
  add column if not exists folder_color text;

update public.documentation_nodes
set folder_color = '#FFF5D9'
where folder_color is null;

alter table public.documentation_nodes
  alter column folder_color set default '#FFF5D9';

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.documentation_nodes'::regclass
      and conname = 'documentation_nodes_folder_color_hex_check'
  ) then
    alter table public.documentation_nodes
      add constraint documentation_nodes_folder_color_hex_check
      check (folder_color is null or folder_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end;
$constraint$;

comment on column public.documentation_nodes.folder_color is
  'Cor hexadecimal personalizada da pasta no módulo Documentação.';

commit;
