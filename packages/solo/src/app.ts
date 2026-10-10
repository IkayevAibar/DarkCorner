import { Router } from './router.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { cityRoutes } from './routes/city.js';
import { companionRoutes } from './routes/companion.js';
import { delveRoutes } from './routes/delve.js';
import { duoRoutes } from './routes/duo.js';
import { heroRoutes } from './routes/heroes.js';
import { itemRoutes } from './routes/items.js';
import { labyrinthRoutes } from './routes/labyrinth.js';
import { meRoutes } from './routes/me.js';
import { pushRoutes } from './routes/push.js';
import { soloRoutes } from './routes/solo.js';
import { stepsRoutes } from './routes/steps.js';
import { tavernRoutes } from './routes/tavern.js';
import './services/jobs.js';

/**
 * The router with every route solo answers: apps/api/src/app.ts without the
 * sign-in hub. The admin routes stay for the ported scenarios; the solo Player
 * is no admin, so the game itself never reaches them.
 */
export class SoloApp extends Router {
  async close(): Promise<void> {}
}

export async function buildApp(): Promise<SoloApp> {
  const app = new SoloApp();
  app.get('/api/health', async () => ({ ok: true }));
  await authRoutes(app);
  await meRoutes(app);
  await adminRoutes(app);
  await heroRoutes(app);
  await itemRoutes(app);
  await labyrinthRoutes(app);
  await cityRoutes(app);
  await tavernRoutes(app);
  await pushRoutes(app);
  await delveRoutes(app);
  await stepsRoutes(app);
  await duoRoutes(app);
  await soloRoutes(app);
  await companionRoutes(app);
  return app;
}
