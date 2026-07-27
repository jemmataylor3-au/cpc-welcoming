-- ============================================================================
-- CPC Welcoming Team App — Approval, Visit Periods, Email Templates
-- ============================================================================
-- 1. New signups must be approved by an admin before they can see any data.
-- 2. Repeat visitors can have separate "visit periods" so the 3-week count
--    restarts rather than carrying over from a visit months earlier.
-- 3. Automated email wording becomes editable from the Admin screen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. APPROVAL
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column approved boolean not null default false;

comment on column public.profiles.approved is 'Whether an admin has approved this account. Unapproved users can sign in but see nothing until approved.';

-- CRITICAL: grandfather in every existing account, so nobody currently
-- using the app is locked out the moment the new policies apply.
update public.profiles set approved = true;

-- New signups: first-ever user is auto-approved (otherwise there would be
-- nobody able to approve anyone). Everyone after that starts unapproved.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  existing_count int;
  assigned_role app_role;
  is_first boolean;
begin
  select count(*) into existing_count from public.profiles;
  is_first := existing_count = 0;

  if is_first then
    assigned_role := 'admin';
  else
    assigned_role := 'welcomer';
  end if;

  insert into public.profiles (id, full_name, email, role, approved)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    assigned_role,
    is_first
  );
  return new;
end;
$$;

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and approved = true
  );
$$;

-- ----------------------------------------------------------------------------
-- Re-scope data policies to require approval.
-- NOTE: profiles SELECT is deliberately left open to all authenticated
-- users — an unapproved person must still be able to read their own row to
-- know they're waiting on approval. Profiles hold only names/emails/roles.
-- ----------------------------------------------------------------------------
drop policy if exists "visitors_select_authenticated" on public.visitors;
create policy "visitors_select_approved" on public.visitors for select
  to authenticated using (public.is_approved());

drop policy if exists "visitors_insert_authenticated" on public.visitors;
create policy "visitors_insert_approved" on public.visitors for insert
  to authenticated with check (public.is_approved());

drop policy if exists "visitors_update_authenticated" on public.visitors;
create policy "visitors_update_approved" on public.visitors for update
  to authenticated using (public.is_approved()) with check (public.is_approved());

drop policy if exists "welcomers_select_authenticated" on public.welcomers;
create policy "welcomers_select_approved" on public.welcomers for select
  to authenticated using (public.is_approved());

drop policy if exists "bible_study_groups_select_authenticated" on public.bible_study_groups;
create policy "bible_study_groups_select_approved" on public.bible_study_groups for select
  to authenticated using (public.is_approved());

drop policy if exists "app_settings_select_authenticated" on public.app_settings;
create policy "app_settings_select_approved" on public.app_settings for select
  to authenticated using (public.is_approved());

drop policy if exists "activity_log_select_authenticated" on public.visitor_activity_log;
create policy "activity_log_select_approved" on public.visitor_activity_log for select
  to authenticated using (public.is_approved());

drop policy if exists "activity_log_insert_authenticated" on public.visitor_activity_log;
create policy "activity_log_insert_approved" on public.visitor_activity_log for insert
  to authenticated with check (public.is_approved());

drop policy if exists "pending_visitors_select_authenticated" on public.pending_visitors;
create policy "pending_visitors_select_approved" on public.pending_visitors for select
  to authenticated using (public.is_approved());

drop policy if exists "pending_visitors_update_authenticated" on public.pending_visitors;
create policy "pending_visitors_update_approved" on public.pending_visitors for update
  to authenticated using (public.is_approved()) with check (public.is_approved());

drop policy if exists "weekly_log_checkins_select_authenticated" on public.weekly_log_checkins;
create policy "weekly_log_checkins_select_approved" on public.weekly_log_checkins for select
  to authenticated using (public.is_approved());

drop policy if exists "weekly_log_checkins_insert_authenticated" on public.weekly_log_checkins;
create policy "weekly_log_checkins_insert_approved" on public.weekly_log_checkins for insert
  to authenticated with check (public.is_approved());

drop policy if exists "weekly_log_checkins_update_authenticated" on public.weekly_log_checkins;
create policy "weekly_log_checkins_update_approved" on public.weekly_log_checkins for update
  to authenticated using (public.is_approved()) with check (public.is_approved());

-- ----------------------------------------------------------------------------
-- 2. VISIT PERIODS
-- Stores COMPLETED past visit runs. The visitors table always holds the
-- CURRENT run's weeks; starting a new period snapshots the current weeks
-- into here and clears them, so the 3-week count restarts cleanly without
-- losing the earlier history.
-- ----------------------------------------------------------------------------
create table public.visit_periods (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.visitors (id) on delete cascade,
  period_number int not null,
  started_on date,
  week1_attended boolean not null default false,
  week1_date date,
  week1_notes text,
  week2_attended boolean not null default false,
  week2_date date,
  week2_notes text,
  week3_attended boolean not null default false,
  week3_date date,
  week3_notes text,
  closed_at timestamptz not null default now(),
  closed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.visit_periods is 'Archived snapshots of earlier visit runs, so a returning visitor restarts the 3-week count without losing their previous history.';

create index visit_periods_visitor_id_idx on public.visit_periods (visitor_id);

alter table public.visit_periods enable row level security;

create policy "visit_periods_select_approved" on public.visit_periods for select
  to authenticated using (public.is_approved());
create policy "visit_periods_insert_approved" on public.visit_periods for insert
  to authenticated with check (public.is_approved());

-- Snapshots the visitor's current weeks into visit_periods, then resets
-- the live week fields so tracking restarts from scratch.
create or replace function public.start_new_visit_period(
  p_visitor_id uuid,
  p_actor_id uuid default null
)
returns public.visitors
language plpgsql
security definer set search_path = public
as $$
declare
  v public.visitors;
  next_number int;
begin
  select * into v from public.visitors where id = p_visitor_id;
  if not found then
    raise exception 'Visitor not found';
  end if;

  select coalesce(max(period_number), 0) + 1 into next_number
  from public.visit_periods where visitor_id = p_visitor_id;

  insert into public.visit_periods (
    visitor_id, period_number, started_on,
    week1_attended, week1_date, week1_notes,
    week2_attended, week2_date, week2_notes,
    week3_attended, week3_date, week3_notes,
    closed_by
  ) values (
    p_visitor_id, next_number, v.date_first_attended,
    v.week1_attended, v.week1_date, v.week1_notes,
    v.week2_attended, v.week2_date, v.week2_notes,
    v.week3_attended, v.week3_date, v.week3_notes,
    p_actor_id
  );

  update public.visitors
  set week1_attended = false, week1_date = null, week1_notes = null, week1_notes_by = null,
      week2_attended = false, week2_date = null, week2_notes = null, week2_notes_by = null,
      week3_attended = false, week3_date = null, week3_notes = null, week3_notes_by = null,
      date_first_attended = current_date,
      status = 'Active',
      settled_prompt_seen = false,
      settled_at = null,
      archive_reason = null,
      archive_reason_category = null,
      archived_at = null,
      archive_prompt_dismissed_at = null,
      is_returning = true
  where id = p_visitor_id
  returning * into v;

  insert into public.visitor_activity_log (visitor_id, actor_id, action, detail)
  values (p_visitor_id, p_actor_id, 'new_visit_period', 'Started visit period ' || (next_number + 1));

  return v;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. EDITABLE EMAIL TEMPLATES
-- ----------------------------------------------------------------------------
create table public.email_templates (
  key text primary key,
  label text not null,
  subject text not null,
  body text not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

comment on table public.email_templates is 'Editable wording for automated emails. {{placeholders}} are substituted at send time.';

alter table public.email_templates enable row level security;

create policy "email_templates_select_approved" on public.email_templates for select
  to authenticated using (public.is_approved());
create policy "email_templates_admin_write" on public.email_templates for all
  to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.email_templates (key, label, subject, body, description) values
  (
    'three_week_prompt',
    '3-week check-in',
    '3-week check-in: {{visitor_name}}',
    E'{{visitor_name}} has now attended three weeks in a row. Could you:\n\n- Add them to Elvanto\n- Reach out to invite them to a Bible study group',
    'Sent to the minister (or YA worker) once a visitor completes 3 weeks. Placeholders: {{visitor_name}}, {{church_name}}'
  ),
  (
    'bible_study_reminder',
    'Bible study follow-up',
    'Bible study follow-up: {{visitor_name}}',
    E'It has been 6 weeks since {{visitor_name}} was marked "Not Yet" for Bible study. Worth a follow-up to see if they would like to join a group now?',
    'Sent when a "Not Yet" Bible study reminder falls due. Placeholders: {{visitor_name}}, {{church_name}}'
  ),
  (
    'welcomer_nudge',
    'Welcomer nudge',
    'Check in on {{visitor_name}}?',
    E'{{visitor_name}} has not attended in a while. Should they be archived, or are they still connecting with the church? You can update their status in the app.',
    'Sent to a visitor''s assigned welcomer after 4+ weeks of no attendance. Placeholders: {{visitor_name}}, {{church_name}}'
  ),
  (
    'weekly_digest',
    'Weekly admin digest',
    'Welcoming summary for the week',
    E'Here is this week''s welcoming summary:\n\n- New visitors added: {{new_count}}\n- Moved to Settled: {{settled_count}}\n- Archived: {{archived_count}}\n- Currently active: {{active_total}}',
    'Weekly summary sent to admins. Placeholders: {{new_count}}, {{settled_count}}, {{archived_count}}, {{active_total}}, {{church_name}}'
  );

-- ----------------------------------------------------------------------------
-- 4. WEEKLY DIGEST SETTINGS + SCHEDULE
-- ----------------------------------------------------------------------------
insert into public.app_settings (key, value, description) values
  ('weekly_digest_enabled', 'true', 'Whether the weekly admin digest email is sent.'),
  ('weekly_digest_recipients', '', 'Comma-separated extra recipients for the weekly digest. All admins receive it regardless.')
on conflict (key) do nothing;

-- Monday 8:00am AEST (22:00 UTC Sunday). See README for the daylight
-- saving caveat that applies to all cron times in this project.
select cron.schedule(
  'weekly-admin-digest',
  '0 22 * * 0',
  $$ select public.trigger_edge_function('send-weekly-digest'); $$
);
