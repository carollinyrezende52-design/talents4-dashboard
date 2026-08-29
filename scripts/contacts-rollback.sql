-- ROLLBACK DESTRUTIVO da Central de Contatos.
-- Não execute em uma instalação já utilizada sem exportar os dados primeiro.

begin;

drop table if exists public.contact_followups cascade;
drop table if exists public.contact_interactions cascade;
drop table if exists public.contact_relationships cascade;
drop table if exists public.contact_record_categories cascade;
drop table if exists public.contact_categories cascade;
drop table if exists public.contact_records cascade;

drop function if exists public.normalize_contact_followup_completion();
drop function if exists public.refresh_contact_followup_summary();
drop function if exists public.refresh_contact_interaction_summary();
drop function if exists public.validate_contact_primary_organization();
drop function if exists public.protect_referenced_contact_organization();
drop function if exists public.touch_contact_module_updated_at();

commit;
