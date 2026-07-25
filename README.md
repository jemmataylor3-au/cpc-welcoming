# CPC Welcoming Team App

A mobile-first web app that digitises and automates the Charlestown
Presbyterian Church welcoming team's visitor tracking spreadsheet.

Built with Next.js (App Router), Supabase (Postgres + Auth + Edge Functions),
Tailwind CSS, and Resend for email.

---

## 1. What this replaces

The original workflow was a colour-coded Google Sheet, one column-group per
welcomer, tracking: visitor name, assigned welcomer, three weeks of
attendance + notes, catch-up status/date, Bible study / group chat status,
Elvanto conversation status, reason for attendance, and contact details.

This app keeps that same data model but adds:
- A proper **Active → Settled → Archived** status pipeline
- **Age category** (Youth / Young Adults / Over 30) for reporting
- Automatic **email prompts** (via Resend) instead of someone remembering to
  check the sheet every week
- Role-based access so any welcomer can help, while only admins manage
  configuration

---

## 2. Prerequisites

- A [Supabase](https://supabase.com) project (free tier is fine to start)
- A [Resend](https://resend.com) account + verified sending domain
- Node.js 18.18+ and npm
- The [Supabase CLI](https://supabase.com/docs/guides/cli) installed locally
  (`npm install -g supabase`) — used to run migrations and deploy Edge
  Functions

---

## 3. Set up the database

1. Log in and link the CLI to your project:

   ```bash
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   ```

2. Run the migrations (creates tables, RLS policies, seed data, and the
   automation functions/cron schedules):

   ```bash
   supabase db push
   ```

   This runs the files in `supabase/migrations/` in order:
   - `00001_initial_schema.sql` — tables, enums, indexes, triggers
   - `00002_rls_policies.sql` — Row Level Security for every table
   - `00003_seed_data.sql` — starter Bible study groups (Monday Evening,
     Wednesday Morning, Friday Evening). Welcomers are **not** seeded —
     add your real team from the Admin screen after first login.
   - `00004_automation_functions.sql` — SQL functions the Edge Functions
     call, plus the pg_cron schedules
   - `00005_add_service_category.sql` — adds the "service" dropdown
     (Swansea / Charlestown AM / Sunday@6) to visitor records
   - `00006_weekly_log_reminder.sql` — weekly "did anyone log this week"
     tracking + reminder schedule (Monday 12:30pm, Monday 6pm, Tuesday
     12:30pm)
   - `00007_push_subscriptions.sql` — storage for push notification
     subscriptions (see section 5a)
   - `00008_returning_visitor_flag.sql` — adds "has attended before, just
     not tracked" flag to visitor records
   - `00009_pending_visitors.sql` — table for public self-registration
     submissions awaiting a welcomer's review (see section 13)

3. **Important — after your first deploy**, update two settings so
   pg_cron can call your Edge Functions (see step 5 for why these can't be
   hardcoded ahead of time):

   ```sql
   update public.app_settings set value = 'https://YOUR-PROJECT-REF.supabase.co' where key = 'project_url';
   update public.app_settings set value = 'YOUR_SERVICE_ROLE_KEY' where key = 'service_role_key';
   ```

   Run this in the Supabase SQL Editor. Find your service role key under
   Settings → API — **never** expose this key in client-side code or commit
   it to git.

---

## 4. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase project
URL and anon key (Settings → API in the Supabase dashboard):

```bash
cp .env.local.example .env.local
```

---

## 5. Deploy the Edge Functions

The four functions in `supabase/functions/` handle all automated email
logic and the Bible study outcome write:

```bash
supabase functions deploy send-three-week-prompt
supabase functions deploy send-bible-study-reminder
supabase functions deploy send-welcomer-nudge
supabase functions deploy set-bible-study-outcome
supabase functions deploy send-weekly-log-reminder
supabase functions deploy submit-pending-visitor --no-verify-jwt
```

⚠️ **`submit-pending-visitor` needs `--no-verify-jwt`.** Every other
function requires a logged-in user and Supabase checks that automatically.
This one is different — it's called from the public self-registration
form, where the visitor filling it in has no account and no login. Without
`--no-verify-jwt`, Supabase will reject every submission with a 401 error
before your function code even runs. If you ever redeploy this specific
function, remember to include the flag again each time.

Set the secrets these functions need (Resend API key, service role key —
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by
Supabase, so you only need to set Resend-related ones):

```bash
supabase secrets set RESEND_API_KEY=re_your_key_here
supabase secrets set RESEND_FROM_ADDRESS="CPC Welcoming <welcoming@yourchurchdomain.org>"
```

Why the two-step settings dance in step 3? Supabase doesn't know your
project's public URL or expose the service role key to SQL migrations at
deploy time, so pg_cron needs to be told where to send its HTTP calls
*after* the project exists. This is a one-time setup step.

---

## 5a. Set up push notifications (weekly log reminder only)

The weekly "did anyone log this week" reminder (Mon 12:30pm, Mon 6pm,
Tue 12:30pm) sends **push notifications only** — no email fallback. This
means it needs a bit more setup than the other three automated emails, and
anyone who skips it simply won't get this particular reminder.

### Generate VAPID keys

VAPID keys let your server prove to Apple/Google/Mozilla's push services
that it's really you sending the notification. Generate a pair once:

```bash
npx web-push generate-vapid-keys
```

This prints a public and private key. Keep both.

### Set them as secrets

```bash
supabase secrets set VAPID_PUBLIC_KEY=your-public-key
supabase secrets set VAPID_PRIVATE_KEY=your-private-key
supabase secrets set VAPID_SUBJECT="mailto:admin@yourchurchdomain.org"
```

### Add the public key to the app's environment variables

The public key also needs to be available to the browser (it's meant to be
public — that's fine). Add it to `.env.local` for local dev:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-public-key
```

...and add the same variable in your hosting provider's dashboard (e.g.
Vercel → Settings → Environment Variables) for production.

### Deploy the weekly reminder function

```bash
supabase functions deploy send-weekly-log-reminder
```

### Have each person turn it on

Each welcomer/admin needs to do this themselves, once, on each device they
want reminders on:

1. Open the app
2. **iPhone only** — first tap the Share button in Safari, then
   **Add to Home Screen**, then open the app from that new home screen
   icon (not from Safari directly) — Apple only allows push notifications
   for "installed" web apps, not ones open in a regular browser tab
3. Go to **More**
4. Tap **Turn on notifications**, then tap **Allow** when the phone asks

If someone accidentally taps "Don't Allow," there's no in-app way to
re-prompt them — they'll need to go into their phone's Settings app, find
the browser or the installed app, and re-enable notifications manually.

### Testing it

You can trigger the function manually to test without waiting for Monday:

```bash
supabase functions invoke send-weekly-log-reminder
```

If nothing arrives, check `select * from weekly_log_checkins order by
cycle_start desc limit 1;` to see whether the current week is already
marked `satisfied` (if so, no reminder is due — that's working as
intended, not a bug).

---

## 6. Configure minister / YA worker emails

Once you're running the app (see step 7), sign up your first user (they'll
automatically become an **admin**), then go to **More → Admin & Settings**
and set:

- Church display name
- Minister email (receives 3-week and Bible study follow-up prompts for
  non-YA visitors)
- YA worker email (same prompts, but for visitors marked "Young Adults (YA)")

Also add your real **welcomers** and any additional **Bible study groups**
from that same screen.

---

## 7. Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`. The first account you sign up with becomes
the admin automatically; everyone after that defaults to the "welcomer"
role (an admin can't currently change roles from the UI — do it via SQL if
needed: `update public.profiles set role = 'admin' where email = '...';`).

### Deploying the app itself

Any Next.js host works (Vercel is simplest). Set the same two
`NEXT_PUBLIC_SUPABASE_*` environment variables in your hosting provider's
dashboard.

---

## 8. How the automation works

All automation runs **server-side** via Supabase Edge Functions triggered
by pg_cron — nothing depends on a browser tab being open.

| Trigger | Schedule | What happens |
|---|---|---|
| 3-week check-in | Daily 07:00 UTC | Any visitor who's just completed weeks 1–3 gets an email sent to the minister (or YA worker) prompting Elvanto + Bible study invite. Visitor auto-moves to **Settled**. |
| Bible study reminder | Daily 07:10 UTC | Visitors marked "Not Yet (remind in 6 weeks)" get re-prompted once their 6-week timer is up. |
| Welcomer nudge | Daily 07:20 UTC | Visitors inactive 4+ weeks (configurable) trigger an email to their assigned welcomer asking whether to archive them. Requires the welcomer to have signed up and linked their profile (`profiles.welcomer_id`). |
| Weekly log reminder | Mon 12:30pm, Mon 6pm, Tue 12:30pm (Sydney time) | If no one has added/updated a visitor or hit "No one new this week" since Monday, every welcomer + admin gets a **push notification** (not email — see section 5a for setup). Stops as soon as the week is satisfied — up to 3 pushes max. |

You can inspect/manage the cron schedules directly in SQL:

```sql
select * from cron.job;
select cron.unschedule('three-week-prompt-daily');
```

And test any Edge Function manually:

```bash
supabase functions invoke send-three-week-prompt
```

---

## 9. Linking a welcomer's login to their spreadsheet identity

The welcomer nudge email needs somewhere to send to. When you add a
welcomer in Admin, that just creates the *label* used on visitor records
(name + colour). To actually receive nudge emails, that person needs a
login, and an admin needs to set `profiles.welcomer_id` to match — currently
done via SQL until a dedicated "link my account" UI is worth building:

```sql
update public.profiles
set welcomer_id = (select id from public.welcomers where name = 'Jemma')
where email = 'jemma@example.com';
```

---

## 10. Project structure

```
app/
  (app)/                  Authenticated routes (dashboard, visitors, admin)
  login/                  Sign in / sign up
  auth/callback/          Email confirmation redirect handler
components/               Shared UI (nav, cards, tags, header)
lib/
  supabase/               Browser + server Supabase clients
  hooks/                  useAppData (profile/welcomers/settings context), useVisitors
types/database.ts         Hand-written types mirroring the schema
supabase/
  migrations/             Run in order via `supabase db push`
  functions/               Edge Functions (Deno)
    _shared/utils.ts       Email sending, settings lookup, logging helpers
```

---

## 11. Role model

Kept intentionally simple per the brief:

- **admin** — everything a welcomer can do, plus Admin & Settings (manage
  welcomers, Bible study groups, notification emails), and can delete
  visitor records.
- **welcomer** — can view all visitors, add new visitors, mark attendance,
  update any field, archive visitors. Cannot delete or access Admin.

The first person to ever sign up becomes admin automatically. Promote
someone else later via SQL:

```sql
update public.profiles set role = 'admin' where email = 'someone@example.com';
```

---

## 12. Public self-registration form

Visitors can register themselves at `<your-app-url>/register` — no login
needed. It asks for name, contact details, which service they attended,
and a short "anything else?" message.

### How it works

Submissions do **not** go straight into the main visitor list. They land
in a holding area first, visible to welcomers/admins at **More → New
submissions**, and the dashboard shows a banner whenever there's anything
waiting. A welcomer reviews each one, fills in the two things the public
form doesn't ask (age category and which welcomer to assign), and taps
"Add as visitor" — at which point it becomes a normal tracked visitor
record, exactly as if it had been typed in directly. Submissions can also
be dismissed (e.g. spam, or duplicate entries) without becoming a visitor
record.

This two-step design is deliberate — it means a welcomer always has a
chance to check a self-submission before it enters the real system,
rather than random public form-fills silently creating visitor records
nobody's aware of.

### Sharing the link

Put `<your-app-url>/register` somewhere visitors will actually see it —
a QR code on a welcome card, a slide during announcements, printed on a
connect card. It works on any phone without needing an account.

### A note on spam protection

This function has minimal spam protection (a duplicate-name check within
5 minutes, mainly to catch accidental double-taps). It is **not** hooked
up to a bot-detection service like Cloudflare Turnstile or hCaptcha. For
a form only shared internally via QR code at services, this is
proportionate — but if you ever share the link somewhere public (e.g. a
public-facing website), consider adding bot protection before doing so,
since the endpoint has no login requirement by design.

---

## 13. Troubleshooting

- **"No welcomers set up yet" on Add Visitor** — expected on a fresh
  install. Add welcomers from Admin & Settings first.
- **Emails not sending** — check `select * from email_log order by
  created_at desc;` for error messages, and confirm `RESEND_API_KEY` is set
  as an Edge Function secret (`supabase secrets list`).
- **Cron not firing** — confirm `project_url` and `service_role_key` in
  `app_settings` were updated after deploy (step 3), and check `select *
  from cron.job_run_details order by start_time desc limit 20;` for errors.
- **Weekly reminder not firing** — confirm `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` are set as Edge Function secrets
  (`supabase secrets list`), and that `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is set
  in the app's environment (both locally and on your hosting provider).
- **Someone isn't getting the weekly reminder** — check they've completed
  the "Turn on notifications" step in More (see section 5a), and on
  iPhone, that they opened the app from the Home Screen icon, not Safari.
  This channel has no email fallback — if push isn't set up, that person
  simply won't receive it.
- **Self-registration form fails / gets a 401 error** — the
  `submit-pending-visitor` function was deployed without the
  `--no-verify-jwt` flag. Redeploy with:
  ```bash
  supabase functions deploy submit-pending-visitor --no-verify-jwt
  ```
- **Weekly log reminder times drift by an hour** — the three reminder
  times (Mon 12:30pm, Mon 6pm, Tue 12:30pm) are scheduled in UTC based on
  Sydney's non-daylight-saving offset (AEST, UTC+10). During daylight
  saving (roughly October–April, AEDT, UTC+11), they'll fire an hour later
  than intended. To fix, update the three schedules in SQL Editor twice a
  year:

  ```sql
  select cron.unschedule('weekly-log-reminder-1');
  select cron.unschedule('weekly-log-reminder-2');
  select cron.unschedule('weekly-log-reminder-3');
  -- then re-run the three cron.schedule(...) calls from
  -- 00006_weekly_log_reminder.sql with times shifted by 1 hour
  ```
