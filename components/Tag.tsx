import clsx from "clsx";
import type { VisitorStatus, AgeCategory } from "@/types/database";

const STATUS_STYLES: Record<VisitorStatus, string> = {
  Active: "bg-secondary text-primary",
  Settled: "bg-sage/30 text-primary",
  Archived: "bg-border text-textSecondary",
};

const AGE_STYLES: Record<AgeCategory, string> = {
  Youth: "bg-green/35 text-navy",
  "Young Adult": "bg-teal/35 text-navy",
  "Young Family": "bg-sand text-navy",
  "Established Family": "bg-clay/60 text-navy",
  "Midlife / Empty Nester": "bg-orchid/35 text-navy",
  Senior: "bg-mauve/40 text-navy",
  "Over 30": "bg-moss/35 text-navy",
};

export function StatusTag({ status }: { status: VisitorStatus }) {
  return <span className={clsx("tag", STATUS_STYLES[status])}>{status}</span>;
}

export function AgeTag({ category }: { category: AgeCategory }) {
  return <span className={clsx("tag", AGE_STYLES[category])}>{category}</span>;
}

// Picks white or dark text depending on how light/dark the background
// colour is, so a welcomer's tag stays readable no matter which colour
// they're assigned — including the darker ones like navy or ink.
function readableTextColor(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? "#0E1F27" : "#FFFFFF";
}

export function WelcomerTag({ name, colorHex }: { name: string; colorHex: string }) {
  return (
    <span
      className="tag"
      style={{ backgroundColor: colorHex, color: readableTextColor(colorHex) }}
    >
      {name}
    </span>
  );
}