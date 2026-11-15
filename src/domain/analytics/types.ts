import type { MatchState } from '../scoring';
import type { Point } from '../types';

export type Ratio = { won: number; total: number };

export const ratio = (won: number, total: number): Ratio => ({ won, total });

// Cuenta cuántos elementos cumplen `isWon` sobre el total de la lista.
export function tally<T>(items: T[], isWon: (item: T) => boolean): Ratio {
  return ratio(items.filter(isWon).length, items.length);
}

// Los puntos que cuentan para las estadísticas: los sobrantes tras el final del partido no entran.
// (`computeMatchState` los deja siempre al final de la lista.)
export function playedPoints(points: Point[], state: MatchState): Point[] {
  return points.slice(0, state.contexts.length);
}
