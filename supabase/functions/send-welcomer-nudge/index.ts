// send-welcomer-nudge
//
// Triggered daily by pg_cron. Finds visitors who haven't attended in 4+
// weeks (configurable via app_settings.welcomer_nudge_weeks) and emails
// their assigned welcomer asking whether the visitor should be archived.
// Requires the welcomer's profile to have an email address on file.

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
  const results: Record<string, unknown>[] = [];

  try {
    const churchName = await getSetting(
      supabase,
      "church_name",
      "Charlestown Presbyterian Church"
    );

    const { data: visitors, error } = await supabase.rpc(
      "visitors_due_welcomer_nudge"
    );
    if (error) throw error;

    for (const visitor of visitors ?? []) {
      if (!visitor.welcomer_id) continue;

      // Find an email address for this welcomer via linked profile(s).
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("welcomer_id", visitor.welcomer_id)
        .maybeSingle();

      if (!profile?.email) {
        results.push({
          visitor: visitor.name,
          status: "skipped",
          reason: "No profile email linked to this welcomer",
        });
        continue;
      }

      const rendered = await renderTemplate(
        supabase,
        "welcomer_nudge",
        { visitor_name: visitor.name, church_name: churchName },
        {
          subject: "Check in on {{visitor_name}}?",
          body:
            "{{visitor_name}} has not attended in a while. Should they be archived, " +
            "or are they still connecting with the church? You can update their status in the app.",
        }
      );

      const html = emailWrapper(templateBodyToHtml(rendered.body), churchName);

      try {
        await sendEmail({ to: profile.email, subject: rendered.subject, html });
        await logEmail(supabase, {
          visitorId: visitor.id,
          emailType: "welcomer_nudge",
          recipient: profile.email,
          status: "sent",
        });
        await supabase
          .from("visitors")
          .update({ welcomer_nudge_sent_at: new Date().toISOString() })
          .eq("id", visitor.id);
        results.push({ visitor: visitor.name, status: "sent", recipient: profile.email });
      } catch (sendErr) {
        await logEmail(supabase, {
          visitorId: visitor.id,
          emailType: "welcomer_nudge",
          recipient: profile.email,
          status: "failed",
          errorMessage: String(sendErr),
        });
        results.push({
          visitor: visitor.name,
          status: "failed",
          error: String(sendErr),
        });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("send-welcomer-nudge error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

