import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { lookupStudentPublic } from "@/lib/settings.functions";
import { Logo } from "@/components/landing/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import QRCode from "qrcode";
import { CheckCircle2, XCircle, Clock, MinusCircle, QrCode } from "lucide-react";

export const Route = createFileRoute("/lookup/$qrToken")({
  component: LookupPage,
});

type Data = Awaited<ReturnType<typeof lookupStudentPublic>>;
type Status = "present" | "late" | "absent";

const STATUS_META: Record<
  Status,
  { label: string; dot: string; pill: string; icon: typeof CheckCircle2 }
> = {
  present: {
    label: "Present",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-700 ring-emerald-600/20",
    icon: CheckCircle2,
  },
  late: {
    label: "Late",
    dot: "bg-amber-500",
    pill: "bg-amber-100 text-amber-700 ring-amber-600/20",
    icon: Clock,
  },
  absent: {
    label: "Absent",
    dot: "bg-rose-500",
    pill: "bg-rose-100 text-rose-700 ring-rose-600/20",
    icon: XCircle,
  },
};

function formatDay(day: string) {
  const d = new Date(`${day}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-[#fcfbf8]">
      <header className="border-b px-6 py-4 flex justify-center bg-white">
        <Logo />
      </header>
      <main className="max-w-md mx-auto p-5 space-y-5">
        <div className="flex flex-col items-center gap-3 pt-4">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
    </div>
  );
}

function LookupPage() {
  const { qrToken } = Route.useParams();
  const fLookup = useServerFn(lookupStudentPublic);
  const [data, setData] = useState<Data | null>(null);
  const [qrImg, setQrImg] = useState<string | null>(null);

  useEffect(() => {
    fLookup({ data: { qrToken } }).then(setData);
  }, [qrToken, fLookup]);

  useEffect(() => {
    QRCode.toDataURL(qrToken, { margin: 1, width: 220 })
      .then(setQrImg)
      .catch(() => setQrImg(null));
  }, [qrToken]);

  if (!data) return <LoadingState />;

  if (!data.found) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-[#fcfbf8]">
        <XCircle className="h-12 w-12 text-rose-500 mx-auto" />
        <h1 className="mt-3 text-2xl font-bold">Student not found</h1>
        <p className="text-muted-foreground mt-1">
          This QR code isn&apos;t recognised. Please ask your school for a new one.
        </p>
        <p className="text-xs text-muted-foreground mt-10">Powered by RollCall</p>
      </div>
    );
  }

  const { student, events, stats, today } = data;
  const todayMeta = today ? STATUS_META[today] : null;
  const TodayIcon = todayMeta?.icon ?? MinusCircle;

  return (
    <div className="min-h-screen bg-[#fcfbf8]">
      <header className="border-b px-6 py-4 flex justify-center bg-white">
        <Logo />
      </header>

      <main className="max-w-md mx-auto p-5 space-y-5">
        {/* Header */}
        <section className="text-center pt-2">
          <h1 className="text-3xl font-bold tracking-tight">{student.full_name}</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            {[student.class_name, student.grade].filter(Boolean).join(" · ") || " "}
          </div>
          {student.external_id && (
            <div className="text-xs text-muted-foreground mt-0.5">ID {student.external_id}</div>
          )}

          <div className="mt-4 flex justify-center">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset ${
                todayMeta?.pill ?? "bg-muted text-muted-foreground ring-border"
              }`}
            >
              <TodayIcon className="h-4 w-4" />
              Today: {todayMeta?.label ?? "No record yet"}
            </span>
          </div>
        </section>

        {/* Attendance summary */}
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground text-center">
              Attendance · last 60 days
            </div>
            <div className="mt-2 text-center">
              <div className="text-5xl font-bold leading-none">{stats.rate}%</div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.present + stats.late} of {stats.total} days on record
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-emerald-50 py-2.5">
                <div className="text-xl font-bold text-emerald-600">{stats.present}</div>
                <div className="text-[11px] font-medium text-emerald-700/80">Present</div>
              </div>
              <div className="rounded-lg bg-amber-50 py-2.5">
                <div className="text-xl font-bold text-amber-600">{stats.late}</div>
                <div className="text-[11px] font-medium text-amber-700/80">Late</div>
              </div>
              <div className="rounded-lg bg-rose-50 py-2.5">
                <div className="text-xl font-bold text-rose-600">{stats.absent}</div>
                <div className="text-[11px] font-medium text-rose-700/80">Absent</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent history */}
        <Card>
          <CardContent className="p-5">
            <div className="text-sm font-semibold mb-3">Recent history</div>
            {events.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <MinusCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
                No attendance records yet.
              </div>
            ) : (
              <ul className="max-h-72 overflow-y-auto divide-y -mx-1 px-1">
                {events.map((e) => {
                  const meta = STATUS_META[e.status];
                  return (
                    <li
                      key={e.day}
                      className="flex items-center justify-between py-2.5 text-sm"
                    >
                      <span className="text-foreground">{formatDay(e.day)}</span>
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Their QR code */}
        <Card>
          <CardContent className="p-5 flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold">
              <QrCode className="h-4 w-4" /> Your check-in code
            </div>
            <div className="mt-3 rounded-xl border bg-white p-3">
              {qrImg ? (
                <img
                  src={qrImg}
                  alt="Your personal check-in QR code"
                  className="h-44 w-44"
                  width={176}
                  height={176}
                />
              ) : (
                <Skeleton className="h-44 w-44" />
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground max-w-[16rem]">
              Show this at the kiosk to check in. Handy if you&apos;ve lost your card.
            </p>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center pt-2 pb-4">
          Powered by RollCall
        </p>
      </main>
    </div>
  );
}
