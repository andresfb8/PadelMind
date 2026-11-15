import { orderBy, query } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import MatchDataEditor from '../components/review/MatchDataEditor';
import PointEditor from '../components/review/PointEditor';
import { pairName, playerName, useCoachData } from '../data/CoachData';
import { addEmotion, deleteEmotion, deletePoint, insertPoint, updateMatch, updatePoint } from '../data/mutations';
import { emotionsCol, pointsCol } from '../data/paths';
import { useQuery } from '../data/useQuery';
import { setsLabel } from '../domain/analytics/report';
import { OUTCOME_LABEL, SHOT_LABEL, ZONE_LABEL } from '../domain/helpers';
import { insertOrder } from '../domain/ordering';
import { buildReviewRows, draftOf, emptyDraft, type PointFields, type ReviewRow } from '../domain/review';
import { computeMatchState } from '../domain/scoring';
import type { Emotion, Match, Player, Point } from '../domain/types';

export default function ReviewScreen() {
  const { matchId } = useParams();
  const { uid, matches, players, loading } = useCoachData();
  const match = matches.find((m) => m.id === matchId);
  if (loading) return <p className="p-6 text-slate-400">Cargando…</p>;
  if (!match) {
    return (
      <p className="p-6 text-slate-400">
        Partido no encontrado. <Link to="/" className="underline">Volver</Link>
      </p>
    );
  }
  return <Review uid={uid} match={match} players={players} />;
}

type Editing =
  | { kind: 'edit'; pointId: string }
  | { kind: 'insert'; index: number; where: 'before' | 'after' };

function RowButton({ row, name, onClick }: { row: ReviewRow; name: (id: string) => string; onClick: () => void }) {
  const { point } = row;
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl p-3 text-left ${row.extra ? 'bg-slate-900 opacity-60' : 'bg-slate-800'}`}
    >
      <div className="flex justify-between gap-2 text-xs text-slate-400">
        <span>
          {row.number} · {row.situation ?? 'Sobrante: después del final del partido'}
        </span>
        {row.emotions.length > 0 && <span>{row.emotions.length} emoc.</span>}
      </div>
      <p className="font-bold">
        {OUTCOME_LABEL[point.outcome]}
        {point.playerId && ` · ${name(point.playerId)}`}
      </p>
      {point.playerId && (
        <p className="text-sm text-slate-300">
          {point.shot ? SHOT_LABEL[point.shot] : '—'} · {point.zone ? ZONE_LABEL[point.zone] : '—'}
        </p>
      )}
      {row.missing.length > 0 && <p className="text-xs text-amber-400">Falta: {row.missing.join(', ')}</p>}
    </button>
  );
}

function Review({ uid, match, players }: { uid: string; match: Match; players: Player[] }) {
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
  const rows = useMemo(() => buildReviewRows(points, state, emotions), [points, state, emotions]);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(false);

  if (pointsQ.loading) return <p className="p-6 text-slate-400">Cargando…</p>;

  const name = (id: string) => playerName(players, id);
  const ourPlayers = match.playerIds.map((id) => ({ id, name: name(id) }));
  const incomplete = rows.filter((r) => r.missing.length > 0).length;
  const shown = onlyMissing ? rows.filter((r) => r.missing.length > 0) : rows;
  const editedRow = editing?.kind === 'edit' ? rows.find((r) => r.point.id === editing.pointId) : undefined;
  // El siguiente punto por completar después del que se está editando (para "Guardar y pasar al siguiente").
  const nextIncomplete = editedRow ? rows.find((r) => r.number > editedRow.number && r.missing.length > 0) : undefined;

  const saveEdit = (fields: PointFields) => {
    if (editing?.kind === 'edit') updatePoint(uid, match.id, editing.pointId, fields);
    setEditing(null);
  };

  const saveAndNext = (fields: PointFields) => {
    if (editing?.kind === 'edit') updatePoint(uid, match.id, editing.pointId, fields);
    setEditing(nextIncomplete ? { kind: 'edit', pointId: nextIncomplete.point.id } : null);
  };

  const saveInsert = (fields: PointFields) => {
    if (editing?.kind !== 'insert') return;
    const order = insertOrder(points, editing.index, editing.where, Date.now());
    if (order === null) {
      window.alert('No se puede insertar ahí: los puntos están demasiado pegados.');
      return;
    }
    insertPoint(uid, match.id, { ...fields, order });
    setEditing(null);
  };

  const remove = (row: ReviewRow) => {
    if (!window.confirm(`¿Borrar el punto ${row.number}? También se borran sus emociones.`)) return;
    deletePoint(uid, match.id, row.point, emotions);
    setEditing(null);
  };

  return (
    <div className="mx-auto h-full max-w-xl overflow-y-auto">
      <div className="flex items-center justify-between p-3 text-sm text-slate-400">
        <Link to="/" className="py-2">← Partidos</Link>
        <div className="flex gap-3">
          <Link to={`/partido/${match.id}/informe`} className="px-2 py-2">Informe</Link>
          {match.status === 'in_progress' && <Link to={`/partido/${match.id}`} className="px-2 py-2">Registro</Link>}
        </div>
      </div>

      <div className="space-y-3 px-3 pb-8">
        <div>
          <h1 className="text-lg font-bold">
            {pairName(players, match.playerIds)} vs {match.opponentsName}
          </h1>
          <p className="text-sm text-slate-400">
            {setsLabel(state)} · {rows.length} {rows.length === 1 ? 'punto' : 'puntos'}
          </p>
        </div>

        <MatchDataEditor key={match.id} match={match} onChange={(patch) => updateMatch(uid, match.id, patch)} />

        <div className="flex gap-2 text-sm">
          <button onClick={() => setOnlyMissing(false)} className={`rounded-lg px-3 py-2 font-semibold ${!onlyMissing ? 'bg-blue-600' : 'bg-slate-800'}`}>
            Todos ({rows.length})
          </button>
          <button onClick={() => setOnlyMissing(true)} className={`rounded-lg px-3 py-2 font-semibold ${onlyMissing ? 'bg-blue-600' : 'bg-slate-800'}`}>
            Por completar ({incomplete})
          </button>
        </div>

        <div className="space-y-2">
          {shown.length === 0 && (
            <p className="py-6 text-center text-slate-400">
              {rows.length === 0 ? 'Todavía no hay puntos.' : 'No queda ningún punto por completar.'}
            </p>
          )}
          {shown.map((row) => (
            <RowButton key={row.point.id} row={row} name={name} onClick={() => setEditing({ kind: 'edit', pointId: row.point.id })} />
          ))}
        </div>

        <button
          onClick={() => setEditing({ kind: 'insert', index: Math.max(points.length - 1, 0), where: 'after' })}
          className="h-12 w-full rounded-xl bg-slate-800 font-bold"
        >
          + Añadir punto al final
        </button>
      </div>

      {editing?.kind === 'edit' && editedRow && (
        <PointEditor
          key={editing.pointId}
          title={`Punto ${editedRow.number}`}
          initial={draftOf(editedRow.point)}
          players={ourPlayers}
          onSave={saveEdit}
          onSaveAndNext={nextIncomplete ? saveAndNext : undefined}
          onClose={() => setEditing(null)}
          existing={{
            emotions: editedRow.emotions,
            onAddEmotion: (playerId, tag) => addEmotion(uid, match.id, { playerId, tag, afterPointId: editedRow.point.id }),
            onDeleteEmotion: (emotionId) => deleteEmotion(uid, match.id, emotionId),
            onInsertBefore: () => setEditing({ kind: 'insert', index: editedRow.number - 1, where: 'before' }),
            onInsertAfter: () => setEditing({ kind: 'insert', index: editedRow.number - 1, where: 'after' }),
            onDelete: () => remove(editedRow),
          }}
        />
      )}
      {editing?.kind === 'insert' && (
        <PointEditor
          key={`nuevo-${editing.index}-${editing.where}`}
          title="Punto nuevo"
          initial={emptyDraft}
          players={ourPlayers}
          onSave={saveInsert}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
