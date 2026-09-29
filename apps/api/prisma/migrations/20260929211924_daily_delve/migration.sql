-- CreateTable
CREATE TABLE "Delve" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "heroId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "floor" INTEGER NOT NULL,
    "rooms" INTEGER NOT NULL DEFAULT 0,
    "hp" INTEGER NOT NULL,
    "potions" INTEGER NOT NULL,
    "spellUses" INTEGER NOT NULL,
    "healUses" INTEGER NOT NULL,
    "deathless" BOOLEAN NOT NULL DEFAULT true,
    "lucky" BOOLEAN NOT NULL DEFAULT true,
    "boons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "end" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "place" INTEGER,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "Delve_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Delve_seasonId_day_idx" ON "Delve"("seasonId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "Delve_playerId_day_key" ON "Delve"("playerId", "day");

-- AddForeignKey
ALTER TABLE "Delve" ADD CONSTRAINT "Delve_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delve" ADD CONSTRAINT "Delve_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delve" ADD CONSTRAINT "Delve_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "Hero"("id") ON DELETE CASCADE ON UPDATE CASCADE;
