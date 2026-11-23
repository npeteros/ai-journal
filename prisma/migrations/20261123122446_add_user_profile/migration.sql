-- CreateEnum
CREATE TYPE "CompanionTone" AS ENUM ('GENTLE', 'DIRECT', 'PLAYFUL');

-- CreateTable
CREATE TABLE "user_profile" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "focusAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "focusAreaOther" VARCHAR(80),
    "goal" VARCHAR(280),
    "currentContext" VARCHAR(500),
    "preferredTone" "CompanionTone",
    "welcomeAnsweredAt" TIMESTAMPTZ,
    "welcomeSkippedAt" TIMESTAMPTZ,
    "tourCompletedAt" TIMESTAMPTZ,
    "tourDismissedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_userId_key" ON "user_profile"("userId");

-- AddForeignKey
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
