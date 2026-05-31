-- CreateTable
CREATE TABLE "master_prices" (
    "id" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_overrides" (
    "id" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "brokerageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_prices_serviceType_key" ON "master_prices"("serviceType");

-- CreateIndex
CREATE INDEX "master_prices_serviceType_idx" ON "master_prices"("serviceType");

-- CreateIndex
CREATE INDEX "master_prices_isActive_idx" ON "master_prices"("isActive");

-- CreateIndex
CREATE INDEX "price_overrides_serviceType_idx" ON "price_overrides"("serviceType");

-- CreateIndex
CREATE INDEX "price_overrides_userId_idx" ON "price_overrides"("userId");

-- CreateIndex
CREATE INDEX "price_overrides_brokerageId_idx" ON "price_overrides"("brokerageId");

-- CreateIndex
CREATE UNIQUE INDEX "price_overrides_serviceType_userId_key" ON "price_overrides"("serviceType", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "price_overrides_serviceType_brokerageId_key" ON "price_overrides"("serviceType", "brokerageId");

-- AddForeignKey
ALTER TABLE "price_overrides" ADD CONSTRAINT "price_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_overrides" ADD CONSTRAINT "price_overrides_brokerageId_fkey" FOREIGN KEY ("brokerageId") REFERENCES "brokerages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
