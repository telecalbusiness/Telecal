-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "isSensitive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visibleUntil" TIMESTAMP(3);
