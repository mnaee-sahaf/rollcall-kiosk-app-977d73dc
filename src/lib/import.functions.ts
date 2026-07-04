import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveOrgId } from "@/lib/org-context";

export const importStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        rows: z
          .array(
            z.object({
              class_name: z.string().min(1),
              full_name: z.string().min(1),
              external_id: z.string().optional(),
              grade: z.string().optional(),
            }),
          )
          .max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const orgId = await resolveActiveOrgId(supabaseAdmin, context.userId);
    if (!orgId) throw new Error("No active organization");

    const classCache = new Map<string, string>();
    const results: Array<{ row: number; ok: boolean; error?: string }> = [];

    // Preload existing classes in this org.
    const { data: existing } = await supabaseAdmin
      .from("classes")
      .select("id, name")
      .eq("org_id", orgId);
    for (const c of existing ?? []) classCache.set(c.name.toLowerCase(), c.id);

    for (let i = 0; i < data.rows.length; i++) {
      const r = data.rows[i];
      try {
        let classId = classCache.get(r.class_name.toLowerCase());
        if (!classId) {
          const { data: newCls, error: ce } = await supabaseAdmin
            .from("classes")
            .insert({ org_id: orgId, name: r.class_name, grade: r.grade ?? null, teacher_id: context.userId })
            .select()
            .single();
          if (ce) throw new Error(ce.message);
          classId = newCls.id;
          classCache.set(r.class_name.toLowerCase(), classId!);
        }
        const { error: se } = await supabaseAdmin.from("students").insert({
          org_id: orgId,
          class_id: classId,
          full_name: r.full_name,
          external_id: r.external_id ?? null,
        });
        if (se) throw new Error(se.message);
        results.push({ row: i + 1, ok: true });
      } catch (err) {
        results.push({ row: i + 1, ok: false, error: err instanceof Error ? err.message : "Failed" });
      }
    }
    return { results };
  });
