-- CreateTable
CREATE TABLE "Hunt" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "kin" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hunt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuntHunter" (
    "id" TEXT NOT NULL,
    "huntId" TEXT NOT NULL,
    "heroId" TEXT NOT NULL,
    "heroName" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HuntHunter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hunt_seasonId_week_key" ON "Hunt"("seasonId", "week");

-- CreateIndex
CREATE INDEX "HuntHunter_huntId_count_idx" ON "HuntHunter"("huntId", "count");

-- CreateIndex
CREATE UNIQUE INDEX "HuntHunter_huntId_heroId_key" ON "HuntHunter"("huntId", "heroId");

-- AddForeignKey
ALTER TABLE "HuntHunter" ADD CONSTRAINT "HuntHunter_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
