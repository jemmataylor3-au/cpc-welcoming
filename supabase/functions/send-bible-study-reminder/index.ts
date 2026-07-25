// send-bible-study-reminder
//
// Triggered daily by pg_cron. Finds visitors whose Bible study status is
// "Not Yet (remind in 6 weeks)" and whose reminder date has arrived, and
// re-sends the same prompt to the minister/YA worker. Clears the reminder
// date after sending so it doesn't repeat until the status is changed again.

import {
  getServiceClient,
  getSetting,
  sendEmail,
  logEmail,
  emailWrapper,
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
    const yaWorkerEmail = await getSetting(supabase, "ya_worker_email");

    const { data: visitors, error } = await supabase.rpc(
      "visitors_due_bible_study_reminder"
    );
    if (error) throw error;

    for (const visitor of visitors ?? []) {
      const recipient =
        visitor.age_category === "Young Adults (YA)"
          ? yaWorkerEmail
          : ministerEmail;

      const html = emailWrapper(
        `
          <h2 style="font-family: Georgia, serif; color:#172B3A; font-weight:400;">Bible study follow-up: ${escapeHtml(
            visitor.name
          )}</h2>
          <p>
            It's been 6 weeks since ${escapeHtml(visitor.name)} was marked
            "Not Yet" for Bible study. Worth a follow-up to see if they'd
            like to join a group now?
          </p>
        `,
        churchName
      );

      try {
        await sendEmail({
          to: recipient,
          subject: `Bible study follow-up: ${visitor.name}`,
          html,
        });
        await logEmail(supabase, {
          visitorId: visitor.id,
          emailType: "bible_study_reminder",
          recipient,
          status: "sent",
        });
        // Clear the due date; it will be re-set if the outcome is set to
        // "Not Yet" again via set-bible-study-outcome.
        await supabase
          .from("visitors")
          .update({ bible_study_reminder_due_at: null })
          .eq("id", visitor.id);
        results.push({ visitor: visitor.name, status: "sent", recipient });
      } catch (sendErr) {
        await logEmail(supabase, {
          visitorId: visitor.id,
          emailType: "bible_study_reminder",
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
    console.error("send-bible-study-reminder error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
