import { z } from 'zod';
import type { App } from '../router.js';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { requireApproved } from '../lib/session.js';
import { worldSettings } from '../settings.js';
import type { WorldSettings } from '../world.js';

/**
 * The Save's own settings (docs/plan-solo-offline.md, decisions 5 and 6): Story,
 * Normal or Hard, and Iron mode. Chosen before the first Hero, then fixed. Solo
 * only: the server has neither.
 */
export interface SoloSettingsView extends WorldSettings {
  /** A Hero has been made: the choice stands for this Save. */
  locked: boolean;
}

const settingsSchema = z.object({ difficulty: z.enum(['story', 'normal', 'hard']), iron: z.boolean() });

async function view(): Promise<SoloSettingsView> {
  return { ...worldSettings(), locked: (await prisma.hero.count()) > 0 };
}

export async function soloRoutes(app: App) {
  const guard = { preHandler: requireApproved };

  app.get('/api/solo/settings', guard, async (): Promise<SoloSettingsView> => view());

  app.put('/api/solo/settings', guard, async (request): Promise<SoloSettingsView> => {
    const choice = settingsSchema.parse(request.body);
    if ((await prisma.hero.count()) > 0) throw ApiError.conflict('settings_locked', 'Chosen when the Save began');
    // The World's own settings object: the backend sees the change and saves it.
    Object.assign(worldSettings(), choice);
    return view();
  });
}
