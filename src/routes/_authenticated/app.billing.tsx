import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/auth.functions";
import { PLAN_LIMITS, type PlanId } from "@/lib/plans";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CreditCard, Check, X, AlertTriangle, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/billing")({
  component: BillingPage,
});

type Ctx = Awaited<ReturnType<typeof getMyContext>>;

function fmtLimit(limit: number): string {
  return Number.isFinite(limit) ? String(limit) : "Unlimited";
}

function BillingPage() {
  const navigate = useNavigate();
  const fCtx = useServerFn(getMyContext);
  const [loading, setLoading] = useState(true);
  const [ctx, setCtx] = useState<Ctx | null>(null);

  useEffect(() => {
    fCtx({}).then((c) => {
      if (!c.isAdmin) {
        navigate({ to: "/app" });
        return;
      }
      setCtx(c);
      setLoading(false);
    });
  }, [fCtx, navigate]);

  if (loading || !ctx) return <div className="p-8">Loading…</div>;

  const plan = ctx.plan as PlanId;
  const isFree = plan === "free";
  const limits = PLAN_LIMITS[plan];
  const freeLimits = PLAN_LIMITS.free;

  const numericRows: { key: "classes" | "students" | "staff"; label: string }[] = [
    { key: "classes", label: "Classes" },
    { key: "students", label: "Students" },
    { key: "staff", label: "Staff" },
  ];

  function handleUpgrade() {
    toast.info("Payments are coming soon — contact us to upgrade.");
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">Billing</h1>
      <p className="text-muted-foreground mb-8">Your plan and usage for this school.</p>

      {/* Current plan */}
      <Card className="p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <CreditCard className="h-4 w-4" /> Current plan
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
                  isFree
                    ? "bg-muted text-foreground"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {!isFree && <Sparkles className="h-3.5 w-3.5" />}
                {isFree ? "Free" : "Pro"}
              </span>
              {!isFree && (
                <span className="text-sm text-muted-foreground">You're on Pro — thanks!</span>
              )}
            </div>
          </div>

          {isFree && (
            <div className="text-right">
              {ctx.isOwner ? (
                <Button onClick={handleUpgrade}>
                  <Sparkles className="h-4 w-4 mr-2" /> Upgrade to Pro
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground max-w-[12rem]">
                  Ask the owner to upgrade.
                </p>
              )}
            </div>
          )}
        </div>

        {isFree && ctx.isOwner && (
          <p className="text-xs text-muted-foreground mt-3">
            Payments are coming soon — contact us to upgrade.
          </p>
        )}
      </Card>

      {/* Usage table */}
      <Card className="p-5">
        <h2 className="font-semibold mb-4">Usage</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-4 font-medium">Resource</th>
                <th className="py-2 pr-4 font-medium">Usage</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {numericRows.map((row) => {
                const used = ctx.usage[row.key];
                const limit = limits[row.key];
                const freeLimit = freeLimits[row.key];
                const atFreeLimit =
                  Number.isFinite(freeLimit) && used >= freeLimit;
                return (
                  <tr key={row.key} className="border-b last:border-0">
                    <td className="py-3 pr-4">{row.label}</td>
                    <td className="py-3 pr-4 tabular-nums">
                      {used} / {fmtLimit(limit)}
                    </td>
                    <td className="py-3">
                      {atFreeLimit ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {isFree ? "At limit" : "Above free tier"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">OK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-b last:border-0">
                <td className="py-3 pr-4">Bulk import</td>
                <td className="py-3 pr-4" colSpan={2}>
                  {limits.bulkImport ? (
                    <span className="inline-flex items-center gap-1.5 text-primary">
                      <Check className="h-3.5 w-3.5" /> Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <X className="h-3.5 w-3.5" /> Disabled
                      <span className="text-xs">(Pro only)</span>
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
