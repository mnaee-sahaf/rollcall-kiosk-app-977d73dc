import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getJoinContext } from "@/lib/organization.functions";
import { acceptInvite } from "@/lib/auth.functions";
import { Logo } from "@/components/landing/Logo";
import { Button } from "@/components/ui/button";
import { Building2, Users, ArrowRight, MailCheck, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/welcome/")({
  ssr: false,
  component: WelcomePage,
});

type Ctx = Awaited<ReturnType<typeof getJoinContext>>;

function WelcomePage() {
  const navigate = useNavigate();
  const fetchCtx = useServerFn(getJoinContext);
  const acceptInv = useServerFn(acceptInvite);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!data.user) {
          navigate({ to: "/auth", search: { mode: "signin", invite: undefined }, replace: true });
          return;
        }
        setAuthEmail(data.user.email ?? null);
        return fetchCtx({}).then((c) => {
          // If the user already has a role, skip the welcome screen.
          if (c.hasRole) {
            navigate({ to: "/app", replace: true });
            return;
          }
          setCtx(c);
        });
      })
      .catch((err) => {
        // Never leave the user on a blank "Loading…" screen — surface the error
        // and send them back to sign in (e.g. an expired/missing session).
        toast.error(err instanceof Error ? err.message : "Could not load your account");
        navigate({ to: "/auth", search: { mode: "signin", invite: undefined }, replace: true });
      });
  }, [fetchCtx, navigate]);

  async function handleAccept(token: string) {
    setAccepting(token);
    try {
      await acceptInv({ data: { token } });
      toast.success("Joined organization");
      navigate({ to: "/app", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not accept invite");
      setAccepting(null);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "signin", invite: undefined }, replace: true });
  }

  if (!ctx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fcfbf8] text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfbf8]">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground hidden sm:inline">{authEmail}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-1.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10 md:py-16">
        <h1 className="text-3xl md:text-4xl font-bold">
          Welcome to RollCall{authEmail ? `, ${authEmail}` : ""}!
        </h1>
        <p className="mt-2 text-muted-foreground">
          Let's get you set up. Are you starting a new organization or joining an existing one?
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {/* Create new organization */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm flex flex-col">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              For school admins
            </div>
            <h2 className="mt-1 text-xl font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Create a new organization
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Set up your school's RollCall workspace and invite teachers.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>• Create classes & students</li>
              <li>• Print QR cards and launch web kiosks</li>
              <li>• Run daily, weekly, and monthly reports</li>
            </ul>
            <div className="mt-6">
              {ctx.orgExists ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  An organization already exists for this RollCall instance. Ask the admin to invite
                  you instead.
                </div>
              ) : (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => navigate({ to: "/welcome/create" })}
                >
                  Create organization <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>

          {/* Join existing organization */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm flex flex-col">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              For teachers
            </div>
            <h2 className="mt-1 text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Join an organization
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Accept an invitation from your school admin to start marking attendance.
            </p>

            <div className="mt-4 flex-1">
              {ctx.invites.length === 0 ? (
                <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                  <MailCheck className="h-4 w-4 mb-1.5" />
                  No pending invites for <span className="font-medium">{ctx.email}</span> yet. Check
                  with your admin if they've sent you one.
                </div>
              ) : (
                <ul className="space-y-2">
                  {ctx.invites.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between rounded-md border bg-muted/20 p-3"
                    >
                      <div className="text-sm">
                        <div className="font-medium">Teacher invite</div>
                        <div className="text-xs text-muted-foreground">{inv.email}</div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAccept(inv.token)}
                        disabled={accepting === inv.token}
                      >
                        {accepting === inv.token ? "Joining…" : "Accept"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
