# Org Signup + Admin-Provisioned Teachers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make signup a full org-creation wizard (creator becomes the sole admin), close public signup once the org exists, and let the admin provision teacher logins directly (temp password, forced change on first login). Remove the entire self-serve invite path.

**Architecture:** Single-tenant, unchanged core (`enforce_single_admin`, `school_settings` singleton, admin/teacher enum). New public `orgExists()` gate drives signup availability. Teacher accounts are created server-side with the service-role client. A `must_change_password` flag on `profiles`, enforced in the `_authenticated` route `beforeLoad`, forces a password reset on first login.

**Tech Stack:** TanStack Start (React 19, file-based routing, `createServerFn`), Supabase (Postgres + Auth, RLS), Tailwind + shadcn/ui, Zod.

## Global Constraints

- Single-tenant: exactly one org, one permanent admin (the creator). Do not touch `enforce_single_admin` or the `school_settings` singleton.
- Roles are `admin` | `teacher` only (no enum change).
- No email delivery — every flow must work without sending email.
- Never edit existing migration files; add new timestamped ones. Regenerate `src/integrations/supabase/types.ts` via `npm run db:types` after schema changes (locally: apply with `supabase migration up --local`, since `db reset` is gated on this machine — see local-dev notes).
- Admin-only server fns must assert the caller is admin before any service-role operation (mirror the existing `adminRows` check pattern in `src/lib/auth.functions.ts`).
- Verification per task: `npx tsc --noEmit` + `npm run build` clean, plus the task's browser smoke check against local Supabase (`admin@rollcall.test` / `password123` from `supabase/seed.sql`). No unit-test harness exists.
- Branch: `feat/org-signup-teacher-accounts`. Commit after each task.

---

### Task 1: Database migrations + regenerated types

**Files:**
- Create: `supabase/migrations/<ts>_add_must_change_password.sql`
- Create: `supabase/migrations/<ts>_drop_teacher_invites_and_simplify_trigger.sql`
- Modify: `src/integrations/supabase/types.ts` (regenerated, do not hand-edit)

**Interfaces:**
- Produces: `profiles.must_change_password boolean not null default false`; `teacher_invites` no longer exists; `handle_new_user` creates only the profile.

- [ ] **Step 1: Add the column migration** (`<ts>_add_must_change_password.sql`):
```sql
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;
```

- [ ] **Step 2: Drop invites + simplify trigger** (`<ts>_drop_teacher_invites_and_simplify_trigger.sql`). Recreate `handle_new_user` WITHOUT the invite branch (keep the profile insert exactly as in migration `20260628074114`), then drop the table:
```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.profiles (id, full_name, school_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.raw_user_meta_data->>'school_name')
  on conflict (id) do nothing;
  return new;
end;
$function$;

drop table if exists public.teacher_invites cascade;
```

- [ ] **Step 3: Apply locally & regenerate types**
Run: `supabase migration up --local` then `SUPABASE_PROJECT_ID=jywwgoceybjendvpbqea npm run db:types` — actually for local types use `supabase gen types typescript --local > src/integrations/supabase/types.ts`.
Expected: `types.ts` no longer contains `teacher_invites`; `profiles` Row/Insert include `must_change_password`.

- [ ] **Step 4: Verify** — `npx tsc --noEmit`. Expect errors ONLY in files that still reference `teacher_invites` (fixed in later tasks). Note them; do not fix yet.

- [ ] **Step 5: Commit** — `git add supabase/migrations src/integrations/supabase/types.ts && git commit -m "feat(db): add must_change_password, drop teacher_invites"`

---

### Task 2: Server-function layer

**Files:**
- Create: `src/lib/teachers.functions.ts`
- Modify: `src/lib/organization.functions.ts` (add `orgExists`)
- Modify: `src/lib/auth.functions.ts` (extend `getMyContext`; remove invite fns; add `completePasswordChange`)

**Interfaces:**
- Produces:
  - `orgExists(): Promise<{ exists: boolean }>` — public (no middleware), service-role read of `user_roles` for any `admin`.
  - `createTeacherAccount({ email: string, fullName: string, tempPassword: string }): Promise<{ userId: string; email: string }>` — admin-only.
  - `resetTeacherPassword({ userId: string, tempPassword: string }): Promise<{ ok: true }>` — admin-only.
  - `completePasswordChange(): Promise<{ ok: true }>` — auth'd; clears `must_change_password` for the caller via service role.
  - `getMyContext` return gains `mustChangePassword: boolean`.

- [ ] **Step 1: Add `orgExists` to `organization.functions.ts`** (public, mirrors the anon-safe pattern):
```ts
export const orgExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin").limit(1);
  return { exists: (data ?? []).length > 0 };
});
```

- [ ] **Step 2: Create `src/lib/teachers.functions.ts`** with `createTeacherAccount` and `resetTeacherPassword`. Both assert admin (copy the `adminRows` check from `auth.functions.ts`). Key body for create:
```ts
// after admin assertion:
const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
  email: data.email,
  password: data.tempPassword,
  email_confirm: true,
  user_metadata: { full_name: data.fullName },
});
if (error) throw new Error(error.message);
const uid = created.user!.id;
const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "teacher" });
if (roleErr) throw new Error(roleErr.message);
await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", uid);
return { userId: uid, email: data.email };
```
`resetTeacherPassword`: `supabaseAdmin.auth.admin.updateUserById(userId, { password: tempPassword })` then set `must_change_password = true`. Validate `tempPassword` with `z.string().min(8)`, `email` with `z.string().email()`, `fullName` `z.string().min(1).max(120)`.

- [ ] **Step 3: Extend `getMyContext`** — add `profiles.must_change_password` to the `profileRes` select (it's `select("*")` already, so it's included), and add `mustChangePassword: !!profileRes.data?.must_change_password` to the return object.

- [ ] **Step 4: Add `completePasswordChange` to `auth.functions.ts`**:
```ts
export const completePasswordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles").update({ must_change_password: false }).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
```

- [ ] **Step 5: Remove invite fns** — delete `inviteTeacher`, `listInvites`, `acceptInvite` from `auth.functions.ts`. (Callers are removed in Tasks 5–7; expect tsc errors in those files until then.)

- [ ] **Step 6: Verify** — `npx tsc --noEmit` (remaining errors only in route files handled later). Commit: `git commit -am "feat(server): orgExists, teacher provisioning, password-change fns"`

---

### Task 3: Forced password-change gate + set-password page

**Files:**
- Create: `src/routes/_authenticated/app.set-password.tsx`
- Modify: `src/routes/_authenticated/route.tsx`

**Interfaces:**
- Consumes: `getMyContext` (`mustChangePassword`), `completePasswordChange`.

- [ ] **Step 1: Gate in `_authenticated/route.tsx` `beforeLoad`.** After the role check, fetch context and, if `mustChangePassword` and not already on the set-password path, `throw redirect({ to: "/app/set-password" })`. Guard against loops by exempting `location.pathname === "/app/set-password"`.

- [ ] **Step 2: Build `app.set-password.tsx`** — a blocking form (new password + confirm). On submit: `await supabase.auth.updateUser({ password })`, then `await completePasswordChange()`, then `navigate({ to: "/app" })`. Show validation (min 8, match). No way to skip.

- [ ] **Step 3: Verify (local smoke)** — with a teacher account flagged `must_change_password=true` (create one via psql or Task 5), sign in → forced to `/app/set-password`; other routes redirect back; after setting, dashboard loads and flag is cleared (`select must_change_password from profiles`). `tsc`+`build` clean.

- [ ] **Step 4: Commit** — `git commit -am "feat(auth): forced password change on first login"`

---

### Task 4: Signup wizard + org-exists gating on /auth

**Files:**
- Create: `src/routes/signup.tsx` (consolidated wizard)
- Modify: `src/routes/auth.tsx` (sign-in-only; link to /signup only when no org; remove `?invite=` handling)
- Modify: `src/routes/index.tsx` / landing CTAs that point at signup, if any

**Interfaces:**
- Consumes: `orgExists`, `createOrganization`, `supabase.auth.signUp/signInWithPassword`.

- [ ] **Step 1: Build `signup.tsx`** as a multi-step wizard. `beforeLoad`: call `orgExists()`; if `exists`, `throw redirect({ to: "/auth" })`. Step 1 collects email/password/fullName with the "you'll be the administrator" framing; steps 2+ reuse the org-profile fields/validation from the current `welcome.create.tsx` (lift its form into this wizard). Final submit: `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`, then `createOrganization({ ...orgFields })`, then `navigate({ to: "/app" })`. Handle `signUp` error (e.g. existing email) inline.
- [ ] **Step 2: Rework `auth.tsx`** to sign-in only: remove `mode`/signup UI and all `?invite=` logic; keep `signInWithPassword`. Fetch `orgExists()` on mount; render a "Create your school" link to `/signup` only when `!exists`.
- [ ] **Step 3: Point landing/`index.tsx` primary CTA** ("Create organization") at `/signup` (was `/create-organization` or `/welcome`).
- [ ] **Step 4: Verify (local smoke)** — with NO org (fresh local DB or delete admin role): `/signup` wizard creates org → admin dashboard. With an org present: `/signup` redirects to `/auth`; `/auth` shows sign-in only, no signup link. `tsc`+`build` clean.
- [ ] **Step 5: Commit** — `git commit -am "feat(signup): consolidated org-creation wizard; close signup after org exists"`

---

### Task 5: Teachers page — create login + reset

**Files:**
- Modify: `src/routes/_authenticated/app.teachers.tsx`

**Interfaces:**
- Consumes: `createTeacherAccount`, `resetTeacherPassword`, `listTeachers` (existing).

- [ ] **Step 1: Replace invite UI** with a "Create teacher login" form: email, full name, temp password input + **Generate** button (client-side random, e.g. 12-char). On submit call `createTeacherAccount`; on success show a one-time panel with the email + temp password and a Copy button + "share with the teacher" note; refresh the list.
- [ ] **Step 2: Add per-teacher "Reset password"** action → prompts/generates a new temp, calls `resetTeacherPassword`, shows the new temp once.
- [ ] **Step 3: Remove** all references to `inviteTeacher`/`listInvites` and invite-link rendering from this file.
- [ ] **Step 4: Verify (local smoke)** — admin creates a teacher → temp shown once → sign in as that teacher (incognito) → forced password change → dashboard. Admin reset → teacher forced again. `tsc`+`build` clean.
- [ ] **Step 5: Commit** — `git commit -am "feat(teachers): admin-provisioned logins with temp password + reset"`

---

### Task 6: Onboarding "invite teachers" → "create teacher logins"

**Files:**
- Modify: `src/routes/_authenticated/app.onboarding.tsx`

- [ ] **Step 1: Swap the invite step** for a "create teacher logins" step reusing the same create form/flow as Task 5 (email + full name + generated temp, shows creds once). Remove the invite-link generation code and its `inviteTeacher` calls.
- [ ] **Step 2: Verify** — onboarding step 2 creates a teacher; step marked complete; `tsc`+`build` clean.
- [ ] **Step 3: Commit** — `git commit -am "feat(onboarding): create teacher logins instead of invite links"`

---

### Task 7: Remove dead routes + redirects + regenerate route tree

**Files:**
- Delete: `src/routes/_authenticated/app.invite.$token.tsx`, `src/routes/welcome.index.tsx`, `src/routes/welcome.create.tsx`, `src/routes/create-organization.tsx`
- Modify: `src/routes/_authenticated/route.tsx` (role-less redirect target)
- Modify: `src/routeTree.gen.ts` (regenerated via build)

- [ ] **Step 1: Update role-less redirect** in `_authenticated/route.tsx`: role-less user → `orgExists()` check → if no org, `redirect({ to: "/signup" })`; if org exists, `redirect({ to: "/auth" })` (dead-end; they need admin-issued creds). Remove the `startsWith("/welcome")` logic.
- [ ] **Step 2: Delete the four route files** (`git rm`).
- [ ] **Step 3: Regenerate route tree** — `npm run build` rewrites `src/routeTree.gen.ts` without the removed routes.
- [ ] **Step 4: Verify** — `grep -rn "welcome\|create-organization\|app/invite\|acceptInvite\|inviteTeacher\|teacher_invites" src/` returns nothing (except unrelated words). `/welcome`, `/app/invite/x`, `/create-organization` 404 locally. `tsc`+`build` clean.
- [ ] **Step 5: Commit** — `git commit -am "chore: remove self-serve invite + welcome/create-org routes"`

---

### Task 8: Full end-to-end verification

- [ ] **Step 1:** `npx tsc --noEmit` — clean.
- [ ] **Step 2:** `npm run build` — clean; route tree has no removed routes.
- [ ] **Step 3: Local smoke (fresh DB)** — reset local (`supabase migration up --local` on a fresh DB or re-seed), then walk the full spec §Verification checklist 1–6.
- [ ] **Step 4: Open PR** against `main` summarizing the change, and note the two prod migrations require `supabase db push` after merge.

---

## Self-review notes

- **Spec coverage:** signup wizard (T4), close-after-org (T4), teacher provisioning (T2,T5), forced change (T2,T3), removals (T7), migrations (T1), onboarding swap (T6), edge cases (T3/T4/T7 redirects). All covered.
- **Type consistency:** `mustChangePassword` (context) vs `must_change_password` (column) used consistently; `createTeacherAccount`/`resetTeacherPassword`/`completePasswordChange`/`orgExists` signatures match across tasks.
- **Verification:** adapted to this repo (no unit tests) — tsc/build/local-Supabase smoke, per spec.
