"use client";

import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import type { SortOrder } from "@/lib/hooks/useVisitors";

interface SortToggleProps {
  sortOrder: SortOrder;
  onChange: (order: SortOrder) => void;
}

export function SortToggle({ sortOrder, onChange }: SortToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(sortOrder === "newest" ? "oldest" : "newest")}
      className="flex items-center gap-1.5 h-11 px-3 rounded-input border border-border bg-surface text-body text-textSecondary shrink-0"
    >
      {sortOrder === "newest" ? (
        <ArrowDownWideNarrow className="w-4 h-4" />
      ) : (
        <ArrowUpNarrowWide className="w-4 h-4" />
      )}
      {sortOrder === "newest" ? "Newest first" : "Oldest first"}
    </button>
  );
}