CREATE TABLE "saved_payment_methods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fluidpayPaymentMethodId" TEXT NOT NULL,
    "last4" TEXT,
    "nickname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "saved_payment_methods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_payment_methods_fluidpayPaymentMethodId_key" ON "saved_payment_methods"("fluidpayPaymentMethodId");
CREATE INDEX "saved_payment_methods_userId_idx" ON "saved_payment_methods"("userId");
ALTER TABLE "saved_payment_methods" ADD CONSTRAINT "saved_payment_methods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "saved_payment_methods" ("id", "userId", "fluidpayPaymentMethodId", "last4", "nickname", "createdAt", "updatedAt")
SELECT 'legacy_' || "id", "id", "vaultId", "paymentCardLast4", "paymentCardNickname", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users"
WHERE "vaultId" IS NOT NULL;