import type { AuthStatus, LogoutResponse } from '@dark/shared';
import type { App } from '../router.js';

/** Solo: nobody signs in. The web asks anyway and hears there is no sign-in to do. */
export async function authRoutes(app: App) {
  app.get('/auth/status', async (): Promise<AuthStatus> => ({ sso: false, loginUrl: null, logoutUrl: null, devLogin: false }));
  app.post('/auth/logout', async (): Promise<LogoutResponse> => ({ ok: true, redirect: null }));
}
