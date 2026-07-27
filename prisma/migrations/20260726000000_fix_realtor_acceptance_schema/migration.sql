-- Add credit metadata used by coupon validation and application.
ALTER TABLE "coupons"
ADD COLUMN "assignedUserId" TEXT,
ADD COLUMN "isCredit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "remainingValue" DOUBLE PRECISION DEFAULT 0;

CREATE INDEX "coupons_assignedUserId_idx" ON "coupons"("assignedUserId");

ALTER TABLE "coupons"
ADD CONSTRAINT "coupons_assignedUserId_fkey"
FOREIGN KEY ("assignedUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Add invoice ownership metadata required by Prisma invoice reads.
ALTER TABLE "invoices"
ADD COLUMN "paidByType" TEXT,
ADD COLUMN "paidByUserId" TEXT,
ADD COLUMN "paymentCardId" TEXT,
ADD COLUMN "paymentCardNickname" TEXT;

-- Add the request table used by the realtor inventory pickup workflow.
CREATE TABLE "sign_pickup_requests" (
    "id" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "dateNeeded" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sign_pickup_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sign_pickup_requests_requestedByUserId_idx"
ON "sign_pickup_requests"("requestedByUserId");

CREATE INDEX "sign_pickup_requests_status_idx"
ON "sign_pickup_requests"("status");

CREATE INDEX "sign_pickup_requests_dateNeeded_idx"
ON "sign_pickup_requests"("dateNeeded");

ALTER TABLE "sign_pickup_requests"
ADD CONSTRAINT "sign_pickup_requests_requestedByUserId_fkey"
FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sign_pickup_requests"
ADD CONSTRAINT "sign_pickup_requests_approvedByUserId_fkey"
FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;