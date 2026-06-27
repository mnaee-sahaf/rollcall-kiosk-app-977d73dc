
DROP VIEW IF EXISTS public.student_lookup;

CREATE OR REPLACE FUNCTION public.lookup_student_by_qr(_qr_token text)
RETURNS TABLE (
  student_name text,
  external_id text,
  class_name text,
  grade text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.full_name, s.external_id, c.name, c.grade
  FROM public.students s
  JOIN public.classes c ON c.id = s.class_id
  WHERE s.qr_token = _qr_token AND s.active = true
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.lookup_student_by_qr(text) FROM public;
GRANT EXECUTE ON FUNCTION public.lookup_student_by_qr(text) TO anon, authenticated;
