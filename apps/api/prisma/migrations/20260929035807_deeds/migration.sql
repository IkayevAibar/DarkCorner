-- AlterTable
ALTER TABLE "Hero" ADD COLUMN     "deedCounts" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "deeds" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "title" TEXT;
