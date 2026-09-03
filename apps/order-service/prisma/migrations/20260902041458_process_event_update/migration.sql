/*
  Warnings:

  - The primary key for the `ProcessedEvent` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `eventType` on the `ProcessedEvent` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[eventId,consumer]` on the table `ProcessedEvent` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `consumer` to the `ProcessedEvent` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `ProcessedEvent` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropIndex
DROP INDEX "ProcessedEvent_eventType_idx";

-- AlterTable
ALTER TABLE "ProcessedEvent" DROP CONSTRAINT "ProcessedEvent_pkey",
DROP COLUMN "eventType",
ADD COLUMN     "consumer" TEXT NOT NULL,
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEvent_eventId_consumer_key" ON "ProcessedEvent"("eventId", "consumer");
