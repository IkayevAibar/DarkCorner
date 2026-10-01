import type { FastifyInstance } from 'fastify';
import {
  type AcademyView, type ForgeView, type HeroResponse, type MarketView, type ShopView, type TempleView, type TradeResult, type TrainingView,
  blessRequestSchema, craftRequestSchema, learnTalentRequestSchema, listRequestSchema, shopBuyRequestSchema, trainRequestSchema,
} from '@dark/shared';
import { academyView, learnTalent } from '../services/academy.js';
import { startTraining, trainingView } from '../services/training.js';
import { requireApproved } from '../lib/session.js';
import { craft, forgeView } from '../services/forge.js';
import { buyListing, cancelListing, listItem, marketView } from '../services/market.js';
import { buyFromShop, shopView } from '../services/shop.js';
import { buyBlessing, templeView } from '../services/temple.js';

/** The City's buildings: Shops, the Forge, the Market, the Temple, the Academy and the Training grounds. */
export async function cityRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireApproved };
  type ById = { Params: { id: string } };

  app.get('/api/shop', guard, async (request): Promise<ShopView> => shopView(request.player!));
  app.post('/api/shop/buy', guard, async (request): Promise<TradeResult> => {
    const { offer, quantity } = shopBuyRequestSchema.parse(request.body);
    return buyFromShop(request.player!, offer, quantity);
  });

  app.get('/api/forge', guard, async (request): Promise<ForgeView> => forgeView(request.player!));
  app.post('/api/forge/craft', guard, async (request): Promise<HeroResponse> => {
    const { recipe, quantity } = craftRequestSchema.parse(request.body);
    return { hero: await craft(request.player!, recipe, quantity) };
  });

  app.get('/api/market', guard, async (request): Promise<MarketView> => marketView(request.player!));
  app.post('/api/market/list', guard, async (request): Promise<MarketView> => {
    const { itemId, price } = listRequestSchema.parse(request.body);
    return listItem(request.player!, itemId, price);
  });
  app.post<ById>('/api/market/:id/buy', guard, async (request): Promise<MarketView> => buyListing(request.player!, request.params.id));
  app.post<ById>('/api/market/:id/cancel', guard, async (request): Promise<MarketView> => cancelListing(request.player!, request.params.id));

  app.get('/api/temple', guard, async (request): Promise<TempleView> => templeView(request.player!));
  app.post('/api/temple/bless', guard, async (request): Promise<TempleView> => {
    const { blessing } = blessRequestSchema.parse(request.body);
    return buyBlessing(request.player!, blessing);
  });

  app.get('/api/academy', guard, async (request): Promise<AcademyView> => academyView(request.player!));
  app.post('/api/academy/learn', guard, async (request): Promise<AcademyView> => {
    const { talent } = learnTalentRequestSchema.parse(request.body);
    return learnTalent(request.player!, talent);
  });

  app.get('/api/training', guard, async (request): Promise<TrainingView> => trainingView(request.player!));
  app.post('/api/training/start', guard, async (request): Promise<TrainingView> => {
    const { ability } = trainRequestSchema.parse(request.body);
    return startTraining(request.player!, ability);
  });
}
