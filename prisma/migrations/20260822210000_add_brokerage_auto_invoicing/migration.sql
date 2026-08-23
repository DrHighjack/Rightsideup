ALTER TABLE "brokerages"
ADD COLUMN "autoInvoiceStatus" TEXT NOT NULL DEFAULT 'DISABLED',
ADD COLUMN "autoInvoiceInterval" TEXT,
ADD COLUMN "autoInvoiceRequestedAt" TIMESTAMP(3),
ADD COLUMN "autoInvoiceApprovedAt" TIMESTAMP(3),
ADD COLUMN "autoInvoiceApprovedById" TEXT,
ADD COLUMN "autoInvoicePeriodStart" TIMESTAMP(3),
ADD COLUMN "autoInvoiceNextRunAt" TIMESTAMP(3);

CREATE INDEX "brokerages_autoInvoiceStatus_autoInvoiceNextRunAt_idx"
ON "brokerages"("autoInvoiceStatus", "autoInvoiceNextRunAt");