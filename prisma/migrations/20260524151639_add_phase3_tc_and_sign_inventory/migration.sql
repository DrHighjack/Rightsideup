/*
  Warnings:

  - You are about to drop the column `description` on the `signs` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `signs` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `signs` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `signs` table. All the data in the column will be lost.
  - You are about to drop the `sign_inventory` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[signNumber]` on the table `signs` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "sign_inventory" DROP CONSTRAINT "sign_inventory_signId_fkey";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "placedByTCId" TEXT;

-- AlterTable
ALTER TABLE "signs" DROP COLUMN "description",
DROP COLUMN "imageUrl",
DROP COLUMN "name",
DROP COLUMN "price",
ADD COLUMN     "assignedToOrderId" TEXT,
ADD COLUMN     "assignedToUserId" TEXT,
ADD COLUMN     "deployedAddress" TEXT,
ADD COLUMN     "deployedLat" DOUBLE PRECISION,
ADD COLUMN     "deployedLng" DOUBLE PRECISION,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "purchasedAt" TIMESTAMP(3),
ADD COLUMN     "signNumber" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'Standard';

-- DropTable
DROP TABLE "sign_inventory";

-- CreateTable
CREATE TABLE "tc_agent_links" (
    "id" TEXT NOT NULL,
    "tcUserId" TEXT NOT NULL,
    "agentUserId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tc_agent_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tc_invites" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tc_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sign_reports" (
    "id" TEXT NOT NULL,
    "signId" TEXT NOT NULL,
    "reportedByUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sign_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tc_agent_links_tcUserId_idx" ON "tc_agent_links"("tcUserId");

-- CreateIndex
CREATE INDEX "tc_agent_links_agentUserId_idx" ON "tc_agent_links"("agentUserId");

-- CreateIndex
CREATE UNIQUE INDEX "tc_agent_links_tcUserId_agentUserId_key" ON "tc_agent_links"("tcUserId", "agentUserId");

-- CreateIndex
CREATE UNIQUE INDEX "tc_invites_token_key" ON "tc_invites"("token");

-- CreateIndex
CREATE INDEX "tc_invites_email_idx" ON "tc_invites"("email");

-- CreateIndex
CREATE INDEX "tc_invites_token_idx" ON "tc_invites"("token");

-- CreateIndex
CREATE INDEX "tc_invites_expiresAt_idx" ON "tc_invites"("expiresAt");

-- CreateIndex
CREATE INDEX "sign_reports_signId_idx" ON "sign_reports"("signId");

-- CreateIndex
CREATE INDEX "sign_reports_reportedByUserId_idx" ON "sign_reports"("reportedByUserId");

-- CreateIndex
CREATE INDEX "sign_reports_type_idx" ON "sign_reports"("type");

-- CreateIndex
CREATE INDEX "sign_reports_resolvedAt_idx" ON "sign_reports"("resolvedAt");

-- CreateIndex
CREATE INDEX "orders_placedByTCId_idx" ON "orders"("placedByTCId");

-- CreateIndex
CREATE UNIQUE INDEX "signs_signNumber_key" ON "signs"("signNumber");

-- CreateIndex
CREATE INDEX "signs_status_idx" ON "signs"("status");

-- CreateIndex
CREATE INDEX "signs_assignedToUserId_idx" ON "signs"("assignedToUserId");

-- CreateIndex
CREATE INDEX "signs_assignedToOrderId_idx" ON "signs"("assignedToOrderId");

-- CreateIndex
CREATE INDEX "signs_type_idx" ON "signs"("type");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_placedByTCId_fkey" FOREIGN KEY ("placedByTCId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signs" ADD CONSTRAINT "signs_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signs" ADD CONSTRAINT "signs_assignedToOrderId_fkey" FOREIGN KEY ("assignedToOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tc_agent_links" ADD CONSTRAINT "tc_agent_links_tcUserId_fkey" FOREIGN KEY ("tcUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tc_agent_links" ADD CONSTRAINT "tc_agent_links_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tc_invites" ADD CONSTRAINT "tc_invites_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_reports" ADD CONSTRAINT "sign_reports_signId_fkey" FOREIGN KEY ("signId") REFERENCES "signs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_reports" ADD CONSTRAINT "sign_reports_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
