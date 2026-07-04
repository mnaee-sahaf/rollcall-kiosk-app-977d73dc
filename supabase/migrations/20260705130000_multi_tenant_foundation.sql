-- Multi-tenant foundation (Phase 1).
-- Converts the single-tenant schema to multi-tenant: organizations + memberships
-- + org_id on every domain table, isolation via is_org_member() RLS. Data is
-- wiped (start fresh). Owner-only for Phase 1 (enum supports all four roles).

-- 1. Drop single-tenant / invite machinery. has_role() is used by most domain
--    policies, so dropping it CASCADE removes those policies in one shot.
drop table if exists public.teacher_invites cascade;
drop table if exists public.user_roles cascade;
drop function if exists public.has_role(uuid, public.app_role) cascade;
drop table if exists public.school_settings cascade;

-- 2. Recreate the role enum as the four-tier hierarchy.
drop type if exists public.app_role cascade;
create type public.app_role as enum ('owner', 'admin', 'manager', 'member');

-- 3. organizations (absorbs the old school_settings fields).
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  phone text,
  industry text,
  org_size text,
  primary_role text,
  devices text[] not null default '{}',
  referral_source text,
  timezone text not null default 'UTC',
  day_cutoff_time time not null default '09:00',
  absent_after_time time not null default '10:30',
  logo_url text,
  onboarded_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 4. memberships (user <-> org, role per org).
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);
create index on public.memberships(user_id);
create index on public.memberships(org_id);

-- 5. org_id on domain tables. Wipe first so a plain NOT NULL add works.
truncate public.attendance_events, public.kiosk_sessions, public.student_qr_tokens,
         public.students, public.classes cascade;
alter table public.classes add column org_id uuid not null references public.organizations(id) on delete cascade;
alter table public.students add column org_id uuid not null references public.organizations(id) on delete cascade;
alter table public.attendance_events add column org_id uuid not null references public.organizations(id) on delete cascade;
alter table public.kiosk_sessions add column org_id uuid not null references public.organizations(id) on delete cascade;
alter table public.student_qr_tokens add column org_id uuid not null references public.organizations(id) on delete cascade;
create index on public.classes(org_id);
create index on public.students(org_id);
create index on public.attendance_events(org_id, day);
create index on public.kiosk_sessions(org_id);
create index on public.student_qr_tokens(org_id);

-- 6. profiles: active org pointer.
alter table public.profiles add column last_active_org_id uuid references public.organizations(id) on delete set null;

-- 7. Membership helper — the single chokepoint every domain policy uses.
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = org and m.user_id = auth.uid()
  );
$$;

-- 8. Rebuild handle_new_user without the invite branch (profile only).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 9. RLS: organizations + memberships.
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;
grant all on public.organizations to service_role;
grant all on public.memberships to service_role;

create policy "members read their orgs" on public.organizations
  for select to authenticated using (public.is_org_member(id));
create policy "members update their orgs" on public.organizations
  for update to authenticated using (public.is_org_member(id)) with check (public.is_org_member(id));
create policy "user reads own memberships" on public.memberships
  for select to authenticated using (user_id = auth.uid());

-- 10. RLS: domain tables — any member of the row's org may act (role
--     granularity is Phase 2). Old has_role policies were dropped in step 1.
create policy "org members rw classes" on public.classes
  for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "org members rw students" on public.students
  for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "org members rw attendance" on public.attendance_events
  for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "org members rw kiosk sessions" on public.kiosk_sessions
  for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "org members rw qr tokens" on public.student_qr_tokens
  for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- 11. profiles: restore own-row read (the has_role variant was cascade-dropped).
create policy "users read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

-- (waitlist_signups keeps its anon-insert policy; the has_role admin view/delete
--  policies were cascade-dropped. Waitlist is readable only via the service role
--  now — a global-admin concern deferred past Phase 1.)
