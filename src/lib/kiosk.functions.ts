import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DURATION_MIN = { "30m": 30, "2h": 120, "8h": 480 } as const;

export const createKioskSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        duration: z.enum(["30m", "2h", "8h"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const minutes = DURATION_MIN[data.duration];
    const expires = new Date(Date.now() + minutes * 60_000).toISOString();
    const { data: row, error } = await supabase
      .from("kiosk_sessions")
      .insert({ class_id: data.classId, created_by: userId, expires_at: expires })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listKioskSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("kiosk_sessions")
      .select("*")
      .eq("class_id", data.classId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return rows;
  });

export const revokeKioskSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("kiosk_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// PUBLIC — no auth. Validates the kiosk session token itself.
export const getKioskBoard = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("kiosk_sessions")
      .select("id, class_id, expires_at, revoked_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!session) return { error: "not_found" as const };
    if (session.revoked_at) return { error: "revoked" as const };
    if (new Date(session.expires_at).getTime() < Date.now()) return { error: "expired" as const };

    const today = new Date().toISOString().slice(0, 10);
    const [{ data: cls }, { data: students }, { data: events }] = await Promise.all([
      supabaseAdmin.from("classes").select("id, name, grade").eq("id", session.class_id).single(),
      supabaseAdmin
        .from("students")
        .select("id, full_name")
        .eq("class_id", session.class_id)
        .eq("active", true),
      supabaseAdmin
        .from("attendance_events")
        .select("student_id, status, occurred_at")
        .eq("class_id", session.class_id)
        .eq("day", today),
    ]);

    return {
      session: { id: session.id, expires_at: session.expires_at },
      cls,
      students: students ?? [],
      todayEvents: events ?? [],
    };
  });

export const recordKioskScan = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ sessionToken: z.string().min(10), qrToken: z.string().min(8) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("kiosk_sessions")
      .select("id, class_id, expires_at, revoked_at")
      .eq("token", data.sessionToken)
      .maybeSingle();
    if (!session) return { ok: false as const, error: "Invalid kiosk session" };
    if (session.revoked_at) return { ok: false as const, error: "Session revoked" };
    if (new Date(session.expires_at).getTime() < Date.now())
      return { ok: false as const, error: "Session expired" };

    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, full_name, class_id, active")
      .eq("qr_token", data.qrToken)
      .maybeSingle();
    if (!student) return { ok: false as const, error: "Unknown student QR" };
    if (!student.active) return { ok: false as const, error: "Student inactive" };
    if (student.class_id !== session.class_id)
      return { ok: false as const, error: `${student.full_name} is not in this class` };

    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabaseAdmin
      .from("attendance_events")
      .select("id, status")
      .eq("student_id", student.id)
      .eq("day", today)
      .maybeSingle();

    if (existing) {
      return {
        ok: true as const,
        already: true,
        studentName: student.full_name,
      };
    }

    const { error: insErr } = await supabaseAdmin.from("attendance_events").insert({
      student_id: student.id,
      class_id: session.class_id,
      kiosk_session_id: session.id,
      method: "kiosk",
      status: "present",
    });
    if (insErr) return { ok: false as const, error: insErr.message };

    return { ok: true as const, already: false, studentName: student.full_name };
  });
