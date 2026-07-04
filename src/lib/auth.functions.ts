import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [
      rolesRes,
      profileRes,
      settingsRes,
      classCountRes,
      studentCountRes,
      teacherCountRes,
      kioskCountRes,
    ] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("school_settings").select("school_name, onboarded_at").eq("singleton", true).maybeSingle(),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "teacher"),
        supabase.from("kiosk_sessions").select("id", { count: "exact", head: true }),
      ]);
    const roles = (rolesRes.data ?? []).map((r: { role: string }) => r.role);
    const isAdmin = roles.includes("admin");
    const setupProgress = {
      hasSchoolName: !!settingsRes.data?.school_name,
      hasTeachers: (teacherCountRes.count ?? 0) > 0,
      hasClasses: (classCountRes.count ?? 0) > 0,
      hasStudents: (studentCountRes.count ?? 0) > 0,
      hasKioskSession: (kioskCountRes.count ?? 0) > 0,
      onboardedAt: settingsRes.data?.onboarded_at ?? null,
    };
    return {
      userId,
      email: context.claims.email as string | undefined,
      roles,
      isAdmin,
      isTeacher: roles.includes("teacher"),
      profile: profileRes.data,
      mustChangePassword: !!profileRes.data?.must_change_password,
      setupProgress,
      needsOnboarding: isAdmin && !setupProgress.onboardedAt,
    };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: adminRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (!adminRows || adminRows.length === 0) throw new Error("Forbidden: admin only");
    const { error } = await supabase
      .from("school_settings")
      .update({ onboarded_at: new Date().toISOString(), updated_by: userId })
      .eq("singleton", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTeachers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: adminRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (!adminRows || adminRows.length === 0) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: teacherRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, created_at")
      .eq("role", "teacher");
    const ids = (teacherRoles ?? []).map((r) => r.user_id);
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const profById = new Map((profs ?? []).map((p) => [p.id, p]));
    return (teacherRoles ?? []).map((r) => ({
      user_id: r.user_id,
      full_name: profById.get(r.user_id)?.full_name ?? null,
      created_at: r.created_at,
    }));
  });

// Clears the forced-password-change flag after a teacher sets a new password.
export const completePasswordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
