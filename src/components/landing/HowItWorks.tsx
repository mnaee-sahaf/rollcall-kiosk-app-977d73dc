const steps = [
  {
    n: "01",
    title: "Issue QR codes",
    desc: "Generate personal student badges and class QR codes from the admin console in one click.",
  },
  {
    n: "02",
    title: "Students check in",
    desc: "Via the classroom kiosk, the companion app, or a teacher's roster — whichever fits the class.",
  },
  {
    n: "03",
    title: "Reports generate themselves",
    desc: "Live dashboards, daily breakdowns, and chronic-absentee alerts roll up across the school.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">How it works</div>
          <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            From scan to report in one flow.
          </h2>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="bg-card p-8">
              <div className="text-sm font-semibold text-primary">{s.n}</div>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
