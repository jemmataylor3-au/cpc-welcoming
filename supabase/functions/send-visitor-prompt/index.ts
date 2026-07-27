// send-visitor-prompt
//
// Sends the 3-week check-in prompt for a single visitor, on demand, to an
// explicit list of recipients chosen by the person in the app. This is the
// manual counterpart to the nightly send-three-week-prompt job — it gives
// whoever marked the third week an immediate, confirmed send rather than
// waiting for the cron to pick it up.
//
// Stamps three_week_prompt_sent_at on success, so the automated job won't
// then send a duplicate.
//
// Requires a signed-in user (JWT in the Authorization header).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  getSetting,
  sendEmail,
  logEmail,
  emailWrapper,
  renderTemplate,
  templateBodyToHtml,
  escapeHtml,
  corsHeaders,
} from "../_shared/utils.ts";

interface RequestBody {
  visitorId: string;
  recipients: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();
    const recipients = (body.recipients ?? [])
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    if (!body.visitorId || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "A visitor and at least one recipient are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: visitor, error: visitorError } = await service
      .from("visitors")
      .select("*")
      .eq("id", body.visitorId)
      .single();

    if (visitorError || !visitor) {
      return new Response(JSON.stringify({ error: "Visitor not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const churchName = await getSetting(
      service,
      "church_name",
      "Charlestown Presbyterian Church"
    );

    const rendered = await renderTemplate(
      service,
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
        `<p style="color:#53796E; font-size: 13px;">First attended: ${visitor.date_first_attended} &middot; Service: ${escapeHtml(visitor.service)} &middot; Age category: ${escapeHtml(visitor.age_category)}</p>`,
      churchName
    );

    const sent: string[] = [];
    const failed: { recipient: string; error: string }[] = [];

    for (const to of recipients) {
      try {
        await sendEmail({ to, subject: rendered.subject, html });
        await logEmail(service, {
          visitorId: visitor.id,
          emailType: "3_week_prompt",
          recipient: to,
          status: "sent",
        });
        sent.push(to);
      } catch (sendErr) {
        await logEmail(service, {
          visitorId: visitor.id,
          emailType: "3_week_prompt",
          recipient: to,
          status: "failed",
          errorMessage: String(sendErr),
        });
        failed.push({ recipient: to, error: String(sendErr) });
      }
    }

    // Only mark the prompt as handled if something actually got through —
    // otherwise the nightly job should still get a chance to retry.
    if (sent.length > 0) {
      await service
        .from("visitors")
        .update({ three_week_prompt_sent_at: new Date().toISOString() })
        .eq("id", visitor.id);

      await service.from("visitor_activity_log").insert({
        visitor_id: visitor.id,
        actor_id: user.id,
        action: "prompt_sent",
        detail: `3-week prompt sent to ${sent.join(", ")}`,
      });
    }

    return new Response(JSON.stringify({ sent, failed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-visitor-prompt error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
