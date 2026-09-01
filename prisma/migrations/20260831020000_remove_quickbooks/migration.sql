-- Remove the QuickBooks integration entirely.

-- Preserve audit history by remapping QB activity entries before rebuilding the enum.
UPDATE "activity_logs" SET "action" = 'USER_UPDATED' WHERE "action" IN ('QB_CONNECTED', 'QB_DISCONNECTED');

ALTER TABLE "activity_logs" ALTER COLUMN "action" TYPE TEXT;
DROP TYPE "ActivityAction";
CREATE TYPE "ActivityAction" AS ENUM ('ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ORDER_CANCELLED', 'ORDER_PUT_ON_HOLD', 'ORDER_RELEASED_FROM_HOLD', 'INVOICE_CREATED', 'INVOICE_PAID', 'INVOICE_VOIDED', 'INVOICE_REMINDER_SENT', 'USER_CREATED', 'USER_UPDATED', 'SIGN_REPORT_FILED', 'SIGN_REPORT_RESOLVED', 'TICKET_811_CREATED', 'TICKET_811_CLEARED', 'JOB_ASSIGNED', 'JOB_COMPLETED', 'JOB_FLAGGED', 'COUPON_REDEEMED');
ALTER TABLE "activity_logs" ALTER COLUMN "action" TYPE "ActivityAction" USING "action"::"ActivityAction";

ALTER TABLE "users" DROP COLUMN IF EXISTS "qboCustomerId";
ALTER TABLE "invoices" DROP COLUMN IF EXISTS "qboInvoiceId";
DROP TABLE IF EXISTS "qbo_connections";
