"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAppData } from "@/lib/hooks/useAppData";
import { PageHeader } from "@/components/PageHeader";
import { ChevronLeft, Mail, Phone, UserPlus } from "lucide-react";
import { format } from "date-fns";
import type { PendingVisitor, AgeCategory } from "@/types/database";
import { AGE_CATEGORY_OPTIONS } from "@/types/database";

export default function PendingVisitorsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { profile, welcomers } = useAppData();

  const [pending, setPending] = useState<PendingVisitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pending_visitors")
      .select("*")
      .eq("claimed", false)
      .order("submitted_at", { ascending: false });
    setPending((data as PendingVisitor[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function claim(
    submission: PendingVisitor,
    ageCategory: AgeCategory,
    welcomerId: string
  ) {
    setClaimingId(submission.id);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data: visitor, error: insertError } = await supabase
        .from("visitors")
        .insert({
          name: submission.name,
          email: submission.email,
          phone_number: submission.phone_number,
          date_first_attended: today,
          reason_for_attendance: submission.reason_for_attendance,
          age_category: ageCategory,
          service: submission.service,
          welcomer_id: welcomerId || null,
          entered_by: profile?.id ?? null,
          week1_attended: true,
          week1_date: today,
          week1_notes: submission.message || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await supabase.from("visitor_activity_log").insert({
        visitor_id: visitor.id,
        actor_id: profile?.id ?? null,
        action: "created",
        detail: "Created from a self-registration submission",
      });

      await supabase
        .from("pending_visitors")
        .update({
          claimed: true,
          claimed_by: profile?.id ?? null,
          claimed_at: new Date().toISOString(),
          resulting_visitor_id: visitor.id,
        })
        .eq("id", submission.id);

      router.push(`/visitors/${visitor.id}`);
    } catch {
      setClaimingId(null);
    }
  }

  async function dismiss(submissionId: string) {
    await supabase
      .from("pending_visitors")
      .update({ claimed: true, claimed_by: profile?.id ?? null, claimed_at: new Date().toISOString() })
      .eq("id", submissionId);
    await load();
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="New submissions"
        subtitle="From the self-registration form"
        action={
          <Link
            href="/"
            className="w-11 h-11 rounded-button bg-white/10 flex items-center justify-center shrink-0"
          >
            <ChevronLeft className="w-5 h-5 text-secondary" />
          </Link>
        }
      />

      <div className="max-w-2xl mx-auto px-5 -mt-3 space-y-3">
        {loading && <p className="text-body text-textSecondary py-8 text-center">Loading…</p>}
        {!loading && pending.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-body text-textSecondary">No new submissions right now.</p>
          </div>
        )}
        {pending.map((p) => (
          <PendingCard
            key={p.id}
            submission={p}
            welcomers={welcomers}
            claiming={claimingId === p.id}
            onClaim={claim}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </div>
  );
}

function PendingCard({
  submission,
  welcomers,
  claiming,
  onClaim,
  onDismiss,
}: {
  submission: PendingVisitor;
  welcomers: { id: string; name: string }[];
  claiming: boolean;
  onClaim: (s: PendingVisitor, age: AgeCategory, welcomerId: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [ageCategory, setAgeCategory] = useState<AgeCategory>("Over 30");
  const [welcomerId, setWelcomerId] = useState("");
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h4 className="text-textPrimary">{submission.name}</h4>
          <p className="text-small text-textSecondary mt-0.5">
            Submitted {format(new Date(submission.submitted_at), "d MMM, h:mm a")} ·{" "}
            {submission.service}
          </p>
        </div>
        <span className="tag bg-accent/15 text-accent shrink-0">New</span>
      </div>

      {(submission.email || submission.phone_number) && (
        <div className="flex flex-col gap-1 mb-2">
          {submission.email && (
            <span className="flex items-center gap-2 text-body text-textSecondary">
              <Mail className="w-3.5 h-3.5" /> {submission.email}
            </span>
          )}
          {submission.phone_number && (
            <span className="flex items-center gap-2 text-body text-textSecondary">
              <Phone className="w-3.5 h-3.5" /> {submission.phone_number}
            </span>
          )}
        </div>
      )}

      <p className="text-body text-textSecondary mb-3">
        {submission.reason_for_attendance}
        {submission.message ? ` — "${submission.message}"` : ""}
      </p>

      {expanded ? (
        <div className="space-y-3 border-t border-border pt-3">
          <div>
            <label className="label-field">Age category</label>
            <select
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
            <label className="label-field">Assign welcomer</label>
            <select
              className="input-field"
              value={welcomerId}
              onChange={(e) => setWelcomerId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {welcomers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <button
              className="btn-secondary flex-1"
              onClick={() => onDismiss(submission.id)}
              disabled={claiming}
            >
              Dismiss
            </button>
            <button
              className="btn-primary flex-1"
              onClick={() => onClaim(submission, ageCategory, welcomerId)}
              disabled={claiming}
            >
              {claiming ? "Adding…" : "Add as visitor"}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-secondary w-full" onClick={() => setExpanded(true)}>
          <UserPlus className="w-4 h-4" />
          Review & add
        </button>
      )}
    </div>
  );
}
