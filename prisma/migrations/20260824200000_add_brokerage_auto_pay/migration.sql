ALTER TABLE "users"
ADD COLUMN "brokerageAutoPayEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "brokerageAutoPayPaymentMethodId" TEXT;

ALTER TABLE "brokerages"
ADD COLUMN "autoInvoiceOwnerUserId" TEXT;

ALTER TABLE "brokerage_statements"
ADD COLUMN "autoPayScheduledAt" TIMESTAMP(3),
ADD COLUMN "autoPayPaymentMethodId" TEXT,
ADD COLUMN "autoPayFailureReason" TEXT;

ALTER TABLE "brokerages"
ADD CONSTRAINT "brokerages_autoInvoiceOwnerUserId_fkey"
FOREIGN KEY ("autoInvoiceOwnerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "brokerage_statements_status_autoPayScheduledAt_idx"
ON "brokerage_statements"("status", "autoPayScheduledAt");