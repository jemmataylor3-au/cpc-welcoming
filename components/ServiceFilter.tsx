"use client";

import { SERVICE_OPTIONS, type ChurchService } from "@/types/database";

interface ServiceFilterProps {
  value: ChurchService | "All";
  onChange: (value: ChurchService | "All") => void;
}

export function ServiceFilter({ value, onChange }: ServiceFilterProps) {
  return (
    <select
      className="h-11 px-3 rounded-input border border-border bg-surface text-body text-textSecondary shrink-0"
      value={value}
      onChange={(e) => onChange(e.target.value as ChurchService | "All")}
    >
      <option value="All">All services</option>
      {SERVICE_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
