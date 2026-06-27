import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("classes")
      .select("id, name, grade, teacher_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const listClassesWithMeta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: adminRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (!adminRows || adminRows.length === 0) throw new Error("Forbidden: admin only");
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name, grade, teacher_id, created_at")
      .order("name");
    const ids = (classes ?? []).map((c) => c.teacher_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const profMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
    const { data: counts } = await supabaseAdmin
      .from("students")
      .select("class_id");
    const countMap = new Map<string, number>();
    for (const s of counts ?? []) countMap.set(s.class_id, (countMap.get(s.class_id) ?? 0) + 1);
    return (classes ?? []).map((c) => ({
      ...c,
      teacher_name: profMap.get(c.teacher_id) ?? null,
      student_count: countMap.get(c.id) ?? 0,
    }));
  });


export const createClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1).max(120),
        grade: z.string().max(40).optional(),
        teacherId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("classes")
      .insert({
        name: data.name,
        grade: data.grade ?? null,
        teacher_id: data.teacherId ?? userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        name: z.string().min(1).max(120).optional(),
        grade: z.string().max(40).nullable().optional(),
        teacherId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: { name?: string; grade?: string | null; teacher_id?: string } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.grade !== undefined) patch.grade = data.grade;
    if (data.teacherId !== undefined) patch.teacher_id = data.teacherId;
    const { error } = await context.supabase.from("classes").update(patch).eq("id", data.classId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("classes").delete().eq("id", data.classId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getClass = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: cls, error: e1 }, { data: students, error: e2 }] = await Promise.all([
      supabase.from("classes").select("*").eq("id", data.classId).maybeSingle(),
      supabase
        .from("students")
        .select("*")
        .eq("class_id", data.classId)
        .order("full_name", { ascending: true }),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    if (!cls) throw new Error("Class not found");
    return { cls, students: students ?? [] };
  });

export const addStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        full_name: z.string().min(1).max(120),
        external_id: z.string().max(60).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("students")
      .insert({
        class_id: data.classId,
        full_name: data.full_name,
        external_id: data.external_id ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const bulkAddStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        students: z
          .array(
            z.object({
              full_name: z.string().min(1).max(120),
              external_id: z.string().max(60).optional().nullable(),
            }),
          )
          .min(1)
          .max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const rows = data.students.map((s) => ({
      class_id: data.classId,
      full_name: s.full_name,
      external_id: s.external_id ?? null,
    }));
    const { data: inserted, error } = await supabase.from("students").insert(rows).select("id");
    if (error) throw new Error(error.message);
    return { inserted: inserted?.length ?? 0 };
  });

export const updateStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        studentId: z.string().uuid(),
        full_name: z.string().min(1).max(120).optional(),
        external_id: z.string().max(60).nullable().optional(),
        class_id: z.string().uuid().optional(),
        active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      full_name?: string;
      external_id?: string | null;
      class_id?: string;
      active?: boolean;
    } = {};
    if (data.full_name !== undefined) patch.full_name = data.full_name;
    if (data.external_id !== undefined) patch.external_id = data.external_id;
    if (data.class_id !== undefined) patch.class_id = data.class_id;
    if (data.active !== undefined) patch.active = data.active;
    const { error } = await context.supabase
      .from("students")
      .update(patch)
      .eq("id", data.studentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rotateStudentQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(18)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const { data: row, error } = await supabase
      .from("students")
      .update({ qr_token: newToken })
      .eq("id", data.studentId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("students").delete().eq("id", data.studentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAllStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ search: z.string().optional(), classId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("students")
      .select("id, full_name, external_id, active, class_id, classes(name)")
      .order("full_name")
      .limit(500);
    if (data.classId) q = q.eq("class_id", data.classId);
    if (data.search) q = q.ilike("full_name", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
