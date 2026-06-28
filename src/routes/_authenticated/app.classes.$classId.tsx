import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getClass,
  addStudent,
  rotateStudentQr,
  deleteStudent,
  updateClass,
  deleteClass,
} from "@/lib/classes.functions";
import {
  getClassRoster,
  markAttendance,
  bulkMarkAllPresent,
  getStudentHistory,
  exportClassAttendance,
  setStudentNote,
} from "@/lib/attendance.functions";
import {
  createKioskSession,
  listKioskSessions,
  revokeKioskSession,
} from "@/lib/kiosk.functions";
import { getMyContext, listTeachers } from "@/lib/auth.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Printer,
  QrCode,
  RefreshCcw,
  Trash2,
  ArrowLeft,
  Copy,
  Power,
  CheckCheck,
  History,
  Download,
  StickyNote,
  Settings2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/classes/$classId")({
  component: ClassDetailPage,
});

type Roster = Awaited<ReturnType<typeof getClassRoster>>["roster"];
type ClassRow = Awaited<ReturnType<typeof getClass>>["cls"];
type Session = Awaited<ReturnType<typeof listKioskSessions>>[number];
type HistoryRow = Awaited<ReturnType<typeof getStudentHistory>>[number];

function ClassDetailPage() {
  const { classId } = Route.useParams();
  const fGetClass = useServerFn(getClass);
  const fRoster = useServerFn(getClassRoster);
  const fAdd = useServerFn(addStudent);
  const fRotate = useServerFn(rotateStudentQr);
  const fDeleteStudent = useServerFn(deleteStudent);
  const fMark = useServerFn(markAttendance);
  const fBulk = useServerFn(bulkMarkAllPresent);
  const fHistory = useServerFn(getStudentHistory);
  const fExport = useServerFn(exportClassAttendance);
  const fUpdateClass = useServerFn(updateClass);
  const fDeleteClass = useServerFn(deleteClass);
  const fCreateSession = useServerFn(createKioskSession);
  const fListSessions = useServerFn(listKioskSessions);
  const fRevoke = useServerFn(revokeKioskSession);
  const fSetNote = useServerFn(setStudentNote);
  const fCtx = useServerFn(getMyContext);
  const fTeachers = useServerFn(listTeachers);

  const [isAdmin, setIsAdmin] = useState(false);
  const [teachers, setTeachers] = useState<Array<{ user_id: string; full_name: string | null }>>([]);
  const [cls, setCls] = useState<ClassRow | null>(null);
  const [roster, setRoster] = useState<Roster>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [studentName, setStudentName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [duration, setDuration] = useState<"30m" | "2h" | "8h">("2h");
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [historyOpen, setHistoryOpen] = useState<{ id: string; name: string } | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGrade, setEditGrade] = useState("");
  const [editTeacher, setEditTeacher] = useState("");
  const [exportFrom, setExportFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [exportTo, setExportTo] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    fCtx({}).then((c) => {
      setIsAdmin(c.isAdmin);
      if (c.isAdmin) fTeachers({}).then(setTeachers).catch(() => {});
    });
  }, [fCtx, fTeachers]);


  const refresh = useCallback(async () => {
    const [c, r, s] = await Promise.all([
      fGetClass({ data: { classId } }),
      fRoster({ data: { classId, day } }),
      fListSessions({ data: { classId } }),
    ]);
    setCls(c.cls);
    setRoster(r.roster);
    setSessions(s);
    setEditName(c.cls.name);
    setEditGrade(c.cls.grade ?? "");
    setEditTeacher(c.cls.teacher_id);

  }, [classId, day, fGetClass, fRoster, fListSessions]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    try {
      await fAdd({
        data: { classId, full_name: studentName, external_id: externalId || undefined },
      });
      setStudentName("");
      setExternalId("");
      toast.success("Student added");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleMark(
    studentId: string,
    status: "present" | "absent" | "late",
    note?: string | null,
  ) {
    try {
      await fMark({ data: { studentId, classId, status, day, note: note ?? null } });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleBulk() {
    try {
      const r = await fBulk({ data: { classId, day } });
      toast.success(`${r.inserted} students marked present`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleStartSession() {
    try {
      await fCreateSession({ data: { classId, duration } });
      toast.success("Kiosk session ready");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function openHistory(s: { id: string; full_name: string }) {
    setHistoryOpen({ id: s.id, name: s.full_name });
    const rows = await fHistory({ data: { studentId: s.id, days: 30 } });
    setHistory(rows);
  }

  async function handleExport() {
    try {
      const { students, events } = await fExport({
        data: { classId, from: exportFrom, to: exportTo },
      });
      const dayList: string[] = [];
      const start = new Date(exportFrom);
      const end = new Date(exportTo);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dayList.push(d.toISOString().slice(0, 10));
      }
      const byKey = new Map<string, string>();
      for (const e of events) byKey.set(`${e.student_id}|${e.day}`, e.status);
      const header = ["Student", "External ID", ...dayList];
      const lines = [header.join(",")];
      for (const s of students) {
        const row = [
          `"${s.full_name.replace(/"/g, '""')}"`,
          s.external_id ?? "",
          ...dayList.map((d) => byKey.get(`${s.id}|${d}`) ?? ""),
        ];
        lines.push(row.join(","));
      }
      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${cls?.name ?? "class"}-${exportFrom}-to-${exportTo}.csv`;
      a.click();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleSaveSettings() {
    try {
      await fUpdateClass({
        data: {
          classId,
          name: editName,
          grade: editGrade || null,
          teacherId: isAdmin && editTeacher ? editTeacher : undefined,
        },
      });
      toast.success("Class updated");
      setSettingsOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }


  const activeSession = sessions.find(
    (s) => !s.revoked_at && new Date(s.expires_at).getTime() > Date.now(),
  );
  const kioskUrl = activeSession
    ? typeof window !== "undefined"
      ? `${window.location.origin}/kiosk/${activeSession.token}`
      : ""
    : "";

  const presentCount = roster.filter(
    (s) => s.status === "present" || s.status === "late",
  ).length;
  const isToday = day === new Date().toISOString().slice(0, 10);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link
        to="/app/classes"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> All classes
      </Link>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">{cls?.name ?? "…"}</h1>
          {cls?.grade && <p className="text-muted-foreground">Grade {cls.grade}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" /> Settings
          </Button>
          <Link to="/app/classes/$classId/qr" params={{ classId }}>
            <Button variant="outline">
              <Printer className="h-4 w-4 mr-2" /> Print QR sheet
            </Button>
          </Link>
        </div>
      </div>

      <Card className="p-5 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <QrCode className="h-4 w-4" /> Kiosk session
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Open the kiosk URL on a tablet or laptop with a camera. Students scan their QR.
            </p>
          </div>
          {!activeSession ? (
            <div className="flex items-center gap-2">
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value as "30m" | "2h" | "8h")}
                className="h-9 rounded-md border px-2 text-sm"
              >
                <option value="30m">30 minutes</option>
                <option value="2h">2 hours</option>
                <option value="8h">8 hours</option>
              </select>
              <Button onClick={handleStartSession}>Start session</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(kioskUrl);
                  toast.success("Link copied");
                }}
              >
                <Copy className="h-4 w-4 mr-2" /> Copy link
              </Button>
              <a href={kioskUrl} target="_blank" rel="noreferrer">
                <Button>Open kiosk</Button>
              </a>
              <Button
                variant="ghost"
                onClick={async () => {
                  await fRevoke({ data: { id: activeSession.id } });
                  refresh();
                }}
              >
                <Power className="h-4 w-4 mr-2" /> End
              </Button>
            </div>
          )}
        </div>
        {activeSession && (
          <div className="mt-3 text-xs text-muted-foreground break-all">{kioskUrl}</div>
        )}
      </Card>

      <Card className="p-5 mb-6">
        <h2 className="font-semibold mb-3">Add student</h2>
        <form
          onSubmit={handleAddStudent}
          className="grid sm:grid-cols-[1fr_180px_auto] gap-3"
        >
          <div>
            <Label className="text-xs">Full name</Label>
            <Input
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label className="text-xs">External ID (optional)</Label>
            <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="submit">Add</Button>
          </div>
        </form>
      </Card>

      <Card className="p-5 mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Download className="h-4 w-4" /> Export attendance
        </h2>
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={handleExport}>Download CSV</Button>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <h2 className="font-semibold">
          Roster for {isToday ? "today" : day} ({presentCount}/{roster.length} present)
        </h2>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="w-44"
          />
          <Button onClick={handleBulk} variant="outline">
            <CheckCheck className="h-4 w-4 mr-2" /> Mark all present
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Student</th>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Note</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2 font-medium">{s.full_name}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.external_id ?? "—"}</td>
                <td className="px-4 py-2">
                  <div className="inline-flex rounded-md border bg-background overflow-hidden text-xs">
                    {(["present", "late", "absent"] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => handleMark(s.id, st, s.note)}
                        className={`px-3 py-1 capitalize ${
                          s.status === st
                            ? st === "present"
                              ? "bg-emerald-500 text-white"
                              : st === "late"
                                ? "bg-amber-500 text-white"
                                : "bg-rose-500 text-white"
                            : "hover:bg-muted"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2 max-w-[200px]">
                  {noteOpenFor === s.id ? (
                    <div className="flex gap-1">
                      <Input
                        autoFocus
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="e.g. Doctor's note"
                        className="h-7 text-xs"
                      />
                      <Button
                        size="sm"
                        className="h-7"
                        onClick={async () => {
                          try {
                            await fSetNote({
                              data: {
                                studentId: s.id,
                                classId,
                                day,
                                note: noteText || null,
                              },
                            });
                            setNoteOpenFor(null);
                            setNoteText("");
                            refresh();
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed");
                          }
                        }}
                      >
                        Save
                      </Button>

                    </div>
                  ) : (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      onClick={() => {
                        setNoteOpenFor(s.id);
                        setNoteText(s.note ?? "");
                      }}
                    >
                      <StickyNote className="h-3 w-3" />
                      {s.note ? <span className="truncate max-w-[150px]">{s.note}</span> : "Add"}
                    </button>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openHistory(s)}
                    title="History"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setQrHistoryFor({ id: s.id, name: s.full_name })}
                    title="QR history & reissue"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm("Delete this student?")) return;
                      await fDeleteStudent({ data: { studentId: s.id } });
                      refresh();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {roster.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted-foreground py-8">
                  No students yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Sheet
        open={!!historyOpen}
        onOpenChange={(o) => {
          if (!o) setHistoryOpen(null);
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{historyOpen?.name} — last 30 days</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2 max-h-[80vh] overflow-auto">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events.</p>
            ) : (
              history.map((h) => (
                <div
                  key={h.day}
                  className="flex items-center justify-between border rounded-md px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-medium">{h.day}</div>
                    {h.note && (
                      <div className="text-xs text-muted-foreground">{h.note}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${
                        h.status === "present"
                          ? "bg-emerald-100 text-emerald-700"
                          : h.status === "late"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {h.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {h.method}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Class settings</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>Grade</Label>
              <Input value={editGrade} onChange={(e) => setEditGrade(e.target.value)} />
            </div>
            {isAdmin && (
              <div>
                <Label>Teacher</Label>
                <select
                  value={editTeacher}
                  onChange={(e) => setEditTeacher(e.target.value)}
                  className="h-9 w-full rounded-md border px-2 text-sm"
                >
                  {teachers.length === 0 && <option value={editTeacher}>Current teacher</option>}
                  {teachers.map((t) => (
                    <option key={t.user_id} value={t.user_id}>
                      {t.full_name ?? t.user_id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Button onClick={handleSaveSettings}>Save</Button>

            <div className="pt-6 border-t">
              <Button
                variant="ghost"
                className="text-rose-600"
                onClick={async () => {
                  if (!confirm(`Delete ${cls?.name}? This removes all students and attendance.`))
                    return;
                  try {
                    await fDeleteClass({ data: { classId } });
                    toast.success("Class deleted");
                    window.location.href = "/app/classes";
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed");
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete class
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
