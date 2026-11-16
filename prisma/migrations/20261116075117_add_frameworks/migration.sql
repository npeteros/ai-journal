-- AlterTable
ALTER TABLE "entry" ADD COLUMN     "frameworkId" UUID;

-- CreateTable
CREATE TABLE "framework" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "icon" TEXT NOT NULL,
    "prompts" JSONB NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "framework_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "framework_slug_key" ON "framework"("slug");

-- CreateIndex
CREATE INDEX "framework_userId_idx" ON "framework"("userId");

-- AddForeignKey
ALTER TABLE "entry" ADD CONSTRAINT "entry_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "framework"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "framework" ADD CONSTRAINT "framework_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
