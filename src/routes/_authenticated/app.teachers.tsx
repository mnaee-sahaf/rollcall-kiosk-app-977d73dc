import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listTeachers } from "@/lib/auth.functions";
import { createTeacherAccount, resetTeacherPassword } from "@/lib/teachers.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, RefreshCw, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/teachers")({
  component: TeachersPage,
});

type Teacher = Awaited<ReturnType<typeof listTeachers>>[number];

function genPassword() {
  // Ambiguity-free alphabet (no O/0, I/l/1) for creds people read aloud/type.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

function copy(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copied");
}

function CredCard({ email, password }: { email: string; password: string }) {
  return (
    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
      <p className="font-medium text-emerald-900">
        Share these with the teacher — they won't be shown again.
      </p>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Email</span>
          <span className="font-mono">{email}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Temporary password</span>
          <span className="font-mono">{password}</span>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="mt-3"
        onClick={() => copy(`Email: ${email}\nTemporary password: ${password}`)}
      >
        <Copy className="h-4 w-4 mr-1.5" /> Copy both
      </Button>
      <p className="mt-2 text-xs text-emerald-800">
        The teacher will be asked to set their own password on first sign-in.
      </p>
    </div>
  );
}

function TeachersPage() {
  const fTeachers = useServerFn(listTeachers);
  const fCreate = useServerFn(createTeacherAccount);
  const fReset = useServerFn(resetTeacherPassword);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [resetFor, setResetFor] = useState<{ name: string; password: string } | null>(null);

  function refresh() {
    fTeachers({})
      .then(setTeachers)
      .catch((e) => toast.error(e.message));
  }
  useEffect(refresh, [fTeachers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const pw = tempPassword || genPassword();
    setBusy(true);
    try {
      await fCreate({ data: { email, fullName, tempPassword: pw } });
      setCreated({ email, password: pw });
      setResetFor(null);
      setEmail("");
      setFullName("");
      setTempPassword("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create teacher login");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(t: Teacher) {
    if (!confirm(`Reset password for ${t.full_name ?? "this teacher"}?`)) return;
    const pw = genPassword();
    try {
      await fReset({ data: { userId: t.user_id, tempPassword: pw } });
      setResetFor({ name: t.full_name ?? t.user_id, password: pw });
      setCreated(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset password");
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Teachers</h1>

      <Card className="p-5 mb-6">
        <h2 className="font-semibold mb-1">Create teacher login</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Teachers sign in with the credentials you create here. There are no invite emails —
          share the login directly.
        </p>
        <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <Label className="text-xs">Email address</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Temporary password</Label>
            <div className="flex gap-2">
              <Input
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Auto-generated if left blank"
                minLength={8}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setTempPassword(genPassword())}
              >
                <RefreshCw className="h-4 w-4 mr-1.5" /> Generate
              </Button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create login"}
            </Button>
          </div>
        </form>
        {created && <CredCard email={created.email} password={created.password} />}
        {resetFor && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
            <p className="font-medium text-amber-900">
              New temporary password for {resetFor.name}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="font-mono">{resetFor.password}</span>
              <Button size="sm" variant="outline" onClick={() => copy(resetFor.password)}>
                <Copy className="h-4 w-4 mr-1.5" /> Copy
              </Button>
            </div>
            <p className="mt-2 text-xs text-amber-800">
              They'll be asked to set a new password on their next sign-in.
            </p>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold mb-3">Active teachers</h2>
        {teachers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teachers yet.</p>
        ) : (
          <ul className="divide-y">
            {teachers.map((t) => (
              <li key={t.user_id} className="py-2 text-sm flex items-center justify-between gap-2">
                <span>{t.full_name ?? t.user_id}</span>
                <Button size="sm" variant="ghost" onClick={() => handleReset(t)}>
                  <KeyRound className="h-4 w-4 mr-1.5" /> Reset password
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
