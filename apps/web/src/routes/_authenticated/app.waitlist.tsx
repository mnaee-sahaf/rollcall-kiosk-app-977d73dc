import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listWaitlist, deleteWaitlistEntry } from "@/lib/waitlist.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, Trash2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/waitlist")({
  component: WaitlistPage,
});

type Row = Awaited<ReturnType<typeof listWaitlist>>[number];

function WaitlistPage() {
  const fList = useServerFn(listWaitlist);
  const fDelete = useServerFn(deleteWaitlistEntry);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  function refresh() {
    setLoading(true);
    fList({})
      .then((d) => { setRows(d); setForbidden(false); })
      .catch((e) => {
        if (String(e?.message).toLowerCase().includes("forbidden")) setForbidden(true);
        else toast.error(e.message);
      })
      .finally(() => setLoading(false));
  }
  useEffect(refresh, [fList]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.email.toLowerCase().includes(needle) ||
        (r.school ?? "").toLowerCase().includes(needle) ||
        (r.source ?? "").toLowerCase().includes(needle),
    );
  }, [rows, q]);

  function exportCsv() {
    const header = ["email", "school", "source", "created_at"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
      lines.push([esc(r.email), esc(r.school ?? ""), esc(r.source ?? ""), esc(r.created_at)].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function remove(id: string) {
    if (!confirm("Remove this waitlist entry?")) return;
    try {
      await fDelete({ data: { id } });
      setRows((rs) => rs.filter((r) => r.id !== id));
      toast.success("Removed");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (forbidden) {
    return (
      <div className="p-8">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Forbidden</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only administrators can view waitlist signups.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Waitlist</h1>
          <p className="text-sm text-muted-foreground">
            Signups from the public landing page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{filtered.length} {filtered.length === 1 ? "entry" : "entries"}</Badge>
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email, school, source…"
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? "No signups yet." : "No matches."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">School</th>
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">Signed up</th>
                  <th className="py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 pr-3 font-medium">{r.email}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.school ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className="text-[10px]">{r.source ?? "landing"}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground tabular-nums">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
