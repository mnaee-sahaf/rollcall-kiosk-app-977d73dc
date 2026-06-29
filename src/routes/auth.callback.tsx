import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/landing/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // PKCE flow: Supabase puts ?code=... in the URL; exchange it for a session.
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        // Confirm we actually have a session before bouncing into protected routes.
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) {
          throw new Error("No session after OAuth callback");
        }

        const intended = sessionStorage.getItem("postLoginRedirect");
        sessionStorage.removeItem("postLoginRedirect");

        // New users without a role get sent to /welcome by the _authenticated gate.
        navigate({ to: intended || "/app", replace: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Sign-in failed";
        setError(msg);
        toast.error(msg);
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fcfbf8] px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-red-600">Sign-in failed</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              className="mt-6 text-sm text-primary underline"
              onClick={() => navigate({ to: "/auth" })}
            >
              Back to sign in
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Completing sign-in…</p>
        )}
      </div>
    </div>
  );
}
