ALTER TABLE "job_assignments"
ADD COLUMN "installerPayCents" INTEGER,
ADD COLUMN "satisfactionScore" INTEGER;

ALTER TABLE "job_assignments"
ADD CONSTRAINT "job_assignments_installerPayCents_check"
CHECK ("installerPayCents" IS NULL OR "installerPayCents" >= 0),
ADD CONSTRAINT "job_assignments_satisfactionScore_check"
CHECK ("satisfactionScore" IS NULL OR "satisfactionScore" BETWEEN 1 AND 5);