"use client";

import Link from "next/link";
import { AgeTag, WelcomerTag } from "@/components/Tag";
import { format } from "date-fns";
import { Check, Circle } from "lucide-react";
import type { Visitor, Welcomer, Profile } from "@/types/database";

interface VisitorCardProps {
  visitor: Visitor;
  welcomer?: Welcomer | null;
  profileById?: Record<string, Profile>;
}

const WEEK_BOX_STYLES = [
  { bg: "bg-secondary/60", label: "Week 1 comment" },
  { bg: "bg-sage/25", label: "Week 2 comment" },
  { bg: "bg-accent/15", label: "Week 3 comment" },
];

export function VisitorCard({ visitor, welcomer, profileById = {} }: VisitorCardProps) {
  const weekNotes = [
    { notes: visitor.week1_notes, authorId: visitor.week1_notes_by },
    { notes: visitor.week2_notes, authorId: visitor.week2_notes_by },
    { notes: visitor.week3_notes, authorId: visitor.week3_notes_by },
  ];

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

      {weekNotes.some((w) => w.notes) && (
        <div className="flex flex-col gap-2">
          {weekNotes.map((w, i) =>
            w.notes ? (
              <div key={i} className={`rounded-input px-3 py-2 ${WEEK_BOX_STYLES[i].bg}`}>
                <p className="text-caption font-semibold text-textPrimary mb-0.5">
                  {WEEK_BOX_STYLES[i].label}
                  {w.authorId && profileById[w.authorId] && (
                    <span className="font-normal text-textSecondary">
                      {" "}
                      — {profileById[w.authorId].full_name}
                    </span>
                  )}
                </p>
                <p className="text-body text-textPrimary">{w.notes}</p>
              </div>
            ) : null
          )}
        </div>
      )}

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