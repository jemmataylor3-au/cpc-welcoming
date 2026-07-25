-- ============================================================================
-- CPC Welcoming Team App — Automation Support Functions
-- ============================================================================
-- These SQL functions compute *which* visitors are due for each automated
-- action. The actual email-sending happens in Edge Functions (see
-- supabase/functions/), which call these via RPC using the service role.
-- Keeping the "who is due" logic in SQL means it's easy to inspect/test
-- directly in the SQL editor, and the Edge Functions stay thin.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Visitors who have just completed 3 attended weeks and have not yet had
-- the minister/YA-worker prompt sent.
-- ----------------------------------------------------------------------------
create or replace function public.visitors_due_three_week_prompt()
returns setof public.visitors
language sql
stable
security definer set search_path = public
as $$
  select *
  from public.visitors
  where week1_attended and week2_attended and week3_attended
    and three_week_prompt_sent_at is null
    and status <> 'Archived';
$$;

-- ----------------------------------------------------------------------------
-- Visitors whose Bible study status is 'Not Yet (remind in 6 weeks)' and
-- whose reminder date has arrived (or passed).
-- ----------------------------------------------------------------------------
create or replace function public.visitors_due_bible_study_reminder()
returns setof public.visitors
language sql
stable
security definer set search_path = public
as $$
  select *
  from public.visitors
  where bible_study_status = 'Not Yet (remind in 6 weeks)'
    and bible_study_reminder_due_at is not null
    and bible_study_reminder_due_at <= current_date
    and status <> 'Archived';
$$;

-- ----------------------------------------------------------------------------
-- Visitors who last attended 4+ weeks ago (based on the most recent of
-- week1/2/3 dates) and haven't already been nudged about in the last 7
-- days, and are not already archived.
-- ----------------------------------------------------------------------------
create or replace function public.visitors_due_welcomer_nudge()
returns setof public.visitors
language sql
stable
security definer set search_path = public
as $$
  with last_attended as (
    select
      v.*,
      greatest(
        coalesce(v.week1_date, v.date_first_attended),
        coalesce(v.week2_date, '0001-01-01'::date),
        coalesce(v.week3_date, '0001-01-01'::date)
      ) as most_recent_attendance
    from public.visitors v
    where v.status <> 'Archived'
  )
  select
    la.id, la.name, la.email, la.phone_number, la.date_first_attended,
    la.reason_for_attendance, la.age_category, la.welcomer_id, la.entered_by,
    la.week1_attended, la.week1_date, la.week1_notes,
    la.week2_attended, la.week2_date, la.week2_notes,
    la.week3_attended, la.week3_date, la.week3_notes, la.extra_notes,
    la.catchup_flag, la.catchup_date, la.catchup_arranged,
    la.elvanto_conversation, la.bible_study_status, la.bible_study_group_id,
    la.bible_study_reminder_due_at, la.three_week_prompt_sent_at,
    la.welcomer_nudge_sent_at, la.settled_prompt_seen, la.status,
    la.archive_reason, la.archived_at, la.created_at, la.updated_at
  from last_attended la
  cross join lateral (
    select (
      select coalesce(
        (select value from public.app_settings where key = 'welcomer_nudge_weeks'),
        '4'
      )::int
    ) as nudge_weeks
  ) settings
  where la.most_recent_attendance <= (current_date - (settings.nudge_weeks * 7))
    and la.welcomer_id is not null
    and (
      la.welcomer_nudge_sent_at is null
      or la.welcomer_nudge_sent_at <= (now() - interval '7 days')
    );
$$;

-- ----------------------------------------------------------------------------
-- Mark that a visitor has attended a given week number, stamping the date,
-- and auto-transitioning status to 'Settled' once week 3 is reached. This
-- centralises the state-machine transition so the app and any future
-- automation both go through one code path.
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

  if v.week1_attended and v.week2_attended and v.week3_attended and v.status = 'Active' then
    update public.visitors set status = 'Settled' where id = p_visitor_id returning * into v;
  end if;

  insert into public.visitor_activity_log (visitor_id, actor_id, action, detail)
  values (p_visitor_id, p_actor_id, 'marked_week_' || p_week, 'attended=' || p_attended);

  return v;
end;
$$;

-- ----------------------------------------------------------------------------
-- pg_cron schedules
-- These call the Edge Functions over HTTP using pg_net (bundled with
-- Supabase). Replace <PROJECT_REF> with your actual project ref, or set
-- these up via the Supabase Dashboard → Database → Cron after deploy,
-- which is often easier than embedding the project URL in a migration.
-- ============================================================================
-- Requires the "pg_net" extension for the http calls used below.
create extension if not exists "pg_net";

-- NOTE: Supabase Edge Function URLs and the anon/service key are not known
-- at migration time. Rather than hardcode them here (which would break on
-- every fresh deploy), we store them in app_settings and read them inside
-- a small wrapper function. Set these two after your first deploy:
--   update public.app_settings set value = 'https://<ref>.supabase.co' where key = 'project_url';
--   update public.app_settings set value = '<service_role_key>' where key = 'service_role_key';
insert into public.app_settings (key, value, description) values
  ('project_url', 'https://YOUR-PROJECT-REF.supabase.co', 'Supabase project URL, used by pg_cron to call Edge Functions. Set after deploy.'),
  ('service_role_key', 'REPLACE_ME', 'Service role key used by pg_cron to authenticate Edge Function calls. Set after deploy via SQL editor, not the Admin UI.')
on conflict (key) do nothing;

create or replace function public.trigger_edge_function(function_name text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  select value into v_url from public.app_settings where key = 'project_url';
  select value into v_key from public.app_settings where key = 'service_role_key';

  perform net.http_post(
    url := v_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  );
end;
$$;

-- Daily at 07:00 UTC: check for visitors who just hit 3 weeks attended.
select cron.schedule(
  'three-week-prompt-daily',
  '0 7 * * *',
  $$ select public.trigger_edge_function('send-three-week-prompt'); $$
);

-- Daily at 07:10 UTC: check for 6-week Bible study reminders due.
select cron.schedule(
  'bible-study-reminder-daily',
  '10 7 * * *',
  $$ select public.trigger_edge_function('send-bible-study-reminder'); $$
);

-- Daily at 07:20 UTC: check for welcomer nudges (4+ weeks inactive).
select cron.schedule(
  'welcomer-nudge-daily',
  '20 7 * * *',
  $$ select public.trigger_edge_function('send-welcomer-nudge'); $$
);

-- To view/manage schedules later:
--   select * from cron.job;
--   select cron.unschedule('three-week-prompt-daily');
