-- Server-side session revocation: bumping token_version invalidates every previously issued JWT
-- (used by POST /api/auth/logout). JWTs that predate this column carry no `tv` claim and are
-- accepted once more, but any subsequent token carries it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;