"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { SortToggle } from "@/components/SortToggle";
import { useVisitors } from "@/lib/hooks/useVisitors";
import { format } from "date-fns";

export default function ArchivedVisitorsPage() {
  const { visitors, loading, error, sortOrder, setSortOrder } = useVisitors("Archived");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return visitors;
    const q = search.trim().toLowerCase();
    return visitors.filter((v) => v.name.toLowerCase().includes(q));
  }, [visitors, search]);

  return (
    <div className="pb-24">
      <PageHeader title="Archived" subtitle="Read-only log with archive reasons" />

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
                {search ? "No archived visitors match that search." : "No archived visitors."}
              </p>
            </div>
          )}
          {filtered.map((v) => (
            <Link key={v.id} href={`/visitors/${v.id}`} className="card p-4 block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-textPrimary">{v.name}</h4>
                  <p className="text-small text-textSecondary mt-0.5">
                    First attended {format(new Date(v.date_first_attended), "d MMM yyyy")}
                  </p>
                </div>
                {v.archived_at && (
                  <span className="text-caption text-textSecondary whitespace-nowrap">
                    Archived {format(new Date(v.archived_at), "d MMM yyyy")}
                  </span>
                )}
              </div>
              {v.archive_reason && (
                <p className="text-body text-textSecondary mt-2 border-t border-border pt-2">
                  {v.archive_reason}
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}