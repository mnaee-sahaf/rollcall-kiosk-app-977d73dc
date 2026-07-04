-- Teachers are now provisioned directly by the admin (createTeacherAccount),
-- so the self-serve invite path is gone. Simplify handle_new_user to only
-- create the profile, then drop the now-unused teacher_invites table.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, full_name, school_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'school_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

drop table if exists public.teacher_invites cascade;
