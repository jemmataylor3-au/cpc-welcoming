-- ============================================================================
-- CPC Welcoming Team App — Seed Data
-- ============================================================================
-- Welcomer list is intentionally left empty — an admin adds real welcomers
-- from the Admin screen after first login. Bible study groups are seeded
-- with the placeholder categories from the brief since these are easy to
-- edit later and give the Add Visitor form something sensible to show.
-- ============================================================================

insert into public.bible_study_groups (name) values
  ('Monday Evening'),
  ('Wednesday Morning'),
  ('Friday Evening');

-- No welcomers are seeded. After running migrations:
--   1. Sign up your first user (becomes admin automatically).
--   2. Log in and go to Admin → Welcomers to add your team.
