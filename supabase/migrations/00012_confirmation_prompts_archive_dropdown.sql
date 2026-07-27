-- ============================================================================
-- CPC Welcoming Team App — Confirmation Prompts + Archive Reason Dropdown
-- ============================================================================
-- 1. Removes the automatic Active -> Settled transition. Completing week 3
--    now surfaces a confirmation prompt on the visitor's page instead of
--    silently changing status.
-- 2. Adds a structured archive_reason_category (dropdown) alongside the
--    existing free-text archive_reason (used only when category = 'Other').
-- 3. Reuses existing welcomer_nudge_sent_at / settled_prompt_seen fields —
--    both prompts are dismissible so they don't nag forever once seen.
-- ============================================================================

create type archive_reason_category as enum (
  'Moved away',
  'Joined another local church',
  'No longer responsive',
  'Committed to another church',
  'Other'
);

alter table public.visitors
  add column archive_reason_category archive_reason_category;

comment on column public.visitors.archive_reason_category is 'Structured archive reason, selected from a dropdown. archive_reason (free text) is only required/shown when this is "Other".';

alter table public.visitors
  add column archive_prompt_dismissed_at timestamptz;

comment on column public.visitors.archive_prompt_dismissed_at is 'When someone last dismissed the in-app "should this person be archived?" prompt without archiving. Separate from welcomer_nudge_sent_at, which tracks the automated email reminder.';

-- ----------------------------------------------------------------------------
-- Stop auto-setting status to Settled inside mark_week_attended. The app
-- now shows a confirmation prompt instead (see settled_prompt_seen).
-- ----------------------------------------------------------------------------
create or replace function public.mark_week_attended(
  p_visitor_id uuid,
  p_week int,
  p_attended boolean,
  p_notes text default null,
  p_actor_id uuid default null
)
returns public.visitors
language plpgsql
security definer set search_path = public
as $$
declare
  v public.visitors;
begin
  if p_week not in (1, 2, 3) then
    raise exception 'p_week must be 1, 2, or 3';
  end if;

  if p_week = 1 then
    update public.visitors
    set week1_attended = p_attended,
        week1_date = case when p_attended then coalesce(week1_date, current_date) else null end,
        week1_notes = coalesce(p_notes, week1_notes)
    where id = p_visitor_id
    returning * into v;
  elsif p_week = 2 then
    update public.visitors
    set week2_attended = p_attended,
        week2_date = case when p_attended then coalesce(week2_date, current_date) else null end,
        week2_notes = coalesce(p_notes, week2_notes)
    where id = p_visitor_id
    returning * into v;
  else
    update public.visitors
    set week3_attended = p_attended,
        week3_date = case when p_attended then coalesce(week3_date, current_date) else null end,
        week3_notes = coalesce(p_notes, week3_notes)
    where id = p_visitor_id
    returning * into v;
  end if;

  -- No longer auto-sets status = 'Settled' here — the app shows a
  -- confirmation prompt on the visitor page once all 3 weeks are attended
  -- and status is still 'Active', and a person must confirm the move.

  insert into public.visitor_activity_log (visitor_id, actor_id, action, detail)
  values (p_visitor_id, p_actor_id, 'marked_week_' || p_week, 'attended=' || p_attended);

  return v;
end;
$$;
