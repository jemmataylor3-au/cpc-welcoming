"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { ServiceFilter } from "@/components/ServiceFilter";
import { ChevronLeft } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, startOfMonth, subMonths, differenceInCalendarDays } from "date-fns";
import {
  SERVICE_OPTIONS,
  AGE_CATEGORY_OPTIONS,
  REASON_OPTIONS,
  ARCHIVE_REASON_OPTIONS,
  type ChurchService,
  type Visitor,
} from "@/types/database";

const SERVICE_COLORS: Record<ChurchService, string> = {
  Swansea: "#C8755B",
  "Charlestown AM": "#172B3A",
  "Sunday@6": "#A7B5A0",
};

const AGE_COLORS: Record<string, string> = {
  Youth: "#C8755B",
  "Young Adults (YA)": "#A7B5A0",
  "Over 30": "#172B3A",
};

const MONTHS_BACK = 12;

export default function ReportsPage() {
  const supabase = createClient();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceFilter, setServiceFilter] = useState<ChurchService | "All">("All");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("visitors")
        .select(
          "date_first_attended, service, age_category, status, reason_for_attendance, archive_reason_category, settled_at"
        );
      setVisitors((data as Visitor[]) ?? []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const scoped = useMemo(
    () => (serviceFilter === "All" ? visitors : visitors.filter((v) => v.service === serviceFilter)),
    [visitors, serviceFilter]
  );

  const monthlyTotals = Array.from({ length: MONTHS_BACK }).map((_, i) => {
    const monthDate = startOfMonth(subMonths(new Date(), MONTHS_BACK - 1 - i));
    const monthLabel = format(monthDate, "MMM yy");
    const count = scoped.filter((v) => {
      const d = new Date(v.date_first_attended);
      return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth();
    }).length;
    return { month: monthLabel, count };
  });

  const monthlyByService = Array.from({ length: MONTHS_BACK }).map((_, i) => {
    const monthDate = startOfMonth(subMonths(new Date(), MONTHS_BACK - 1 - i));
    const monthLabel = format(monthDate, "MMM yy");
    const row: Record<string, string | number> = { month: monthLabel };
    SERVICE_OPTIONS.forEach((s) => {
      row[s] = visitors.filter((v) => {
        const d = new Date(v.date_first_attended);
        return (
          d.getFullYear() === monthDate.getFullYear() &&
          d.getMonth() === monthDate.getMonth() &&
          v.service === s
        );
      }).length;
    });
    return row;
  });

  const totalByService = SERVICE_OPTIONS.map((s) => ({
    service: s,
    count: visitors.filter((v) => v.service === s).length,
  }));

  const ageBreakdown = AGE_CATEGORY_OPTIONS.map((a) => ({
    category: a,
    count: scoped.filter((v) => v.age_category === a).length,
  }));

  const reasonBreakdown = REASON_OPTIONS.map((r) => ({
    reason: r,
    count: scoped.filter((v) => v.reason_for_attendance === r).length,
  }));

  const archivedScoped = scoped.filter((v) => v.status === "Archived");
  const archiveReasonBreakdown = ARCHIVE_REASON_OPTIONS.map((r) => ({
    reason: r,
    count: archivedScoped.filter((v) => v.archive_reason_category === r).length,
  }));

  const settledWithDates = scoped.filter((v) => v.status === "Settled" && v.settled_at);
  const avgDaysToSettle =
    settledWithDates.length > 0
      ? Math.round(
          settledWithDates.reduce(
            (sum, v) => sum + differenceInCalendarDays(new Date(v.settled_at!), new Date(v.date_first_attended)),
            0
          ) / settledWithDates.length
        )
      : null;

  return (
    <div className="pb-24">
      <PageHeader
        title="Reports"
        subtitle={`Last ${MONTHS_BACK} months`}
        action={
          <Link
            href="/more"
            className="w-11 h-11 rounded-button bg-white/10 flex items-center justify-center shrink-0"
          >
            <ChevronLeft className="w-5 h-5 text-secondary" />
          </Link>
        }
      />

      <div className="max-w-2xl mx-auto px-5 -mt-3 space-y-6">
        <ServiceFilter value={serviceFilter} onChange={setServiceFilter} />

        {loading && <p className="text-body text-textSecondary py-8 text-center">Loading…</p>}

        {!loading && (
          <>
            <div className="card p-4">
              <h4 className="mb-4">New visitors per month</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTotals}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E2DD" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#66727A" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#66727A" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, border: "1px solid #E4E2DD", fontSize: 13 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#172B3A"
                      strokeWidth={2}
                      dot={{ fill: "#172B3A", r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {serviceFilter === "All" && (
              <>
                <div className="card p-4">
                  <h4 className="mb-4">By service, per month</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyByService}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E4E2DD" />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#66727A" }} />
                        <YAxis tick={{ fontSize: 12, fill: "#66727A" }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: 10, border: "1px solid #E4E2DD", fontSize: 13 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {SERVICE_OPTIONS.map((s) => (
                          <Bar key={s} dataKey={s} fill={SERVICE_COLORS[s]} radius={[4, 4, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card p-4">
                  <h4 className="mb-3">Total by service (all time)</h4>
                  <div className="space-y-3">
                    {totalByService.map(({ service, count }) => (
                      <div key={service} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: SERVICE_COLORS[service] }}
                          />
                          <span className="text-body text-textPrimary">{service}</span>
                        </div>
                        <span className="text-h4 text-primary">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="card p-4">
              <h4 className="mb-4">Age category breakdown</h4>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E2DD" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: "#66727A" }} allowDecimals={false} />
                    <YAxis
                      dataKey="category"
                      type="category"
                      width={110}
                      tick={{ fontSize: 12, fill: "#66727A" }}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, border: "1px solid #E4E2DD", fontSize: 13 }}
                    />
                    <Bar dataKey="count" fill="#172B3A" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-4">
              <h4 className="mb-1">Average time to Settled</h4>
              <p className="text-caption text-textSecondary mb-3">
                From first visit to being confirmed Settled
              </p>
              {avgDaysToSettle !== null ? (
                <p className="font-display text-h1 text-primary">
                  {avgDaysToSettle} <span className="text-h4 text-textSecondary">days</span>
                </p>
              ) : (
                <p className="text-body text-textSecondary">
                  Not enough data yet — this fills in as people are confirmed Settled going forward.
                </p>
              )}
            </div>

            <div className="card p-4">
              <h4 className="mb-4">Reason for first attending</h4>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reasonBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E2DD" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: "#66727A" }} allowDecimals={false} />
                    <YAxis
                      dataKey="reason"
                      type="category"
                      width={140}
                      tick={{ fontSize: 11, fill: "#66727A" }}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, border: "1px solid #E4E2DD", fontSize: 13 }}
                    />
                    <Bar dataKey="count" fill="#C8755B" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-4">
              <h4 className="mb-1">Reason for archiving</h4>
              <p className="text-caption text-textSecondary mb-3">
                {archivedScoped.length} archived {serviceFilter !== "All" ? `(${serviceFilter})` : "total"}
              </p>
              {archivedScoped.length > 0 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={archiveReasonBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4E2DD" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: "#66727A" }} allowDecimals={false} />
                      <YAxis
                        dataKey="reason"
                        type="category"
                        width={140}
                        tick={{ fontSize: 11, fill: "#66727A" }}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: "1px solid #E4E2DD", fontSize: 13 }}
                      />
                      <Bar dataKey="count" fill="#B85C5C" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-body text-textSecondary">No archived visitors yet.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
