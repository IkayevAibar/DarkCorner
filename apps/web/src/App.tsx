import { type ComponentType, lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Shell } from './components/Shell';
import { useI18n } from './i18n';
import { City } from './screens/city/City';
import { LoadError, Loading, SignIn, Waiting } from './screens/Gate';
import { useSession } from './session';

/**
 * Screens load when first opened, so a phone downloads only what it uses. The
 * City is the landing screen and comes with the first load.
 */
function screen<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(async () => ({ default: (await load())[name] }));
}

const Labyrinth = screen(() => import('./screens/labyrinth/Labyrinth'), 'Labyrinth');
const Loot = screen(() => import('./screens/loot/Loot'), 'Loot');
const Heroes = screen(() => import('./screens/heroes/Heroes'), 'Heroes');
const Shop = screen(() => import('./screens/city/Shop'), 'Shop');
const Forge = screen(() => import('./screens/city/Forge'), 'Forge');
const Market = screen(() => import('./screens/city/Market'), 'Market');
const Temple = screen(() => import('./screens/city/Temple'), 'Temple');
const Tavern = screen(() => import('./screens/city/Tavern'), 'Tavern');
const Admin = screen(() => import('./screens/Admin'), 'Admin');
/** Development builds only: production never ships the sandbox or its fixtures. */
const Sandbox = import.meta.env.DEV ? screen(() => import('./screens/Sandbox'), 'Sandbox') : null;

function ScreenLoading() {
  const { t } = useI18n();
  return <p className="text-center text-muted">{t('loading')}</p>;
}

export function App() {
  const { session } = useSession();

  if (session.state === 'loading') return <Loading />;
  if (session.state === 'error') return <LoadError />;
  if (session.state === 'signedOut') return <SignIn />;
  if (session.player.status !== 'approved') return <Waiting banned={session.player.status === 'banned'} />;

  const page = (Screen: ComponentType) => (
    <Suspense fallback={<ScreenLoading />}>
      <Screen />
    </Suspense>
  );

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/city" element={<City />} />
        <Route path="/city/shop" element={page(Shop)} />
        <Route path="/city/forge" element={page(Forge)} />
        <Route path="/city/market" element={page(Market)} />
        <Route path="/city/temple" element={page(Temple)} />
        <Route path="/city/tavern" element={page(Tavern)} />
        <Route path="/labyrinth" element={page(Labyrinth)} />
        <Route path="/loot" element={page(Loot)} />
        <Route path="/heroes" element={page(Heroes)} />
        {session.player.isAdmin && <Route path="/admin" element={page(Admin)} />}
        {Sandbox && <Route path="/sandbox" element={page(Sandbox)} />}
        <Route path="*" element={<Navigate to="/city" replace />} />
      </Route>
    </Routes>
  );
}
