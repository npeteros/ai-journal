-- CreateTable
CREATE TABLE "insight_report" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "recurringThemes" JSONB NOT NULL,
    "growthSuggestions" JSONB NOT NULL,
    "trendCaption" TEXT,
    "entryCount" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insight_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insight_report_lease" (
    "userId" TEXT NOT NULL,
    "token" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "insight_report_lease_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "insight_report_userId_createdAt_idx" ON "insight_report"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "insight_report" ADD CONSTRAINT "insight_report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insight_report_lease" ADD CONSTRAINT "insight_report_lease_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
