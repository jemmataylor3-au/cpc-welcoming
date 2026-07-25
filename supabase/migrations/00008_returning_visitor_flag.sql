-- ============================================================================
-- CPC Welcoming Team App — First-timer vs Returning Flag
-- ============================================================================
-- Adds a simple boolean so a welcomer can mark someone as "has attended
-- before, just wasn't tracked yet" rather than every new record implying
-- a genuine first visit. Defaults to false (first-timer) to match existing
-- behaviour for all current and future records unless explicitly changed.
-- ============================================================================

alter table public.visitors
  add column is_returning boolean not null default false;

comment on column public.visitors.is_returning is 'True if this person has attended before but is only now being tracked in the app (not a genuine first-time visitor).';
