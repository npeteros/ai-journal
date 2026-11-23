-- CreateTable
CREATE TABLE "daily_prompt" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "text" TEXT,
    "sourceCount" INTEGER,
    "model" TEXT,
    "generatedAt" TIMESTAMPTZ,
    "generatingAt" TIMESTAMPTZ,
    "failedAt" TIMESTAMPTZ,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_prompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_prompt_userId_day_key" ON "daily_prompt"("userId", "day");

-- AddForeignKey
ALTER TABLE "daily_prompt" ADD CONSTRAINT "daily_prompt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
