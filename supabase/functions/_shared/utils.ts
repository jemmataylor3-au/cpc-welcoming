// Shared helpers for CPC Welcoming Edge Functions.
// Deno runtime (Supabase Edge Functions) — uses esm.sh imports.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function getSetting(
  supabase: ReturnType<typeof getServiceClient>,
  key: string,
  fallback = ""
): Promise<string> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return fallback;
  return data.value ?? fallback;
}

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email via Resend. Requires RESEND_API_KEY to be set as an Edge
 * Function secret (`supabase secrets set RESEND_API_KEY=...`).
 * Throws on failure so callers can log it to email_log.
 */
export async function sendEmail({ to, subject, html }: SendEmailArgs) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromAddress = Deno.env.get("RESEND_FROM_ADDRESS") ?? "welcoming@example.org";

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY environment variable.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }

  return res.json();
}

export async function logEmail(
  supabase: ReturnType<typeof getServiceClient>,
  args: {
    visitorId: string | null;
    emailType: string;
    recipient: string;
    status: "sent" | "failed";
    errorMessage?: string;
  }
) {
  await supabase.from("email_log").insert({
    visitor_id: args.visitorId,
    email_type: args.emailType,
    recipient: args.recipient,
    status: args.status,
    error_message: args.errorMessage ?? null,
  });
}

interface EmailTemplateRow {
  subject: string;
  body: string;
}

/**
 * Loads an admin-editable email template and substitutes {{placeholders}}.
 * Falls back to the supplied defaults if the template row is missing, so a
 * deleted or renamed template can never stop an email from going out.
 */
export async function renderTemplate(
  supabase: ReturnType<typeof getServiceClient>,
  key: string,
  vars: Record<string, string>,
  fallback: EmailTemplateRow
): Promise<EmailTemplateRow> {
  const { data } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("key", key)
    .maybeSingle();

  const tpl = (data as EmailTemplateRow) ?? fallback;

  const substitute = (text: string) =>
    Object.entries(vars).reduce(
      (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v),
      text
    );

  return { subject: substitute(tpl.subject), body: substitute(tpl.body) };
}

/** Converts plain-text template bodies into simple HTML paragraphs/lists. */
export function templateBodyToHtml(body: string): string {
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("- ")) {
        return `<li>${escapeHtml(trimmed.slice(2))}</li>`;
      }
      return `<p>${escapeHtml(trimmed)}</p>`;
    })
    .join("")
    .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");
}

export function escapeHtml(input: string) {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface RecipientRow {
  name: string;
  email: string | null;
  services: string[];
  all_young_adults: boolean;
}

/**
 * Works out who should receive a prompt about a given visitor.
 *
 * Routing rules (managed in Admin -> Notification recipients):
 *   - anyone whose `services` list includes the visitor's service, plus
 *   - anyone with `all_young_adults` set, if the visitor is a Young Adult
 *     (regardless of which service they attended).
 *
 * Rows with a blank email are skipped, so a recipient can be configured
 * ahead of their address being known without silently breaking sends.
 * Returns de-duplicated addresses.
 */
export async function resolveRecipients(
  supabase: ReturnType<typeof getServiceClient>,
  service: string,
  ageCategory: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("notification_recipients")
    .select("name, email, services, all_young_adults")
    .eq("active", true);

  if (error) throw error;

  const isYoungAdult = ageCategory === "Young Adult";

  const matched = ((data as RecipientRow[]) ?? []).filter((r) => {
    const coversService = Array.isArray(r.services) && r.services.includes(service);
    const coversYoungAdults = r.all_young_adults && isYoungAdult;
    return coversService || coversYoungAdults;
  });

  return [
    ...new Set(
      matched
        .map((r) => (r.email ?? "").trim())
        .filter((e) => e.length > 0)
    ),
  ];
}

export function emailWrapper(bodyHtml: string, churchName: string) {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #103349;">
      <div style="background:#103349; padding: 20px 24px; border-radius: 10px 10px 0 0;">
        <span style="color:#FDF9F7; font-size: 18px; font-weight: 600;">${churchName}</span>
      </div>
      <div style="background:#FFFFFF; border: 1px solid #E7DED9; border-top: none; padding: 24px; border-radius: 0 0 10px 10px;">
        ${bodyHtml}
      </div>
      <p style="color:#53796E; font-size: 12px; margin-top: 16px;">
        This is an automated message from the ${churchName} welcoming system.
      </p>
    </div>
  `;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Sends a Web Push notification to every subscription on file for a given
 * profile. Uses the `web-push` npm package via Deno's npm: specifier.
 * Requires VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT (a
 * mailto: address) to be set as Edge Function secrets.
 * Automatically removes subscriptions that report as expired/invalid
 * (HTTP 404/410 from the push service) so the table doesn't accumulate
 * dead endpoints.
 */
export async function sendPushToProfile(
  supabase: ReturnType<typeof getServiceClient>,
  profileId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const webpush = await import("npm:web-push@3.6.7");

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.org";

  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY secrets.");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh_key, auth_key")
    .eq("profile_id", profileId);

  if (error) throw error;

  let sent = 0;
  let failed = 0;

  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
        },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err: unknown) {
      failed++;
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // Subscription is gone (user revoked permission, uninstalled, etc.)
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return { sent, failed };
}
