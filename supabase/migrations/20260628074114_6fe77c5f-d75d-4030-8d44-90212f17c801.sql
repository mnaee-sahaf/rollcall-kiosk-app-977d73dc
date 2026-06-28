-- Add org profile fields to school_settings (singleton row)
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS org_size text,
  ADD COLUMN IF NOT EXISTS primary_role text,
  ADD COLUMN IF NOT EXISTS devices text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS referral_source text;

-- Replace handle_new_user so it no longer auto-grants admin to the first user.
-- Admin role is now granted exclusively via the createOrganization server function.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_invite_token text;
begin
  insert into public.profiles (id, full_name, school_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.raw_user_meta_data->>'school_name')
  on conflict (id) do nothing;

  v_invite_token := new.raw_user_meta_data->>'invite_token';
  if v_invite_token is not null then
    update public.teacher_invites
      set accepted_at = now()
      where token = v_invite_token
        and accepted_at is null
        and expires_at > now()
        and lower(email) = lower(new.email);
    if found then
      insert into public.user_roles(user_id, role) values (new.id, 'teacher') on conflict do nothing;
    end if;
  end if;

  return new;
end;
$function$;
