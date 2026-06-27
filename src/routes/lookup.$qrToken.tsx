import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { lookupStudentPublic } from "@/lib/settings.functions";
import { Logo } from "@/components/landing/Logo";
import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";

export const Route = createFileRoute("/lookup/$qrToken")({
  component: LookupPage,
});

type Data = Awaited<ReturnType<typeof lookupStudentPublic>>;

function LookupPage() {
  const { qrToken } = Route.useParams();
  const fLookup = useServerFn(lookupStudentPublic);
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fLookup({ data: { qrToken } }).then(setData);
  }, [qrToken, fLookup]);

  if (!data) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!data.found) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center bg-[#fcfbf8]">
        <div>
          <XCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h1 className="mt-3 text-2xl font-bold">Student not found</h1>
          <p className="text-muted-foreground mt-1">This QR code isn't recognised.</p>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayEvent = data.events.find((e) => e.day === today);

  return (
    <div className="min-h-screen bg-[#fcfbf8]">
      <header className="border-b px-6 py-4 flex justify-center bg-white">
        <Logo />
      </header>
      <main className="max-w-md mx-auto p-6">
        <div className="text-center">
          <div className="text-sm text-muted-foreground">{data.student.class_name}</div>
          <h1 className="text-3xl font-bold mt-1">{data.student.full_name}</h1>
          {data.student.external_id && (
            <div className="text-xs text-muted-foreground mt-1">ID {data.student.external_id}</div>
          )}
        </div>

        <div className="mt-6 rounded-xl border bg-white p-5 text-center">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Today</div>
          <div className="mt-2 flex items-center justify-center gap-2 text-lg font-semibold">
            {todayEvent ? (
              todayEvent.status === "present" ? (
                <><CheckCircle2 className="h-5 w-5 text-emerald-500" /> Present</>
              ) : todayEvent.status === "late" ? (
                <><CheckCircle2 className="h-5 w-5 text-amber-500" /> Late</>
              ) : (
                <><XCircle className="h-5 w-5 text-rose-500" /> Absent</>
              )
            ) : (
              <><MinusCircle className="h-5 w-5 text-muted-foreground" /> Not yet marked</>
            )}
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-semibold mb-2">Last 14 days</h2>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 14 }).map((_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (13 - i));
              const key = d.toISOString().slice(0, 10);
              const e = data.events.find((x) => x.day === key);
              const color =
                e?.status === "present"
                  ? "bg-emerald-500"
                  : e?.status === "late"
                    ? "bg-amber-500"
                    : e?.status === "absent"
                      ? "bg-rose-500"
                      : "bg-muted";
              return (
                <div key={key} className="text-center">
                  <div className={`h-8 w-full rounded ${color}`} title={`${key}: ${e?.status ?? "—"}`} />
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-8">
          Powered by RollCall
        </p>
      </main>
    </div>
  );
}
