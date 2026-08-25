CREATE TABLE "smart_sign_tags" (
    "id" TEXT NOT NULL,
    "tagCode" TEXT NOT NULL,
    "signId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "smart_sign_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "smart_sign_subscriptions" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'SMART_SIGN',
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialEndsAt" TIMESTAMP(3) NOT NULL,
    "reminderSentAt" TIMESTAMP(3),
    "savedPaymentMethodId" TEXT,
    "monthlyPriceCents" INTEGER NOT NULL DEFAULT 2900,
    "nextBillingAt" TIMESTAMP(3),
    "lastChargedAt" TIMESTAMP(3),
    "lastTransactionId" TEXT,
    "billingFailureReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "buyoutPurchasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "smart_sign_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "smart_sign_tap_events" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "tappedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "deviceType" TEXT,
    CONSTRAINT "smart_sign_tap_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "smart_sign_tags_tagCode_key" ON "smart_sign_tags"("tagCode");
CREATE UNIQUE INDEX "smart_sign_tags_signId_key" ON "smart_sign_tags"("signId");
CREATE UNIQUE INDEX "smart_sign_subscriptions_agentId_key" ON "smart_sign_subscriptions"("agentId");
CREATE INDEX "smart_sign_tags_isActive_idx" ON "smart_sign_tags"("isActive");
CREATE INDEX "smart_sign_subscriptions_status_trialEndsAt_idx" ON "smart_sign_subscriptions"("status", "trialEndsAt");
CREATE INDEX "smart_sign_subscriptions_status_nextBillingAt_idx" ON "smart_sign_subscriptions"("status", "nextBillingAt");
CREATE INDEX "smart_sign_tap_events_tagId_tappedAt_idx" ON "smart_sign_tap_events"("tagId", "tappedAt");
CREATE INDEX "smart_sign_tap_events_tappedAt_idx" ON "smart_sign_tap_events"("tappedAt");

ALTER TABLE "smart_sign_tags" ADD CONSTRAINT "smart_sign_tags_signId_fkey" FOREIGN KEY ("signId") REFERENCES "signs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "smart_sign_subscriptions" ADD CONSTRAINT "smart_sign_subscriptions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "smart_sign_tap_events" ADD CONSTRAINT "smart_sign_tap_events_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "smart_sign_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;