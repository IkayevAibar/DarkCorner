import type {
  AdminPlayer, AdminPlayerDecision, AdminPlayersResponse, ApiErrorBody, AuthStatus, CreateHeroRequest, CreationOptions,
  DevLoginRequest, HeroDraft, HeroView, LogoutResponse, MeResponse, MyHeroResponse, UpdateMeRequest,
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
};
