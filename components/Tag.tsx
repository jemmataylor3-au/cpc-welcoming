import clsx from "clsx";
import type { VisitorStatus, AgeCategory } from "@/types/database";

const STATUS_STYLES: Record<VisitorStatus, string> = {
  Active: "bg-secondary text-primary",
  Settled: "bg-sage/30 text-primary",
  Archived: "bg-border text-textSecondary",
};

const AGE_STYLES: Record<AgeCategory, string> = {
  Youth: "bg-accent/15 text-accent",
  "Young Adults (YA)": "bg-sage/30 text-primary",
  "Over 30": "bg-secondary text-primary",
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
      style={{ backgroundColor: `${colorHex}26`, color: colorHex }}
    >
      {name}
    </span>
  );
}
