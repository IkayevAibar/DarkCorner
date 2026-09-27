import type {
  AdminPlayer, AdminPlayerDecision, AdminPlayersResponse, ApiErrorBody, AuthStatus, CreateHeroRequest, CreationOptions,
  DevLoginRequest, HeroDraft, HeroResponse, HeroView, LabyrinthResult, LogoutResponse, MeResponse, MoveItemRequest,
  MyHeroResponse, SlotId, UpdateMeRequest,
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
};
