-- CreateTable
CREATE TABLE "instaads" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "brokerage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instaads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instaads_email_idx" ON "instaads"("email");

-- CreateIndex
CREATE INDEX "instaads_createdAt_idx" ON "instaads"("createdAt");
