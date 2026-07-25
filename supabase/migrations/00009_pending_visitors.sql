-- ============================================================================
-- CPC Welcoming Team App — Public Self-Registration
-- ============================================================================
-- Lets a visitor fill in a short form themselves (e.g. on their phone after
-- a service) without needing a login. Submissions land in
-- pending_visitors, NOT directly in visitors — a welcomer reviews and
-- "claims" each one, filling in the fields the public form doesn't ask for
-- (assigned welcomer, age category, etc.) before it becomes a real tracked
-- visitor. This avoids unsupervised/spam records entering the main table
-- and keeps the anonymous write surface as small as possible.
--
-- The public form does NOT get direct database access — it submits through
-- a dedicated Edge Function (submit-pending-visitor) using the service
-- role key server-side, so RLS on this table can stay locked to
-- "authenticated only" for reads and claims, with no public policies at
-- all. This is deliberately more restrictive than allowing an "anon"
-- insert policy, which would expose the anon key's insert capability to
-- anyone who inspects the page's network requests.
-- ============================================================================

create table public.pending_visitors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone_number text,
  service church_service not null,
  reason_for_attendance reason_for_attendance not null default 'Other',
  message text, -- free-text "anything else you'd like us to know"
  submitted_at timestamptz not null default now(),
  claimed boolean not null default false,
  claimed_by uuid references public.profiles (id) on delete set null,
  claimed_at timestamptz,
  resulting_visitor_id uuid references public.visitors (id) on delete set null
);

comment on table public.pending_visitors is 'Self-submitted visitor registrations awaiting a welcomer to review and convert into a full visitor record.';

create index pending_visitors_claimed_idx on public.pending_visitors (claimed);

alter table public.pending_visitors enable row level security;

-- Authenticated users (welcomers/admins) can view and claim submissions.
-- No insert/update policy for anon or authenticated — all writes to this
-- table happen via the Edge Function using the service role key, except
-- the "claimed" fields which authenticated users update when they process
-- a submission.
create policy "pending_visitors_select_authenticated"
  on public.pending_visitors for select
  to authenticated
  using (true);

create policy "pending_visitors_update_authenticated"
  on public.pending_visitors for update
  to authenticated
  using (true)
  with check (true);
