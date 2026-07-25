"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { VisitorCard } from "@/components/VisitorCard";
import { SearchBar } from "@/components/SearchBar";
import { useVisitors } from "@/lib/hooks/useVisitors";
import { useAppData } from "@/lib/hooks/useAppData";

export default function ActiveVisitorsPage() {
  const { visitors, loading, error } = useVisitors("Active");
  const { welcomers } = useAppData();
  const [search, setSearch] = useState("");

  const welcomerById = Object.fromEntries(welcomers.map((w) => [w.id, w]));

  const filtered = useMemo(() => {
    if (!search.trim()) return visitors;
    const q = search.trim().toLowerCase();
    return visitors.filter((v) => v.name.toLowerCase().includes(q));
  }, [visitors, search]);

  return (
    <div className="pb-24">
      <PageHeader title="Active visitors" subtitle="Weeks 1–3, tracking attendance" />

      <div className="max-w-2xl mx-auto px-5 -mt-3">
        <SearchBar value={search} onChange={setSearch} />

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
            />
          ))}
        </div>
      </div>
    </div>
  );
}
