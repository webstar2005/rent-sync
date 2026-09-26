-- Brings a pre-Google-auth database up to date. These two columns were added straight to schema.sql
-- for Google sign-in without a matching migration, so any database created before that feature was
-- missing them entirely. apply-migrations.js can only replay migrations, so it could not repair
-- them: requireAuth selects auth_provider on every request and failed with a 500 whose cause was
-- swallowed by a bare catch. Fresh databases are unaffected - schema.sql already defines both.
--
-- Idempotent, and safe on a database already created from the current schema.sql.
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'local';
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;

-- The CHECK and the UNIQUE index live inside schema.sql's CREATE TABLE, so add them separately and
-- only when they are missing, or this fails on a database that already has them.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'users'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%auth_provider%'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_auth_provider_check
      CHECK (auth_provider IN ('local', 'google'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users (google_sub);
