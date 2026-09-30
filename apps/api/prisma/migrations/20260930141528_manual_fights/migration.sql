-- CreateTable
CREATE TABLE "Fight" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "heroId" TEXT NOT NULL,
    "partnerId" TEXT,
    "floor" INTEGER NOT NULL,
    "room" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "context" JSONB NOT NULL,
    "manual" TEXT[],
    "choices" JSONB NOT NULL DEFAULT '[]',
    "turnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fight_heroId_key" ON "Fight"("heroId");

-- CreateIndex
CREATE UNIQUE INDEX "Fight_partnerId_key" ON "Fight"("partnerId");
