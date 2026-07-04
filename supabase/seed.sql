-- LOCAL DEV SEED ONLY. Runs automatically on `supabase db reset`.
-- Creates a fake admin with a known password — never run this against a
-- hosted (prod or staging) database.

-- Admin auth user: admin@rollcall.test / password123
-- The token columns must be '' (empty string), not NULL — GoTrue scans them
-- as Go strings and a NULL causes "Database error querying schema" on login.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated', 'admin@rollcall.test',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Test Admin"}',
  '', '', '', '', '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  jsonb_build_object('sub','11111111-1111-1111-1111-111111111111','email','admin@rollcall.test'),
  'email', '11111111-1111-1111-1111-111111111111', now(), now(), now()
) on conflict do nothing;

-- Profile + admin role (the handle_new_user trigger also creates the profile;
-- these are idempotent so it's fine either way).
insert into public.profiles (id, full_name)
  values ('11111111-1111-1111-1111-111111111111', 'Test Admin')
  on conflict (id) do nothing;
insert into public.user_roles (user_id, role)
  values ('11111111-1111-1111-1111-111111111111', 'admin')
  on conflict do nothing;

-- School settings (the singleton row is created by a migration).
update public.school_settings
  set school_name = 'Rollcall Test School', timezone = 'UTC',
      day_cutoff_time = '09:00', absent_after_time = '10:30',
      updated_by = '11111111-1111-1111-1111-111111111111', onboarded_at = now()
  where singleton = true;

-- A class owned by the admin.
insert into public.classes (id, name, grade, teacher_id)
  values ('22222222-2222-2222-2222-222222222222', '9A', '9',
          '11111111-1111-1111-1111-111111111111')
  on conflict (id) do nothing;

-- Students with fixed QR tokens (so /lookup and the kiosk are testable).
insert into public.students (id, class_id, full_name, qr_token, active) values
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Alice Chen', 'seed-qr-alice', true),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Max Rivera', 'seed-qr-max', true),
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'Priya Shah', 'seed-qr-priya', true)
  on conflict (id) do nothing;

-- Today's attendance so Reports/kiosk aren't empty.
insert into public.attendance_events (student_id, class_id, day, method, status, marked_by) values
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', (now() at time zone 'utc')::date, 'manual', 'present', '11111111-1111-1111-1111-111111111111'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', (now() at time zone 'utc')::date, 'manual', 'late', '11111111-1111-1111-1111-111111111111')
  on conflict (student_id, day) do nothing;
