import { type PushView, pushEndpointRequestSchema, pushPrefsRequestSchema, pushSubscribeRequestSchema } from '@dark/shared';
import { requirePlayer } from '../lib/session.js';
import type { App } from '../router.js';
import { pushView, setPushPrefs, subscribe, testPush, unsubscribe } from '../services/push.js';

/** Push notifications: the server's routes, answered by solo's push service (which has none to send). */
export async function pushRoutes(app: App) {
  const guard = { preHandler: requirePlayer };

  app.get('/api/push', guard, async (request): Promise<PushView> => pushView(request.player!));
  app.post('/api/push/subscribe', guard, async (request): Promise<PushView> =>
    subscribe(request.player!, pushSubscribeRequestSchema.parse(request.body)));
  app.post('/api/push/unsubscribe', guard, async (request): Promise<PushView> =>
    unsubscribe(request.player!, pushEndpointRequestSchema.parse(request.body).endpoint));
  app.put('/api/push/prefs', guard, async (request): Promise<PushView> =>
    setPushPrefs(request.player!, pushPrefsRequestSchema.parse(request.body).off));
  app.post('/api/push/test', guard, async (request): Promise<{ sent: boolean }> =>
    testPush(request.player!, pushEndpointRequestSchema.parse(request.body).endpoint));
}
