"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { useAppData } from "@/lib/hooks/useAppData";
import { createClient } from "@/lib/supabase/client";
import {
  REASON_OPTIONS,
  AGE_CATEGORY_OPTIONS,
  SERVICE_OPTIONS,
  type ReasonForAttendance,
  type AgeCategory,
  type ChurchService,
  type Visitor,
} from "@/types/database";
import { ChevronLeft, AlertTriangle } from "lucide-react";
import { WelcomerSelect } from "@/components/WelcomerSelect";
import Link from "next/link";
import { format } from "date-fns";

export default function NewVisitorPage() {
  const router = useRouter();
  const supabase = createClient();
  const { profile, welcomers, loading: appDataLoading } = useAppData();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateFirstAttended, setDateFirstAttended] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [reason, setReason] = useState<ReasonForAttendance>(REASON_OPTIONS[0]);
  const [ageCategory, setAgeCategory] = useState<AgeCategory>("Over 30");
  const [service, setService] = useState<ChurchService>("Charlestown AM");
  const [welcomerId, setWelcomerId] = useState<string>("");
  const [welcomerOther, setWelcomerOther] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isReturning, setIsReturning] = useState(false);

  const [possibleDuplicates, setPossibleDuplicates] = useState<Visitor[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced duplicate-name check: fires ~500ms after the person stops
  // typing, using a case-insensitive partial match so "Jon" also catches
  // "Jonathan Smith" already in the system.
  const checkDuplicates = useCallback(
    async (searchName: string) => {
      if (searchName.trim().length < 2) {
        setPossibleDuplicates([]);
        return;
      }
      setCheckingDuplicates(true);
      const { data } = await supabase
        .from("visitors")
        .select("*")
        .ilike("name", `%${searchName.trim()}%`)
        .neq("status", "Archived")
        .limit(5);
      setPossibleDuplicates((data as Visitor[]) ?? []);
      setCheckingDuplicates(false);
    },
    [supabase]
  );

  useEffect(() => {
    const timer = setTimeout(() => checkDuplicates(name), 500);
    return () => clearTimeout(timer);
  }, [name, checkDuplicates]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Visitor name is required.");
      return;
    }
    if (!dateFirstAttended) {
      setError("Date first attended is required.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: insertError } = await supabase
        .from("visitors")
        .insert({
          name: name.trim(),
          email: email.trim() || null,
          phone_number: phone.trim() || null,
          date_first_attended: dateFirstAttended,
          reason_for_attendance: reason,
          age_category: ageCategory,
          service,
          is_returning: isReturning,
          welcomer_id: welcomerId || null,
          welcomer_other: welcomerOther,
          entered_by: profile?.id ?? null,
          week1_attended: true,
          week1_date: dateFirstAttended,
          week1_notes: notes.trim() || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await supabase.from("visitor_activity_log").insert({
        visitor_id: data.id,
        actor_id: profile?.id ?? null,
        action: "created",
        detail: `Added by ${profile?.full_name ?? "unknown"}`,
      });

      router.push(`/visitors/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save visitor.");
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="Add visitor"
        subtitle="Capture a first-time visitor's details"
        action={
          <Link
            href="/"
            className="w-11 h-11 rounded-button bg-white/10 flex items-center justify-center shrink-0"
          >
            <ChevronLeft className="w-5 h-5 text-secondary" />
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-5 -mt-3">
        <div className="card p-5 space-y-4">
          <div>
            <label className="label-field" htmlFor="name">
              Visitor name *
            </label>
            <input
              id="name"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {!checkingDuplicates && possibleDuplicates.length > 0 && (
            <div className="rounded-input bg-warning/10 border border-warning/30 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                <p className="text-body font-medium text-textPrimary">
                  Possible existing {possibleDuplicates.length === 1 ? "match" : "matches"}
                </p>
              </div>
              <div className="space-y-2">
                {possibleDuplicates.map((v) => (
                  <Link
                    key={v.id}
                    href={`/visitors/${v.id}`}
                    className="block bg-surface rounded-input px-3 py-2 border border-border"
                  >
                    <p className="text-body text-textPrimary">{v.name}</p>
                    <p className="text-small text-textSecondary">
                      First attended {format(new Date(v.date_first_attended), "d MMM yyyy")} ·{" "}
                      {v.status}
                    </p>
                  </Link>
                ))}
              </div>
              <p className="text-small text-textSecondary mt-2">
                If this is the same person, open their record above instead
                of creating a new one. If they're a different person with a
                similar name, or have attended before under a different
                record, it's fine to continue below.
              </p>
            </div>
          )}

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="w-5 h-5 rounded accent-primary"
              checked={isReturning}
              onChange={(e) => setIsReturning(e.target.checked)}
            />
            <span className="text-body text-textPrimary">
              They've attended before — just not tracked until now
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <div>
            <label className="label-field" htmlFor="dateFirst">
              Date first attended *
            </label>
            <input
              id="dateFirst"
              type="date"
              className="input-field"
              value={dateFirstAttended}
              onChange={(e) => setDateFirstAttended(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label-field" htmlFor="reason">
              Reason for attendance
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
            <label className="label-field" htmlFor="ageCategory">
              Age category
            </label>
            <select
              id="ageCategory"
              className="input-field"
              value={ageCategory}
              onChange={(e) => setAgeCategory(e.target.value as AgeCategory)}
            >
              {AGE_CATEGORY_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-field" htmlFor="service">
              Service
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
            <label className="label-field">Assigned welcomer</label>
            <WelcomerSelect
              welcomers={welcomers}
              service={service}
              welcomerId={welcomerId || null}
              welcomerOther={welcomerOther}
              disabled={appDataLoading}
              onChange={(id, other) => {
                setWelcomerId(id ?? "");
                setWelcomerOther(other);
              }}
            />
            {welcomers.length === 0 && !appDataLoading && (
              <p className="text-small text-textSecondary mt-1.5">
                No welcomers set up yet — add some in Admin → Welcomers.
              </p>
            )}
          </div>

          <div>
            <label className="label-field" htmlFor="notes">
              First week notes
            </label>
            <textarea
              id="notes"
              className="input-field h-24 py-3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Friendly, looking for a new church…"
            />
          </div>

          {error && (
            <p className="text-body text-error bg-error/10 rounded-input px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Saving…" : "Save visitor"}
          </button>
        </div>
      </form>
    </div>
  );
}
