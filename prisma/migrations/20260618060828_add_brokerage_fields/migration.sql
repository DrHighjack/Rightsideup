-- AlterTable
ALTER TABLE "brokerages" ADD COLUMN     "address" TEXT,
ADD COLUMN     "basePriceCents" INTEGER,
ADD COLUMN     "billingType" TEXT NOT NULL DEFAULT 'AGENT',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
