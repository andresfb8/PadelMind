import { orderBy, query } from 'firebase/firestore';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Match, Pair, Player } from '../domain/types';
import { matchesCol, pairsCol, playersCol } from './paths';
import { useQuery } from './useQuery';

type CoachData = { uid: string; players: Player[]; pairs: Pair[]; matches: Match[]; loading: boolean };

const Ctx = createContext<CoachData | null>(null);

export function CoachDataProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const players = useQuery<Player>(useMemo(() => query(playersCol(uid), orderBy('name')), [uid]));
  const pairs = useQuery<Pair>(useMemo(() => query(pairsCol(uid), orderBy('createdAt')), [uid]));
  const matches = useQuery<Match>(useMemo(() => query(matchesCol(uid), orderBy('date', 'desc')), [uid]));

  const value: CoachData = {
    uid,
    players: players.data,
    pairs: pairs.data,
    matches: matches.data,
    loading: players.loading || pairs.loading || matches.loading,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCoachData(): CoachData {
  const value = useContext(Ctx);
  if (!value) throw new Error('useCoachData se usa fuera de CoachDataProvider');
  return value;
}

export function playerName(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? '¿?';
}

export function pairName(players: Player[], ids: [string, string]): string {
  return `${playerName(players, ids[0])} / ${playerName(players, ids[1])}`;
}
