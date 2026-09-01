CREATE TABLE "listing_link_requests" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requesterRole" TEXT NOT NULL,
    "requestedUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_link_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "listing_link_requests_orderId_idx" ON "listing_link_requests"("orderId");
CREATE INDEX "listing_link_requests_requestedById_createdAt_idx" ON "listing_link_requests"("requestedById", "createdAt");
CREATE INDEX "listing_link_requests_status_createdAt_idx" ON "listing_link_requests"("status", "createdAt");
CREATE UNIQUE INDEX "listing_link_requests_one_pending_per_order_idx" ON "listing_link_requests"("orderId") WHERE "status" = 'PENDING';