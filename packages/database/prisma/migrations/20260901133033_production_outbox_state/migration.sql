/*
  Warnings:

  - You are about to drop the column `availableAt` on the `OutboxEvent` table. All the data in the column will be lost.
  - You are about to drop the column `lockedBy` on the `OutboxEvent` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "OutboxEvent_lockedBy_idx";

-- DropIndex
DROP INDEX "OutboxEvent_status_availableAt_createdAt_idx";

-- AlterTable
ALTER TABLE "OutboxEvent" DROP COLUMN "availableAt",
DROP COLUMN "lockedBy",
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "OutboxEvent_status_nextAttemptAt_createdAt_idx" ON "OutboxEvent"("status", "nextAttemptAt", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_lockedAt_idx" ON "OutboxEvent"("status", "lockedAt");
