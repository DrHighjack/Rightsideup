CREATE TABLE "brokerage_statements" (
    "id" TEXT NOT NULL,
    "brokerageId" TEXT NOT NULL,
    "statementNumber" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "invoiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "snapshot" JSONB NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "paidAmountCents" INTEGER,
    "paymentMethodId" TEXT,
    "paymentCardLast4" TEXT,
    "fluidpayTransactionId" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brokerage_statements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brokerage_statements_statementNumber_key" ON "brokerage_statements"("statementNumber");
CREATE UNIQUE INDEX "brokerage_statements_brokerageId_periodStart_key" ON "brokerage_statements"("brokerageId", "periodStart");
CREATE INDEX "brokerage_statements_brokerageId_idx" ON "brokerage_statements"("brokerageId");
CREATE INDEX "brokerage_statements_periodStart_idx" ON "brokerage_statements"("periodStart");
CREATE INDEX "brokerage_statements_status_idx" ON "brokerage_statements"("status");

ALTER TABLE "brokerage_statements"
ADD CONSTRAINT "brokerage_statements_brokerageId_fkey"
FOREIGN KEY ("brokerageId") REFERENCES "brokerages"("id") ON DELETE CASCADE ON UPDATE CASCADE;