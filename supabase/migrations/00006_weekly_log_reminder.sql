-- ============================================================================
-- CPC Welcoming Team App — Weekly Logging Reminder
-- ============================================================================
-- Adds a "did anyone log this week" tracking mechanism and three reminder
-- emails (Monday 12:30pm, Monday 6pm, Tuesday 12:30pm) to every welcomer +
-- admin, that stop firing once someone has either added/updated a visitor
-- record or explicitly logged "no one new this week" for the current cycle.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- weekly_log_checkins
-- One row per week cycle. A cycle starts each Monday at 12:30pm (the first
-- reminder time) and is considered "satisfied" once someone acts.
-- ----------------------------------------------------------------------------
create table public.weekly_log_checkins (
  id uuid primary key default gen_random_uuid(),
  cycle_start date not null unique, -- the Monday date this cycle covers
  satisfied boolean not null default false,
  satisfied_at timestamptz,
  satisfied_by uuid references public.profiles (id) on delete set null,
  no_one_new boolean not null default false, -- true if satisfied via the "no one new" button rather than a visitor record
  reminder_1_sent_at timestamptz, -- Monday 12:30pm
  reminder_2_sent_at timestamptz, -- Monday 6pm
  reminder_3_sent_at timestamptz, -- Tuesday 12:30pm
  created_at timestamptz not null default now()
);

comment on table public.weekly_log_checkins is 'Tracks whether the welcoming team has logged anything each week, and which reminder emails have gone out.';

alter table public.weekly_log_checkins enable row level security;

create policy "weekly_log_checkins_select_authenticated"
  on public.weekly_log_checkins for select
  to authenticated
  using (true);

create policy "weekly_log_checkins_insert_authenticated"
  on public.weekly_log_checkins for insert
  to authenticated
  with check (true);

create policy "weekly_log_checkins_update_authenticated"
  on public.weekly_log_checkins for update
  to authenticated
  using (true)
  with check (true);

-- ----------------------------------------------------------------------------
-- Returns (creating if needed) the current week's cycle row. "Current
-- cycle" is defined as the most recent Monday on/before today.
-- ----------------------------------------------------------------------------
create or replace function public.get_or_create_current_checkin()
returns public.weekly_log_checkins
language plpgsql
security definer set search_path = public
as $$
declare
  v_monday date;
  v_row public.weekly_log_checkins;
begin
  -- ISO day of week: Monday = 1. Step back to the most recent Monday.
  v_monday := current_date - ((extract(isodow from current_date)::int - 1));

  select * into v_row from public.weekly_log_checkins where cycle_start = v_monday;

  if not found then
    insert into public.weekly_log_checkins (cycle_start)
    values (v_monday)
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

-- ----------------------------------------------------------------------------
-- Marks the current week's cycle as satisfied. Called either automatically
-- (from a trigger on visitors insert/update, see below) or directly by the
-- "No one new this week" button in the app.
-- ----------------------------------------------------------------------------
create or replace function public.mark_week_satisfied(
  p_no_one_new boolean default false,
  p_actor_id uuid default null
)
returns public.weekly_log_checkins
language plpgsql
security definer set search_path = public
as $$
declare
  v_current public.weekly_log_checkins;
  v_result public.weekly_log_checkins;
begin
  v_current := public.get_or_create_current_checkin();

  update public.weekly_log_checkins
  set satisfied = true,
      satisfied_at = coalesce(satisfied_at, now()),
      satisfied_by = coalesce(satisfied_by, p_actor_id),
      no_one_new = case when p_no_one_new then true else no_one_new end
  where id = v_current.id
  returning * into v_result;

  return v_result;
end;
$$;

-- Auto-satisfy the current week whenever any visitor row is created or
-- updated — logging a real visitor counts as "filled in the spreadsheet"
-- without needing the welcomer to remember a separate step.
create or replace function public.satisfy_week_on_visitor_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.mark_week_satisfied(false, coalesce(new.entered_by, null));
  return new;
end;
$$;

create trigger satisfy_week_on_visitor_insert
  after insert on public.visitors
  for each row execute function public.satisfy_week_on_visitor_change();

create trigger satisfy_week_on_visitor_update
  after update on public.visitors
  for each row execute function public.satisfy_week_on_visitor_change();

-- ----------------------------------------------------------------------------
-- Which reminder (1, 2, or 3) is currently due, if any, for the active
-- cycle. Returns no rows if the week is already satisfied or no reminder
-- slot is currently due.
-- ----------------------------------------------------------------------------
create or replace function public.weekly_reminder_due()
returns table (checkin_id uuid, reminder_number int)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_row public.weekly_log_checkins;
begin
  v_row := public.get_or_create_current_checkin();

  if v_row.satisfied then
    return;
  end if;

  if v_row.reminder_1_sent_at is null then
    checkin_id := v_row.id;
    reminder_number := 1;
    return next;
  elsif v_row.reminder_2_sent_at is null then
    checkin_id := v_row.id;
    reminder_number := 2;
    return next;
  elsif v_row.reminder_3_sent_at is null then
    checkin_id := v_row.id;
    reminder_number := 3;
    return next;
  end if;

  return;
end;
$$;

-- ----------------------------------------------------------------------------
-- Cron schedules: Monday 12:30pm, Monday 6pm, Tuesday 12:30pm.
-- NOTE: pg_cron times are in UTC. The times below assume Australia/Sydney
-- (AEST, UTC+10 / AEDT, UTC+11). Adjust the hour if your server's cron
-- runs against a different offset, or during daylight saving changes.
-- AEST (non-DST, roughly Apr-Oct): 12:30pm AEST = 02:30 UTC, 6pm AEST = 08:00 UTC
-- AEDT (DST, roughly Oct-Apr): 12:30pm AEDT = 01:30 UTC, 6pm AEDT = 07:00 UTC
-- The schedule below is set for AEST (non-DST). See the README for how to
-- adjust twice a year, or switch to a UTC-stable time if that's simpler.
-- ----------------------------------------------------------------------------

-- Monday 12:30pm AEST (02:30 UTC Monday)
select cron.schedule(
  'weekly-log-reminder-1',
  '30 2 * * 1',
  $$ select public.trigger_edge_function('send-weekly-log-reminder'); $$
);

-- Monday 6:00pm AEST (08:00 UTC Monday)
select cron.schedule(
  'weekly-log-reminder-2',
  '0 8 * * 1',
  $$ select public.trigger_edge_function('send-weekly-log-reminder'); $$
);

-- Tuesday 12:30pm AEST (02:30 UTC Tuesday)
select cron.schedule(
  'weekly-log-reminder-3',
  '30 2 * * 2',
  $$ select public.trigger_edge_function('send-weekly-log-reminder'); $$
);
