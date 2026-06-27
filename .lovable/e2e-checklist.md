# RollCall E2E Test Checklist — QR Scan → Attendance → Report

Goal: verify that a student QR scanned at a class kiosk creates the right `attendance_events` row and shows up correctly in the report.

## 0. Prerequisites
- [ ] Fresh signup → first user is auto-assigned **admin** role.
- [ ] Logged in at `/app` (no "No role assigned" banner).
- [ ] Browser has camera permission and the kiosk URL is opened over **https://** or `localhost` (the kiosk shows an amber HTTPS warning otherwise).

## 1. Seed data (Admin)
- [ ] Create a teacher (Teachers → invite, then accept invite OR create directly).
- [ ] Create a class `Test-7A`, assigned to that teacher.
- [ ] Add ≥3 students (e.g. Alice, Bob, Carol) — each gets a `qr_token` automatically.
- [ ] Open **Print QR sheet** → confirm each card shows the big kiosk QR and small parent-lookup QR.

## 2. Start a kiosk session (Teacher or Admin)
- [ ] On the class page, create a kiosk session with duration **2h**.
- [ ] Copy the kiosk URL and open it in a second tab/device.
- [ ] Kiosk header shows school logo/name (if set) and `Test-7A`.
- [ ] Counter shows `0/<N> present`.

## 3. Scan flow
- [ ] Click **Start camera** → live camera preview appears, no console errors.
- [ ] Present Alice's QR → green flash overlay with name "Alice" + "Marked present".
- [ ] Recent-scans sidebar prepends Alice (green).
- [ ] Counter increments to `1/<N>`.
- [ ] Re-present Alice's QR within a few seconds → debounced, no duplicate row.
- [ ] Wait >3s, scan Alice again → flash says **"Already marked"** (idempotent), still one row.
- [ ] Scan Bob → green flash, counter `2/<N>`.
- [ ] Scan an unknown/garbage QR → red flash with error, no row inserted.
- [ ] Revoke the session from the class page → kiosk shows "Kiosk session was ended" on next poll.

## 4. Database assertions (Backend → SQL)
Run for today's date (`current_date`):
- [ ] `select student_id, status, method, marked_by from attendance_events where class_id = '<id>' and day = current_date;`
  - Exactly one row per scanned student.
  - `status = 'present'`, `method = 'kiosk'` (or whatever `recordKioskScan` writes), `marked_by` = kiosk session owner.
- [ ] No row for unscanned student Carol.

## 5. Roster view (Teacher)
- [ ] `/app/classes/$classId` for today: Alice and Bob show **Present**, Carol shows unmarked.
- [ ] Editing Carol's **note** without changing status does NOT flip her to Present (regression guard).
- [ ] Open Alice's history drawer → today's row shows present, method kiosk.

## 6. Reports (`/app/reports`)
With date range covering today:
- [ ] **Daily** view: today's bar/line shows `present = 2`, `total = 2` scanned events (or includes Carol as absent only if she was marked absent — confirm against current report semantics).
- [ ] Class rollup row for `Test-7A` shows the expected attendance rate.
- [ ] Filter by teacher = the assigned teacher → same numbers.
- [ ] Filter by class = `Test-7A` → same numbers.
- [ ] Change range to **weekly** and **monthly** → today's events still included; older days aggregate correctly.
- [ ] **CSV export** downloads; opens with header row + one row per (student, day) including notes and method.
- [ ] Chronic-absentee list does NOT include Alice/Bob; appears only for students with ≥3 absent rows in range.

## 7. Parent self-lookup
- [ ] Scan Alice's small lookup QR with a phone → `/lookup/<qrToken>` loads without auth and shows today's "Present" entry.

## 8. Negative / auth checks
- [ ] Sign out → `/app/reports` redirects to `/auth`.
- [ ] Logged-in teacher cannot see another teacher's class in the class list.
- [ ] Direct GET to a revoked/expired kiosk token shows the "Kiosk unavailable" screen.

## Pass criteria
All boxes above checked, no console errors during scan flow, and DB row count for the day equals the number of unique successful scans.
