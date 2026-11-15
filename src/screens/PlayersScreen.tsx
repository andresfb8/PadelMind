import { useState } from 'react';
import { Link } from 'react-router-dom';
import { pairName, useCoachData } from '../data/CoachData';
import { createPair, createPlayer, renamePlayer } from '../data/mutations';
import type { Player } from '../domain/types';

const SIDE_LABEL = { derecha: 'Derecha', reves: 'Revés' } as const;

export default function PlayersScreen() {
  const { uid, players, pairs } = useCoachData();
  const [name, setName] = useState('');
  const [side, setSide] = useState<Player['side']>(null);
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  const addPlayer = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createPlayer(uid, trimmed, side);
    setName('');
    setSide(null);
  };

  const rename = (p: Player) => {
    const next = window.prompt('Nombre del jugador', p.name)?.trim();
    if (next && next !== p.name) renamePlayer(uid, p.id, next);
  };

  const pairExists = pairs.some((p) => p.playerIds.includes(a) && p.playerIds.includes(b));
  const canPair = a !== '' && b !== '' && a !== b && !pairExists;

  const addPair = () => {
    if (!canPair) return;
    createPair(uid, a, b);
    setA('');
    setB('');
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4">
      <Link to="/" className="text-slate-400">← Partidos</Link>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Jugadores</h2>
        {players.map((p) => (
          <button key={p.id} onClick={() => rename(p)} className="flex w-full justify-between rounded-lg bg-slate-800 p-3 text-left">
            <span>{p.name}</span>
            <span className="text-slate-400">{p.side ? SIDE_LABEL[p.side] : ''}</span>
          </button>
        ))}
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
            className="min-w-0 flex-1 rounded-lg bg-slate-900 p-3"
          />
          <select
            value={side ?? ''}
            onChange={(e) => setSide(e.target.value === '' ? null : (e.target.value as Player['side']))}
            className="rounded-lg bg-slate-900 p-3"
          >
            <option value="">Lado</option>
            <option value="derecha">Derecha</option>
            <option value="reves">Revés</option>
          </select>
          <button onClick={addPlayer} className="rounded-lg bg-blue-600 px-4 font-bold">Añadir</button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Parejas</h2>
        {pairs.map((p) => (
          <p key={p.id} className="rounded-lg bg-slate-800 p-3">{pairName(players, p.playerIds)}</p>
        ))}
        <div className="flex gap-2">
          <select value={a} onChange={(e) => setA(e.target.value)} className="min-w-0 flex-1 rounded-lg bg-slate-900 p-3">
            <option value="">Jugador 1</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={b} onChange={(e) => setB(e.target.value)} className="min-w-0 flex-1 rounded-lg bg-slate-900 p-3">
            <option value="">Jugador 2</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={addPair} disabled={!canPair} className="rounded-lg bg-blue-600 px-4 font-bold disabled:opacity-40">
            Crear
          </button>
        </div>
      </section>
    </div>
  );
}
