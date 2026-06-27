
# RollCall MVP Plan

Build the real app behind the landing page: admin/teacher dashboards, student & class management, printable QR codes, a web-based kiosk scanner, and attendance reports with filters.

## Stack

- Lovable Cloud (Postgres + Auth + Storage) for persistence
- TanStack Start (current setup) for routes, server functions, and SSR
- Email/password + Google sign-in via Lovable Cloud
- `qrcode` (generate) + `html5-qrcode` (camera scan) on the client
- Existing shadcn UI + orange brand tokens

## Roles & auth

- Auth methods: email/password + Google
- Roles table: `app_role` enum (`admin`, `teacher`), `user_roles` table, `has_role()` security-definer function (per project rules — never store role on profile)
- First signup at `/auth` creates an account with no role. Admin role is bootstrapped via a one-time invite token (env-stored) — first user who redeems becomes admin.
- Admin invites teachers by email: creates a `teacher_invites` row with a signed token; teacher signs up via invite link and is granted `teacher` role on confirmation.
- Profiles table for display name + school name.

## Data model (Lovable Cloud)

- `profiles(id pk → auth.users, full_name, school_name)`
- `user_roles(user_id, role, unique(user_id, role))`
- `teacher_invites(id, email, token_hash, invited_by, accepted_at, expires_at)`
- `classes(id, name, grade, teacher_id → auth.users, created_at)` — one owner teacher per class in MVP
- `students(id, class_id → classes, full_name, external_id, qr_token unique, active)` — `qr_token` is a random opaque ID encoded in QR
- `kiosk_sessions(id, class_id, created_by, token_hash, starts_at, expires_at, revoked_at)` — backs signed kiosk links
- `attendance_events(id, student_id, class_id, kiosk_session_id nullable, marked_by nullable, method enum['kiosk','manual'], status enum['present','absent','late'], occurred_at, unique(student_id, class_id, date(occurred_at)))`

RLS:
- `profiles`: user sees own row; admin sees all
- `classes`, `students`: teacher sees their classes/students; admin sees all
- `attendance_events`: teacher sees rows for their classes; admin all; insert via server functions only
- All tables get explicit `GRANT` to `authenticated` + `service_role` per project rules

## Routes

Public:
- `/` landing (existing)
- `/demo` static demo (existing)
- `/auth` sign in / sign up / accept invite (`?invite=…`)
- `/kiosk/$token` web kiosk scanner page — validates signed session token, no login required

Authenticated (`/_authenticated/*`, integration-managed gate):
- `/app` redirect to admin or teacher home based on role
- `/app/admin` admin dashboard: stats, teachers, classes, invite teacher button
- `/app/admin/teachers` teacher list + invite form
- `/app/admin/classes` all classes
- `/app/classes` teacher: list of own classes
- `/app/classes/$classId` class detail: roster, "Start kiosk session", "Print QR sheet", manual roster marking for today
- `/app/classes/$classId/students/new` add student (generates `qr_token`)
- `/app/classes/$classId/qr` printable QR sheet (one card per student, A4 grid)
- `/app/classes/$classId/kiosk` create kiosk session (pick duration: 30m / 2h / 8h) → shows shareable link + QR to open it on a tablet
- `/app/reports` reports with filters (class, teacher, date range, granularity daily/weekly/monthly)

## QR codes for students

- Each student gets a random 24-char `qr_token` at creation
- Printable sheet renders one card per student using `qrcode` → SVG: school name, student name, external ID, QR
- Re-issue button rotates `qr_token` (invalidates old card)

## Web kiosk

- Teacher creates a kiosk session for a class with a duration; server returns `https://…/kiosk/{token}` and a QR of that URL for easy device handoff
- `/kiosk/$token` page (public route):
  - Server fn validates token (not expired, not revoked) and returns class + roster summary; otherwise shows expired screen
  - Uses `html5-qrcode` camera scanner, full-screen mobile/desktop friendly UI
  - On scan: server fn `recordKioskScan({ sessionToken, qrToken })` → looks up student, verifies student belongs to that class, inserts `attendance_event` (idempotent per student per day), returns success/fail toast with student name and big checkmark
  - Shows running counter "X / Y present" and the last 5 scans
  - "End session" requires the teacher to be signed in on another device (revoke from class page); kiosk page also auto-locks when expired

## Manual roster

- Class detail page lists today's roster with Present / Absent / Late toggles
- Each toggle calls `markAttendance` server fn (upserts today's event)

## Reports

- `/app/reports` filters: class (multi), teacher (admin only), date range, granularity (daily/weekly/monthly)
- Charts (recharts already installed): attendance rate over time, per-class comparison bar, chronic absentees table (≥3 absences in range)
- Export CSV button (client-side from query result)

## Server functions (key ones)

All under `src/lib/*.functions.ts`, using `requireSupabaseAuth` + role check via `has_role`:
- `inviteTeacher`, `acceptInvite`
- `createClass`, `addStudent`, `rotateStudentQr`
- `createKioskSession`, `revokeKioskSession`
- `recordKioskScan` (public — validates session token instead of user auth; rate-limited by token)
- `markAttendance` (teacher only)
- `getAttendanceReport(filters)` (teacher → own classes only; admin → all)

## Out of scope (MVP)

- Companion student app (waitlist landing only)
- Multi-teacher per class, co-teachers, substitutes
- SMS/email parent notifications
- Bulk CSV student import (can add quickly post-MVP if needed)
- Billing / pricing

## Build order

1. Enable Lovable Cloud + auth (email + Google) + role tables and `has_role`
2. Profiles, classes, students schema + RLS + grants
3. Admin/teacher shells under `_authenticated`, role-based redirect
4. Teacher invite flow
5. Class + student CRUD, QR generation, printable sheet
6. Kiosk session creation + `/kiosk/$token` scanner
7. Manual roster marking
8. Reports page with filters, charts, CSV export

