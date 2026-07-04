import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Resolves the caller's active org: their last_active_org_id if they're still a
// member of it, otherwise any org they belong to, otherwise null (no orgs yet).
// Membership is always re-checked here — a stale pointer never grants access.
export async function resolveActiveOrgId(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const [{ data: prof }, { data: mems }] = await Promise.all([
    admin.from("profiles").select("last_active_org_id").eq("id", userId).maybeSingle(),
    admin.from("memberships").select("org_id").eq("user_id", userId),
  ]);
  const memberOrgs = new Set((mems ?? []).map((m) => m.org_id));
  const pref = prof?.last_active_org_id ?? null;
  if (pref && memberOrgs.has(pref)) return pref;
  return (mems ?? [])[0]?.org_id ?? null;
}

// Resolve the caller's active org AND their role in it.
export async function resolveActiveMembership(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<{ orgId: string; role: string } | null> {
  const orgId = await resolveActiveOrgId(admin, userId);
  if (!orgId) return null;
  const { data } = await admin
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data) return null;
  return { orgId, role: data.role };
}

// Throw unless the caller has one of `roles` in their active org.
export async function requireOrgRole(
  admin: SupabaseClient<Database>,
  userId: string,
  roles: string[],
): Promise<{ orgId: string; role: string }> {
  const m = await resolveActiveMembership(admin, userId);
  if (!m) throw new Error("No active organization");
  if (!roles.includes(m.role)) throw new Error("Forbidden");
  return m;
}
