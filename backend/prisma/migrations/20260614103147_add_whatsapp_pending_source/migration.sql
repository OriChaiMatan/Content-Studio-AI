-- CreateTable
CREATE TABLE "whatsapp_pending_sources" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "caseOptions" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_pending_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_pending_sources_userId_key" ON "whatsapp_pending_sources"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_pending_sources_phoneE164_key" ON "whatsapp_pending_sources"("phoneE164");

-- AddForeignKey
ALTER TABLE "whatsapp_pending_sources" ADD CONSTRAINT "whatsapp_pending_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
