-- CreateEnum
CREATE TYPE "ItemPlace" AS ENUM ('WORN', 'BAG', 'STORAGE');

-- CreateTable
CREATE TABLE "Hero" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "race" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "talents" TEXT[],
    "portrait" TEXT NOT NULL,
    "banner" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "str" INTEGER NOT NULL,
    "dex" INTEGER NOT NULL,
    "con" INTEGER NOT NULL,
    "int" INTEGER NOT NULL,
    "wis" INTEGER NOT NULL,
    "cha" INTEGER NOT NULL,
    "maxHp" INTEGER NOT NULL,
    "hp" INTEGER NOT NULL,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "carriedGold" INTEGER NOT NULL DEFAULT 0,
    "stamina" INTEGER NOT NULL,
    "staminaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeroDraft" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "sets" JSONB NOT NULL,
    "rerollsLeft" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeroDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "heroId" TEXT,
    "place" "ItemPlace" NOT NULL,
    "slot" TEXT,
    "base" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "itemLevel" INTEGER NOT NULL DEFAULT 1,
    "quality" INTEGER,
    "bonusStats" JSONB NOT NULL DEFAULT '[]',
    "suffix" INTEGER,
    "uniqueId" TEXT,
    "radiant" BOOLEAN NOT NULL DEFAULT false,
    "identified" BOOLEAN NOT NULL DEFAULT true,
    "upgrade" INTEGER NOT NULL DEFAULT 0,
    "serial" INTEGER,
    "owners" JSONB,
    "seed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hero_playerId_seasonId_idx" ON "Hero"("playerId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "HeroDraft_playerId_seasonId_key" ON "HeroDraft"("playerId", "seasonId");

-- CreateIndex
CREATE INDEX "Item_heroId_place_idx" ON "Item"("heroId", "place");

-- CreateIndex
CREATE UNIQUE INDEX "Item_heroId_slot_key" ON "Item"("heroId", "slot");

-- AddForeignKey
ALTER TABLE "Hero" ADD CONSTRAINT "Hero_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hero" ADD CONSTRAINT "Hero_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeroDraft" ADD CONSTRAINT "HeroDraft_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeroDraft" ADD CONSTRAINT "HeroDraft_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "Hero"("id") ON DELETE SET NULL ON UPDATE CASCADE;
