-- ============================================================================
-- CPC Welcoming Team App — Initial Schema
-- ============================================================================
-- This migration creates all core tables, enums, and indexes for the
-- visitor tracking system. Run migrations in order (00001, 00002, ...).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

create type app_role as enum ('admin', 'welcomer');

create type reason_for_attendance as enum (
  'Looking for a new church',
  'New to faith',
  'New to faith + Looking for a new church',
  'Other'
);

create type age_category as enum (
  'Youth',
  'Young Adults (YA)',
  'Over 30'
);

create type bible_study_status as enum (
  'Joined Bible Study',
  'Not Involved',
  'Not Yet (remind in 6 weeks)'
);

create type visitor_status as enum (
  'Active',
  'Settled',
  'Archived'
);

-- ----------------------------------------------------------------------------
-- profiles
-- One row per auth.users entry. Stores display name, role, and (for
-- welcomers) links them to a "welcomer" record so attendance/nudges can be
-- addressed to the right person. Created automatically via trigger below.
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role app_role not null default 'welcomer',
  welcomer_id uuid, -- fk added after welcomers table exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'App-level user profile, extends auth.users with role + display info.';

-- ----------------------------------------------------------------------------
-- welcomers
-- Configurable list of welcomers (Admin/Settings manages this). Each has a
-- colour accent for visual organisation, mirroring the spreadsheet's
-- colour-coded welcomer columns.
-- ----------------------------------------------------------------------------
create table public.welcomers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color_hex text not null default '#A7B5A0',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.welcomers is 'Configurable welcomer roster with colour accents, managed from Admin.';

alter table public.profiles
  add constraint profiles_welcomer_id_fkey
  foreign key (welcomer_id) references public.welcomers (id) on delete set null;

-- ----------------------------------------------------------------------------
-- bible_study_groups
-- Configurable list of Bible study groups (Admin/Settings manages this).
-- ----------------------------------------------------------------------------
create table public.bible_study_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.bible_study_groups is 'Configurable Bible study group/category list, managed from Admin.';

-- ----------------------------------------------------------------------------
-- app_settings
-- Single-row-per-key settings table for minister/YA worker emails and other
-- runtime-configurable values. Keeps Admin UI simple (no schema changes
-- needed to add a new configurable value).
-- ----------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

comment on table public.app_settings is 'Key/value runtime settings, e.g. minister_email, ya_worker_email.';

-- Seed default setting keys with placeholder values (edit in Admin).
insert into public.app_settings (key, value, description) values
  ('minister_email', 'minister@example.org', 'Email address that receives the 3-week Bible study prompt.'),
  ('ya_worker_email', 'ya-worker@example.org', 'Email address that receives the 3-week Bible study prompt for YA-aged visitors.'),
  ('church_name', 'Charlestown Presbyterian Church', 'Display name used in email templates.'),
  ('welcomer_nudge_weeks', '4', 'Weeks of inactivity before a welcomer nudge email is sent.'),
  ('bible_study_reminder_weeks', '6', 'Weeks to wait before re-prompting "Not Yet" Bible study visitors.');

-- ----------------------------------------------------------------------------
-- visitors
-- The core record. Mirrors the paper spreadsheet's columns, plus the new
-- structured fields requested in the brief (age_category, status,
-- archive_reason) that the spreadsheet did not previously track.
-- ----------------------------------------------------------------------------
create table public.visitors (
  id uuid primary key default gen_random_uuid(),

  -- Core identity
  name text not null,
  email text,
  phone_number text,
  date_first_attended date not null default current_date,

  -- Classification
  reason_for_attendance reason_for_attendance not null default 'Other',
  age_category age_category not null default 'Over 30',

  -- Assignment / provenance
  welcomer_id uuid references public.welcomers (id) on delete set null,
  entered_by uuid references public.profiles (id) on delete set null,

  -- Weekly attendance tracking (mirrors "First/Second/Third Week" columns)
  week1_attended boolean not null default false,
  week1_date date,
  week1_notes text,
  week2_attended boolean not null default false,
  week2_date date,
  week2_notes text,
  week3_attended boolean not null default false,
  week3_date date,
  week3_notes text,
  extra_notes text,

  -- Catch-up
  catchup_flag boolean not null default false,
  catchup_date date,
  catchup_arranged boolean not null default false,

  -- Elvanto / Bible study
  elvanto_conversation boolean not null default false,
  bible_study_status bible_study_status not null default 'Not Involved',
  bible_study_group_id uuid references public.bible_study_groups (id) on delete set null,
  bible_study_reminder_due_at date, -- set when status = 'Not Yet', drives 6-week nudge

  -- Workflow / automation flags
  three_week_prompt_sent_at timestamptz, -- when the minister/YA prompt was sent
  welcomer_nudge_sent_at timestamptz, -- when the "archive?" nudge was last sent to the welcomer
  settled_prompt_seen boolean not null default false, -- UI has surfaced the archive-or-continue prompt

  -- Status
  status visitor_status not null default 'Active',
  archive_reason text,
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint archive_reason_required_when_archived
    check (status <> 'Archived' or archive_reason is not null)
);

comment on table public.visitors is 'Core visitor tracking record — the digitised welcoming spreadsheet.';

create index visitors_status_idx on public.visitors (status);
create index visitors_welcomer_id_idx on public.visitors (welcomer_id);
create index visitors_age_category_idx on public.visitors (age_category);
create index visitors_date_first_attended_idx on public.visitors (date_first_attended);

-- ----------------------------------------------------------------------------
-- visitor_activity_log
-- Lightweight audit trail: who changed what, when. Not exhaustive
-- field-level diffing — just enough for volunteers/admins to see history.
-- ----------------------------------------------------------------------------
create table public.visitor_activity_log (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.visitors (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null, -- e.g. 'created', 'marked_week1', 'archived', 'status_changed'
  detail text,
  created_at timestamptz not null default now()
);

create index visitor_activity_log_visitor_id_idx on public.visitor_activity_log (visitor_id);

-- ----------------------------------------------------------------------------
-- email_log
-- Records every automated email attempt (success or failure) for
-- observability/debugging of the Edge Functions.
-- ----------------------------------------------------------------------------
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid references public.visitors (id) on delete set null,
  email_type text not null, -- '3_week_prompt' | 'bible_study_reminder' | 'welcomer_nudge'
  recipient text not null,
  status text not null default 'sent', -- 'sent' | 'failed'
  error_message text,
  created_at timestamptz not null default now()
);

create index email_log_visitor_id_idx on public.email_log (visitor_id);

-- ----------------------------------------------------------------------------
-- updated_at trigger helper
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_profiles
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_updated_at_visitors
  before update on public.visitors
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Auto-create profile row when a new auth user signs up.
-- First user to sign up becomes admin automatically (see 00003 for the
-- "first user" logic); subsequent users default to 'welcomer' and an admin
-- can promote them from the Admin screen.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  existing_admin_count int;
  assigned_role app_role;
begin
  select count(*) into existing_admin_count from public.profiles where role = 'admin';

  if existing_admin_count = 0 then
    assigned_role := 'admin';
  else
    assigned_role := 'welcomer';
  end if;

  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    assigned_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
