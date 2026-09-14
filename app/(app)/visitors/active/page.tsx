"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { VisitorCard } from "@/components/VisitorCard";
import { SearchBar } from "@/components/SearchBar";
import { SortToggle } from "@/components/SortToggle";
import { ServiceFilter } from "@/components/ServiceFilter";
import { BulkActionBar } from "@/components/BulkActionBar";
import { useVisitors } from "@/lib/hooks/useVisitors";
import { useAppData } from "@/lib/hooks/useAppData";
import { useBulkActions } from "@/lib/hooks/useBulkActions";
import { createClient } from "@/lib/supabase/client";
import type { ChurchService, Visitor } from "@/types/database";

export default function ActiveVisitorsPage() {
  const { visitors, loading, error, sortOrder, setSortOrder, refresh } = useVisitors("Active");
  const { welcomers, profiles } = useAppData();
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ChurchService | "All">("All");

  // "Just visiting" people skip Active entirely and go straight to
  // Archived — useful, but easy to miss since nobody checks Archived by
  // default. Surface anyone archived that way in the last 7 days here.
  const [justVisiting, setJustVisiting] = useState<Visitor[]>([]);
  useEffect(() => {
    const supabase = createClient();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("visitors")
      .select("*")
      .eq("archive_reason", "Just visiting")
      .gte("archived_at", weekAgo)
      .order("archived_at", { ascending: false })
      .then(({ data }) => setJustVisiting((data as Visitor[]) ?? []));
  }, []);

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
        title="Active visitors"
        subtitle="Weeks 1–3, tracking attendance"
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
        {justVisiting.length > 0 && (
          <div className="card p-4 mb-4 border-accent/40 bg-accent/5">
            <h4 className="mb-2">
              {justVisiting.length === 1 ? "1 person was" : `${justVisiting.length} people were`}{" "}
              just visiting
            </h4>
            <div className="space-y-1.5">
              {justVisiting.map((v) => (
                <Link
                  key={v.id}
                  href={`/visitors/${v.id}`}
                  className="flex items-center justify-between text-body text-textPrimary"
                >
                  <span>{v.name}</span>
                  <span className="text-small text-textSecondary">
                    {v.archived_at ? format(new Date(v.archived_at), "d MMM") : ""}
                  </span>
                </Link>
              ))}
            </div>
            <p className="text-small text-textSecondary mt-2">
              Saved straight to Archived rather than tracked here — tap a
              name to view.
            </p>
          </div>
        )}

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
                  ? "No active visitors match those filters."
                  : "No active visitors right now. Add one from the dashboard."}
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