-- ============================================================================
-- CPC Welcoming Team App — Per-Week Comment Authors
-- ============================================================================
-- Tracks who wrote each week's note individually. A visitor's assigned
-- welcomer and the person who actually spoke to them in a given week can
-- be different people (anyone on the team might mark attendance / add a
-- note for someone else's assigned visitor), so this is tracked
-- separately per week rather than assumed from welcomer_id or entered_by.
-- ============================================================================

alter table public.visitors
  add column week1_notes_by uuid references public.profiles (id) on delete set null,
  add column week2_notes_by uuid references public.profiles (id) on delete set null,
  add column week3_notes_by uuid references public.profiles (id) on delete set null;

comment on column public.visitors.week1_notes_by is 'Profile of whoever last wrote/edited the Week 1 note — may differ from the assigned welcomer.';
comment on column public.visitors.week2_notes_by is 'Profile of whoever last wrote/edited the Week 2 note.';
comment on column public.visitors.week3_notes_by is 'Profile of whoever last wrote/edited the Week 3 note.';
