# Design: Single-tenant org signup + admin-provisioned teacher logins

**Status:** Approved design, ready for implementation
**Date:** 2026-07-04

## Problem

Today the app lets a signed-up user either *create* an org or *join* an
existing one via a self-serve invite link, and teachers self-register
through those links. The desired model is:

1. **Signup means creating the organization.** The person signing up
   becomes the org's administrator, and signup should be a clear,
   full org-creation wizard — not a bare name/email form.
2. **The admin provisions teacher logins directly.** Teachers never
   self-register; the admin creates their accounts with credentials.

## Model (unchanged core)

Single-tenant: **one organization per deployment**, one **permanent
admin** (the org creator). We keep the existing `enforce_single_admin`
unique index, the `school_settings` singleton row, and the
`admin` / `teacher` role enum. There is no second admin and no second
org, ever.

## Flows

### A. Signup → org-creation wizard (first-run only)

A single **consolidated wizard** is the signup experience. It is only
reachable while **no org exists yet** (first run).

- **Step 1 — account:** email, password, full name, with explicit
  framing: *"Create your school's RollCall — you'll be the
  administrator."*
- **Steps 2+ — org profile:** the fields already collected by
  `/welcome/create` (school name, country, phone, industry, org size,
  role, devices, referral source).
- **Final submit:** `supabase.auth.signUp(...)` (email confirmation is
  disabled in `config.toml`, so the user is immediately signed in), then
  call `createOrganization(...)` with the org profile. The user now has
  the `admin` role and a completed `school_settings` row.

**Resume safety.** If the account is created but the org step fails (or
the user drops off), on next sign-in they are authenticated but role-less
with **no org yet** → they are dropped back into the wizard at the
org-profile step (the account already exists, so step 1 is skipped).

### B. After the org exists

Public signup **closes**. `/auth` renders sign-in only. A public
`orgExists()` server function (service-role read of "does any admin
exist") drives whether the signup affordance is shown. Teachers sign in
here with the credentials the admin issued. Attempting to create a
second org is already blocked at the DB and server-fn level.

### C. Admin provisions a teacher login (`/app/teachers`)

The invite UI is replaced with a **"Create teacher login"** form:
email, full name, and a temporary password field with a **Generate**
button.

- New admin-only server fn `createTeacherAccount({ email, fullName,
  tempPassword })`:
  1. Assert caller is admin.
  2. `supabaseAdmin.auth.admin.createUser({ email, password,
     email_confirm: true, user_metadata: { full_name } })`.
  3. Insert `user_roles(user_id, 'teacher')`.
  4. Set `profiles.must_change_password = true`.
  5. Return the created teacher (and echo the temp password so the UI can
     show it **once**).
- The UI shows email + temp password once, with a copy affordance and a
  "share these with the teacher" note.
- **Reset:** admin-only `resetTeacherPassword({ userId })` regenerates a
  temp password (`auth.admin.updateUserById`) and re-sets
  `must_change_password`. This is the only reset path, since email
  delivery is deferred.

### D. Forced password change on first login

New column `profiles.must_change_password boolean not null default false`.

- Set `true` when the admin creates the account or resets the password.
- The `_authenticated` layout checks it (via `getMyContext`) and, when
  `true`, redirects to a **blocking** `/app/set-password` route — no
  other app route is reachable until it clears.
- On that page the teacher sets a new password (`supabase.auth.updateUser
  ({ password })`); a server fn `completePasswordChange()` verifies the
  session and clears the flag via the service-role client. Normal access
  resumes.
- The admin never hits this (they chose their own password in the
  wizard).

## Removals (self-serve invite path)

All of the following are deleted:

- `teacher_invites` table + its RLS policies (dropped in a migration).
- Server fns `acceptInvite`, `inviteTeacher`, `listInvites`.
- Route `src/routes/_authenticated/app.invite.$token.tsx`.
- `?invite=` handling in `src/routes/auth.tsx`.
- The invite branch inside the `handle_new_user` trigger (simplified to
  only create the profile).
- `/welcome` chooser, `src/routes/welcome.index.tsx`,
  `src/routes/welcome.create.tsx` (folded into the signup wizard), and
  `src/routes/create-organization.tsx`.
- The onboarding "invite teachers" step becomes "create teacher logins"
  (reuses `createTeacherAccount`).

## Data model & migrations

1. `profiles`: add `must_change_password boolean not null default false`.
2. Drop `teacher_invites` (table + policies) and simplify
   `handle_new_user` (remove the invite-acceptance branch).
3. No role-enum change. `enforce_single_admin` untouched.

Migrations are new timestamped files under `supabase/migrations/`; never
edit existing ones. Types regenerated with `db:types` after push.

## Security

- `createTeacherAccount` / `resetTeacherPassword` use the service-role
  client and MUST assert admin first (mirror the existing
  `ensureAdmin`-style checks in the current server fns).
- `orgExists()` returns only a boolean; no org details leak to anon.
- The `must_change_password` gate must be enforced server-side in the
  route `beforeLoad` (not just client UI) so it can't be bypassed by
  navigating directly.
- Temp passwords are shown to the admin once and never persisted in app
  tables (they live only in Supabase auth as the hashed password).

## Edge cases

- **Account exists, no org, no other org:** resume wizard at org step.
- **Account exists, no role, but org already exists:** dead-end state
  (shouldn't occur normally, since teachers get a role at creation) →
  show "Ask your administrator for access" and a sign-out.
- **Admin tries to create a teacher with an email that already exists:**
  `auth.admin.createUser` errors on duplicate → surface a clear message.
- **Teacher forgets password:** admin uses `resetTeacherPassword`.
- **First-run race** (two people signing up at once): already guarded by
  `enforce_single_admin` — the loser gets the friendly "org already
  exists" error.

## Verification

No unit-test harness exists in this repo; verification follows the
project's established approach:

- `npx tsc --noEmit` and `npm run build` clean.
- Local Supabase (`supabase start`) + browser smoke tests:
  1. First-run: signup wizard → org created → admin lands on dashboard.
  2. After org exists: `/auth` shows sign-in only; signup affordance gone.
  3. Admin creates a teacher login → temp password shown once.
  4. Teacher signs in → forced to `/app/set-password` → sets password →
     reaches dashboard; flag cleared.
  5. Admin resets a teacher's password → teacher forced to change again.
  6. Old invite routes (`/app/invite/...`, `/welcome`) 404.

(If unit tests are wanted later, adding a Vitest harness is a separate
piece of work.)
