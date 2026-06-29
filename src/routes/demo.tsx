import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  LayoutDashboard, CalendarDays, BarChart3, Users,
  ArrowLeft, AlertOctagon, QrCode, RotateCcw, Download, X, Check, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/landing/Logo";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo · RollCall" },
      { name: "description", content: "Try the RollCall dashboard live — simulate a scan, filter reports, drill into a class." },
      { property: "og:title", content: "RollCall interactive demo" },
      { property: "og:description", content: "Click around a working RollCall dashboard. No signup." },
    ],
  }),
  component: DemoPage,
});

// ---------------- Seed data ----------------
type Status = "present" | "late" | "excused" | "absent";
type Student = { id: string; name: string; grade: string; classId: string };
type ClassDef = { id: string; name: string; teacher: string; room: string; time: string };
type Session = { classId: string; statuses: Record<string, Status> };
type DayRecord = { date: string; presentRate: number };

const CLASSES: ClassDef[] = [
  { id: "bio",  name: "AP Biology",    teacher: "Sara",   room: "Room 204", time: "08:00" },
  { id: "hist", name: "World History", teacher: "Daniel", room: "Room 110", time: "09:00" },
  { id: "alg",  name: "Algebra II",    teacher: "Priya",  room: "Room 305", time: "09:00" },
  { id: "eng",  name: "English Lit",   teacher: "Marcus", room: "Room 118", time: "10:15" },
  { id: "chem", name: "Chemistry",     teacher: "Yuki",   room: "Lab B",    time: "11:00" },
];

const FIRST = ["Felix","Mia","Jordan","Sana","Aiden","Liam","Olivia","Noah","Emma","Sophia","Lucas","Ava","Ethan","Isabella","Mason","Amelia","Logan","Harper","Elijah","Charlotte","Ben","Zara","Kai","Nia","Theo","Lila","Owen","Maya","Reza","Hana"];
const LAST = ["Frank","Kim","Rivera","Patel","Lopez","Chen","Singh","Brown","Diaz","Wright","Khan","Cohen","Ito","Garcia","Ahmed","Park","Nguyen","Walker","Mendez","Hassan"];
const GRADES = ["9","10","11","12"];

function seedStudents(): Student[] {
  const out: Student[] = [];
  let i = 0;
  for (const c of CLASSES) {
    const n = 24 + (i % 3) * 2; // 24-28 per class
    for (let k = 0; k < n; k++) {
      const f = FIRST[(i * 7 + k) % FIRST.length];
      const l = LAST[(i * 3 + k * 5) % LAST.length];
      out.push({
        id: `${c.id}-s${k}`,
        name: `${f} ${l}`,
        grade: GRADES[(i + k) % GRADES.length],
        classId: c.id,
      });
    }
    i++;
  }
  return out;
}

function seedSessions(students: Student[]): Session[] {
  return CLASSES.map((c, ci) => {
    const cs = students.filter((s) => s.classId === c.id);
    const statuses: Record<string, Status> = {};
    cs.forEach((s, idx) => {
      // Roughly 78% present, 9% late, 4% excused, 9% absent — first 2 classes pre-filled, rest empty
      if (ci < 3) {
        const r = (idx * 13 + ci * 7) % 100;
        statuses[s.id] = r < 78 ? "present" : r < 87 ? "late" : r < 91 ? "excused" : "absent";
      } else {
        statuses[s.id] = "absent"; // upcoming
      }
    });
    return { classId: c.id, statuses };
  });
}

function seedHistory(): DayRecord[] {
  const out: DayRecord[] = [];
  for (let i = 19; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const base = 84 + Math.sin(i / 2) * 4 + ((i * 17) % 7) - 3;
    out.push({ date: d.toISOString().slice(0, 10), presentRate: Math.max(70, Math.min(96, +base.toFixed(1))) });
  }
  return out;
}

// ---------------- Component ----------------
type View = "dashboard" | "sessions" | "reports" | "students";

function DemoPage() {
  const [students, setStudents] = useState<Student[]>(() => seedStudents());
  const [sessions, setSessions] = useState<Session[]>(() => seedSessions(students));
  const [history] = useState<DayRecord[]>(() => seedHistory());
  const [view, setView] = useState<View>("dashboard");
  const [range, setRange] = useState<"today" | "7d" | "20d">("20d");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [scanOpen, setScanOpen] = useState(false);
  const [drillClass, setDrillClass] = useState<string | null>(null);

  function reset() {
    const s = seedStudents();
    setStudents(s);
    setSessions(seedSessions(s));
    setView("dashboard");
    setRange("20d");
    setClassFilter("all");
  }

  function setStatus(classId: string, studentId: string, status: Status) {
    setSessions((prev) =>
      prev.map((s) => (s.classId === classId ? { ...s, statuses: { ...s.statuses, [studentId]: status } } : s)),
    );
  }

  // ---- Aggregates ----
  const todayCounts = useMemo(() => {
    const counts: Record<Status, number> = { present: 0, late: 0, excused: 0, absent: 0 };
    let total = 0;
    for (const sess of sessions) {
      if (classFilter !== "all" && sess.classId !== classFilter) continue;
      for (const st of Object.values(sess.statuses)) {
        counts[st]++;
        total++;
      }
    }
    return { ...counts, total };
  }, [sessions, classFilter]);

  const presentPct = todayCounts.total
    ? +(((todayCounts.present + todayCounts.late) / todayCounts.total) * 100).toFixed(1)
    : 0;

  const trend = useMemo(() => {
    const slice = range === "today" ? history.slice(-1) : range === "7d" ? history.slice(-7) : history;
    const withToday = [...slice.slice(0, -1), { date: slice[slice.length - 1]?.date ?? "", presentRate: presentPct }];
    return withToday;
  }, [range, history, presentPct]);

  const trendAvg = trend.length ? +(trend.reduce((a, b) => a + b.presentRate, 0) / trend.length).toFixed(1) : 0;
  const trendDelta = +(presentPct - trendAvg).toFixed(1);

  const classProgress = (classId: string) => {
    const s = sessions.find((x) => x.classId === classId);
    if (!s) return { checked: 0, total: 0 };
    const total = Object.keys(s.statuses).length;
    const checked = Object.values(s.statuses).filter((v) => v === "present" || v === "late").length;
    return { checked, total };
  };

  const liveClasses = CLASSES.slice(0, 3);
  const atRiskStudents = useMemo(() => {
    // Synthesize "needs attention" from absentees in pre-filled classes
    const list: { id: string; name: string; grade: string; classId: string; absentDays: number; rate: number }[] = [];
    for (const s of students) {
      const sess = sessions.find((x) => x.classId === s.classId);
      const status = sess?.statuses[s.id];
      if (status === "absent" && liveClasses.find((c) => c.id === s.classId)) {
        const seed = (s.id.charCodeAt(0) + s.id.length) % 5 + 2;
        list.push({ id: s.id, name: s.name, grade: `Grade ${s.grade}`, classId: s.classId, absentDays: seed, rate: 90 - seed * 4 });
      }
    }
    return list.sort((a, b) => b.absentDays - a.absentDays).slice(0, 4);
  }, [students, sessions]);

  // ---- Layout ----
  const NavItem = ({ icon: Icon, label, v }: any) => (
    <button
      onClick={() => setView(v)}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
        view === v ? "bg-primary-soft font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto flex max-w-[1400px]">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-border bg-background p-4 md:block">
          <Link to="/" className="mb-6 flex items-center gap-2 px-2"><Logo /></Link>
          <nav className="space-y-1">
            <NavItem icon={LayoutDashboard} label="Dashboard" v="dashboard" />
            <NavItem icon={CalendarDays} label="Sessions" v="sessions" />
            <NavItem icon={BarChart3} label="Reports" v="reports" />
            <NavItem icon={Users} label="Students" v="students" />
          </nav>
          <div className="mt-8 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
            <div className="font-semibold text-foreground mb-1">Demo mode</div>
            Changes are local to your browser and reset on refresh.
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-4 md:px-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight capitalize">{view}</h1>
                <span className="hidden sm:inline text-muted-foreground">Lincoln High School</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">Interactive preview · no data is saved.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setScanOpen(true)}>
                <QrCode className="h-4 w-4 mr-1.5" /> Simulate scan
              </Button>
              <Button size="sm" variant="outline" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-1.5" /> Reset
              </Button>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </div>
          </header>

          <div className="space-y-5 p-4 md:p-6">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={range} onValueChange={(v: any) => setRange(v)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="20d">Last 20 days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {CLASSES.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="ml-auto">{todayCounts.total} students in view</Badge>
            </div>

            {view === "dashboard" && (
              <DashboardView
                presentPct={presentPct}
                trendDelta={trendDelta}
                todayCounts={todayCounts}
                trend={trend}
                liveClasses={liveClasses}
                classProgress={classProgress}
                atRiskStudents={atRiskStudents}
                onOpenClass={setDrillClass}
              />
            )}
            {view === "sessions" && (
              <SessionsView liveClasses={liveClasses} classProgress={classProgress} onOpenClass={setDrillClass} />
            )}
            {view === "reports" && (
              <ReportsView sessions={sessions} students={students} classFilter={classFilter} trend={trend} />
            )}
            {view === "students" && (
              <StudentsView students={students} sessions={sessions} classFilter={classFilter} onOpenClass={setDrillClass} />
            )}
          </div>
        </div>
      </div>

      {/* Simulate scan dialog */}
      <ScanDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        students={students}
        sessions={sessions}
        onScan={(classId: string, studentId: string) => setStatus(classId, studentId, "present")}
      />

      {/* Class drill-down sheet */}
      <DrillDownSheet
        classId={drillClass}
        onClose={() => setDrillClass(null)}
        students={students}
        sessions={sessions}
        onSetStatus={setStatus}
      />
    </div>
  );
}

// ---------------- Dashboard ----------------
function DashboardView({
  presentPct, trendDelta, todayCounts, trend, liveClasses, classProgress, atRiskStudents, onOpenClass,
}: any) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Attendance today" value={`${presentPct}%`}
          foot={`${trendDelta >= 0 ? "↗" : "↘"} ${Math.abs(trendDelta)}pt vs avg`}
          footColor={trendDelta >= 0 ? "text-success" : "text-destructive"} />
        <Stat label="Checked in today" value={(todayCounts.present + todayCounts.late).toLocaleString()}
          foot={`of ${todayCounts.total}`} />
        <Stat label="Live now" value="3" foot="2 upcoming" />
        <Stat label="At risk" value={`${atRiskStudents.length}`} foot="chronic absentees" footColor="text-destructive" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background p-6 lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">Attendance rate</h3>
              <p className="text-xs text-muted-foreground">Whole school · updates with your filters</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{presentPct}<span className="text-base text-muted-foreground">%</span></div>
              <div className={`text-xs ${trendDelta >= 0 ? "text-success" : "text-destructive"}`}>
                {trendDelta >= 0 ? "↗" : "↘"} {Math.abs(trendDelta)}pt
              </div>
            </div>
          </div>
          <LineChart points={trend} />
        </div>

        <div className="rounded-2xl border border-border bg-background p-6">
          <h3 className="text-lg font-semibold">Today's breakdown</h3>
          <div className="mt-6 grid place-items-center">
            <Donut counts={todayCounts} />
          </div>
          <ul className="mt-6 space-y-2 text-sm">
            <BreakdownRow color="bg-success" label="Present" value={todayCounts.present} total={todayCounts.total} />
            <BreakdownRow color="bg-warning" label="Late" value={todayCounts.late} total={todayCounts.total} />
            <BreakdownRow color="bg-info" label="Excused" value={todayCounts.excused} total={todayCounts.total} />
            <BreakdownRow color="bg-destructive" label="Absent" value={todayCounts.absent} total={todayCounts.total} />
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            Today's sessions
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">3 live</span>
          </h3>
          <div className="mt-4 space-y-2">
            {CLASSES.map((c, i) => {
              const p = classProgress(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => onOpenClass(c.id)}
                  className="w-full text-left flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3 hover:border-primary/50 transition"
                >
                  <div className="w-12 text-sm font-semibold tabular-nums">{c.time}</div>
                  <div className="flex-1">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.room} · {c.teacher}</div>
                  </div>
                  <div className="hidden w-40 sm:block">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-success" style={{ width: `${p.total ? (p.checked / p.total) * 100 : 0}%` }} />
                    </div>
                    <div className="mt-1 text-right text-xs text-muted-foreground">{p.checked}/{p.total}</div>
                  </div>
                  {i < 3 ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Upcoming</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background p-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertOctagon className="h-5 w-5 text-destructive" /> Needs attention
          </h3>
          <ul className="mt-4 space-y-3">
            {atRiskStudents.length === 0 ? (
              <li className="text-sm text-muted-foreground">Everyone is on track 🎉</li>
            ) : atRiskStudents.map((s: any) => {
              const initials = s.name.split(" ").map((p: string) => p[0]).slice(0, 2).join("");
              return (
                <li key={s.id} className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{initials}</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.grade} · {s.absentDays} days absent</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-destructive">{s.rate}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">at risk</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}

// ---------------- Sessions ----------------
function SessionsView({ liveClasses, classProgress, onOpenClass }: any) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <h3 className="text-lg font-semibold">Today's sessions</h3>
      <div className="mt-4 space-y-2">
        {CLASSES.map((c) => {
          const p = classProgress(c.id);
          const live = liveClasses.find((x: any) => x.id === c.id);
          return (
            <div key={c.id} className="flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3">
              <div className="w-12 text-sm font-semibold tabular-nums">{c.time}</div>
              <div className="flex-1">
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.room} · {c.teacher}</div>
              </div>
              <div className="hidden w-40 sm:block">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-success" style={{ width: `${p.total ? (p.checked / p.total) * 100 : 0}%` }} />
                </div>
                <div className="mt-1 text-right text-xs text-muted-foreground">{p.checked}/{p.total}</div>
              </div>
              {live ? (
                <span className="flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Upcoming</span>
              )}
              <Button size="sm" variant="outline" onClick={() => onOpenClass(c.id)}>
                Open roster
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Reports ----------------
function ReportsView({ sessions, students, classFilter, trend }: any) {
  const rows = useMemo(() => {
    return CLASSES
      .filter((c) => classFilter === "all" || c.id === classFilter)
      .map((c) => {
        const sess = sessions.find((s: Session) => s.classId === c.id);
        const counts: Record<Status, number> = { present: 0, late: 0, excused: 0, absent: 0 };
        const total = Object.keys(sess?.statuses ?? {}).length;
        for (const st of Object.values(sess?.statuses ?? {}) as Status[]) counts[st]++;
        const rate = total ? +(((counts.present + counts.late) / total) * 100).toFixed(1) : 0;
        return { class: c.name, teacher: c.teacher, total, rate, ...counts };
      });
  }, [sessions, classFilter]);

  function exportCsv() {
    const headers = ["class", "teacher", "total", "present", "late", "excused", "absent", "rate"];
    const lines = [headers.join(",")];
    for (const r of rows) lines.push(headers.map((h) => (r as any)[h]).join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "rollcall-demo-report.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const maxRate = Math.max(...rows.map((r) => r.rate), 100);

  return (
    <>
      <div className="rounded-2xl border border-border bg-background p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Class attendance</h3>
            <p className="text-xs text-muted-foreground">{rows.length} classes</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1.5" /> Export CSV
          </Button>
        </div>
        <div className="mt-5 space-y-3">
          {rows.map((r) => (
            <div key={r.class}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{r.class} <span className="text-muted-foreground">· {r.teacher}</span></span>
                <span className="tabular-nums font-semibold">{r.rate}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(r.rate / maxRate) * 100}%` }} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {r.present} present · {r.late} late · {r.excused} excused · {r.absent} absent
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-background p-6">
        <h3 className="text-lg font-semibold">Trend</h3>
        <LineChart points={trend} />
      </div>
    </>
  );
}

// ---------------- Students ----------------
function StudentsView({ students, sessions, classFilter, onOpenClass }: any) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    return students.filter((s: Student) => {
      if (classFilter !== "all" && s.classId !== classFilter) return false;
      if (!q.trim()) return true;
      return s.name.toLowerCase().includes(q.toLowerCase());
    });
  }, [students, classFilter, q]);

  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Students</h3>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…" className="pl-9" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
            <tr>
              <th className="py-2 pr-3 font-medium">Name</th>
              <th className="py-2 pr-3 font-medium">Grade</th>
              <th className="py-2 pr-3 font-medium">Class</th>
              <th className="py-2 pr-3 font-medium">Today</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map((s: Student) => {
              const cls = CLASSES.find((c) => c.id === s.classId)!;
              const status = sessions.find((x: Session) => x.classId === s.classId)?.statuses[s.id] ?? "absent";
              return (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2 pr-3 font-medium">{s.name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">Grade {s.grade}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{cls.name}</td>
                  <td className="py-2 pr-3"><StatusPill status={status} /></td>
                  <td className="py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => onOpenClass(s.classId)}>Open class</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 50 && (
          <div className="pt-3 text-xs text-muted-foreground">Showing first 50 of {filtered.length}.</div>
        )}
      </div>
    </div>
  );
}

// ---------------- Dialogs / Sheets ----------------
function ScanDialog({ open, onClose, students, sessions, onScan }: any) {
  const [classId, setClassId] = useState(CLASSES[0].id);
  const [studentId, setStudentId] = useState<string>("");
  const opts = students.filter((s: Student) => s.classId === classId);
  const sess = sessions.find((x: Session) => x.classId === classId);
  const current = studentId ? sess?.statuses[studentId] : null;

  function scan() {
    if (!studentId) return;
    onScan(classId, studentId);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Simulate a QR scan</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Class kiosk</label>
            <Select value={classId} onValueChange={(v) => { setClassId(v); setStudentId(""); }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLASSES.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.teacher}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Student card</label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a student to scan" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {opts.map((s: Student) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {current && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              Current status: <StatusPill status={current} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={scan} disabled={!studentId}>
            <Check className="h-4 w-4 mr-1.5" /> Mark present
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DrillDownSheet({ classId, onClose, students, sessions, onSetStatus }: any) {
  const cls = CLASSES.find((c) => c.id === classId);
  const sess = sessions.find((s: Session) => s.classId === classId);
  const list = students.filter((s: Student) => s.classId === classId);

  return (
    <Sheet open={!!classId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{cls?.name}</SheetTitle>
          <p className="text-xs text-muted-foreground">{cls?.room} · {cls?.teacher} · {list.length} students</p>
        </SheetHeader>
        <div className="mt-4 space-y-1">
          {list.map((s: Student) => {
            const status = sess?.statuses[s.id] ?? "absent";
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div className="text-sm font-medium">{s.name}</div>
                <div className="flex items-center gap-1">
                  {(["present", "late", "excused", "absent"] as Status[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => onSetStatus(classId!, s.id, st)}
                      className={`text-[10px] uppercase font-semibold tracking-wider rounded-md px-2 py-1 transition ${
                        status === st ? STATUS_BG[st] + " text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
                      }`}
                    >
                      {st[0]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------- Primitives ----------------
const STATUS_BG: Record<Status, string> = {
  present: "bg-success",
  late: "bg-warning",
  excused: "bg-info",
  absent: "bg-destructive",
};

function StatusPill({ status }: { status: Status }) {
  const label = status[0].toUpperCase() + status.slice(1);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-white ${STATUS_BG[status]}`}>
      {label}
    </span>
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

function BreakdownRow({ color, label, value, total }: any) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        {label}
      </span>
      <span className="flex items-center gap-3">
        <span className="font-semibold tabular-nums">{value}</span>
        <span className="w-8 text-right text-xs text-muted-foreground">{pct}%</span>
      </span>
    </li>
  );
}

function LineChart({ points }: { points: DayRecord[] }) {
  if (!points.length) return null;
  const W = 600, H = 200, P = 10;
  const xs = points.map((_, i) => P + (i / Math.max(1, points.length - 1)) * (W - P * 2));
  const ys = points.map((p) => H - P - ((p.presentRate - 60) / 40) * (H - P * 2));
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const area = `${d} L${xs[xs.length - 1]},${H} L${xs[0]},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-56 w-full">
      <defs>
        <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={H - P - ((90 - 60) / 40) * (H - P * 2)} x2={W} y2={H - P - ((90 - 60) / 40) * (H - P * 2)}
        stroke="var(--success)" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.6" />
      <path d={area} fill="url(#dg)" />
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="4" fill="var(--primary)" />
    </svg>
  );
}

function Donut({ counts }: { counts: { present: number; late: number; excused: number; absent: number; total: number } }) {
  const C = 2 * Math.PI * 60;
  const total = Math.max(1, counts.total);
  const segs = [
    { v: counts.present, color: "var(--success)" },
    { v: counts.late, color: "var(--warning)" },
    { v: counts.excused, color: "var(--info)" },
    { v: counts.absent, color: "var(--destructive)" },
  ];
  let offset = 0;
  const pct = +(((counts.present + counts.late) / total) * 100).toFixed(1);
  return (
    <svg viewBox="0 0 160 160" className="h-44 w-44 -rotate-90">
      <circle cx="80" cy="80" r="60" fill="none" stroke="var(--muted)" strokeWidth="20" />
      {segs.map((s, i) => {
        const len = (s.v / total) * C;
        const el = (
          <circle key={i} cx="80" cy="80" r="60" fill="none"
            stroke={s.color} strokeWidth="20"
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
        );
        offset += len;
        return el;
      })}
      <g transform="rotate(90 80 80)">
        <text x="80" y="78" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--foreground)">{pct}%</text>
        <text x="80" y="96" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">checked in</text>
      </g>
    </svg>
  );
}
