import { useAuth, signOutUser } from './data/auth';
import LoginScreen from './screens/LoginScreen';

export default function App() {
  const { user } = useAuth();
  if (user === undefined) return <p className="p-6 text-slate-400">Cargando…</p>;
  if (user === null) return <LoginScreen />;
  return (
    <div className="p-6">
      <p>Sesión iniciada: {user.email}</p>
      <button onClick={() => void signOutUser()} className="mt-4 rounded-lg bg-slate-800 px-4 py-2">
        Cerrar sesión
      </button>
    </div>
  );
}
