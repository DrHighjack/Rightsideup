/*
  Warnings:

  - The `status` column on the `invoices` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[invoiceNumber]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'PAID', 'VOIDED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ORDER_CANCELLED', 'ORDER_PUT_ON_HOLD', 'ORDER_RELEASED_FROM_HOLD', 'INVOICE_CREATED', 'INVOICE_PAID', 'INVOICE_VOIDED', 'INVOICE_REMINDER_SENT', 'USER_CREATED', 'USER_UPDATED', 'SIGN_REPORT_FILED', 'SIGN_REPORT_RESOLVED', 'TICKET_811_CREATED', 'TICKET_811_CLEARED', 'JOB_ASSIGNED', 'JOB_COMPLETED', 'JOB_FLAGGED', 'COUPON_REDEEMED', 'QB_CONNECTED', 'QB_DISCONNECTED');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "discountAmount" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "paidAmount" DOUBLE PRECISION,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "qboInvoiceId" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "qboCustomerId" TEXT;

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_idx" ON "activity_logs"("entityType");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_qboInvoiceId_idx" ON "invoices"("qboInvoiceId");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
