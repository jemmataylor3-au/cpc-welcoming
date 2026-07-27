"use client";

import type { Welcomer, ChurchService } from "@/types/database";

interface WelcomerSelectProps {
  welcomers: Welcomer[];
  service: ChurchService;
  welcomerId: string | null;
  welcomerOther: string | null;
  disabled?: boolean;
  onChange: (welcomerId: string | null, welcomerOther: string | null) => void;
}

const OTHER_VALUE = "__other__";

export function WelcomerSelect({
  welcomers,
  service,
  welcomerId,
  welcomerOther,
  disabled,
  onChange,
}: WelcomerSelectProps) {
  // Only welcomers tagged for this service show up, plus whoever is
  // already assigned (even if tagged for a different service, so an
  // existing assignment never silently disappears from the dropdown).
  const relevantWelcomers = welcomers.filter(
    (w) => w.services?.includes(service) || w.id === welcomerId
  );

  const isOther = welcomerOther !== null && welcomerOther !== undefined && welcomerOther !== "";
  const selectValue = isOther ? OTHER_VALUE : welcomerId ?? "";

  function handleSelectChange(value: string) {
    if (value === OTHER_VALUE) {
      onChange(null, "");
    } else {
      onChange(value || null, null);
    }
  }

  return (
    <div>
      <select
        className="input-field"
        value={selectValue}
        disabled={disabled}
        onChange={(e) => handleSelectChange(e.target.value)}
      >
        <option value="">Unassigned</option>
        {relevantWelcomers.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
        <option value={OTHER_VALUE}>Other…</option>
      </select>
      {isOther && (
        <input
          type="text"
          className="input-field mt-2"
          placeholder="Who welcomed them?"
          value={welcomerOther ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(null, e.target.value)}
        />
      )}
    </div>
  );
}
