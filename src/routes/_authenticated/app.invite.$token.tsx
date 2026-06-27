import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { acceptInvite, getMyContext } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/invite/$token")({
  component: InviteAcceptPage,
});

function InviteAcceptPage() {
  const navigate = useNavigate();
  const { token } = Route.useParams();
  const fAccept = useServerFn(acceptInvite);
  const fCtx = useServerFn(getMyContext);
  const [email, setEmail] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fCtx({}).then((c) => setEmail(c.email));
  }, [fCtx]);

  async function handleAccept() {
    setBusy(true);
    try {
      await fAccept({ data: { token } });
      toast.success("You're now a teacher on this school");
      setDone(true);
      setTimeout(() => navigate({ to: "/app" }), 800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-md w-full rounded-2xl border bg-white p-8 text-center shadow-sm">
        {done ? (
          <>
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h1 className="text-2xl font-bold mt-3">Welcome aboard</h1>
            <p className="text-sm text-muted-foreground mt-2">Taking you to your dashboard…</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Accept teacher invite</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Signed in as <span className="font-medium">{email ?? "…"}</span>. Click accept to be
              added as a teacher.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button onClick={handleAccept} disabled={busy}>
                {busy ? "Accepting…" : "Accept invite"}
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/app" })}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
