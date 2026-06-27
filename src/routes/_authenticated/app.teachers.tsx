import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listTeachers, listInvites, inviteTeacher } from "@/lib/auth.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/teachers")({
  component: TeachersPage,
});

type Teacher = Awaited<ReturnType<typeof listTeachers>>[number];
type Invite = Awaited<ReturnType<typeof listInvites>>[number];

function TeachersPage() {
  const fTeachers = useServerFn(listTeachers);
  const fInvites = useServerFn(listInvites);
  const fInvite = useServerFn(inviteTeacher);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");

  function refresh() {
    fTeachers({}).then(setTeachers).catch((e) => toast.error(e.message));
    fInvites({}).then(setInvites).catch(() => {});
  }
  useEffect(refresh, [fTeachers, fInvites]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { invite } = await fInvite({ data: { email } });
      const url = `${window.location.origin}/auth?invite=${invite.token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied to clipboard");
      setEmail("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Teachers</h1>

      <Card className="p-5 mb-6">
        <h2 className="font-semibold mb-3">Invite teacher</h2>
        <form onSubmit={handleInvite} className="grid sm:grid-cols-[1fr_auto] gap-3">
          <div>
            <Label className="text-xs">Email address</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="flex items-end">
            <Button type="submit">Generate invite</Button>
          </div>
        </form>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="font-semibold mb-3">Active teachers</h2>
          {teachers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teachers yet.</p>
          ) : (
            <ul className="divide-y">
              {teachers.map((t) => (
                <li key={t.user_id} className="py-2 text-sm">
                  {t.full_name ?? t.user_id}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold mb-3">Pending invites</h2>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invites yet.</p>
          ) : (
            <ul className="divide-y">
              {invites.map((inv) => {
                const url = `${typeof window !== "undefined" ? window.location.origin : ""}/auth?invite=${inv.token}`;
                return (
                  <li key={inv.id} className="py-2 text-sm flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{inv.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {inv.accepted_at ? "Accepted" : "Pending"}
                      </div>
                    </div>
                    {!inv.accepted_at && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(url);
                          toast.success("Link copied");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
