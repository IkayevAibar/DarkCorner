-- AlterEnum
ALTER TYPE "ItemPlace" ADD VALUE 'MARKET';

-- AlterTable
ALTER TABLE "Hero" ADD COLUMN     "badLuck" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "blessing" TEXT,
ADD COLUMN     "blessingUntil" TIMESTAMP(3),
ADD COLUMN     "lucky" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopPurchase" (
    "id" TEXT NOT NULL,
    "heroId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "offer" TEXT NOT NULL,

    CONSTRAINT "ShopPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventVisit" (
    "id" TEXT NOT NULL,
    "heroId" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "room" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Listing_itemId_key" ON "Listing"("itemId");

-- CreateIndex
CREATE INDEX "Listing_seasonId_expiresAt_idx" ON "Listing"("seasonId", "expiresAt");

-- CreateIndex
CREATE INDEX "Listing_sellerId_idx" ON "Listing"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopPurchase_heroId_day_offer_key" ON "ShopPurchase"("heroId", "day", "offer");

-- CreateIndex
CREATE UNIQUE INDEX "EventVisit_heroId_floor_room_day_key" ON "EventVisit"("heroId", "floor", "room", "day");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPurchase" ADD CONSTRAINT "ShopPurchase_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "Hero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventVisit" ADD CONSTRAINT "EventVisit_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "Hero"("id") ON DELETE CASCADE ON UPDATE CASCADE;
