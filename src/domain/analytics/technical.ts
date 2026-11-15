import { SHOTS } from '../helpers';
import type { Point, Shot } from '../types';

export type ShotTally = { winners: number; unforced: number; forced: number };

export type PlayerTechnical = {
  playerId: string;
  winners: number;
  unforced: number;
  forced: number;
  balance: number; // winners − no forzados
  byShot: Partial<Record<Shot, ShotTally>>; // solo los puntos con golpe anotado
};

export function technicalSummary(played: Point[], playerIds: [string, string]): PlayerTechnical[] {
  return playerIds.map((playerId) => {
    const row: PlayerTechnical = { playerId, winners: 0, unforced: 0, forced: 0, balance: 0, byShot: {} };
    for (const p of played) {
      if (p.playerId !== playerId) continue;
      const field =
        p.outcome === 'winner_nuestro'
          ? 'winners'
          : p.outcome === 'no_forzado_nuestro'
            ? 'unforced'
            : p.outcome === 'forzado_nuestro'
              ? 'forced'
              : null;
      if (!field) continue;
      row[field]++;
      if (p.shot) {
        const tally = (row.byShot[p.shot] ??= { winners: 0, unforced: 0, forced: 0 });
        tally[field]++;
      }
    }
    row.balance = row.winners - row.unforced;
    return row;
  });
}

// Puntos que se registraron sin saber cómo acabaron: cuentan para el marcador, no para winners ni errores.
export function withoutDetail(played: Point[]): number {
  return played.filter((p) => p.outcome === 'nuestro_sin_detalle' || p.outcome === 'rival_sin_detalle').length;
}

// El golpe con el que más errores no forzados se anotaron (el primero de la lista si hay empate).
// `of` es el total de no forzados que tienen golpe anotado: los que no lo tienen no entran en la cuenta.
export function topUnforcedShot(row: PlayerTechnical): { shot: Shot; count: number; of: number } | null {
  let best: { shot: Shot; count: number } | null = null;
  let of = 0;
  for (const shot of SHOTS) {
    const count = row.byShot[shot]?.unforced ?? 0;
    of += count;
    if (count > 0 && (!best || count > best.count)) best = { shot, count };
  }
  return best ? { ...best, of } : null;
}
