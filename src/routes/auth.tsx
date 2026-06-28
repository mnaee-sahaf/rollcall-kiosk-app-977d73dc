import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Logo } from "@/components/landing/Logo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    invite: typeof s.invite === "string" ? s.invite : undefined,
    mode: s.mode === "signup" ? "signup" : "signin",
  }),
  component: AuthPage,
});


function AuthPage() {
  const navigate = useNavigate();
  const { invite, mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      // If already signed in and just trying to sign in, send them straight to the app.
      if (mode === "signin" && !invite) {
        navigate({ to: "/app", replace: true });
        return;
      }
      setCurrentEmail(data.user.email ?? null);
    });
  }, [mode, invite, navigate]);

  useEffect(() => {
    if (invite) setMode("signup");
  }, [invite]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setCurrentEmail(null);
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
        navigate({ to: "/app" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/welcome`,
            data: {
              full_name: fullName,
              invite_token: invite,
            },
          },
        });
        if (error) throw error;
        toast.success("Account created");
        // Invited teachers get a role from the trigger and can go straight to /app.
        // Everyone else picks Create vs Join on /welcome.
        navigate({ to: invite ? "/app" : "/welcome" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/welcome",
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (!result.redirected) navigate({ to: "/welcome" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fcfbf8] px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-2xl font-bold text-center">
          {mode === "signin"
            ? "Sign in"
            : invite
              ? "Accept teacher invite"
              : "Create your account"}
        </h1>
        {mode === "signup" && !invite && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            One quick account, then choose whether to start a new organization or join one.
          </p>
        )}
        {invite && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            You're joining as a teacher.
          </p>
        )}
        {currentEmail && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            You're already signed in as <span className="font-medium">{currentEmail}</span>.{" "}
            <button type="button" className="underline" onClick={handleSignOut}>
              Sign out
            </button>{" "}
            to use a different account, or{" "}
            <button type="button" className="underline" onClick={() => navigate({ to: "/app" })}>
              go to your dashboard
            </button>
            .
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : invite
                  ? "Accept invite"
                  : "Create organization"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>
        <Button variant="outline" className="w-full" onClick={handleGoogle} type="button">
          Continue with Google
        </Button>

        {mode === "signup" && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have one?{" "}
            <button className="text-primary underline" onClick={() => setMode("signin")} type="button">
              Sign in
            </button>
          </p>
        )}

      </div>
    </div>
  );
}
