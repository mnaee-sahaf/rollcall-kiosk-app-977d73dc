# Staff Roles & Provisioning (Phase 2) — Implementation Plan

> **For agentic workers:** implement task-by-task; verify with `tsc`/`build` + local-Supabase smoke (no unit-test harness). Branch `feat/staff-roles-provisioning` off main.

**Goal:** Make owner/admin/manager roles real — owner/admin provision staff accounts and manage settings/people; teachers are scoped to their own classes; staff created with a temp password must change it on first login.

## Global Constraints
- Fixed role capabilities (spec §Fixed role capabilities). `admin` cannot manage admins/owner; only `owner` manages admins; never mint a 2nd owner.
- Role checks re-verified server-side in every staff/settings fn. RLS from Phase 1 stays the org-isolation backstop.
- New migration file; regenerate types. Prod later via `SUPABASE_PROJECT_ID=jywwgoceybjendvpbqea supabase db push`.
- Commit after each task.

## Tasks

### Task 1: Migration + types
- `profiles.must_change_password boolean not null default false`.
- `has_org_role(org uuid, variadic roles app_role[]) → boolean` (SECURITY DEFINER, stable).
- Tighten `organizations` UPDATE policy → `has_org_role(id,'owner','admin')` (drop the Phase-1 "members update their orgs" policy first).
- Add `memberships` SELECT policy: owner/admin read their org's memberships — `public.has_org_role(org_id,'owner','admin')` (in addition to "user reads own").
- Apply local (`supabase migration up --local`), regen types.

### Task 2: Server-side role helper + staff functions
- `src/lib/org-context.ts`: add `resolveActiveMembership(admin, userId) → { orgId, role } | null` and `requireOrgRole(admin, userId, roles[]) → { orgId, role }` (throws "Forbidden" / "No active organization").
- `src/lib/staff.functions.ts` (new): `listStaff`, `createStaffAccount`, `resetStaffPassword`, `setStaffRole`, `removeStaff`, `completePasswordChange` (per spec §Staff provisioning + §Forced password change). Enforce: owner-only for anything touching an `admin`; role ∈ {admin, manager} on create; add-existing-user attaches membership without temp password.
- `getMyContext`: add `isManager: role === "manager"`.

### Task 3: Role scoping in domain functions
- `settings.functions.updateSettings` → `requireOrgRole(..., ['owner','admin'])`.
- `classes.functions` + `attendance.functions`: when caller role is `manager`, filter class/student/attendance reads and mutations to classes where `teacher_id = userId`; owner/admin keep full-org access. (Use the resolved membership role; keep org_id scoping.)

### Task 4: Forced password change gate + page
- `_authenticated/route.tsx`: after the membership check, read `profiles.must_change_password`; if set and path ≠ `/app/set-password`, redirect there.
- `src/routes/_authenticated/app.set-password.tsx` (new): blocking form → `auth.updateUser({password})` → `completePasswordChange()` → `/app`.

### Task 5: Team page + role-based nav (UI)
- `src/routes/_authenticated/app.teachers.tsx`: replace placeholder with the Team page (create staff [role select; "Administrator" only shown to owner], one-time creds, list with reset/change-role/remove; admin rows editable only by owner). Owner/admin only (redirect managers to /app).
- `AppShell`: gate the "Admin" nav section to owner/admin (`isAdmin`); managers see Dashboard/Classes/Reports only. Relabel "Teachers" → "Team".

### Task 6: Verify
- `tsc`/`build` clean.
- Local smoke: owner creates an admin + a teacher (temp passwords once); teacher forced to set password, sees no admin nav, sees only own classes; admin manages teachers/settings but not admins; Phase-1 cross-org isolation still holds.
- Open PR.
