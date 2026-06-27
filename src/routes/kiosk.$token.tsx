import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getKioskBoard, recordKioskScan } from "@/lib/kiosk.functions";
import { Html5Qrcode } from "html5-qrcode";
import { CheckCircle2, XCircle, Camera } from "lucide-react";
import { Logo } from "@/components/landing/Logo";

export const Route = createFileRoute("/kiosk/$token")({
  component: KioskPage,
});

type BoardData = Awaited<ReturnType<typeof getKioskBoard>>;

function KioskPage() {
  const { token } = Route.useParams();
  const fBoard = useServerFn(getKioskBoard);
  const fScan = useServerFn(recordKioskScan);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [scanning, setScanning] = useState(false);
  const [recent, setRecent] = useState<Array<{ name: string; ok: boolean; msg?: string; at: number }>>(
    [],
  );
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  function refresh() {
    fBoard({ data: { token } }).then(setBoard);
  }
  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 15000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function startCamera() {
    if (scannerRef.current) return;
    const el = document.getElementById("qr-reader");
    if (!el) return;
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decoded) => {
          const now = Date.now();
          if (lastScanRef.current.code === decoded && now - lastScanRef.current.at < 2500) return;
          lastScanRef.current = { code: decoded, at: now };
          try {
            const result = await fScan({ data: { sessionToken: token, qrToken: decoded } });
            if (result.ok) {
              setRecent((r) =>
                [
                  {
                    name: result.studentName,
                    ok: true,
                    msg: result.already ? "Already marked" : "Marked present",
                    at: now,
                  },
                  ...r,
                ].slice(0, 6),
              );
              refresh();
            } else {
              setRecent((r) =>
                [{ name: "Scan failed", ok: false, msg: result.error, at: now }, ...r].slice(0, 6),
              );
            }
          } catch (e) {
            setRecent((r) =>
              [{ name: "Error", ok: false, msg: e instanceof Error ? e.message : "Failed", at: now }, ...r].slice(0, 6),
            );
          }
        },
        () => {},
      );
      setScanning(true);
    } catch (e) {
      console.error(e);
      scannerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {}).finally(() => s.clear());
        scannerRef.current = null;
      }
    };
  }, []);

  if (!board) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if ("error" in board && board.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fcfbf8] px-6 text-center">
        <div className="max-w-md">
          <XCircle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Kiosk unavailable</h1>
          <p className="text-muted-foreground mt-2">
            {board.error === "expired"
              ? "This kiosk session has expired."
              : board.error === "revoked"
                ? "This kiosk session was ended."
                : "Invalid kiosk link."}
          </p>
          <p className="text-sm text-muted-foreground mt-4">Ask your teacher for a new link.</p>
        </div>
      </div>
    );
  }

  const present = board.todayEvents?.filter((e) => e.status === "present" || e.status === "late").length ?? 0;
  const total = board.students?.length ?? 0;

  return (
    <div className="min-h-screen bg-[#0f0e0c] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <Logo />
        <div className="text-sm">
          <span className="font-semibold">{board.cls?.name}</span>
          <span className="text-white/60 ml-3">
            {present}/{total} present
          </span>
        </div>
      </header>

      <div className="grid md:grid-cols-[1fr_320px] min-h-[calc(100vh-64px)]">
        <div className="p-6 flex flex-col items-center justify-center">
          <div
            id="qr-reader"
            className="w-full max-w-[420px] aspect-square rounded-xl overflow-hidden bg-black/40 border border-white/10"
          />
          {!scanning && (
            <button
              onClick={startCamera}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-white"
            >
              <Camera className="h-5 w-5" /> Start camera
            </button>
          )}
          <p className="mt-4 text-sm text-white/60 text-center max-w-sm">
            Hold a student's QR code in front of the camera. Each student is marked once per day.
          </p>
        </div>

        <aside className="border-l border-white/10 p-5 bg-black/30">
          <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-white/60">Recent scans</h2>
          <ul className="space-y-2">
            {recent.length === 0 && (
              <li className="text-sm text-white/40">No scans yet.</li>
            )}
            {recent.map((r, i) => (
              <li
                key={i}
                className={`flex items-start gap-2 rounded-md p-3 ${r.ok ? "bg-emerald-500/10" : "bg-rose-500/10"}`}
              >
                {r.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-400 mt-0.5" />
                )}
                <div>
                  <div className="font-medium">{r.name}</div>
                  {r.msg && <div className="text-xs text-white/60">{r.msg}</div>}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
