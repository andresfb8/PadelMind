import { useState } from 'react';
import { EMOTION_GRID, EMOTION_LABEL, SHOTS, SHOT_LABEL, ZONES, ZONE_LABEL } from '../../domain/helpers';
import { draftProblem, draftToFields, outcomeNeedsPlayer, type PointDraft, type PointFields } from '../../domain/review';
import type { Emotion, EmotionTag, Outcome } from '../../domain/types';

const OUTCOMES: { value: Outcome; label: string }[] = [
  { value: 'winner_nuestro', label: 'Winner nuestro' },
  { value: 'error_rival', label: 'Error rival' },
  { value: 'no_forzado_nuestro', label: 'No forzado nuestro' },
  { value: 'forzado_nuestro', label: 'Forzado nuestro' },
  { value: 'winner_rival', label: 'Winner rival' },
  { value: 'nuestro_sin_detalle', label: 'Punto nuestro, sin detalle' },
  { value: 'rival_sin_detalle', label: 'Punto rival, sin detalle' },
];

type Existing = {
  emotions: Emotion[];
  onAddEmotion: (playerId: string, tag: EmotionTag) => void;
  onDeleteEmotion: (emotionId: string) => void;
  onInsertBefore: () => void;
  onInsertAfter: () => void;
  onDelete: () => void;
};

type Props = {
  title: string;
  initial: PointDraft;
  players: { id: string; name: string }[];
  onSave: (fields: PointFields) => void;
  // Guarda y abre el siguiente punto por completar; solo se pasa si hay alguno.
  onSaveAndNext?: (fields: PointFields) => void;
  onClose: () => void;
  // Solo al editar un punto que ya existe (un punto nuevo aún no tiene emociones ni vecinos).
  existing?: Existing;
};

const chip = (active: boolean) => `rounded-lg px-3 py-2 text-sm font-semibold ${active ? 'bg-blue-600' : 'bg-slate-800'}`;

// Panel inferior para completar, corregir o crear un punto. Los cambios del punto se guardan con
// "Guardar"; las emociones y el borrado se aplican al momento.
export default function PointEditor({ title, initial, players, onSave, onSaveAndNext, onClose, existing }: Props) {
  const [draft, setDraft] = useState<PointDraft>(initial);
  const [emotionPlayer, setEmotionPlayer] = useState(players[0]?.id ?? '');
  const [emotionTag, setEmotionTag] = useState<EmotionTag>(EMOTION_GRID[0]);

  const problem = draftProblem(draft);
  const withPlayer = draft.outcome !== null && outcomeNeedsPlayer(draft.outcome);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? '¿?';

  const save = () => {
    const fields = draftToFields(draft);
    if (fields) onSave(fields);
  };

  const saveAndNext = () => {
    const fields = draftToFields(draft);
    if (fields && onSaveAndNext) onSaveAndNext(fields);
  };

  // Cerrar o saltar a otro punto descarta lo que no se haya guardado: se avisa antes.
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const discardable = (action: () => void) => () => {
    if (!dirty || window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) action();
  };
  const close = discardable(onClose);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60" onClick={close}>
      <div
        className="max-h-[92%] space-y-4 overflow-y-auto rounded-t-2xl bg-slate-900 p-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-center font-bold">{title}</h2>

        <section className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Cómo acabó</p>
          <div className="grid grid-cols-2 gap-2">
            {OUTCOMES.map((o) => (
              <button key={o.value} onClick={() => setDraft({ ...draft, outcome: o.value })} className={chip(draft.outcome === o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </section>

        {withPlayer && (
          <>
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">Jugador</p>
              <div className="grid grid-cols-2 gap-2">
                {players.map((p) => (
                  <button key={p.id} onClick={() => setDraft({ ...draft, playerId: p.id })} className={chip(draft.playerId === p.id)}>
                    {p.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">Golpe (tocar otra vez lo quita)</p>
              <div className="grid grid-cols-4 gap-2">
                {SHOTS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setDraft({ ...draft, shot: draft.shot === s ? null : s })}
                    className={chip(draft.shot === s)}
                  >
                    {SHOT_LABEL[s]}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">Zona (tocar otra vez la quita)</p>
              <div className="grid grid-cols-2 gap-2">
                {ZONES.map((z) => (
                  <button
                    key={z}
                    onClick={() => setDraft({ ...draft, zone: draft.zone === z ? null : z })}
                    className={chip(draft.zone === z)}
                  >
                    {ZONE_LABEL[z]}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {problem && <p className="text-sm text-amber-400">{problem}</p>}

        <div className="flex gap-2">
          <button onClick={close} className="h-12 flex-1 rounded-xl bg-slate-800 font-bold">
            Cancelar
          </button>
          <button onClick={save} disabled={problem !== null} className="h-12 flex-1 rounded-xl bg-blue-600 font-bold disabled:opacity-40">
            Guardar
          </button>
        </div>
        {onSaveAndNext && (
          <button
            onClick={saveAndNext}
            disabled={problem !== null}
            className="h-11 w-full rounded-xl bg-slate-800 text-sm font-bold disabled:opacity-40"
          >
            Guardar y pasar al siguiente por completar
          </button>
        )}

        {existing && (
          <>
            <section className="space-y-2 border-t border-slate-800 pt-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Emociones tras este punto</p>
              {existing.emotions.length === 0 && <p className="text-sm text-slate-500">Ninguna.</p>}
              {existing.emotions.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-sm">
                  <span>
                    {nameOf(e.playerId)} · {EMOTION_LABEL[e.tag]}
                  </span>
                  <button onClick={() => existing.onDeleteEmotion(e.id)} className="px-2 font-bold text-red-400" aria-label="Quitar emoción">
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <select value={emotionPlayer} onChange={(e) => setEmotionPlayer(e.target.value)} className="min-w-0 flex-1 rounded-lg bg-slate-800 p-2 text-sm">
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select value={emotionTag} onChange={(e) => setEmotionTag(e.target.value as EmotionTag)} className="min-w-0 flex-1 rounded-lg bg-slate-800 p-2 text-sm">
                  {EMOTION_GRID.map((t) => (
                    <option key={t} value={t}>
                      {EMOTION_LABEL[t]}
                    </option>
                  ))}
                </select>
                <button onClick={() => existing.onAddEmotion(emotionPlayer, emotionTag)} className="rounded-lg bg-slate-700 px-3 font-bold">
                  Añadir
                </button>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-4">
              <button onClick={discardable(existing.onInsertBefore)} className="h-11 rounded-lg bg-slate-800 text-sm font-semibold">
                Insertar punto antes
              </button>
              <button onClick={discardable(existing.onInsertAfter)} className="h-11 rounded-lg bg-slate-800 text-sm font-semibold">
                Insertar punto después
              </button>
              <button onClick={existing.onDelete} className="col-span-2 h-11 rounded-lg bg-red-900 text-sm font-bold">
                Borrar este punto
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
