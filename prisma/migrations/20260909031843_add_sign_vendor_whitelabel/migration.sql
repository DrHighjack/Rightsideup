-- AlterTable
ALTER TABLE "smart_sign_inquiries" ADD COLUMN     "handledAt" TIMESTAMP(3),
ADD COLUMN     "vendorId" TEXT;

-- AlterTable
ALTER TABLE "smart_sign_tags" ADD COLUMN     "vendorId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'ios',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sign_vendors" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "tagline" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f172a',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "servicesLabel" TEXT NOT NULL DEFAULT 'Handyman Services',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sign_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "cardBrand" TEXT,
    "cardLast4" TEXT NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "encryptedCardNumber" TEXT NOT NULL,
    "encryptedCvv" TEXT NOT NULL,
    "billingAddressLine1" TEXT NOT NULL,
    "billingAddressLine2" TEXT,
    "billingCity" TEXT NOT NULL,
    "billingState" TEXT NOT NULL,
    "billingPostalCode" TEXT NOT NULL,
    "billingCountry" TEXT NOT NULL DEFAULT 'US',
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "refundPolicyAcceptedAt" TIMESTAMP(3) NOT NULL,
    "cardPolicyAcceptedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payment_schedules" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentCardId" TEXT NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_payment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_userId_idx" ON "device_tokens"("userId");

-- CreateIndex
CREATE INDEX "payment_cards_userId_idx" ON "payment_cards"("userId");

-- CreateIndex
CREATE INDEX "invoice_payment_schedules_invoiceId_idx" ON "invoice_payment_schedules"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_payment_schedules_userId_idx" ON "invoice_payment_schedules"("userId");

-- CreateIndex
CREATE INDEX "invoice_payment_schedules_paymentCardId_idx" ON "invoice_payment_schedules"("paymentCardId");

-- CreateIndex
CREATE INDEX "invoice_payment_schedules_isActive_idx" ON "invoice_payment_schedules"("isActive");

-- CreateIndex
CREATE INDEX "smart_sign_inquiries_vendorId_idx" ON "smart_sign_inquiries"("vendorId");

-- CreateIndex
CREATE INDEX "smart_sign_tags_vendorId_idx" ON "smart_sign_tags"("vendorId");

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smart_sign_tags" ADD CONSTRAINT "smart_sign_tags_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "sign_vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_cards" ADD CONSTRAINT "payment_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_paymentCardId_fkey" FOREIGN KEY ("paymentCardId") REFERENCES "payment_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payment_schedules" ADD CONSTRAINT "invoice_payment_schedules_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payment_schedules" ADD CONSTRAINT "invoice_payment_schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payment_schedules" ADD CONSTRAINT "invoice_payment_schedules_paymentCardId_fkey" FOREIGN KEY ("paymentCardId") REFERENCES "payment_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
