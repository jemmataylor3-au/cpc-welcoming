// send-three-week-prompt
//
// Triggered daily by pg_cron (see migration 00004). Finds every visitor who
// has just completed 3 attended weeks and hasn't had the prompt sent yet,
// emails the minister (or YA worker, if age_category is YA) asking them to
// add the visitor to Elvanto and invite them to a Bible study, then stamps
// three_week_prompt_sent_at so it isn't sent twice.

import {
  getServiceClient,
  getSetting,
  sendEmail,
  logEmail,
  emailWrapper,
  escapeHtml,
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
    const ministerEmail = await getSetting(supabase, "minister_email");
    const ministerEmail2 = await getSetting(supabase, "minister_email_2");
    const yaWorkerEmail = await getSetting(supabase, "ya_worker_email");

    const { data: visitors, error } = await supabase.rpc(
      "visitors_due_three_week_prompt"
    );

    if (error) throw error;

    for (const visitor of visitors ?? []) {
      // YA visitors go to the YA worker; everyone else goes to the
      // minister(s). A blank second minister is simply skipped.
      const recipients =
        visitor.age_category === "Young Adults (YA)"
          ? [yaWorkerEmail]
          : [ministerEmail, ministerEmail2];
      const recipient = recipients.filter(Boolean).join(", ");

      const rendered = await renderTemplate(
        supabase,
        "three_week_prompt",
        { visitor_name: visitor.name, church_name: churchName },
        {
          subject: "3-week check-in: {{visitor_name}}",
          body:
            "{{visitor_name}} has now attended three weeks in a row. Could you:\n\n" +
            "- Add them to Elvanto\n" +
            "- Reach out to invite them to a Bible study group",
        }
      );

      const html = emailWrapper(
        templateBodyToHtml(rendered.body) +
          `<p style="color:#53796E; font-size: 13px;">First attended: ${visitor.date_first_attended} &middot; Age category: ${escapeHtml(visitor.age_category)} &middot; Reason: ${escapeHtml(visitor.reason_for_attendance)}</p>`,
        churchName
      );

      try {
        await sendEmail({ to: recipient, subject: rendered.subject, html });
        await logEmail(supabase, {
          visitorId: visitor.id,
          emailType: "3_week_prompt",
          recipient,
          status: "sent",
        });
        await supabase
          .from("visitors")
          .update({ three_week_prompt_sent_at: new Date().toISOString() })
          .eq("id", visitor.id);
        results.push({ visitor: visitor.name, status: "sent", recipient });
      } catch (sendErr) {
        await logEmail(supabase, {
          visitorId: visitor.id,
          emailType: "3_week_prompt",
          recipient,
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
    console.error("send-three-week-prompt error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

