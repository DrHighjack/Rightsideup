ALTER TABLE "orders" ADD COLUMN "rfidListingUrl" TEXT;
ALTER TABLE "orders" ADD COLUMN "removalSignId" TEXT;

ALTER TABLE "smart_sign_tap_events"
ADD COLUMN "orderId" TEXT,
ADD COLUMN "agentId" TEXT,
ADD COLUMN "listingAddress" TEXT,
ADD COLUMN "listingUrl" TEXT;

CREATE INDEX "smart_sign_tap_events_agentId_tappedAt_idx"
ON "smart_sign_tap_events"("agentId", "tappedAt");

CREATE INDEX "smart_sign_tap_events_orderId_tappedAt_idx"
ON "smart_sign_tap_events"("orderId", "tappedAt");

CREATE INDEX "orders_removalSignId_idx" ON "orders"("removalSignId");

ALTER TABLE "orders" ADD CONSTRAINT "orders_removalSignId_fkey"
FOREIGN KEY ("removalSignId") REFERENCES "signs"("id") ON DELETE SET NULL ON UPDATE CASCADE;