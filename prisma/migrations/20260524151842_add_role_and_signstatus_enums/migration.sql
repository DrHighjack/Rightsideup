/*
  Warnings:

  - The `status` column on the `signs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `role` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('REALTOR', 'ADMIN', 'TC');

-- CreateEnum
CREATE TYPE "SignStatus" AS ENUM ('AVAILABLE', 'DEPLOYED', 'DAMAGED', 'LOST', 'RETIRED');

-- AlterTable
ALTER TABLE "signs" DROP COLUMN "status",
ADD COLUMN     "status" "SignStatus" NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'REALTOR';

-- CreateIndex
CREATE INDEX "signs_status_idx" ON "signs"("status");
