import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/auth.functions";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getMyContext);
  const [state, setState] = useState<{ loading: boolean; isAdmin: boolean; hasRole: boolean }>({
    loading: true,
    isAdmin: false,
    hasRole: false,
  });

  useEffect(() => {
    let mounted = true;
    fetchCtx({})
      .then((ctx) => {
        if (!mounted) return;
        setState({
          loading: false,
          isAdmin: ctx.isAdmin,
          hasRole: ctx.roles.length > 0,
        });
      })
      .catch(() => {
        if (mounted) navigate({ to: "/auth" });
      });
    return () => {
      mounted = false;
    };
  }, [fetchCtx, navigate]);

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!state.hasRole) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">No role assigned</h1>
          <p className="mt-2 text-muted-foreground">
            Your account isn't linked to a school yet. Ask an administrator for an invite link.
          </p>
        </div>
      </div>
    );
  }
  return (
    <AppShell isAdmin={state.isAdmin}>
      <Outlet />
    </AppShell>
  );
}
