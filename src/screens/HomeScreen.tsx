import { Link } from 'react-router-dom';
import { signOutUser } from '../data/auth';
import { pairName, useCoachData } from '../data/CoachData';

function confirmSignOut() {
  if (!navigator.onLine) {
    window.alert('Sin conexión no se puede volver a entrar. Cierra sesión cuando tengas red.');
    return;
  }
  if (window.confirm('¿Cerrar sesión?')) void signOutUser();
}

export default function HomeScreen() {
  const { matches, players, loading } = useCoachData();

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">Partidos</h1>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {loading && <p className="text-slate-400">Cargando…</p>}
        {!loading && matches.length === 0 && <p className="text-slate-400">Todavía no hay partidos.</p>}
        {matches.map((m) => (
          <Link key={m.id} to={`/partido/${m.id}`} className="block rounded-xl bg-slate-800 p-4">
            <p className="font-bold">
              {pairName(players, m.playerIds)} vs {m.opponentsName}
            </p>
            <p className="text-sm text-slate-400">
              {new Date(m.date).toLocaleDateString('es-ES')} · {m.status === 'in_progress' ? 'En curso' : 'Terminado'}
            </p>
          </Link>
        ))}
      </div>

      <Link to="/nuevo" className="rounded-xl bg-blue-600 p-4 text-center text-lg font-bold">
        Nuevo partido
      </Link>
      <div className="flex gap-2">
        <Link to="/jugadores" className="flex-1 rounded-xl bg-slate-800 p-3 text-center">
          Jugadores
        </Link>
        <button onClick={confirmSignOut} className="flex-1 rounded-xl bg-slate-800 p-3">
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
