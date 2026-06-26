import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

export function WaitlistCTA() {
  const [email, setEmail] = useState("");
  const [school, setSchool] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }
    try {
      const key = "rollcall_waitlist";
      const list = JSON.parse(localStorage.getItem(key) ?? "[]");
      list.push({ email, school, at: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(list));
    } catch {}
    setSubmitted(true);
    toast.success("You're on the list — we'll be in touch.");
  }

  return (
    <section id="waitlist" className="mx-auto max-w-6xl px-6 py-20">
      <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary-soft via-card to-card p-10 md:p-14">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Bring RollCall to your school.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Join the waitlist for our pilot program. We're onboarding a small
              cohort of schools this term — no cost during the pilot.
            </p>
          </div>
          <div>
            {submitted ? (
              <div className="flex items-start gap-3 rounded-2xl border border-border bg-background p-5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                <div>
                  <div className="font-semibold">You're on the list</div>
                  <div className="text-sm text-muted-foreground">
                    We'll reach out at <span className="text-foreground">{email}</span> with next steps.
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-border bg-background p-5">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Work email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.edu"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">School (optional)</label>
                  <Input
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    placeholder="Lincoln High School"
                    className="mt-1"
                  />
                </div>
                <Button type="submit" className="w-full" size="lg">
                  Join the waitlist
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  No spam. Unsubscribe anytime.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
