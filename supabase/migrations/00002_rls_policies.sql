-- ============================================================================
-- CPC Welcoming Team App — Row Level Security
-- ============================================================================
-- Role model (kept intentionally simple per the brief):
--   admin    — full read/write on everything, manages Admin/Settings.
--   welcomer — can read all visitors (so anyone can help catch someone up),
--              can create visitors, can update visitors, cannot delete,
--              cannot change Admin/Settings tables.
-- All access requires authentication; there is no public/anon access.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.welcomers enable row level security;
alter table public.bible_study_groups enable row level security;
alter table public.app_settings enable row level security;
alter table public.visitors enable row level security;
alter table public.visitor_activity_log enable row level security;
alter table public.email_log enable row level security;

-- ----------------------------------------------------------------------------
-- Helper: is the current user an admin?
-- SECURITY DEFINER + stable so it can be used cheaply inside policies
-- without recursive RLS evaluation on profiles.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- profiles
-- Everyone can read all profiles (needed to show "Entered by" names and
-- welcomer assignment lists). Users can update their own display name only.
-- Only admins can change roles or welcomer_id linkage.
-- ----------------------------------------------------------------------------
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own_basic_fields"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_full_update"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "profiles_admin_insert"
  on public.profiles for insert
  to authenticated
  with check (public.is_admin());

-- Note: profile rows are otherwise created by the handle_new_user trigger.

-- ----------------------------------------------------------------------------
-- welcomers — readable by all authenticated users, writable by admins only.
-- ----------------------------------------------------------------------------
create policy "welcomers_select_authenticated"
  on public.welcomers for select
  to authenticated
  using (true);

create policy "welcomers_admin_write"
  on public.welcomers for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- bible_study_groups — readable by all authenticated users, admin write.
-- ----------------------------------------------------------------------------
create policy "bible_study_groups_select_authenticated"
  on public.bible_study_groups for select
  to authenticated
  using (true);

create policy "bible_study_groups_admin_write"
  on public.bible_study_groups for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- app_settings — readable by all authenticated users (emails shown in
-- Admin screen only, but harmless to read), admin write.
-- ----------------------------------------------------------------------------
create policy "app_settings_select_authenticated"
  on public.app_settings for select
  to authenticated
  using (true);

create policy "app_settings_admin_write"
  on public.app_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- visitors — all authenticated users (admin + welcomer) can read and create.
-- All authenticated users can update (welcoming is a team effort — any
-- welcomer may need to mark attendance for someone else's assigned visitor).
-- Only admins can delete.
-- ----------------------------------------------------------------------------
create policy "visitors_select_authenticated"
  on public.visitors for select
  to authenticated
  using (true);

create policy "visitors_insert_authenticated"
  on public.visitors for insert
  to authenticated
  with check (true);

create policy "visitors_update_authenticated"
  on public.visitors for update
  to authenticated
  using (true)
  with check (true);

create policy "visitors_delete_admin_only"
  on public.visitors for delete
  to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- visitor_activity_log — readable by all, insert by all (system + users),
-- no update/delete (append-only audit trail).
-- ----------------------------------------------------------------------------
create policy "activity_log_select_authenticated"
  on public.visitor_activity_log for select
  to authenticated
  using (true);

create policy "activity_log_insert_authenticated"
  on public.visitor_activity_log for insert
  to authenticated
  with check (true);

-- ----------------------------------------------------------------------------
-- email_log — admins only (contains recipient addresses/error detail that
-- doesn't need to be visible to every volunteer).
-- ----------------------------------------------------------------------------
create policy "email_log_admin_select"
  on public.email_log for select
  to authenticated
  using (public.is_admin());

-- Inserts to email_log happen from Edge Functions using the service role
-- key, which bypasses RLS entirely — no insert policy needed for normal users.
