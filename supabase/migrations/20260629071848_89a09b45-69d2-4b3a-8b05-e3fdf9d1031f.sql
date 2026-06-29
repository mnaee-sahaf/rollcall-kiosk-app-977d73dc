CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE public.waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL,
  school text,
  source text NOT NULL DEFAULT 'landing',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX waitlist_signups_email_unique ON public.waitlist_signups (email);
CREATE INDEX waitlist_signups_created_at_idx ON public.waitlist_signups (created_at DESC);

GRANT INSERT ON public.waitlist_signups TO anon, authenticated;
GRANT SELECT, DELETE ON public.waitlist_signups TO authenticated;
GRANT ALL ON public.waitlist_signups TO service_role;

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join waitlist"
  ON public.waitlist_signups FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view waitlist"
  ON public.waitlist_signups FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete waitlist"
  ON public.waitlist_signups FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));