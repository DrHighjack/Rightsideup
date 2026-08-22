ALTER TABLE "invoices"
ADD COLUMN "taxRateBps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "taxAmount" INTEGER NOT NULL DEFAULT 0;

UPDATE "invoices"
SET
  "taxRateBps" = 1040,
  "taxAmount" = ROUND(GREATEST(COALESCE("amount", 0) - COALESCE("discountAmount", 0), 0) * 0.104)::INTEGER
WHERE "status" IN ('DRAFT', 'SENT', 'VIEWED', 'OVERDUE');