import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listClasses } from "@/lib/classes.functions";
import { getReport } from "@/lib/attendance.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/app/reports")({
  component: ReportsPage,
});

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function ReportsPage() {
  const fClasses = useServerFn(listClasses);
  const fReport = useServerFn(getReport);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [classId, setClassId] = useState<string>("");
  const today = new Date();
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return fmt(d);
  }, []);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(fmt(today));
  const [report, setReport] = useState<Awaited<ReturnType<typeof getReport>> | null>(null);
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily");

  useEffect(() => {
    fClasses({}).then(setClasses);
  }, [fClasses]);

  useEffect(() => {
    fReport({ data: { from, to, classId: classId || undefined } }).then(setReport);
  }, [fReport, from, to, classId]);

  const series = useMemo(() => {
    if (!report) return [];
    if (granularity === "daily") return report.series;
    const buckets = new Map<string, { present: number; total: number }>();
    for (const s of report.series) {
      const d = new Date(s.day);
      let key: string;
      if (granularity === "weekly") {
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        key = fmt(monday);
      } else {
        key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      }
      const b = buckets.get(key) ?? { present: 0, total: 0 };
      b.present += s.present;
      b.total += s.total;
      buckets.set(key, b);
    }
    return Array.from(buckets.entries())
      .sort()
      .map(([day, v]) => ({
        day,
        present: v.present,
        total: v.total,
        rate: v.total === 0 ? 0 : Math.round((v.present / v.total) * 100),
      }));
  }, [report, granularity]);

  function exportCsv() {
    if (!report) return;
    const lines = ["day,present,total,rate"];
    for (const s of series) lines.push(`${s.day},${s.present},${s.total},${s.rate}`);
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rollcall-attendance-${from}-to-${to}.csv`;
    a.click();
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Reports</h1>

      <Card className="p-5 mb-6">
        <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Class</Label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="h-9 w-full rounded-md border px-2 text-sm"
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">View</Label>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as typeof granularity)}
              className="h-9 w-full rounded-md border px-2 text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={exportCsv} disabled={!report}>
              Export CSV
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5 mb-6">
        <h2 className="font-semibold mb-3">Attendance rate</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="day" fontSize={12} />
              <YAxis domain={[0, 100]} fontSize={12} unit="%" />
              <Tooltip />
              <Line type="monotone" dataKey="rate" stroke="#F97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {report?.totalEvents ?? 0} attendance events in range
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold mb-3">Chronic absentees (3+ absences in range)</h2>
        {report && report.chronicAbsentees.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="py-2">Student</th>
                <th className="py-2">Class</th>
                <th className="py-2 text-right">Absences</th>
              </tr>
            </thead>
            <tbody>
              {report.chronicAbsentees.map((s) => (
                <tr key={s.student_id} className="border-t">
                  <td className="py-2 font-medium">{s.full_name}</td>
                  <td className="py-2 text-muted-foreground">{s.class_name ?? "—"}</td>
                  <td className="py-2 text-right font-mono">{s.absences}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No chronic absentees in this range.</p>
        )}
      </Card>
    </div>
  );
}
