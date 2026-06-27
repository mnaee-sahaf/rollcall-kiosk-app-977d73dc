## Full Admin / Teacher / Student Experience

Build out the remaining MVP surfaces on top of the existing schema. Students stay login-free (printed QR cards only); class-QR-scanned-by-students is deferred to V2.

---

### 1. Schema additions (one migration)

- `attendance_events`: add `note text null` (reason for absent/late).
- `school_settings` (singleton row): `school_name`, `logo_url`, `day_cutoff_time` (e.g. 09:00 = late after), `absent_after_time` (e.g. 10:30 = absent if no scan), `timezone`.
- `students`: add `external_id` uniqueness per class (already exists as column — add unique index).
- Storage bucket `school-assets` (public) for logo uploads.
- Grants + RLS: settings readable by any authenticated user, writable only by admin.

### 2. Admin experience

- **`/app/admin/settings`** — school name, logo upload, day cutoff & absent-after times, timezone. Logo appears on printable QR sheets and kiosk header.
- **`/app/admin/classes`** — school-wide class list with teacher column, create/edit/delete/reassign teacher.
- **`/app/admin/students`** — searchable, paginated all-students table with class filter; edit/move/deactivate.
- **Bulk CSV import** (`/app/admin/import`):
  - Teachers CSV (email, full_name) → creates `teacher_invites` rows in batch.
  - Students CSV (class_name, full_name, external_id) → upserts students, auto-creates classes if missing; downloadable error report row-by-row.
- **`/app/reports`** for admin gains: teacher filter, per-teacher comparison bar chart, chronic-absentee table (≥3 absences in range, configurable).

### 3. Teacher experience (additions to existing pages)

- **Class detail (`/app/classes/$classId`)** roster table:
  - "Mark all present" button → bulk upsert today's events; then toggle individual exceptions.
  - Per-row Present / Late / Absent buttons + "note" popover (saves `note`).
  - Date picker to backfill/correct prior days.
- **Student drawer** from roster row: attendance history (last 30 days strip + table), Re-issue QR, Export CSV/PDF for that student.
- **Class export**: roster CSV and attendance CSV for selected date range from class detail.
- Kiosk session card already exists — add "Copy link", "Show QR" (so a tablet can scan to open), and "Revoke" actions visible while active.

### 4. Student experience (no login)

Since students don't sign in, their "experience" is the kiosk + printed card:

- **Printable QR card sheet** (`/app/classes/$classId/qr`) — already scaffolded. Polish: school logo, class name, student name, external ID, QR, cut guides; A4 4×2 grid; "Print" button.
- **Kiosk scan feedback** (`/kiosk/$token`) — big success state with student name, photo placeholder, time, "X / Y present" counter; clear error states for unknown QR, wrong class, already-marked-today, expired session.
- **Public student lookup** (`/lookup/$qrToken`) — read-only page a parent/student can open by scanning their own card with a phone camera: shows student name, class, today's status, and last 14 days. Implemented as a server fn with a publishable-key read against narrow `TO anon` policy on a SQL view that exposes only the safe columns.

### 5. Reports & analytics

- Date-range presets (today, this week, this month, custom), granularity (daily/weekly/monthly).
- Attendance rate line chart, per-class bar chart, chronic absentees table.
- CSV export of the underlying filtered rows.
- Admin sees school-wide + per-teacher slice; teacher sees only their classes.

### 6. Technical notes

- New server fns in `src/lib/`: `settings.functions.ts`, `import.functions.ts` (CSV parsed client-side, rows sent in batches of 100), extend `attendance.functions.ts` with `bulkMarkPresent`, `markWithNote`, `getStudentHistory`, `studentLookupPublic` (no auth).
- Use `papaparse` for CSV parse/stringify (client + server).
- Use `jspdf` + `qrcode` for per-student PDF export; printable sheet stays HTML-print.
- Storage upload via existing `supabase.storage` client; signed-in admin uploads to `school-assets/logo.<ext>` with overwrite.
- All new tables/columns get explicit GRANTs; settings policy uses `has_role(auth.uid(),'admin')`; student lookup view has `GRANT SELECT TO anon` with policy filtering to active students only.
- Sidebar: split into Admin section (Settings, Teachers, All classes, All students, Import) vs Teacher section (My classes, Reports). Both see Dashboard + Reports.

### Build order

1. Migration (settings table, note column, storage bucket, public lookup view + policy).
2. School settings page + logo upload, wire into kiosk + QR sheet header.
3. Teacher roster upgrades: bulk mark, notes, date picker, student drawer + history + per-student export.
4. Admin all-classes / all-students management pages.
5. CSV bulk import (teachers + students) with error report.
6. Reports upgrades: teacher filter, per-teacher chart, chronic absentees, CSV export.
7. Public `/lookup/$qrToken` page.
8. Kiosk polish: success/error states, logo, counter, recent scans styling.

### Out of scope (V2)

- Student login + companion app
- Rotating class QR scanned from student phones
- Parent notifications (SMS/email)
- Multi-teacher per class
