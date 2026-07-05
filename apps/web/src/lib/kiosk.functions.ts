import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveOrgId } from "@/lib/org-context";

// Resolve the caller's active org or throw. Every authed handler scopes to this.
async function activeOrg(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const orgId = await resolveActiveOrgId(supabaseAdmin, userId);
  if (!orgId) throw new Error("No active organization");
  return { supabaseAdmin, orgId };
}

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
    const { supabaseAdmin, orgId } = await activeOrg(context.userId);
    const minutes = DURATION_MIN[data.duration];
    const expires = new Date(Date.now() + minutes * 60_000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("kiosk_sessions")
      .insert({
        org_id: orgId,
        class_id: data.classId,
        created_by: context.userId,
        expires_at: expires,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listKioskSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, orgId } = await activeOrg(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("kiosk_sessions")
      .select("*")
      .eq("class_id", data.classId)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return rows;
  });

export const revokeKioskSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, orgId } = await activeOrg(context.userId);
    const { error } = await supabaseAdmin
      .from("kiosk_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("org_id", orgId);
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
      .select("id, class_id, org_id, expires_at, revoked_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!session) return { error: "not_found" as const };
    if (session.revoked_at) return { error: "revoked" as const };
    if (new Date(session.expires_at).getTime() < Date.now()) return { error: "expired" as const };

    const today = new Date().toISOString().slice(0, 10);
    const [{ data: cls }, { data: students }, { data: events }, { data: settings }] = await Promise.all([
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
      supabaseAdmin
        .from("organizations")
        .select("name, logo_url")
        .eq("id", session.org_id)
        .maybeSingle(),
    ]);

    return {
      session: { id: session.id, expires_at: session.expires_at },
      cls,
      students: students ?? [],
      todayEvents: events ?? [],
      settings: settings ? { school_name: settings.name, logo_url: settings.logo_url } : null,
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
      .select("id, class_id, org_id, expires_at, revoked_at")
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
    if (!student) {
      // Could be a revoked/old token. Check history for a friendlier message.
      const { data: hist } = await supabaseAdmin
        .from("student_qr_tokens")
        .select("revoked_at, students(full_name)")
        .eq("token", data.qrToken)
        .maybeSingle();
      if (hist?.revoked_at) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const name = (hist as any).students?.full_name as string | undefined;
        return {
          ok: false as const,
          replaced: true,
          error: name
            ? `${name}'s QR has been replaced — please print a new card.`
            : "This QR card has been replaced — please print a new one.",
        };
      }
      return { ok: false as const, error: "Unknown student QR" };
    }
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
      org_id: session.org_id,
      student_id: student.id,
      class_id: session.class_id,
      kiosk_session_id: session.id,
      method: "kiosk",
      status: "present",
    });
    if (insErr) return { ok: false as const, error: insErr.message };

    return { ok: true as const, already: false, studentName: student.full_name };
  });
