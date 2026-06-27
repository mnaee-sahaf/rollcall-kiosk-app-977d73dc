import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getMyContext, completeOnboarding, inviteTeacher, listTeachers } from "@/lib/auth.functions";
import { getSettings, updateSettings } from "@/lib/settings.functions";
import { createClass, listClasses, bulkAddStudents } from "@/lib/classes.functions";
import { createKioskSession } from "@/lib/kiosk.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Check,
  Building2,
  Users,
  GraduationCap,
  UserPlus,
  Rocket,
  Upload,
  Copy,
  Plus,
  Trash2,
  ExternalLink,
  Printer,
  MonitorSmartphone,
  ArrowRight,
} from "lucide-react";
import { Logo } from "@/components/landing/Logo";

const searchSchema = z.object({ step: z.number().int().min(1).max(5).optional() });

export const Route = createFileRoute("/_authenticated/app/onboarding")({
  validateSearch: searchSchema,
  component: OnboardingPage,
});

type StepKey = 1 | 2 | 3 | 4 | 5;
const STEPS: Array<{ id: StepKey; label: string; icon: typeof Building2 }> = [
  { id: 1, label: "School profile", icon: Building2 },
  { id: 2, label: "Invite teachers", icon: Users },
  { id: 3, label: "Create a class", icon: GraduationCap },
  { id: 4, label: "Add students", icon: UserPlus },
  { id: 5, label: "Try it out", icon: Rocket },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const step = (search.step ?? 1) as StepKey;

  const fCtx = useServerFn(getMyContext);
  const fComplete = useServerFn(completeOnboarding);
  const [checking, setChecking] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);

  useEffect(() => {
    fCtx({}).then((c) => {
      if (!c.isAdmin) {
        navigate({ to: "/app", replace: true });
        return;
      }
      setChecking(false);
    });
  }, [fCtx, navigate]);

  const goto = (s: StepKey) => navigate({ to: "/app/onboarding", search: { step: s }, replace: true });

  async function skipAll() {
    try {
      await fComplete({});
      toast.success("You can finish setup anytime from the dashboard.");
      navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function finish() {
    try {
      await fComplete({});
      toast.success("You're all set!");
      navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfbf8] flex">
      <aside className="hidden md:flex w-72 flex-col border-r bg-white px-6 py-8">
        <Logo />
        <div className="mt-10 mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          Get started
        </div>
        <ol className="space-y-1">
          {STEPS.map((s) => {
            const done = s.id < step;
            const active = s.id === step;
            const Icon = s.icon;
            return (
              <li key={s.id}>
                <button
                  onClick={() => goto(s.id)}
                  className={`w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-left transition ${
                    active
                      ? "bg-primary/10 text-primary font-semibold"
                      : done
                        ? "text-foreground hover:bg-muted"
                        : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      done
                        ? "bg-primary text-primary-foreground"
                        : active
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : s.id}
                  </span>
                  <Icon className="h-4 w-4" />
                  {s.label}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-auto pt-6">
          <button onClick={skipAll} className="text-xs text-muted-foreground hover:underline">
            Skip setup for now
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-6 py-10 md:px-12 md:py-14">
        <div className="md:hidden mb-6 flex items-center justify-between">
          <Logo />
          <button onClick={skipAll} className="text-xs text-muted-foreground hover:underline">
            Skip
          </button>
        </div>
        <div className="max-w-2xl mx-auto">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Step {step} of 5
          </div>
          {step === 1 && <StepSchool onNext={() => goto(2)} />}
          {step === 2 && <StepTeachers onNext={() => goto(3)} onBack={() => goto(1)} />}
          {step === 3 && (
            <StepClass
              onCreated={(id) => setClassId(id)}
              classId={classId}
              onNext={() => goto(4)}
              onBack={() => goto(2)}
            />
          )}
          {step === 4 && (
            <StepStudents
              classId={classId}
              onNext={() => goto(5)}
              onBack={() => goto(3)}
              onPickClass={setClassId}
            />
          )}
          {step === 5 && (
            <StepTry classId={classId} onFinish={finish} onBack={() => goto(4)} />
          )}
        </div>
      </main>
    </div>
  );
}

/* ---------- Step 1: School ---------- */
function StepSchool({ onNext }: { onNext: () => void }) {
  const fGet = useServerFn(getSettings);
  const fUpdate = useServerFn(updateSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [cutoff, setCutoff] = useState("09:00");
  const [absentAfter, setAbsentAfter] = useState("10:30");
  const [tz, setTz] = useState(
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC",
  );

  useEffect(() => {
    fGet({}).then((s) => {
      if (s) {
        setName(s.school_name ?? "");
        setLogoUrl(s.logo_url ?? null);
        setCutoff((s.day_cutoff_time ?? "09:00").slice(0, 5));
        setAbsentAfter((s.absent_after_time ?? "10:30").slice(0, 5));
        if (s.timezone) setTz(s.timezone);
      }
      setLoading(false);
    });
  }, [fGet]);

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("school-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("school-assets")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signed?.signedUrl) setLogoUrl(signed.signedUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      toast.error("School name is required");
      return;
    }
    setSaving(true);
    try {
      await fUpdate({
        data: {
          school_name: name.trim(),
          logo_url: logoUrl,
          day_cutoff_time: cutoff,
          absent_after_time: absentAfter,
          timezone: tz,
        },
      });
      onNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold">Tell us about your school</h1>
      <p className="text-muted-foreground mt-1">
        This appears on kiosks, printable QR sheets, and reports.
      </p>
      <Card className="p-6 mt-6 space-y-5">
        <div>
          <Label>School name *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Lincoln High School"
          />
        </div>
        <div>
          <Label>Logo</Label>
          <div className="flex items-center gap-4 mt-1">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="logo"
                className="h-16 w-16 rounded border object-contain bg-white"
              />
            ) : (
              <div className="h-16 w-16 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                No logo
              </div>
            )}
            <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border bg-white px-3 py-2 text-sm hover:bg-muted">
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : "Upload"}
              <input type="file" accept="image/*" hidden onChange={handleLogo} />
            </label>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Late after</Label>
            <Input type="time" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
          </div>
          <div>
            <Label>Absent after</Label>
            <Input
              type="time"
              value={absentAfter}
              onChange={(e) => setAbsentAfter(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label>Timezone</Label>
          <Input value={tz} onChange={(e) => setTz(e.target.value)} />
        </div>
      </Card>
      <div className="mt-6 flex justify-end">
        <Button onClick={save} disabled={saving || !name.trim()}>
          {saving ? "Saving…" : "Continue"}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

/* ---------- Step 2: Teachers ---------- */
function StepTeachers({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const fInvite = useServerFn(inviteTeacher);
  const [rows, setRows] = useState<Array<{ email: string }>>([{ email: "" }]);
  const [sent, setSent] = useState<Array<{ email: string; link: string }>>([]);
  const [sending, setSending] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function addRow() {
    setRows((r) => [...r, { email: "" }]);
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function sendAll() {
    const valid = rows
      .map((r) => r.email.trim())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (valid.length === 0) {
      toast.error("Add at least one valid email");
      return;
    }
    setSending(true);
    const out: Array<{ email: string; link: string }> = [];
    for (const email of valid) {
      try {
        const { invite } = await fInvite({ data: { email } });
        out.push({ email, link: `${origin}/auth?invite=${invite.token}` });
      } catch (err) {
        toast.error(`${email}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    setSent((s) => [...s, ...out]);
    setRows([{ email: "" }]);
    setSending(false);
    if (out.length) toast.success(`Generated ${out.length} invite link${out.length === 1 ? "" : "s"}`);
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Invite teachers</h1>
      <p className="text-muted-foreground mt-1">
        Send invite links so teachers can sign in and manage their own classes. You can skip and
        add them later.
      </p>

      <Card className="p-6 mt-6 space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <Input
              type="email"
              placeholder="teacher@school.edu"
              value={row.email}
              onChange={(e) =>
                setRows((rs) => rs.map((r, idx) => (idx === i ? { email: e.target.value } : r)))
              }
            />
            {rows.length > 1 && (
              <Button variant="ghost" size="icon" onClick={() => removeRow(i)} type="button">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        <div className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={addRow} type="button">
            <Plus className="h-4 w-4 mr-1" /> Add another
          </Button>
          <Button onClick={sendAll} disabled={sending} type="button">
            {sending ? "Generating…" : "Generate invite links"}
          </Button>
        </div>
      </Card>

      {sent.length > 0 && (
        <Card className="p-5 mt-4 space-y-2 bg-emerald-50/50 border-emerald-200">
          <div className="text-sm font-semibold text-emerald-900">
            Share these links with your teachers
          </div>
          {sent.map((s) => (
            <div key={s.link} className="flex items-center gap-2 text-sm">
              <span className="font-mono text-xs flex-1 truncate">{s.email}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(s.link);
                  toast.success("Copied");
                }}
              >
                <Copy className="h-3 w-3 mr-1" /> Copy link
              </Button>
            </div>
          ))}
        </Card>
      )}

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} variant={sent.length ? "default" : "outline"}>
          {sent.length ? "Continue" : "Skip for now"}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

/* ---------- Step 3: Class ---------- */
function StepClass({
  onCreated,
  classId,
  onNext,
  onBack,
}: {
  onCreated: (id: string) => void;
  classId: string | null;
  onNext: () => void;
  onBack: () => void;
}) {
  const fCreate = useServerFn(createClass);
  const fList = useServerFn(listClasses);
  const fTeachers = useServerFn(listTeachers);
  const fCtx = useServerFn(getMyContext);
  const [classes, setClasses] = useState<Array<{ id: string; name: string; grade: string | null }>>([]);
  const [teachers, setTeachers] = useState<Array<{ user_id: string; full_name: string | null }>>([]);
  const [me, setMe] = useState<{ userId: string; email?: string } | null>(null);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [saving, setSaving] = useState(false);

  function refresh() {
    fList({}).then((rows) =>
      setClasses(rows.map((r) => ({ id: r.id, name: r.name, grade: r.grade }))),
    );
  }
  useEffect(() => {
    refresh();
    fCtx({}).then((c) => setMe({ userId: c.userId, email: c.email }));
    fTeachers({}).then(setTeachers).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (!name.trim()) {
      toast.error("Class name required");
      return;
    }
    setSaving(true);
    try {
      const row = await fCreate({
        data: {
          name: name.trim(),
          grade: grade.trim() || undefined,
          teacherId: teacherId || undefined,
        },
      });
      onCreated(row.id);
      setName("");
      setGrade("");
      setTeacherId("");
      refresh();
      toast.success("Class created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Create your first class</h1>
      <p className="text-muted-foreground mt-1">
        You can add more classes anytime. Pick the teacher who'll manage attendance.
      </p>

      <Card className="p-6 mt-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Class name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="7A" />
          </div>
          <div>
            <Label>Grade (optional)</Label>
            <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Grade 7" />
          </div>
        </div>
        <div>
          <Label>Teacher</Label>
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="">Me ({me?.email ?? "admin"})</option>
            {teachers.map((t) => (
              <option key={t.user_id} value={t.user_id}>
                {t.full_name ?? t.user_id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={create} disabled={saving || !name.trim()}>
          <Plus className="h-4 w-4 mr-1" /> {saving ? "Creating…" : "Create class"}
        </Button>
      </Card>

      {classes.length > 0 && (
        <div className="mt-6">
          <div className="text-sm font-semibold mb-2">Classes so far</div>
          <div className="space-y-2">
            {classes.map((c) => (
              <button
                key={c.id}
                onClick={() => onCreated(c.id)}
                className={`w-full flex items-center justify-between rounded-md border bg-white px-4 py-3 text-sm hover:border-primary transition ${
                  classId === c.id ? "border-primary ring-1 ring-primary" : ""
                }`}
              >
                <span>
                  <span className="font-medium">{c.name}</span>
                  {c.grade && <span className="text-muted-foreground ml-2">· {c.grade}</span>}
                </span>
                {classId === c.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={classes.length === 0}>
          Continue <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

/* ---------- Step 4: Students ---------- */
function StepStudents({
  classId,
  onNext,
  onBack,
  onPickClass,
}: {
  classId: string | null;
  onNext: () => void;
  onBack: () => void;
  onPickClass: (id: string) => void;
}) {
  const fBulk = useServerFn(bulkAddStudents);
  const fList = useServerFn(listClasses);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [text, setText] = useState("");
  const [count, setCount] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fList({}).then((rows) => {
      setClasses(rows.map((r) => ({ id: r.id, name: r.name })));
      if (!classId && rows[0]) onPickClass(rows[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsed = useMemo(() => {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [full_name, external_id] = line.split(",").map((s) => s?.trim());
        return { full_name, external_id: external_id || undefined };
      })
      .filter((r) => r.full_name);
  }, [text]);

  async function save() {
    if (!classId) {
      toast.error("Pick a class first");
      return;
    }
    if (parsed.length === 0) {
      toast.error("Add at least one student name");
      return;
    }
    setSaving(true);
    try {
      const res = await fBulk({ data: { classId, students: parsed } });
      setCount((c) => c + res.inserted);
      setText("");
      toast.success(`Added ${res.inserted} student${res.inserted === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Add students</h1>
      <p className="text-muted-foreground mt-1">
        One name per line. Optionally add a student ID after a comma. Each gets a unique QR code
        automatically.
      </p>

      <Card className="p-6 mt-6 space-y-4">
        {classes.length > 1 && (
          <div>
            <Label>Class</Label>
            <select
              value={classId ?? ""}
              onChange={(e) => onPickClass(e.target.value)}
              className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <Label>Students</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={"Alice Johnson\nBob Smith, S-1042\nCarol Diaz"}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {parsed.length} to add{count > 0 && ` · ${count} added so far`}
          </p>
        </div>
        <div className="flex justify-between items-center">
          <a
            href="/app/import"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            Or use CSV bulk import <ExternalLink className="h-3 w-3" />
          </a>
          <Button onClick={save} disabled={saving || parsed.length === 0 || !classId}>
            {saving ? "Adding…" : `Add ${parsed.length || ""} students`}
          </Button>
        </div>
      </Card>

      <div className="mt-8 flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={count === 0}>
          Continue <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

/* ---------- Step 5: Try ---------- */
function StepTry({
  classId,
  onFinish,
  onBack,
}: {
  classId: string | null;
  onFinish: () => void;
  onBack: () => void;
}) {
  const fKiosk = useServerFn(createKioskSession);
  const [opening, setOpening] = useState(false);

  async function openKiosk() {
    if (!classId) return;
    setOpening(true);
    try {
      const row = await fKiosk({ data: { classId, duration: "2h" } });
      window.open(`/kiosk/${row.token}`, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">You're ready to roll</h1>
      <p className="text-muted-foreground mt-1">
        Print QR cards for students, then open a kiosk on any phone or laptop with a camera.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <Card className="p-6 hover:border-primary transition">
          <Printer className="h-6 w-6 text-primary mb-3" />
          <h3 className="font-semibold">Print QR sheet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            A4 grid of QR cards, one per student, with parent self-lookup QR.
          </p>
          <Button
            variant="outline"
            className="mt-4 w-full"
            disabled={!classId}
            onClick={() => classId && window.open(`/app/classes/${classId}/qr`, "_blank")}
          >
            Open print sheet <ExternalLink className="h-3 w-3 ml-2" />
          </Button>
        </Card>
        <Card className="p-6 hover:border-primary transition">
          <MonitorSmartphone className="h-6 w-6 text-primary mb-3" />
          <h3 className="font-semibold">Open a kiosk</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Creates a 2-hour kiosk session so students can scan their QR codes.
          </p>
          <Button
            variant="outline"
            className="mt-4 w-full"
            disabled={!classId || opening}
            onClick={openKiosk}
          >
            {opening ? "Opening…" : "Launch kiosk"} <ExternalLink className="h-3 w-3 ml-2" />
          </Button>
        </Card>
      </div>

      <Card className="p-5 mt-6 bg-primary/5 border-primary/20">
        <div className="text-sm">
          <div className="font-semibold mb-1">What's next?</div>
          <ul className="text-muted-foreground space-y-1 list-disc pl-5">
            <li>Reports update as soon as scans come in — daily, weekly, monthly.</li>
            <li>Add more classes and students from the sidebar.</li>
            <li>Parents can scan the small QR on each card to see their child's history.</li>
          </ul>
        </div>
      </Card>

      <div className="mt-8 flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onFinish} size="lg">
          Go to dashboard <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
