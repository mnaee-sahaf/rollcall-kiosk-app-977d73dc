import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createOrgSchema = z.object({
  schoolName: z.string().min(2).max(120),
  country: z.string().max(80).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  industry: z.string().max(80).optional().nullable(),
  orgSize: z.string().max(40).optional().nullable(),
  role: z.string().max(80).optional().nullable(),
  devices: z.array(z.string().max(40)).default([]),
  referralSource: z.string().max(80).optional().nullable(),
});

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createOrgSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Block if user already has any role.
    const { data: existingRoles, error: existingRolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (existingRolesErr) throw new Error(existingRolesErr.message);
    if (existingRoles && existingRoles.length > 0) {
      throw new Error("You already belong to an organization.");
    }

    // If an admin already exists, this user joins as teacher only via invite — not here.
    const { data: anyAdmin, error: anyAdminErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);
    if (anyAdminErr) throw new Error(anyAdminErr.message);
    if (anyAdmin && anyAdmin.length > 0) {
      throw new Error("An organization already exists. Ask your admin for an invite.");
    }

    // Claim the admin role FIRST. The user_roles_single_admin partial unique
    // index makes this the atomic gate: if a concurrent setup already became
    // admin between our check above and here, this insert fails with a unique
    // violation (Postgres 23505) instead of silently minting a second admin.
    // Doing it before the settings write also means the loser bails out
    // before clobbering school_settings.
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (roleErr) {
      if (roleErr.code === "23505") {
        throw new Error("An organization already exists. Ask your admin for an invite.");
      }
      throw new Error(roleErr.message);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("school_settings")
      .update({
        school_name: data.schoolName,
        country: data.country ?? null,
        phone: data.phone ?? null,
        industry: data.industry ?? null,
        org_size: data.orgSize ?? null,
        primary_role: data.role ?? null,
        devices: data.devices,
        referral_source: data.referralSource ?? null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("singleton", true);
    if (updateErr) throw new Error(updateErr.message);

    return { ok: true };
  });

export const getJoinContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const email = ((claims.email as string | undefined) ?? "").toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [rolesRes, adminRes, invitesRes] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin").limit(1),
      email
        ? supabaseAdmin
            .from("teacher_invites")
            .select("id, email, token, expires_at, accepted_at, created_at")
            .ilike("email", email)
            .is("accepted_at", null)
            .gt("expires_at", new Date().toISOString())
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              email: string;
              token: string;
              expires_at: string;
              accepted_at: string | null;
              created_at: string;
            }>,
          }),
    ]);

    return {
      email,
      hasRole: (rolesRes.data ?? []).length > 0,
      roles: (rolesRes.data ?? []).map((r) => r.role as string),
      orgExists: (adminRes.data ?? []).length > 0,
      invites: invitesRes.data ?? [],
    };
  });
