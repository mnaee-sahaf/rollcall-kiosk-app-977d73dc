import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Pure decision: given the user's preferred org and the orgs they belong to,
// pick the active org. A stale preference never grants access.
export function pickActiveOrgId(
  pref: string | null,
  memberOrgIds: string[],
): string | null {
  if (pref && memberOrgIds.includes(pref)) return pref;
  return memberOrgIds[0] ?? null;
}

export async function resolveActiveOrgId(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const [{ data: prof }, { data: mems }] = await Promise.all([
    admin.from("profiles").select("last_active_org_id").eq("id", userId).maybeSingle(),
    admin.from("memberships").select("org_id").eq("user_id", userId),
  ]);
  return pickActiveOrgId(
    prof?.last_active_org_id ?? null,
    (mems ?? []).map((m) => m.org_id),
  );
}

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
