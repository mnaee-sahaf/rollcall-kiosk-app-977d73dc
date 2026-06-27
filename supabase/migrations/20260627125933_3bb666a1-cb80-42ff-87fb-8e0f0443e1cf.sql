
-- 1. Note column on attendance events
ALTER TABLE public.attendance_events ADD COLUMN IF NOT EXISTS note text;

-- 2. School settings (singleton)
CREATE TABLE IF NOT EXISTS public.school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  school_name text,
  logo_url text,
  day_cutoff_time time NOT NULL DEFAULT '09:00',
  absent_after_time time NOT NULL DEFAULT '10:30',
  timezone text NOT NULL DEFAULT 'UTC',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.school_settings TO authenticated, anon;
GRANT INSERT, UPDATE ON public.school_settings TO authenticated;
GRANT ALL ON public.school_settings TO service_role;

ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read settings" ON public.school_settings
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "admin write settings" ON public.school_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update settings" ON public.school_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.school_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;

-- 3. Public student lookup view (safe columns only, active students)
CREATE OR REPLACE VIEW public.student_lookup AS
  SELECT s.qr_token, s.full_name AS student_name, s.external_id,
         c.id AS class_id, c.name AS class_name, c.grade
  FROM public.students s
  JOIN public.classes c ON c.id = s.class_id
  WHERE s.active = true;

GRANT SELECT ON public.student_lookup TO anon, authenticated;

-- 4. Storage bucket for school assets handled via tool call separately.
