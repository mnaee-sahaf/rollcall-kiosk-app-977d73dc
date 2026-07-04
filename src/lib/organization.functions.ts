import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Public — no auth. Returns only whether an org (any admin) exists, so the
// signup UI can decide whether to offer org creation or sign-in only.
export const orgExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1);
  return { exists: (data ?? []).length > 0 };
});

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

    // Single-tenant: only one org/admin. If one already exists, teachers get
    // accounts from that admin — they don't create an org here.
    const { data: anyAdmin, error: anyAdminErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);
    if (anyAdminErr) throw new Error(anyAdminErr.message);
    if (anyAdmin && anyAdmin.length > 0) {
      throw new Error("An organization already exists. Ask your administrator for access.");
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
        throw new Error("An organization already exists. Ask your administrator for access.");
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
