"use client";

import Link from "next/link";
import { AgeTag, WelcomerTag } from "@/components/Tag";
import { format } from "date-fns";
import { Check, Circle } from "lucide-react";
import type { Visitor, Welcomer } from "@/types/database";

interface VisitorCardProps {
  visitor: Visitor;
  welcomer?: Welcomer | null;
}

export function VisitorCard({ visitor, welcomer }: VisitorCardProps) {
  return (
    <Link href={`/visitors/${visitor.id}`} className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-textPrimary">{visitor.name}</h4>
          <p className="text-small text-textSecondary mt-0.5">
            First attended {format(new Date(visitor.date_first_attended), "d MMM yyyy")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <AgeTag category={visitor.age_category} />
          <span className="tag bg-secondary text-primary">{visitor.service}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <WeekDot label="Wk 1" attended={visitor.week1_attended} />
        <WeekDot label="Wk 2" attended={visitor.week2_attended} />
        <WeekDot label="Wk 3" attended={visitor.week3_attended} />
        {visitor.catchup_flag && (
          <span className="tag bg-accent/15 text-accent ml-auto">Catch-up</span>
        )}
      </div>

      {welcomer && (
        <div>
          <WelcomerTag name={welcomer.name} colorHex={welcomer.color_hex} />
        </div>
      )}
    </Link>
  );
}

function WeekDot({ label, attended }: { label: string; attended: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {attended ? (
        <Check className="w-4 h-4 text-success" strokeWidth={2.5} />
      ) : (
        <Circle className="w-4 h-4 text-border" strokeWidth={2} />
      )}
      <span className="text-small text-textSecondary">{label}</span>
    </div>
  );
}
