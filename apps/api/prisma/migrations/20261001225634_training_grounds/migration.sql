-- AlterTable
ALTER TABLE "Hero" ADD COLUMN     "trained" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "training" TEXT,
ADD COLUMN     "trainingUntil" TIMESTAMP(3);
