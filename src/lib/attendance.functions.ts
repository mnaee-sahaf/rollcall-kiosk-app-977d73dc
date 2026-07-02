import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// Verifies the student exists and is in the given class before writing
// attendance. The RLS-scoped client also blocks students outside the caller's
// classes, so a not-found result throws the same friendly error.
async function assertStudentInClass(
  supabase: SupabaseClient<Database>,
  studentId: string,
  classId: string,
): Promise<void> {
  const { data: student } = await supabase
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student || student.class_id !== classId) {
    throw new Error("Student is not in this class");
  }
}

export const getClassRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ classId: z.string().uuid(), day: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const day = data.day ?? new Date().toISOString().slice(0, 10);
    const [{ data: students }, { data: events }] = await Promise.all([
      supabase
        .from("students")
        .select("id, full_name, external_id, qr_token, active")
        .eq("class_id", data.classId)
        .order("full_name"),
      supabase
        .from("attendance_events")
        .select("student_id, status, note")
        .eq("class_id", data.classId)
        .eq("day", day),
    ]);
    const byStudent = new Map(
      (events ?? []).map((e) => [e.student_id, { status: e.status, note: e.note }]),
    );
    return {
      day,
      roster: (students ?? []).map((s) => ({
        ...s,
        status: byStudent.get(s.id)?.status ?? null,
        note: byStudent.get(s.id)?.note ?? null,
      })),
    };
  });

export const markAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        studentId: z.string().uuid(),
        classId: z.string().uuid(),
        status: z.enum(["present", "absent", "late"]),
        day: z.string().optional(),
        note: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const day = data.day ?? new Date().toISOString().slice(0, 10);
    // Guard against filing attendance for a student who isn't in this class.
    // RLS confirms the teacher owns class_id but NOT that the student belongs
    // to it, so without this a crafted request could corrupt a student's day.
    await assertStudentInClass(supabase, data.studentId, data.classId);
    const { data: existing } = await supabase
      .from("attendance_events")
      .select("id")
      .eq("student_id", data.studentId)
      .eq("day", day)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("attendance_events")
        .update({
          status: data.status,
          method: "manual",
          marked_by: userId,
          note: data.note ?? null,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("attendance_events").insert({
        student_id: data.studentId,
        class_id: data.classId,
        day,
        status: data.status,
        method: "manual",
        marked_by: userId,
        note: data.note ?? null,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const setStudentNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        studentId: z.string().uuid(),
        classId: z.string().uuid(),
        day: z.string().optional(),
        note: z.string().max(500).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const day = data.day ?? new Date().toISOString().slice(0, 10);
    await assertStudentInClass(supabase, data.studentId, data.classId);
    const { data: existing } = await supabase
      .from("attendance_events")
      .select("id")
      .eq("student_id", data.studentId)
      .eq("day", day)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("attendance_events")
        .update({ note: data.note, marked_by: userId })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    // No event yet: create an 'absent' row carrying the note so it persists.
    const { error } = await supabase.from("attendance_events").insert({
      student_id: data.studentId,
      class_id: data.classId,
      day,
      status: "absent",
      method: "manual",
      marked_by: userId,
      note: data.note,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const bulkMarkAllPresent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ classId: z.string().uuid(), day: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const day = data.day ?? new Date().toISOString().slice(0, 10);
    const { data: students } = await supabase
      .from("students")
      .select("id")
      .eq("class_id", data.classId)
      .eq("active", true);
    const { data: existing } = await supabase
      .from("attendance_events")
      .select("student_id")
      .eq("class_id", data.classId)
      .eq("day", day);
    const have = new Set((existing ?? []).map((e) => e.student_id));
    const toInsert = (students ?? [])
      .filter((s) => !have.has(s.id))
      .map((s) => ({
        student_id: s.id,
        class_id: data.classId,
        day,
        status: "present" as const,
        method: "manual" as const,
        marked_by: userId,
      }));
    if (toInsert.length > 0) {
      const { error } = await supabase.from("attendance_events").insert(toInsert);
      if (error) throw new Error(error.message);
    }
    return { ok: true, inserted: toInsert.length };
  });

export const getStudentHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ studentId: z.string().uuid(), days: z.number().int().min(7).max(180).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const days = data.days ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    const sinceDay = since.toISOString().slice(0, 10);
    const { data: events } = await supabase
      .from("attendance_events")
      .select("day, status, note, method")
      .eq("student_id", data.studentId)
      .gte("day", sinceDay)
      .order("day", { ascending: false });
    return events ?? [];
  });

export const exportClassAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ classId: z.string().uuid(), from: z.string(), to: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: students }, { data: events }] = await Promise.all([
      supabase
        .from("students")
        .select("id, full_name, external_id")
        .eq("class_id", data.classId)
        .order("full_name"),
      supabase
        .from("attendance_events")
        .select("student_id, day, status, note, method")
        .eq("class_id", data.classId)
        .gte("day", data.from)
        .lte("day", data.to),
    ]);
    return { students: students ?? [], events: events ?? [] };
  });

export const getReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        from: z.string(),
        to: z.string(),
        classId: z.string().uuid().optional(),
        teacherId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let classIds: string[] | null = null;
    if (data.teacherId) {
      const { data: cs } = await supabase.from("classes").select("id").eq("teacher_id", data.teacherId);
      classIds = (cs ?? []).map((c) => c.id);
    }
    let q = supabase
      .from("attendance_events")
      .select("id, student_id, class_id, status, day, method")
      .gte("day", data.from)
      .lte("day", data.to);
    if (data.classId) q = q.eq("class_id", data.classId);
    if (classIds) q = q.in("class_id", classIds.length ? classIds : ["00000000-0000-0000-0000-000000000000"]);
    const { data: events, error } = await q;
    if (error) throw new Error(error.message);

    const { data: classes } = await supabase.from("classes").select("id, name, teacher_id");
    const { data: students } = await supabase.from("students").select("id, full_name, class_id");

    const byDay = new Map<string, { present: number; total: number }>();
    const byClass = new Map<string, { present: number; total: number }>();
    for (const e of events ?? []) {
      const dBucket = byDay.get(e.day) ?? { present: 0, total: 0 };
      dBucket.total += 1;
      if (e.status === "present" || e.status === "late") dBucket.present += 1;
      byDay.set(e.day, dBucket);

      const cBucket = byClass.get(e.class_id) ?? { present: 0, total: 0 };
      cBucket.total += 1;
      if (e.status === "present" || e.status === "late") cBucket.present += 1;
      byClass.set(e.class_id, cBucket);
    }
    const series = Array.from(byDay.entries())
      .sort()
      .map(([day, v]) => ({
        day,
        rate: v.total === 0 ? 0 : Math.round((v.present / v.total) * 100),
        present: v.present,
        total: v.total,
      }));

    const classRollup = Array.from(byClass.entries()).map(([cid, v]) => {
      const cls = (classes ?? []).find((c) => c.id === cid);
      return {
        class_id: cid,
        class_name: cls?.name ?? "Unknown",
        rate: v.total === 0 ? 0 : Math.round((v.present / v.total) * 100),
        present: v.present,
        total: v.total,
      };
    }).sort((a, b) => a.rate - b.rate);

    const absencesByStudent = new Map<string, number>();
    for (const e of events ?? []) {
      if (e.status === "absent") {
        absencesByStudent.set(e.student_id, (absencesByStudent.get(e.student_id) ?? 0) + 1);
      }
    }
    const studentById = new Map((students ?? []).map((s) => [s.id, s]));
    const classById = new Map((classes ?? []).map((c) => [c.id, c]));
    const chronicAbsentees = Array.from(absencesByStudent.entries())
      .filter(([, n]) => n >= 3)
      .map(([sid, n]) => {
        const s = studentById.get(sid);
        return {
          student_id: sid,
          full_name: s?.full_name ?? "Unknown",
          class_name: s ? classById.get(s.class_id)?.name ?? null : null,
          absences: n,
        };
      })
      .sort((a, b) => b.absences - a.absences);

    return { series, classRollup, chronicAbsentees, totalEvents: events?.length ?? 0 };
  });
