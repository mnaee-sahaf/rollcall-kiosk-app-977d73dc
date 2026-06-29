
# Clean rebuild: standalone Supabase + Vercel

Target Supabase project: `jywwgoceybjendvpbqea`. Frontend on Vercel. Schema rebuilt from scratch via Supabase CLI. Start empty.

**Confirmed decisions**
- Keep `createServerFn` on Vercel (no move to Edge Functions).
- Push migrations directly to the linked remote — no local Docker stack.
- Start empty — no data carryover, not even waitlist signups.

---

## Phase 1 — CLI workflow (no Docker)

You run these locally on your machine:

```bash
brew install supabase/tap/supabase   # or npm i -g supabase
supabase login                        # creates a PAT
supabase link --project-ref jywwgoceybjendvpbqea
```

In the repo:
- Overwrite `supabase/config.toml` `project_id` to `jywwgoceybjendvpbqea`. Add `[auth]`, `[auth.email]`, `[storage]` sections so signup/HIBP/confirmation settings live in git.
- Add npm scripts in `package.json`:
  - `db:push` → `supabase db push` (apply pending migrations to the linked remote)
  - `db:diff` → `supabase db diff --linked -f <name>` (capture remote-side Studio edits as a migration; review before committing)
  - `db:types` → `supabase gen types typescript --linked > src/integrations/supabase/types.ts`
- Skip `db:reset` — that needs Docker. Discipline: never edit schema in Studio; if you do, run `db:diff` immediately.

## Phase 2 — Consolidated initial migration

Delete existing files in `supabase/migrations/` (they target the old project's history).

Write one new file: `supabase/migrations/<timestamp>_init.sql`. It creates everything in dependency order:

- Extensions: `citext`.
- Enum: `app_role` (`admin`, `teacher`).
- Tables (all 10, in FK order): `profiles`, `user_roles`, `school_settings`, `classes`, `students`, `student_qr_tokens`, `attendance_events`, `kiosk_sessions`, `teacher_invites`, `waitlist_signups`. Each follows CREATE → GRANT → ENABLE RLS → POLICIES.
- Function `public.has_role(uuid, app_role)` SECURITY DEFINER with `EXECUTE` granted only to `authenticated`.
- Function `public.handle_new_user()` + trigger on `auth.users` to insert profile and accept pending teacher invite.
- Storage: create `school-assets` bucket (private) and its RLS policies on `storage.objects`.
- RLS policies copied from current schema with security-memory fixes baked in (no public SELECT on `school_settings`, invitee-can-read on `teacher_invites`, explicit admin-only mutations on `user_roles`, anon-insert-only on `waitlist_signups`).

Run `supabase db push` to apply. Then `bun run db:types` to regenerate `src/integrations/supabase/types.ts`.

## Phase 3 — Detach from Lovable Cloud

Delete:
- `src/integrations/lovable/` (entire folder)
- `@lovable.dev/cloud-auth-js` from `package.json`

Update:
- `src/routes/auth.tsx` — replace `lovable.auth.signInWithOAuth("google", ...)` with standard `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } })`.
- Create `src/routes/auth.callback.tsx` (public route) — waits for `supabase.auth.getSession()`, then navigates to `/app` or stored intended path.
- `vite.config.ts` — switch Nitro preset from Cloudflare to Vercel. If `@lovable.dev/vite-tanstack-config` doesn't expose a clean override, swap in TanStack Start's vanilla Vite plugin directly.
- `.env` — point `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (and matching server `SUPABASE_*`) to the new project.
- `bunfig.toml` — remove `@lovable.dev/*` entries from `minimumReleaseAgeExcludes`.

## Phase 4 — Google OAuth (your own client)

In Google Cloud Console:
1. New project (or existing). **APIs & Services → OAuth consent screen** → External, fill app name + support email, scopes: `openid`, `userinfo.email`, `userinfo.profile`.
2. Authorized domains: `supabase.co`, your Vercel domain(s), custom domain if any.
3. **Credentials → Create OAuth Client ID → Web application**.
4. Authorized JavaScript origins:
   - `https://jywwgoceybjendvpbqea.supabase.co`
   - your Vercel prod URL (e.g. `https://rollcall.vercel.app`)
   - `http://localhost:8080` for local dev
5. Authorized redirect URI: `https://jywwgoceybjendvpbqea.supabase.co/auth/v1/callback`
6. Copy Client ID + Secret → Supabase Dashboard → **Authentication → Providers → Google → Enable**, paste, save.
7. Supabase Dashboard → **Authentication → URL Configuration**:
   - Site URL: Vercel prod URL
   - Additional redirect URLs: Vercel preview wildcard, `http://localhost:8080/**`

## Phase 5 — Vercel deployment

1. Vercel → Import git repo.
2. Build command: `bun run build`. Output dir: TanStack Start Vercel preset default.
3. Environment Variables (Production + Preview + Development):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy. Smoke test: signup → first user becomes admin via trigger → create org → invite teacher → create class → add students → launch kiosk → scan → reports → CSV export.

---

## What gets removed
- `src/integrations/lovable/`
- `@lovable.dev/cloud-auth-js`
- All current files in `supabase/migrations/`
- `@lovable.dev/*` entries in `bunfig.toml`

## What stays
- All TanStack Start routes
- All `src/lib/*.functions.ts` server functions
- `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher}.ts` — these are plain Supabase, not Lovable-specific
- Full app surface: admin, teacher, kiosk, demo, waitlist

## Risks
- **`vite.config.ts`** is the highest-risk edit. If the Lovable wrapper config can't be re-targeted, we swap to vanilla TanStack Start Vite plugin (`@tanstack/react-start/plugin/vite`) directly. I'll confirm at edit time.
- **No local DB** means every schema change goes straight to remote. Use `db:diff --linked` before pushing so you can review the SQL. Branch off to a throwaway Supabase project for risky migrations if needed.
- **Email templates** reset to Supabase defaults. Re-customize in Dashboard if needed.
- **`auth.users` is empty.** First signup becomes admin via trigger.

---

## What I'll do in build mode
1. Update `supabase/config.toml` (project id + auth/storage sections).
2. Add `db:push` / `db:diff` / `db:types` npm scripts.
3. Delete old `supabase/migrations/*.sql`.
4. Write the new `<timestamp>_init.sql` consolidated migration.
5. Delete `src/integrations/lovable/`, remove `@lovable.dev/cloud-auth-js`.
6. Rewrite Google sign-in in `src/routes/auth.tsx`, add `src/routes/auth.callback.tsx`.
7. Switch `vite.config.ts` to Vercel preset.
8. Update `.env` to point at the new project.
9. Clean up `bunfig.toml`.

## What you do (manual, outside the editor)
- Install + login to Supabase CLI, `supabase link`, run `bun run db:push` to apply the migration.
- Create the Google OAuth client, paste credentials into Supabase Dashboard.
- Set up the Vercel project + env vars, deploy.

Ready to switch to build mode?
