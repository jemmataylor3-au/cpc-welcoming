"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/PageHeader";
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
import { format, startOfMonth, subMonths } from "date-fns";
import { SERVICE_OPTIONS, type ChurchService, type Visitor } from "@/types/database";

const SERVICE_COLORS: Record<ChurchService, string> = {
  Swansea: "#C8755B",
  "Charlestown AM": "#172B3A",
  "Sunday@6": "#A7B5A0",
};

const MONTHS_BACK = 6;

export default function ReportsPage() {
  const supabase = createClient();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const sixMonthsAgo = startOfMonth(subMonths(new Date(), MONTHS_BACK - 1));
      const { data } = await supabase
        .from("visitors")
        .select("date_first_attended, service, age_category, status")
        .gte("date_first_attended", sixMonthsAgo.toISOString().slice(0, 10));
      setVisitors((data as Visitor[]) ?? []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  // Build one row per month, with a count per service.
  const monthlyData = Array.from({ length: MONTHS_BACK }).map((_, i) => {
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

  const statusOverTime = Array.from({ length: MONTHS_BACK }).map((_, i) => {
    const monthDate = startOfMonth(subMonths(new Date(), MONTHS_BACK - 1 - i));
    const monthLabel = format(monthDate, "MMM yy");
    const count = visitors.filter((v) => {
      const d = new Date(v.date_first_attended);
      return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth();
    }).length;
    return { month: monthLabel, count };
  });

  return (
    <div className="pb-24">
      <PageHeader
        title="Reports"
        subtitle={`New visitors, last ${MONTHS_BACK} months`}
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
        {loading && <p className="text-body text-textSecondary py-8 text-center">Loading…</p>}

        {!loading && (
          <>
            <div className="card p-4">
              <h4 className="mb-4">New visitors per month</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={statusOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E2DD" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#66727A" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#66727A" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #E4E2DD",
                        fontSize: 13,
                      }}
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

            <div className="card p-4">
              <h4 className="mb-4">By service, per month</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E2DD" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#66727A" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#66727A" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #E4E2DD",
                        fontSize: 13,
                      }}
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
              <h4 className="mb-3">Total by service (last {MONTHS_BACK} months)</h4>
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
      </div>
    </div>
  );
}
