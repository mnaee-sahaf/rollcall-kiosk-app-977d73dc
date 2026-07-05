# RollCall Architecture Re-platform — Design Spec

**Status:** Approved (design) — pending spec review
**Date:** 2026-07-05
**Supersedes/extends:** builds on the multi-tenant foundation (Phases 1–4 already shipped)

## 1. Context & drivers

RollCall is a multi-tenant, QR-based school attendance SaaS. Today it is a **fused full-stack app**: TanStack Start (Nitro) on Vercel, with `createServerFn` RPC as the only "API", talking to Supabase (Postgres + Auth + Storage). Nine `src/lib/*.functions.ts` modules are the entire backend surface. Tenant isolation is enforced per-function in application code (service-role client bypasses RLS; RLS is a backstop).

The owner wants to re-architect for two stated drivers:
- **Clean boundaries / maintainability** — well-separated, testable modules with explicit interfaces.
- **Scale-readiness** — an architecture that won't require a painful rewrite if growth comes. Scale target is *unknown* ("just want it ready").

**Guiding principle:** "ready for scale" ≠ "microservices now." We build a **modular monolith with extraction-ready seams** so a future service split is a mechanical lift, not a rewrite. We pay for boundaries now and buy the *option* to distribute later.

## 2. Decisions (with rationale)

| Area | Decision | Rationale |
|---|---|---|
| Backend topology | **Modular monolith** (one deployable) exposed as an **API server** | Delivers clean boundaries + scale-readiness without the ops tax of true microservices at unknown/early scale. |
| API boundary | **REST + OpenAPI**, via **Hono + `@hono/zod-openapi`** | Spec is generated from Zod route schemas → cannot drift from code; language-agnostic contract for future mobile/3rd-party. |
| Frontend | **True SPA**: Vite + React 19 + **React Router (data router)** + **TanStack Query** | Hard FE/BE separation the owner wants; component-based; SPA feel under `/app`. |
| Auth | **Bearer JWT** from Supabase (`@supabase/supabase-js` in browser) | Stateless API; standard SPA↔API pattern. Replaces SSR cookie/`beforeLoad`. |
| Type safety | `@hono/zod-openapi` (server) → `openapi-typescript` + `openapi-fetch` (client) | One source of truth for FE+BE types; directly prevents another `types.ts`-style drift. |
| Repo | **Monorepo**: pnpm workspaces + Turborepo | `packages/shared` structurally prevents FE/BE contract drift; shared tooling. |
| Marketing SEO | **Prerender** public/landing routes to static HTML at build | Owner wants landing indexable + fast first-paint despite the SPA. |
| DB / tenancy | Supabase schema **unchanged**; org-scoping moved into a **repository layer** | Makes tenant isolation structural (fixes per-function leak risk); RLS remains backstop. |
| Migration | **Strangler-fig, 4 phases**; app shippable at each step | De-risks a plumbing rewrite of a working app; Phase 1 is independently valuable. |

**Non-goals:** true microservices (separate deployables / per-service DBs / messaging); changing the multi-tenant data model; payments integration (separate track); mobile app.

## 3. Target architecture

```
  Browser (SPA)                         API server (modular monolith)          Supabase
  ┌───────────────────────────┐         ┌──────────────────────────────┐       ┌──────────────┐
  │ Vite + React 19           │  HTTPS  │ Hono + @hono/zod-openapi      │ svc   │ Postgres     │
  │ React Router (data router)│  Bearer │  ├─ auth mw (verify JWT/JWKS) │ role  │ Auth (GoTrue)│
  │ TanStack Query            │ ──────▶ │  ├─ org-context mw (org+role) │ ────▶ │ Storage      │
  │ openapi-fetch (typed)     │  JWT    │  └─ domain modules            │       │ (RLS backstop)│
  │ shadcn/Tailwind UI        │         │     router → service → repo   │       └──────────────┘
  │ landing/ = prerendered    │         │     (repo = org-scoped DAL)   │
  └───────────────────────────┘         └──────────────────────────────┘
```

## 4. Backend design

**Framework:** Hono, hosted on Vercel functions (single app). `@hono/zod-openapi` defines each route from a Zod schema and emits the OpenAPI document at `/openapi.json` + Swagger UI in dev.

**Domain modules** (each a directory under `apps/api/src/modules/<name>/`):
- **identity** — auth/session resolution, memberships, roles, active-org context, org CRUD, onboarding.
- **roster** — classes + students.
- **attendance** — scan events → attendance records; reporting reads (the hot path; the first candidate for future extraction).
- **kiosk** — kiosk sessions + QR token lifecycle (issue/revoke).
- **billing** — plans, usage counters, plan gating (later: Stripe).
- **reporting** — read-only attendance projections/aggregations.

**Three layers per module, strict direction of dependency:**
1. `router.ts` — HTTP surface: Zod request/response schemas, status codes, wiring to service. No business logic.
2. `service.ts` — business rules + authorization (role checks via shared `requireRole`). Calls its own repository and *other modules' services* (never their repos/tables).
3. `repository.ts` — the **only** place that touches the DB. Every query is scoped by `org_id` through a shared helper so scoping is not per-call discipline.

**Cross-cutting middleware:**
- `auth` — verify Supabase JWT against JWKS; attach `userId`, `claims`.
- `org-context` — resolve active org + role for the user (ports today's `resolveActiveMembership`/`requireOrgRole`); attach to request context.
- error handler → RFC-7807-style JSON problem responses; request logging.

**Tenancy model:** service-role client, but all reads/writes go through repositories that enforce `org_id`. RLS policies stay as defense-in-depth for any direct-client path. This converts the current "remember to filter" risk into a structural guarantee.

## 5. Frontend design

**Stack:** Vite + React 19 + React Router (data router) + TanStack Query + existing shadcn/Tailwind components (carried over largely as-is).

**Data layer:** TanStack Query wraps the typed `openapi-fetch` client. Query keys per resource; mutations invalidate; optimistic updates for scan/roster edits. Replaces the current fetch-on-mount-into-local-state pattern.

**Auth:** `@supabase/supabase-js` in the browser owns the session (JWT). A `<RequireAuth>` guard (and role-aware `<RequireRole>`) replaces the SSR `beforeLoad`; redirects mirror today's rules (no session → `/auth`; zero memberships → `/signup`; `must_change_password` → `/set-password`). The API client attaches `Authorization: Bearer <access_token>` and handles refresh + 401.

**Routing:** React Router data router. Route groups: `public` (landing, auth, signup, student, lookup, kiosk) and `app` (authenticated, guarded). Preserve current URLs.

**Marketing SEO:** public/landing routes prerendered to static HTML at build (Vike scoped to public pages, or a prerender crawler such as vite-plugin-prerender). `/app/*` remains pure SPA.

**Type safety:** `packages/shared` exposes the generated API client + types; the SPA imports from there. No hand-maintained request/response shapes.

## 6. Repo & tooling

Monorepo via **pnpm workspaces + Turborepo**:
```
apps/
  web/     # Vite SPA (React Router, TanStack Query, shadcn)
  api/     # Hono modular monolith (zod-openapi)
packages/
  shared/  # Zod schemas, generated OpenAPI client + types, shared domain types
supabase/  # migrations (unchanged)
```
- Codegen step: `api` build emits `openapi.json` → `shared` generates the typed client → `web` consumes it.
- **CI** (GitHub Actions) on every PR to protected `main`: typecheck + build all workspaces + run the test suite (§7). `main` already requires PRs (0 approvals, enforce_admins).

## 7. Testing

The maintainability driver is only real if it is enforced by tests:
- **Tenant-isolation suite** — integration tests proving org A's JWT cannot read or write org B's classes/students/attendance/kiosk/memberships via the API. This is the security gate; there is none today.
- **Service unit tests** per module (business rules, role checks, plan gating).
- **API contract tests** — requests validated against the OpenAPI schemas.
- Minimal FE tests: auth guard + a couple of critical flows (sign-in, create class, scan).

## 8. Phased migration (strangler-fig)

Each phase leaves a working, shippable app.

- **Phase 0 — Monorepo setup.** Introduce pnpm/Turbo; move the current app into `apps/web`; create empty `apps/api` and `packages/shared`. No behavior change. *Deliverable:* everything builds and runs as before under the monorepo.
- **Phase 1 — Modularize the backend (Backend A core).** Refactor the 9 `*.functions.ts` files into domain modules with service + repository layers; centralize org-scoping in repositories. Current `createServerFn` handlers become thin wrappers over module services. *Deliverable:* same app, clean boundaries + structural tenant scoping. **Independently valuable — the "clean boundaries" driver is satisfied here.**
- **Phase 2 — Stand up the REST API.** Build `apps/api` (Hono + zod-openapi) as a *second* entry point over the same module services; emit OpenAPI; generate the client in `packages/shared`; write the tenant-isolation test suite against the API. *Deliverable:* a fully tested API; the app still runs on TanStack Start.
- **Phase 3 — Build the SPA and cut over.** Build `apps/web` as a Vite + React Router SPA against the API; port pages/components; move auth to Bearer/`<RequireAuth>`; prerender the landing page; cut over; **retire TanStack Start and the server-fn wrappers.** *Deliverable:* SPA ↔ API ↔ Supabase, TanStack Start removed.

Pause points: after any phase. If priorities shift, stopping after Phase 1 still delivers the boundaries win.

## 9. Risks & tradeoffs

- **Plumbing rewrite of a working app with no paying users yet** — weeks of infra work over features. *Mitigation:* phasing; value at Phase 1; each phase shippable.
- **Losing SSR** — landing SEO/first-paint. *Mitigation:* prerender public routes.
- **Two backends briefly** (server fns + API in Phase 2). *Mitigation:* both are thin layers over the *same* module services, so no logic is duplicated.
- **Bearer-token auth** is more moving parts than SSR cookies (refresh, 401 handling). *Mitigation:* standard Supabase JS + a single API-client interceptor.
- **Lovable interaction** — Lovable ideates on the `test/rollcall-ui-lab` branch and must not regenerate types or touch backend; the SPA rebuild (Phase 3) is where good Lovable UI gets ported in by hand.

## 10. Open questions (resolved)

- API framework → Hono + zod-openapi (approved).
- Repo → monorepo pnpm + Turbo (approved).
- Migration order → strangler-fig 4-phase (approved).

Remaining to decide at plan time: exact prerender tool (Vike vs. crawler); Vercel project layout for two apps; whether `attendance` gets extracted to its own service in a later, out-of-scope phase.
