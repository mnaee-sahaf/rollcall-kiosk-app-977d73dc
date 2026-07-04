-- Phase 2: staff roles & provisioning.
-- Adds must_change_password, a role-aware RLS helper, and tightens the
-- organization/membership policies so only owners/admins manage settings and
-- see the staff roster.

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- True if the caller holds one of `roles` in `org`.
create or replace function public.has_org_role(org uuid, variadic roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = org and m.user_id = auth.uid() and m.role = any(roles)
  );
$$;

-- Org settings edits: owner/admin only (was any member in Phase 1).
drop policy if exists "members update their orgs" on public.organizations;
create policy "admins update their orgs" on public.organizations
  for update to authenticated
  using (public.has_org_role(id, 'owner', 'admin'))
  with check (public.has_org_role(id, 'owner', 'admin'));

-- Owner/admin can read the whole staff roster of their org (in addition to the
-- existing "user reads own memberships" policy).
create policy "admins read org memberships" on public.memberships
  for select to authenticated
  using (public.has_org_role(org_id, 'owner', 'admin'));
