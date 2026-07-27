-- ============================================================================
-- CPC Welcoming Team App — Per-Service Welcomers
-- ============================================================================
-- Welcomers can now be tagged with which service(s) they serve, so the
-- "Assigned welcomer" dropdown only shows relevant people for the visitor's
-- service. A welcomer with no services set won't appear in any per-service
-- dropdown (used for historical welcomers who remain validly referenced by
-- old visitor records, without cluttering new-visitor forms).
--
-- Also adds a free-text "Other" option to the welcomer field, for when the
-- person who spoke to a visitor isn't on the configured list.
-- ============================================================================

alter table public.welcomers
  add column services church_service[] default '{}';

comment on column public.welcomers.services is 'Which service(s) this welcomer serves — controls which per-service dropdown they appear in. Empty/null means they only appear for already-assigned historical visitors, not new selections.';

alter table public.visitors
  add column welcomer_other text;

comment on column public.visitors.welcomer_other is 'Free-text welcomer name when "Other" is selected instead of a configured welcomer. welcomer_id stays null in that case.';

alter table public.visitors
  add column settled_at timestamptz;

comment on column public.visitors.settled_at is 'When a person confirmed this visitor as Settled (via the in-app prompt). Used for "average time to settle" reporting. Null for anyone settled before this column existed.';

-- ----------------------------------------------------------------------------
-- Tag existing welcomers (from the earlier spreadsheet import) with their
-- services, per the lists supplied. Welcomers not mentioned below (Belle,
-- Luke, Naomi) are left with no services — they remain valid for their
-- existing historical visitor records but won't show up as options for
-- newly assigned visitors.
-- ----------------------------------------------------------------------------
update public.welcomers set services = array['Sunday@6']::church_service[] where name = 'Elissa';
update public.welcomers set services = array['Sunday@6']::church_service[] where name = 'Grace';
update public.welcomers set services = array['Sunday@6']::church_service[] where name = 'Jackson';
update public.welcomers set services = array['Sunday@6']::church_service[] where name = 'Jemma';
update public.welcomers set services = array['Sunday@6', 'Charlestown AM']::church_service[] where name = 'Jannah';
update public.welcomers set services = array['Sunday@6']::church_service[] where name = 'Nic';
update public.welcomers set services = array['Sunday@6', 'Charlestown AM', 'Swansea']::church_service[] where name = 'Audric';
update public.welcomers set services = array['Sunday@6']::church_service[] where name = 'Matt';

-- ----------------------------------------------------------------------------
-- New welcomers, not previously in the system.
-- ----------------------------------------------------------------------------
insert into public.welcomers (name, color_hex, services) values
  ('Sofia', '#C8755B', array['Sunday@6']::church_service[]),
  ('James', '#A7B5A0', array['Sunday@6']::church_service[]),
  ('Cheryl', '#66727A', array['Sunday@6', 'Charlestown AM']::church_service[]),
  ('Steve', '#8B7355', array['Sunday@6', 'Charlestown AM', 'Swansea']::church_service[]),
  ('Karen', '#5E8065', array['Charlestown AM']::church_service[])
on conflict (name) do update set services = excluded.services;
