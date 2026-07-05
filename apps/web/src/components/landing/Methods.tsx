import { Monitor, Smartphone, ClipboardList } from "lucide-react";

const methods = [
  {
    icon: Monitor,
    title: "Kiosk scan",
    desc: "A shared device at the classroom door scans each student's personal QR badge as they walk in.",
    bullets: ["One device per room", "Hands-off for teachers", "Sub-second check-in"],
  },
  {
    icon: Smartphone,
    title: "Self check-in",
    desc: "Class displays a rotating QR. Students scan it in the RollCall companion app from their phone.",
    bullets: ["Class-based QR codes", "Companion mobile app", "Anti-spoof rotation"],
  },
  {
    icon: ClipboardList,
    title: "Manual roster",
    desc: "Teachers can always mark the digital roster by hand for field trips, exams, or device-free rooms.",
    bullets: ["Tap to mark present", "Bulk actions", "Late & excused states"],
  },
];

export function Methods() {
  return (
    <section id="methods" className="mx-auto max-w-6xl px-6 py-20">
      <div className="max-w-2xl">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">
          Three ways to mark the roll
        </div>
        <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          Pick the method that fits the room.
        </h2>
        <p className="mt-3 text-muted-foreground">
          Every classroom is different. RollCall ships with three first-class
          marking methods — schools mix and match per class.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {methods.map((m) => (
          <div
            key={m.title}
            className="group rounded-2xl border border-border bg-card p-6 transition hover:border-primary/40 hover:shadow-[0_20px_50px_-30px_rgba(0,0,0,0.2)]"
          >
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
              <m.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-lg font-semibold">{m.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{m.desc}</p>
            <ul className="mt-4 space-y-1.5 text-sm">
              {m.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
