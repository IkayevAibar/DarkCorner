-- CreateEnum
CREATE TYPE "HeroLocation" AS ENUM ('CITY', 'LABYRINTH');

-- AlterEnum
ALTER TYPE "ItemPlace" ADD VALUE 'GRAVE';

-- AlterTable
ALTER TABLE "Hero" ADD COLUMN     "bestFloor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "campSince" TIMESTAMP(3),
ADD COLUMN     "deathless" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "floor" INTEGER,
ADD COLUMN     "healUses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "location" "HeroLocation" NOT NULL DEFAULT 'CITY',
ADD COLUMN     "prevRoom" INTEGER,
ADD COLUMN     "room" INTEGER,
ADD COLUMN     "spellUses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "waypoints" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "graveId" TEXT;

-- CreateTable
CREATE TABLE "HeroFloor" (
    "id" TEXT NOT NULL,
    "heroId" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "seen" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "cleared" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "HeroFloor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grave" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "room" INTEGER NOT NULL,
    "heroId" TEXT,
    "ownerName" TEXT NOT NULL,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialClaim" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "room" INTEGER NOT NULL,
    "heroId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecialClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HeroFloor_heroId_floor_key" ON "HeroFloor"("heroId", "floor");

-- CreateIndex
CREATE INDEX "Grave_seasonId_floor_room_idx" ON "Grave"("seasonId", "floor", "room");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialClaim_seasonId_floor_room_key" ON "SpecialClaim"("seasonId", "floor", "room");

-- AddForeignKey
ALTER TABLE "HeroFloor" ADD CONSTRAINT "HeroFloor_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "Hero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grave" ADD CONSTRAINT "Grave_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "Hero"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_graveId_fkey" FOREIGN KEY ("graveId") REFERENCES "Grave"("id") ON DELETE CASCADE ON UPDATE CASCADE;
