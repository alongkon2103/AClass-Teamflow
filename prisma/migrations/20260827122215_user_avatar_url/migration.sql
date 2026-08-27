-- Uploaded profile photo. Nullable: existing users keep the initial-on-colour
-- avatar until they upload one, so no backfill is needed.
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
