import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { pairName, playerName, useCoachData } from '../data/CoachData';
import { createMatch } from '../data/mutations';
import type { MatchFormat, Side } from '../domain/types';

function Choice<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-slate-400">{props.label}</p>
      <div className="flex gap-2">
        {props.options.map((o) => (
          <button
            key={o.value}
            onClick={() => props.onChange(o.value)}
            className={`flex-1 rounded-lg p-3 font-bold ${props.value === o.value ? 'bg-blue-600' : 'bg-slate-800'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NewMatchScreen() {
  const { uid, players, pairs } = useCoachData();
  const navigate = useNavigate();
  const [pairId, setPairId] = useState('');
  const [leftPlayerId, setLeftPlayerId] = useState('');
  const [opponentsName, setOpponentsName] = useState('');
  const [deuce, setDeuce] = useState<MatchFormat['deuce']>('punto_de_oro');
  const [finalSet, setFinalSet] = useState<MatchFormat['finalSet']>('set_completo');
  const [firstServer, setFirstServer] = useState<Side>('us');

  const pair = pairs.find((p) => p.id === pairId);

  const choosePair = (id: string) => {
    setPairId(id);
    const chosen = pairs.find((p) => p.id === id);
    if (!chosen) return;
    // El jugador de revés ocupa por defecto la columna izquierda.
    const reves = chosen.playerIds.find((pid) => players.find((p) => p.id === pid)?.side === 'reves');
    setLeftPlayerId(reves ?? chosen.playerIds[0]);
  };

  const start = () => {
    if (!pair) return;
    const id = createMatch(uid, {
      pairId: pair.id,
      playerIds: pair.playerIds,
      leftPlayerId,
      opponentsName: opponentsName.trim() || 'Rivales',
      format: { deuce, finalSet },
      firstServer,
    });
    navigate(`/partido/${id}`);
  };

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4">
      <Link to="/" className="text-slate-400">← Partidos</Link>
      <h1 className="text-xl font-bold">Nuevo partido</h1>

      {pairs.length === 0 ? (
        <p>
          Primero crea una pareja en <Link to="/jugadores" className="text-blue-400 underline">Jugadores</Link>.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <p className="text-sm text-slate-400">Pareja</p>
            <select value={pairId} onChange={(e) => choosePair(e.target.value)} className="w-full rounded-lg bg-slate-900 p-3">
              <option value="">Elige pareja</option>
              {pairs.map((p) => (
                <option key={p.id} value={p.id}>{pairName(players, p.playerIds)}</option>
              ))}
            </select>
          </div>

          {pair && (
            <Choice
              label="Juega en la izquierda"
              value={leftPlayerId}
              options={pair.playerIds.map((id) => ({ value: id, label: playerName(players, id) }))}
              onChange={setLeftPlayerId}
            />
          )}

          <div className="space-y-1">
            <p className="text-sm text-slate-400">Rivales</p>
            <input
              value={opponentsName}
              onChange={(e) => setOpponentsName(e.target.value)}
              placeholder="Nombre de los rivales"
              className="w-full rounded-lg bg-slate-900 p-3"
            />
          </div>

          <Choice
            label="En 40-40"
            value={deuce}
            options={[
              { value: 'punto_de_oro', label: 'Punto de oro' },
              { value: 'ventajas', label: 'Ventajas' },
            ]}
            onChange={setDeuce}
          />
          <Choice
            label="Tercer set"
            value={finalSet}
            options={[
              { value: 'set_completo', label: 'Set completo' },
              { value: 'super_tiebreak', label: 'Súper tie-break' },
            ]}
            onChange={setFinalSet}
          />
          <Choice
            label="Saca primero"
            value={firstServer}
            options={[
              { value: 'us', label: 'Nosotros' },
              { value: 'them', label: 'Rivales' },
            ]}
            onChange={setFirstServer}
          />

          <button onClick={start} disabled={!pair} className="w-full rounded-xl bg-green-700 p-4 text-lg font-bold disabled:opacity-40">
            Empezar partido
          </button>
        </>
      )}
    </div>
  );
}
