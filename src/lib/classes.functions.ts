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

export const createClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ name: z.string().min(1).max(120), grade: z.string().max(40).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("classes")
      .insert({ name: data.name, grade: data.grade ?? null, teacher_id: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
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
