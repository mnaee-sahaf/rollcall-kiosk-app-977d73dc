import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/app/teachers")({
  component: TeachersPage,
});

function TeachersPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto flex justify-center">
      <Card className="p-8 max-w-md text-center">
        <h1 className="text-2xl font-bold mb-3">Team management</h1>
        <p className="text-sm text-muted-foreground">
          Adding administrators, teachers, and students is coming in an upcoming
          release.
        </p>
      </Card>
    </div>
  );
}
