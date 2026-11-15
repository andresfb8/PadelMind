import type { Match } from '../domain/types';

const OPTIONS: { value: Match['mode']; label: string }[] = [
  { value: 'directo', label: 'En directo' },
  { value: 'video', label: 'Desde vídeo' },
];

// Cambia el modo de registro: en directo pide lo mínimo; desde vídeo deja golpe y zona a la vista.
export default function ModeToggle(props: { mode: Match['mode']; disabled?: boolean; onChange: (m: Match['mode']) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg bg-slate-800 text-xs font-bold" role="group" aria-label="Modo de registro">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          disabled={props.disabled}
          onClick={() => props.onChange(o.value)}
          className={`h-8 px-3 disabled:opacity-40 ${props.mode === o.value ? 'bg-blue-600' : ''}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
