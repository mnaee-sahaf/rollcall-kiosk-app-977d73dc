import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgRole } from "@/lib/org-context";
import type { Database } from "@/integrations/supabase/types";

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(14);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

// Look up an existing auth user id by email (case-insensitive).
async function findUserByEmail(admin: SupabaseClient<Database>, email: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const lower = email.toLowerCase();
  return data?.users?.find((u) => (u.email ?? "").toLowerCase() === lower) ?? null;
}

// Owner/admin: list everyone in the active org with name, email, role.
export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { orgId } = await requireOrgRole(supabaseAdmin, context.userId, ["owner", "admin"]);
    const { data: mems } = await supabaseAdmin
      .from("memberships")
      .select("user_id, role, created_at")
      .eq("org_id", orgId)
      .order("created_at");
    const ids = new Set((mems ?? []).map((m) => m.user_id));
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", ids.size ? [...ids] : ["00000000-0000-0000-0000-000000000000"]);
    const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const emailById = new Map((userList?.users ?? []).map((u) => [u.id, u.email ?? null]));
    return (mems ?? []).map((m) => ({
      user_id: m.user_id,
      role: m.role as string,
      full_name: nameById.get(m.user_id) ?? null,
      email: emailById.get(m.user_id) ?? null,
      is_self: m.user_id === context.userId,
    }));
  });

// Create (or attach) a staff account in the active org.
export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
        fullName: z.string().min(1).max(120),
        role: z.enum(["admin", "manager"]),
        tempPassword: z.string().min(8).max(72).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { role: callerRole, orgId } = await requireOrgRole(supabaseAdmin, context.userId, [
      "owner",
      "admin",
    ]);
    if (data.role === "admin" && callerRole !== "owner") {
      throw new Error("Only the owner can add administrators");
    }

    const existing = await findUserByEmail(supabaseAdmin, data.email);
    let userId: string;
    let created = false;
    let tempPassword: string | undefined;

    if (existing) {
      userId = existing.id;
    } else {
      tempPassword = data.tempPassword || genPassword();
      const { data: c, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });
      if (error) throw new Error(error.message);
      userId = c.user.id;
      created = true;
      await supabaseAdmin
        .from("profiles")
        .update({ full_name: data.fullName, must_change_password: true })
        .eq("id", userId);
    }

    const { error: memErr } = await supabaseAdmin
      .from("memberships")
      .insert({ user_id: userId, org_id: orgId, role: data.role });
    if (memErr) {
      if (memErr.code === "23505") {
        throw new Error("That person is already a member of this organization");
      }
      throw new Error(memErr.message);
    }
    return { userId, email: data.email, created, tempPassword };
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { role: callerRole, orgId } = await requireOrgRole(supabaseAdmin, context.userId, [
      "owner",
      "admin",
    ]);
    const { data: target } = await supabaseAdmin
      .from("memberships")
      .select("role")
      .eq("user_id", data.userId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!target) throw new Error("Not a member of this organization");
    if ((target.role === "admin" || target.role === "owner") && callerRole !== "owner") {
      throw new Error("Only the owner can reset an administrator's password");
    }
    const tempPassword = genPassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: tempPassword,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", data.userId);
    return { ok: true as const, tempPassword };
  });

export const setStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["admin", "manager"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { role: callerRole, orgId } = await requireOrgRole(supabaseAdmin, context.userId, [
      "owner",
      "admin",
    ]);
    const { data: target } = await supabaseAdmin
      .from("memberships")
      .select("role")
      .eq("user_id", data.userId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!target) throw new Error("Not a member of this organization");
    if (target.role === "owner") throw new Error("The owner's role can't be changed");
    if ((data.role === "admin" || target.role === "admin") && callerRole !== "owner") {
      throw new Error("Only the owner can manage administrators");
    }
    const { error } = await supabaseAdmin
      .from("memberships")
      .update({ role: data.role })
      .eq("user_id", data.userId)
      .eq("org_id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const removeStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { role: callerRole, orgId } = await requireOrgRole(supabaseAdmin, context.userId, [
      "owner",
      "admin",
    ]);
    if (data.userId === context.userId) throw new Error("You can't remove yourself");
    const { data: target } = await supabaseAdmin
      .from("memberships")
      .select("role")
      .eq("user_id", data.userId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!target) throw new Error("Not a member of this organization");
    if (target.role === "owner") throw new Error("The owner can't be removed");
    if (target.role === "admin" && callerRole !== "owner") {
      throw new Error("Only the owner can remove administrators");
    }
    // Remove membership only (the auth user may belong to other orgs).
    const { error } = await supabaseAdmin
      .from("memberships")
      .delete()
      .eq("user_id", data.userId)
      .eq("org_id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// Clears the forced-password-change flag after a staff member sets a new one.
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
