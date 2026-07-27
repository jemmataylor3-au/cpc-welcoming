"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppData } from "@/lib/hooks/useAppData";
import type { Visitor, ArchiveReasonCategory, ChurchService } from "@/types/database";

export function useBulkActions(visitors: Visitor[], onDone: () => void) {
  const supabase = createClient();
  const { profile } = useAppData();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);

  const selected = visitors.filter((v) => selectedIds.has(v.id));

  // If every selected visitor is from the same service, we can filter the
  // welcomer dropdown to that service. Otherwise show all welcomers.
  const services = new Set(selected.map((v) => v.service));
  const commonService: ChurchService | null =
    services.size === 1 ? (Array.from(services)[0] as ChurchService) : null;

  async function logBulk(action: string, detail: string) {
    const rows = selected.map((v) => ({
      visitor_id: v.id,
      actor_id: profile?.id ?? null,
      action,
      detail,
    }));
    if (rows.length > 0) {
      await supabase.from("visitor_activity_log").insert(rows);
    }
  }

  // Appends to extra_notes rather than overwriting, so a bulk comment
  // never destroys an existing individual note.
  const bulkComment = useCallback(
    async (note: string) => {
      setSaving(true);
      setError(null);
      try {
        for (const v of selected) {
          const existing = v.extra_notes?.trim();
          const combined = existing ? `${existing}\n${note}` : note;
          const { error: updateError } = await supabase
            .from("visitors")
            .update({ extra_notes: combined })
            .eq("id", v.id);
          if (updateError) throw updateError;
        }
        await logBulk("bulk_comment", note);
        clearSelection();
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add notes.");
      } finally {
        setSaving(false);
      }
    },
    [selected, supabase, clearSelection, onDone]
  );

  const bulkArchive = useCallback(
    async (category: ArchiveReasonCategory, reasonText: string) => {
      setSaving(true);
      setError(null);
      try {
        const finalReason = category === "Other" ? reasonText : category;
        const ids = selected.map((v) => v.id);
        const { error: updateError } = await supabase
          .from("visitors")
          .update({
            status: "Archived",
            archive_reason_category: category,
            archive_reason: finalReason,
            archived_at: new Date().toISOString(),
          })
          .in("id", ids);
        if (updateError) throw updateError;
        await logBulk("archived", finalReason);
        clearSelection();
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to archive.");
      } finally {
        setSaving(false);
      }
    },
    [selected, supabase, clearSelection, onDone]
  );

  const bulkReassign = useCallback(
    async (welcomerId: string | null) => {
      setSaving(true);
      setError(null);
      try {
        const ids = selected.map((v) => v.id);
        const { error: updateError } = await supabase
          .from("visitors")
          .update({ welcomer_id: welcomerId, welcomer_other: null })
          .in("id", ids);
        if (updateError) throw updateError;
        await logBulk("welcomer_reassigned", welcomerId ? "Reassigned" : "Unassigned");
        clearSelection();
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reassign.");
      } finally {
        setSaving(false);
      }
    },
    [selected, supabase, clearSelection, onDone]
  );

  return {
    selectionMode,
    setSelectionMode,
    selectedIds,
    toggleSelected,
    clearSelection,
    selectedCount: selectedIds.size,
    commonService,
    saving,
    error,
    bulkComment,
    bulkArchive,
    bulkReassign,
  };
}
