-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "isStale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "staleAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "orders_isStale_idx" ON "orders"("isStale");
