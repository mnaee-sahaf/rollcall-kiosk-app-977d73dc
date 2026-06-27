# Admin onboarding wizard

A guided, step-by-step setup that takes a brand-new account owner from empty dashboard → fully usable RollCall in ~3 minutes. Triggered automatically on the first admin's first visit to `/app`, and resumable from a card on the dashboard.

## Trigger logic

- Add an `onboarded_at timestamptz` column to `school_settings` (singleton row).
- `getMyContext` returns `needsOnboarding: boolean` = `isAdmin && onboarded_at is null`.
- On `/app`, if `needsOnboarding`, redirect to `/app/onboarding`. Wizard can be skipped (sets `onboarded_at`), but a "Finish setup" card stays on the dashboard until every step has real data (≥1 class, ≥1 student).

## Wizard route: `/app/onboarding`

Single full-screen route under `_authenticated/`, with a left rail showing 5 numbered steps, current step highlighted, completed steps with a checkmark. "Skip for now" link in the top-right writes `onboarded_at = now()` and returns to `/app`.

### Step 1 — School profile
- Inputs: School name (required), logo upload (optional, goes to existing `school-assets` bucket), timezone, day cutoff time, absent-after time (sensible defaults pre-filled).
- Saves via existing `updateSettings`.
- "Continue" enabled once school name is set.

### Step 2 — Invite teachers (optional)
- Repeatable "add row" form: email + optional name.
- Bulk-creates invites via existing `inviteTeacher` (looped) and shows each generated invite link with copy button (mail delivery isn't wired yet — admin copies and shares).
- "Skip" allowed; admin can stay sole user.

### Step 3 — Create your first class
- Inputs: class name (required), grade (optional), teacher (dropdown: yourself + invited teachers; defaults to self).
- Uses existing `createClass`. Stores returned `classId` in wizard state for steps 4–5.
- Option to add another class inline before moving on.

### Step 4 — Add students
- Two tabs:
  - **Quick add**: textarea, one student name per line (optional `, externalId`). Parses on submit, bulk-inserts via a new `bulkAddStudents` server fn.
  - **CSV import**: re-uses the existing `/app/import` flow embedded as a section (drag-drop + preview), defaulting to the class created in step 3.
- Shows running count: "12 students added".
- "Continue" enabled once ≥1 student exists for the class.

### Step 5 — Try it
Two side-by-side cards:
- **Print QR sheet** — direct link to `/app/classes/$classId/qr` in a new tab.
- **Open a kiosk** — creates a 2-hour kiosk session via existing `createKioskSession` and opens `/kiosk/$token` in a new tab.

Finish button writes `onboarded_at = now()` and navigates to `/app` with a success toast.

## Dashboard changes

- If admin has skipped or partly completed onboarding, show a top "Finish setting up RollCall" card listing remaining steps as checkboxes, with a "Resume" button that deep-links into the wizard at the first incomplete step (`?step=N`).
- Card disappears once all real-data conditions are met (school name set, ≥1 class, ≥1 student).

## Backend changes

1. **Migration**: add `onboarded_at timestamptz` to `public.school_settings`.
2. **`getMyContext`**: include `needsOnboarding` and a small `setupProgress` object `{ hasSchoolName, hasTeachers, hasClasses, hasStudents, onboardedAt }` so the dashboard card can render without extra round-trips.
3. **`completeOnboarding` server fn** (admin-only): sets `onboarded_at = now()`.
4. **`bulkAddStudents` server fn** (admin/teacher who owns the class): `{ classId, names: Array<{ full_name, external_id? }> }`, returns created rows. Reuses existing student-insert logic.

## Files to add / change

- `supabase/migrations/<ts>_onboarded_at.sql` — add column.
- `src/lib/auth.functions.ts` — extend `getMyContext`, add `completeOnboarding`.
- `src/lib/classes.functions.ts` — add `bulkAddStudents`.
- `src/routes/_authenticated/app.onboarding.tsx` — new wizard route, contains all 5 steps as in-page components driven by `?step=` search param.
- `src/components/onboarding/` — `WizardShell.tsx` (rail + progress), `StepSchool.tsx`, `StepTeachers.tsx`, `StepClass.tsx`, `StepStudents.tsx`, `StepTry.tsx`.
- `src/components/app/SetupChecklistCard.tsx` — dashboard card.
- `src/routes/_authenticated/app.index.tsx` — render checklist card when `setupProgress` is incomplete; redirect to wizard on first admin visit.
- `src/routes/_authenticated/app.tsx` (or shell) — no change needed beyond letting the wizard render full-bleed.

## Non-goals (explicit)

- No email sending for teacher invites (still copy-link). Hook into transactional email later.
- No payment / plan selection step.
- No re-running the wizard for non-admin users; teachers see the normal dashboard.

## Open questions

1. Should "Skip for now" be allowed at every step, or only after the school profile is filled?
2. Do you want the wizard to also seed a couple of demo students so the admin can immediately try a kiosk scan even before importing real data?
