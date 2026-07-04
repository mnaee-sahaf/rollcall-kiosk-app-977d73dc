import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveOrgId, requireOrgRole } from "@/lib/org-context";

// Settings now live on the active organization (no more singleton).
export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const orgId = await resolveActiveOrgId(supabaseAdmin, context.userId);
    if (!orgId) return null;
    const { data } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .maybeSingle();
    return data;
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(2).max(120).optional(),
        logo_url: z.string().url().nullable().optional(),
        day_cutoff_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
        absent_after_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
        timezone: z.string().max(64).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { orgId } = await requireOrgRole(supabaseAdmin, context.userId, ["owner", "admin"]);
    const { data: row, error } = await supabaseAdmin
      .from("organizations")
      .update(data)
      .eq("id", orgId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// PUBLIC — parent scans a student QR card, sees minimal info. Token is unique
// to one student in one org, so no extra org scoping is needed.
export const lookupStudentPublic = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ qrToken: z.string().min(8).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, full_name, external_id, active, class_id, classes(name, grade)")
      .eq("qr_token", data.qrToken)
      .maybeSingle();
    if (!student || !student.active) return { found: false as const };

    const since = new Date();
    since.setDate(since.getDate() - 13);
    const sinceDay = since.toISOString().slice(0, 10);
    const { data: events } = await supabaseAdmin
      .from("attendance_events")
      .select("day, status")
      .eq("student_id", student.id)
      .gte("day", sinceDay)
      .order("day", { ascending: false });
    return {
      found: true as const,
      student: {
        full_name: student.full_name,
        external_id: student.external_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        class_name: (student as any).classes?.name ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        grade: (student as any).classes?.grade ?? null,
      },
      events: events ?? [],
    };
  });
