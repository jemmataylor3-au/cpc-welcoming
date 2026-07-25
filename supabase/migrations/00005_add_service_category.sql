-- ============================================================================
-- CPC Welcoming Team App — Add Service Category
-- ============================================================================
-- Adds a "service" field to visitors so they can be categorised by which
-- Sunday service they attended: Swansea, Charlestown AM, or Sunday@6.
-- This is a shared field on the existing visitors table (not a separate
-- database) — everything stays in one app, but you can now filter/report
-- by service.
-- ============================================================================

create type church_service as enum (
  'Swansea',
  'Charlestown AM',
  'Sunday@6'
);

alter table public.visitors
  add column service church_service not null default 'Charlestown AM';

comment on column public.visitors.service is 'Which service the visitor attended: Swansea, Charlestown AM, or Sunday@6.';

create index visitors_service_idx on public.visitors (service);
