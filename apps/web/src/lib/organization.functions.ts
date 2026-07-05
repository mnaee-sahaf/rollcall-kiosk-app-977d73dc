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

// Open to any authenticated user. Every call creates a NEW organization and
// makes the caller its owner. Used at signup and to create additional orgs.
export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createOrgSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: data.schoolName,
        country: data.country ?? null,
        phone: data.phone ?? null,
        industry: data.industry ?? null,
        org_size: data.orgSize ?? null,
        primary_role: data.role ?? null,
        devices: data.devices,
        referral_source: data.referralSource ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (orgErr) throw new Error(orgErr.message);

    const { error: memErr } = await supabaseAdmin
      .from("memberships")
      .insert({ user_id: userId, org_id: org.id, role: "owner" });
    if (memErr) throw new Error(memErr.message);

    await supabaseAdmin.from("profiles").update({ last_active_org_id: org.id }).eq("id", userId);
    return { orgId: org.id };
  });

// Switch the caller's active org. Validates membership before updating.
export const setActiveOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mem } = await supabaseAdmin
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("org_id", data.orgId)
      .maybeSingle();
    if (!mem) throw new Error("Not a member of that organization");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ last_active_org_id: data.orgId })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
