# Multi-tenant Foundation (Phase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-tenant app into a multi-tenant SaaS foundation: every signup creates an isolated organization owned by the signer, a user can belong to and switch between multiple orgs, and org A can never read org B's data.

**Architecture:** New `organizations` + `memberships` tables; `org_id` on every domain table; RLS scoped by an `is_org_member(org_id)` helper. Active org resolved server-side from `profiles.last_active_org_id`. Owner-only for Phase 1 (role enum supports all four tiers). Existing data wiped; single-tenant + invite machinery removed.

**Tech Stack:** TanStack Start (React 19, file routing, `createServerFn`), Supabase (Postgres + Auth + RLS), Tailwind + shadcn/ui, Zod.

## Global Constraints

- Multi-tenant: many orgs; each signup creates one. Every domain row is scoped by `org_id`. RLS isolates by membership — this is security-critical, verify it explicitly.
- Role enum recreated as `owner | admin | manager | member`; **Phase 1 only ever creates `owner`**. No non-owner provisioning here (Phase 2).
- Active org = `profiles.last_active_org_id`, resolved and membership-checked server-side. RLS is the authoritative backstop.
- Never edit existing migration files; add new timestamped ones. Regenerate `src/integrations/supabase/types.ts` after schema changes (`supabase gen types typescript --local > src/integrations/supabase/types.ts`; local DB via `supabase migration up --local`). Prod later via `SUPABASE_PROJECT_ID=jywwgoceybjendvpbqea supabase db push`.
- Existing prod/local data is **wiped** — no back-fill.
- No unit-test harness. Verify each task with `npx tsc --noEmit` + `npm run build`, plus the task's local-Supabase browser smoke. Because this is a broad refactor, `tsc` stays red (references to dropped tables) until the tasks that fix those references; each task lists which errors are expected to remain.
- Branch: `feat/multi-tenant-foundation` (off `main`, PR #6 closed/superseded). Commit after each task.

---

### Task 1: Schema migration + RLS + regenerated types

**Files:**
- Create: `supabase/migrations/<ts>_multi_tenant_foundation.sql`
- Modify: `src/integrations/supabase/types.ts` (regenerated)

**Interfaces:**
- Produces: tables `organizations`, `memberships`; `org_id` on `classes`/`students`/`attendance_events`/`kiosk_sessions`/`student_qr_tokens`; `profiles.last_active_org_id`; enum `app_role = owner|admin|manager|member`; function `public.is_org_member(uuid) → boolean`.

- [ ] **Step 1: Write the migration.** Order matters: drop dependents → recreate enum → create tables → add columns → helper → RLS → trigger.
```sql
-- 1. Drop single-tenant / invite machinery (data is wiped).
drop table if exists public.teacher_invites cascade;
drop table if exists public.user_roles cascade;
drop index if exists public.user_roles_single_admin;
alter table public.school_settings disable row level security;

-- 2. Recreate role enum as the 4-tier hierarchy.
drop type if exists public.app_role cascade;
create type public.app_role as enum ('owner','admin','manager','member');

-- 3. organizations (absorbs school_settings fields).
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text, phone text, industry text, org_size text,
  primary_role text, devices text[] not null default '{}', referral_source text,
  timezone text not null default 'UTC',
  day_cutoff_time time not null default '09:00',
  absent_after_time time not null default '10:30',
  logo_url text, onboarded_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
drop table if exists public.school_settings cascade;

-- 4. memberships.
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

-- 5. org_id on domain tables (wiped, so plain not null add is fine after truncate).
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

-- 6. profiles.last_active_org_id.
alter table public.profiles add column last_active_org_id uuid references public.organizations(id) on delete set null;

-- 7. membership helper (chokepoint for all RLS).
create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m where m.org_id = org and m.user_id = auth.uid());
$$;

-- 8. simplify handle_new_user (profile only; no invites).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

-- 9. Enable RLS + org-scoped policies on every domain table.
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
grant select, insert, update, delete on public.organizations, public.memberships to authenticated;
grant all on public.organizations, public.memberships to service_role;

create policy "members read their orgs" on public.organizations for select to authenticated using (public.is_org_member(id));
create policy "members update their orgs" on public.organizations for update to authenticated using (public.is_org_member(id));
create policy "user reads own memberships" on public.memberships for select to authenticated using (user_id = auth.uid());

-- Domain tables: any member of the row's org may act (role granularity is Phase 2).
-- Repeat this block for classes, students, attendance_events, kiosk_sessions, student_qr_tokens:
create policy "org members rw classes" on public.classes for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
-- ...(students, attendance_events, kiosk_sessions, student_qr_tokens identical, s/classes/<table>/)
```
(Write the five domain-table policies out in full; drop any pre-existing policies on those tables first with `drop policy if exists` — enumerate the old policy names from the original migration `20260627122738…sql`.)

- [ ] **Step 2: Apply locally + regen types**
Run: `supabase migration up --local` then `supabase gen types typescript --local > src/integrations/supabase/types.ts`
Expected: types include `organizations`, `memberships`, `last_active_org_id`, `org_id` on domain tables; no `user_roles`/`school_settings`/`teacher_invites`.

- [ ] **Step 3: Verify** — `npx tsc --noEmit`. Expected: errors ONLY in files referencing dropped `user_roles`/`school_settings`/`teacher_invites` (fixed in Tasks 2–5). Record the file list.

- [ ] **Step 4: Commit** — `git add supabase/migrations src/integrations/supabase/types.ts && git commit -m "feat(db): multi-tenant schema — organizations, memberships, org_id, RLS"`

---

### Task 2: Org-context server functions (createOrganization, setActiveOrg, getActiveOrgId, getMyContext)

**Files:**
- Modify: `src/lib/organization.functions.ts`
- Modify: `src/lib/auth.functions.ts`
- Create: `src/lib/org-context.ts` (shared active-org resolver)

**Interfaces:**
- Produces:
  - `resolveActiveOrgId(supabaseAdmin, userId): Promise<string | null>` (in `org-context.ts`) — reads `profiles.last_active_org_id`; if null/not-a-member, falls back to any membership; returns null if none.
  - `createOrganization({ schoolName, country, phone, industry, orgSize, role, devices, referralSource })` — creates org + `owner` membership + sets `last_active_org_id`; returns `{ orgId }`.
  - `setActiveOrg({ orgId })` — validates membership, sets `last_active_org_id`; returns `{ ok: true }`.
  - `getMyContext()` returns `{ userId, email, profile, orgs: {id,name,role}[], activeOrgId, activeOrg, setupProgress }`.

- [ ] **Step 1: Create `org-context.ts`** with `resolveActiveOrgId` (service-role reads of `profiles` + `memberships`). Full function body:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
export async function resolveActiveOrgId(admin: SupabaseClient<Database>, userId: string) {
  const { data: prof } = await admin.from("profiles").select("last_active_org_id").eq("id", userId).maybeSingle();
  const { data: mems } = await admin.from("memberships").select("org_id").eq("user_id", userId);
  const memberOrgs = new Set((mems ?? []).map((m) => m.org_id));
  const pref = prof?.last_active_org_id;
  if (pref && memberOrgs.has(pref)) return pref;
  return (mems ?? [])[0]?.org_id ?? null;
}
```
- [ ] **Step 2: Rework `createOrganization`** (open; no orgExists/single-admin gate). After `requireSupabaseAuth`: insert `organizations` (name = schoolName + profile fields), insert `memberships(userId, orgId, 'owner')`, update `profiles.last_active_org_id = orgId`. Return `{ orgId }`. Remove `getJoinContext`.
- [ ] **Step 3: Add `setActiveOrg`** — validate `exists membership(userId, orgId)`, update `profiles.last_active_org_id`; throw "Not a member of that organization" otherwise.
- [ ] **Step 4: Rework `getMyContext`** — read memberships (join organizations for name/role), resolve active org via `resolveActiveOrgId`, fetch active org row for settings/onboarded, compute setup progress scoped to `org_id = activeOrgId` (counts of classes/students/kiosk in that org). Drop `user_roles`/`school_settings` reads. Remove `completeOnboarding`'s `school_settings` write → update `organizations.onboarded_at` for the active org instead.
- [ ] **Step 5: Verify** `npx tsc --noEmit` (remaining errors only in domain fns / routes, Tasks 3–5). Commit: `git commit -am "feat(server): org context — createOrganization(open), setActiveOrg, getMyContext"`

---

### Task 3: Org-scope the domain server functions

**Files:**
- Modify: `src/lib/classes.functions.ts`, `src/lib/attendance.functions.ts`, `src/lib/settings.functions.ts`, `src/lib/kiosk.functions.ts`, `src/lib/import.functions.ts`

**Interfaces:**
- Consumes: `resolveActiveOrgId` (Task 2).
- Pattern (apply to every handler): resolve `orgId = await resolveActiveOrgId(admin, userId)`; throw "No active organization" if null; **filter every select** with `.eq("org_id", orgId)` and **set `org_id: orgId`** on every insert. Replace `user_roles` admin checks with `memberships` role checks (Phase 1: membership existence, since only owner). Replace `school_settings` reads/writes with `organizations` (the active org row).

- [ ] **Step 1: `settings.functions.ts`** — `getSettings`/`updateSettings` read/write `organizations` (active org) instead of `school_settings` singleton. `lookupStudentPublic` scopes via the student's `org_id` (already single-org by qr_token).
- [ ] **Step 2: `classes.functions.ts`** — every list/get/create/update/delete/roster/QR fn filters and sets `org_id`. Admin checks → membership checks.
- [ ] **Step 3: `attendance.functions.ts`** — `markAttendance`/`setStudentNote`/`bulkMarkAllPresent`/`getReport`/`getStudentHistory`/`exportClassAttendance` filter and set `org_id`.
- [ ] **Step 4: `kiosk.functions.ts`** — `createKioskSession`/`listKioskSessions`/`revokeKioskSession` set/filter `org_id`; public `getKioskBoard`/`recordKioskScan` derive org from the session's `org_id` and keep all queries within it.
- [ ] **Step 5: `import.functions.ts`** — `importStudents` sets `org_id` on created classes+students. Remove `importTeachers` (invite-based).
- [ ] **Step 6: Verify** `npx tsc --noEmit` (remaining errors only in routes/UI). Commit: `git commit -am "feat(server): scope all domain functions to the active org"`

---

### Task 4: Remove invite / welcome / create-org machinery

**Files:**
- Delete: `src/routes/welcome.index.tsx`, `src/routes/welcome.create.tsx`, `src/routes/create-organization.tsx`, `src/routes/_authenticated/app.invite.$token.tsx`
- Modify: `src/lib/auth.functions.ts` (remove `inviteTeacher`/`listInvites`/`acceptInvite`), `src/routes/auth.tsx` (remove `?invite=`), `src/routes/_authenticated/app.teachers.tsx` (Phase-1 stub: "coming soon" or hidden), `src/routes/_authenticated/app.onboarding.tsx` (drop the invite-teachers step), `src/routes/_authenticated/app.import.tsx` (drop teacher import tab)

- [ ] **Step 1** Delete the four route files (`git rm`).
- [ ] **Step 2** Remove invite server fns and any imports of them.
- [ ] **Step 3** Onboarding: reduce to settings → class → students (remove the teachers step and its wiring). Teachers page: render a Phase-2 placeholder ("Team management coming soon") so admins have no dead controls. Import: student-only.
- [ ] **Step 4: Verify** `grep -rn "teacher_invites\|inviteTeacher\|acceptInvite\|getJoinContext\|/welcome\|create-organization\|app/invite" src/` → nothing. `npx tsc --noEmit` — expected errors now only where routes call the reworked getMyContext shape (Task 5). Commit: `git commit -am "chore: remove invite + welcome/create-org machinery"`

---

### Task 5: Open signup wizard + auth + landing (create-org-on-signup)

**Files:**
- Modify: `src/routes/signup.tsx` (create it if not present on this branch — it was on the closed PR), `src/routes/auth.tsx`, `src/routes/_authenticated/route.tsx`, `src/components/landing/Nav.tsx`, `src/routes/index.tsx`

**Interfaces:**
- Consumes: `createOrganization` (Task 2), `getMyContext` (Task 2).

- [ ] **Step 1: `/signup`** — wizard: account step (email/password/full name) + org-profile steps → `supabase.auth.signUp` then `createOrganization`. **Always open** (no orgExists check). If already signed in, skip the account step (creating an additional org). On success → `/app`.
- [ ] **Step 2: `auth.tsx`** — sign-in only; on load, if signed in, redirect to `/app` when the user has ≥1 membership else `/signup`. Always show a "Create your organization" link to `/signup` (signup is never closed now).
- [ ] **Step 3: `_authenticated/route.tsx`** — `beforeLoad`: no session → `/auth`; signed in but **zero memberships** → `/signup`; else allow. (Drop the `must_change_password` gate for Phase 1 — it's Phase 3; leave the column.)
- [ ] **Step 4: landing `Nav.tsx`/`index.tsx`** — session-aware CTAs ("Go to dashboard" when signed in, else "Sign in" + "Create organization" → `/signup`).
- [ ] **Step 5: Verify (local smoke)** — fresh signup creates an org and lands on the dashboard; classes/students you create belong to that org. `tsc`+`build` clean. Commit: `git commit -am "feat(signup): open org-creating signup + session-aware auth/landing"`

---

### Task 6: Org-switcher + create-additional-org

**Files:**
- Create: `src/components/app/OrgSwitcher.tsx`
- Modify: the authenticated app shell/header (wherever the sidebar/nav for `/app` lives — locate via `grep -rn "Sign out" src/routes/_authenticated`)

**Interfaces:**
- Consumes: `getMyContext` (`orgs`, `activeOrgId`), `setActiveOrg`, `createOrganization`.

- [ ] **Step 1: `OrgSwitcher.tsx`** — dropdown listing the user's orgs (from `getMyContext().orgs`), current one checked. Selecting one calls `setActiveOrg({ orgId })` then reloads app data (invalidate/route reload). A "Create organization" item routes to `/signup` (which, when already authed, shows org-profile steps only).
- [ ] **Step 2:** Mount `OrgSwitcher` in the `/app` header.
- [ ] **Step 3: Verify (local smoke)** — create a 2nd org via the switcher → it appears and becomes active → dashboard shows the new (empty) org; switching back shows the first org's data; `last_active_org_id` persists across reload. `tsc`+`build` clean. Commit: `git commit -am "feat(app): org switcher + create additional org"`

---

### Task 7: Route-tree regen + full verification (isolation)

- [ ] **Step 1** `npm run build` — regenerates `routeTree.gen.ts` without deleted routes; confirm clean.
- [ ] **Step 2** `npx tsc --noEmit` — clean (0 errors).
- [ ] **Step 3: Isolation smoke (the critical test).** With local Supabase: sign up org A (create a class + students), sign up org B in a separate context. Verify org B's dashboard/classes/students/reports show **none** of org A's data. Then, as org B's session, hit the REST API directly for `classes`/`students` — confirm RLS returns only org B rows. This is the pass/fail gate for the whole phase.
- [ ] **Step 4: Flow smoke** — walk spec §Verification 1–6 (signup→org, scoping, second org + switch, public kiosk/lookup single-org, old routes 404).
- [ ] **Step 5** Open PR against `main`; note prod needs `SUPABASE_PROJECT_ID=jywwgoceybjendvpbqea supabase db push` after merge, and that this wipes/replaces the single-tenant schema.

---

## Self-review notes
- **Spec coverage:** schema+enum+helper (T1), RLS isolation (T1), createOrg/setActiveOrg/getMyContext/active-org (T2), domain scoping (T3), removals (T4), open signup + zero-org redirect (T5), switcher + additional orgs (T6), isolation verification (T7). All spec sections covered.
- **Type consistency:** `resolveActiveOrgId`, `createOrganization → {orgId}`, `setActiveOrg({orgId})`, `getMyContext → {orgs, activeOrgId, ...}` used consistently across T2–T6.
- **Deferred correctly:** non-owner roles, student logins, billing, `must_change_password` gate — all left for later phases.
- **Verification** adapted to this repo (no unit tests): tsc/build/local-Supabase smoke, with cross-org isolation as the gate.
