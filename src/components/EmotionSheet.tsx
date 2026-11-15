import { useState } from 'react';
import { EMOTION_GRID, EMOTION_LABEL, POSITIVE_EMOTIONS } from '../domain/helpers';
import type { EmotionTag } from '../domain/types';

export default function EmotionSheet(props: {
  players: { id: string; name: string }[];
  onPick: (playerId: string, tag: EmotionTag) => void;
  onClose: () => void;
}) {
  const [playerId, setPlayerId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60" onClick={props.onClose}>
      <div
        className="space-y-3 rounded-t-2xl bg-slate-900 p-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-sm text-slate-400">¿De quién?</p>
        <div className="flex gap-2">
          {props.players.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlayerId(p.id)}
              className={`h-14 flex-1 rounded-xl font-bold ${playerId === p.id ? 'bg-blue-600' : 'bg-slate-700'}`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {EMOTION_GRID.map((tag) => (
            <button
              key={tag}
              disabled={playerId === null}
              onClick={() => playerId && props.onPick(playerId, tag)}
              className={`h-16 rounded-xl px-1 text-sm font-semibold leading-tight disabled:opacity-30 ${
                POSITIVE_EMOTIONS.includes(tag) ? 'bg-green-800' : 'bg-red-900'
              }`}
            >
              {EMOTION_LABEL[tag]}
            </button>
          ))}
        </div>
        <button onClick={props.onClose} className="h-12 w-full rounded-xl bg-slate-800">
          Cancelar
        </button>
      </div>
    </div>
  );
}
