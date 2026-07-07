-- Add FluidPay card vault support to users
ALTER TABLE "users"
ADD COLUMN "vaultId" TEXT;

CREATE UNIQUE INDEX "users_vaultId_key" ON "users"("vaultId");

-- Add FluidPay transaction reference to invoices
ALTER TABLE "invoices"
ADD COLUMN "fluidpayTransactionId" TEXT;

CREATE INDEX "invoices_fluidpayTransactionId_idx" ON "invoices"("fluidpayTransactionId");
