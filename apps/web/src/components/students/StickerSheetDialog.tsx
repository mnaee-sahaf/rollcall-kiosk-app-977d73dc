import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listStudentsForBulk } from "@/lib/classes.functions";
import { getSettings } from "@/lib/settings.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import {
  generateStickerSheetPdf,
  downloadBlob,
  type StickerLayout,
} from "@/lib/qrSheets";

const LAYOUTS: Array<{ value: StickerLayout; label: string; sub: string }> = [
  { value: "avery5160", label: "30 per sheet", sub: "Avery 5160 / L7160 labels — small" },
  { value: "20up", label: "20 per sheet", sub: "Medium labels — name + class fits" },
  { value: "10up", label: "10 per sheet", sub: "Large ID-card sized labels" },
];

export function StickerSheetDialog({
  open,
  onOpenChange,
  scope,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scope: { classId?: string; studentIds?: string[]; label: string };
}) {
  const fStudents = useServerFn(listStudentsForBulk);
  const fSettings = useServerFn(getSettings);
  const [layout, setLayout] = useState<StickerLayout>("avery5160");
  const [busy, setBusy] = useState(false);

  async function handleGenerate() {
    setBusy(true);
    try {
      const [students, settings] = await Promise.all([
        fStudents({
          data: {
            classId: scope.classId,
            studentIds: scope.studentIds,
          },
        }),
        fSettings({}),
      ]);
      if (!students.length) {
        toast.error("No students to print");
        return;
      }
      const blob = await generateStickerSheetPdf(
        students.map((s) => ({
          full_name: s.full_name,
          qr_token: s.qr_token,
          external_id: s.external_id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          class_name: (s as any).classes?.name ?? null,
        })),
        layout,
        { schoolName: settings?.name ?? null },
      );
      downloadBlob(blob, `rollcall-stickers-${layout}-${Date.now()}.pdf`);
      toast.success(`Generated ${students.length} labels`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Print QR stickers</DialogTitle>
          <DialogDescription>
            Generating labels for <strong>{scope.label}</strong>. Pick a layout that matches
            the label paper you're using.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Layout
          </Label>
          {LAYOUTS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLayout(l.value)}
              className={`w-full text-left rounded-lg border p-3 transition ${
                layout === l.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <div className="font-semibold text-sm">{l.label}</div>
              <div className="text-xs text-muted-foreground">{l.sub}</div>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={busy}>
            <Printer className="h-4 w-4 mr-2" />
            {busy ? "Generating…" : "Generate PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
