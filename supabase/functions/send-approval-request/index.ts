// send-approval-request
//
// Triggered by a database trigger whenever someone signs up and lands in
// the "awaiting approval" state. Emails every approved admin so they know
// a person is waiting, rather than that person sitting blocked until an
// admin happens to open the app.
//
// Deliberately reports EVERYONE currently pending, not just the person who
// triggered it — so if one send fails, the next signup's email still
// surfaces the earlier person rather than losing them.

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
    const churchName = await getSetting(
      supabase,
      "church_name",
      "Charlestown Presbyterian Church"
    );

    const { data: pending, error: pendingError } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("approved", false)
      .order("created_at");

    if (pendingError) throw pendingError;

    if (!pending || pending.length === 0) {
      return new Response(
        JSON.stringify({ sent: false, reason: "Nobody is awaiting approval" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const rendered = await renderTemplate(
      supabase,
      "approval_request",
      {
        pending_count: String(pending.length),
        pending_names: pending
          .map((p) => `- ${p.full_name} (${p.email})`)
          .join("\n"),
        church_name: churchName,
      },
      {
        subject: "Someone is waiting for access to {{church_name}} Welcoming",
        body:
          "{{pending_count}} person or people have created an account and are waiting to be approved:\n\n" +
          "{{pending_names}}\n\n" +
          "Open the app and go to More > Admin & Settings > Users to approve them.",
      }
    );

    const html = emailWrapper(templateBodyToHtml(rendered.body), churchName);

    const { data: admins, error: adminError } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "admin")
      .eq("approved", true);

    if (adminError) throw adminError;

    const recipients = [
      ...new Set((admins ?? []).map((a) => a.email).filter(Boolean)),
    ];

    const results: Record<string, unknown>[] = [];

    for (const to of recipients) {
      try {
        await sendEmail({ to, subject: rendered.subject, html });
        await logEmail(supabase, {
          visitorId: null,
          emailType: "approval_request",
          recipient: to,
          status: "sent",
        });
        results.push({ recipient: to, status: "sent" });
      } catch (sendErr) {
        await logEmail(supabase, {
          visitorId: null,
          emailType: "approval_request",
          recipient: to,
          status: "failed",
          errorMessage: String(sendErr),
        });
        results.push({ recipient: to, status: "failed", error: String(sendErr) });
      }
    }

    return new Response(
      JSON.stringify({ sent: true, pending: pending.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error("send-approval-request error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});