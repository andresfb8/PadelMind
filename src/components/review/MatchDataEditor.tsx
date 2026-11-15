import { useState } from 'react';
import { dateFromInput, dateInputValue } from '../../domain/format';
import type { Match } from '../../domain/types';
import Choice from '../Choice';

// Corrige los datos del partido. Como el marcador se calcula a partir de los puntos,
// cualquier cambio rehace el marcador de toda la lista.
export default function MatchDataEditor(props: {
  match: Match;
  onChange: (patch: Partial<Omit<Match, 'id'>>) => void;
}) {
  const { match, onChange } = props;
  const [rivals, setRivals] = useState(match.opponentsName);

  const commitRivals = () => {
    const name = rivals.trim();
    if (name && name !== match.opponentsName) onChange({ opponentsName: name });
    else setRivals(match.opponentsName);
  };

  return (
    <details className="rounded-xl bg-slate-900 p-3">
      <summary className="cursor-pointer py-1 font-bold">Datos del partido</summary>
      <div className="mt-3 space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-slate-400">Rivales</p>
          <input
            value={rivals}
            onChange={(e) => setRivals(e.target.value)}
            onBlur={commitRivals}
            className="w-full rounded-lg bg-slate-800 p-3"
          />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-slate-400">Fecha del partido</p>
          <input
            type="date"
            value={dateInputValue(match.date)}
            onChange={(e) => {
              const date = dateFromInput(e.target.value);
              if (date !== null) onChange({ date });
            }}
            className="w-full rounded-lg bg-slate-800 p-3"
          />
        </div>
        <Choice
          label="En 40-40"
          value={match.format.deuce}
          options={[
            { value: 'punto_de_oro', label: 'Punto de oro' },
            { value: 'ventajas', label: 'Ventajas' },
          ]}
          onChange={(deuce) => onChange({ format: { ...match.format, deuce } })}
        />
        <Choice
          label="Tercer set"
          value={match.format.finalSet}
          options={[
            { value: 'set_completo', label: 'Set completo' },
            { value: 'super_tiebreak', label: 'Súper tie-break' },
          ]}
          onChange={(finalSet) => onChange({ format: { ...match.format, finalSet } })}
        />
        <Choice
          label="Sacó primero"
          value={match.firstServer}
          options={[
            { value: 'us', label: 'Nosotros' },
            { value: 'them', label: 'Rivales' },
          ]}
          onChange={(firstServer) => onChange({ firstServer })}
        />
        <p className="text-xs text-slate-400">El marcador de todos los puntos se recalcula solo con estos cambios.</p>
      </div>
    </details>
  );
}
