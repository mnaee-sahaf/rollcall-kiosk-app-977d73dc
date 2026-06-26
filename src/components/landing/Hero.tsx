import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, QrCode } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[480px] w-[800px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Now inviting pilot schools
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Attendance, taken in seconds.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            RollCall replaces the paper roll with a QR-based system built for schools.
            Scan at a kiosk, scan from a phone, or mark manually — every check-in flows
            into one clean report.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <a href="#waitlist">
                Join the waitlist <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/demo">Try the demo</Link>
            </Button>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            Built for K–12 and higher-ed. Pilots starting this term.
          </div>
        </div>

        <div className="relative">
          <div className="relative mx-auto w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Kiosk · Room 204</span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
              </span>
            </div>
            <div className="mt-5 grid place-items-center rounded-2xl bg-primary-soft p-8">
              <div className="grid h-32 w-32 place-items-center rounded-xl bg-card shadow-sm">
                <QrCode className="h-20 w-20 text-foreground" strokeWidth={1.25} />
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-background p-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">Aisha N. checked in</div>
                <div className="text-xs text-muted-foreground">AP Biology · 08:02</div>
              </div>
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                On time
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-muted p-2">
                <div className="text-base font-semibold text-foreground">21</div>
                <div className="text-muted-foreground">Present</div>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <div className="text-base font-semibold text-foreground">3</div>
                <div className="text-muted-foreground">Late</div>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <div className="text-base font-semibold text-foreground">4</div>
                <div className="text-muted-foreground">Absent</div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-border bg-card px-4 py-3 shadow-lg md:block">
            <div className="text-xs text-muted-foreground">Attendance today</div>
            <div className="text-xl font-bold">85.9%</div>
          </div>
        </div>
      </div>
    </section>
  );
}
