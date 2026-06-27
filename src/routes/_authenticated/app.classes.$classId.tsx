import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getClass, addStudent, rotateStudentQr, deleteStudent } from "@/lib/classes.functions";
import { getClassRoster, markAttendance } from "@/lib/attendance.functions";
import { createKioskSession, listKioskSessions, revokeKioskSession } from "@/lib/kiosk.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Printer, QrCode, RefreshCcw, Trash2, ArrowLeft, Copy, Power } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/classes/$classId")({
  component: ClassDetailPage,
});

type Roster = Awaited<ReturnType<typeof getClassRoster>>["roster"];
type ClassRow = Awaited<ReturnType<typeof getClass>>["cls"];
type Session = Awaited<ReturnType<typeof listKioskSessions>>[number];

function ClassDetailPage() {
  const { classId } = Route.useParams();
  const fGetClass = useServerFn(getClass);
  const fRoster = useServerFn(getClassRoster);
  const fAdd = useServerFn(addStudent);
  const fRotate = useServerFn(rotateStudentQr);
  const fDelete = useServerFn(deleteStudent);
  const fMark = useServerFn(markAttendance);
  const fCreateSession = useServerFn(createKioskSession);
  const fListSessions = useServerFn(listKioskSessions);
  const fRevoke = useServerFn(revokeKioskSession);

  const [cls, setCls] = useState<ClassRow | null>(null);
  const [roster, setRoster] = useState<Roster>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [studentName, setStudentName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [duration, setDuration] = useState<"30m" | "2h" | "8h">("2h");

  const refresh = useCallback(async () => {
    const [c, r, s] = await Promise.all([
      fGetClass({ data: { classId } }),
      fRoster({ data: { classId } }),
      fListSessions({ data: { classId } }),
    ]);
    setCls(c.cls);
    setRoster(r.roster);
    setSessions(s);
  }, [classId, fGetClass, fRoster, fListSessions]);

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

  async function handleMark(studentId: string, status: "present" | "absent" | "late") {
    try {
      await fMark({ data: { studentId, classId, status } });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleStartSession() {
    try {
      const s = await fCreateSession({ data: { classId, duration } });
      toast.success("Kiosk session ready");
      void s;
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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link to="/app/classes" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> All classes
      </Link>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">{cls?.name ?? "…"}</h1>
          {cls?.grade && <p className="text-muted-foreground">Grade {cls.grade}</p>}
        </div>
        <Link to="/app/classes/$classId/qr" params={{ classId }}>
          <Button variant="outline">
            <Printer className="h-4 w-4 mr-2" /> Print QR sheet
          </Button>
        </Link>
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
        <form onSubmit={handleAddStudent} className="grid sm:grid-cols-[1fr_180px_auto] gap-3">
          <div>
            <Label className="text-xs">Full name</Label>
            <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
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

      <h2 className="font-semibold mb-3">
        Today's roster ({roster.filter((s) => s.status === "present" || s.status === "late").length}/
        {roster.length} present)
      </h2>
      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Student</th>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Status</th>
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
                        onClick={() => handleMark(s.id, st)}
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
                <td className="px-4 py-2 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await fRotate({ data: { studentId: s.id } });
                      toast.success("QR rotated");
                      refresh();
                    }}
                    title="Rotate QR token"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm("Delete this student?")) return;
                      await fDelete({ data: { studentId: s.id } });
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
                <td colSpan={4} className="text-center text-muted-foreground py-8">
                  No students yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
