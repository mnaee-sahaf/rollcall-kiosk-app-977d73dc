# Design: Student portal (Phase 3)

**Status:** Approved design, ready for implementation
**Date:** 2026-07-05

## Context

Phase 3 of the multi-tenant SaaS build. Students are **view-only** and
**QR-passwordless** — no student auth accounts, no `memberships` rows, no
passwords. A student's `qr_token` gates access to a read-only portal showing
their own attendance. This reconciles the earlier "students log in" intent with
the chosen QR-passwordless mechanism: the QR is the credential; the portal is
read-only.

Builds on the existing public, token-gated `lookupStudentPublic` + the
`/lookup/$qrToken` page (currently a minimal name + 14-day snippet). The printed
QR sheet already includes a small "lookup" QR that opens `/lookup/<token>`.

## Model & security

- No schema/auth/RLS changes. Access is by `qr_token` (unique to one student in
  one org) through the existing **public** server function using the service-role
  client. Isolation is automatic — a token only ever resolves its own student's
  data.
- Read-only. No student-side mutations. The `member` enum value stays reserved.
- Low-sensitivity data only (own attendance) — acceptable for QR-as-credential.

## Server function

Expand `lookupStudentPublic({ qrToken })` (in `settings.functions.ts`) to return:
- `student`: `full_name`, `external_id`, `class_name`, `grade` (already present).
- `events`: attendance for the last **60 days** (was 14), `{ day, status }`,
  newest first.
- `stats`: `{ present, late, absent, total, rate }` over that window
  (`rate = round((present+late)/total*100)`, 0 if total 0).
- `today`: the status for today's date, or `null`.
Returns `{ found: false }` for unknown/inactive tokens (unchanged).

## UI

- **`/lookup/$qrToken`** → polished, student-facing portal:
  - Header: student name, class + grade, today's status pill.
  - Attendance-rate summary (last 60 days) with present/late/absent counts.
  - A month-style history (list or simple calendar) of recent days.
  - The student's own QR (rendered from `qr_token`) so a lost card can be
    re-displayed. "Powered by RollCall" footer (existing).
  - Clean, mobile-first (students view on phones).
- **`/student`** (new) → entry page: "Enter your student code" input → on submit
  navigate to `/lookup/<code>`. Also a short hint that scanning the card opens it
  directly. Public route.

## Deferred

Anything students *do* (not just view) would require real accounts — a separate
future decision. Not in Phase 3.

## Verification

`tsc`/`build` + local smoke:
1. `/lookup/<valid qr_token>` shows the student's name, class, today's status,
   rate, ~60-day history, and their QR.
2. `/lookup/<garbage>` shows a graceful "not found".
3. `/student` → enter a code → lands on that student's portal.
4. A token from org A never exposes org B data (inherent — token is single-org).
