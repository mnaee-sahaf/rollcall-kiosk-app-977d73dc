# Design: Staff roles & provisioning (Phase 2)

**Status:** Approved design, ready for implementation
**Date:** 2026-07-05

## Context

Phase 2 of the multi-tenant SaaS build. Phase 1 shipped orgs + memberships +
`org_id` isolation with everyone as `owner`. Phase 2 makes the role hierarchy
real for **staff** and lets owners/admins provision staff accounts.

**Roles & UI labels:** `owner` → Owner, `admin` → Administrator, `manager` →
Teacher, `member` → Student. Phase 2 covers **owner / admin / manager** (staff).
`member` (authenticated students) is Phase 3.

**Fixed role capabilities** (chosen model — no per-admin delegation toggles):
- **Owner** (1 per org, the creator): everything — manage all people incl.
  admins, org settings, (billing later). The only role that can manage admins.
- **Admin** (many): manage teachers (managers) + students + classes + org
  settings. Cannot manage other admins or the owner.
- **Teacher / manager** (many): run *their own* classes, students, and
  attendance. No people management, no settings.

## Data model

- `profiles.must_change_password boolean not null default false` — staff created
  with a temp password must set their own on first login.
- No new tables. `memberships.role` already carries the role.
- New RLS helper: `has_org_role(org uuid, variadic roles app_role[]) → boolean`
  (SECURITY DEFINER) — true if the caller has one of `roles` in `org`.

## Permission enforcement (two layers)

1. **RLS (isolation + coarse role gates):**
   - `organizations` UPDATE: tighten from Phase 1's "any member" to
     `has_org_role(id, 'owner','admin')`.
   - `memberships`: owner/admin may read all rows in their org (to list staff);
     writes go through server fns (service role). Keep "user reads own".
   - Domain tables (classes/students/attendance/kiosk/qr) stay org-member scoped
     (Phase 1). Per-teacher narrowing is done in server fns (layer 2), not RLS.
2. **Server functions (fine capability checks + scoping):** a shared
   `requireOrgRole(userId, [...roles])` helper resolves the active org +
   membership role and throws if not permitted. Applied to:
   - Settings write, people management → `owner`/`admin`.
   - Managing admins (create/промоte/remove admin) → `owner` only.
   - Class/student/attendance reads & writes: `owner`/`admin` see the whole org;
     `manager` is filtered to classes where `teacher_id = userId` (and those
     classes' students/attendance). Enforced by adding a teacher filter in the
     class/student/attendance list & mutation functions when the caller is a
     manager.

## Staff provisioning

New `src/lib/staff.functions.ts`:
- `listStaff()` → owner/admin: all memberships in the active org joined to
  profiles (name, email, role). Managers can't call it.
- `createStaffAccount({ email, fullName, role, tempPassword })` — caller must be
  owner/admin; **only owner may create `admin`**; `role ∈ {admin, manager}`
  (not owner/member). If the email is new → `supabaseAdmin.auth.admin.createUser`
  (email_confirm) + profile name + `must_change_password=true`; if the email
  already has an account → just add a `membership` (existing password, no temp).
  Then insert `memberships(user_id, active_org, role)`. Returns
  `{ userId, email, created: boolean, tempPassword?: string }` (temp only when a
  new account was created).
- `resetStaffPassword({ userId })` — owner/admin (owner-only if target is admin);
  regenerates a temp password, sets `must_change_password`.
- `setStaffRole({ userId, role })` — owner/admin; only owner can grant/revoke
  `admin`; can't change the owner; guard against removing the last owner (owner
  is fixed, so just disallow setting anyone to `owner` here).
- `removeStaff({ userId })` — owner/admin (owner-only if target is admin);
  deletes the membership for the active org (not the auth user, since they may
  belong to other orgs). Cannot remove the owner or yourself.

`createOrganization` unchanged (still makes the creator `owner`).

## Forced password change

Re-introduce the gate: `_authenticated` `beforeLoad` checks
`profiles.must_change_password`; if set and not already on `/app/set-password`,
redirect there. `/app/set-password` (a blocking page): the user sets a new
password (`auth.updateUser`), then `completePasswordChange()` clears the flag.

## UI

- **Team page** (`/app/teachers` → relabel nav "Team", or new `/app/team`):
  replaces the Phase-1 placeholder. Owner/admin only. Create-staff form (name,
  email, role select [Administrator / Teacher — "Administrator" shown only to the
  owner], generated temp password); one-time credential display; staff list with
  role, reset-password, change-role, remove actions (admin rows editable only by
  the owner).
- **Role-based nav** (`AppShell`): the "Admin" section (All students, Team, Bulk
  import, Waitlist, Settings) shows for owner/admin only; managers see Dashboard,
  Classes, Reports. Drive from `getMyContext().role`.
- `getMyContext` already returns `role`, `isOwner`, `isAdmin`; add `isManager`.

## Migrations

New timestamped migration: add `profiles.must_change_password`; create
`has_org_role`; tighten the `organizations` UPDATE policy to owner/admin; add a
`memberships` SELECT policy allowing owner/admin to read their org's memberships.

## Security considerations

- Every staff-management server fn re-checks the caller's role server-side
  (never trust the client). Admin-managing-admin and role escalation are blocked
  (`admin` can't create/modify admins; nobody can mint a second `owner`).
- Manager class scoping is enforced in server fns; RLS remains the org-isolation
  backstop from Phase 1 (unchanged).
- Temp passwords shown once, never stored in app tables.

## Edge cases

- Adding an existing user (member of another org) to this org: attach membership
  silently, no temp password (they use their existing one). Duplicate membership
  blocked by `unique(user_id, org_id)`.
- A manager hitting an admin-only route/page → redirected to `/app`.
- Owner cannot be removed, demoted, or duplicated.

## Deferred (not Phase 2)

Authenticated students / `member` provisioning at scale (Phase 3); billing
(Phase 4); per-admin delegated permission toggles (possible later refinement).

## Verification

`tsc`/`build` + local-Supabase browser smoke:
1. Owner signs up → creates org.
2. Owner creates an Administrator and a Teacher → temp passwords shown once.
3. Teacher signs in → forced to `/app/set-password` → sets password → dashboard;
   sees only Dashboard/Classes/Reports (no admin nav).
4. Admin signs in → can manage teachers/students/settings; cannot see/manage
   admins (owner-only).
5. Teacher sees only their own classes; owner/admin see all org classes.
6. Cross-org isolation from Phase 1 still holds (a teacher in org A sees nothing
   from org B).
