-- ============================================================================
-- CPC Welcoming Team App — Age Categories + Per-Service Notification Routing
-- ============================================================================
-- 1. Expands the age category list and renames "Young Adults (YA)" to the
--    tidier "Young Adult". "Over 30" is kept as a legacy option so the 15
--    existing records keep a truthful label until recategorised by hand.
-- 2. Replaces the single minister / second minister / YA worker settings
--    with a proper recipients list: each person covers one or more
--    services, and can optionally receive every Young Adult visitor
--    regardless of which service they attended.
--
-- IMPORTANT: run this migration ON ITS OWN. Postgres requires new enum
-- values to be committed before other statements can use them.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AGE CATEGORIES
-- ----------------------------------------------------------------------------
alter type age_category rename value 'Young Adults (YA)' to 'Young Adult';

alter type age_category add value if not exists 'Young Family';
alter type age_category add value if not exists 'Established Family';
alter type age_category add value if not exists 'Midlife / Empty Nester';
alter type age_category add value if not exists 'Senior';

-- "Over 30" is intentionally left in place. Postgres cannot drop an enum
-- value that rows still reference, and silently relabelling 15 real people
-- would be worse than leaving an accurate legacy label in the list.

-- ----------------------------------------------------------------------------
-- 2. NOTIFICATION RECIPIENTS
-- ----------------------------------------------------------------------------
create table public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  services church_service[] not null default '{}',
  all_young_adults boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.notification_recipients is 'Who receives the 3-week and Bible study prompts. Routing is by service, plus an optional catch-all for Young Adult visitors from any service. Rows with a blank email are skipped at send time.';
comment on column public.notification_recipients.all_young_adults is 'When true, this person also receives prompts for any Young Adult visitor, regardless of which service they attended.';

create index notification_recipients_active_idx on public.notification_recipients (active);

alter table public.notification_recipients enable row level security;

create policy "notification_recipients_select_approved"
  on public.notification_recipients for select
  to authenticated using (public.is_approved());

create policy "notification_recipients_admin_write"
  on public.notification_recipients for all
  to authenticated using (public.is_admin()) with check (public.is_admin());

-- Seed the routing rules supplied by the welcoming team. Email addresses
-- are deliberately left blank — an admin fills them in from
-- Admin -> Notification recipients. Until then, nothing is sent to them.
insert into public.notification_recipients (name, email, services, all_young_adults) values
  (
    'Audric',
    '',
    array['Swansea', 'Charlestown AM', 'Sunday@6']::church_service[],
    false
  ),
  (
    'Stephen',
    '',
    array['Swansea', 'Charlestown AM']::church_service[],
    false
  ),
  (
    'Jannah',
    '',
    array['Sunday@6']::church_service[],
    true
  );

-- ----------------------------------------------------------------------------
-- Retire the old single-address settings. Left in the table (rather than
-- deleted) so nothing breaks if an older Edge Function version is briefly
-- still live during a deploy, but marked clearly as unused.
-- ----------------------------------------------------------------------------
update public.app_settings
set description = 'NO LONGER USED — replaced by the notification_recipients table (Admin → Notification recipients).'
where key in ('minister_email', 'minister_email_2', 'ya_worker_email');
