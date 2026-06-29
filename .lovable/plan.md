
## 1. Waitlist data capture

**Database** (one migration):
- `public.waitlist_signups`: `id uuid pk`, `email citext not null`, `school text`, `source text default 'landing'`, `user_agent text`, `created_at timestamptz default now()`, unique index on `lower(email)`.
- Grants: `INSERT TO anon, authenticated`; `SELECT, DELETE TO authenticated` (admins gated by RLS); `ALL TO service_role`.
- RLS: enabled. Policies:
  - `INSERT` for `anon` and `authenticated` (with check `true`) — public waitlist.
  - `SELECT` / `DELETE` only when `public.has_role(auth.uid(), 'admin')`.

**Server function** (`src/lib/waitlist.functions.ts`):
- `joinWaitlist` — public `createServerFn` (no auth middleware). Zod-validates `{ email, school? }` (email max 255, school max 200, trimmed). Uses the server publishable client to insert; on unique-violation returns `{ ok: true, already: true }` instead of an error.
- `listWaitlist` — `requireSupabaseAuth` + admin role check; returns rows ordered by `created_at desc`.
- `deleteWaitlistEntry` — admin-only.

**Frontend**:
- Update `src/components/landing/WaitlistCTA.tsx` to call `joinWaitlist` via `useServerFn`, keep optimistic success UI, drop localStorage write, surface error toasts.
- New route `src/routes/_authenticated/app.waitlist.tsx` (admin-only — render "Forbidden" if not admin):
  - Table of signups (email, school, source, created_at).
  - Search/filter input, count badge.
  - "Export CSV" button (client-side CSV from loaded rows).
  - Delete row action.
- Add a "Waitlist" link to `AppShell` sidebar (admin-only section).

## 2. Functional /demo (interactive prototype)

Keep `/demo` as a no-auth, no-DB page; convert the static widgets to interactive client state. All data lives in a `useDemoState` hook seeded from an in-file fixtures module.

**New files**:
- `src/lib/demoData.ts` — seed: 5 classes, ~30 students, 20 days of attendance, today's session list with realistic statuses; pure functions to recompute aggregates from the in-memory roster.
- `src/components/demo/DemoToolbar.tsx` — date range selector (Today / 7d / 20d), grade filter, class filter, "Reset demo" button.
- `src/components/demo/SimulateScanDialog.tsx` — pick a class + student, click "Scan QR" → flips that student's status to Present, updates today's counts, the donut, the stat cards, and the session row progress.
- `src/components/demo/StudentDrillDown.tsx` — clicking an "Alert row" or a session opens a sheet listing students with status pills you can toggle (Present / Late / Excused / Absent).

**Wiring in `src/routes/demo.tsx`**:
- Move sidebar items to be clickable; clicking switches the right pane between four mini-views (still client-state only):
  1. Dashboard (existing widgets, now reactive).
  2. Sessions — list with "Open kiosk" button that launches `SimulateScanDialog` bound to that session.
  3. Reports — table + bar chart of attendance % per class for the selected range; CSV download of the filtered view.
  4. Students — searchable roster with drill-down.
- Top-right: "Simulate scan" primary button (opens dialog from anywhere), "Reset demo" ghost button, and the existing "Back to site" link.
- Persistent banner: "Demo mode — changes are local to your browser and reset on refresh."

**Acceptance**:
- Simulating a scan visibly updates the donut %, "Checked in today", and the matching session's progress bar.
- Changing date range / filter recomputes the line chart and stat cards.
- Reports view exports a CSV reflecting current filters.
- Sidebar navigation switches panes without route changes (keeps a single `/demo` URL for sharing).
- No network calls, no auth, no writes to Supabase.

## Out of scope
- Email notifications on waitlist signup.
- Seeded multi-tenant demo org / real auth-backed demo.
- Rate-limiting on the public `joinWaitlist` endpoint (note: unique-email index prevents duplicate spam from a single address; we can add a captcha/turnstile later if abuse appears).
