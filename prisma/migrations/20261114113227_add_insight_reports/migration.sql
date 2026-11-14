-- CreateTable
CREATE TABLE "insight_report" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" DATE,
    "periodEnd" DATE,
    "recurringThemes" JSONB NOT NULL DEFAULT '[]',
    "growthSuggestions" JSONB NOT NULL DEFAULT '[]',
    "trendCaption" TEXT,
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "generatedAt" TIMESTAMPTZ,
    "generatingAt" TIMESTAMPTZ,
    "lastRefreshAt" TIMESTAMPTZ,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "insight_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "insight_report_userId_key" ON "insight_report"("userId");

-- AddForeignKey
ALTER TABLE "insight_report" ADD CONSTRAINT "insight_report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
