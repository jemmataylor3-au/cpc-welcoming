"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Send, CheckCircle2, X, AlertTriangle } from "lucide-react";
import type { Visitor, NotificationRecipient } from "@/types/database";

interface SendPromptModalProps {
  visitor: Visitor;
  recipients: NotificationRecipient[];
  onClose: () => void;
  onSent: () => void;
}

export function SendPromptModal({
  visitor,
  recipients,
  onClose,
  onSent,
}: SendPromptModalProps) {
  const supabase = createClient();

  // Mirrors the routing rules used by the automated job: anyone covering
  // this visitor's service, plus the "all Young Adults" catch-all.
  const autoMatched = useMemo(
    () =>
      recipients.filter(
        (r) =>
          (r.services ?? []).includes(visitor.service) ||
          (r.all_young_adults && visitor.age_category === "Young Adult")
      ),
    [recipients, visitor.service, visitor.age_category]
  );

  const others = recipients.filter((r) => !autoMatched.some((m) => m.id === r.id));

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(autoMatched.filter((r) => r.email?.trim()).map((r) => r.id))
  );
  const [extraEmail, setExtraEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: string[]; failed: { recipient: string; error: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const chosenEmails = [
    ...recipients
      .filter((r) => selectedIds.has(r.id))
      .map((r) => (r.email ?? "").trim())
      .filter(Boolean),
    ...(extraEmail.trim() ? [extraEmail.trim()] : []),
  ];

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-visitor-prompt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            visitorId: visitor.id,
            recipients: chosenEmails,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send.");

      setResult(json);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 px-4 py-6">
      <div className="w-full max-w-md bg-surface rounded-sheet p-5 max-h-[85vh] overflow-y-auto">
        {result ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-green/20 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-navy" />
            </div>
            <h3 className="mb-2">
              {result.sent.length > 0 ? "Notification sent" : "Nothing sent"}
            </h3>
            {result.sent.length > 0 && (
              <p className="text-body text-textSecondary mb-2">
                Sent to {result.sent.join(", ")}
              </p>
            )}
            {result.failed.length > 0 && (
              <div className="text-left bg-error/10 rounded-input px-3 py-2 mb-3">
                <p className="text-body text-error font-medium mb-1">
                  Failed for {result.failed.length}:
                </p>
                {result.failed.map((f) => (
                  <p key={f.recipient} className="text-small text-error break-words">
                    {f.recipient} — {f.error}
                  </p>
                ))}
              </div>
            )}
            <button className="btn-primary w-full mt-3" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3>Send 3-week notification</h3>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center text-textSecondary shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-body text-textSecondary mb-4">
              {visitor.name} has completed three weeks. Who should be told?
            </p>

            {autoMatched.length > 0 && (
              <>
                <span className="label-field">
                  Based on {visitor.service}
                  {visitor.age_category === "Young Adult" ? " · Young Adult" : ""}
                </span>
                <div className="space-y-2 mb-4">
                  {autoMatched.map((r) => (
                    <RecipientRow
                      key={r.id}
                      recipient={r}
                      checked={selectedIds.has(r.id)}
                      onToggle={() => toggle(r.id)}
                    />
                  ))}
                </div>
              </>
            )}

            {others.length > 0 && (
              <>
                <span className="label-field">Others</span>
                <div className="space-y-2 mb-4">
                  {others.map((r) => (
                    <RecipientRow
                      key={r.id}
                      recipient={r}
                      checked={selectedIds.has(r.id)}
                      onToggle={() => toggle(r.id)}
                    />
                  ))}
                </div>
              </>
            )}

            <label className="label-field" htmlFor="extraEmail">
              Someone else (optional)
            </label>
            <input
              id="extraEmail"
              type="email"
              className="input-field mb-4"
              value={extraEmail}
              onChange={(e) => setExtraEmail(e.target.value)}
              placeholder="name@example.org"
            />

            {error && (
              <p className="text-body text-error bg-error/10 rounded-input px-3 py-2 mb-3">
                {error}
              </p>
            )}

            {chosenEmails.length === 0 && (
              <div className="flex items-start gap-2 bg-warning/10 rounded-input px-3 py-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <p className="text-small text-textPrimary">
                  No one selected with a valid email. Recipients without an
                  address can't be sent to — add one in Admin → Notification
                  recipients.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={onClose} disabled={sending}>
                Not now
              </button>
              <button
                className="btn-primary flex-1"
                onClick={handleSend}
                disabled={sending || chosenEmails.length === 0}
              >
                <Send className="w-4 h-4" />
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RecipientRow({
  recipient,
  checked,
  onToggle,
}: {
  recipient: NotificationRecipient;
  checked: boolean;
  onToggle: () => void;
}) {
  const hasEmail = !!recipient.email?.trim();
  return (
    <label
      className={`flex items-center gap-3 rounded-input border px-3 py-2 ${
        hasEmail ? "border-border" : "border-border opacity-60"
      }`}
    >
      <input
        type="checkbox"
        className="w-5 h-5 rounded accent-primary shrink-0"
        checked={checked}
        disabled={!hasEmail}
        onChange={onToggle}
      />
      <span className="min-w-0">
        <span className="block text-body text-textPrimary">{recipient.name}</span>
        <span className="block text-small text-textSecondary truncate">
          {hasEmail ? recipient.email : "No email on file"}
        </span>
      </span>
    </label>
  );
}
