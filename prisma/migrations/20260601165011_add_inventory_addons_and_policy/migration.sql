/*
  Warnings:

  - A unique constraint covering the columns `[orderId]` on the table `tickets_811` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "self811Accepted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tickets_811" ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "pdfUrl" TEXT,
ADD COLUMN     "postAddressLat" DOUBLE PRECISION,
ADD COLUMN     "postAddressLng" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "availableQuantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOrderable" BOOLEAN NOT NULL DEFAULT true,
    "pricePerUnit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sign_printers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sign_printers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_item_printers" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "printerId" TEXT NOT NULL,

    CONSTRAINT "inventory_item_printers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_addons" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceAtOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "self_811_policies" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "self_811_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_items_category_idx" ON "inventory_items"("category");

-- CreateIndex
CREATE INDEX "inventory_items_isActive_idx" ON "inventory_items"("isActive");

-- CreateIndex
CREATE INDEX "inventory_items_isOrderable_idx" ON "inventory_items"("isOrderable");

-- CreateIndex
CREATE INDEX "sign_printers_isActive_idx" ON "sign_printers"("isActive");

-- CreateIndex
CREATE INDEX "inventory_item_printers_inventoryItemId_idx" ON "inventory_item_printers"("inventoryItemId");

-- CreateIndex
CREATE INDEX "inventory_item_printers_printerId_idx" ON "inventory_item_printers"("printerId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_item_printers_inventoryItemId_printerId_key" ON "inventory_item_printers"("inventoryItemId", "printerId");

-- CreateIndex
CREATE INDEX "order_addons_orderId_idx" ON "order_addons"("orderId");

-- CreateIndex
CREATE INDEX "order_addons_inventoryItemId_idx" ON "order_addons"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_811_orderId_key" ON "tickets_811"("orderId");

-- CreateIndex
CREATE INDEX "tickets_811_orderId_idx" ON "tickets_811"("orderId");

-- AddForeignKey
ALTER TABLE "tickets_811" ADD CONSTRAINT "tickets_811_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_item_printers" ADD CONSTRAINT "inventory_item_printers_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_item_printers" ADD CONSTRAINT "inventory_item_printers_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "sign_printers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_addons" ADD CONSTRAINT "order_addons_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_addons" ADD CONSTRAINT "order_addons_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
