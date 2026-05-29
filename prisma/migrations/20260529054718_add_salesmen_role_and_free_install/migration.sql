-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SALESMEN';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "freeInstallDate" TIMESTAMP(3),
ADD COLUMN     "freeInstallGivenBy" TEXT;
