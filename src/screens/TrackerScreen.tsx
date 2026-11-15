import { orderBy, query } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import EmotionSheet from '../components/EmotionSheet';
import OutcomeButtons from '../components/OutcomeButtons';
import Scoreboard from '../components/Scoreboard';
import ShotRow from '../components/ShotRow';
import SyncBadge from '../components/SyncBadge';
import { pairName, playerName, useCoachData } from '../data/CoachData';
import { addEmotion, addPoint, setPointShot, undoPoint, updateMatch } from '../data/mutations';
import { emotionsCol, pointsCol } from '../data/paths';
import { useQuery } from '../data/useQuery';
import { nextOrder } from '../domain/helpers';
import { computeMatchState } from '../domain/scoring';
import type { Emotion, EmotionTag, Match, Outcome, Player, Point, Shot } from '../domain/types';
import { useWakeLock } from '../hooks/useWakeLock';

export default function TrackerScreen() {
  const { matchId } = useParams();
  const { uid, matches, players, loading } = useCoachData();
  const match = matches.find((m) => m.id === matchId);
  if (loading) return <p className="p-6 text-slate-400">Cargando…</p>;
  // Justo después de crear un partido puede tardar un instante en llegar a la lista local.
  if (!match) return <p className="p-6 text-slate-400">Abriendo partido… <Link to="/" className="underline">Volver</Link></p>;
  return <Tracker uid={uid} match={match} players={players} />;
}

const SHOT_ROW_MS = 4000;

function Tracker({ uid, match, players }: { uid: string; match: Match; players: Player[] }) {
  useWakeLock();
  const navigate = useNavigate();
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

  // Punto para el que se ofrece la fila de golpes; null si no se muestra.
  const [shotFor, setShotFor] = useState<string | null>(null);
  const [emotionOpen, setEmotionOpen] = useState(false);

  useEffect(() => {
    if (!shotFor) return;
    const timer = setTimeout(() => setShotFor(null), SHOT_ROW_MS);
    return () => clearTimeout(timer);
  }, [shotFor]);

  const leftId = match.leftPlayerId;
  const rightId = match.playerIds.find((id) => id !== leftId) ?? match.playerIds[1];
  const closed = match.status === 'completed';
  const locked = state.finished || closed;
  const lastPoint = points[points.length - 1];

  const register = (outcome: Outcome, playerId: string | null) => {
    if (locked) return;
    const id = addPoint(uid, match.id, { order: nextOrder(points), outcome, playerId });
    // Solo los puntos de nuestra pareja con jugador ofrecen elegir golpe.
    setShotFor(playerId ? id : null);
  };

  const pickShot = (shot: Shot) => {
    if (shotFor) setPointShot(uid, match.id, shotFor, shot);
    setShotFor(null);
  };

  const undo = () => {
    if (!lastPoint || closed) return;
    undoPoint(uid, match.id, lastPoint, emotions);
    setShotFor(null);
  };

  const pickEmotion = (playerId: string, tag: EmotionTag) => {
    addEmotion(uid, match.id, { playerId, tag, afterPointId: lastPoint?.id ?? null });
    setEmotionOpen(false);
  };

  const swapSides = () => updateMatch(uid, match.id, { leftPlayerId: rightId });

  const finish = () => {
    const question = state.finished ? '¿Cerrar el partido?' : 'El partido no ha terminado. ¿Finalizarlo igualmente?';
    if (!window.confirm(question)) return;
    updateMatch(uid, match.id, { status: 'completed' });
    navigate('/');
  };

  return (
    <div
      className="mx-auto flex h-full max-w-xl flex-col gap-2 p-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)', paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      <div className="flex items-center justify-between text-sm text-slate-400">
        <Link to="/">← Partidos</Link>
        {!closed && (
          <div className="flex gap-4">
            <button onClick={swapSides}>⇄ Cambiar lados</button>
            <button onClick={finish} className={state.finished ? 'font-bold text-green-400' : ''}>
              Finalizar partido
            </button>
          </div>
        )}
      </div>

      <Scoreboard
        key={points.length}
        usName={pairName(players, match.playerIds)}
        themName={match.opponentsName}
        state={state}
      />
      <SyncBadge hasPending={pointsQ.hasPending || emotionsQ.hasPending} pendingPoints={pointsQ.pending} />

      <div className="flex flex-1 flex-col justify-end">
        {closed && <p className="text-center text-slate-400">Partido cerrado.</p>}
        {shotFor && !closed && <ShotRow onPick={pickShot} />}
      </div>

      <OutcomeButtons
        left={{ id: leftId, name: playerName(players, leftId) }}
        right={{ id: rightId, name: playerName(players, rightId) }}
        disabled={locked}
        onRegister={register}
      />

      <div className="flex gap-2">
        <button
          onClick={undo}
          disabled={!lastPoint || closed}
          className="h-12 flex-1 rounded-xl bg-slate-800 font-bold active:brightness-125 disabled:opacity-30"
        >
          ↶ Deshacer
        </button>
        <button
          onClick={() => setEmotionOpen(true)}
          disabled={closed}
          className="h-12 flex-1 rounded-xl bg-slate-800 font-bold active:brightness-125 disabled:opacity-30"
        >
          Emoción
        </button>
      </div>

      {emotionOpen && (
        <EmotionSheet
          players={[
            { id: leftId, name: playerName(players, leftId) },
            { id: rightId, name: playerName(players, rightId) },
          ]}
          onPick={pickEmotion}
          onClose={() => setEmotionOpen(false)}
        />
      )}
    </div>
  );
}
