import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingDown, Users, AlertTriangle } from "lucide-react";

export function ReportsPreview() {
  return (
    <section id="reports" className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid gap-12 md:grid-cols-2 md:items-center">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">Reports</div>
          <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            Every check-in becomes a report.
          </h2>
          <p className="mt-3 text-muted-foreground">
            RollCall rolls up daily, weekly, and term-long attendance across classes,
            grades, and branches. Spot chronic absentees before they fall behind.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <Users className="mt-0.5 h-4 w-4 text-primary" />
              <span><strong>Daily breakdown</strong> by present, late, excused, absent.</span>
            </li>
            <li className="flex items-start gap-3">
              <TrendingDown className="mt-0.5 h-4 w-4 text-primary" />
              <span><strong>Trends</strong> across 20 school days vs. a target rate.</span>
            </li>
            <li className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-primary" />
              <span><strong>Chronic absentee alerts</strong> for students under 90%.</span>
            </li>
          </ul>
          <div className="mt-8">
            <Button asChild variant="outline">
              <Link to="/demo">
                See the live demo <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.15)]">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Attendance today" value="85.9%" trend="↘ 4.3pt vs avg" trendColor="text-destructive" />
            <StatCard label="Checked in" value="3,041" trend="of 3,540" />
            <StatCard label="Live now" value="3" trend="4 scheduled" />
            <StatCard label="Chronic" value="16%" trend="↘ 1.4pt" trendColor="text-success" />
          </div>
          <div className="mt-4 rounded-2xl bg-primary-soft p-5">
            <div className="text-sm font-semibold">Attendance rate · last 20 days</div>
            <svg viewBox="0 0 320 100" className="mt-3 h-28 w-full">
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,70 L20,62 L40,68 L60,75 L80,55 L100,60 L120,52 L140,48 L160,55 L180,42 L200,50 L220,38 L240,30 L260,40 L280,35 L300,55 L320,72"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M0,70 L20,62 L40,68 L60,75 L80,55 L100,60 L120,52 L140,48 L160,55 L180,42 L200,50 L220,38 L240,30 L260,40 L280,35 L300,55 L320,72 L320,100 L0,100 Z"
                fill="url(#g)"
              />
              <line x1="0" y1="45" x2="320" y2="45" stroke="var(--success)" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
            </svg>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>Jan 15</span><span>Jan 24</span><span>Feb 2</span><span>Feb 6</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value, trend, trendColor = "text-muted-foreground" }: {
  label: string; value: string; trend: string; trendColor?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      <div className={`mt-1 text-xs ${trendColor}`}>{trend}</div>
    </div>
  );
}
