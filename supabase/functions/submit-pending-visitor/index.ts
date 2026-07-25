// submit-pending-visitor
//
// The ONLY endpoint in this app that accepts unauthenticated requests. It's
// what the public self-registration form (app/register) calls. Writes go
// into pending_visitors (never directly into visitors), using the service
// role key so no RLS policy needs to grant anon/public insert access to
// anything. Includes basic validation and a simple rate-limit-ish guard
// (reject if the same email+name submitted in the last 5 minutes) to
// reduce accidental double-submits and casual abuse. This is not a
// substitute for a real bot-protection service (e.g. Cloudflare Turnstile)
// if spam becomes a problem — see the README note on this function.

import { getServiceClient, corsHeaders } from "../_shared/utils.ts";

interface SubmitBody {
  name: string;
  email?: string;
  phoneNumber?: string;
  service: "Swansea" | "Charlestown AM" | "Sunday@6";
  reasonForAttendance?: string;
  message?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: SubmitBody = await req.json();

    if (!body.name || !body.name.trim()) {
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.service) {
      return new Response(JSON.stringify({ error: "Service is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getServiceClient();

    // Basic duplicate-submission guard: same name submitted in the last
    // 5 minutes is almost certainly a double-tap, not a second person.
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("pending_visitors")
      .select("id")
      .eq("name", body.name.trim())
      .gte("submitted_at", fiveMinutesAgo)
      .limit(1);

    if (recent && recent.length > 0) {
      return new Response(
        JSON.stringify({ ok: true, note: "Already received — thank you!" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: insertError } = await supabase.from("pending_visitors").insert({
      name: body.name.trim().slice(0, 200),
      email: body.email?.trim().slice(0, 200) || null,
      phone_number: body.phoneNumber?.trim().slice(0, 50) || null,
      service: body.service,
      reason_for_attendance: body.reasonForAttendance || "Other",
      message: body.message?.trim().slice(0, 1000) || null,
    });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("submit-pending-visitor error:", err);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
