"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAppData } from "@/lib/hooks/useAppData";
import { PageHeader } from "@/components/PageHeader";
import { StatusTag, AgeTag, WelcomerTag } from "@/components/Tag";
import { ChevronLeft, Check, Mail, Phone, Archive, History } from "lucide-react";
import { format } from "date-fns";
import type {
  Visitor,
  BibleStudyStatus,
  ReasonForAttendance,
  AgeCategory,
  ChurchService,
  ActivityLogEntry,
} from "@/types/database";
import {
  REASON_OPTIONS,
  AGE_CATEGORY_OPTIONS,
  SERVICE_OPTIONS,
  BIBLE_STUDY_STATUS_OPTIONS,
} from "@/types/database";

export default function VisitorDetailPage() {
  const params = useParams<{ id: string }>();
  const supabase = createClient();
  const { profile, welcomers, bibleStudyGroups, profiles } = useAppData();

  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchiveForm, setShowArchiveForm] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("visitors")
      .select("*")
      .eq("id", params.id)
      .single();
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setVisitor(data as Visitor);
    }
    setLoading(false);
  }, [supabase, params.id]);

  const loadActivityLog = useCallback(async () => {
    const { data } = await supabase
      .from("visitor_activity_log")
      .select("*")
      .eq("visitor_id", params.id)
      .order("created_at", { ascending: false });

    const entries = (data as ActivityLogEntry[]) ?? [];
    setActivityLog(entries);

    const actorIds = [...new Set(entries.map((e) => e.actor_id).filter(Boolean))] as string[];
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);
      const names: Record<string, string> = {};
      (profiles ?? []).forEach((p) => {
        names[p.id] = p.full_name;
      });
      setActorNames(names);
    }
  }, [supabase, params.id]);

  useEffect(() => {
    load();
    loadActivityLog();
  }, [load, loadActivityLog]);

  async function updateField(fields: Partial<Visitor>) {
    if (!visitor) return;
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("visitors")
      .update(fields)
      .eq("id", visitor.id)
      .select()
      .single();
    if (updateError) {
      setError(updateError.message);
    } else {
      setVisitor(data as Visitor);
    }
    setSaving(false);
  }

  async function markWeek(week: 1 | 2 | 3, attended: boolean) {
    if (!visitor) return;
    setSaving(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("mark_week_attended", {
      p_visitor_id: visitor.id,
      p_week: week,
      p_attended: attended,
      p_actor_id: profile?.id ?? null,
    });
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setVisitor(data as Visitor);
      loadActivityLog();
    }
    setSaving(false);
  }

  async function updateWeekNotes(week: 1 | 2 | 3, notes: string) {
    const notesField = `week${week}_notes` as const;
    const authorField = `week${week}_notes_by` as const;
    await updateField({
      [notesField]: notes || null,
      [authorField]: notes.trim() ? profile?.id ?? null : null,
    });
  }

  async function handleBibleStudyOutcome(
    outcome: BibleStudyStatus,
    groupId: string | null
  ) {
    if (!visitor) return;
    setSaving(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/set-bible-study-outcome`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            visitorId: visitor.id,
            outcome,
            bibleStudyGroupId: groupId,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update Bible study status");
      setVisitor(json.visitor as Visitor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!visitor || !archiveReason.trim()) {
      setError("Please provide an archive reason.");
      return;
    }
    await updateField({
      status: "Archived",
      archive_reason: archiveReason.trim(),
      archived_at: new Date().toISOString(),
    });
    await supabase.from("visitor_activity_log").insert({
      visitor_id: visitor.id,
      actor_id: profile?.id ?? null,
      action: "archived",
      detail: archiveReason.trim(),
    });
    await loadActivityLog();
    setShowArchiveForm(false);
  }

  async function handleUnarchive() {
    if (!visitor) return;
    await updateField({
      status: "Settled",
      archive_reason: null,
      archived_at: null,
    });
    await supabase.from("visitor_activity_log").insert({
      visitor_id: visitor.id,
      actor_id: profile?.id ?? null,
      action: "restored",
      detail: "Restored from Archived to Settled",
    });
    await loadActivityLog();
  }

  if (loading) {
    return (
      <div className="pb-24 pt-12 text-center text-body text-textSecondary">
        Loading…
      </div>
    );
  }

  if (!visitor) {
    return (
      <div className="pb-24 pt-12 text-center text-body text-error">
        {error ?? "Visitor not found."}
      </div>
    );
  }

  const assignedWelcomer = welcomers.find((w) => w.id === visitor.welcomer_id);

  return (
    <div className="pb-24">
      <PageHeader
        title={visitor.name}
        subtitle={`First attended ${format(
          new Date(visitor.date_first_attended),
          "d MMM yyyy"
        )}`}
        action={
          <Link
            href="/"
            className="w-11 h-11 rounded-button bg-white/10 flex items-center justify-center shrink-0"
          >
            <ChevronLeft className="w-5 h-5 text-secondary" />
          </Link>
        }
      />

      <div className="max-w-2xl mx-auto px-5 -mt-3 space-y-4">
        <div className="flex flex-wrap gap-2">
          <StatusTag status={visitor.status} />
          <AgeTag category={visitor.age_category} />
          <span className="tag bg-secondary text-primary">{visitor.service}</span>
          {visitor.is_returning && (
            <span className="tag bg-sage/30 text-primary">Returning</span>
          )}
          {assignedWelcomer && (
            <WelcomerTag name={assignedWelcomer.name} colorHex={assignedWelcomer.color_hex} />
          )}
        </div>

        {error && (
          <p className="text-body text-error bg-error/10 rounded-input px-3 py-2">{error}</p>
        )}

        {/* Contact info */}
        {(visitor.email || visitor.phone_number) && (
          <div className="card p-4 flex flex-col gap-2">
            {visitor.email && (
              
                href={`mailto:${visitor.email}`}
                className="flex items-center gap-2 text-body text-primary"
              >
                <Mail className="w-4 h-4" /> {visitor.email}
              </a>
            )}
            {visitor.phone_number && (
              
                href={`tel:${visitor.phone_number}`}
                className="flex items-center gap-2 text-body text-primary"
              >
                <Phone className="w-4 h-4" /> {visitor.phone_number}
              </a>
            )}
          </div>
        )}

        {/* Weekly attendance */}
        {visitor.status !== "Archived" && (
          <div className="card p-4">
            <h4 className="mb-3">Attendance</h4>
            <div className="space-y-4">
              <WeekRow
                weekNum={1}
                attended={visitor.week1_attended}
                date={visitor.week1_date}
                notes={visitor.week1_notes}
                authorName={
                  visitor.week1_notes_by
                    ? profiles.find((p) => p.id === visitor.week1_notes_by)?.full_name
                    : undefined
                }
                disabled={saving}
                onToggle={(v) => markWeek(1, v)}
                onNotesBlur={(n) => updateWeekNotes(1, n)}
              />
              <WeekRow
                weekNum={2}
                attended={visitor.week2_attended}
                date={visitor.week2_date}
                notes={visitor.week2_notes}
                authorName={
                  visitor.week2_notes_by
                    ? profiles.find((p) => p.id === visitor.week2_notes_by)?.full_name
                    : undefined
                }
                disabled={saving}
                onToggle={(v) => markWeek(2, v)}
                onNotesBlur={(n) => updateWeekNotes(2, n)}
              />
              <WeekRow
                weekNum={3}
                attended={visitor.week3_attended}
                date={visitor.week3_date}
                notes={visitor.week3_notes}
                authorName={
                  visitor.week3_notes_by
                    ? profiles.find((p) => p.id === visitor.week3_notes_by)?.full_name
                    : undefined
                }
                disabled={saving}
                onToggle={(v) => markWeek(3, v)}
                onNotesBlur={(n) => updateWeekNotes(3, n)}
              />
            </div>
          </div>
        )}

        {/* Catch-up */}
        {visitor.status !== "Archived" && (
          <div className="card p-4">
            <h4 className="mb-3">Catch-up</h4>
            <label className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                className="w-5 h-5 rounded accent-primary"
                checked={visitor.catchup_flag}
                disabled={saving}
                onChange={(e) => updateField({ catchup_flag: e.target.checked })}
              />
              <span className="text-body">Needs a catch-up</span>
            </label>
            {visitor.catchup_flag && (
              <>
                <label className="label-field" htmlFor="catchupDate">
                  Catch-up date
                </label>
                <input
                  id="catchupDate"
                  type="date"
                  className="input-field mb-3"
                  value={visitor.catchup_date ?? ""}
                  disabled={saving}
                  onChange={(e) => updateField({ catchup_date: e.target.value || null })}
                />
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded accent-primary"
                    checked={visitor.catchup_arranged}
                    disabled={saving}
                    onChange={(e) =>
                      updateField({ catchup_arranged: e.target.checked })
                    }
                  />
                  <span className="text-body">Catch-up arranged</span>
                </label>
              </>
            )}
          </div>
        )}

        {/* Bible study & Elvanto */}
        {visitor.status !== "Archived" && (
          <div className="card p-4">
            <h4 className="mb-3">Bible study & Elvanto</h4>

            <label className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                className="w-5 h-5 rounded accent-primary"
                checked={visitor.elvanto_conversation}
                disabled={saving}
                onChange={(e) =>
                  updateField({ elvanto_conversation: e.target.checked })
                }
              />
              <span className="text-body">Elvanto conversation had</span>
            </label>

            <label className="label-field" htmlFor="bibleStudyStatus">
              Bible study status
            </label>
            <select
              id="bibleStudyStatus"
              className="input-field mb-3"
              value={visitor.bible_study_status}
              disabled={saving}
              onChange={(e) =>
                handleBibleStudyOutcome(
                  e.target.value as BibleStudyStatus,
                  visitor.bible_study_group_id
                )
              }
            >
              {BIBLE_STUDY_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {visitor.bible_study_status === "Joined Bible Study" && (
              <>
                <label className="label-field" htmlFor="bibleStudyGroup">
                  Bible study group
                </label>
                <select
                  id="bibleStudyGroup"
                  className="input-field"
                  value={visitor.bible_study_group_id ?? ""}
                  disabled={saving}
                  onChange={(e) =>
                    handleBibleStudyOutcome("Joined Bible Study", e.target.value || null)
                  }
                >
                  <option value="">Select a group</option>
                  {bibleStudyGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            {visitor.bible_study_status === "Not Yet (remind in 6 weeks)" &&
              visitor.bible_study_reminder_due_at && (
                <p className="text-small text-textSecondary mt-2">
                  Next reminder:{" "}
                  {format(new Date(visitor.bible_study_reminder_due_at), "d MMM yyyy")}
                </p>
              )}
          </div>
        )}

        {/* Reason for attendance & age category (editable) */}
        {visitor.status !== "Archived" && (
          <div className="card p-4 space-y-3">
            <h4 className="mb-1">Details</h4>
            <div>
              <label className="label-field" htmlFor="dateFirstAttendedEdit">
                Date first attended
              </label>
              <input
                id="dateFirstAttendedEdit"
                type="date"
                className="input-field"
                value={visitor.date_first_attended}
                disabled={saving}
                onChange={(e) =>
                  updateField({ date_first_attended: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label-field" htmlFor="reasonEdit">
                Reason for attendance
              </label>
              <select
                id="reasonEdit"
                className="input-field"
                value={visitor.reason_for_attendance}
                disabled={saving}
                onChange={(e) =>
                  updateField({
                    reason_for_attendance: e.target.value as ReasonForAttendance,
                  })
                }
              >
                {REASON_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field" htmlFor="ageEdit">
                Age category
              </label>
              <select
                id="ageEdit"
                className="input-field"
                value={visitor.age_category}
                disabled={saving}
                onChange={(e) =>
                  updateField({ age_category: e.target.value as AgeCategory })
                }
              >
                {AGE_CATEGORY_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field" htmlFor="serviceEdit">
                Service
              </label>
              <select
                id="serviceEdit"
                className="input-field"
                value={visitor.service}
                disabled={saving}
                onChange={(e) =>
                  updateField({ service: e.target.value as ChurchService })
                }
              >
                {SERVICE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field" htmlFor="welcomerEdit">
                Assigned welcomer
              </label>
              <select
                id="welcomerEdit"
                className="input-field"
                value={visitor.welcomer_id ?? ""}
                disabled={saving}
                onChange={(e) => updateField({ welcomer_id: e.target.value || null })}
              >
                <option value="">Unassigned</option>
                {welcomers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field" htmlFor="extraNotes">
                Extra notes
              </label>
              <textarea
                id="extraNotes"
                className="input-field h-24 py-3"
                defaultValue={visitor.extra_notes ?? ""}
                disabled={saving}
                onBlur={(e) => updateField({ extra_notes: e.target.value || null })}
              />
            </div>
          </div>
        )}

        {/* Archive section */}
        {visitor.status === "Archived" ? (
          <div className="card p-4">
            <h4 className="mb-2">Archived</h4>
            <p className="text-body text-textSecondary mb-1">
              {visitor.archived_at &&
                format(new Date(visitor.archived_at), "d MMM yyyy")}
            </p>
            <p className="text-body text-textPrimary mb-4">{visitor.archive_reason}</p>
            <button className="btn-secondary w-full" onClick={handleUnarchive}>
              Restore to Settled
            </button>
          </div>
        ) : showArchiveForm ? (
          <div className="card p-4">
            <h4 className="mb-3">Archive this visitor</h4>
            <label className="label-field" htmlFor="archiveReason">
              Reason (required)
            </label>
            <textarea
              id="archiveReason"
              className="input-field h-24 py-3 mb-3"
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="e.g. Moved away, joined another church, unresponsive after 3 catch-up attempts…"
            />
            <div className="flex gap-3">
              <button
                className="btn-secondary flex-1"
                onClick={() => setShowArchiveForm(false)}
              >
                Cancel
              </button>
              <button className="btn-danger flex-1" onClick={handleArchive} disabled={saving}>
                Archive
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn-secondary w-full"
            onClick={() => setShowArchiveForm(true)}
          >
            <Archive className="w-4 h-4" />
            Archive visitor
          </button>
        )}

        {activityLog.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-textSecondary" />
              <h4>History</h4>
            </div>
            <div className="space-y-3">
              {activityLog.map((entry) => (
                <div key={entry.id} className="border-l-2 border-border pl-3">
                  <p className="text-body text-textPrimary">
                    {formatActivityAction(entry.action)}
                    {entry.detail ? ` — ${entry.detail}` : ""}
                  </p>
                  <p className="text-small text-textSecondary mt-0.5">
                    {entry.actor_id && actorNames[entry.actor_id]
                      ? actorNames[entry.actor_id]
                      : "System"}{" "}
                    · {format(new Date(entry.created_at), "d MMM yyyy, h:mm a")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatActivityAction(action: string): string {
  const labels: Record<string, string> = {
    created: "Visitor added",
    archived: "Archived",
    restored: "Restored from Archived",
    marked_week_1: "Week 1 updated",
    marked_week_2: "Week 2 updated",
    marked_week_3: "Week 3 updated",
    bible_study_outcome_set: "Bible study status changed",
  };
  return labels[action] ?? action.replace(/_/g, " ");
}

function WeekRow({
  weekNum,
  attended,
  date,
  notes,
  authorName,
  disabled,
  onToggle,
  onNotesBlur,
}: {
  weekNum: number;
  attended: boolean;
  date: string | null;
  notes: string | null;
  authorName?: string;
  disabled: boolean;
  onToggle: (attended: boolean) => void;
  onNotesBlur: (notes: string) => void;
}) {
  return (
    <div className="border-b border-border last:border-0 pb-4 last:pb-0">
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onToggle(!attended)}
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              attended ? "bg-success" : "bg-border"
            }`}
            aria-label={`Mark week ${weekNum} ${attended ? "not attended" : "attended"}`}
          >
            {attended && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
          </button>
          <span className="text-h4">Week {weekNum}</span>
        </label>
        {date && (
          <span className="text-small text-textSecondary">
            {format(new Date(date), "d MMM")}
          </span>
        )}
      </div>
      <textarea
        className="input-field h-16 py-2.5 text-body"
        defaultValue={notes ?? ""}
        disabled={disabled}
        placeholder={`Week ${weekNum} notes…`}
        onBlur={(e) => onNotesBlur(e.target.value)}
      />
      {authorName && (
        <p className="text-caption text-textSecondary mt-1">Noted by {authorName}</p>
      )}
    </div>
  );
}