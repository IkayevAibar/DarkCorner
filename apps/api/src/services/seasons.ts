import type { Season } from '@prisma/client';
import { prisma } from '../db.js';
import { newSeed } from '../lib/seed.js';

/**
 * The Season Players are in: the newest one that has not ended. Before any
 * exists, Season 0 is created as PLANNED so Heroes can be made ahead of launch;
 * admins start it for real in week 5.
 */
export async function currentSeason(): Promise<Season> {
  const open = await prisma.season.findFirst({
    where: { status: { not: 'ENDED' } },
    orderBy: { number: 'desc' },
  });
  if (open) return open;

  const last = await prisma.season.findFirst({ orderBy: { number: 'desc' } });
  const number = last ? last.number + 1 : 0;
  // Two first requests at once may both try; the unique number lets one win.
  return prisma.season.upsert({
    where: { number },
    create: { number, seed: newSeed() },
    update: {},
  });
}
