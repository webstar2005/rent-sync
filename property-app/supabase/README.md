# Supabase — property-app

Three projects: **dev / staging / production** (`docs/PLAN.md 11.8`). Never edit prod directly.

## CLI

```bash
npm i -g supabase  # or npx supabase
supabase login
supabase link --project-ref <dev-ref>
supabase migration new <name>   # creates supabase/migrations/<timestamp>_<name>.sql
supabase db push                # push to linked project
supabase db reset --linked      # reset linked DB (careful)
```

Migrations are versioned and reviewed like code — never hand-edit in dashboard.

## Secrets

Local `.env` (ignored) → hosting env vars (Vercel) / GitHub Actions secrets for CI. `SUPABASE_SERVICE_ROLE_KEY` only for Edge Functions, never browser.

## Tests

Phase 1 will add `supabase/tests/rls.test.sql` (pgTAP) or `tests/rls.test.ts` against local Supabase (`supabase start`). CI runs `npm run test:rls` if present.
