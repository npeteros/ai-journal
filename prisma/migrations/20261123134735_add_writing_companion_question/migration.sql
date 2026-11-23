-- CreateTable
CREATE TABLE "writing_companion_question" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT,
    "wordCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "writing_companion_question_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "writing_companion_question_entryId_createdAt_idx" ON "writing_companion_question"("entryId", "createdAt");

-- AddForeignKey
ALTER TABLE "writing_companion_question" ADD CONSTRAINT "writing_companion_question_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_companion_question" ADD CONSTRAINT "writing_companion_question_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
