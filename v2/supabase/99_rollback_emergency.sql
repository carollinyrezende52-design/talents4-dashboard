-- Talents 4 CRM V2 · ROLLBACK EMERGENCIAL
-- NÃO EXECUTE COMO PARTE DA INSTALAÇÃO.
-- Este arquivo remove apenas os objetos adicionados pela V2, mas perderá dados já criados neles.
-- Antes de usar, exporte crm_activities e talent_opportunity_matches e confirme autorização explícita.

begin;

drop trigger if exists contact_followups_sync_crm_activity on public.contact_followups;
drop trigger if exists talent_opportunity_matches_sync_employer on public.talent_opportunity_matches;
drop trigger if exists talent_opportunity_matches_touch_updated_at on public.talent_opportunity_matches;
drop trigger if exists crm_activities_touch_updated_at on public.crm_activities;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_activities') then
      execute 'alter publication supabase_realtime drop table public.crm_activities';
    end if;
    if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'talent_opportunity_matches') then
      execute 'alter publication supabase_realtime drop table public.talent_opportunity_matches';
    end if;
  end if;
end;
$$;

drop table if exists public.talent_opportunity_matches;
drop table if exists public.crm_activities;
drop function if exists public.t4_v2_sync_contact_followup();
drop function if exists public.t4_v2_sync_match_employer();
drop function if exists public.t4_v2_touch_updated_at();

-- As colunas aditivas em tabelas existentes são preservadas de propósito.
-- Removê-las poderia apagar dados ou atingir uma coluna que já existia antes da V2.

commit;
