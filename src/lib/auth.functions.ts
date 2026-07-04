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

export const inviteTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: adminRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (!adminRows || adminRows.length === 0) {
      throw new Error("Forbidden: admin only");
    }

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { data: inv, error } = await supabase
      .from("teacher_invites")
      .insert({ email: data.email, token, invited_by: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { invite: inv };
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

export const listInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("teacher_invites")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const email = (claims.email as string | undefined)?.toLowerCase();
    if (!email) throw new Error("No email on session");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("teacher_invites")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Invite not found");
    if (inv.accepted_at) throw new Error("Invite already accepted");
    if (new Date(inv.expires_at).getTime() < Date.now()) throw new Error("Invite expired");
    if (inv.email.toLowerCase() !== email)
      throw new Error(`Invite is for ${inv.email}, you're signed in as ${email}`);
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "teacher" })
      .select();
    await supabaseAdmin
      .from("teacher_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", inv.id);
    return { ok: true };
  });
