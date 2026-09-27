-- CreateTable
CREATE TABLE "Bounty" (
    "id" TEXT NOT NULL,
    "heroId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "weekly" BOOLEAN NOT NULL DEFAULT false,
    "slot" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "params" JSONB NOT NULL DEFAULT '{}',
    "reward" JSONB NOT NULL,
    "doneAt" TIMESTAMP(3),
    "swapped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bounty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bounty_heroId_day_weekly_slot_key" ON "Bounty"("heroId", "day", "weekly", "slot");

-- AddForeignKey
ALTER TABLE "Bounty" ADD CONSTRAINT "Bounty_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "Hero"("id") ON DELETE CASCADE ON UPDATE CASCADE;
