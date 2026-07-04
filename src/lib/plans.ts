import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PlanId = "free" | "pro";

export type PlanLimits = {
  classes: number;
  students: number;
  staff: number;
  bulkImport: boolean;
};

// Single source of truth for plan limits — tune here. Infinity = unlimited.
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { classes: 2, students: 50, staff: 3, bulkImport: false },
  pro: { classes: Infinity, students: Infinity, staff: Infinity, bulkImport: true },
};

export async function getOrgPlan(
  admin: SupabaseClient<Database>,
  orgId: string,
): Promise<PlanId> {
  const { data } = await admin.from("organizations").select("plan").eq("id", orgId).maybeSingle();
  return (data?.plan as PlanId | undefined) ?? "free";
}

// Throw if adding `adding` more of `resource` would exceed the org's plan limit.
export async function assertWithinPlan(
  admin: SupabaseClient<Database>,
  orgId: string,
  resource: "classes" | "students" | "staff",
  adding = 1,
): Promise<void> {
  const plan = await getOrgPlan(admin, orgId);
  const limit = PLAN_LIMITS[plan][resource];
  if (!Number.isFinite(limit)) return;
  const table = resource === "staff" ? "memberships" : resource;
  const { count } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if ((count ?? 0) + adding > limit) {
    throw new Error(
      `Your Free plan allows ${limit} ${resource}. Upgrade to Pro to add more (Settings → Billing).`,
    );
  }
}

export async function assertBulkImportAllowed(
  admin: SupabaseClient<Database>,
  orgId: string,
): Promise<void> {
  const plan = await getOrgPlan(admin, orgId);
  if (!PLAN_LIMITS[plan].bulkImport) {
    throw new Error("Bulk import is a Pro feature. Upgrade to Pro to import in bulk.");
  }
}
