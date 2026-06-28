
-- 1) Extend students with guardian contact + photo + last-sent timestamp
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS guardian_email text,
  ADD COLUMN IF NOT EXISTS guardian_phone text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS qr_last_sent_at timestamptz;

-- 2) QR token history — every issuance, including the current active one.
-- The currently active token equals students.qr_token AND has revoked_at IS NULL.
CREATE TABLE IF NOT EXISTS public.student_qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text
);

CREATE INDEX IF NOT EXISTS student_qr_tokens_student_idx ON public.student_qr_tokens(student_id);
CREATE INDEX IF NOT EXISTS student_qr_tokens_token_idx ON public.student_qr_tokens(token);

GRANT SELECT, INSERT, UPDATE ON public.student_qr_tokens TO authenticated;
GRANT ALL ON public.student_qr_tokens TO service_role;

ALTER TABLE public.student_qr_tokens ENABLE ROW LEVEL SECURITY;

-- Teachers can read/write history rows only for students in classes they own; admins unrestricted.
CREATE POLICY "qr history read"
  ON public.student_qr_tokens FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.classes c ON c.id = s.class_id
      WHERE s.id = student_qr_tokens.student_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "qr history insert"
  ON public.student_qr_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.classes c ON c.id = s.class_id
      WHERE s.id = student_qr_tokens.student_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "qr history update"
  ON public.student_qr_tokens FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.classes c ON c.id = s.class_id
      WHERE s.id = student_qr_tokens.student_id AND c.teacher_id = auth.uid()
    )
  );

-- 3) Backfill: for any existing student lacking a history row, create one for the current token.
INSERT INTO public.student_qr_tokens (student_id, token, issued_at)
SELECT s.id, s.qr_token, s.created_at
FROM public.students s
WHERE NOT EXISTS (
  SELECT 1 FROM public.student_qr_tokens h WHERE h.student_id = s.id AND h.token = s.qr_token
);
