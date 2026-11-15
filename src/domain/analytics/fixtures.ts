import { computeMatchState } from '../scoring';
import type { Emotion, EmotionTag, MatchFormat, Outcome, Point, Side } from '../types';
import { playedPoints } from './types';

export const ANA = 'ana';
export const LUIS = 'luis';
export const PLAYERS: [string, string] = [ANA, LUIS];
export const GOLD: MatchFormat = { deuce: 'punto_de_oro', finalSet: 'set_completo' };
export const ADV: MatchFormat = { deuce: 'ventajas', finalSet: 'set_completo' };

// Cada letra es un punto:
//   U / T = punto nuestro / rival sin detalle     e = error rival      w = winner rival
//   a / b = winner de Ana / de Luis               f = forzado de Ana
//   x / y = no forzado de Ana / de Luis
const TOKENS: Record<string, [Outcome, string | null]> = {
  U: ['nuestro_sin_detalle', null],
  T: ['rival_sin_detalle', null],
  a: ['winner_nuestro', ANA],
  b: ['winner_nuestro', LUIS],
  x: ['no_forzado_nuestro', ANA],
  y: ['no_forzado_nuestro', LUIS],
  f: ['forzado_nuestro', ANA],
  e: ['error_rival', null],
  w: ['winner_rival', null],
};

// Los puntos se llaman pt1, pt2… por orden.
export function pts(spec: string): Point[] {
  return [...spec].map((token, i) => {
    const entry = TOKENS[token];
    if (!entry) throw new Error(`Letra de punto desconocida: ${token}`);
    return {
      id: `pt${i + 1}`,
      order: i + 1,
      timestamp: 0,
      outcome: entry[0],
      playerId: entry[1],
      shot: null,
      zone: null,
    };
  });
}

export function run(spec: string, format: MatchFormat = GOLD, firstServer: Side = 'us') {
  const points = pts(spec);
  const state = computeMatchState(points, format, firstServer);
  return { points, state, played: playedPoints(points, state) };
}

export function emotion(id: string, playerId: string, tag: EmotionTag, afterPointId: string | null): Emotion {
  return { id, playerId, tag, afterPointId, timestamp: 0 };
}

// Un juego ganado por nosotros / por el rival con punto de oro (4 puntos).
export const gameUs = 'UUUU';
export const gameThem = 'TTTT';
