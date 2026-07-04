import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getClass } from "@/lib/classes.functions";
import { getSettings } from "@/lib/settings.functions";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/classes/$classId/qr")({
  ssr: false,
  component: QrSheetPage,
});

function QrSheetPage() {
  const { classId } = Route.useParams();
  const fGetClass = useServerFn(getClass);
  const fSettings = useServerFn(getSettings);
  const [cls, setCls] = useState<{ name: string; grade: string | null } | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [cards, setCards] = useState<
    Array<{ id: string; name: string; ext: string | null; qrSvg: string; lookupSvg: string }>
  >([]);

  useEffect(() => {
    fSettings({}).then((s) => {
      setLogoUrl(s?.logo_url ?? null);
      setSchoolName(s?.school_name ?? null);
    });
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    fGetClass({ data: { classId } }).then(async ({ cls, students }) => {
      setCls(cls);
      const results = await Promise.all(
        students.map(async (s) => ({
          id: s.id,
          name: s.full_name,
          ext: s.external_id,
          qrSvg: await QRCode.toString(s.qr_token, { type: "svg", margin: 0, width: 180 }),
          lookupSvg: await QRCode.toString(`${origin}/lookup/${s.qr_token}`, {
            type: "svg",
            margin: 0,
            width: 90,
          }),
        })),
      );
      setCards(results);
    });
  }, [classId, fGetClass, fSettings]);

  return (
    <div className="min-h-screen bg-white">
      <div className="p-6 print:hidden border-b flex items-center justify-between">
        <Link
          to="/app/classes/$classId"
          params={{ classId }}
          className="text-sm text-muted-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> Back to class
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" /> Print
        </Button>
      </div>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          {logoUrl && <img src={logoUrl} alt="" className="h-10 w-10 object-contain" />}
          <div>
            {schoolName && <div className="text-xs text-muted-foreground">{schoolName}</div>}
            <h1 className="text-2xl font-bold">{cls?.name}</h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6 print:hidden">
          Big QR = kiosk scan. Small QR = parent self-lookup. Cut along the dashed lines.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {cards.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-dashed p-3 flex flex-col items-center text-center break-inside-avoid"
            >
              {logoUrl && <img src={logoUrl} alt="" className="h-6 mb-1 object-contain" />}
              <div className="text-[10px] uppercase text-muted-foreground mb-1">
                {schoolName ?? "Jibble RollCall"}
              </div>
              <div
                dangerouslySetInnerHTML={{ __html: c.qrSvg }}
                className="[&_svg]:w-full [&_svg]:max-w-[140px]"
              />
              <div className="mt-2 font-semibold text-sm leading-tight">{c.name}</div>
              {c.ext && <div className="text-[10px] text-muted-foreground">ID {c.ext}</div>}
              <div className="text-[10px] text-muted-foreground mt-0.5">{cls?.name}</div>
              <div className="mt-2 pt-2 border-t border-dashed w-full flex items-center justify-center gap-2">
                <div
                  dangerouslySetInnerHTML={{ __html: c.lookupSvg }}
                  className="[&_svg]:w-12 [&_svg]:h-12"
                />
                <div className="text-[8px] text-muted-foreground text-left leading-tight">
                  Parent
                  <br />
                  lookup
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
