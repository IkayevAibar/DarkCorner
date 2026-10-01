-- CreateTable
CREATE TABLE "Oath" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "room" INTEGER NOT NULL,
    "heroAId" TEXT NOT NULL,
    "heroBId" TEXT NOT NULL,
    "choiceA" TEXT,
    "choiceB" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Oath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuoChest" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "room" INTEGER NOT NULL,
    "heroAId" TEXT NOT NULL,
    "heroBId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "picks" JSONB NOT NULL DEFAULT '[]',
    "turnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuoChest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Oath_seasonId_floor_room_heroAId_heroBId_key" ON "Oath"("seasonId", "floor", "room", "heroAId", "heroBId");

-- CreateIndex
CREATE INDEX "DuoChest_heroAId_idx" ON "DuoChest"("heroAId");

-- CreateIndex
CREATE INDEX "DuoChest_heroBId_idx" ON "DuoChest"("heroBId");
