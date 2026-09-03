CREATE TABLE "smart_sign_inquiries" (
    "id" TEXT NOT NULL,
    "tagCode" TEXT NOT NULL,
    "orderId" TEXT,
    "inquiryType" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT,
    "notifyWhen" TEXT,
    "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smart_sign_inquiries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "smart_sign_inquiries_tagCode_idx" ON "smart_sign_inquiries"("tagCode");
CREATE INDEX "smart_sign_inquiries_email_idx" ON "smart_sign_inquiries"("email");
CREATE INDEX "smart_sign_inquiries_createdAt_idx" ON "smart_sign_inquiries"("createdAt");