import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Logo } from "@/components/landing/Logo";
import { Building2, Check } from "lucide-react";

export const Route = createFileRoute("/create-organization")({
  ssr: false,
  component: CreateOrgPage,
});

function CreateOrgPage() {
  const navigate = useNavigate();
  const [schoolName, setSchoolName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentEmail(data.user.email ?? null);
    });
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setCurrentEmail(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          data: { full_name: fullName, school_name: schoolName },
        },
      });
      if (error) throw error;
      toast.success("Organization created");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    // Stash org name so we can apply it after OAuth (best-effort)
    if (schoolName) sessionStorage.setItem("pending_school_name", schoolName);
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
    <div className="min-h-screen bg-[#fcfbf8]">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/">
            <Logo />
          </Link>
          <Link to="/auth" search={{ mode: "signin", invite: undefined }} className="text-sm text-muted-foreground hover:text-foreground">
            Already have an account? <span className="text-primary font-medium">Sign in</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-2 md:py-20">
        {/* Left: pitch */}
        <div className="hidden md:flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 self-start rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Building2 className="h-3.5 w-3.5" /> New organization
          </div>
          <h1 className="mt-4 text-4xl font-bold leading-tight">
            Spin up your school's RollCall org in under a minute.
          </h1>
          <p className="mt-4 text-muted-foreground">
            You'll be the admin. Invite teachers, create classes, and start scanning
            attendance the same day.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {[
              "Unlimited classes & students",
              "Web kiosk on any device with a camera",
              "Daily, weekly, monthly reports + CSV export",
              "Invite teachers by email",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="rounded-full bg-primary/10 p-1 text-primary">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Right: form */}
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <div className="md:hidden mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Building2 className="h-3.5 w-3.5" /> New organization
          </div>
          <h2 className="text-2xl font-bold">Create your organization</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You'll be the admin owner. You can rename or customize this later.
          </p>

          {currentEmail && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              You're signed in as <span className="font-medium">{currentEmail}</span>.{" "}
              <button type="button" className="underline" onClick={handleSignOut}>
                Sign out
              </button>{" "}
              to create a new org with a different account.
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="school">Organization / school name</Label>
              <Input
                id="school"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Lincoln High School"
                required
                autoFocus
              />
            </div>
            <div className="border-t pt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Admin account
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Your full name</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="email">Work email</Label>
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
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Creating organization…" : "Create organization"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={handleGoogle} type="button">
            Continue with Google
          </Button>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Joining an existing org? Use the invite link your admin sent you.
          </p>
        </div>
      </div>
    </div>
  );
}
