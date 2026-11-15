import { Route, Routes } from 'react-router-dom';
import WriteErrorBanner from './components/WriteErrorBanner';
import { useAuth } from './data/auth';
import { CoachDataProvider } from './data/CoachData';
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import NewMatchScreen from './screens/NewMatchScreen';
import PlayersScreen from './screens/PlayersScreen';
import ReportScreen from './screens/ReportScreen';
import ReviewScreen from './screens/ReviewScreen';
import TrackerScreen from './screens/TrackerScreen';

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
        <Route path="/nuevo" element={<NewMatchScreen />} />
        <Route path="/partido/:matchId" element={<TrackerScreen />} />
        <Route path="/partido/:matchId/informe" element={<ReportScreen />} />
        <Route path="/partido/:matchId/revision" element={<ReviewScreen />} />
      </Routes>
    </CoachDataProvider>
  );
}
