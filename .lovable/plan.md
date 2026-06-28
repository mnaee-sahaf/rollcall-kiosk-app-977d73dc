# Rework org creation to match the Jibble flow

Today, account, organization, and admin role are all created in one signup form (with a trigger auto-granting admin to the first user). We will split that into a staged flow so a new user explicitly decides whether to **create a new organization** or **join an existing one**, then walks through org details, devices, and a referral question before landing on the dashboard's existing setup checklist.

## New end-to-end flow

```text
1. /auth?mode=signup
   - Just: Full name, Email, Password (no org name here)
   - Creates the auth user. No role assigned yet.

2. /welcome  (new — gating route)
   - Two cards, mirroring Jibble:
       [ Create a new organization ]   [ Join an organization ]
   - Right card lists pending invites for this email (or "no invitations yet").

3. /welcome/create  (new — multi-step wizard)
   Step 1: Organization details
     - Organization / school name (required)
     - Country, phone (optional)
     - Industry / school type, organization size, your role
   Step 2: Devices your team will use
     - Multi-select: Shared Kiosk, Web Browser, Mobile (companion app), Digital roster
   Step 3: How did you first hear about us?
     - Single-select with options + "Other"
   Submit -> creates school_settings, grants admin role, redirects to /app.

4. /app
   - Existing SetupChecklistCard takes over (school logo, teachers, classes, students).

5. Invite path (unchanged):
   /auth?invite=TOKEN -> existing acceptInvite -> /app as teacher.
```

## Files to add

- `src/routes/welcome.tsx` — two-card chooser (Create org / Join org). Shows pending invites for the signed-in email.
- `src/routes/welcome.create.tsx` — 3-step wizard (org details → devices → referral). Uses existing `Logo`, shadcn `Card`, `Input`, `Select`, `Checkbox`.
- `src/lib/organization.functions.ts` — new server functions:
  - `createOrganization({ schoolName, country, phone, industry, orgSize, role, devices[], referralSource })` — requires auth, errors if caller already has any role, fills `school_settings` (singleton update), grants `admin` role to caller.
  - `getMyJoinables()` — returns pending teacher invites matching caller's email + whether org already exists.

## Files to change

- `src/routes/auth.tsx` — signup form drops the "Organization name" field. After signup, navigate to `/welcome` instead of `/app`.
- `src/routes/create-organization.tsx` — repurpose as a thin redirect to `/welcome/create` (or delete and update Nav link) so there is one canonical creation flow.
- `src/components/landing/Nav.tsx` — "Create organization" button routes to `/auth?mode=signup` (account first), keeping parity with Jibble.
- `src/routes/_authenticated/route.tsx` — after auth check, if the user has no role AND no org exists for them, redirect to `/welcome`. Existing `needsOnboarding` redirect in `app.index.tsx` continues to handle post-creation steps.
- `src/lib/auth.functions.ts` — `getMyContext` already returns `roles`; add a `hasOrgMembership` boolean so routing logic is explicit.

## Database

One migration:
- Add columns to `public.school_settings`: `country text`, `phone text`, `industry text`, `org_size text`, `primary_role text`, `devices text[] default '{}'`, `referral_source text`.
- Update `public.handle_new_user()`: **stop auto-granting admin to the first user**. It will only create the profile row and (if `invite_token` metadata is present) accept a teacher invite. Admin role is now granted exclusively by `createOrganization`.
- Keep RLS as-is; the new columns inherit existing admin-only update policy on `school_settings`.

## UX details to mirror from Jibble

- Two-card chooser uses a clear illustration / icon per side, with primary CTA on the Create card.
- Wizard shows a step indicator ("Step 2 of 3") and a Back button on steps 2–3.
- Continue button stays disabled until the step is valid (required fields filled, at least one device selected, one referral source chosen).
- Page header shows the signed-in email with a small dropdown to sign out (so users who picked the wrong account can switch without leaving the flow).

## Out of scope

- True multi-tenant orgs. The backend remains single-organization (`school_settings` singleton). The new flow is the staged UX; it does not introduce per-user organization isolation. If you want multi-org later, that is a separate, larger refactor.
- Phone-number signup, captcha, Terms checkbox screens from the reference — not needed for the MVP.

## Technical notes

- `createOrganization` runs as `requireSupabaseAuth` and uses the user's session client to update `school_settings` and `user_roles`. To grant the admin role, it falls back to `supabaseAdmin` (loaded inside the handler) because RLS on `user_roles` blocks self-promotion.
- The wizard stores partial state in component state (no draft persistence); refresh restarts the wizard. Acceptable for MVP.
- `/welcome` and `/welcome/create` live outside `_authenticated/` but call `requireSupabaseAuth` server fns; each route does a client-side `supabase.auth.getUser()` check and redirects to `/auth` if missing, matching the existing `auth.tsx` pattern.
