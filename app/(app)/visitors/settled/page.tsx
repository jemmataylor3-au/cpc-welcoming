"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { VisitorCard } from "@/components/VisitorCard";
import { SearchBar } from "@/components/SearchBar";
import { SortToggle } from "@/components/SortToggle";
import { ServiceFilter } from "@/components/ServiceFilter";
import { BulkActionBar } from "@/components/BulkActionBar";
import { useVisitors } from "@/lib/hooks/useVisitors";
import { useAppData } from "@/lib/hooks/useAppData";
import { useBulkActions } from "@/lib/hooks/useBulkActions";
import type { ChurchService } from "@/types/database";

export default function SettledVisitorsPage() {
  const { visitors, loading, error, sortOrder, setSortOrder, refresh } = useVisitors("Settled");
  const { welcomers, profiles } = useAppData();
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ChurchService | "All">("All");

  const bulk = useBulkActions(visitors, refresh);

  const welcomerById = Object.fromEntries(welcomers.map((w) => [w.id, w]));
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const filtered = useMemo(() => {
    let result = visitors;
    if (serviceFilter !== "All") {
      result = result.filter((v) => v.service === serviceFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((v) => v.name.toLowerCase().includes(q));
    }
    return result;
  }, [visitors, search, serviceFilter]);

  return (
    <div className={bulk.selectedCount > 0 ? "pb-56" : "pb-24"}>
      <PageHeader
        title="Settled visitors"
        subtitle="Completed 3 weeks — Bible study & follow-up"
        action={
          <button
            type="button"
            onClick={() =>
              bulk.selectionMode ? bulk.clearSelection() : bulk.setSelectionMode(true)
            }
            className="h-11 px-3 rounded-button bg-white/10 text-secondary text-body shrink-0"
          >
            {bulk.selectionMode ? "Cancel" : "Select"}
          </button>
        }
      />

      <div className="max-w-2xl mx-auto px-5 -mt-3">
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <SearchBar value={search} onChange={setSearch} />
          </div>
          <SortToggle sortOrder={sortOrder} onChange={setSortOrder} />
        </div>
        <div className="mb-4">
          <ServiceFilter value={serviceFilter} onChange={setServiceFilter} />
        </div>

        {bulk.error && (
          <p className="text-body text-error bg-error/10 rounded-input px-3 py-2 mb-3">
            {bulk.error}
          </p>
        )}

        <div className="space-y-3">
          {loading && <p className="text-body text-textSecondary py-8 text-center">Loading…</p>}
          {error && <p className="text-body text-error py-4">{error}</p>}
          {!loading && filtered.length === 0 && (
            <div className="card p-8 text-center">
              <p className="text-body text-textSecondary">
                {search || serviceFilter !== "All"
                  ? "No settled visitors match those filters."
                  : "No one has settled in yet — visitors move here once confirmed after 3 attended weeks."}
              </p>
            </div>
          )}
          {filtered.map((v) => (
            <VisitorCard
              key={v.id}
              visitor={v}
              welcomer={v.welcomer_id ? welcomerById[v.welcomer_id] : null}
              profileById={profileById}
              selectionMode={bulk.selectionMode}
              selected={bulk.selectedIds.has(v.id)}
              onToggleSelect={bulk.toggleSelected}
            />
          ))}
        </div>
      </div>

      {bulk.selectedCount > 0 && (
        <BulkActionBar
          selectedCount={bulk.selectedCount}
          welcomers={welcomers}
          commonService={bulk.commonService}
          saving={bulk.saving}
          onClear={bulk.clearSelection}
          onComment={bulk.bulkComment}
          onArchive={bulk.bulkArchive}
          onReassign={bulk.bulkReassign}
        />
      )}
    </div>
  );
}
