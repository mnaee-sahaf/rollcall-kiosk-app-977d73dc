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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/app" });
    });
  }, [navigate]);

  useEffect(() => {
    if (invite) setMode("signup");
  }, [invite]);

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
          {mode === "signin" ? "Sign in" : invite ? "Accept teacher invite" : "Create account"}
        </h1>
        {invite && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            You're joining as a teacher.
          </p>
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
                  <Label htmlFor="school">School name</Label>
                  <Input id="school" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
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
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>
        <Button variant="outline" className="w-full" onClick={handleGoogle} type="button">
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button className="text-primary underline" onClick={() => setMode("signup")}>
                Create one
              </button>
            </>
          ) : (
            <>
              Already have one?{" "}
              <button className="text-primary underline" onClick={() => setMode("signin")}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
