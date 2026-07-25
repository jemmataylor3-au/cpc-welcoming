// set-bible-study-outcome
//
// Called directly from the app (authenticated user, not cron) when the
// minister/YA worker records the Bible study outcome for a visitor. If the
// outcome is "Not Yet (remind in 6 weeks)", this schedules the reminder
// date server-side, so the 6-week wait is enforced consistently regardless
// of which client set it.
//
// Expects a Supabase Auth JWT in the Authorization header (the app's normal
// authenticated fetch does this automatically). Validates the caller is a
// signed-in user before writing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getSetting, corsHeaders } from "../_shared/utils.ts";

interface RequestBody {
  visitorId: string;
  outcome: "Joined Bible Study" | "Not Involved" | "Not Yet (remind in 6 weeks)";
  bibleStudyGroupId?: string | null;
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

    // Client bound to the caller's JWT so RLS applies to the read/verify step.
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
    if (!body.visitorId || !body.outcome) {
      return new Response(
        JSON.stringify({ error: "visitorId and outcome are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service client for the actual write + reading settings.
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const update: Record<string, unknown> = {
      bible_study_status: body.outcome,
      bible_study_group_id: body.bibleStudyGroupId ?? null,
    };

    if (body.outcome === "Not Yet (remind in 6 weeks)") {
      const weeksStr = await getSetting(serviceClient, "bible_study_reminder_weeks", "6");
      const weeks = parseInt(weeksStr, 10) || 6;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + weeks * 7);
      update.bible_study_reminder_due_at = dueDate.toISOString().slice(0, 10);
    } else {
      update.bible_study_reminder_due_at = null;
    }

    const { data, error } = await serviceClient
      .from("visitors")
      .update(update)
      .eq("id", body.visitorId)
      .select()
      .single();

    if (error) throw error;

    await serviceClient.from("visitor_activity_log").insert({
      visitor_id: body.visitorId,
      actor_id: user.id,
      action: "bible_study_outcome_set",
      detail: body.outcome,
    });

    return new Response(JSON.stringify({ visitor: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("set-bible-study-outcome error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
