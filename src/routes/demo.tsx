import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LayoutDashboard, GraduationCap, BookOpen, Library, School,
  CalendarDays, Monitor, QrCode, BarChart3, Users, UserCog,
  ShieldCheck, Building2, GitBranch, Settings, ArrowLeft, AlertOctagon,
} from "lucide-react";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo · RollCall" },
      { name: "description", content: "A live preview of the RollCall admin dashboard — attendance rate, today's breakdown, sessions, and chronic-absentee alerts." },
      { property: "og:title", content: "RollCall demo dashboard" },
      { property: "og:description", content: "Preview the RollCall admin dashboard." },
    ],
  }),
  component: DemoPage,
});

const sidebar = [
  { section: null, items: [{ icon: LayoutDashboard, label: "Dashboard", active: true }] },
  { section: "Academics", items: [
    { icon: GraduationCap, label: "Grades" },
    { icon: BookOpen, label: "Sections" },
    { icon: Library, label: "Subjects" },
    { icon: School, label: "Classes" },
  ]},
  { section: "Attendance", items: [
    { icon: CalendarDays, label: "Sessions" },
    { icon: Monitor, label: "Kiosk" },
    { icon: QrCode, label: "QR codes" },
    { icon: BarChart3, label: "Reports" },
  ]},
  { section: "People", items: [
    { icon: Users, label: "Students" },
    { icon: UserCog, label: "Teachers" },
    { icon: ShieldCheck, label: "Roles & access" },
  ]},
  { section: "Organization", items: [
    { icon: Building2, label: "School" },
    { icon: GitBranch, label: "Branches" },
    { icon: Settings, label: "Settings" },
  ]},
];

function DemoPage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto flex max-w-[1400px]">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-border bg-background p-4 md:block">
          <Link to="/" className="mb-6 flex items-center gap-2 px-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" opacity="0.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" opacity="0.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight">
              Roll<span className="text-primary">Call</span>
            </span>
          </Link>
          <nav className="space-y-5">
            {sidebar.map((group, i) => (
              <div key={i}>
                {group.section && (
                  <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.section}
                  </div>
                )}
                <ul className="space-y-0.5">
                  {group.items.map((it: any) => (
                    <li key={it.label}>
                      <button
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                          it.active
                            ? "bg-primary-soft font-semibold text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <it.icon className="h-4 w-4" />
                        {it.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <div className="flex-1">
          <header className="flex items-center justify-between border-b border-border bg-background px-6 py-5">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                <span className="text-muted-foreground">Lincoln High School</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Static preview · no data is saved.</p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" /> Back to site
            </Link>
          </header>

          <div className="space-y-5 p-6">
            {/* Stat cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Stat label="Attendance today" value="85.9%" foot="↘ 4.3pt vs 5-day avg" footColor="text-destructive" />
              <Stat label="Checked in today" value="3,041" foot="of 3,540" />
              <Stat label="Live now" value="3" foot="4 scheduled" />
              <Stat label="Chronic absentees" value="16%" foot="↘ 1.4pt · 580 under 90%" footColor="text-success" />
            </div>

            {/* Chart + donut */}
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background p-6 lg:col-span-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Attendance rate</h3>
                    <p className="text-xs text-muted-foreground">Last 20 school days · whole school</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">85.9<span className="text-base text-muted-foreground">%</span></div>
                    <div className="text-xs text-destructive">↘ 4.3pt</div>
                  </div>
                </div>
                <svg viewBox="0 0 600 200" className="mt-4 h-56 w-full">
                  <defs>
                    <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="70" x2="600" y2="70" stroke="var(--success)" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.6" />
                  <text x="585" y="64" fontSize="10" fill="var(--success)" textAnchor="end">Target 90%</text>
                  <path
                    d="M0,140 L40,120 L80,135 L120,150 L160,110 L200,118 L240,100 L280,95 L320,108 L360,80 L400,95 L440,70 L480,55 L520,75 L560,65 L600,135"
                    fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                  />
                  <path
                    d="M0,140 L40,120 L80,135 L120,150 L160,110 L200,118 L240,100 L280,95 L320,108 L360,80 L400,95 L440,70 L480,55 L520,75 L560,65 L600,135 L600,200 L0,200 Z"
                    fill="url(#dg)"
                  />
                  <circle cx="600" cy="135" r="4" fill="var(--primary)" />
                </svg>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Jan 15</span><span>Jan 18</span><span>Jan 21</span><span>Jan 24</span>
                  <span>Jan 27</span><span>Feb 2</span><span>Feb 6</span>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-6">
                <h3 className="text-lg font-semibold">Today's breakdown</h3>
                <div className="mt-6 grid place-items-center">
                  <Donut />
                </div>
                <ul className="mt-6 space-y-2 text-sm">
                  <BreakdownRow color="bg-success" label="Present" value="2,738" pct="77%" />
                  <BreakdownRow color="bg-warning" label="Late" value="303" pct="9%" />
                  <BreakdownRow color="bg-info" label="Excused" value="139" pct="4%" />
                  <BreakdownRow color="bg-destructive" label="Absent" value="360" pct="10%" />
                </ul>
              </div>
            </div>

            {/* Sessions + needs attention */}
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background p-6 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    Today's sessions
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">3 live</span>
                  </h3>
                </div>
                <div className="mt-4 space-y-2">
                  <SessionRow time="08:00" name="AP Biology" room="Room 204 · Sara" progress={21} total={28} live />
                  <SessionRow time="09:00" name="World History" room="Room 110 · Daniel" progress={26} total={30} live />
                  <SessionRow time="09:00" name="Algebra II" room="Room 305 · Priya" progress={22} total={24} live />
                  <SessionRow time="10:15" name="English Lit" room="Room 118 · Marcus" progress={0} total={27} />
                  <SessionRow time="11:00" name="Chemistry" room="Lab B · Yuki" progress={0} total={26} />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <AlertOctagon className="h-5 w-5 text-destructive" />
                  Needs attention
                </h3>
                <ul className="mt-4 space-y-3">
                  <AlertRow initials="FF" name="Felix Frank" meta="Grade 11 · B · 4 days absent" pct="74%" />
                  <AlertRow initials="MK" name="Mia Kim" meta="Grade 10 · A · 3 days absent" pct="78%" />
                  <AlertRow initials="JR" name="Jordan Rivera" meta="Grade 9 · C · 5 days absent" pct="69%" />
                  <AlertRow initials="SP" name="Sana Patel" meta="Grade 12 · A · 3 days absent" pct="81%" />
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, foot, footColor = "text-muted-foreground" }: any) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      <div className={`mt-1 text-xs ${footColor}`}>{foot}</div>
    </div>
  );
}

function BreakdownRow({ color, label, value, pct }: any) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        {label}
      </span>
      <span className="flex items-center gap-3">
        <span className="font-semibold">{value}</span>
        <span className="w-8 text-right text-xs text-muted-foreground">{pct}</span>
      </span>
    </li>
  );
}

function SessionRow({ time, name, room, progress, total, live = false }: any) {
  const pct = total ? (progress / total) * 100 : 0;
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="w-12 text-sm font-semibold tabular-nums">{time}</div>
      <div className="flex-1">
        <div className="font-semibold">{name}</div>
        <div className="text-xs text-muted-foreground">{room}</div>
      </div>
      <div className="hidden w-40 sm:block">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-right text-xs text-muted-foreground">{progress}/{total}</div>
      </div>
      {live ? (
        <span className="flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
        </span>
      ) : (
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Upcoming</span>
      )}
    </div>
  );
}

function AlertRow({ initials, name, meta, pct }: any) {
  return (
    <li className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
        {initials}
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold">{name}</div>
        <div className="text-xs text-muted-foreground">{meta}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold text-destructive">{pct}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">at risk</div>
      </div>
    </li>
  );
}

function Donut() {
  // Stroke-dasharray donut: 77 / 9 / 4 / 10
  const C = 2 * Math.PI * 60;
  const segs = [
    { pct: 77, color: "var(--success)" },
    { pct: 9, color: "var(--warning)" },
    { pct: 4, color: "var(--info)" },
    { pct: 10, color: "var(--destructive)" },
  ];
  let offset = 0;
  return (
    <svg viewBox="0 0 160 160" className="h-44 w-44 -rotate-90">
      <circle cx="80" cy="80" r="60" fill="none" stroke="var(--muted)" strokeWidth="20" />
      {segs.map((s, i) => {
        const len = (s.pct / 100) * C;
        const el = (
          <circle
            key={i}
            cx="80" cy="80" r="60" fill="none"
            stroke={s.color} strokeWidth="20"
            strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={-offset}
          />
        );
        offset += len;
        return el;
      })}
      <g transform="rotate(90 80 80)">
        <text x="80" y="78" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--foreground)">85.9%</text>
        <text x="80" y="96" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">checked in</text>
      </g>
    </svg>
  );
}
