ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;

UPDATE "orders"
SET "status" = CASE WHEN "type" = 'REMOVAL' THEN 'REMOVED' ELSE 'IN_GROUND' END
WHERE "status" = 'COMPLETED';
UPDATE "orders" SET "status" = 'SCHEDULED' WHERE "status" = 'IN_PROGRESS';
UPDATE "orders" SET "status" = 'CONFIRMED' WHERE "status" = 'ON_HOLD';

UPDATE "orders" AS "order"
SET "status" = 'READY_TO_SCHEDULE'
WHERE "order"."status" IN ('PENDING', 'CONFIRMED')
  AND (
    "order"."self811Accepted" = TRUE
    OR EXISTS (
      SELECT 1
      FROM "tickets_811" AS "ticket"
      WHERE ("ticket"."orderId" = "order"."id" OR "order"."id" = ANY("ticket"."matchedOrderIds"))
        AND jsonb_typeof("ticket"."utilityLines") = 'array'
        AND jsonb_array_length("ticket"."utilityLines") > 0
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements("ticket"."utilityLines") AS "line"
          WHERE COALESCE("line"->>'status', '') <> 'CLEAR'
        )
    )
  );

UPDATE "orders"
SET "status" = 'CONFIRMED'
WHERE "status" = 'PENDING' AND "scheduledDate" IS NOT NULL;

UPDATE "orders"
SET "status" = 'READY_TO_SCHEDULE'
WHERE "type" = 'REMOVAL' AND "status" IN ('PENDING', 'CONFIRMED');

UPDATE "orders" AS "order"
SET "status" = 'CONFIRMED'
WHERE "order"."status" = 'SCHEDULED'
  AND "order"."type" <> 'REMOVAL'
  AND "order"."self811Accepted" = FALSE
  AND NOT EXISTS (
    SELECT 1
    FROM "tickets_811" AS "ticket"
    WHERE ("ticket"."orderId" = "order"."id" OR "order"."id" = ANY("ticket"."matchedOrderIds"))
      AND jsonb_typeof("ticket"."utilityLines") = 'array'
      AND jsonb_array_length("ticket"."utilityLines") > 0
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements("ticket"."utilityLines") AS "line"
        WHERE COALESCE("line"->>'status', '') <> 'CLEAR'
      )
  );

DROP TYPE "OrderStatus";
CREATE TYPE "OrderStatus" AS ENUM (
  'PENDING',
  'CONFIRMED',
  'READY_TO_SCHEDULE',
  'SCHEDULED',
  'IN_GROUND',
  'REMOVED',
  'EXTENDED_LISTING',
  'CANCELLED'
);

ALTER TABLE "orders"
ALTER COLUMN "status" TYPE "OrderStatus" USING "status"::"OrderStatus",
ALTER COLUMN "status" SET DEFAULT 'PENDING';

DROP INDEX IF EXISTS "orders_isStale_idx";
ALTER TABLE "orders" DROP COLUMN "isStale", DROP COLUMN "staleAt";