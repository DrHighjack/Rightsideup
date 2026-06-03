/*
  Warnings:

  - Added the required column `updatedAt` to the `instaads` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'INTERESTED', 'AWAITING_LISTING', 'FOLLOW_UP_SCHEDULED', 'CONVERTED', 'NOT_INTERESTED', 'INACTIVE');

-- AlterTable - Add columns with defaults, then update
ALTER TABLE "instaads" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "instaads" ADD COLUMN     "assignedToUserId" TEXT;
ALTER TABLE "instaads" ADD COLUMN     "convertedAt" TIMESTAMP(3);
ALTER TABLE "instaads" ADD COLUMN     "convertedToClientId" TEXT;
ALTER TABLE "instaads" ADD COLUMN     "followUpDate" TIMESTAMP(3);
ALTER TABLE "instaads" ADD COLUMN     "lastContactedAt" TIMESTAMP(3);
ALTER TABLE "instaads" ADD COLUMN     "notes" TEXT;
ALTER TABLE "instaads" ADD COLUMN     "status" "LeadStatus" NOT NULL DEFAULT 'NEW';

-- CreateIndex
CREATE INDEX "instaads_status_idx" ON "instaads"("status");

-- CreateIndex
CREATE INDEX "instaads_assignedToUserId_idx" ON "instaads"("assignedToUserId");

-- CreateIndex
CREATE INDEX "instaads_convertedToClientId_idx" ON "instaads"("convertedToClientId");

-- AddForeignKey
ALTER TABLE "instaads" ADD CONSTRAINT "instaads_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instaads" ADD CONSTRAINT "instaads_convertedToClientId_fkey" FOREIGN KEY ("convertedToClientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
