-- CreateTable
CREATE TABLE "personality_profile" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "traits" JSONB NOT NULL DEFAULT '[]',
    "summary" TEXT,
    "meaning" TEXT,
    "basedOn" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "generatedAt" TIMESTAMPTZ,
    "generatingAt" TIMESTAMPTZ,
    "retryAfter" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "personality_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personality_profile_userId_key" ON "personality_profile"("userId");

-- AddForeignKey
ALTER TABLE "personality_profile" ADD CONSTRAINT "personality_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

