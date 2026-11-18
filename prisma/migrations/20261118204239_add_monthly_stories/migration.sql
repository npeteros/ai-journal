-- CreateTable
CREATE TABLE "monthly_story" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "summary" TEXT,
    "model" TEXT,
    "generatedAt" TIMESTAMPTZ,
    "fingerprint" TEXT,
    "generatingAt" TIMESTAMPTZ,
    "failedAt" TIMESTAMPTZ,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "monthly_story_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_story_userId_month_key" ON "monthly_story"("userId", "month");

-- AddForeignKey
ALTER TABLE "monthly_story" ADD CONSTRAINT "monthly_story_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
