-- CreateEnum
CREATE TYPE "Mood" AS ENUM ('calm', 'grateful', 'tired', 'anxious', 'hard');

-- CreateTable
CREATE TABLE "entry_analysis" (
    "entryId" UUID NOT NULL,
    "mood" "Mood" NOT NULL,
    "moodScore" INTEGER NOT NULL,
    "summary" TEXT[],
    "themes" TEXT[],
    "suggestedTags" TEXT[],
    "bodyHash" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "analyzedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "entry_analysis_pkey" PRIMARY KEY ("entryId")
);

-- AddForeignKey
ALTER TABLE "entry_analysis" ADD CONSTRAINT "entry_analysis_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
