// send-weekly-digest
//
// Triggered weekly by pg_cron (Monday 8am Sydney time — see migration
// 00015). Emails every admin a summary of the week's welcoming activity:
// new visitors added, moved to Settled, archived, and the current active
// total. Wording is editable from Admin → Email wording.
//
// Skipped entirely if app_settings.weekly_digest_enabled is not 'true'.

import {
  getServiceClient,
  getSetting,
  sendEmail,
  logEmail,
  emailWrapper,
  renderTemplate,
  templateBodyToHtml,
  corsHeaders,
} from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = getServiceClient();

  try {
    const enabled = await getSetting(supabase, "weekly_digest_enabled", "true");
    if (enabled !== "true") {
      return new Response(JSON.stringify({ sent: false, reason: "Digest disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const churchName = await getSetting(
      supabase,
      "church_name",
      "Charlestown Presbyterian Church"
    );

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [newRes, settledRes, archivedRes, activeRes] = await Promise.all([
      supabase.from("visitors").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
      supabase.from("visitors").select("id", { count: "exact", head: true }).gte("settled_at", weekAgo),
      supabase.from("visitors").select("id", { count: "exact", head: true }).gte("archived_at", weekAgo),
      supabase.from("visitors").select("id", { count: "exact", head: true }).eq("status", "Active"),
    ]);

    const vars = {
      new_count: String(newRes.count ?? 0),
      settled_count: String(settledRes.count ?? 0),
      archived_count: String(archivedRes.count ?? 0),
      active_total: String(activeRes.count ?? 0),
      church_name: churchName,
    };

    const rendered = await renderTemplate(supabase, "weekly_digest", vars, {
      subject: "Welcoming summary for the week",
      body:
        "Here is this week's welcoming summary:\n\n" +
        "- New visitors added: {{new_count}}\n" +
        "- Moved to Settled: {{settled_count}}\n" +
        "- Archived: {{archived_count}}\n" +
        "- Currently active: {{active_total}}",
    });

    const html = emailWrapper(templateBodyToHtml(rendered.body), churchName);

    // All approved admins, plus any extra addresses configured in settings.
    const { data: admins } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "admin")
      .eq("approved", true);

    const extraRaw = await getSetting(supabase, "weekly_digest_recipients", "");
    const extras = extraRaw
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    const recipients = [
      ...new Set([...(admins ?? []).map((a) => a.email).filter(Boolean), ...extras]),
    ];

    const results: Record<string, unknown>[] = [];

    for (const to of recipients) {
      try {
        await sendEmail({ to, subject: rendered.subject, html });
        await logEmail(supabase, {
          visitorId: null,
          emailType: "weekly_digest",
          recipient: to,
          status: "sent",
        });
        results.push({ recipient: to, status: "sent" });
      } catch (sendErr) {
        await logEmail(supabase, {
          visitorId: null,
          emailType: "weekly_digest",
          recipient: to,
          status: "failed",
          errorMessage: String(sendErr),
        });
        results.push({ recipient: to, status: "failed", error: String(sendErr) });
      }
    }

    return new Response(JSON.stringify({ sent: true, stats: vars, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("send-weekly-digest error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
