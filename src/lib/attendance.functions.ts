import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { resolveActiveOrgId } from "@/lib/org-context";

// Resolve the caller's active org or throw. Every handler scopes to this.
async function activeOrg(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const orgId = await resolveActiveOrgId(supabaseAdmin, userId);
  if (!orgId) throw new Error("No active organization");
  return { supabaseAdmin, orgId };
}

// Verifies the student exists and is in the given class before writing
// attendance. Scoped by org so a crafted request can't reach another org's
// student; a not-found result throws the same friendly error.
async function assertStudentInClass(
  supabase: SupabaseClient<Database>,
  orgId: string,
  studentId: string,
  classId: string,
): Promise<void> {
  const { data: student } = await supabase
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("org_id", orgId)
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
    const { supabaseAdmin, orgId } = await activeOrg(context.userId);
    const day = data.day ?? new Date().toISOString().slice(0, 10);
    const [{ data: students }, { data: events }] = await Promise.all([
      supabaseAdmin
        .from("students")
        .select("id, full_name, external_id, qr_token, active")
        .eq("class_id", data.classId)
        .eq("org_id", orgId)
        .order("full_name"),
      supabaseAdmin
        .from("attendance_events")
        .select("student_id, status, note")
        .eq("class_id", data.classId)
        .eq("org_id", orgId)
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
    const { supabaseAdmin, orgId } = await activeOrg(context.userId);
    const day = data.day ?? new Date().toISOString().slice(0, 10);
    // Guard against filing attendance for a student who isn't in this class.
    // Scoping confirms the class belongs to the org but NOT that the student
    // belongs to it, so without this a crafted request could corrupt a
    // student's day.
    await assertStudentInClass(supabaseAdmin, orgId, data.studentId, data.classId);
    const { data: existing } = await supabaseAdmin
      .from("attendance_events")
      .select("id")
      .eq("student_id", data.studentId)
      .eq("org_id", orgId)
      .eq("day", day)
      .maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin
        .from("attendance_events")
        .update({
          status: data.status,
          method: "manual",
          marked_by: context.userId,
          note: data.note ?? null,
        })
        .eq("id", existing.id)
        .eq("org_id", orgId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("attendance_events").insert({
        org_id: orgId,
        student_id: data.studentId,
        class_id: data.classId,
        day,
        status: data.status,
        method: "manual",
        marked_by: context.userId,
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
    const { supabaseAdmin, orgId } = await activeOrg(context.userId);
    const day = data.day ?? new Date().toISOString().slice(0, 10);
    await assertStudentInClass(supabaseAdmin, orgId, data.studentId, data.classId);
    const { data: existing } = await supabaseAdmin
      .from("attendance_events")
      .select("id")
      .eq("student_id", data.studentId)
      .eq("org_id", orgId)
      .eq("day", day)
      .maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin
        .from("attendance_events")
        .update({ note: data.note, marked_by: context.userId })
        .eq("id", existing.id)
        .eq("org_id", orgId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    // No event yet: create an 'absent' row carrying the note so it persists.
    const { error } = await supabaseAdmin.from("attendance_events").insert({
      org_id: orgId,
      student_id: data.studentId,
      class_id: data.classId,
      day,
      status: "absent",
      method: "manual",
      marked_by: context.userId,
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
    const { supabaseAdmin, orgId } = await activeOrg(context.userId);
    const day = data.day ?? new Date().toISOString().slice(0, 10);
    const { data: students } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("class_id", data.classId)
      .eq("org_id", orgId)
      .eq("active", true);
    const { data: existing } = await supabaseAdmin
      .from("attendance_events")
      .select("student_id")
      .eq("class_id", data.classId)
      .eq("org_id", orgId)
      .eq("day", day);
    const have = new Set((existing ?? []).map((e) => e.student_id));
    const toInsert = (students ?? [])
      .filter((s) => !have.has(s.id))
      .map((s) => ({
        org_id: orgId,
        student_id: s.id,
        class_id: data.classId,
        day,
        status: "present" as const,
        method: "manual" as const,
        marked_by: context.userId,
      }));
    if (toInsert.length > 0) {
      const { error } = await supabaseAdmin.from("attendance_events").insert(toInsert);
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
    const { supabaseAdmin, orgId } = await activeOrg(context.userId);
    const days = data.days ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    const sinceDay = since.toISOString().slice(0, 10);
    const { data: events } = await supabaseAdmin
      .from("attendance_events")
      .select("day, status, note, method")
      .eq("student_id", data.studentId)
      .eq("org_id", orgId)
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
    const { supabaseAdmin, orgId } = await activeOrg(context.userId);
    const [{ data: students }, { data: events }] = await Promise.all([
      supabaseAdmin
        .from("students")
        .select("id, full_name, external_id")
        .eq("class_id", data.classId)
        .eq("org_id", orgId)
        .order("full_name"),
      supabaseAdmin
        .from("attendance_events")
        .select("student_id, day, status, note, method")
        .eq("class_id", data.classId)
        .eq("org_id", orgId)
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
    const { supabaseAdmin, orgId } = await activeOrg(context.userId);
    let classIds: string[] | null = null;
    if (data.teacherId) {
      const { data: cs } = await supabaseAdmin
        .from("classes")
        .select("id")
        .eq("teacher_id", data.teacherId)
        .eq("org_id", orgId);
      classIds = (cs ?? []).map((c) => c.id);
    }
    // Supabase caps a single select at 1000 rows by default, which silently
    // truncates reports for any school with more than ~1000 events in range.
    // Page through with .range() until a short page signals the end.
    const PAGE = 1000;
    type EventRow = {
      id: string;
      student_id: string;
      class_id: string;
      status: string;
      day: string;
      method: string;
    };
    const events: EventRow[] = [];
    for (let offset = 0; ; offset += PAGE) {
      let q = supabaseAdmin
        .from("attendance_events")
        .select("id, student_id, class_id, status, day, method")
        .eq("org_id", orgId)
        .gte("day", data.from)
        .lte("day", data.to)
        .order("day", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (data.classId) q = q.eq("class_id", data.classId);
      if (classIds)
        q = q.in("class_id", classIds.length ? classIds : ["00000000-0000-0000-0000-000000000000"]);
      const { data: page, error } = await q;
      if (error) throw new Error(error.message);
      events.push(...((page ?? []) as EventRow[]));
      if (!page || page.length < PAGE) break;
    }

    const { data: classes } = await supabaseAdmin
      .from("classes")
      .select("id, name, teacher_id")
      .eq("org_id", orgId);
    const { data: students } = await supabaseAdmin
      .from("students")
      .select("id, full_name, class_id")
      .eq("org_id", orgId);

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
