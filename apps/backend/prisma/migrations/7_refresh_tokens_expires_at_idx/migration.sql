-- RefreshToken @@index([expires_at]) for the hourly RefreshTokenJanitor sweep
-- (DELETE ... WHERE expires_at < now() OR revoked_at < now() - 7d).
-- IF NOT EXISTS keeps the migration safe on databases synced with `prisma db push`.
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");
