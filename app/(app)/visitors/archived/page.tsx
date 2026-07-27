"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { SortToggle } from "@/components/SortToggle";
import { ServiceFilter } from "@/components/ServiceFilter";
import { useVisitors } from "@/lib/hooks/useVisitors";
import { format } from "date-fns";
import { ARCHIVE_REASON_OPTIONS, type ChurchService, type ArchiveReasonCategory } from "@/types/database";

const REASON_COLORS: Record<string, string> = {
  "Moved away": "#C8755B",
  "Joined another local church": "#A7B5A0",
  "No longer responsive": "#66727A",
  "Committed to another church": "#172B3A",
  Other: "#C28A45",
};

export default function ArchivedVisitorsPage() {
  const { visitors, loading, error, sortOrder, setSortOrder } = useVisitors("Archived");
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ChurchService | "All">("All");
  const [reasonFilter, setReasonFilter] = useState<ArchiveReasonCategory | "All">("All");

  const serviceScoped = useMemo(
    () =>
      serviceFilter === "All"
        ? visitors
        : visitors.filter((v) => v.service === serviceFilter),
    [visitors, serviceFilter]
  );

  // Insight counts are based on the service scope, but ignore the reason
  // filter — otherwise clicking a reason would make its own chart useless.
  const reasonCounts = useMemo(() => {
    const counts = ARCHIVE_REASON_OPTIONS.map((r) => ({
      reason: r,
      count: serviceScoped.filter((v) => v.archive_reason_category === r).length,
    }));
    const uncategorised = serviceScoped.filter((v) => !v.archive_reason_category).length;
    if (uncategorised > 0) {
      counts.push({ reason: "Not categorised" as ArchiveReasonCategory, count: uncategorised });
    }
    return counts.filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
  }, [serviceScoped]);

  const topReason = reasonCounts[0];

  const filtered = useMemo(() => {
    let result = serviceScoped;
    if (reasonFilter !== "All") {
      result =
        reasonFilter === ("Not categorised" as ArchiveReasonCategory)
          ? result.filter((v) => !v.archive_reason_category)
          : result.filter((v) => v.archive_reason_category === reasonFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((v) => v.name.toLowerCase().includes(q));
    }
    return result;
  }, [serviceScoped, search, reasonFilter]);

  return (
    <div className="pb-24">
      <PageHeader title="Archived" subtitle="Read-only log with archive reasons" />

      <div className="max-w-2xl mx-auto px-5 -mt-3">
        {!loading && serviceScoped.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="card p-4">
              <p className="text-caption text-textSecondary mb-1">Total archived</p>
              <p className="font-display text-h2 text-primary leading-none">
                {serviceScoped.length}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-caption text-textSecondary mb-1">Most common reason</p>
              <p className="text-body text-textPrimary font-medium leading-snug">
                {topReason ? topReason.reason : "—"}
              </p>
            </div>
          </div>
        )}

        {!loading && reasonCounts.length > 0 && (
          <div className="card p-4 mb-4">
            <h4 className="mb-3">By reason</h4>
            <div className="space-y-2.5">
              {reasonCounts.map(({ reason, count }) => {
                const pct = Math.round((count / serviceScoped.length) * 100);
                const isSelected = reasonFilter === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setReasonFilter(isSelected ? "All" : reason)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-body ${
                          isSelected ? "text-primary font-semibold" : "text-textPrimary"
                        }`}
                      >
                        {reason}
                      </span>
                      <span className="text-small text-textSecondary">
                        {count} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: REASON_COLORS[reason] ?? "#66727A",
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            {reasonFilter !== "All" && (
              <button
                type="button"
                className="text-small text-primary underline underline-offset-2 mt-3"
                onClick={() => setReasonFilter("All")}
              >
                Clear reason filter
              </button>
            )}
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

        <div className="space-y-3">
          {loading && <p className="text-body text-textSecondary py-8 text-center">Loading…</p>}
          {error && <p className="text-body text-error py-4">{error}</p>}
          {!loading && filtered.length === 0 && (
            <div className="card p-8 text-center">
              <p className="text-body text-textSecondary">
                {search || reasonFilter !== "All"
                  ? "No archived visitors match those filters."
                  : "No archived visitors."}
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
              {v.archive_reason_category && (
                <span
                  className="tag mt-2 inline-block"
                  style={{
                    backgroundColor: `${REASON_COLORS[v.archive_reason_category] ?? "#66727A"}26`,
                    color: REASON_COLORS[v.archive_reason_category] ?? "#66727A",
                  }}
                >
                  {v.archive_reason_category}
                </span>
              )}
              {v.archive_reason && v.archive_reason !== v.archive_reason_category && (
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
