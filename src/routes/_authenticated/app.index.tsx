import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/auth.functions";
import { listClasses } from "@/lib/classes.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  GraduationCap,
  BarChart3,
  Users,
  QrCode,
  ArrowRight,
  Clock,
  Building2,
  UserPlus,
  ScanLine,
  PartyPopper,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  validateSearch: (s: Record<string, unknown>): { welcome?: 1 } => {
    return s.welcome ? { welcome: 1 } : {};
  },
  component: DashboardPage,
});


type Ctx = Awaited<ReturnType<typeof getMyContext>>;

function DashboardPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/app/" });
  const fetchCtx = useServerFn(getMyContext);
  const fetchClasses = useServerFn(listClasses);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [dismissed, setDismissed] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    fetchCtx({}).then((c) => {
      if (c.needsOnboarding) {
        navigate({ to: "/app/onboarding", search: { step: 1 }, replace: true });
        return;
      }
      setCtx(c);
    });
    fetchClasses({}).then(setClasses);
    setDismissed(localStorage.getItem("rc_onboarding_dismissed") === "1");
    if (search.welcome) {
      setShowWelcome(true);
      navigate({ to: "/app", search: {}, replace: true });
    }
  }, [fetchCtx, fetchClasses, navigate, search.welcome]);

  // All hooks must run on every render — keep this useMemo ABOVE the `!ctx`
  // early return, or React throws "rendered more hooks than during the
  // previous render" (#310) once ctx loads.
  const progress = ctx?.setupProgress;
  const setupSteps = useMemo(
    () => [
      {
        key: "profile",
        title: "Set up your school profile",
        description: "Add your school name, logo, timezone and cutoff times.",
        time: "2 min",
        done: !!progress?.hasSchoolName,
        icon: Building2,
        step: 1 as const,
      },
      {
        key: "teachers",
        title: "Invite your teachers",
        description: "Send invite links so teachers can manage their rosters.",
        time: "3 min",
        done: !!progress?.hasTeachers,
        icon: UserPlus,
        step: 2 as const,
      },
      {
        key: "classes",
        title: "Create your first class",
        description: "Group students into classes and assign a teacher.",
        time: "2 min",
        done: !!progress?.hasClasses,
        icon: GraduationCap,
        step: 3 as const,
      },
      {
        key: "students",
        title: "Add students",
        description: "Add students individually or import them in bulk.",
        time: "5 min",
        done: !!progress?.hasStudents,
        icon: Users,
        step: 4 as const,
      },
      {
        key: "kiosk",
        title: "Try a kiosk",
        description: "Launch a web kiosk and scan your first QR.",
        time: "1 min",
        done: !!progress?.hasKioskSession,
        icon: ScanLine,
        step: 5 as const,
      },
    ],
    [progress],
  );

  if (!ctx) return null;

  const doneCount = setupSteps.filter((s) => s.done).length;
  const total = setupSteps.length;
  const percent = Math.round((doneCount / total) * 100);
  const greetingName = ctx.email?.split("@")[0] ?? "there";

  const showGetStarted = ctx.isAdmin && !dismissed;

  function dismiss() {
    localStorage.setItem("rc_onboarding_dismissed", "1");
    setDismissed(true);
  }

  return (
    <>
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader className="items-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PartyPopper className="h-10 w-10" />
            </div>
            <DialogTitle className="text-2xl">Welcome to RollCall! 🎉</DialogTitle>
            <DialogDescription>
              You're in! Let's find the best way to get you started.
            </DialogDescription>
          </DialogHeader>
          <Button
            size="lg"
            className="mt-2"
            onClick={() => {
              setShowWelcome(false);
              navigate({ to: "/app/onboarding", search: { step: 1 } });
            }}
          >
            Start onboarding
          </Button>
        </DialogContent>
      </Dialog>

      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {showGetStarted ? (
          <>
            <h1 className="text-2xl font-bold mb-4">Get Started</h1>

            {/* Greeting banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-6 md:p-8 mb-8 text-primary-foreground">
              <div className="relative max-w-2xl">
                <p className="text-base md:text-lg">
                  Hi <span className="font-semibold">{greetingName}</span>! 👋 We're
                  excited to help you simplify attendance tracking with RollCall.
                  Let's get you set up — or if you prefer, jump straight into the
                  demo.
                </p>
              </div>
              <div
                className="pointer-events-none absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                  backgroundSize: "24px 24px",
                }}
              />
            </div>

            {/* Progress + steps */}
            <Card className="p-6 md:p-8 mb-8">
              <div className="flex items-center gap-6 mb-6">
                <ProgressRing percent={percent} />
                <div>
                  <h2 className="text-xl font-bold">Complete setup</h2>
                  <p className="text-sm text-muted-foreground">
                    {doneCount} of {total} steps completed
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {setupSteps.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.key}
                      className="rounded-xl border bg-card p-5 flex flex-col"
                    >
                      <div
                        className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${
                          s.done
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="font-semibold mb-1">{s.title}</div>
                      <p className="text-sm text-muted-foreground flex-1">
                        {s.description}
                      </p>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {s.time}
                        </div>
                        <Button
                          size="sm"
                          variant={s.done ? "outline" : "default"}
                          asChild
                        >
                          <Link
                            to="/app/onboarding"
                            search={{ step: s.step }}
                          >
                            {s.done ? "Review" : "Start"}
                            <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="flex items-center justify-center gap-2 text-sm mb-10">
              <span className="text-muted-foreground">
                Want to skip onboarding and hide this page?
              </span>
              <button
                onClick={dismiss}
                className="font-semibold text-primary hover:underline"
              >
                Dismiss onboarding
              </button>
            </div>
          </>
        ) : (
          <div className="mb-8">
            <h1 className="text-3xl font-bold">
              {ctx.isAdmin ? "Admin dashboard" : "Welcome back"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {ctx.email ? <span className="text-sm">{ctx.email}</span> : null}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{classes.length}</div>
                <div className="text-xs text-muted-foreground">Classes</div>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <Link to="/app/reports" className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-semibold">View reports</div>
                <div className="text-xs text-muted-foreground">
                  Daily, weekly, monthly
                </div>
              </div>
            </Link>
          </Card>
          {ctx.isAdmin && (
            <Card className="p-5">
              <Link to="/app/teachers" className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-semibold">Manage teachers</div>
                  <div className="text-xs text-muted-foreground">Invite by email</div>
                </div>
              </Link>
            </Card>
          )}
        </div>

        <h2 className="text-lg font-semibold mb-3">Your classes</h2>
        {classes.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <QrCode className="h-8 w-8 mx-auto mb-3 text-primary/60" />
            No classes yet.{" "}
            <Link to="/app/classes" className="text-primary underline">
              Create your first class
            </Link>
            .
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {classes.map((c) => (
              <Link
                key={c.id}
                to="/app/classes/$classId"
                params={{ classId: c.id }}
                className="rounded-lg border bg-white p-4 hover:border-primary/50 transition"
              >
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">Open class →</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const size = 72;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/40"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary transition-all"
          fill="none"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
        {percent}%
      </div>
    </div>
  );
}
