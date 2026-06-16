-- AlterTable
ALTER TABLE "tickets_811" ADD COLUMN     "allLinesRespondedAt" TIMESTAMP(3),
ADD COLUMN     "clearanceDate" TIMESTAMP(3),
ADD COLUMN     "realtorId" TEXT,
ADD COLUMN     "requestedDate" TIMESTAMP(3),
ADD COLUMN     "stage" TEXT NOT NULL DEFAULT 'REQUESTED',
ADD COLUMN     "ticketSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "utilityLines" JSONB;

-- CreateIndex
CREATE INDEX "tickets_811_realtorId_idx" ON "tickets_811"("realtorId");

-- CreateIndex
CREATE INDEX "tickets_811_stage_idx" ON "tickets_811"("stage");

-- AddForeignKey
ALTER TABLE "tickets_811" ADD CONSTRAINT "tickets_811_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
