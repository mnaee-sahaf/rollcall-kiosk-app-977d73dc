import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/auth.functions";
import { AppShell } from "@/components/app/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getMyContext);
  const [state, setState] = useState<{
    loading: boolean;
    isAdmin: boolean;
    hasRole: boolean;
    email?: string;
  }>({ loading: true, isAdmin: false, hasRole: false });

  useEffect(() => {
    let mounted = true;
    fetchCtx({})
      .then((ctx) => {
        if (!mounted) return;
        setState({
          loading: false,
          isAdmin: ctx.isAdmin,
          hasRole: ctx.roles.length > 0,
          email: ctx.email,
        });
      })
      .catch(() => {
        if (mounted) navigate({ to: "/auth" });
      });
    return () => {
      mounted = false;
    };
  }, [fetchCtx, navigate]);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isFullscreen = pathname.startsWith("/app/onboarding");

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!state.hasRole) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-[#fcfbf8]">
        <div className="max-w-md text-center rounded-2xl border bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold">Your account isn't linked yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as <span className="font-medium">{state.email}</span>. Ask your school
            administrator to send you a teacher invite link, then open it while signed in.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth", replace: true });
              }}
            >
              Sign out
            </Button>
            <Button onClick={() => navigate({ to: "/" })}>Back to site</Button>
          </div>
        </div>
      </div>
    );
  }
  if (isFullscreen) {
    return <Outlet />;
  }
  return (
    <AppShell isAdmin={state.isAdmin}>
      <Outlet />
    </AppShell>
  );
}
