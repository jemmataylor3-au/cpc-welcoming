"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { VisitorCard } from "@/components/VisitorCard";
import { SearchBar } from "@/components/SearchBar";
import { SortToggle } from "@/components/SortToggle";
import { useVisitors } from "@/lib/hooks/useVisitors";
import { useAppData } from "@/lib/hooks/useAppData";

export default function SettledVisitorsPage() {
  const { visitors, loading, error, sortOrder, setSortOrder } = useVisitors("Settled");
  const { welcomers, profiles } = useAppData();
  const [search, setSearch] = useState("");

  const welcomerById = Object.fromEntries(welcomers.map((w) => [w.id, w]));
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const filtered = useMemo(() => {
    if (!search.trim()) return visitors;
    const q = search.trim().toLowerCase();
    return visitors.filter((v) => v.name.toLowerCase().includes(q));
  }, [visitors, search]);

  return (
    <div className="pb-24">
      <PageHeader
        title="Settled visitors"
        subtitle="Completed 3 weeks — Bible study & follow-up"
      />

      <div className="max-w-2xl mx-auto px-5 -mt-3">
        <div className="flex gap-2 mb-4">
          <div className="flex-1">
            <SearchBar value={search} onChange={setSearch} />
          </div>
          <SortToggle sortOrder={sortOrder} onChange={setSortOrder} />
        </div>

        <div className="space-y-3">
          {loading && <p className="text-body text-textSecondary py-8 text-center">Loading…</p>}
          {error && <p className="text-body text-error py-4">{error}</p>}
          {!loading && filtered.length === 0 && (
            <div className="card p-8 text-center">
              <p className="text-body text-textSecondary">
                {search
                  ? "No settled visitors match that search."
                  : "No one has settled in yet — visitors move here automatically after 3 attended weeks."}
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