-- Standardize all money fields to integer cents.
-- Invoice/invoice payment/order discount values were already semantically cents,
-- so they are rounded, not scaled. FIXED-type coupons were entered in dollars,
-- so they are scaled by 100 (PERCENTAGE coupons stay as whole percents).

-- Coupons: dollars -> cents for FIXED/credit coupons before the type change.
UPDATE "coupons"
SET "value" = ROUND("value" * 100),
    "remainingValue" = ROUND(COALESCE("remainingValue", 0) * 100)
WHERE "type" = 'FIXED' OR "isCredit" = true;

ALTER TABLE "coupons"
  ALTER COLUMN "value" TYPE INTEGER USING ROUND("value")::INTEGER,
  ALTER COLUMN "remainingValue" TYPE INTEGER USING ROUND(COALESCE("remainingValue", 0))::INTEGER,
  ALTER COLUMN "remainingValue" SET DEFAULT 0;

-- Invoices: already stored as cents, just as floats.
ALTER TABLE "invoices"
  ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount")::INTEGER,
  ALTER COLUMN "discountAmount" TYPE INTEGER USING ROUND(COALESCE("discountAmount", 0))::INTEGER,
  ALTER COLUMN "discountAmount" SET DEFAULT 0,
  ALTER COLUMN "paidAmount" TYPE INTEGER USING ROUND("paidAmount")::INTEGER;

ALTER TABLE "invoice_payments"
  ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount")::INTEGER;

ALTER TABLE "order_discounts"
  ALTER COLUMN "discountAmount" TYPE INTEGER USING ROUND("discountAmount")::INTEGER;
