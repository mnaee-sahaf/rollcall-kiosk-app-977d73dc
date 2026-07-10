import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Circle, Sparkles } from "lucide-react";

type Progress = {
  hasSchoolName: boolean;
  hasTeachers: boolean;
  hasClasses: boolean;
  hasStudents: boolean;
};

export function SetupChecklistCard({ progress }: { progress: Progress }) {
  const items: Array<{ label: string; done: boolean; step: 1 | 2 | 3 | 4 }> = [
    { label: "Set up your school profile", done: progress.hasSchoolName, step: 1 },
    { label: "Invite teachers", done: progress.hasTeachers, step: 2 },
    { label: "Create a class", done: progress.hasClasses, step: 3 },
    { label: "Add students", done: progress.hasStudents, step: 4 },
  ];
  const nextStep = items.find((i) => !i.done)?.step ?? 5;
  const doneCount = items.filter((i) => i.done).length;

  return (
    <Card className="p-6 mb-8 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold">Finish setting up RollCall</h2>
          <p className="text-sm text-muted-foreground">
            {doneCount} of {items.length} steps complete
          </p>
          <ul className="mt-4 space-y-2">
            {items.map((it) => (
              <li key={it.step} className="flex items-center gap-2 text-sm">
                {it.done ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={it.done ? "text-muted-foreground line-through" : ""}>
                  {it.label}
                </span>
              </li>
            ))}
          </ul>
          <Button asChild className="mt-5">
            <Link to="/app/onboarding" search={{ step: nextStep }}>
              Resume setup
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
