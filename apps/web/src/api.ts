import type {
  AdminGrant, AdminPlayer, AdminPlayerDecision, AdminPlayersResponse, AdminSeasonView, ApiErrorBody, AuthStatus, BlessingIdView,
  CreateHeroRequest, HallView, RollLogView, TavernView,
  CreationOptions, DevLoginRequest, EventAction, FaceAction, ForgeQuote, ForgeView, HeroDraft, HeroResponse, HeroView, IdentifyResult,
  LabyrinthResult, LogoutResponse, MarketView, MeResponse, MoveItemRequest, MyHeroResponse, OpenChestResult, ReforgeResult,
  SalvageResult, ShopView, SlotId, Stance, TempleView, TradeResult, UpdateMeRequest, UpgradeResult,
} from '@dark/shared';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | null,
  ) {
    super(body?.message ?? `HTTP ${status}`);
    this.name = 'ApiRequestError';
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const parsed = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiRequestError(response.status, parsed);
  }
  return (await response.json()) as T;
}

export const api = {
  authStatus: () => request<AuthStatus>('GET', '/auth/status'),
  devLogin: (body: DevLoginRequest) => request<MeResponse>('POST', '/auth/dev-login', body),
  logout: () => request<LogoutResponse>('POST', '/auth/logout'),
  me: () => request<MeResponse>('GET', '/api/me'),
  updateMe: (body: UpdateMeRequest) => request<MeResponse>('PATCH', '/api/me', body),
  adminPlayers: () => request<AdminPlayersResponse>('GET', '/api/admin/players'),
  decidePlayer: (id: string, decision: AdminPlayerDecision['decision']) =>
    request<{ player: AdminPlayer }>('POST', `/api/admin/players/${encodeURIComponent(id)}`, { decision }),

  heroOptions: () => request<CreationOptions>('GET', '/api/heroes/options'),
  myHero: () => request<MyHeroResponse>('GET', '/api/heroes/me'),
  startDraft: () => request<{ draft: HeroDraft }>('POST', '/api/heroes/draft'),
  rerollDraft: () => request<{ draft: HeroDraft }>('POST', '/api/heroes/draft/reroll'),
  createHero: (body: CreateHeroRequest) => request<{ hero: HeroView }>('POST', '/api/heroes', body),
  retireHero: () => request<MyHeroResponse>('POST', '/api/heroes/retire'),

  equipItem: (id: string, slot?: SlotId) => request<HeroResponse>('POST', `/api/items/${encodeURIComponent(id)}/equip`, { slot }),
  unequipItem: (id: string) => request<HeroResponse>('POST', `/api/items/${encodeURIComponent(id)}/unequip`),
  moveItem: (id: string, to: MoveItemRequest['to']) =>
    request<HeroResponse>('POST', `/api/items/${encodeURIComponent(id)}/move`, { to }),

  labyrinth: () => request<LabyrinthResult>('GET', '/api/labyrinth'),
  enterLabyrinth: (floor: number) => request<LabyrinthResult>('POST', '/api/labyrinth/enter', { floor }),
  moveTo: (to: number) => request<LabyrinthResult>('POST', '/api/labyrinth/move', { to }),
  descend: () => request<LabyrinthResult>('POST', '/api/labyrinth/descend'),
  ascend: () => request<LabyrinthResult>('POST', '/api/labyrinth/ascend'),
  leaveLabyrinth: () => request<LabyrinthResult>('POST', '/api/labyrinth/leave'),
  readPortal: () => request<LabyrinthResult>('POST', '/api/labyrinth/portal'),
  lootGrave: (id: string) => request<LabyrinthResult>('POST', `/api/labyrinth/graves/${encodeURIComponent(id)}/loot`),
  eventAction: (action: EventAction) => request<LabyrinthResult>('POST', '/api/labyrinth/event', action),
  face: (action: FaceAction) => request<LabyrinthResult>('POST', '/api/labyrinth/face', action),
  setStance: (stance: Stance) => request<LabyrinthResult>('POST', '/api/labyrinth/stance', { stance }),

  identify: (id: string) => request<IdentifyResult>('POST', `/api/items/${encodeURIComponent(id)}/identify`),
  openChest: (id: string) => request<OpenChestResult>('POST', `/api/items/${encodeURIComponent(id)}/open`),
  drink: (id: string) => request<HeroResponse>('POST', `/api/items/${encodeURIComponent(id)}/drink`),
  sell: (id: string, quantity?: number) => request<TradeResult>('POST', `/api/items/${encodeURIComponent(id)}/sell`, { quantity }),
  forgeQuote: (id: string) => request<ForgeQuote>('GET', `/api/items/${encodeURIComponent(id)}/forge`),
  upgrade: (id: string, protect: boolean) => request<UpgradeResult>('POST', `/api/items/${encodeURIComponent(id)}/upgrade`, { protect }),
  reforge: (id: string) => request<ReforgeResult>('POST', `/api/items/${encodeURIComponent(id)}/reforge`),
  salvage: (id: string) => request<SalvageResult>('POST', `/api/items/${encodeURIComponent(id)}/salvage`),

  shop: () => request<ShopView>('GET', '/api/shop'),
  shopBuy: (offer: string, quantity = 1) => request<TradeResult>('POST', '/api/shop/buy', { offer, quantity }),
  forge: () => request<ForgeView>('GET', '/api/forge'),
  craft: (recipe: string, quantity = 1) => request<HeroResponse>('POST', '/api/forge/craft', { recipe, quantity }),
  market: () => request<MarketView>('GET', '/api/market'),
  list: (itemId: string, price: number) => request<MarketView>('POST', '/api/market/list', { itemId, price }),
  buyListing: (id: string) => request<MarketView>('POST', `/api/market/${encodeURIComponent(id)}/buy`),
  cancelListing: (id: string) => request<MarketView>('POST', `/api/market/${encodeURIComponent(id)}/cancel`),
  temple: () => request<TempleView>('GET', '/api/temple'),
  bless: (blessing: BlessingIdView) => request<TempleView>('POST', '/api/temple/bless', { blessing }),

  tavern: () => request<TavernView>('GET', '/api/tavern'),
  hall: () => request<HallView>('GET', '/api/hall'),
  adminSeason: () => request<AdminSeasonView>('GET', '/api/admin/season'),
  adminSeasonAction: (action: 'start' | 'end' | 'gate' | 'vault' | 'discard', minutes?: number) =>
    request<AdminSeasonView>('POST', '/api/admin/season', { action, minutes }),
  adminGrant: (body: AdminGrant) => request<{ ok: true }>('POST', '/api/admin/grant', body),
  adminRolls: (kind?: string) => request<RollLogView>('GET', `/api/admin/rolls${kind ? `?kind=${encodeURIComponent(kind)}` : ''}`),
};
