-- CreateTable
CREATE TABLE "whatsapp_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifyCode" TEXT,
    "verifyExpires" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "optOut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_identities_userId_key" ON "whatsapp_identities"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_identities_phoneE164_key" ON "whatsapp_identities"("phoneE164");

-- CreateIndex
CREATE INDEX "whatsapp_identities_phoneE164_idx" ON "whatsapp_identities"("phoneE164");

-- AddForeignKey
ALTER TABLE "whatsapp_identities" ADD CONSTRAINT "whatsapp_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
