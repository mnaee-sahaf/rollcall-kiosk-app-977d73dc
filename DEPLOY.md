# RollCall — self-hosted deploy guide

QR-based attendance for schools. Standalone deploy on **Vercel** (frontend + TanStack server functions) + **Supabase** (DB, auth, storage).

## Stack

- TanStack Start v1 (React 19, Vite 8, Nitro)
- Supabase (Postgres, Auth, Storage, RLS)
- Tailwind v4 + shadcn/ui

Server logic lives in `createServerFn` handlers under `src/lib/*.functions.ts` — they run as Vercel serverless functions, not Supabase Edge Functions.

## One-time setup

### 1. Supabase project

```bash
npm i -g supabase           # or: brew install supabase/tap/supabase
supabase login              # creates a PAT
bun run db:link             # supabase link --project-ref jywwgoceybjendvpbqea
bun run db:push             # apply all migrations to the linked remote
bun run db:types            # regenerate src/integrations/supabase/types.ts
```

Then in Supabase Dashboard → **Project Settings → API**, copy:

- `Project URL` → `SUPABASE_URL`
- `anon / publishable key` → `SUPABASE_PUBLISHABLE_KEY`
- `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` (server-only)

Paste them into `.env` (replace the `REPLACE_WITH_...` placeholders).

In Supabase Dashboard → **Authentication → URL Configuration**:

- Site URL: your Vercel prod URL
- Additional redirect URLs: `https://<your-vercel-domain>/**`, `http://localhost:8080/**`

### 2. Vercel

1. Import the git repo into Vercel.
2. Framework preset: **TanStack Start** if available, otherwise **Other** with Nitro auto-detection.
3. Build command and install command are pinned in `vercel.json`: `NITRO_PRESET=vercel npm run build` and `npm install`.
4. Environment variables (Production + Preview):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy.

## Day-to-day

### Schema changes

```bash
# 1. Write a new migration file in supabase/migrations/<timestamp>_<name>.sql
# 2. Push to remote
bun run db:push
# 3. Regenerate types
bun run db:types
```

If you edit schema in the Supabase Studio (avoid this — it loses your git source of truth):

```bash
bun run db:diff <change_name>   # captures remote diff into a migration file
```

### Local dev

```bash
bun install
bun run dev   # http://localhost:8080
```

Local dev connects to your **remote** Supabase project (no Docker required). All migrations applied via `db:push` are live for both dev and prod.

## Smoke test after deploy

1. Sign up with email/password, then complete organization creation to become admin.
2. Onboarding wizard → invite teacher → create class → add students.
3. Print student QR → launch kiosk → scan a code → attendance event appears.
4. Reports → export CSV.

## Files that matter

| Path                         | Purpose                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `supabase/migrations/`       | Versioned SQL. Source of truth for schema.                                          |
| `supabase/config.toml`       | Project ID + auth/storage settings.                                                 |
| `src/integrations/supabase/` | Browser/server/admin clients + auth middleware. **Do not edit `types.ts` by hand.** |
| `src/lib/*.functions.ts`     | TanStack server functions (Vercel serverless).                                      |
| `src/routes/api/public/*`    | Public HTTP endpoints (webhooks, cron). None today.                                 |
| `vite.config.ts`             | Vanilla TanStack Start config.                                                      |
| `.env`                       | Local env vars (gitignored in real projects — rotate the values you commit).        |
