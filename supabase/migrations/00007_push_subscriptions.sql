-- ============================================================================
-- CPC Welcoming Team App — Push Notification Subscriptions
-- ============================================================================
-- Stores each device's Web Push subscription so Edge Functions can send
-- notifications directly to phones instead of (or alongside) email.
-- One profile can have multiple subscriptions (e.g. phone + tablet).
-- ============================================================================

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh_key text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

comment on table public.push_subscriptions is 'Web Push subscriptions, one row per device/browser a user has enabled notifications on.';

create index push_subscriptions_profile_id_idx on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

-- Users manage their own subscriptions; nobody else can read another
-- person's push keys (they're sensitive — anyone with them could send that
-- person notifications).
create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  to authenticated
  using (profile_id = auth.uid());

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  to authenticated
  with check (profile_id = auth.uid());

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  to authenticated
  using (profile_id = auth.uid());

-- Edge Functions read across all subscriptions using the service role key,
-- which bypasses RLS entirely, so no special "admin can read all" policy
-- is needed here.
