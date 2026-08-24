CREATE TABLE "brokerage_access" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "brokerageId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brokerage_access_pkey" PRIMARY KEY ("id")
);

INSERT INTO "brokerage_access" ("id", "userId", "brokerageId")
SELECT 'legacy-' || "id", "adminId", "id"
FROM "brokerages"
ON CONFLICT DO NOTHING;

ALTER TABLE "brokerage_statements"
ADD COLUMN "ownerUserId" TEXT,
ADD COLUMN "brokerageIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "selectionKey" TEXT;

UPDATE "brokerage_statements" AS "statement"
SET
  "ownerUserId" = "brokerage"."adminId",
  "brokerageIds" = ARRAY["statement"."brokerageId"],
  "selectionKey" = "statement"."brokerageId"
FROM "brokerages" AS "brokerage"
WHERE "brokerage"."id" = "statement"."brokerageId";

ALTER TABLE "brokerage_statements"
ALTER COLUMN "ownerUserId" SET NOT NULL,
ALTER COLUMN "selectionKey" SET NOT NULL;

DROP INDEX IF EXISTS "brokerage_statements_brokerageId_periodStart_key";

CREATE UNIQUE INDEX "brokerage_access_userId_brokerageId_key"
ON "brokerage_access"("userId", "brokerageId");
CREATE INDEX "brokerage_access_brokerageId_idx"
ON "brokerage_access"("brokerageId");
CREATE UNIQUE INDEX "brokerage_statements_ownerUserId_periodStart_selectionKey_key"
ON "brokerage_statements"("ownerUserId", "periodStart", "selectionKey");
CREATE INDEX "brokerage_statements_ownerUserId_idx"
ON "brokerage_statements"("ownerUserId");

ALTER TABLE "brokerage_access"
ADD CONSTRAINT "brokerage_access_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brokerage_access"
ADD CONSTRAINT "brokerage_access_brokerageId_fkey"
FOREIGN KEY ("brokerageId") REFERENCES "brokerages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brokerage_statements"
ADD CONSTRAINT "brokerage_statements_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;