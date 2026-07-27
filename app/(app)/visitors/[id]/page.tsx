"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAppData } from "@/lib/hooks/useAppData";
import { PageHeader } from "@/components/PageHeader";
import { StatusTag, AgeTag, WelcomerTag } from "@/components/Tag";
import { WelcomerSelect } from "@/components/WelcomerSelect";
import { ChevronLeft, Check, Mail, Phone, Archive, History, CheckCircle2, AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import type {
  Visitor,
  BibleStudyStatus,
  ReasonForAttendance,
  AgeCategory,
  ChurchService,
  ActivityLogEntry,
  ArchiveReasonCategory,
  VisitPeriod,
} from "@/types/database";
import {
  REASON_OPTIONS,
  AGE_CATEGORY_OPTIONS,
  SERVICE_OPTIONS,
  BIBLE_STUDY_STATUS_OPTIONS,
  ARCHIVE_REASON_OPTIONS,
} from "@/types/database";

export default function VisitorDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { profile, welcomers, bibleStudyGroups, profiles, settings } = useAppData();

  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchiveForm, setShowArchiveForm] = useState(false);
  const [archiveCategory, setArchiveCategory] = useState<ArchiveReasonCategory>("Moved away");
  const [archiveReasonText, setArchiveReasonText] = useState("");
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const [visitPeriods, setVisitPeriods] = useState<VisitPeriod[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const loadVisitPeriods = useCallback(async () => {
    const { data } = await supabase
      .from("visit_periods")
      .select("*")
      .eq("visitor_id", params.id)
      .order("period_number", { ascending: false });
    setVisitPeriods((data as VisitPeriod[]) ?? []);
  }, [supabase, params.id]);

  useEffect(() => {
    load();
    loadActivityLog();
    loadVisitPeriods();
  }, [load, loadActivityLog, loadVisitPeriods]);

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

  // Saving a note in an empty week box now also marks that week attended
  // and stamps today's date — the note itself is evidence contact
  // happened, and weeks don't always land exactly 7 days apart. Existing
  // dates are never overwritten by this, only filled in the first time.
  async function updateWeekNotes(week: 1 | 2 | 3, notes: string) {
    if (!visitor) return;
    const notesField = `week${week}_notes` as const;
    const authorField = `week${week}_notes_by` as const;
    const dateField = `week${week}_date` as const;
    const attendedField = `week${week}_attended` as const;

    const updates: Partial<Visitor> = {
      [notesField]: notes || null,
      [authorField]: notes.trim() ? profile?.id ?? null : null,
    };

    if (notes.trim() && !visitor[dateField]) {
      (updates as Record<string, unknown>)[dateField] = new Date().toISOString().slice(0, 10);
      (updates as Record<string, unknown>)[attendedField] = true;
    }

    await updateField(updates);
    loadActivityLog();
  }

  async function confirmSettled() {
    await updateField({
      status: "Settled",
      settled_prompt_seen: true,
      settled_at: new Date().toISOString(),
    });
    await supabase.from("visitor_activity_log").insert({
      visitor_id: visitor!.id,
      actor_id: profile?.id ?? null,
      action: "status_changed",
      detail: "Confirmed Settled after completing 3 weeks",
    });
    await loadActivityLog();
  }

  async function dismissSettledPrompt() {
    await updateField({ settled_prompt_seen: true });
  }

  async function dismissArchivePrompt() {
    await updateField({ archive_prompt_dismissed_at: new Date().toISOString() });
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
    if (!visitor) return;
    if (archiveCategory === "Other" && !archiveReasonText.trim()) {
      setError("Please provide a reason.");
      return;
    }
    const finalReason = archiveCategory === "Other" ? archiveReasonText.trim() : archiveCategory;
    await updateField({
      status: "Archived",
      archive_reason: finalReason,
      archive_reason_category: archiveCategory,
      archived_at: new Date().toISOString(),
    });
    await supabase.from("visitor_activity_log").insert({
      visitor_id: visitor.id,
      actor_id: profile?.id ?? null,
      action: "archived",
      detail: finalReason,
    });
    await loadActivityLog();
    setShowArchiveForm(false);
  }

  async function startNewVisitPeriod() {
    if (!visitor) return;
    setSaving(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("start_new_visit_period", {
      p_visitor_id: visitor.id,
      p_actor_id: profile?.id ?? null,
    });
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setVisitor(data as Visitor);
      await loadVisitPeriods();
      await loadActivityLog();
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!visitor) return;
    setSaving(true);
    setError(null);
    const { error: deleteError } = await supabase.from("visitors").delete().eq("id", visitor.id);
    if (deleteError) {
      setError(
        deleteError.message.includes("policy")
          ? "Only admins can permanently delete a visitor."
          : deleteError.message
      );
      setSaving(false);
      return;
    }
    router.push("/visitors/active");
  }

  async function handleUnarchive() {
    if (!visitor) return;
    await updateField({
      status: "Settled",
      archive_reason: null,
      archive_reason_category: null,
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

  const showSettledPrompt =
    visitor.status === "Active" &&
    visitor.week1_attended &&
    visitor.week2_attended &&
    visitor.week3_attended &&
    !visitor.settled_prompt_seen;

  const nudgeWeeks = parseInt(settings.welcomer_nudge_weeks ?? "4", 10) || 4;
  const mostRecentDate = [visitor.week3_date, visitor.week2_date, visitor.week1_date, visitor.date_first_attended]
    .filter(Boolean)
    .sort()
    .pop();
  const daysSinceLastAttendance = mostRecentDate
    ? differenceInCalendarDays(new Date(), new Date(mostRecentDate))
    : 0;
  const dismissedRecently =
    visitor.archive_prompt_dismissed_at &&
    differenceInCalendarDays(new Date(), new Date(visitor.archive_prompt_dismissed_at)) < 7;
  const showArchivePrompt =
    (visitor.status === "Active" || visitor.status === "Settled") &&
    daysSinceLastAttendance >= nudgeWeeks * 7 &&
    !dismissedRecently;

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

        {showSettledPrompt && (
          <div className="card p-4 border-success/40 bg-success/5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              <h4>Completed 3 weeks</h4>
            </div>
            <p className="text-body text-textSecondary mb-3">
              {visitor.name} has attended all 3 weeks. Mark them as Settled?
            </p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={dismissSettledPrompt} disabled={saving}>
                Not yet
              </button>
              <button className="btn-primary flex-1" onClick={confirmSettled} disabled={saving}>
                Mark as Settled
              </button>
            </div>
          </div>
        )}

        {showArchivePrompt && !showArchiveForm && (
          <div className="card p-4 border-accent/40 bg-accent/5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-accent shrink-0" />
              <h4>Hasn't attended in a while</h4>
            </div>
            <p className="text-body text-textSecondary mb-3">
              It's been {nudgeWeeks}+ weeks since {visitor.name} last attended. Archive them?
            </p>
            <label className="label-field" htmlFor="promptArchiveCategory">
              Reason
            </label>
            <select
              id="promptArchiveCategory"
              className="input-field mb-3"
              value={archiveCategory}
              onChange={(e) => setArchiveCategory(e.target.value as ArchiveReasonCategory)}
            >
              {ARCHIVE_REASON_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {archiveCategory === "Other" && (
              <textarea
                className="input-field h-20 py-2.5 mb-3"
                value={archiveReasonText}
                onChange={(e) => setArchiveReasonText(e.target.value)}
                placeholder="Please specify…"
              />
            )}
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={dismissArchivePrompt} disabled={saving}>
                Not yet
              </button>
              <button className="btn-accent flex-1" onClick={handleArchive} disabled={saving}>
                Archive
              </button>
            </div>
          </div>
        )}

        {/* Contact info */}
        {(visitor.email || visitor.phone_number) && (
          <div className="card p-4 flex flex-col gap-2">
            {visitor.email && (
              <a href={`mailto:${visitor.email}`} className="flex items-center gap-2 text-body text-primary">
                <Mail className="w-4 h-4" /> {visitor.email}
              </a>
            )}
            {visitor.phone_number && (
              <a href={`tel:${visitor.phone_number}`} className="flex items-center gap-2 text-body text-primary">
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
              <label className="label-field">Assigned welcomer</label>
              <WelcomerSelect
                welcomers={welcomers}
                service={visitor.service}
                welcomerId={visitor.welcomer_id}
                welcomerOther={visitor.welcomer_other}
                disabled={saving}
                onChange={(welcomerId, welcomerOther) =>
                  updateField({ welcomer_id: welcomerId, welcomer_other: welcomerOther })
                }
              />
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
            {visitor.archive_reason_category && (
              <p className="text-body text-textPrimary font-medium mb-1">
                {visitor.archive_reason_category}
              </p>
            )}
            <p className="text-body text-textPrimary mb-4">{visitor.archive_reason}</p>
            <button className="btn-secondary w-full" onClick={handleUnarchive}>
              Restore to Settled
            </button>
          </div>
        ) : showArchiveForm ? (
          <div className="card p-4">
            <h4 className="mb-3">Archive this visitor</h4>
            <label className="label-field" htmlFor="archiveCategory">
              Reason
            </label>
            <select
              id="archiveCategory"
              className="input-field mb-3"
              value={archiveCategory}
              onChange={(e) => setArchiveCategory(e.target.value as ArchiveReasonCategory)}
            >
              {ARCHIVE_REASON_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {archiveCategory === "Other" && (
              <textarea
                className="input-field h-24 py-3 mb-3"
                value={archiveReasonText}
                onChange={(e) => setArchiveReasonText(e.target.value)}
                placeholder="Please specify…"
              />
            )}
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

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw className="w-4 h-4 text-textSecondary" />
            <h4>Visit periods</h4>
          </div>
          <p className="text-body text-textSecondary mb-3">
            If {visitor.name} stopped coming and has now returned, start a new
            period. Their current weeks are saved to history below and the
            3-week count restarts from today.
          </p>
          <button
            className="btn-secondary w-full"
            onClick={startNewVisitPeriod}
            disabled={saving}
          >
            Start a new visit period
          </button>

          {visitPeriods.length > 0 && (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              {visitPeriods.map((p) => (
                <div key={p.id} className="border-l-2 border-border pl-3">
                  <p className="text-h4 text-textPrimary">
                    Period {p.period_number}
                    {p.started_on && (
                      <span className="text-small text-textSecondary font-normal">
                        {" "}
                        · from {format(new Date(p.started_on), "d MMM yyyy")}
                      </span>
                    )}
                  </p>
                  <p className="text-small text-textSecondary mb-1">
                    {[p.week1_attended, p.week2_attended, p.week3_attended].filter(Boolean).length}{" "}
                    of 3 weeks attended
                  </p>
                  {[p.week1_notes, p.week2_notes, p.week3_notes]
                    .filter(Boolean)
                    .map((note, i) => (
                      <p key={i} className="text-body text-textSecondary">
                        {note}
                      </p>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {confirmDelete ? (
          <div className="card p-4 border-error/40 bg-error/5">
            <h4 className="mb-2">Delete permanently?</h4>
            <p className="text-body text-textSecondary mb-3">
              This removes {visitor.name} and all their notes and history for
              good. It can't be undone — use Archive instead if you just want
              them out of the active list.
            </p>
            <div className="flex gap-3">
              <button
                className="btn-secondary flex-1"
                onClick={() => setConfirmDelete(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button className="btn-danger flex-1" onClick={handleDelete} disabled={saving}>
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="w-full flex items-center justify-center gap-2 h-12 text-body text-error"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="w-4 h-4" />
            Delete permanently
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
    status_changed: "Status changed",
    bulk_comment: "Note added (bulk)",
    welcomer_reassigned: "Welcomer reassigned (bulk)",
    new_visit_period: "New visit period started",
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
            className={`w-9 h-9 rounded-sm border-2 flex items-center justify-center shrink-0 transition-colors ${
              attended ? "bg-success border-success" : "bg-surface border-textSecondary"
            }`}
            aria-label={`Mark week ${weekNum} ${attended ? "not attended" : "attended"}`}
          >
            {attended && <Check className="w-6 h-6 text-white" strokeWidth={3} />}
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
