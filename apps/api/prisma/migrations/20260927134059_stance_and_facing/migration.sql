-- AlterTable
ALTER TABLE "Hero" ADD COLUMN     "facing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stance" TEXT NOT NULL DEFAULT 'steady';
