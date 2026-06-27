import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
        .select("student_id, status")
        .eq("class_id", data.classId)
        .eq("day", day),
    ]);
    const statusByStudent = new Map(
      (events ?? []).map((e) => [e.student_id, e.status]),
    );
    return {
      day,
      roster: (students ?? []).map((s) => ({
        ...s,
        status: statusByStudent.get(s.id) ?? null,
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
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const day = data.day ?? new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("attendance_events")
      .select("id")
      .eq("student_id", data.studentId)
      .eq("day", day)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("attendance_events")
        .update({ status: data.status, marked_by: userId, method: "manual" })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("attendance_events").insert({
        student_id: data.studentId,
        class_id: data.classId,
        status: data.status,
        method: "manual",
        marked_by: userId,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const getReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        from: z.string(),
        to: z.string(),
        classId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("attendance_events")
      .select("id, student_id, class_id, status, day, method")
      .gte("day", data.from)
      .lte("day", data.to);
    if (data.classId) q = q.eq("class_id", data.classId);
    const { data: events, error } = await q;
    if (error) throw new Error(error.message);

    const { data: classes } = await supabase.from("classes").select("id, name");
    const { data: students } = await supabase.from("students").select("id, full_name, class_id");

    // Daily attendance rate
    const byDay = new Map<string, { present: number; total: number }>();
    for (const e of events ?? []) {
      const bucket = byDay.get(e.day) ?? { present: 0, total: 0 };
      bucket.total += 1;
      if (e.status === "present" || e.status === "late") bucket.present += 1;
      byDay.set(e.day, bucket);
    }
    const series = Array.from(byDay.entries())
      .sort()
      .map(([day, v]) => ({
        day,
        rate: v.total === 0 ? 0 : Math.round((v.present / v.total) * 100),
        present: v.present,
        total: v.total,
      }));

    // Chronic absentees (3+ absences)
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

    return { series, chronicAbsentees, totalEvents: events?.length ?? 0 };
  });
