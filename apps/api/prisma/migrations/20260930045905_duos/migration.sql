-- AlterTable
ALTER TABLE "Hero" ADD COLUMN     "duoNews" JSONB,
ADD COLUMN     "partnerId" TEXT;

-- CreateTable
CREATE TABLE "DuoInvite" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuoInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DuoInvite_toId_idx" ON "DuoInvite"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "DuoInvite_fromId_toId_key" ON "DuoInvite"("fromId", "toId");
