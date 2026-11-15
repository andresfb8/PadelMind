import { SHOTS, SHOT_LABEL } from '../domain/helpers';
import type { Shot } from '../domain/types';

export default function ShotRow(props: { onPick: (shot: Shot) => void }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 space-y-1 rounded-xl bg-[#0b0f14] p-2">
      <p className="text-center text-xs text-slate-400">¿Con qué golpe? (opcional)</p>
      <div className="grid grid-cols-4 gap-2">
        {SHOTS.map((shot) => (
          <button
            key={shot}
            onClick={() => props.onPick(shot)}
            className="h-11 rounded-lg bg-slate-700 text-sm font-semibold active:brightness-125"
          >
            {SHOT_LABEL[shot]}
          </button>
        ))}
      </div>
    </div>
  );
}
