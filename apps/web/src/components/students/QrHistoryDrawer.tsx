import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listStudentQrHistory, rotateStudentQr } from "@/lib/classes.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCcw, ShieldOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type HistRow = Awaited<ReturnType<typeof listStudentQrHistory>>[number];

export function QrHistoryDrawer({
  studentId,
  studentName,
  open,
  onOpenChange,
  onRotated,
}: {
  studentId: string | null;
  studentName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRotated?: () => void;
}) {
  const fList = useServerFn(listStudentQrHistory);
  const fRotate = useServerFn(rotateStudentQr);
  const [rows, setRows] = useState<HistRow[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && studentId) {
      fList({ data: { studentId } }).then(setRows);
    }
  }, [open, studentId, fList]);

  async function handleReissue() {
    if (!studentId) return;
    if (
      !confirm(
        `Revoke ${studentName}'s current QR and issue a new one? Old printed cards will stop working.`,
      )
    )
      return;
    setBusy(true);
    try {
      await fRotate({ data: { studentId, reason: reason || undefined } });
      toast.success("New QR issued");
      setReason("");
      const next = await fList({ data: { studentId } });
      setRows(next);
      onRotated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{studentName} — QR history</SheetTitle>
        </SheetHeader>

        <div className="mt-6 rounded-lg border bg-muted/30 p-4">
          <div className="text-sm font-semibold mb-1 flex items-center gap-2">
            <RefreshCcw className="h-4 w-4 text-primary" />
            Revoke &amp; reissue
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Use this if the card is lost, damaged, or shared with another student. The old QR
            will be rejected at the kiosk.
          </p>
          <Label className="text-xs">Reason (optional)</Label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. lost card"
            className="mt-1 mb-3 h-8 text-sm"
          />
          <Button size="sm" onClick={handleReissue} disabled={busy}>
            {busy ? "Issuing…" : "Revoke & issue new QR"}
          </Button>
        </div>

        <h3 className="mt-6 mb-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
          History
        </h3>
        <ul className="space-y-2">
          {rows.length === 0 && (
            <li className="text-sm text-muted-foreground">No history yet.</li>
          )}
          {rows.map((r) => {
            const isActive = !r.revoked_at;
            return (
              <li
                key={r.id}
                className={`rounded-md border p-3 ${
                  isActive ? "bg-emerald-50 border-emerald-200" : "bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-medium">
                  {isActive ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Active
                    </>
                  ) : (
                    <>
                      <ShieldOff className="h-3.5 w-3.5 text-muted-foreground" /> Revoked
                    </>
                  )}
                </div>
                <div className="mt-1 font-mono text-[11px] break-all text-muted-foreground">
                  {r.token}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Issued {new Date(r.issued_at).toLocaleString()}
                  {r.revoked_at && (
                    <> · Revoked {new Date(r.revoked_at).toLocaleString()}</>
                  )}
                </div>
                {r.reason && (
                  <div className="mt-1 text-[11px] italic text-muted-foreground">
                    “{r.reason}”
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
