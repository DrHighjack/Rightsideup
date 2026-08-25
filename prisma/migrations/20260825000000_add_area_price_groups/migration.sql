CREATE TABLE "area_price_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "area_price_groups_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "orders"
ADD COLUMN "areaPriceGroupId" TEXT,
ADD COLUMN "areaPriceGroupName" TEXT,
ADD COLUMN "areaPriceCents" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "area_price_groups_isActive_idx" ON "area_price_groups"("isActive");
CREATE INDEX "orders_areaPriceGroupId_idx" ON "orders"("areaPriceGroupId");

ALTER TABLE "orders"
ADD CONSTRAINT "orders_areaPriceGroupId_fkey"
FOREIGN KEY ("areaPriceGroupId") REFERENCES "area_price_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;