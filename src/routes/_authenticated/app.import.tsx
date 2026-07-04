import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import Papa from "papaparse";
import { importStudents } from "@/lib/import.functions";
import { getMyContext } from "@/lib/auth.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/import")({
  component: ImportPage,
});

type Result = { row: number; ok: boolean; error?: string };

function ImportPage() {
  const navigate = useNavigate();
  const fCtx = useServerFn(getMyContext);
  const fStudents = useServerFn(importStudents);
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fCtx({}).then((c) => {
      if (!c.isAdmin) navigate({ to: "/app" });
    });
  }, [fCtx, navigate]);

  function parseCsv<T>(file: File): Promise<T[]> {
    return new Promise((resolve, reject) => {
      Papa.parse<T>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
        complete: (res) => resolve(res.data),
        error: reject,
      });
    });
  }

  async function onStudentsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setRunning(true);
    setResults([]);
    try {
      const rows = await parseCsv<{
        class_name: string;
        full_name: string;
        external_id?: string;
        grade?: string;
      }>(f);
      const clean = rows.filter((r) => r.class_name && r.full_name);
      const { results } = await fStudents({ data: { rows: clean } });
      setResults(results);
      toast.success(`Processed ${results.length} rows`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setRunning(false);
      e.target.value = "";
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Bulk import students</h1>

      <Card className="p-6">
        <h2 className="font-semibold">Import students CSV</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Columns: <code>class_name, full_name, external_id, grade</code>. Classes are created
          automatically if missing.
        </p>
        <label className="mt-4 inline-flex items-center gap-2 cursor-pointer rounded-md bg-primary px-4 py-2 text-white text-sm">
          <Upload className="h-4 w-4" /> {running ? "Importing…" : "Choose CSV"}
          <input type="file" accept=".csv" hidden onChange={onStudentsFile} disabled={running} />
        </label>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(
            "class_name,full_name,external_id,grade\nGrade 7 Math,Jane Doe,STU001,7\nGrade 7 Math,John Smith,STU002,7\n",
          )}`}
          download="students-template.csv"
          className="ml-3 text-sm text-primary inline-flex items-center gap-1"
        >
          <FileText className="h-3 w-3" /> Download template
        </a>
      </Card>

      {results.length > 0 && (
        <Card className="p-5 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">
              Results — {results.filter((r) => r.ok).length} ok,{" "}
              {results.filter((r) => !r.ok).length} errors
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const lines = ["row,ok,error"];
                for (const r of results)
                  lines.push(`${r.row},${r.ok},${(r.error ?? "").replace(/,/g, " ")}`);
                const blob = new Blob([lines.join("\n")], { type: "text/csv" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "import-results.csv";
                a.click();
              }}
            >
              Download results
            </Button>
          </div>
          <div className="max-h-96 overflow-auto rounded border">
            <table className="w-full text-sm">
              <tbody>
                {results.map((r) => (
                  <tr key={r.row} className="border-t">
                    <td className="px-3 py-1.5">
                      <span className={r.ok ? "text-emerald-600" : "text-rose-600"}>
                        {r.ok ? "✓" : "✗"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">Row {r.row}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{r.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
