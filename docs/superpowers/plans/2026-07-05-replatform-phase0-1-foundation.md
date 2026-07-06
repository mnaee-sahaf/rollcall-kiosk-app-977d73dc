# Architecture Re-platform — Phase 0 & Phase 1 (Foundation + Roster) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert RollCall to an npm-workspaces + Turborepo monorepo (`apps/web`) with no behavior change, then establish the Phase 1 backend-modularization pattern (test harness + org-scoped repository layer + pure/IO separation) and prove it end-to-end by modularizing the **roster** domain (classes + students).

**Architecture:** Move the existing TanStack Start app verbatim into `apps/web` under an npm workspace; add `packages/shared` and an `apps/api` stub for later phases. Then introduce Vitest and refactor backend logic into layered domain modules (`repository` = only place that touches the DB, always org-scoped; `service` = business rules; pure decision helpers split out for unit testing). The existing `*.functions.ts` handlers become thin wrappers over services — the running app is unchanged, only better-bounded.

**Tech Stack:** npm workspaces, Turborepo, TanStack Start (unchanged in this phase), Vite 8, React 19, Supabase JS, Vitest, TypeScript 5.8, Zod 3.

## Global Constraints

- Node `v24.4.0`; package manager is **npm with workspaces** (the repo's stray Bun artifacts are removed in Task 1).
- Do NOT change the Supabase schema, RLS, or `src/integrations/supabase/types.ts` in this plan.
- The app's user-facing behavior, routes, and URLs must be identical after Phase 0 (pure move).
- `supabase/`, `docs/`, `AGENTS.md`, `DEPLOY.md`, and `.env.prod.backup` stay at the **repo root**, not inside `apps/web`.
- Every repository query MUST be scoped by `org_id`; org-scoping lives only in repositories.
- Preserve the existing `@/` path alias (`@/* → ./src/*`) inside `apps/web`.
- Frequent commits: one per task. `main` is branch-protected — all work lands via PRs.
- Do NOT introduce the REST API, Hono, or the SPA in this plan (Phases 2–3).
- npm workspace command forms used below: `npm install` (root, installs all), `npm run <script> -w web` (run a web script), `npm run test -w web -- <path>` (pass args to vitest).

---

## Phase 0 — Monorepo

### Task 1: Restructure into an npm-workspaces monorepo (move app → `apps/web`)

**Files:**
- Move (git mv): `src/`, `public/`, `index.html`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `components.json`, `.env`, `.env.example`, `package.json` → `apps/web/`
- Delete: `bun.lock`, `bunfig.toml` (Bun no longer used)
- Create: `turbo.json` (root), new root `package.json` (workspaces)
- Modify: `apps/web/package.json` (name + scripts), `DEPLOY.md` (bun→npm)

**Interfaces:**
- Produces: workspace package `web` that builds and runs exactly as before from `apps/web`; root scripts `dev`, `build`, `test`, `lint`, `typecheck`, and `db:*`.

This task is intentionally atomic: the move and both `package.json` files must land together to leave a working tree.

- [ ] **Step 1: Move the app source into `apps/web`**

Run:
```bash
mkdir -p apps/web
git mv src public index.html vite.config.ts tsconfig.json eslint.config.js components.json package.json apps/web/
for f in .env .env.example; do [ -e "$f" ] && git mv "$f" apps/web/; done
true
```
Note: `supabase/`, `docs/`, `AGENTS.md`, `DEPLOY.md`, `.env.prod.backup`, `.gitignore`, `.prettierrc`, `.prettierignore`, `vercel.json` stay at the repo root.

- [ ] **Step 2: Remove the stale Bun artifacts**

Run:
```bash
git rm bun.lock bunfig.toml
```
Expected: both removed from the index (repo standardizes on npm).

- [ ] **Step 3: Edit `apps/web/package.json` — set name + add test/typecheck scripts**

In `apps/web/package.json`: set `"name": "web"`, remove the `db:*` scripts (they move to the root manifest), and set the `scripts` block to:
```json
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "format": "prettier --write ."
  },
```
Then add to `devDependencies`: `"vitest": "^2.1.0"`. Leave all other dependencies/devDependencies exactly as they are.

- [ ] **Step 4: Create the root `package.json` (workspaces + turbo + db scripts)**

```json
{
  "name": "rollcall-monorepo",
  "private": true,
  "type": "module",
  "workspaces": ["apps/*", "packages/*"],
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

- [ ] **Step 5: Create `turbo.json`**

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

- [ ] **Step 6: Update `DEPLOY.md` package-manager references (bun → npm)**

Replace every `bun install` → `npm install`, `bun run dev` → `npm run dev -w web`, `bun run db:link` → `npm run db:link`, `bun run db:push` → `npm run db:push`, `bun run db:types` → `npm run db:types`, `bun run db:diff <change_name>` → `npm run db:diff <change_name>`. Leave the rest of the file unchanged.

- [ ] **Step 7: Install and verify the build**

Run:
```bash
npm install
npm run build -w web 2>&1 | tail -5
```
Expected: install succeeds (writes root `package-lock.json`); build completes and generates `apps/web/.output/`. If a `@/`-alias error appears, confirm `apps/web/tsconfig.json` keeps the `@/*` → `./src/*` mapping and `vite-tsconfig-paths` is present.

- [ ] **Step 8: Smoke the dev server**

Run:
```bash
npm run dev -w web >/tmp/web-dev.log 2>&1 &
sleep 7 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/ ; kill %1
```
Expected: `200`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore(monorepo): move app to apps/web, npm workspaces + turbo, drop bun"
```

---

### Task 2: Scaffold `packages/shared` and `apps/api` stub

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/index.ts`

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
{ "name": "api", "private": true, "type": "module", "scripts": { "build": "echo 'api: Phase 2'", "test": "echo 'api: Phase 2'", "lint": "echo 'api: Phase 2'", "typecheck": "echo 'api: Phase 2'" } }
```
`apps/api/tsconfig.json`:
```json
{ "compilerOptions": { "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler", "strict": true, "skipLibCheck": true }, "include": ["src"] }
```
`apps/api/src/index.ts`:
```ts
// Placeholder. The Hono + zod-openapi API is built in Phase 2.
export {};
```
Note: the `api` scripts are echo stubs so `turbo run build/test/lint/typecheck` succeeds across all workspaces in this phase.

- [ ] **Step 5: Install + verify the workspace graph resolves**

Run:
```bash
npm install && npm run build 2>&1 | tail -8
```
Expected: install links `web`, `api`, `@rollcall/shared`; `turbo run build` succeeds (web builds; api prints its stub).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(monorepo): scaffold packages/shared and apps/api stub"
```

---

### Task 3: Point Vercel at the monorepo

**Files:**
- Modify: `vercel.json`

**Interfaces:**
- Produces: a Vercel build that installs the workspace and builds `web`.

- [ ] **Step 1: Rewrite `vercel.json`**

```json
{
  "framework": "tanstack-start",
  "installCommand": "npm install",
  "buildCommand": "npm run build -w web",
  "outputDirectory": "apps/web/.output"
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "chore(monorepo): vercel builds the web workspace"
```

- [ ] **Step 3: Manual checkpoint (owner)**

After this branch's PR opens, confirm the Vercel **Preview** deploy for the PR builds green. Vercel Root Directory stays at the repo root (the commands above target `apps/web`). Do not merge to `main` until the preview is green. This is the one human gate in Phase 0.

---

## Phase 1 — Backend modularization foundation

### Task 4: Add the Vitest harness to `apps/web`

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/lib/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: `npm run test -w web` runs Vitest; `@/` alias works in tests.

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

- [ ] **Step 2: Run it to verify it fails (no runner config yet)**

Run: `npm run test -w web`
Expected: FAIL — vitest cannot resolve config / `@/` alias, or no config found.

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

Run: `npm run test -w web`
Expected: PASS — 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/src/lib/__tests__/smoke.test.ts
git commit -m "test(web): add vitest harness"
```

---

### Task 5: Extract org-resolution into a testable core (pure/IO split)

**Files:**
- Create: `apps/web/src/server/core/org-context.ts`
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

Run: `npm run test -w web -- src/server/core`
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

Run: `npm run test -w web -- src/server/core && npm run typecheck -w web`
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
  - `class OrgRepository { constructor(admin: Admin, orgId: string); protected scoped(table); protected table(table); readonly orgId }`
- Consumes: `Database` from `@/integrations/supabase/types`.

Rationale: every domain repository extends `OrgRepository`, so the `org_id` read filter is applied in exactly one place and cannot be forgotten.

- [ ] **Step 1: Write the failing test**

`apps/web/src/server/core/__tests__/repository.test.ts`:
```ts
import { describe, it, expect } from "vitest";
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
  list() { return (this as any).scoped("students").select("id"); }
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

Run: `npm run test -w web -- src/server/core/__tests__/repository.test.ts`
Expected: FAIL — cannot find module `@/server/core/repository`.

- [ ] **Step 3: Implement the base**

`apps/web/src/server/core/repository.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Admin = SupabaseClient<Database>;
type TableName = keyof Database["public"]["Tables"];

// Tables that carry an org_id column — the only tables scoped() accepts.
export type OrgScopedTable = {
  [K in TableName]: Database["public"]["Tables"][K]["Row"] extends { org_id: string }
    ? K
    : never;
}[TableName];

// Base for all domain repositories. `scoped(table)` returns a read builder with
// the org_id filter already applied — the ONLY place org scoping lives. The
// OrgScopedTable bound guarantees the table has org_id; supabase-js cannot
// narrow a column name for a generic table parameter, so the eq args are
// asserted (sound given the bound). Writes use `table(name)` with concrete
// literals and stamp/filter org_id explicitly.
export class OrgRepository {
  constructor(
    protected readonly admin: Admin,
    public readonly orgId: string,
  ) {}

  protected scoped<T extends OrgScopedTable>(table: T) {
    return this.admin
      .from(table)
      .select("*")
      .eq("org_id" as never, this.orgId as never);
  }

  protected table<T extends TableName>(table: T) {
    return this.admin.from(table);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -w web -- src/server/core/__tests__/repository.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/core/repository.ts apps/web/src/server/core/__tests__/repository.test.ts
git commit -m "feat(server): org-scoped repository base"
```

---

### Task 7: Modularize the roster domain (classes + students reads/create)

**Files:**
- Create: `apps/web/src/server/modules/roster/roster.repository.ts`
- Create: `apps/web/src/server/modules/roster/roster.service.ts`
- Create: `apps/web/src/server/modules/roster/__tests__/roster.service.test.ts`
- Modify: `apps/web/src/lib/classes.functions.ts` (the `listClasses`, `listClassesWithMeta`, `createClass` handlers call the service; no behavior change)

**Interfaces:**
- Consumes: `OrgRepository`/`Admin` (Task 6), `resolveActiveMembership` (Task 5), `assertWithinPlan` from `@/lib/plans`.
- Produces:
  - `class RosterRepository extends OrgRepository { listClasses(teacherId); listClassesRaw(teacherId); teacherNames(ids); studentClassIds(); classCount(); insertClass(input) }`
  - `class RosterService { constructor(admin, orgId, role, userId); listClasses(); listClassesWithMeta(); createClass(input) }`
  - Pure helper `managerScope(role, userId): string | null`.

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

Run: `npm run test -w web -- src/server/modules/roster`
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

Run: `npm run test -w web -- src/server/modules/roster`
Expected: PASS — `managerScope` tests green.

- [ ] **Step 6: Rewire the existing handlers to the service (no behavior change)**

In `apps/web/src/lib/classes.functions.ts`, replace the local `activeOrg()` helper and the `listClasses` / `listClassesWithMeta` / `createClass` handler bodies so they build a `RosterService`. The three handlers become:
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
IMPORTANT: the file has other handlers (`updateClass`, `deleteClass`, `addStudent`, `bulkAddStudents`, `getClass`, and any others). Leave them exactly as they are — they still use the old `activeOrg()` pattern via `resolveActiveMembership`. If removing the local `activeOrg()` helper breaks those handlers, keep `activeOrg()` in the file for them; only the three handlers above must route through `RosterService`. Do not change any other handler's behavior.

- [ ] **Step 7: Typecheck + full test run + build**

Run:
```bash
npm run typecheck -w web && npm run test -w web && npm run build -w web 2>&1 | tail -3
```
Expected: 0 tsc errors; all tests pass; build succeeds (regenerates `routeTree.gen.ts`).

- [ ] **Step 8: Manual smoke — classes still work**

Start the dev server and, signed in as an owner against local Supabase, open `/app/classes`, create a class, and confirm it appears. Confirm a `manager`-role user sees only their own classes. (Use the local owner account from the local-dev-setup memory.)
Expected: behavior identical to before the refactor.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/server/modules/roster apps/web/src/lib/classes.functions.ts
git commit -m "refactor(roster): repository+service layer behind classes server fns"
```

---

## Self-Review

**1. Spec coverage.**
- Modular monolith with layered modules → Tasks 5–7 establish `core` + `modules/<name>/{repository,service}`. ✅ (roster proven; other 5 domains are follow-on plans, per Handoff.)
- Org-scoping made structural → `OrgRepository` (Task 6) + roster repo using it (Task 7). ✅
- Monorepo (npm workspaces + Turbo; `apps/web`/`apps/api`/`packages/shared`) → Tasks 1–3. ✅
- Testing (service unit tests; pure/IO split) → Tasks 4–7 add Vitest + tests. ✅ (Full tenant-isolation integration suite is Phase 2, per spec §7 — out of scope here.)
- Prerender, REST API, SPA, Bearer auth → Phases 2–3; not in this plan. ✅
- Schema/types/RLS untouched → no migration or `types.ts` edits. ✅

**2. Placeholder scan.** No "TBD/TODO/handle edge cases". The `apps/api` echo stubs are intentional (keep turbo green), not placeholder tasks. ✅

**3. Type consistency.** `Admin = SupabaseClient<Database>` defined in `repository.ts`, reused in `roster.service.ts`; `OrgRepository.orgId` public and read by `RosterService.createClass`; `managerScope` signature identical in test and impl; `resolveActiveMembership` signature unchanged from the original. ✅

Known follow-on (not gaps): `classes.functions.ts` keeps un-migrated handlers after Task 7; the roster follow-on plan finishes them. The other domains (identity, attendance, kiosk, billing, reporting) each get their own plan reusing Tasks 5–7's pattern.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-05-replatform-phase0-1-foundation.md`.

After this plan lands, the remaining Phase 1 work is five short follow-on plans (one per domain), each reusing the repository+service+pure-helper pattern proven here: **identity**, **attendance**, **kiosk**, **billing**, **reporting** (plus finishing the rest of the roster handlers). Then Phase 2 (REST API) and Phase 3 (SPA) per the design spec.
