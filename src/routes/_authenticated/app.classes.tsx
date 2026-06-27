import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listClasses, listClassesWithMeta, createClass } from "@/lib/classes.functions";
import { getMyContext, listTeachers } from "@/lib/auth.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/classes")({
  component: ClassesPage,
});

function ClassesPage() {
  const navigate = useNavigate();
  const fCtx = useServerFn(getMyContext);
  const fList = useServerFn(listClasses);
  const fListMeta = useServerFn(listClassesWithMeta);
  const fTeachers = useServerFn(listTeachers);
  const create = useServerFn(createClass);
  const [isAdmin, setIsAdmin] = useState(false);
  const [teachers, setTeachers] = useState<Array<{ user_id: string; full_name: string | null }>>([]);
  type Row = { id: string; name: string; grade: string | null; teacher_name?: string | null; student_count?: number };
  const [classes, setClasses] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fCtx({}).then((c) => {
      setIsAdmin(c.isAdmin);
      if (c.isAdmin) fTeachers({}).then(setTeachers).catch(() => {});
    });
  }, [fCtx, fTeachers]);

  const fetcher = useMemo(() => (isAdmin ? fListMeta : fList), [isAdmin, fList, fListMeta]);

  function refresh() {
    fetcher({}).then((rows) => setClasses(rows as Row[]));
  }
  useEffect(refresh, [fetcher]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const c = await create({
        data: {
          name,
          grade: grade || undefined,
          teacherId: isAdmin && teacherId ? teacherId : undefined,
        },
      });
      toast.success("Class created");
      setName("");
      setGrade("");
      setTeacherId("");
      navigate({ to: "/app/classes/$classId", params: { classId: c.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">Classes</h1>
      <p className="text-muted-foreground mb-8">
        {isAdmin ? "All classes across the school." : "Manage your classes and rosters."}
      </p>

      <Card className="p-5 mb-8">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4" /> New class
        </h2>
        <form
          onSubmit={handleCreate}
          className={`grid gap-3 ${isAdmin ? "sm:grid-cols-[1fr_120px_1fr_auto]" : "sm:grid-cols-[1fr_140px_auto]"}`}
        >
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Grade 7 Math" />
          </div>
          <div>
            <Label className="text-xs">Grade (optional)</Label>
            <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="7" />
          </div>
          {isAdmin && (
            <div>
              <Label className="text-xs">Teacher</Label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="h-9 w-full rounded-md border px-2 text-sm"
              >
                <option value="">Me (admin)</option>
                {teachers.map((t) => (
                  <option key={t.user_id} value={t.user_id}>
                    {t.full_name ?? t.user_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <Button type="submit" disabled={adding}>{adding ? "Creating…" : "Create"}</Button>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {classes.map((c) => (
          <a
            key={c.id}
            href={`/app/classes/${c.id}`}
            className="rounded-lg border bg-white p-4 hover:border-primary/50 transition"
          >
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" />
              <div className="font-semibold">{c.name}</div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {c.grade && <>Grade {c.grade} · </>}
              {c.student_count !== undefined && <>{c.student_count} students</>}
            </div>
            {c.teacher_name && (
              <div className="text-xs text-muted-foreground mt-1">Teacher: {c.teacher_name}</div>
            )}
          </a>
        ))}
        {classes.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-8">No classes yet.</div>
        )}
      </div>
    </div>
  );
}
