-- CreateTable
CREATE TABLE "low_inventory_alerts" (
    "id" TEXT NOT NULL,
    "signType" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "threshold" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "low_inventory_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "low_inventory_alerts_signType_idx" ON "low_inventory_alerts"("signType");

-- CreateIndex
CREATE INDEX "low_inventory_alerts_sentAt_idx" ON "low_inventory_alerts"("sentAt");
