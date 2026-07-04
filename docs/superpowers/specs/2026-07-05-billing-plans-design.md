# Design: Billing & plans (Phase 4)

**Status:** Approved design, ready for implementation
**Date:** 2026-07-05

## Context

Phase 4 of the multi-tenant SaaS build. Chosen approach: **tiered plans with
payments deferred** — build the plan model, feature gating by plan limits, and a
billing page with a **stubbed** upgrade. No real payment provider yet; a
provider (Stripe/MoR) can be wired later behind the same `plan` state.

## Plans

Two tiers to start (easily extended). Limits live in one config object
(`src/lib/plans.ts`) so they're trivial to tune:

- **Free** (default): up to **2 classes**, **50 students**, **3 staff**
  (owner + 2), **no bulk import**.
- **Pro**: unlimited classes/students/staff, bulk import enabled.

`PLAN_LIMITS` shape: `{ free: { classes, students, staff, bulkImport }, pro: {...} }`
where numeric limits use `Infinity` for unlimited.

## Data model

- `organizations.plan text not null default 'free'` (values `'free' | 'pro'`).
  (Payment/subscription fields like `stripe_customer_id` are **not** added now —
  deferred with payments.)

## Gating (server-enforced)

A shared helper `assertWithinPlan(admin, orgId, resource)` (in `plans.ts` or
`org-context`) reads the org's `plan` + current count and throws a clear
"Upgrade to Pro to add more <resource>" error when the Free limit is hit.
Applied in:
- `createClass` / `importStudents` (class creation) → class limit.
- `addStudent` / `bulkAddStudents` / `importStudents` → student limit.
- `createStaffAccount` → staff limit.
- `importStudents` (bulk) → also blocked entirely on Free (`bulkImport`).

Pro (all limits `Infinity`) passes every check. Enforcement is server-side;
the UI also surfaces limits.

## getMyContext

Add `plan` and `usage` (`{ classes, students, staff }` counts for the active
org) so the dashboard/billing page can show usage vs limits.

## UI

- **Billing page** (`/app/billing`, owner/admin; owner-only to change plan):
  current plan, a usage-vs-limit table (classes/students/staff, bulk import),
  and an **"Upgrade to Pro"** button. Since payments are deferred, the button
  opens a "Payments are coming soon" notice (stub) — **plus** a clearly-labeled
  dev/manual toggle is out of scope; upgrades happen later via the provider.
  (For local testing, plan can be flipped directly in the DB.)
- **Nav**: add "Billing" to the Admin section (owner/admin).
- Optional: when a create action is blocked by the limit, the toast points to
  `/app/billing`.

## Security

- Plan checks are server-side in every gated fn (never trust the client).
- Only the owner can change plan (once payments exist); for now the plan column
  is not user-writable via app UI (no self-serve upgrade until payments).

## Deferred

Real payment integration (checkout, webhooks, subscription lifecycle, proration,
`stripe_customer_id`) — a later effort once a provider + keys are chosen.

## Verification

`tsc`/`build` + local smoke:
1. A Free org hits the class limit → createClass past the limit throws
   "Upgrade to Pro…"; same for students and staff; bulk import blocked on Free.
2. Flipping the org's `plan` to `pro` (DB) removes the limits.
3. Billing page shows current plan + usage vs limits; upgrade button shows the
   "coming soon" stub.
4. Phases 1–3 behavior unchanged.
