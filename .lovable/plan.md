
## Goal

Rework `/app/onboarding` to feel like the reference: focused wizard with persistent progress sidebar, rich per-step content (sections, helper copy, learn-more links, time estimates), inline validation, and **no duplication of anything captured during `/welcome/create`**.

## What account creation already captured

From `welcome.create.tsx` → `school_settings`: `school_name`, `country`, `phone`, `industry`, `org_size`, `primary_role`, `devices`, `referral_source`. **Onboarding will not ask for any of these again.** Step 1 instead focuses on operational settings the wizard didn't cover.

## Layout shell

- Top bar (white, sticky): RollCall logo + "Onboarding" label; `X` close on the right → confirm dialog, then `skipAll()`.
- Soft `#f6f7f9` body, two columns:
  - **Left rail (sticky card)**: "Complete setting up your organization" heading, SVG progress ring with `%`, "N of 4 steps completed", step list (icon badge, label, "~X min", chevron, orange accent on active, check when done), "Need help?" footer link.
  - **Right content panel (white card)**: step title + "Takes about X minutes" pill, one-line description, orange "Learn more about …" link, body split into uppercase SECTION headers with `i` tooltip, sticky footer with Back / Skip / Continue.

## Steps (now 4, since account creation owns the org profile)

**Step 1 — Attendance settings** (~2 min) — *replaces the old "School profile"*
- Section `SCHOOL BRANDING`: logo upload + a read-only summary chip showing org name + country flag (so it's clear we already have this; not editable here — link "Edit in Settings").
- Section `TIMEZONE`: Select of common IANA zones, default = detected.
- Section `ATTENDANCE WINDOW`: late-after time, absent-after time, with helper text explaining how kiosk applies them.

**Step 2 — Invite teachers** (~5 min)
- Section `INVITE BY EMAIL`: multi-row email entry + "Add another", generates invite links.
- Section `SHARE LINKS`: generated links with Copy + mailto Email buttons.
- Callout: "You can add more later from Settings → Team."

**Step 3 — Create your first class** (~3 min)
- Section `CLASS DETAILS`: name*, grade, assigned teacher (Select; defaults to me).
- Section `YOUR CLASSES`: list with edit/delete and an inline "Add another class" form.

**Step 4 — Add students & try it out** (~5 min) — *merged old steps 4+5 since "try it out" is one click each*
- Section `PICK A CLASS`: class selector.
- Section `QUICK ADD`: textarea, one student per line (`Full Name[, Optional ID]`); live preview list + count.
- Section `BULK IMPORT`: link to CSV import route with a sample row.
- Section `TRY IT NOW`: "Print QR sheets" and "Launch kiosk" buttons.
- Primary CTA: `Finish setup` → `completeOnboarding` → `/app`.

## Validation (client + server)

Single zod schema per step, validated on Continue; inline `text-destructive` message under each field, red border on invalid inputs (matching reference). Continue disabled until the schema parses.

- **Step 1**: `timezone` non-empty IANA-ish string; `day_cutoff_time` and `absent_after_time` match `HH:MM` and `absent_after_time > day_cutoff_time`; logo optional (≤2MB, `image/*`, checked before upload).
- **Step 2**: each email trimmed, `z.string().email().max(255)`; dedupe within the list and against existing teachers; skip-allowed.
- **Step 3**: name trimmed, 1–80 chars; grade ≤ 20 chars; teacherId optional uuid.
- **Step 4**: at least 1 student to enable Finish (Skip still available); per-line parser caps name at 100 chars and external_id at 40 chars, trims, drops empties, rejects > 200 rows with a friendly error.

Server functions already exist; they keep their existing zod `inputValidator` (no changes needed). Errors from the server are surfaced via `toast.error` and as inline messages where field-scoped.

## Progress logic

`completedSteps` derived from data, not local state:
1. Attendance settings saved (settings has non-default `day_cutoff_time` OR explicit save flag — track via existing `onboarded_at`-adjacent state; simplest: a `settingsTouchedAt` check via `updated_at` after first save in this session, fallback to "step visited and Continue clicked").
2. `teachers.length > 0` OR step explicitly skipped (local).
3. `classes.length > 0`.
4. Any students exist.

Drives the ring %, row checks, and the right-rail step states. Any visited step is clickable.

## Files

- Rewrite `src/routes/_authenticated/app.onboarding.tsx` (single file). Helpers in-file: `ProgressRing`, `StepRow`, `SectionHeader`, `StepShell`, `useStepForm` (small zod-driven helper).
- No new routes. No DB changes. No server-fn changes.
- Reuse: `getMyContext`, `getSettings`, `updateSettings`, `inviteTeacher`, `listTeachers`, `createClass`, `listClasses`, `bulkAddStudents`, `createKioskSession`, `completeOnboarding`.

## Out of scope

- Dashboard checklist card (will auto-reflect via existing `setupProgress`).
- Invite acceptance flow.
- New `school_settings` columns.
