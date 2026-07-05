import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getKioskBoard, recordKioskScan } from "@/lib/kiosk.functions";
import { Html5Qrcode } from "html5-qrcode";
import { CheckCircle2, XCircle, Camera } from "lucide-react";
import { Logo } from "@/components/landing/Logo";

export const Route = createFileRoute("/kiosk/$token")({
  ssr: false,
  component: KioskPage,
});

type BoardData = Awaited<ReturnType<typeof getKioskBoard>>;
type Flash = { name: string; ok: boolean; msg?: string } | null;

// Turn a getUserMedia / html5-qrcode failure into staff-readable guidance.
function cameraErrorMessage(e: unknown): string {
  const name = typeof e === "object" && e && "name" in e ? String((e as { name: unknown }).name) : "";
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const text = `${name} ${raw}`.toLowerCase();
  if (text.includes("notallowed") || text.includes("permission") || text.includes("denied"))
    return "Camera access was blocked. Allow camera permission for this site, then tap Start camera again.";
  if (text.includes("notfound") || text.includes("no camera") || text.includes("devices"))
    return "No camera was found on this device.";
  if (text.includes("notreadable") || text.includes("inuse") || text.includes("track start"))
    return "The camera is already in use by another app. Close it and tap Start camera again.";
  return "Could not start the camera. Check permissions and try again.";
}

function KioskPage() {
  const { token } = Route.useParams();
  const fBoard = useServerFn(getKioskBoard);
  const fScan = useServerFn(recordKioskScan);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [scanning, setScanning] = useState(false);
  const [recent, setRecent] = useState<
    Array<{ name: string; ok: boolean; msg?: string; at: number }>
  >([]);
  const [flash, setFlash] = useState<Flash>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function refresh() {
    fBoard({ data: { token } }).then(setBoard);
  }
  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 15000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function showFlash(f: Flash) {
    setFlash(f);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1400);
  }

  async function startCamera() {
    if (scannerRef.current) return;
    const el = document.getElementById("qr-reader");
    if (!el) return;
    setCamError(null);
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
              const msg = result.already ? "Already marked" : "Marked present";
              showFlash({ name: result.studentName, ok: true, msg });
              setRecent((r) =>
                [{ name: result.studentName, ok: true, msg, at: now }, ...r].slice(0, 6),
              );
              refresh();
            } else {
              showFlash({ name: "Scan failed", ok: false, msg: result.error });
              setRecent((r) =>
                [{ name: "Scan failed", ok: false, msg: result.error, at: now }, ...r].slice(0, 6),
              );
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed";
            showFlash({ name: "Error", ok: false, msg });
            setRecent((r) => [{ name: "Error", ok: false, msg, at: now }, ...r].slice(0, 6));
          }
        },
        () => {},
      );
      setScanning(true);
    } catch (e) {
      console.error(e);
      scannerRef.current = null;
      setCamError(cameraErrorMessage(e));
    }
  }

  useEffect(() => {
    return () => {
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {}).finally(() => s.clear());
        scannerRef.current = null;
      }
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
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

  const present =
    board.todayEvents?.filter((e) => e.status === "present" || e.status === "late").length ?? 0;
  const total = board.students?.length ?? 0;
  const insecure =
    typeof window !== "undefined" &&
    window.location.protocol === "http:" &&
    window.location.hostname !== "localhost";

  return (
    <div className="min-h-screen bg-[#0f0e0c] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          {board.settings?.logo_url ? (
            <img src={board.settings.logo_url} alt="" className="h-8 w-8 object-contain rounded" />
          ) : (
            <Logo />
          )}
          <div className="text-sm">
            {board.settings?.school_name && (
              <div className="text-xs text-white/60">{board.settings.school_name}</div>
            )}
            <div className="font-semibold">{board.cls?.name}</div>
          </div>
        </div>
        <div className="text-sm text-white/70">
          {present}/{total} present
        </div>
      </header>

      <div className="grid md:grid-cols-[1fr_320px] min-h-[calc(100vh-64px)]">
        <div className="p-6 flex flex-col items-center justify-center relative">
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
          {insecure && (
            <p className="mt-3 text-xs text-amber-300 max-w-sm text-center">
              Camera access requires HTTPS. Open this kiosk URL over https:// or on localhost.
            </p>
          )}
          {camError && (
            <p className="mt-3 text-sm text-rose-300 max-w-sm text-center" role="alert">
              {camError}
            </p>
          )}
          <p className="mt-4 text-sm text-white/60 text-center max-w-sm">
            Hold a student's QR code in front of the camera. Each student is marked once per day.
          </p>

          {flash && (
            <div
              className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in`}
            >
              <div
                className={`rounded-2xl px-10 py-8 text-center ${
                  flash.ok ? "bg-emerald-500" : "bg-rose-500"
                }`}
              >
                {flash.ok ? (
                  <CheckCircle2 className="h-16 w-16 mx-auto" />
                ) : (
                  <XCircle className="h-16 w-16 mx-auto" />
                )}
                <div className="mt-3 text-3xl font-bold">{flash.name}</div>
                {flash.msg && <div className="mt-1 text-white/90">{flash.msg}</div>}
              </div>
            </div>
          )}
        </div>

        <aside className="border-l border-white/10 p-5 bg-black/30">
          <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-white/60">
            Recent scans
          </h2>
          <ul className="space-y-2">
            {recent.length === 0 && <li className="text-sm text-white/40">No scans yet.</li>}
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
