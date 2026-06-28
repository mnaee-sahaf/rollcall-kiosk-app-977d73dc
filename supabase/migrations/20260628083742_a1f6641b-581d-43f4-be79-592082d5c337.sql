
-- school_settings: drop public read, restrict to authenticated
DROP POLICY IF EXISTS "anyone read settings" ON public.school_settings;
CREATE POLICY "authenticated read settings" ON public.school_settings
  FOR SELECT TO authenticated USING (true);

-- teacher_invites: allow invitee to read their own invite
CREATE POLICY "invitee read own invite" ON public.teacher_invites
  FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt()->>'email','')));

-- user_roles: explicit admin-only write policies
CREATE POLICY "admin insert user_roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update user_roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete user_roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- kiosk_sessions: fix WITH CHECK to mirror USING (OR not AND)
DROP POLICY IF EXISTS "teacher manage own kiosk sessions" ON public.kiosk_sessions;
CREATE POLICY "teacher manage own kiosk sessions" ON public.kiosk_sessions
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = kiosk_sessions.class_id AND c.teacher_id = auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = kiosk_sessions.class_id AND c.teacher_id = auth.uid())
    )
  );

-- Revoke EXECUTE on has_role from anon and public; authenticated still needs it for RLS policies
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
