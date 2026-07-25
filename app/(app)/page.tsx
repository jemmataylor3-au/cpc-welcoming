"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Users, UserCheck, Archive, PlusCircle, CheckCircle, UserPlus } from "lucide-react";
import { useAppData } from "@/lib/hooks/useAppData";
import type { AgeCategory, VisitorStatus, ChurchService } from "@/types/database";
import { SERVICE_OPTIONS } from "@/types/database";

interface Counts {
  byStatus: Record<VisitorStatus, number>;
  byAge: Record<AgeCategory, number>;
  byService: Record<ChurchService, number>;
  total: number;
}

const EMPTY_COUNTS: Counts = {
  byStatus: { Active: 0, Settled: 0, Archived: 0 },
  byAge: { Youth: 0, "Young Adults (YA)": 0, "Over 30": 0 },
  byService: { Swansea: 0, "Charlestown AM": 0, "Sunday@6": 0 },
  total: 0,
};

export default function DashboardPage() {
  const supabase = createClient();
  const { profile } = useAppData();
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [checkinSatisfied, setCheckinSatisfied] = useState<boolean | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(true);
  const [markingNoOne, setMarkingNoOne] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("visitors")
        .select("status, age_category, service");

      if (!error && data) {
        const next: Counts = {
          byStatus: { Active: 0, Settled: 0, Archived: 0 },
          byAge: { Youth: 0, "Young Adults (YA)": 0, "Over 30": 0 },
          byService: { Swansea: 0, "Charlestown AM": 0, "Sunday@6": 0 },
          total: data.length,
        };
        data.forEach((row) => {
          next.byStatus[row.status as VisitorStatus]++;
          next.byAge[row.age_category as AgeCategory]++;
          next.byService[row.service as ChurchService]++;
        });
        setCounts(next);
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  useEffect(() => {
    async function loadCheckin() {
      const { data, error } = await supabase.rpc("get_or_create_current_checkin");
      if (!error && data) {
        setCheckinSatisfied(data.satisfied);
      }
      setCheckinLoading(false);
    }
    loadCheckin();
  }, [supabase]);

  useEffect(() => {
    async function loadPending() {
      const { count } = await supabase
        .from("pending_visitors")
        .select("id", { count: "exact", head: true })
        .eq("claimed", false);
      setPendingCount(count ?? 0);
    }
    loadPending();
  }, [supabase]);

  async function handleNoOneNew() {
    setMarkingNoOne(true);
    const { error } = await supabase.rpc("mark_week_satisfied", {
      p_no_one_new: true,
      p_actor_id: profile?.id ?? null,
    });
    if (!error) {
      setCheckinSatisfied(true);
    }
    setMarkingNoOne(false);
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="Welcome back"
        subtitle="Here's where things stand with our visitors"
      />

      <div className="max-w-2xl mx-auto px-5 -mt-3">
        {!checkinLoading && checkinSatisfied === false && (
          <div className="card p-4 mb-4 border-accent/40 bg-accent/5">
            <h4 className="mb-1.5">This week's check-in</h4>
            <p className="text-body text-textSecondary mb-3">
              No one has logged anything yet this week. Add a visitor above,
              or let the team know no one new came along.
            </p>
            <button
              className="btn-secondary w-full"
              onClick={handleNoOneNew}
              disabled={markingNoOne}
            >
              {markingNoOne ? "Saving…" : "No one new spoken to this week"}
            </button>
          </div>
        )}
        {!checkinLoading && checkinSatisfied === true && (
          <div className="card p-4 mb-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-success shrink-0" />
            <p className="text-body text-textPrimary">This week is logged — thank you!</p>
          </div>
        )}

        {pendingCount > 0 && (
          <Link
            href="/visitors/pending"
            className="card p-4 mb-4 flex items-center gap-3 border-accent/40 bg-accent/5"
          >
            <UserPlus className="w-5 h-5 text-accent shrink-0" />
            <p className="text-body text-textPrimary">
              {pendingCount} new submission{pendingCount === 1 ? "" : "s"} to review
            </p>
          </Link>
        )}

        <Link href="/visitors/new" className="btn-accent w-full mb-6 shadow-card">
          <PlusCircle className="w-5 h-5" />
          Add new visitor
        </Link>

        <h3 className="mb-3">By status</h3>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard
            icon={Users}
            label="Active"
            value={counts.byStatus.Active}
            loading={loading}
            href="/visitors/active"
          />
          <StatCard
            icon={UserCheck}
            label="Settled"
            value={counts.byStatus.Settled}
            loading={loading}
            href="/visitors/settled"
          />
          <StatCard
            icon={Archive}
            label="Archived"
            value={counts.byStatus.Archived}
            loading={loading}
            href="/visitors/archived"
          />
        </div>

        <h3 className="mb-3">By age category</h3>
        <div className="card p-4 space-y-3 mb-6">
          <AgeRow label="Youth" value={counts.byAge.Youth} loading={loading} />
          <AgeRow
            label="Young Adults (YA)"
            value={counts.byAge["Young Adults (YA)"]}
            loading={loading}
          />
          <AgeRow label="Over 30" value={counts.byAge["Over 30"]} loading={loading} />
        </div>

        <h3 className="mb-3">By service</h3>
        <div className="card p-4 space-y-3">
          {SERVICE_OPTIONS.map((s) => (
            <AgeRow key={s} label={s} value={counts.byService[s]} loading={loading} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  loading: boolean;
  href: string;
}) {
  return (
    <Link href={href} className="card p-4 flex flex-col items-center text-center gap-2">
      <Icon className="w-5 h-5 text-primary" strokeWidth={2} />
      <span className="font-display text-h2 text-primary leading-none">
        {loading ? "–" : value}
      </span>
      <span className="text-caption text-textSecondary">{label}</span>
    </Link>
  );
}

function AgeRow({
  label,
  value,
  loading,
}: {
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-body text-textPrimary">{label}</span>
      <span className="text-h4 text-primary">{loading ? "–" : value}</span>
    </div>
  );
}
