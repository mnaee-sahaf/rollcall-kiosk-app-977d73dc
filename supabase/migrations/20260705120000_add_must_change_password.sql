-- Teachers created by the admin get a temporary password and must set their
-- own on first login. This flag gates them into /app/set-password until done.
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;
