/*
  Warnings:

  - The `status` column on the `orders` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'SCHEDULED', 'ON_HOLD', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Ticket811Status" AS ENUM ('NEW', 'NEEDS_REVIEW', 'ACTIVE', 'CLEARED', 'DISMISSED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'FIELD_TECH';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "heldAt" TIMESTAMP(3),
ADD COLUMN     "holdReason" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "tickets_811" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT,
    "sourceEmail" TEXT NOT NULL,
    "emailSubject" TEXT NOT NULL,
    "emailBody" TEXT NOT NULL,
    "parsedAddress" TEXT,
    "workStartDate" TIMESTAMP(3),
    "status" "Ticket811Status" NOT NULL DEFAULT 'NEW',
    "matchedOrderIds" TEXT[],
    "clearedAt" TIMESTAMP(3),
    "clearedByUserId" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_811_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_assignments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fieldTechId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "techNotes" TEXT,
    "issue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tickets_811_status_idx" ON "tickets_811"("status");

-- CreateIndex
CREATE INDEX "tickets_811_createdAt_idx" ON "tickets_811"("createdAt");

-- CreateIndex
CREATE INDEX "tickets_811_ticketNumber_idx" ON "tickets_811"("ticketNumber");

-- CreateIndex
CREATE INDEX "tickets_811_clearedByUserId_idx" ON "tickets_811"("clearedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "job_assignments_orderId_key" ON "job_assignments"("orderId");

-- CreateIndex
CREATE INDEX "job_assignments_fieldTechId_idx" ON "job_assignments"("fieldTechId");

-- CreateIndex
CREATE INDEX "job_assignments_orderId_idx" ON "job_assignments"("orderId");

-- CreateIndex
CREATE INDEX "job_assignments_startedAt_idx" ON "job_assignments"("startedAt");

-- CreateIndex
CREATE INDEX "job_assignments_completedAt_idx" ON "job_assignments"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- CreateIndex
CREATE INDEX "app_settings_key_idx" ON "app_settings"("key");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_heldAt_idx" ON "orders"("heldAt");

-- AddForeignKey
ALTER TABLE "tickets_811" ADD CONSTRAINT "tickets_811_clearedByUserId_fkey" FOREIGN KEY ("clearedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_fieldTechId_fkey" FOREIGN KEY ("fieldTechId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
