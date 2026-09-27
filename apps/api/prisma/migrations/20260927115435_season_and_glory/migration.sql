-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BossKill" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "heroId" TEXT NOT NULL,
    "heroName" TEXT NOT NULL,
    "place" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BossKill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelicFind" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "uniqueId" TEXT NOT NULL,
    "serial" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "heroName" TEXT NOT NULL,
    "itemId" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelicFind_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultOpening" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "room" INTEGER NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "announcedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "heroId" TEXT,

    CONSTRAINT "VaultOpening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HallEntry" (
    "id" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "playerId" TEXT,
    "playerName" TEXT NOT NULL,
    "heroName" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HallEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BossKill_seasonId_place_key" ON "BossKill"("seasonId", "place");

-- CreateIndex
CREATE UNIQUE INDEX "BossKill_seasonId_playerId_key" ON "BossKill"("seasonId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "RelicFind_seasonId_uniqueId_serial_key" ON "RelicFind"("seasonId", "uniqueId", "serial");

-- CreateIndex
CREATE INDEX "VaultOpening_seasonId_floor_room_idx" ON "VaultOpening"("seasonId", "floor", "room");

-- CreateIndex
CREATE INDEX "HallEntry_seasonNumber_idx" ON "HallEntry"("seasonNumber");
