CREATE TABLE "printer_partnership_requests" (
    "id" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "printer_partnership_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "printer_partnership_requests_requestedByUserId_idx" ON "printer_partnership_requests"("requestedByUserId");
CREATE INDEX "printer_partnership_requests_status_idx" ON "printer_partnership_requests"("status");
ALTER TABLE "printer_partnership_requests" ADD CONSTRAINT "printer_partnership_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;