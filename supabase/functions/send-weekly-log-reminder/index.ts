// send-weekly-log-reminder
//
// Triggered 3 times by pg_cron (Mon 12:30pm, Mon 6pm, Tue 12:30pm — see
// migration 00006). Checks whether this week's cycle has already been
// satisfied (someone added/updated a visitor, or hit "No one new this
// week"). If not, and the correct reminder slot hasn't fired yet, sends a
// push notification to every welcomer + admin's registered device(s) and
// stamps that slot as sent.
//
// This channel is push-only by design (no email fallback) — see the
// push_subscriptions table and the "Push notifications" section of the
// More page for how people opt in. Because there's no fallback, anyone
// who hasn't completed push setup (especially iPhone users who need to
// "Add to Home Screen" first) will not receive this reminder at all.

import {
  getServiceClient,
  getSetting,
  sendPushToProfile,
  corsHeaders,
} from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = getServiceClient();

  try {
    const { data: due, error: dueError } = await supabase
      .rpc("weekly_reminder_due")
      .maybeSingle();

    if (dueError) throw dueError;

    if (!due) {
      return new Response(
        JSON.stringify({ sent: false, reason: "Already satisfied or not due yet" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const { checkin_id, reminder_number } = due as {
      checkin_id: string;
      reminder_number: number;
    };

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name");
    if (profilesError) throw profilesError;

    const appUrl = await getSetting(supabase, "project_url", "");

    const titleLabel =
      reminder_number === 1
        ? "Monday check-in"
        : reminder_number === 2
        ? "Reminder"
        : "Final reminder";

    const results: Record<string, unknown>[] = [];

    for (const profile of profiles ?? []) {
      try {
        const outcome = await sendPushToProfile(supabase, profile.id, {
          title: `${titleLabel}: log this week's visitors`,
          body: "No one has logged anything yet. Add a visitor, or mark 'no one new' if that's the case.",
          url: appUrl,
        });
        results.push({ profile: profile.full_name, ...outcome });
      } catch (pushErr) {
        results.push({ profile: profile.full_name, error: String(pushErr) });
      }
    }

    const stampField =
      reminder_number === 1
        ? "reminder_1_sent_at"
        : reminder_number === 2
        ? "reminder_2_sent_at"
        : "reminder_3_sent_at";

    await supabase
      .from("weekly_log_checkins")
      .update({ [stampField]: new Date().toISOString() })
      .eq("id", checkin_id);

    return new Response(
      JSON.stringify({ sent: true, reminder_number, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error("send-weekly-log-reminder error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
