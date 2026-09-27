-- AlterTable
ALTER TABLE "Hero" ADD COLUMN     "growths" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "path" TEXT;
