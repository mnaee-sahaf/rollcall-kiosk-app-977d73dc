# Design: Multi-tenant foundation (Phase 1)

**Status:** Approved design, ready for implementation
**Date:** 2026-07-05

## Context

RollCall is becoming a multi-tenant SaaS: many schools sign up, each getting a
fully isolated organization. This is Phase 1 of a phased build:

1. **Multi-tenant foundation (this spec):** organizations, memberships,
   `org_id` scoping, RLS isolation, open signup that creates an org, and an
   org-switcher for users who belong to several orgs.
2. Staff roles & provisioning (`owner/admin/manager` with school-context
   labels, delegated permissions) — later.
3. Authenticated students (members) + provisioning at scale — later.
4. Billing (the "owner pays" part) — later.

Phase 1 ships **owner-only orgs**: every signup creates an org whose creator is
the `owner` and can do everything within it. The role *enum* includes all four
tiers for forward-compatibility, but only `owner` is created/enforced here.

This supersedes the single-tenant model currently on `main` (and the
closed PR #6). Existing production data is **wiped**.

## Roles & terminology

Backend role enum: `owner | admin | manager | member`. UI renders
school-context labels (Owner / Administrator / Teacher / Student) — but that
mapping and all non-owner permissions are Phase 2. Phase 1 only creates
`owner`.

## Data model

**New tables**
- `organizations` — `id uuid pk`, `name text not null`, `created_by uuid`,
  `created_at timestamptz`, plus the org-profile fields currently on
  `school_settings`: `country`, `phone`, `industry`, `org_size`,
  `primary_role`, `devices text[]`, `referral_source`, `timezone`,
  `day_cutoff_time`, `absent_after_time`, `logo_url`, `onboarded_at`.
- `memberships` — `id uuid pk`, `user_id uuid references auth.users on delete
  cascade`, `org_id uuid references organizations on delete cascade`,
  `role app_role not null`, `created_at`, `unique(user_id, org_id)`.

**Changed tables**
- `org_id uuid not null references organizations on delete cascade` added to:
  `classes`, `students`, `attendance_events`, `kiosk_sessions`,
  `student_qr_tokens`.
- `profiles` gains `last_active_org_id uuid references organizations` (nullable;
  the org the user lands in on login). `profiles` stays global; keep
  `must_change_password` (unused until Phase 3, harmless).
- `waitlist_signups` stays global (pre-signup marketing; no `org_id`).

**Dropped**
- `user_roles` (replaced by `memberships`).
- `school_settings` (folded into `organizations`; the singleton pattern goes).
- `enforce_single_admin` index and any single-tenant seeds.
- `teacher_invites` and the whole invite path (see "Removals").

**Enum**: recreate `app_role` as `('owner','admin','manager','member')` (clean,
since we're wiping).

## Isolation (security core)

Every domain table carries `org_id`. RLS keys off membership via a
`SECURITY DEFINER` helper:

```sql
create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m
                 where m.org_id = org and m.user_id = auth.uid());
$$;
```

Policy shape on every domain table (Phase 1 — any member may act within their
org; role granularity is Phase 2):
- `select ... using (public.is_org_member(org_id))`
- `insert ... with check (public.is_org_member(org_id))`
- `update/delete ... using (public.is_org_member(org_id))`

Table-specific:
- `organizations`: members read their org (`is_org_member(id)`); update allowed
  for members (Phase 2 restricts to admin/owner). Insert only via the
  `createOrganization` server fn (service role).
- `memberships`: a user reads their **own** rows (`user_id = auth.uid()`) to
  build the switcher; writes go through server fns (service role).
- Public read views/policies for kiosk/lookup remain token-gated via server
  functions using the service-role client (unchanged pattern), but the queried
  rows are naturally single-org because the token maps to one org's rows.

## Signup, org creation, active org & switching

- **`createOrganization` (reworked):** open to any authenticated user. Creates
  an `organizations` row, inserts `memberships(user_id, org_id, 'owner')`, and
  sets `profiles.last_active_org_id = new org`. No "org exists" gate. Used both
  at first signup and to create additional orgs.
- **Signup:** the wizard (account step + org-profile steps) calls
  `supabase.auth.signUp` then `createOrganization`. Always creates a new org.
- **Additional orgs:** authenticated users create more from an **org-switcher**
  in the app header → org-profile steps only → `createOrganization` → switch.
- **Active org:** resolved server-side from `profiles.last_active_org_id`. A
  `setActiveOrg({ orgId })` server fn validates membership and updates that
  column. All org-scoped server fns read the caller's active org from it; RLS
  independently enforces membership, so a stale/forged active org can't leak
  another org's data.
- **`getMyContext` (reworked):** returns the caller's `orgs` (id, name, role
  from memberships), the `activeOrg`, and (org-scoped) setup progress. No more
  `user_roles`/`school_settings` singleton reads.

## Server functions — org scoping

Every existing server fn that reads/writes domain data
(`classes.functions`, `attendance.functions`, `settings.functions`,
`kiosk.functions`, `import.functions`, `auth.functions`) is reworked to:
1. Resolve the caller's active org (`last_active_org_id`), asserting membership.
2. Set/filter `org_id` on all inserts and queries.
3. Read settings from `organizations` (not `school_settings`).
4. Use `memberships` instead of `user_roles`.

RLS is the backstop, but functions set `org_id` explicitly so rows are correctly
scoped on insert.

## Removals (single-tenant / invite machinery)

Removed as part of establishing the clean multi-tenant base:
`teacher_invites` + `inviteTeacher`/`listInvites`/`acceptInvite`,
`getJoinContext`, the invite-based teacher import, `?invite=` handling,
the `handle_new_user` invite branch, and the `/welcome`, `/welcome/create`,
`/create-organization`, `/app/invite/$token` routes. (Staff provisioning
returns properly in Phase 2.) The onboarding wizard drops its "invite teachers"
step for Phase 1 (settings → class → students only); teacher provisioning is
Phase 2.

## Public routes (kiosk / parent lookup)

Unchanged UX. `kiosk_sessions` and `students` now carry `org_id`; the
token-validated public server fns return only that token's rows, which belong to
a single org — isolation is automatic.

## Security considerations

- `is_org_member` is the single chokepoint; every domain policy uses it. It must
  be `SECURITY DEFINER` with a pinned `search_path`.
- `createOrganization` and `setActiveOrg` are the only ways to gain/switch org
  context; both validate the acting user.
- Active org is advisory for *which* org's data to show; **membership via RLS is
  authoritative** — passing/forging an org you don't belong to yields nothing.
- Cross-org foreign keys must be impossible: e.g. a class's `org_id` must match
  its students' `org_id`. Enforced by always deriving `org_id` from the active
  org on insert (and, where cheap, composite checks).

## Edge cases

- **User in zero orgs** (fresh account mid-signup, or removed from their only
  org): `_authenticated` sends them to `/signup` to create one.
- **`last_active_org_id` points at an org they've left:** on load, fall back to
  any membership; if none, treat as zero-orgs.
- **Creating an org while signed in:** skip the account step; just org profile.
- **Concurrent signups:** each creates its own org — no contention (the
  single-admin race is gone with `enforce_single_admin`).

## Deferred (explicitly not Phase 1)

Non-owner roles & permissions and staff provisioning (Phase 2); authenticated
students + at-scale provisioning (Phase 3); billing (Phase 4).

## Rollout

New timestamped migrations build the multi-tenant schema; existing prod data is
wiped (`start fresh`). Local: apply with `supabase migration up --local` (or
recreate the local DB) and regenerate `types.ts`. Prod: `supabase db push`
after merge. Built on `feat/multi-tenant-foundation` off `main`.

## Verification

No unit-test harness exists; verification is `tsc`/`build` + local-Supabase
browser smoke:
1. Sign up → new org created, you're its owner, you land on the dashboard.
2. Create classes/students/kiosk/attendance — all scoped to your org.
3. **Isolation:** a second signup (org B) cannot see org A's classes/students/
   attendance via UI or direct REST with org B's session (the critical test).
4. Create a second org from the switcher → switch between orgs → data changes
   accordingly; `last_active_org_id` persists.
5. Public kiosk/lookup for an org-A token exposes only org-A data.
6. Old routes (`/welcome`, `/create-organization`, `/app/invite/x`) 404.
