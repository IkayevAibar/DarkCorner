import { Navigate, Route, Routes } from 'react-router';
import { Shell } from './components/Shell';
import { Admin } from './screens/Admin';
import { LoadError, Loading, SignIn, Waiting } from './screens/Gate';
import { Heroes } from './screens/heroes/Heroes';
import { Labyrinth } from './screens/labyrinth/Labyrinth';
import { City, Loot } from './screens/Placeholders';
import { Sandbox } from './screens/Sandbox';
import { useSession } from './session';

export function App() {
  const { session } = useSession();

  if (session.state === 'loading') return <Loading />;
  if (session.state === 'error') return <LoadError />;
  if (session.state === 'signedOut') return <SignIn />;
  if (session.player.status !== 'approved') return <Waiting banned={session.player.status === 'banned'} />;

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/city" element={<City />} />
        <Route path="/labyrinth" element={<Labyrinth />} />
        <Route path="/loot" element={<Loot />} />
        <Route path="/heroes" element={<Heroes />} />
        {session.player.isAdmin && <Route path="/admin" element={<Admin />} />}
        {import.meta.env.DEV && <Route path="/sandbox" element={<Sandbox />} />}
        <Route path="*" element={<Navigate to="/city" replace />} />
      </Route>
    </Routes>
  );
}
