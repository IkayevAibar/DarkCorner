import type { FastifyInstance } from 'fastify';
import {
  type CreationOptions, type HeroDraft, type HeroResponse, type MyHeroResponse, choosePathRequestSchema, createHeroRequestSchema, growRequestSchema,
} from '@dark/shared';
import { requireApproved } from '../lib/session.js';
import {
  choosePath, createHero, creationOptions, growHero, myHeroState, rerollDraft, retireHero, startDraft,
} from '../services/heroes.js';

export async function heroRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireApproved };

  app.get('/api/heroes/options', guard, async (): Promise<CreationOptions> => creationOptions());

  app.get('/api/heroes/me', guard, async (request): Promise<MyHeroResponse> => myHeroState(request.player!));

  app.post('/api/heroes/draft', guard, async (request): Promise<{ draft: HeroDraft }> => ({
    draft: await startDraft(request.player!),
  }));

  app.post('/api/heroes/draft/reroll', guard, async (request): Promise<{ draft: HeroDraft }> => ({
    draft: await rerollDraft(request.player!),
  }));

  app.post('/api/heroes', guard, async (request) => {
    const body = createHeroRequestSchema.parse(request.body);
    return { hero: await createHero(request.player!, body) };
  });

  app.post('/api/heroes/path', guard, async (request): Promise<HeroResponse> => ({
    hero: await choosePath(request.player!, choosePathRequestSchema.parse(request.body).path),
  }));

  app.post('/api/heroes/grow', guard, async (request): Promise<HeroResponse> => ({
    hero: await growHero(request.player!, growRequestSchema.parse(request.body)),
  }));

  app.post('/api/heroes/retire', guard, async (request): Promise<MyHeroResponse> => {
    await retireHero(request.player!);
    return myHeroState(request.player!);
  });
}
