import { orderBy, query } from 'firebase/firestore';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import OutcomeButtons from '../components/OutcomeButtons';
import Scoreboard from '../components/Scoreboard';
import SyncBadge from '../components/SyncBadge';
import { pairName, playerName, useCoachData } from '../data/CoachData';
import { addPoint, undoPoint } from '../data/mutations';
import { emotionsCol, pointsCol } from '../data/paths';
import { useQuery } from '../data/useQuery';
import { nextOrder } from '../domain/helpers';
import { computeMatchState } from '../domain/scoring';
import type { Emotion, Match, Outcome, Player, Point } from '../domain/types';

export default function TrackerScreen() {
  const { matchId } = useParams();
  const { uid, matches, players, loading } = useCoachData();
  const match = matches.find((m) => m.id === matchId);
  if (loading) return <p className="p-6 text-slate-400">Cargando…</p>;
  // Justo después de crear un partido puede tardar un instante en llegar a la lista local.
  if (!match) return <p className="p-6 text-slate-400">Abriendo partido… <Link to="/" className="underline">Volver</Link></p>;
  return <Tracker uid={uid} match={match} players={players} />;
}

function Tracker({ uid, match, players }: { uid: string; match: Match; players: Player[] }) {
  const pointsQ = useQuery<Point>(useMemo(() => query(pointsCol(uid, match.id), orderBy('order')), [uid, match.id]));
  const emotionsQ = useQuery<Emotion>(
    useMemo(() => query(emotionsCol(uid, match.id), orderBy('timestamp')), [uid, match.id]),
  );
  const points = pointsQ.data;
  const emotions = emotionsQ.data;

  const state = useMemo(
    () => computeMatchState(points, match.format, match.firstServer),
    [points, match.format, match.firstServer],
  );

  const leftId = match.leftPlayerId;
  const rightId = match.playerIds.find((id) => id !== leftId) ?? match.playerIds[1];
  const locked = state.finished || match.status === 'completed';

  const register = (outcome: Outcome, playerId: string | null) => {
    if (locked) return;
    addPoint(uid, match.id, { order: nextOrder(points), outcome, playerId });
  };

  const undo = () => {
    const last = points[points.length - 1];
    if (!last || match.status === 'completed') return;
    undoPoint(uid, match.id, last, emotions);
  };

  return (
    <div
      className="mx-auto flex h-full max-w-xl flex-col gap-2 p-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)', paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      <div className="flex items-center justify-between text-sm text-slate-400">
        <Link to="/">← Partidos</Link>
      </div>

      <Scoreboard
        key={points.length}
        usName={pairName(players, match.playerIds)}
        themName={match.opponentsName}
        state={state}
      />
      <SyncBadge hasPending={pointsQ.hasPending || emotionsQ.hasPending} pendingPoints={pointsQ.pending} />

      <div className="flex-1" />

      <OutcomeButtons
        left={{ id: leftId, name: playerName(players, leftId) }}
        right={{ id: rightId, name: playerName(players, rightId) }}
        disabled={locked}
        onRegister={register}
      />

      <div className="flex gap-2">
        <button
          onClick={undo}
          disabled={points.length === 0 || match.status === 'completed'}
          className="h-12 flex-1 rounded-xl bg-slate-800 font-bold active:brightness-125 disabled:opacity-30"
        >
          ↶ Deshacer
        </button>
      </div>
    </div>
  );
}
