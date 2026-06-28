
# Student QR — distribution, lifecycle & scope

Confirming the model based on your answers:
- **One personal QR per student**, tied to their student ID (already in place).
- **Scope at MVP**: classroom kiosks only. Same QR is reusable later for gate/event/bus scans — we just won't ship those contexts yet.
- **No anti-spoofing extras** for MVP (kiosk is supervised). We'll still display the student's name + photo on scan so the teacher can eyeball it.
- **Teacher (and admin) can revoke + reissue** a QR.

## What we'll build

### 1. Distribution — four ways to get a QR into a student's hands

**A. Printable ID cards (PDF)** — already exists, polish only
- Single-student print + multi-student batch print (already there)
- Add a "card style" toggle: full ID card (name, photo, school logo, QR, parent-lookup mini-QR) vs. compact (QR + name only)

**B. Bulk sticker sheets (new)**
- New "Print stickers" action on Students page and class roster
- Avery-style multi-up layouts: **30-up (Avery 5160)**, **20-up**, **10-up**
- Choose: whole school / a class / selected students
- Output: a single paginated PDF via `jspdf` + `jspdf-autotable`
- Each sticker: QR + student name + class (no photo, to fit)

**C. Email / SMS to parents (new)**
- Add `guardian_email` and `guardian_phone` to `students` (nullable)
- "Send QR to parents" bulk action → server function:
  - Generates a per-student PDF in memory (existing util)
  - Emails parent with PDF attached + a `/lookup/:token` link
- Email transport: scaffold transactional email (Resend via existing email infra). SMS deferred unless you've got a provider in mind — we'd add a stub now and wire later.
- Track `qr_last_sent_at` per student so admins can see who's been notified.

**D. Apple / Google Wallet passes (new, behind a feature flag)**
- Add "Add to Apple Wallet" / "Save to Google Wallet" buttons on the parent lookup page `/lookup/:token`
- Apple: server function that builds a `.pkpass` (requires Apple Pass Type ID cert + team ID — we'll ask you to upload these as secrets when you're ready)
- Google: server function that creates a Wallet object via Google Wallet API (needs service account JSON)
- Ship the UI + server scaffolding now; mark the feature **disabled until certs are provided** so the rest of the MVP isn't blocked

### 2. Lifecycle — revoke & reissue

- Teachers can revoke a QR for any student in **their classes**; admins can revoke any.
- "Revoke & reissue" action:
  - Marks old token revoked (new column `revoked_at` on `students` or a `student_qr_tokens` history table — see Technical)
  - Generates a new 24-char token
  - Old QR scans return a clear "This QR has been replaced — please print a new one" message at the kiosk
  - Audit row written (who, when, why — optional reason text)
- "QR history" drawer per student showing every reissue
- Bulk reissue (e.g. start of a new school year) — admin only

### 3. UX touch-ups on the kiosk

- On successful scan: show student photo + name for 1.5s so supervisor can verify
- On revoked QR: red flash + "Card replaced — see teacher"
- On unknown QR: amber flash + "Not recognized"

## Technical notes

**Schema changes**
- `students`: add `guardian_email text`, `guardian_phone text`, `photo_url text`, `qr_last_sent_at timestamptz`
- New table `student_qr_tokens` (history of all tokens; current = latest `revoked_at IS NULL`):
  - `id`, `student_id`, `token` (unique), `issued_at`, `issued_by`, `revoked_at`, `revoked_by`, `reason`
- Migrate current `students.qr_token` into the history table; `students.qr_token` becomes a generated/cached reference to the active token (or we keep it as-is and just join — TBD during build)
- RLS: teachers can write history rows only for students in classes they own; admins unrestricted
- GRANTs to `authenticated` + `service_role` per the standard pattern

**Server functions** (`createServerFn`, under `src/lib/`)
- `revokeAndReissueStudentQr({ studentId, reason? })`
- `sendQrToGuardians({ studentIds })` — uses scaffolded transactional email
- `generateStickerSheet({ scope, layout })` — returns PDF bytes
- `issueApplePass({ studentId })` / `issueGoogleWalletPass({ studentId })` — behind feature flag

**Storage**
- Reuse `school-assets` bucket for student photos (`students/<id>.jpg`) with RLS scoped to school members

**Frontend**
- `src/routes/_authenticated/app.students.tsx`: add "Print stickers", "Email parents", "Reissue QR" actions
- `src/routes/_authenticated/app.classes.$classId.tsx`: same bulk actions scoped to class
- `src/components/students/QrHistoryDrawer.tsx` (new)
- Kiosk page: handle `revoked` response state

**Email infra**
- Will call `email_domain--get_project_custom_domain` and `setup_email_infra` + `scaffold_transactional_email` during build
- One template: "Your child's RollCall attendance QR" with PDF attachment + lookup link

**Out of scope for this round** (call them out so we don't scope-creep):
- Gate kiosk, event mode, bus boarding
- Rotating QR in companion app
- PIN verification
- SMS delivery (UI hook only, no provider wired)

## Order of work

1. Schema migration + token history table + RLS/GRANTs
2. Revoke/reissue server fn + UI + kiosk "revoked" handling
3. Sticker sheet PDF generator + UI entry points
4. Email infra scaffold + "Send QR to parents" flow
5. Wallet pass scaffolding (feature-flagged off until certs)
6. Polish: kiosk verify-flash, QR history drawer

Sound right? Anything to add, drop, or reprioritize before I start?
