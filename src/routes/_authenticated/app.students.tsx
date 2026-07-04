import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listAllStudents,
  listClasses,
  updateStudent,
  deleteStudent,
} from "@/lib/classes.functions";
import { getMyContext } from "@/lib/auth.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Search, Printer, History, MoreVertical } from "lucide-react";
import { QrHistoryDrawer } from "@/components/students/QrHistoryDrawer";
import { StickerSheetDialog } from "@/components/students/StickerSheetDialog";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [historyFor, setHistoryFor] = useState<{ id: string; name: string } | null>(null);
  const [stickerScope, setStickerScope] = useState<
    | { classId?: string; studentIds?: string[]; label: string }
    | null
  >(null);

  useEffect(() => {
    fCtx({}).then((c) => {
      if (!c.isAdmin) navigate({ to: "/app" });
    });
    fClasses({}).then(setClasses);
  }, [fCtx, fClasses, navigate]);

  function refresh() {
    fList({
      data: { search: search || undefined, classId: classId || undefined },
    }).then(setRows);
  }
  useEffect(() => {
    const t = setTimeout(refresh, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, classId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  const selectedCount = selected.size;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">All students</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage rosters, print QR cards or sticker sheets, and reissue lost QRs.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setStickerScope({
                classId: classId || undefined,
                label: classId
                  ? classes.find((c) => c.id === classId)?.name ?? "this class"
                  : "all students",
              })
            }
          >
            <Printer className="h-4 w-4 mr-2" />
            Print stickers
          </Button>
        </div>
      </div>

      <Card className="p-4 mb-4 grid sm:grid-cols-[1fr_240px] gap-3">
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
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Card>

      {selectedCount > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
          <span className="font-medium">{selectedCount} selected</span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setStickerScope({
                  studentIds: Array.from(selected),
                  label: `${selectedCount} selected`,
                })
              }
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" /> Stickers
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 w-8">
                <Checkbox
                  checked={rows.length > 0 && selected.size === rows.length}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Guardian email</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2">
                  <Checkbox
                    checked={selected.has(s.id)}
                    onCheckedChange={() => toggle(s.id)}
                    aria-label={`Select ${s.full_name}`}
                  />
                </td>
                <td className="px-3 py-2 font-medium">{s.full_name}</td>
                <td className="px-3 py-2">
                  <Link
                    to="/app/classes/$classId"
                    params={{ classId: s.class_id }}
                    className="text-primary underline"
                  >
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(s as any).classes?.name ?? "—"}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {s.external_id ?? "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  <EditableEmail
                    value={
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (s as any).guardian_email ?? ""
                    }
                    onSave={async (v) => {
                      await fUpdate({
                        data: { studentId: s.id, guardian_email: v || null },
                      });
                      toast.success("Saved");
                      refresh();
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={async () => {
                      await fUpdate({
                        data: { studentId: s.id, active: !s.active },
                      });
                      refresh();
                    }}
                    className={`px-2 py-0.5 rounded text-xs ${
                      s.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          setHistoryFor({ id: s.id, name: s.full_name })
                        }
                      >
                        <History className="h-4 w-4 mr-2" />
                        QR history & reissue
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          setStickerScope({
                            studentIds: [s.id],
                            label: s.full_name,
                          })
                        }
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        Print sticker
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-rose-600 focus:text-rose-700"
                        onClick={async () => {
                          if (!confirm(`Delete ${s.full_name}?`)) return;
                          await fDelete({ data: { studentId: s.id } });
                          toast.success("Deleted");
                          refresh();
                        }}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  No students.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <QrHistoryDrawer
        studentId={historyFor?.id ?? null}
        studentName={historyFor?.name ?? ""}
        open={!!historyFor}
        onOpenChange={(v) => !v && setHistoryFor(null)}
        onRotated={refresh}
      />

      {stickerScope && (
        <StickerSheetDialog
          open={!!stickerScope}
          onOpenChange={(v) => !v && setStickerScope(null)}
          scope={stickerScope}
        />
      )}
    </div>
  );
}

function EditableEmail({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => Promise<void> | void;
}) {
  const [v, setV] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => setV(value), [value]);
  if (!editing) {
    return (
      <button
        className="text-left hover:underline w-full"
        onClick={() => setEditing(true)}
      >
        {value || <span className="italic text-muted-foreground/60">add…</span>}
      </button>
    );
  }
  return (
    <Input
      autoFocus
      value={v}
      type="email"
      onChange={(e) => setV(e.target.value)}
      onBlur={async () => {
        setEditing(false);
        if (v !== value) await onSave(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setV(value);
          setEditing(false);
        }
      }}
      className="h-7 text-xs"
      placeholder="parent@example.com"
    />
  );
}
