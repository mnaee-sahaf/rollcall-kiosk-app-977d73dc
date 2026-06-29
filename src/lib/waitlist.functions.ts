import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const joinSchema = z.object({
  email: z.string().trim().email().max(255),
  school: z.string().trim().max(200).optional().or(z.literal("")),
  source: z.string().trim().max(50).optional(),
  user_agent: z.string().trim().max(500).optional(),
});

export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((d) => joinSchema.parse(d))
  .handler(async ({ data }) => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await supabase.from("waitlist_signups").insert({
      email: data.email.toLowerCase(),
      school: data.school || null,
      source: data.source || "landing",
      user_agent: data.user_agent || null,
    });
    if (error) {
      // Unique violation -> treat as already on the list
      if (error.code === "23505") return { ok: true, already: true as const };
      throw new Error(error.message);
    }
    return { ok: true, already: false as const };
  });

async function ensureAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin");
  if (!data || data.length === 0) throw new Error("Forbidden: admin only");
}

export const listWaitlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("waitlist_signups")
      .select("id, email, school, source, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteWaitlistEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase
      .from("waitlist_signups")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
