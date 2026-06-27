import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAllStudents, listClasses, updateStudent, deleteStudent } from "@/lib/classes.functions";
import { getMyContext } from "@/lib/auth.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/students")({
  component: AllStudentsPage,
});

type Row = Awaited<ReturnType<typeof listAllStudents>>[number];

function AllStudentsPage() {
  const navigate = useNavigate();
  const fCtx = useServerFn(getMyContext);
  const fList = useServerFn(listAllStudents);
  const fClasses = useServerFn(listClasses);
  const fUpdate = useServerFn(updateStudent);
  const fDelete = useServerFn(deleteStudent);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fCtx({}).then((c) => {
      if (!c.isAdmin) navigate({ to: "/app" });
    });
    fClasses({}).then(setClasses);
  }, [fCtx, fClasses, navigate]);

  function refresh() {
    fList({ data: { search: search || undefined, classId: classId || undefined } }).then(setRows);
  }
  useEffect(() => {
    const t = setTimeout(refresh, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, classId]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">All students</h1>
      <Card className="p-4 mb-6 grid sm:grid-cols-[1fr_240px] gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-9 rounded-md border px-2 text-sm"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Card>

      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Class</th>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Active</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2 font-medium">{s.full_name}</td>
                <td className="px-4 py-2">
                  <Link to="/app/classes/$classId" params={{ classId: s.class_id }} className="text-primary underline">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(s as any).classes?.name ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{s.external_id ?? "—"}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={async () => {
                      await fUpdate({ data: { studentId: s.id, active: !s.active } });
                      refresh();
                    }}
                    className={`px-2 py-0.5 rounded text-xs ${s.active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                  >
                    {s.active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm(`Delete ${s.full_name}?`)) return;
                      await fDelete({ data: { studentId: s.id } });
                      toast.success("Deleted");
                      refresh();
                    }}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground">No students.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
