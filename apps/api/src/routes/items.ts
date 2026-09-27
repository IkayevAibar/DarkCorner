import type { FastifyInstance } from 'fastify';
import {
  type ForgeQuote, type HeroResponse, type IdentifyResult, type OpenChestResult, type ReforgeResult, type SalvageResult,
  type TradeResult, type UpgradeResult, equipRequestSchema, moveItemRequestSchema, sellRequestSchema, upgradeRequestSchema,
} from '@dark/shared';
import { requireApproved } from '../lib/session.js';
import { forgeQuote, reforgeItem, salvageItem, upgradeItem } from '../services/forge.js';
import { dropItem, equipItem, moveItem, unequipItem } from '../services/inventory.js';
import { drinkPotion, identifyItem, openChest } from '../services/itemUse.js';
import { sellToShop } from '../services/shop.js';

export async function itemRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireApproved };
  type ById = { Params: { id: string } };

  app.post<ById>('/api/items/:id/equip', guard, async (request): Promise<HeroResponse> => {
    const { slot } = equipRequestSchema.parse(request.body);
    return { hero: await equipItem(request.player!, request.params.id, slot) };
  });

  app.post<ById>('/api/items/:id/unequip', guard, async (request): Promise<HeroResponse> => ({
    hero: await unequipItem(request.player!, request.params.id),
  }));

  app.post<ById>('/api/items/:id/move', guard, async (request): Promise<HeroResponse> => {
    const { to } = moveItemRequestSchema.parse(request.body);
    return { hero: await moveItem(request.player!, request.params.id, to) };
  });

  app.post<ById>('/api/items/:id/drop', guard, async (request): Promise<HeroResponse> => ({
    hero: await dropItem(request.player!, request.params.id),
  }));

  app.post<ById>('/api/items/:id/identify', guard, async (request): Promise<IdentifyResult> => identifyItem(request.player!, request.params.id));
  app.post<ById>('/api/items/:id/open', guard, async (request): Promise<OpenChestResult> => openChest(request.player!, request.params.id));
  app.post<ById>('/api/items/:id/drink', guard, async (request): Promise<HeroResponse> => ({
    hero: await drinkPotion(request.player!, request.params.id),
  }));

  app.post<ById>('/api/items/:id/sell', guard, async (request): Promise<TradeResult> => {
    const { quantity } = sellRequestSchema.parse(request.body);
    return sellToShop(request.player!, request.params.id, quantity);
  });

  app.get<ById>('/api/items/:id/forge', guard, async (request): Promise<ForgeQuote> => forgeQuote(request.player!, request.params.id));
  app.post<ById>('/api/items/:id/upgrade', guard, async (request): Promise<UpgradeResult> => {
    const { protect } = upgradeRequestSchema.parse(request.body);
    return upgradeItem(request.player!, request.params.id, protect);
  });
  app.post<ById>('/api/items/:id/reforge', guard, async (request): Promise<ReforgeResult> => reforgeItem(request.player!, request.params.id));
  app.post<ById>('/api/items/:id/salvage', guard, async (request): Promise<SalvageResult> => salvageItem(request.player!, request.params.id));
}
