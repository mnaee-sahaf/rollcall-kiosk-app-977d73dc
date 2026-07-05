# Architecture Re-platform — Phase 0 & Phase 1 (Foundation + Roster) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert RollCall to a pnpm/Turbo monorepo (`apps/web`) with no behavior change, then establish the Phase 1 backend-modularization pattern (test harness + org-scoped repository layer + pure/IO separation) and prove it end-to-end by modularizing the **roster** domain (classes + students).

**Architecture:** Move the existing TanStack Start app verbatim into `apps/web` under a pnpm workspace; add `packages/shared` and an `apps/api` stub for later phases. Then introduce Vitest and refactor backend logic into layered domain modules (`repository` = only place that touches the DB, always org-scoped; `service` = business rules; pure decision helpers split out for unit testing). The existing `*.functions.ts` handlers become thin wrappers over services — the running app is unchanged, only better-bounded.

**Tech Stack:** pnpm workspaces, Turborepo, TanStack Start (unchanged in this phase), Vite 8, React 19, Supabase JS, Vitest, TypeScript 5.8, Zod 3.

## Global Constraints

- Node `v24.4.0`; package manager becomes **pnpm** (via Corepack). No npm lockfile after Phase 0.
- Do NOT change the Supabase schema, RLS, or `src/integrations/supabase/types.ts` in this plan.
- The app's user-facing behavior, routes, and URLs must be identical after Phase 0 (pure move).
- `supabase/` (migrations) stays at the **repo root**, not inside `apps/web`.
- Every repository query MUST be scoped by `org_id`; org-scoping lives only in repositories.
- Preserve the existing `@/` path alias behavior inside `apps/web`.
- Frequent commits: one per task. `main` is branch-protected — all work lands via PRs.
- Do NOT introduce the REST API, Hono, or the SPA in this plan (Phases 2–3).

---

## Phase 0 — Monorepo

### Task 1: Enable pnpm + root workspace scaffolding

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `package.json` (root, replaces current after Task 2 move)
- Modify: nothing else yet

**Interfaces:**
- Produces: workspace globs `apps/*`, `packages/*`; root scripts `dev`, `build`, `test`, `lint`, and the `db:*` scripts.

- [ ] **Step 1: Enable pnpm via Corepack**

Run:
```bash
corepack enable pnpm && corepack prepare pnpm@9 --activate && pnpm -v
```
Expected: prints a `9.x` version.

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".output/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["^build"] },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 4: Create the root `package.json`**

```json
{
  "name": "rollcall-monorepo",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "turbo run dev --filter=web",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "db:push": "supabase db push",
    "db:diff": "supabase db diff --linked -f",
    "db:types": "supabase gen types typescript --linked > apps/web/src/integrations/supabase/types.ts",
    "db:link": "supabase link --project-ref jywwgoceybjendvpbqea"
  },
  "devDependencies": {
    "turbo": "^2.3.0"
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml turbo.json package.json
git commit -m "chore(monorepo): add pnpm workspace + turbo scaffolding"
```

Note: the repo still has the old single-package layout; Task 2 moves the app and reconciles the two `package.json` files. This commit is expected to leave the tree mid-migration — that is fine because Task 2 immediately follows.

---

### Task 2: Move the app into `apps/web`

**Files:**
- Move (git mv): `src/`, `public/`, `index.html`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.*`, `postcss`/tailwind config (if present), `components.json`, `.env`, `.env.example` → `apps/web/`
- Create: `apps/web/package.json` (the old root package.json, renamed to `web`)
- Modify: `apps/web/vite.config.ts` (no path changes needed; verify), `vercel.json`

**Interfaces:**
- Produces: workspace package `web` that builds and runs exactly as before from `apps/web`.

- [ ] **Step 1: Create the app directory and move source**

Run:
```bash
mkdir -p apps/web
git mv src public index.html vite.config.ts apps/web/
git mv tsconfig.json apps/web/ 2>/dev/null; true
for f in tsconfig.app.json tsconfig.node.json eslint.config.js eslint.config.mjs components.json postcss.config.js postcss.config.cjs tailwind.config.ts tailwind.config.js .env .env.example; do
  [ -e "$f" ] && git mv "$f" apps/web/;
done
true
```
Note: `supabase/`, `docs/`, `.env.prod.backup` stay at the repo root.

- [ ] **Step 2: Turn the OLD root package.json into `apps/web/package.json`**

The pre-migration `package.json` (the one listing `@tanstack/react-start` etc.) is now the web app's manifest. Recreate it at `apps/web/package.json` with these edits: set `"name": "web"`, drop the `db:*` scripts (they moved to root), keep all deps/devDeps, and add Vitest devDeps:

```jsonc
{
  "name": "web",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "format": "prettier --write ."
  }
  // dependencies + devDependencies: copy verbatim from the previous root
  // package.json, then add to devDependencies:
  //   "vitest": "^2.1.0"
}
```

- [ ] **Step 3: Point Vercel at the app**

Replace `vercel.json` at the repo root with a monorepo-aware config:

```json
{
  "framework": "tanstack-start",
  "installCommand": "corepack enable pnpm && pnpm install --frozen-lockfile=false",
  "buildCommand": "pnpm --filter web build",
  "outputDirectory": "apps/web/.output"
}
```
Manual checkpoint (owner): in the Vercel dashboard, leave Root Directory as the repo root (the commands above target `apps/web`); confirm the project still deploys on the next PR preview.

- [ ] **Step 4: Install and verify dev + build**

Run:
```bash
rm -f package-lock.json && pnpm install
pnpm --filter web build 2>&1 | tail -5
```
Expected: build completes; `apps/web/.output/` is generated. If path-alias errors appear, confirm `apps/web/tsconfig.json` still contains the `@/*` → `./src/*` mapping and `vite-tsconfig-paths` is a dep.

- [ ] **Step 5: Smoke the dev server**

Run:
```bash
pnpm --filter web dev &
sleep 6 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/ ; kill %1
```
Expected: `200`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(monorepo): move app into apps/web; wire pnpm + vercel"
```

---

### Task 3: Scaffold `packages/shared` and `apps/api` stub

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/index.ts` (placeholder note only)

**Interfaces:**
- Produces: importable workspace package `@rollcall/shared` (empty barrel for now); an `apps/api` slot reserved for Phase 2.

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@rollcall/shared",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/shared/src/index.ts`**

```ts
// Shared domain types and (Phase 2+) the generated OpenAPI client live here.
export {};
```

- [ ] **Step 4: Create the `apps/api` placeholder**

`apps/api/package.json`:
```json
{ "name": "api", "private": true, "type": "module", "scripts": { "build": "echo 'api: Phase 2' " } }
```
`apps/api/src/index.ts`:
```ts
// Placeholder. The Hono + zod-openapi API is built in Phase 2.
export {};
```

- [ ] **Step 5: Install + verify workspace resolves**

Run:
```bash
pnpm install && pnpm -r exec node -e "console.log('ok')"
```
Expected: prints `ok` for each package without resolution errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(monorepo): scaffold packages/shared and apps/api stub"
```

---

## Phase 1 — Backend modularization foundation

### Task 4: Add the Vitest harness to `apps/web`

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/lib/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: `pnpm --filter web test` runs Vitest; `@/` alias works in tests.

- [ ] **Step 1: Write the failing smoke test**

`apps/web/src/lib/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails (no runner yet)**

Run: `pnpm --filter web test`
Expected: FAIL — `vitest` not configured / command errors.

- [ ] **Step 3: Add `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsConfigPaths()],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test`
Expected: PASS — 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/src/lib/__tests__/smoke.test.ts
git commit -m "test(web): add vitest harness"
```

---

### Task 5: Extract org-resolution into a testable core (pure/IO split)

**Files:**
- Create: `apps/web/src/server/core/org-context.ts` (pure decision helper + IO functions)
- Create: `apps/web/src/server/core/__tests__/org-context.test.ts`
- Modify: `apps/web/src/lib/org-context.ts` (re-export from the new core; keep the public API stable)

**Interfaces:**
- Produces:
  - `pickActiveOrgId(pref: string | null, memberOrgIds: string[]): string | null`
  - `resolveActiveOrgId(admin, userId): Promise<string | null>` (unchanged signature)
  - `resolveActiveMembership(admin, userId): Promise<{ orgId: string; role: string } | null>` (unchanged)
  - `requireOrgRole(admin, userId, roles: string[]): Promise<{ orgId: string; role: string }>` (unchanged)
- Consumes: `SupabaseClient<Database>` from `@supabase/supabase-js`; `Database` from `@/integrations/supabase/types`.

- [ ] **Step 1: Write the failing test for the pure helper**

`apps/web/src/server/core/__tests__/org-context.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { pickActiveOrgId } from "@/server/core/org-context";

describe("pickActiveOrgId", () => {
  it("returns the preferred org when the user is still a member", () => {
    expect(pickActiveOrgId("org-a", ["org-a", "org-b"])).toBe("org-a");
  });
  it("ignores a stale preference and falls back to first membership", () => {
    expect(pickActiveOrgId("org-x", ["org-a", "org-b"])).toBe("org-a");
  });
  it("returns null when the user has no memberships", () => {
    expect(pickActiveOrgId("org-a", [])).toBeNull();
  });
  it("returns first membership when there is no preference", () => {
    expect(pickActiveOrgId(null, ["org-b", "org-c"])).toBe("org-b");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test src/server/core`
Expected: FAIL — cannot find module `@/server/core/org-context`.

- [ ] **Step 3: Implement the core**

`apps/web/src/server/core/org-context.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Pure decision: given the user's preferred org and the orgs they belong to,
// pick the active org. A stale preference never grants access.
export function pickActiveOrgId(
  pref: string | null,
  memberOrgIds: string[],
): string | null {
  if (pref && memberOrgIds.includes(pref)) return pref;
  return memberOrgIds[0] ?? null;
}

export async function resolveActiveOrgId(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const [{ data: prof }, { data: mems }] = await Promise.all([
    admin.from("profiles").select("last_active_org_id").eq("id", userId).maybeSingle(),
    admin.from("memberships").select("org_id").eq("user_id", userId),
  ]);
  return pickActiveOrgId(
    prof?.last_active_org_id ?? null,
    (mems ?? []).map((m) => m.org_id),
  );
}

export async function resolveActiveMembership(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<{ orgId: string; role: string } | null> {
  const orgId = await resolveActiveOrgId(admin, userId);
  if (!orgId) return null;
  const { data } = await admin
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data) return null;
  return { orgId, role: data.role };
}

export async function requireOrgRole(
  admin: SupabaseClient<Database>,
  userId: string,
  roles: string[],
): Promise<{ orgId: string; role: string }> {
  const m = await resolveActiveMembership(admin, userId);
  if (!m) throw new Error("No active organization");
  if (!roles.includes(m.role)) throw new Error("Forbidden");
  return m;
}
```

- [ ] **Step 4: Re-export from the old path to keep call sites working**

Replace `apps/web/src/lib/org-context.ts` contents with:
```ts
// Moved to src/server/core/org-context.ts. Kept as a stable re-export so the
// existing *.functions.ts call sites need no change.
export {
  pickActiveOrgId,
  resolveActiveOrgId,
  resolveActiveMembership,
  requireOrgRole,
} from "@/server/core/org-context";
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter web test src/server/core && pnpm --filter web typecheck`
Expected: tests PASS; `tsc --noEmit` reports 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/server/core apps/web/src/lib/org-context.ts
git commit -m "refactor(server): extract testable org-context core (pure pickActiveOrgId)"
```

---

### Task 6: Create the org-scoped repository base

**Files:**
- Create: `apps/web/src/server/core/repository.ts`
- Create: `apps/web/src/server/core/__tests__/repository.test.ts`

**Interfaces:**
- Produces:
  - `type Admin = SupabaseClient<Database>`
  - `class OrgRepository { constructor(admin: Admin, orgId: string); protected scoped(table): filter-builder already `.eq("org_id", orgId)`; get orgId; get admin }`
- Consumes: `resolveActiveMembership` (callers build repositories after resolving org).

Rationale: every domain repository extends `OrgRepository`, so the `org_id` filter is applied in exactly one place and cannot be forgotten.

- [ ] **Step 1: Write the failing test**

`apps/web/src/server/core/__tests__/repository.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { OrgRepository } from "@/server/core/repository";

// Minimal fake that records the org_id filter applied.
function fakeAdmin() {
  const calls: Array<{ table: string; col: string; val: string }> = [];
  const admin = {
    from(table: string) {
      return {
        select() { return this; },
        eq(col: string, val: string) { calls.push({ table, col, val }); return this; },
      };
    },
  };
  return { admin: admin as any, calls };
}

class ThingRepo extends OrgRepository {
  list() { return this.scoped("students").select("id"); }
}

describe("OrgRepository", () => {
  it("applies the org_id filter on scoped()", () => {
    const { admin, calls } = fakeAdmin();
    new ThingRepo(admin, "org-42").list();
    expect(calls).toContainEqual({ table: "students", col: "org_id", val: "org-42" });
  });
  it("exposes orgId", () => {
    const { admin } = fakeAdmin();
    expect(new ThingRepo(admin, "org-7").orgId).toBe("org-7");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test src/server/core/__tests__/repository.test.ts`
Expected: FAIL — cannot find module `@/server/core/repository`.

- [ ] **Step 3: Implement the base**

`apps/web/src/server/core/repository.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Admin = SupabaseClient<Database>;
type TableName = keyof Database["public"]["Tables"];

// Base for all domain repositories. `scoped(table)` returns a query builder
// with the org_id filter already applied — the ONLY place org scoping lives.
export class OrgRepository {
  constructor(
    protected readonly admin: Admin,
    public readonly orgId: string,
  ) {}

  protected scoped<T extends TableName>(table: T) {
    return this.admin.from(table).select("*").eq("org_id", this.orgId);
  }

  protected table<T extends TableName>(table: T) {
    return this.admin.from(table);
  }
}
```
Note: repositories that need `insert`/`update`/`delete` use `this.table(name)` and stamp/filter `org_id` explicitly in their own methods (see roster repo). `scoped()` is the read shortcut whose filter cannot be forgotten.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test src/server/core/__tests__/repository.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/core/repository.ts apps/web/src/server/core/__tests__/repository.test.ts
git commit -m "feat(server): org-scoped repository base"
```

---

### Task 7: Modularize the roster domain (classes + students)

**Files:**
- Create: `apps/web/src/server/modules/roster/roster.repository.ts`
- Create: `apps/web/src/server/modules/roster/roster.service.ts`
- Create: `apps/web/src/server/modules/roster/__tests__/roster.service.test.ts`
- Modify: `apps/web/src/lib/classes.functions.ts` (handlers call the service; no behavior change)

**Interfaces:**
- Consumes: `OrgRepository` (Task 6), `resolveActiveMembership`/`requireOrgRole` (Task 5), `assertWithinPlan` from `@/lib/plans`.
- Produces:
  - `class RosterRepository extends OrgRepository { listClasses(role, userId); listClassesWithMeta(role, userId); createClass({name, grade, teacherId}); classCount() }`
  - `class RosterService { constructor(admin, orgId, role, userId); listClasses(); listClassesWithMeta(); createClass(input) }`
  - Pure helper `scopeClassesToRole(role, userId, teacherIds): "all" | string` used to decide manager scoping.

- [ ] **Step 1: Write the failing test for role scoping**

`apps/web/src/server/modules/roster/__tests__/roster.service.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { managerScope } from "@/server/modules/roster/roster.service";

describe("managerScope", () => {
  it("returns the user id for managers (own classes only)", () => {
    expect(managerScope("manager", "user-1")).toBe("user-1");
  });
  it("returns null (no restriction) for owner/admin", () => {
    expect(managerScope("owner", "user-1")).toBeNull();
    expect(managerScope("admin", "user-1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test src/server/modules/roster`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the repository**

`apps/web/src/server/modules/roster/roster.repository.ts`:
```ts
import { OrgRepository } from "@/server/core/repository";

export class RosterRepository extends OrgRepository {
  // `teacherId` null = no manager restriction (owner/admin see all).
  async listClasses(teacherId: string | null) {
    let q = this.table("classes")
      .select("id, name, grade, teacher_id, created_at")
      .eq("org_id", this.orgId)
      .order("created_at", { ascending: false });
    if (teacherId) q = q.eq("teacher_id", teacherId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  }

  async listClassesRaw(teacherId: string | null) {
    let q = this.table("classes")
      .select("id, name, grade, teacher_id, created_at")
      .eq("org_id", this.orgId)
      .order("name");
    if (teacherId) q = q.eq("teacher_id", teacherId);
    const { data } = await q;
    return data ?? [];
  }

  async teacherNames(ids: string[]) {
    const { data } = await this.table("profiles")
      .select("id, full_name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    return new Map((data ?? []).map((p) => [p.id, p.full_name]));
  }

  async studentClassIds() {
    const { data } = await this.table("students").select("class_id").eq("org_id", this.orgId);
    return (data ?? []).map((s) => s.class_id);
  }

  async classCount() {
    const { count } = await this.table("classes")
      .select("id", { count: "exact", head: true })
      .eq("org_id", this.orgId);
    return count ?? 0;
  }

  async insertClass(input: { name: string; grade: string | null; teacherId: string }) {
    const { data, error } = await this.table("classes")
      .insert({ org_id: this.orgId, name: input.name, grade: input.grade, teacher_id: input.teacherId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
}
```

- [ ] **Step 4: Implement the service (with the pure helper)**

`apps/web/src/server/modules/roster/roster.service.ts`:
```ts
import type { Admin } from "@/server/core/repository";
import { RosterRepository } from "@/server/modules/roster/roster.repository";
import { assertWithinPlan } from "@/lib/plans";

// Pure: managers are restricted to their own classes; owner/admin are not.
export function managerScope(role: string, userId: string): string | null {
  return role === "manager" ? userId : null;
}

export class RosterService {
  private repo: RosterRepository;
  constructor(
    private admin: Admin,
    orgId: string,
    private role: string,
    private userId: string,
  ) {
    this.repo = new RosterRepository(admin, orgId);
  }

  listClasses() {
    return this.repo.listClasses(managerScope(this.role, this.userId));
  }

  async listClassesWithMeta() {
    const classes = await this.repo.listClassesRaw(managerScope(this.role, this.userId));
    const ids = classes.map((c) => c.teacher_id).filter((x): x is string => !!x);
    const nameMap = await this.repo.teacherNames(ids);
    const classIds = await this.repo.studentClassIds();
    const countMap = new Map<string, number>();
    for (const cid of classIds) countMap.set(cid, (countMap.get(cid) ?? 0) + 1);
    return classes.map((c) => ({
      ...c,
      teacher_name: c.teacher_id ? (nameMap.get(c.teacher_id) ?? null) : null,
      student_count: countMap.get(c.id) ?? 0,
    }));
  }

  async createClass(input: { name: string; grade?: string; teacherId?: string }) {
    if (this.role !== "owner" && this.role !== "admin") throw new Error("Forbidden");
    await assertWithinPlan(this.admin, this.repo.orgId, "classes");
    return this.repo.insertClass({
      name: input.name,
      grade: input.grade ?? null,
      teacherId: input.teacherId ?? this.userId,
    });
  }
}
```

- [ ] **Step 5: Run the service test to verify it passes**

Run: `pnpm --filter web test src/server/modules/roster`
Expected: PASS — `managerScope` tests green.

- [ ] **Step 6: Rewire the existing handlers to the service (no behavior change)**

In `apps/web/src/lib/classes.functions.ts`, replace the `activeOrg()` helper and the `listClasses`/`listClassesWithMeta`/`createClass` handler bodies so they build a `RosterService`. Example for the three roster reads/writes:
```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveMembership } from "@/lib/org-context";
import { RosterService } from "@/server/modules/roster/roster.service";

async function roster(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const m = await resolveActiveMembership(supabaseAdmin, userId);
  if (!m) throw new Error("No active organization");
  return new RosterService(supabaseAdmin, m.orgId, m.role, userId);
}

export const listClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await roster(context.userId)).listClasses());

export const listClassesWithMeta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await roster(context.userId)).listClassesWithMeta());

export const createClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      name: z.string().min(1).max(120),
      grade: z.string().max(40).optional(),
      teacherId: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => (await roster(context.userId)).createClass(data));
```
Leave the remaining handlers in the file (`updateClass`, `deleteClass`, `addStudent`, `bulkAddStudents`, `getClass`, etc.) as-is for now; they migrate to `RosterService`/`RosterRepository` methods in the roster follow-on tasks. Do not change their behavior in this task.

- [ ] **Step 7: Typecheck + build + roster tests**

Run:
```bash
pnpm --filter web typecheck && pnpm --filter web test && pnpm --filter web build 2>&1 | tail -3
```
Expected: 0 tsc errors; all tests pass; build succeeds (regenerates `routeTree.gen.ts`).

- [ ] **Step 8: Manual smoke — classes still work**

Run the dev server, sign in as an owner, open `/app/classes`, create a class, confirm it appears and that a manager sees only their own classes. (Use the local Supabase owner account from the local-dev memory.)
Expected: identical behavior to before the refactor.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/server/modules/roster apps/web/src/lib/classes.functions.ts
git commit -m "refactor(roster): repository+service layer behind classes server fns"
```

---

## Self-Review

**1. Spec coverage.**
- Modular monolith with layered modules → Tasks 5–7 establish the `core` + `modules/<name>/{repository,service}` structure. ✅ (roster proven; remaining 5 modules are follow-on plans, stated in Handoff.)
- Org-scoping made structural (fixes leak risk) → `OrgRepository` (Task 6) + repos using it (Task 7). ✅
- Monorepo (pnpm + Turbo, `apps/web`/`apps/api`/`packages/shared`) → Tasks 1–3. ✅
- Testing (service unit tests; pure/IO split) → Tasks 4–7 add Vitest + tests. ✅ (Full tenant-isolation integration suite is Phase 2, per spec §7 — out of scope here.)
- Prerender, REST API, SPA, Bearer auth → explicitly Phases 2–3; not in this plan. ✅
- Schema/types/RLS untouched → constraint honored; no migration or `types.ts` edits. ✅

**2. Placeholder scan.** No "TBD/TODO/handle edge cases". The `apps/api` stub is intentional and labelled as a Phase-2 slot, not a placeholder task. ✅

**3. Type consistency.** `Admin = SupabaseClient<Database>` defined in `repository.ts` and reused in `roster.service.ts`; `OrgRepository.orgId` public and used by `RosterService.createClass`; `managerScope` signature identical in test and impl; `resolveActiveMembership` signature unchanged from the original. ✅

Known follow-on (not gaps in this plan): `classes.functions.ts` retains un-migrated handlers after Task 7; the roster follow-on plan finishes them. The five other domains (identity, attendance, kiosk, billing, reporting) each get their own plan reusing Tasks 5–7's pattern.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-05-replatform-phase0-1-foundation.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session with checkpoints for review.

After this plan lands, the remaining Phase 1 work is five short follow-on plans (one per domain), each reusing the repository+service+pure-helper pattern proven here: **identity**, **attendance**, **kiosk**, **billing**, **reporting** (plus finishing the rest of the roster handlers). Then Phase 2 (REST API) and Phase 3 (SPA) per the design spec.
