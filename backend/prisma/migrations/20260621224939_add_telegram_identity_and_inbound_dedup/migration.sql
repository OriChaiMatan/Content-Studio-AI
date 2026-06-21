-- CreateTable
CREATE TABLE "telegram_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT,
    "username" TEXT,
    "displayName" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifyToken" TEXT,
    "verifyExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_inbound_dedup" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_inbound_dedup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_identities_userId_key" ON "telegram_identities"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_identities_telegramUserId_key" ON "telegram_identities"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_inbound_dedup_channel_externalId_key" ON "channel_inbound_dedup"("channel", "externalId");

-- AddForeignKey
ALTER TABLE "telegram_identities" ADD CONSTRAINT "telegram_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

