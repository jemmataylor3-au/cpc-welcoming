"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { VisitorCard } from "@/components/VisitorCard";
import { SearchBar } from "@/components/SearchBar";
import { SortToggle } from "@/components/SortToggle";
import { ServiceFilter } from "@/components/ServiceFilter";
import type { ChurchService } from "@/types/database";
import { useVisitors } from "@/lib/hooks/useVisitors";
import { useAppData } from "@/lib/hooks/useAppData";

export default function ActiveVisitorsPage() {
  const { visitors, loading, error, sortOrder, setSortOrder } = useVisitors("Active");
  const { welcomers, profiles } = useAppData();
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ChurchService | "All">("All");

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
    <div className="pb-24">
      <PageHeader title="Active visitors" subtitle="Weeks 1–3, tracking attendance" />

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

        <div className="space-y-3">
          {loading && <p className="text-body text-textSecondary py-8 text-center">Loading…</p>}
          {error && <p className="text-body text-error py-4">{error}</p>}
          {!loading && filtered.length === 0 && (
            <div className="card p-8 text-center">
              <p className="text-body text-textSecondary">
                {search
                  ? "No active visitors match that search."
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
            />
          ))}
        </div>
      </div>
    </div>
  );
}
