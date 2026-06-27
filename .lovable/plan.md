## End-to-end audit — findings and fixes

Gaps grouped by area. Each item is small and lands in this single pass.

### 1. Auth & onboarding
- **Email confirmation may be ON** — new sign-ups would not get a session, so the first-admin trigger flow appears to "do nothing". Disable email confirmation via `configure_auth` so sign-up = signed-in for MVP.
- **`/auth` hydration mismatch** (visible in runtime errors). Mark the route `ssr: false` so the "already signed in" banner doesn't differ between server and client paint.
- **No role assigned screen** is a dead end. Add: "Signed in as <email>. Sign out" + "Contact your admin" copy, and a sign-out button.
- **Invite acceptance for existing users**: if an admin invites an email that already has an account, the current flow forces re-signup. Add a small `/app/invite/$token` accept route that, when signed in and the invite email matches, grants the teacher role via a new `acceptInvite` server fn (admin-bypassing via `supabaseAdmin`, validating token + email + expiry).

### 2. Admin → teacher assignment
- **`createClass` / `updateClass` UI** has no teacher selector for admins. Add a teacher `<select>` (populated from `listTeachers`) on:
  - "New class" form in `/app/classes` (admin only).
  - Class settings sheet in `/app/classes/$classId` (admin only) to reassign teacher.
- **Authorization gap**: `listClassesWithMeta` is callable by any signed-in user and leaks teacher names via `supabaseAdmin`. Gate it to admin (same pattern as `listTeachers`).

### 3. Roster editing bug (teacher view)
- In `app.classes.$classId.tsx` the **note editor's Save** calls `handleMark(s.id, s.status ?? "present", note)` — if the student has no status yet, saving a note silently marks them **present**. Change to: if `s.status` is null, persist as `absent` (or whatever the current default rule is), or better, split "save note only" from "mark + note". Implementation: add a `setNote` path that updates note on the existing event or inserts with `status = s.status ?? 'absent'` only after confirming; safer is to require a status before allowing a note (disable note input until a status is set, with tooltip).

### 4. Mobile navigation
- `AppShell` sidebar is `hidden md:flex`. On phones there is no nav at all. Add a sticky top bar visible `< md` with the logo and a `Sheet`-based drawer containing the same links + sign-out.

### 5. Kiosk polish
- `getKioskBoard` should also return `school_settings` (name + logo) so the kiosk header brands per-school. Render logo + school name in the kiosk top bar.
- "Start camera" requires HTTPS in production — add a hint message on http origins so teachers know why the camera button fails.
- Show a large transient toast on each scan (full-screen flash green/red for ~1s) for kiosk visibility from a distance; the side list stays as the log.

### 6. Public student lookup
- The printed QR currently encodes only the raw `qr_token`, so a parent scanning with a phone camera gets a meaningless string instead of opening `/lookup/<token>`. Add a **second small QR** on the printable card encoding the full `${origin}/lookup/<qr_token>` URL labelled "Parent lookup", while keeping the existing kiosk QR. (Origin is captured at print time from `window.location.origin`.)

### 7. Storage policies for `school-assets`
- The bucket is private and there are no storage RLS policies in the schema dump, so admin logo upload will 403. Add policies on `storage.objects`:
  - `SELECT`/`INSERT`/`UPDATE`/`DELETE` on `bucket_id = 'school-assets'` to `authenticated` where `has_role(auth.uid(),'admin')`.
  - Public `SELECT` on `bucket_id = 'school-assets'` for `anon` so signed-URL fallback / printable sheet / kiosk can load the logo even if the URL is treated as public (or keep private and only use signed URLs — pick one; plan picks public-read since logos are not sensitive, which lets us drop the signed-URL fragility).
- Switch logo storage in `app.settings.tsx` to use `getPublicUrl` instead of `createSignedUrl` once the bucket is public-read.

### 8. Reports & exports
- Reports class dropdown for admin should list all classes; it already does via `listClasses` + admin RLS. Verify no extra change needed.
- Add a "Today" / "This week" / "This month" preset row above the date inputs for one-click ranges.
- Export CSV currently exports the chart series only; also include the chronic-absentees table as a second downloadable.

### 9. Misc
- Landing nav: ensure "Try the demo" route works and "Sign in" / "Create account" point to `/auth` with the right mode (already in place — verify).
- Add a small "Kiosk" link in the class detail page's session card pointing to the active kiosk URL (already present as "Open kiosk").
- Add a 404 boundary on `/lookup/$qrToken` and `/kiosk/$token` (currently they render a custom not-found inline, which is fine — leave).

---

## Technical notes

- **Files touched**:
  - `src/lib/auth.functions.ts` — add `acceptInvite`.
  - `src/lib/classes.functions.ts` — admin gate on `listClassesWithMeta`; accept `teacherId` in `createClass` form path (already supported, just expose in UI).
  - `src/lib/kiosk.functions.ts` — include settings in `getKioskBoard`.
  - `src/lib/attendance.functions.ts` — add `setStudentNote` (note-only update) so the UI doesn't have to fabricate a status.
  - `src/routes/_authenticated/app.tsx` — improve "no role" empty state.
  - `src/routes/_authenticated/app.classes.tsx` — teacher selector for admin.
  - `src/routes/_authenticated/app.classes.$classId.tsx` — teacher reassignment in settings sheet; fix note-save bug; use `setStudentNote`.
  - `src/routes/_authenticated/app.classes.$classId.qr.tsx` — second QR for parent lookup URL.
  - `src/routes/_authenticated/app.settings.tsx` — switch to public URL for logo.
  - `src/routes/auth.tsx` — `ssr: false`.
  - `src/routes/kiosk.$token.tsx` — branded header, scan flash, HTTPS hint.
  - `src/routes/_authenticated/app.invite.$token.tsx` — new accept page.
  - `src/components/app/AppShell.tsx` — mobile top bar + Sheet drawer.
- **Migrations** (single migration):
  1. Storage policies on `storage.objects` for `school-assets` bucket (admin write, public read), and `UPDATE public.storage.buckets SET public=true WHERE id='school-assets'`.
- **Auth config**: call `configure_auth` to disable email confirmation.
- No schema changes to app tables; no RLS changes — existing admin-aware policies already cover the new flows.

---

## Build order

1. Migration + bucket policy + `configure_auth` (disable email confirm).
2. Server-fn additions (`acceptInvite`, `setStudentNote`, admin gate, kiosk board with settings).
3. UI fixes: AppShell mobile nav, auth ssr false, no-role state, note-save bug.
4. Admin teacher assignment in class create/edit.
5. Kiosk header branding + scan flash.
6. Printable sheet second QR for parent lookup.
7. Invite accept page.
8. Reports presets + chronic CSV.

All changes verified against existing RLS (admin path covered everywhere) and the existing bearer middleware in `src/start.ts`.
