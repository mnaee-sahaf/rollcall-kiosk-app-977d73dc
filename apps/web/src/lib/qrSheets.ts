/**
 * Browser-side bulk PDF generators for student QR labels.
 *
 * Layouts:
 *  - "avery5160" : 30 labels per A4 sheet (3 col x 10 rows), ~63.5 x 25.4 mm — Avery 5160 / L7160
 *  - "20up"      : 4 col x 5 rows, larger label with class name
 *  - "10up"      : 2 col x 5 rows, full ID-card look
 *
 * Each label includes: QR code, student name, class name, and optional external ID.
 */
import jsPDF from "jspdf";
import QRCode from "qrcode";

export type StickerLayout = "avery5160" | "20up" | "10up";

export type StickerStudent = {
  full_name: string;
  qr_token: string;
  external_id?: string | null;
  class_name?: string | null;
};

type Spec = {
  cols: number;
  rows: number;
  // page-relative offsets in mm
  marginTopMm: number;
  marginLeftMm: number;
  labelWidthMm: number;
  labelHeightMm: number;
  gapXMm: number;
  gapYMm: number;
};

const SPECS: Record<StickerLayout, Spec> = {
  avery5160: {
    cols: 3,
    rows: 10,
    marginTopMm: 12.7,
    marginLeftMm: 4.7,
    labelWidthMm: 66,
    labelHeightMm: 25.4,
    gapXMm: 2.5,
    gapYMm: 0,
  },
  "20up": {
    cols: 4,
    rows: 5,
    marginTopMm: 10,
    marginLeftMm: 10,
    labelWidthMm: 45,
    labelHeightMm: 52,
    gapXMm: 5,
    gapYMm: 4,
  },
  "10up": {
    cols: 2,
    rows: 5,
    marginTopMm: 10,
    marginLeftMm: 12,
    labelWidthMm: 90,
    labelHeightMm: 54,
    gapXMm: 6,
    gapYMm: 4,
  },
};

async function qrPng(token: string, sizePx: number): Promise<string> {
  return QRCode.toDataURL(token, {
    margin: 0,
    width: sizePx,
    errorCorrectionLevel: "M",
  });
}

export async function generateStickerSheetPdf(
  students: StickerStudent[],
  layout: StickerLayout,
  opts: { schoolName?: string | null } = {},
): Promise<Blob> {
  const spec = SPECS[layout];
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const perPage = spec.cols * spec.rows;
  const qrPx = layout === "10up" ? 360 : 240;

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const idxOnPage = i % perPage;
    if (i > 0 && idxOnPage === 0) doc.addPage();

    const col = idxOnPage % spec.cols;
    const row = Math.floor(idxOnPage / spec.cols);
    const x = spec.marginLeftMm + col * (spec.labelWidthMm + spec.gapXMm);
    const y = spec.marginTopMm + row * (spec.labelHeightMm + spec.gapYMm);

    // Light border so users can trim — labels stay readable even without perforation
    doc.setDrawColor(220);
    doc.setLineWidth(0.1);
    doc.roundedRect(x, y, spec.labelWidthMm, spec.labelHeightMm, 1, 1);

    // QR — left side of label
    const qrSize = Math.min(spec.labelHeightMm - 4, spec.labelWidthMm * 0.42);
    const qrData = await qrPng(s.qr_token, qrPx);
    doc.addImage(qrData, "PNG", x + 2, y + (spec.labelHeightMm - qrSize) / 2, qrSize, qrSize);

    // Text — right side
    const textX = x + qrSize + 4;
    const textW = spec.labelWidthMm - qrSize - 6;
    let cursorY = y + 5;

    if (opts.schoolName && layout !== "avery5160") {
      doc.setFontSize(6);
      doc.setTextColor(140);
      doc.text(opts.schoolName, textX, cursorY, { maxWidth: textW });
      cursorY += 2.5;
    }

    doc.setFontSize(layout === "10up" ? 13 : layout === "20up" ? 10 : 9);
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    const nameLines = doc.splitTextToSize(s.full_name, textW);
    doc.text(nameLines.slice(0, 2), textX, cursorY + 2);
    cursorY += (Math.min(nameLines.length, 2) * (layout === "10up" ? 5 : 4));

    doc.setFont("helvetica", "normal");
    doc.setFontSize(layout === "10up" ? 9 : 7);
    doc.setTextColor(110);
    if (s.class_name) {
      doc.text(s.class_name, textX, cursorY + 2, { maxWidth: textW });
      cursorY += 3;
    }
    if (s.external_id) {
      doc.text(`ID ${s.external_id}`, textX, cursorY + 2, { maxWidth: textW });
    }
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
