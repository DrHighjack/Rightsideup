-- AlterTable
ALTER TABLE "users" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
