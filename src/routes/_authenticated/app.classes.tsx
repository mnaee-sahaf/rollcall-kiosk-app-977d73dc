import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listClasses, createClass } from "@/lib/classes.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/classes")({
  component: ClassesPage,
});

function ClassesPage() {
  const fetchClasses = useServerFn(listClasses);
  const create = useServerFn(createClass);
  const [classes, setClasses] = useState<Array<{ id: string; name: string; grade: string | null }>>(
    [],
  );
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [adding, setAdding] = useState(false);

  function refresh() {
    fetchClasses({}).then(setClasses);
  }
  useEffect(refresh, [fetchClasses]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await create({ data: { name, grade: grade || undefined } });
      toast.success("Class created");
      setName("");
      setGrade("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">Classes</h1>
      <p className="text-muted-foreground mb-8">Manage your classes and student rosters.</p>

      <Card className="p-5 mb-8">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4" /> New class
        </h2>
        <form onSubmit={handleCreate} className="grid sm:grid-cols-[1fr_140px_auto] gap-3">
          <div>
            <Label htmlFor="name" className="text-xs">
              Name
            </Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Grade 7 Math" />
          </div>
          <div>
            <Label htmlFor="grade" className="text-xs">
              Grade (optional)
            </Label>
            <Input id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="7" />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={adding}>
              {adding ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {classes.map((c) => (
          <Link
            key={c.id}
            to="/app/classes/$classId"
            params={{ classId: c.id }}
            className="rounded-lg border bg-white p-4 hover:border-primary/50 transition"
          >
            <div className="font-semibold">{c.name}</div>
            {c.grade && <div className="text-xs text-muted-foreground">Grade {c.grade}</div>}
            <div className="text-xs text-primary mt-2">Open →</div>
          </Link>
        ))}
        {classes.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-8">No classes yet.</div>
        )}
      </div>
    </div>
  );
}
