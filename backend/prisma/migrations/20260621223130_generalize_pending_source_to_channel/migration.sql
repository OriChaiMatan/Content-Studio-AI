-- Generalize the pending-source table from WhatsApp-only (phoneE164) to
-- channel-agnostic addressing (channel, externalId). Existing rows are
-- backfilled (externalId := phoneE164, channel := 'whatsapp') so the live
-- WhatsApp flow is unaffected.

-- 1. New columns. externalId is nullable initially so existing rows can be backfilled.
ALTER TABLE "whatsapp_pending_sources" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'whatsapp';
ALTER TABLE "whatsapp_pending_sources" ADD COLUMN "externalId" TEXT;

-- 2. Backfill externalId from the old phoneE164.
UPDATE "whatsapp_pending_sources" SET "externalId" = "phoneE164";

-- 3. Enforce NOT NULL now that every row has a value.
ALTER TABLE "whatsapp_pending_sources" ALTER COLUMN "externalId" SET NOT NULL;

-- 4. Drop the old single-column unique constraints (one-per-phone / one-per-user).
DROP INDEX "whatsapp_pending_sources_phoneE164_key";
DROP INDEX "whatsapp_pending_sources_userId_key";

-- 5. Drop the now-unused phoneE164 column. This table holds only ephemeral
--    (30-minute TTL) rows and the value is preserved in externalId.
ALTER TABLE "whatsapp_pending_sources" DROP COLUMN "phoneE164";

-- 6. New composite uniqueness + a userId index (replacing the dropped unique).
CREATE UNIQUE INDEX "whatsapp_pending_sources_channel_externalId_key" ON "whatsapp_pending_sources"("channel", "externalId");
CREATE INDEX "whatsapp_pending_sources_userId_idx" ON "whatsapp_pending_sources"("userId");
