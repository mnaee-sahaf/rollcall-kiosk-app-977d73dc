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
  const [schoolName, setSchoolName] = useState("");
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
            emailRedirectTo: `${window.location.origin}/app`,
            data: {
              full_name: fullName,
              school_name: schoolName,
              invite_token: invite,
            },
          },
        });
        if (error) throw error;
        toast.success("Account created");
        navigate({ to: "/app" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/app",
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (!result.redirected) navigate({ to: "/app" });
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
              : "Create your organization"}
        </h1>
        {mode === "signup" && !invite && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Set up a new RollCall org for your school. You'll be the admin.
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

        {mode === "signin" && !invite && (
          <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="text-sm font-semibold">New to RollCall?</div>
            <p className="text-xs text-muted-foreground mt-1">
              Spin up a new organization for your school in under a minute.
            </p>
            <Button
              type="button"
              variant="default"
              className="w-full mt-3"
              onClick={() => navigate({ to: "/create-organization" })}
            >
              Create new organization
            </Button>
          </div>
        )}


        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <>
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              {!invite && (
                <div>
                  <Label htmlFor="school">Organization / school name</Label>
                  <Input
                    id="school"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Lincoln High School"
                    required
                  />
                </div>
              )}
            </>
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
