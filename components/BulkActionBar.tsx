"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  ARCHIVE_REASON_OPTIONS,
  type ArchiveReasonCategory,
  type Welcomer,
  type ChurchService,
} from "@/types/database";

type BulkMode = "menu" | "comment" | "archive" | "reassign";

interface BulkActionBarProps {
  selectedCount: number;
  welcomers: Welcomer[];
  /** Service of the selected visitors, if they all share one — used to
   *  filter the welcomer list. Null when the selection spans services. */
  commonService: ChurchService | null;
  saving: boolean;
  onClear: () => void;
  onComment: (note: string) => Promise<void>;
  onArchive: (category: ArchiveReasonCategory, reasonText: string) => Promise<void>;
  onReassign: (welcomerId: string | null) => Promise<void>;
}

export function BulkActionBar({
  selectedCount,
  welcomers,
  commonService,
  saving,
  onClear,
  onComment,
  onArchive,
  onReassign,
}: BulkActionBarProps) {
  const [mode, setMode] = useState<BulkMode>("menu");
  const [note, setNote] = useState("");
  const [archiveCategory, setArchiveCategory] = useState<ArchiveReasonCategory>("Moved away");
  const [archiveReasonText, setArchiveReasonText] = useState("");
  const [welcomerId, setWelcomerId] = useState("");

  const relevantWelcomers = commonService
    ? welcomers.filter((w) => w.services?.includes(commonService))
    : welcomers;

  function reset() {
    setMode("menu");
    setNote("");
    setArchiveReasonText("");
    setWelcomerId("");
  }

  return (
    <div
      className="fixed bottom-[64px] left-0 right-0 z-30 px-5 pb-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-2xl mx-auto card p-4 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <span className="text-h4 text-textPrimary">
            {selectedCount} selected
          </span>
          <button
            type="button"
            onClick={() => {
              reset();
              onClear();
            }}
            className="w-9 h-9 flex items-center justify-center text-textSecondary"
            aria-label="Clear selection"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {mode === "menu" && (
          <div className="flex gap-2">
            <button className="btn-secondary flex-1 px-2" onClick={() => setMode("comment")}>
              Comment
            </button>
            <button className="btn-secondary flex-1 px-2" onClick={() => setMode("reassign")}>
              Reassign
            </button>
            <button className="btn-secondary flex-1 px-2" onClick={() => setMode("archive")}>
              Archive
            </button>
          </div>
        )}

        {mode === "comment" && (
          <div>
            <label className="label-field">Add this note to all selected</label>
            <textarea
              className="input-field h-20 py-2.5 mb-3"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Came together as a couple, chatted after church…"
            />
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={reset} disabled={saving}>
                Back
              </button>
              <button
                className="btn-primary flex-1"
                disabled={saving || !note.trim()}
                onClick={async () => {
                  await onComment(note.trim());
                  reset();
                }}
              >
                {saving ? "Saving…" : "Add note"}
              </button>
            </div>
          </div>
        )}

        {mode === "reassign" && (
          <div>
            <label className="label-field">Assign all selected to</label>
            <select
              className="input-field mb-3"
              value={welcomerId}
              onChange={(e) => setWelcomerId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {relevantWelcomers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            {!commonService && (
              <p className="text-small text-textSecondary mb-3">
                Selection spans multiple services, so all welcomers are listed.
              </p>
            )}
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={reset} disabled={saving}>
                Back
              </button>
              <button
                className="btn-primary flex-1"
                disabled={saving}
                onClick={async () => {
                  await onReassign(welcomerId || null);
                  reset();
                }}
              >
                {saving ? "Saving…" : "Reassign"}
              </button>
            </div>
          </div>
        )}

        {mode === "archive" && (
          <div>
            <label className="label-field">Archive reason</label>
            <select
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
              <button className="btn-secondary flex-1" onClick={reset} disabled={saving}>
                Back
              </button>
              <button
                className="btn-danger flex-1"
                disabled={saving || (archiveCategory === "Other" && !archiveReasonText.trim())}
                onClick={async () => {
                  await onArchive(archiveCategory, archiveReasonText.trim());
                  reset();
                }}
              >
                {saving ? "Saving…" : `Archive ${selectedCount}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
