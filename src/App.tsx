import { Route, Routes } from 'react-router-dom';
import WriteErrorBanner from './components/WriteErrorBanner';
import { useAuth } from './data/auth';
import { CoachDataProvider } from './data/CoachData';
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import PlayersScreen from './screens/PlayersScreen';

export default function App() {
  const { user } = useAuth();
  if (user === undefined) return <p className="p-6 text-slate-400">Cargando…</p>;
  if (user === null) return <LoginScreen />;
  return (
    <CoachDataProvider uid={user.uid}>
      <WriteErrorBanner />
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/jugadores" element={<PlayersScreen />} />
      </Routes>
    </CoachDataProvider>
  );
}
