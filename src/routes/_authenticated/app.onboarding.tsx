import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getMyContext,
  completeOnboarding,
  inviteTeacher,
  listTeachers,
} from "@/lib/auth.functions";
import { getSettings, updateSettings } from "@/lib/settings.functions";
import { createClass, listClasses, bulkAddStudents } from "@/lib/classes.functions";
import { createKioskSession } from "@/lib/kiosk.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Check,
  Users,
  GraduationCap,
  UserPlus,
  Upload,
  Copy,
  Plus,
  Trash2,
  ExternalLink,
  Printer,
  MonitorSmartphone,
  ArrowRight,
  Clock,
  Info,
  X,
  ChevronRight,
  Settings as SettingsIcon,
  Mail,
  HelpCircle,
  AlertCircle,
} from "lucide-react";
import { Logo } from "@/components/landing/Logo";
import { getCountryFlag } from "@/lib/countryFlags";

const searchSchema = z.object({ step: z.number().int().min(1).max(4).optional() });

export const Route = createFileRoute("/_authenticated/app/onboarding")({
  validateSearch: searchSchema,
  component: OnboardingPage,
});

type StepKey = 1 | 2 | 3 | 4;
type StepDef = {
  id: StepKey;
  label: string;
  minutes: number;
  icon: typeof SettingsIcon;
};
const STEPS: StepDef[] = [
  { id: 1, label: "Attendance settings", minutes: 2, icon: SettingsIcon },
  { id: 2, label: "Invite teachers", minutes: 5, icon: Users },
  { id: 3, label: "Create a class", minutes: 3, icon: GraduationCap },
  { id: 4, label: "Add students & try it", minutes: 5, icon: UserPlus },
];

// Common IANA timezones for the selector
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Manila",
  "Australia/Perth",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function OnboardingPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const step = (search.step ?? 1) as StepKey;

  const fCtx = useServerFn(getMyContext);
  const fComplete = useServerFn(completeOnboarding);
  const [checking, setChecking] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [progress, setProgress] = useState({
    hasSchoolName: false,
    hasTeachers: false,
    hasClasses: false,
    hasStudents: false,
  });
  const [confirmClose, setConfirmClose] = useState(false);
  const [step1Saved, setStep1Saved] = useState(false);
  const [step2Skipped, setStep2Skipped] = useState(false);

  async function refreshProgress() {
    const c = await fCtx({});
    setProgress({
      hasSchoolName: c.setupProgress.hasSchoolName,
      hasTeachers: c.setupProgress.hasTeachers,
      hasClasses: c.setupProgress.hasClasses,
      hasStudents: c.setupProgress.hasStudents,
    });
    return c;
  }

  useEffect(() => {
    refreshProgress()
      .then((c) => {
        if (!c.isAdmin) {
          navigate({ to: "/app", replace: true });
          return;
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completed = useMemo(() => {
    return {
      1: step1Saved,
      2: progress.hasTeachers || step2Skipped,
      3: progress.hasClasses,
      4: progress.hasStudents,
    } as Record<StepKey, boolean>;
  }, [step1Saved, step2Skipped, progress]);

  const completedCount = (Object.values(completed) as boolean[]).filter(Boolean).length;
  const pct = Math.round((completedCount / STEPS.length) * 100);

  const goto = (s: StepKey) =>
    navigate({ to: "/app/onboarding", search: { step: s }, replace: true });

  async function finish() {
    try {
      await fComplete({});
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
    <div className="min-h-screen bg-[#f6f7f9] flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white border-b">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden sm:inline text-base font-semibold text-foreground/80">
              Onboarding
            </span>
          </div>
          <button
            onClick={() => setConfirmClose(true)}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground"
            aria-label="Close onboarding"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 px-4 md:px-8 py-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-[320px_1fr] gap-6">
          {/* Left rail */}
          <aside className="md:sticky md:top-24 self-start">
            <Card className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold leading-tight">
                    Complete setting up your organization
                  </h2>
                  <p className="text-xs text-muted-foreground mt-2">
                    {completedCount} of {STEPS.length} steps completed
                  </p>
                </div>
                <ProgressRing pct={pct} />
              </div>

              <ol className="mt-6 space-y-1">
                {STEPS.map((s) => (
                  <StepRow
                    key={s.id}
                    step={s}
                    active={s.id === step}
                    done={completed[s.id]}
                    onClick={() => goto(s.id)}
                  />
                ))}
              </ol>

              <div className="mt-6 pt-4 border-t">
                <a
                  href="mailto:support@rollcall.app"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <HelpCircle className="h-4 w-4" /> Need help?
                </a>
              </div>
            </Card>
          </aside>

          {/* Right panel */}
          <main className="min-w-0">
            {step === 1 && (
              <StepSchool
                onDone={async () => {
                  setStep1Saved(true);
                  await refreshProgress();
                  goto(2);
                }}
              />
            )}
            {step === 2 && (
              <StepTeachers
                onContinue={async (skipped) => {
                  if (skipped) setStep2Skipped(true);
                  await refreshProgress();
                  goto(3);
                }}
                onBack={() => goto(1)}
              />
            )}
            {step === 3 && (
              <StepClass
                classId={classId}
                onCreated={(id) => setClassId(id)}
                onContinue={async () => {
                  await refreshProgress();
                  goto(4);
                }}
                onBack={() => goto(2)}
              />
            )}
            {step === 4 && (
              <StepStudentsAndTry
                classId={classId}
                onPickClass={setClassId}
                onBack={() => goto(3)}
                onFinish={async () => {
                  await refreshProgress();
                  await finish();
                }}
              />
            )}
          </main>
        </div>
      </div>

      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave onboarding?</DialogTitle>
            <DialogDescription>
              You can come back any time from the dashboard. Anything you've already saved is
              kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmClose(false)}>
              Stay here
            </Button>
            <Button
              onClick={async () => {
                setConfirmClose(false);
                navigate({ to: "/app" });
              }}
            >
              Leave for now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Presentational helpers ---------- */

function ProgressRing({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} stroke="hsl(var(--muted))" strokeWidth="6" fill="none" />
        <circle
          cx="32"
          cy="32"
          r={r}
          stroke="hsl(var(--primary))"
          strokeWidth="6"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
        {pct}%
      </div>
    </div>
  );
}

function StepRow({
  step,
  active,
  done,
  onClick,
}: {
  step: StepDef;
  active: boolean;
  done: boolean;
  onClick: () => void;
}) {
  const Icon = step.icon;
  return (
    <li>
      <button
        onClick={onClick}
        className={`relative w-full flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
          active
            ? "border-primary/30 bg-primary/5"
            : "border-transparent hover:bg-muted/60"
        }`}
      >
        {active && (
          <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-primary" />
        )}
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${
            done
              ? "bg-primary text-primary-foreground"
              : active
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm leading-tight truncate ${active ? "font-semibold" : "font-medium"}`}
          >
            {step.label}
          </div>
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" /> {step.minutes} min
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
    </li>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/80">{title}</h3>
      {hint && (
        <span title={hint} className="text-muted-foreground cursor-help">
          <Info className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}

function StepShell({
  title,
  minutes,
  description,
  learnMore,
  children,
  footer,
}: {
  title: string;
  minutes: number;
  description: string;
  learnMore?: { label: string; href: string };
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="px-8 py-7 border-b">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">{title}</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> Takes about {minutes} minutes
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
        {learnMore && (
          <a
            href={learnMore.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline mt-3"
          >
            {learnMore.label} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <div className="px-8 py-6 space-y-8 bg-white">{children}</div>
      <div className="px-8 py-4 border-t bg-muted/30 flex justify-between items-center">
        {footer}
      </div>
    </Card>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-destructive mt-1 inline-flex items-center gap-1">
      <AlertCircle className="h-3 w-3" /> {message}
    </p>
  );
}

/* ---------- Step 1: Attendance settings ---------- */

const step1Schema = z
  .object({
    timezone: z.string().min(1, "Timezone is required").max(64),
    day_cutoff_time: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
    absent_after_time: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  })
  .refine((v) => v.absent_after_time > v.day_cutoff_time, {
    path: ["absent_after_time"],
    message: "Must be later than 'Late after'",
  });

function StepSchool({ onDone }: { onDone: () => void }) {
  const fGet = useServerFn(getSettings);
  const fUpdate = useServerFn(updateSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [orgName, setOrgName] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [cutoff, setCutoff] = useState("09:00");
  const [absentAfter, setAbsentAfter] = useState("10:30");
  const [tz, setTz] = useState(
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fGet({}).then((s) => {
      if (s) {
        setOrgName(s.school_name ?? "");
        setCountry((s as { country?: string | null }).country ?? "");
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
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be 2MB or smaller");
      return;
    }
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
    const parsed = step1Schema.safeParse({
      timezone: tz,
      day_cutoff_time: cutoff,
      absent_after_time: absentAfter,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errs[issue.path.join(".")] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await fUpdate({
        data: {
          logo_url: logoUrl,
          day_cutoff_time: cutoff,
          absent_after_time: absentAfter,
          timezone: tz,
        },
      });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-10 text-muted-foreground text-center">Loading settings…</Card>
    );
  }

  const flag = country ? getCountryFlag(country) : "";

  return (
    <StepShell
      title="Attendance settings"
      minutes={2}
      description="Set how RollCall tracks late and absent students, and add a logo for kiosks and printed QR sheets."
      learnMore={{ label: "Learn how attendance windows work", href: "#" }}
      footer={
        <>
          <span className="text-xs text-muted-foreground">Step 1 of 4</span>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Continue"}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </>
      }
    >
      <section>
        <SectionHeader title="Organization" hint="Edit name, country, and contact details in Settings." />
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
          {flag && <span className="text-2xl leading-none">{flag}</span>}
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{orgName || "Your organization"}</div>
            <div className="text-xs text-muted-foreground">
              {country || "No country set"} · captured during account creation
            </div>
          </div>
          <a
            href="/app/settings"
            className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 shrink-0"
          >
            Edit in Settings <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </section>

      <section>
        <SectionHeader title="Logo" hint="Shown on kiosk, printed QR cards, and reports." />
        <div className="flex items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="logo"
              className="h-16 w-16 rounded-md border object-contain bg-white"
            />
          ) : (
            <div className="h-16 w-16 rounded-md border bg-muted flex items-center justify-center text-xs text-muted-foreground">
              No logo
            </div>
          )}
          <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border bg-white px-3 py-2 text-sm hover:bg-muted">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
            <input type="file" accept="image/*" hidden onChange={handleLogo} />
          </label>
          <span className="text-xs text-muted-foreground">PNG or JPG, up to 2MB</span>
        </div>
      </section>

      <section>
        <SectionHeader title="Timezone" hint="Used to compute the attendance day and report periods." />
        <Select value={tz} onValueChange={setTz}>
          <SelectTrigger className={errors.timezone ? "border-destructive" : ""}>
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {TIMEZONES.map((z) => (
              <SelectItem key={z} value={z}>
                {z.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={errors.timezone} />
      </section>

      <section>
        <SectionHeader
          title="Attendance window"
          hint="Scans before 'Late after' count as present. Between 'Late after' and 'Absent after' count as late. After that, students must be marked absent."
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">Late after</Label>
            <Input
              type="time"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
              className={errors.day_cutoff_time ? "border-destructive" : ""}
            />
            <FieldError message={errors.day_cutoff_time} />
            <p className="text-xs text-muted-foreground mt-1">
              Scans after this time are marked late.
            </p>
          </div>
          <div>
            <Label className="text-sm">Absent after</Label>
            <Input
              type="time"
              value={absentAfter}
              onChange={(e) => setAbsentAfter(e.target.value)}
              className={errors.absent_after_time ? "border-destructive" : ""}
            />
            <FieldError message={errors.absent_after_time} />
            <p className="text-xs text-muted-foreground mt-1">
              No-shows after this time are auto-flagged absent.
            </p>
          </div>
        </div>
      </section>
    </StepShell>
  );
}

/* ---------- Step 2: Teachers ---------- */

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email").max(255);

function StepTeachers({
  onContinue,
  onBack,
}: {
  onContinue: (skipped: boolean) => void;
  onBack: () => void;
}) {
  const fInvite = useServerFn(inviteTeacher);
  const fTeachers = useServerFn(listTeachers);
  const [existing, setExisting] = useState<Array<{ user_id: string; full_name: string | null }>>(
    [],
  );
  const [rows, setRows] = useState<Array<{ email: string; error?: string }>>([{ email: "" }]);
  const [sent, setSent] = useState<Array<{ email: string; link: string }>>([]);
  const [sending, setSending] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    fTeachers({})
      .then(setExisting)
      .catch(() => {});
  }, [fTeachers]);

  function addRow() {
    setRows((r) => [...r, { email: "" }]);
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function sendAll() {
    const seen = new Set(sent.map((s) => s.email.toLowerCase()));
    const next: typeof rows = rows.map((r) => ({ email: r.email }));
    const toSend: string[] = [];
    let hasError = false;
    for (let i = 0; i < next.length; i++) {
      const raw = next[i].email.trim();
      if (!raw) continue;
      const parsed = emailSchema.safeParse(raw);
      if (!parsed.success) {
        next[i].error = parsed.error.issues[0]?.message ?? "Invalid email";
        hasError = true;
        continue;
      }
      const norm = parsed.data;
      if (seen.has(norm)) {
        next[i].error = "Already invited this session";
        hasError = true;
        continue;
      }
      seen.add(norm);
      toSend.push(norm);
    }
    setRows(next);
    if (hasError) return;
    if (toSend.length === 0) {
      toast.error("Add at least one email");
      return;
    }
    setSending(true);
    const out: Array<{ email: string; link: string }> = [];
    for (const email of toSend) {
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
    if (out.length)
      toast.success(`Generated ${out.length} invite link${out.length === 1 ? "" : "s"}`);
  }

  const inviteCount = sent.length + existing.length;

  return (
    <StepShell
      title="Invite teachers"
      minutes={5}
      description="Send invite links so teachers can sign in and run attendance for their own classes. You can always add more later."
      learnMore={{ label: "Learn about teacher roles", href: "#" }}
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onContinue(true)}>
              Skip for now
            </Button>
            <Button onClick={() => onContinue(false)} disabled={inviteCount === 0}>
              Continue <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </>
      }
    >
      {existing.length > 0 && (
        <section>
          <SectionHeader title="Already on your team" />
          <div className="space-y-1.5">
            {existing.map((t) => (
              <div
                key={t.user_id}
                className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                <Check className="h-4 w-4 text-primary" />
                <span className="font-medium">{t.full_name ?? "Teacher"}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeader
          title="Invite by email"
          hint="We generate a unique invite link per email. Share it however you like."
        />
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i}>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="teacher@school.edu"
                  value={row.email}
                  onChange={(e) =>
                    setRows((rs) =>
                      rs.map((r, idx) =>
                        idx === i ? { email: e.target.value, error: undefined } : r,
                      ),
                    )
                  }
                  className={row.error ? "border-destructive" : ""}
                />
                {rows.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeRow(i)} type="button">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <FieldError message={row.error} />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-3">
          <Button variant="ghost" size="sm" onClick={addRow} type="button">
            <Plus className="h-4 w-4 mr-1" /> Add another
          </Button>
          <Button onClick={sendAll} disabled={sending} type="button">
            {sending ? "Generating…" : "Generate invite links"}
          </Button>
        </div>
      </section>

      {sent.length > 0 && (
        <section>
          <SectionHeader title="Share these links" />
          <div className="space-y-2">
            {sent.map((s) => (
              <div
                key={s.link}
                className="flex items-center gap-2 rounded-md border bg-emerald-50 border-emerald-200 px-3 py-2 text-sm"
              >
                <span className="flex-1 truncate font-medium">{s.email}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(s.link);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
                <a
                  className="inline-flex items-center gap-1 rounded-md border bg-white px-2.5 py-1.5 text-xs hover:bg-muted"
                  href={`mailto:${s.email}?subject=${encodeURIComponent(
                    "Your RollCall invite",
                  )}&body=${encodeURIComponent(
                    `You've been invited to RollCall. Accept here: ${s.link}`,
                  )}`}
                >
                  <Mail className="h-3 w-3" /> Email
                </a>
              </div>
            ))}
          </div>
        </section>
      )}
    </StepShell>
  );
}

/* ---------- Step 3: Class ---------- */

const classSchema = z.object({
  name: z.string().trim().min(1, "Class name is required").max(80, "Keep it under 80 characters"),
  grade: z.string().trim().max(20, "Keep it under 20 characters").optional(),
  teacherId: z.string().uuid().optional().or(z.literal("")),
});

function StepClass({
  classId,
  onCreated,
  onContinue,
  onBack,
}: {
  classId: string | null;
  onCreated: (id: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const fCreate = useServerFn(createClass);
  const fList = useServerFn(listClasses);
  const fTeachers = useServerFn(listTeachers);
  const fCtx = useServerFn(getMyContext);
  const [classes, setClasses] = useState<Array<{ id: string; name: string; grade: string | null }>>(
    [],
  );
  const [teachers, setTeachers] = useState<Array<{ user_id: string; full_name: string | null }>>(
    [],
  );
  const [me, setMe] = useState<{ userId: string; email?: string } | null>(null);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [teacherId, setTeacherId] = useState<string>("__me");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function refresh() {
    fList({}).then((rows) =>
      setClasses(rows.map((r) => ({ id: r.id, name: r.name, grade: r.grade }))),
    );
  }
  useEffect(() => {
    refresh();
    fCtx({}).then((c) => setMe({ userId: c.userId, email: c.email }));
    fTeachers({})
      .then(setTeachers)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    const tId = teacherId === "__me" ? "" : teacherId;
    const parsed = classSchema.safeParse({
      name,
      grade: grade || undefined,
      teacherId: tId || undefined,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[issue.path.join(".")] = issue.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const row = await fCreate({
        data: {
          name: parsed.data.name,
          grade: parsed.data.grade,
          teacherId: tId || undefined,
        },
      });
      onCreated(row.id);
      setName("");
      setGrade("");
      setTeacherId("__me");
      refresh();
      toast.success("Class created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <StepShell
      title="Create your first class"
      minutes={3}
      description="A class groups students together and gets its own kiosk session. You can create more anytime."
      learnMore={{ label: "Learn about classes & kiosks", href: "#" }}
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onContinue} disabled={classes.length === 0}>
            Continue <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </>
      }
    >
      <section>
        <SectionHeader title="Class details" />
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">
              Class name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="7A"
              className={errors.name ? "border-destructive" : ""}
            />
            <FieldError message={errors.name} />
          </div>
          <div>
            <Label className="text-sm">Grade (optional)</Label>
            <Input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="Grade 7"
              className={errors.grade ? "border-destructive" : ""}
            />
            <FieldError message={errors.grade} />
          </div>
        </div>
        <div className="mt-4">
          <Label className="text-sm">Assigned teacher</Label>
          <Select value={teacherId} onValueChange={setTeacherId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__me">Me ({me?.email ?? "admin"})</SelectItem>
              {teachers.map((t) => (
                <SelectItem key={t.user_id} value={t.user_id}>
                  {t.full_name ?? t.user_id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-4">
          <Button onClick={create} disabled={saving}>
            <Plus className="h-4 w-4 mr-1" /> {saving ? "Creating…" : "Create class"}
          </Button>
        </div>
      </section>

      {classes.length > 0 && (
        <section>
          <SectionHeader title="Your classes" />
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
        </section>
      )}
    </StepShell>
  );
}

/* ---------- Step 4: Students & try it ---------- */

const studentLineSchema = z.object({
  full_name: z.string().trim().min(1).max(100),
  external_id: z.string().trim().max(40).optional(),
});

function StepStudentsAndTry({
  classId,
  onPickClass,
  onBack,
  onFinish,
}: {
  classId: string | null;
  onPickClass: (id: string) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  const fBulk = useServerFn(bulkAddStudents);
  const fList = useServerFn(listClasses);
  const fKiosk = useServerFn(createKioskSession);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [text, setText] = useState("");
  const [count, setCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [lineError, setLineError] = useState<string>("");

  useEffect(() => {
    fList({}).then((rows) => {
      setClasses(rows.map((r) => ({ id: r.id, name: r.name })));
      if (!classId && rows[0]) onPickClass(rows[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsed = useMemo(() => {
    const out: Array<{ full_name: string; external_id?: string }> = [];
    const lines = text.split("\n");
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const [name, id] = line.split(",").map((s) => s?.trim());
      const r = studentLineSchema.safeParse({
        full_name: name,
        external_id: id || undefined,
      });
      if (r.success) out.push(r.data);
    }
    return out;
  }, [text]);

  async function save() {
    if (!classId) {
      toast.error("Pick a class first");
      return;
    }
    if (parsed.length === 0) {
      setLineError("Add at least one student name");
      return;
    }
    if (parsed.length > 200) {
      setLineError("Add up to 200 students at a time — use CSV import for more");
      return;
    }
    setLineError("");
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

  const canFinish = count > 0;

  return (
    <StepShell
      title="Add students & try it out"
      minutes={5}
      description="Add your roster, print QR cards, then open a kiosk to see attendance in action."
      learnMore={{ label: "Learn about QR codes & kiosks", href: "#" }}
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onFinish} disabled={!canFinish} size="lg">
            Finish setup <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </>
      }
    >
      <section>
        <SectionHeader title="Pick a class" />
        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No classes yet — go back and create one first.
          </p>
        ) : (
          <Select value={classId ?? ""} onValueChange={onPickClass}>
            <SelectTrigger>
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </section>

      <section>
        <SectionHeader
          title="Quick add students"
          hint="One per line. Add a comma + student ID after the name if you have one."
        />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={"Alice Johnson\nBob Smith, S-1042\nCarol Diaz"}
          className={`font-mono text-sm ${lineError ? "border-destructive" : ""}`}
        />
        <FieldError message={lineError} />
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-muted-foreground">
            {parsed.length} valid line{parsed.length === 1 ? "" : "s"}
            {count > 0 && ` · ${count} added so far`}
          </p>
          <Button onClick={save} disabled={saving || parsed.length === 0 || !classId}>
            {saving ? "Adding…" : `Add ${parsed.length || ""} students`}
          </Button>
        </div>
        <a
          href="/app/import"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3"
        >
          Or use CSV bulk import <ExternalLink className="h-3 w-3" />
        </a>
      </section>

      <section>
        <SectionHeader title="Try it now" hint="Print QR cards and open a kiosk on any camera-equipped device." />
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-lg border p-5">
            <Printer className="h-6 w-6 text-primary mb-3" />
            <h4 className="font-semibold">Print QR sheet</h4>
            <p className="text-sm text-muted-foreground mt-1">
              A4 grid, one card per student, with a parent self-lookup QR.
            </p>
            <Button
              variant="outline"
              className="mt-4 w-full"
              disabled={!classId || count === 0}
              onClick={() => classId && window.open(`/app/classes/${classId}/qr`, "_blank")}
            >
              Open print sheet <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          </div>
          <div className="rounded-lg border p-5">
            <MonitorSmartphone className="h-6 w-6 text-primary mb-3" />
            <h4 className="font-semibold">Open a kiosk</h4>
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
          </div>
        </div>
      </section>

      {!canFinish && (
        <p className="text-xs text-muted-foreground">
          Add at least one student to finish setup.
        </p>
      )}
    </StepShell>
  );
}
