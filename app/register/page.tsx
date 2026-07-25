"use client";

import { useState } from "react";
import { SERVICE_OPTIONS, REASON_OPTIONS, type ChurchService, type ReasonForAttendance } from "@/types/database";
import { Heart, CheckCircle2 } from "lucide-react";

export default function PublicRegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState<ChurchService>("Charlestown AM");
  const [reason, setReason] = useState<ReasonForAttendance>("Other");
  const [message, setMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-pending-visitor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Public anon key — safe to expose, this function is designed
            // for unauthenticated public use.
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
          },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim() || undefined,
            phoneNumber: phone.trim() || undefined,
            service,
            reasonForAttendance: reason,
            message: message.trim() || undefined,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center px-6 py-12">
        <div className="w-full max-w-sm mx-auto text-center">
          <div className="w-14 h-14 rounded-feature bg-success/15 flex items-center justify-center mb-4 mx-auto">
            <CheckCircle2 className="w-7 h-7 text-success" strokeWidth={2} />
          </div>
          <h1 className="font-display text-h1 text-primary mb-2">Thanks!</h1>
          <p className="text-body text-textSecondary">
            We've got your details and someone from our welcoming team will
            be in touch soon. We're really glad you came.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center px-6 py-12">
      <div className="w-full max-w-sm mx-auto">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-feature bg-primary flex items-center justify-center mb-4">
            <Heart className="w-7 h-7 text-secondary" strokeWidth={2} />
          </div>
          <h1 className="font-display text-h1 text-center text-primary">
            Great to have you
          </h1>
          <p className="text-body text-textSecondary text-center mt-2">
            Let us know a bit about yourself so we can say hello properly
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="label-field" htmlFor="name">
              Your name *
            </label>
            <input
              id="name"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label-field" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="label-field" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              className="input-field"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="label-field" htmlFor="service">
              Which service did you attend?
            </label>
            <select
              id="service"
              className="input-field"
              value={service}
              onChange={(e) => setService(e.target.value as ChurchService)}
            >
              {SERVICE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-field" htmlFor="reason">
              What brings you along?
            </label>
            <select
              id="reason"
              className="input-field"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReasonForAttendance)}
            >
              {REASON_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-field" htmlFor="message">
              Anything else you'd like us to know?
            </label>
            <textarea
              id="message"
              className="input-field h-24 py-3"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-body text-error bg-error/10 rounded-input px-3 py-2">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Sending…" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
