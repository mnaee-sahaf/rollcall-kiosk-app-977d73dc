import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listStaff,
  createStaffAccount,
  resetStaffPassword,
  setStaffRole,
  removeStaff,
} from "@/lib/staff.functions";
import { getMyContext } from "@/lib/auth.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, UserPlus, KeyRound, Trash2, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/teachers")({
  component: TeamPage,
});

type StaffRow = {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
  is_self: boolean;
};

function roleLabel(role: string) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Administrator";
  if (role === "manager") return "Teacher";
  return role;
}

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

type Credential = { email: string; tempPassword: string };

function TeamPage() {
  const navigate = useNavigate();
  const fCtx = useServerFn(getMyContext);
  const fList = useServerFn(listStaff);
  const fCreate = useServerFn(createStaffAccount);
  const fReset = useServerFn(resetStaffPassword);
  const fSetRole = useServerFn(setStaffRole);
  const fRemove = useServerFn(removeStaff);

  const [ready, setReady] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [staff, setStaff] = useState<StaffRow[]>([]);

  // Add-member form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "manager">("manager");
  const [tempPassword, setTempPassword] = useState("");
  const [adding, setAdding] = useState(false);

  // One-time credential display (from create or reset)
  const [credential, setCredential] = useState<Credential | null>(null);

  useEffect(() => {
    fCtx({}).then((c) => {
      if (!c.isAdmin) {
        navigate({ to: "/app" });
        return;
      }
      setIsOwner(c.isOwner);
      setReady(true);
    });
  }, [fCtx, navigate]);

  function refresh() {
    fList({}).then((rows) => setStaff(rows as StaffRow[]));
  }

  useEffect(() => {
    if (ready) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fCreate({
        data: {
          email,
          fullName,
          role,
          tempPassword: tempPassword || undefined,
        },
      });
      if (res.tempPassword) {
        setCredential({ email: res.email, tempPassword: res.tempPassword });
        toast.success("Team member created");
      } else if (!res.created) {
        toast.success("Added existing user to your organization.");
      } else {
        toast.success("Team member added");
      }
      setFullName("");
      setEmail("");
      setRole("manager");
      setTempPassword("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setAdding(false);
    }
  }

  async function handleReset(row: StaffRow) {
    try {
      const res = await fReset({ data: { userId: row.user_id } });
      setCredential({ email: row.email ?? "", tempPassword: res.tempPassword });
      toast.success("Password reset");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    }
  }

  async function handleChangeRole(row: StaffRow, next: "admin" | "manager") {
    if (next === row.role) return;
    try {
      await fSetRole({ data: { userId: row.user_id, role: next } });
      toast.success("Role updated");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  async function handleRemove(row: StaffRow) {
    const name = row.full_name || row.email || "this member";
    if (!confirm(`Remove ${name} from your organization?`)) return;
    try {
      await fRemove({ data: { userId: row.user_id } });
      toast.success("Member removed");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  function copyBoth() {
    if (!credential) return;
    const text = `Email: ${credential.email}\nTemporary password: ${credential.tempPassword}`;
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Copied to clipboard"))
      .catch(() => toast.error("Couldn't copy"));
  }

  if (!ready) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-muted-foreground">Loading…</div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">Team</h1>
      <p className="text-muted-foreground mb-8">
        Manage administrators and teachers in your organization.
      </p>

      {credential && (
        <Card className="p-5 mb-8 border-primary/40 bg-primary/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold mb-2 flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> One-time credentials
              </h2>
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  <span className="font-mono">{credential.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Temporary password: </span>
                  <span className="font-mono">{credential.tempPassword}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Share these securely — they'll set their own password on first sign-in.
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button type="button" size="sm" onClick={copyBoth}>
                <Copy className="h-4 w-4 mr-2" /> Copy both
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setCredential(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5 mb-8">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> Add team member
        </h2>
        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Full name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="jane@school.edu"
            />
          </div>
          <div>
            <Label className="text-xs">Role</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as "admin" | "manager")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Teacher</SelectItem>
                {isOwner && <SelectItem value="admin">Administrator</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Temporary password (optional)</Label>
            <div className="flex gap-2">
              <Input
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Auto-generated if blank"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setTempPassword(generatePassword())}
              >
                Generate
              </Button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={adding}>
              <Plus className="h-4 w-4 mr-2" />
              {adding ? "Adding…" : "Add member"}
            </Button>
          </div>
        </form>
      </Card>

      <div className="rounded-lg border bg-white divide-y">
        {staff.map((row) => {
          const display = row.full_name || row.email || "Unknown";
          const isOwnerRow = row.role === "owner";
          const isAdminRow = row.role === "admin";
          // Actions hidden on the owner row and self rows. Admin rows are only
          // manageable by the owner.
          const canManage =
            !isOwnerRow && !row.is_self && (!isAdminRow || isOwner);
          return (
            <div
              key={row.user_id}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{display}</div>
                {row.full_name && row.email && (
                  <div className="text-xs text-muted-foreground truncate">
                    {row.email}
                  </div>
                )}
              </div>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {roleLabel(row.role)}
                {row.is_self && " · You"}
              </span>
              {canManage && (
                <div className="flex items-center gap-2">
                  <Select
                    value={row.role === "admin" ? "admin" : "manager"}
                    onValueChange={(v) =>
                      handleChangeRole(row, v as "admin" | "manager")
                    }
                  >
                    <SelectTrigger className="h-8 w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Teacher</SelectItem>
                      {isOwner && (
                        <SelectItem value="admin">Administrator</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleReset(row)}
                  >
                    <KeyRound className="h-4 w-4 mr-1" /> Reset password
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRemove(row)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        {staff.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No team members yet.
          </div>
        )}
      </div>
    </div>
  );
}
