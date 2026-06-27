import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getClass } from "@/lib/classes.functions";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/classes/$classId/qr")({
  component: QrSheetPage,
});

function QrSheetPage() {
  const { classId } = Route.useParams();
  const fGetClass = useServerFn(getClass);
  const [cls, setCls] = useState<{ name: string; grade: string | null } | null>(null);
  const [cards, setCards] = useState<Array<{ id: string; name: string; ext: string | null; qrSvg: string }>>([]);

  useEffect(() => {
    fGetClass({ data: { classId } }).then(async ({ cls, students }) => {
      setCls(cls);
      const results = await Promise.all(
        students.map(async (s) => ({
          id: s.id,
          name: s.full_name,
          ext: s.external_id,
          qrSvg: await QRCode.toString(s.qr_token, { type: "svg", margin: 0, width: 180 }),
        })),
      );
      setCards(results);
    });
  }, [classId, fGetClass]);

  return (
    <div className="min-h-screen bg-white">
      <div className="p-6 print:hidden border-b flex items-center justify-between">
        <Link to="/app/classes/$classId" params={{ classId }} className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back to class
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" /> Print
        </Button>
      </div>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">{cls?.name}</h1>
        <p className="text-sm text-muted-foreground mb-6">Attendance QR cards — distribute one per student.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {cards.map((c) => (
            <div key={c.id} className="rounded-lg border p-4 flex flex-col items-center text-center break-inside-avoid">
              <div dangerouslySetInnerHTML={{ __html: c.qrSvg }} />
              <div className="mt-3 font-semibold">{c.name}</div>
              {c.ext && <div className="text-xs text-muted-foreground">ID {c.ext}</div>}
              <div className="text-[10px] text-muted-foreground mt-1">{cls?.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
