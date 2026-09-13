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

export function WelcomerTag({ name, colorHex }: { name: string; colorHex: string }) {
  return (
    <span
      className="tag"
      style={{ backgroundColor: `${colorHex}4D`, color: colorHex }}
    >
      {name}
    </span>
  );
}