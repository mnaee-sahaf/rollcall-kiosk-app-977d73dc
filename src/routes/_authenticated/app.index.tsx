import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/auth.functions";
import { listClasses } from "@/lib/classes.functions";
import { Card } from "@/components/ui/card";
import { GraduationCap, BarChart3, Users, QrCode } from "lucide-react";
import { SetupChecklistCard } from "@/components/app/SetupChecklistCard";

export const Route = createFileRoute("/_authenticated/app/")({
  component: DashboardPage,
});

type Ctx = Awaited<ReturnType<typeof getMyContext>>;

function DashboardPage() {
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getMyContext);
  const fetchClasses = useServerFn(listClasses);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetchCtx({}).then((c) => {
      if (c.needsOnboarding) {
        navigate({ to: "/app/onboarding", search: { step: 1 }, replace: true });
        return;
      }
      setCtx(c);
    });
    fetchClasses({}).then(setClasses);
  }, [fetchCtx, fetchClasses, navigate]);

  if (!ctx) return null;

  const progress = ctx.setupProgress;
  const setupIncomplete =
    ctx.isAdmin &&
    (!progress.hasSchoolName || !progress.hasClasses || !progress.hasStudents);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          {ctx.isAdmin ? "Admin dashboard" : "Welcome back"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {ctx.email ? <span className="text-sm">{ctx.email}</span> : null}
        </p>
      </div>

      {setupIncomplete && <SetupChecklistCard progress={progress} />}

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
              <div className="text-xs text-muted-foreground">Daily, weekly, monthly</div>
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
  );
}
