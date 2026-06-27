import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("school_settings")
    .select("*")
    .eq("singleton", true)
    .maybeSingle();
  return data;
});

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        school_name: z.string().max(120).nullable().optional(),
        logo_url: z.string().url().nullable().optional(),
        day_cutoff_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
        absent_after_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
        timezone: z.string().max(64).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: adminRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (!adminRows || adminRows.length === 0) throw new Error("Forbidden: admin only");
    const { data: row, error } = await supabase
      .from("school_settings")
      .update({ ...data, updated_by: userId, updated_at: new Date().toISOString() })
      .eq("singleton", true)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// PUBLIC — parent scans QR card with phone, sees minimal info.
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
