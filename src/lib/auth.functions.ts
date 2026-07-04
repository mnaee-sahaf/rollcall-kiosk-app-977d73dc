import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveOrgId } from "@/lib/org-context";

// Everything the app shell needs: the caller's profile, the orgs they belong
// to, the active org, and setup progress scoped to that org.
export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profile }, { data: mems }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("memberships").select("org_id, role").eq("user_id", userId),
    ]);

    const orgIds = (mems ?? []).map((m) => m.org_id);
    const { data: orgRows } = await supabaseAdmin
      .from("organizations")
      .select("id, name, onboarded_at")
      .in("id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"]);
    const orgById = new Map((orgRows ?? []).map((o) => [o.id, o]));

    const orgs = (mems ?? []).map((m) => ({
      id: m.org_id,
      role: m.role as string,
      name: orgById.get(m.org_id)?.name ?? "Organization",
    }));

    const activeOrgId = await resolveActiveOrgId(supabaseAdmin, userId);
    const activeOrg = activeOrgId ? (orgById.get(activeOrgId) ?? null) : null;
    const role = (mems ?? []).find((m) => m.org_id === activeOrgId)?.role as string | undefined;

    let setupProgress = {
      hasSchoolName: false,
      hasClasses: false,
      hasStudents: false,
      hasKioskSession: false,
      onboardedAt: null as string | null,
    };
    if (activeOrgId) {
      const [classCount, studentCount, kioskCount] = await Promise.all([
        supabaseAdmin.from("classes").select("id", { count: "exact", head: true }).eq("org_id", activeOrgId),
        supabaseAdmin.from("students").select("id", { count: "exact", head: true }).eq("org_id", activeOrgId),
        supabaseAdmin.from("kiosk_sessions").select("id", { count: "exact", head: true }).eq("org_id", activeOrgId),
      ]);
      setupProgress = {
        hasSchoolName: !!activeOrg?.name,
        hasClasses: (classCount.count ?? 0) > 0,
        hasStudents: (studentCount.count ?? 0) > 0,
        hasKioskSession: (kioskCount.count ?? 0) > 0,
        onboardedAt: activeOrg?.onboarded_at ?? null,
      };
    }

    return {
      userId,
      email: context.claims.email as string | undefined,
      profile,
      orgs,
      activeOrgId,
      activeOrg,
      role,
      // Compatibility flags for existing UI (Phase 1: only owner exists).
      isOwner: role === "owner",
      isAdmin: role === "owner" || role === "admin",
      isManager: role === "manager",
      isTeacher: role === "manager",
      roles: role ? [role] : [],
      setupProgress,
      needsOnboarding: !!activeOrgId && !setupProgress.onboardedAt,
    };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const orgId = await resolveActiveOrgId(supabaseAdmin, userId);
    if (!orgId) throw new Error("No active organization");
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
