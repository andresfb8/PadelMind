import { computeMatchState, type MatchState } from '../scoring';
import type { Emotion, Match, Point } from '../types';
import { emotionEffects, emotionSummary, type EmotionEffect, type EmotionSummary } from './emotions';
import { momentum, type Momentum } from './momentum';
import { closingSyndrome, pressure, resilience, type Closing, type Pressure } from './pressure';
import { technicalSummary, withoutDetail, type PlayerTechnical } from './technical';
import { playedPoints, tally, type Ratio } from './types';

export type Report = {
  state: MatchState;
  played: Point[];
  setsText: string; // "6-3 4-6 6-7(5)"
  pointsWon: Ratio; // puntos ganados por nuestra pareja sobre los jugados
  momentum: Momentum;
  technical: PlayerTechnical[];
  withoutDetail: number;
  pressure: Pressure;
  closing: Closing;
  resilience: { playerId: string; ratio: Ratio }[];
  emotions: EmotionEffect[];
  emotionSummary: EmotionSummary[];
};

// Resultado por sets: los terminados y, si el partido sigue, el set en curso (solo si ya se jugó algún punto en él).
//   · Set decidido por tie-break: "7-6(5)", con los puntos del perdedor del tie-break.
//   · Tie-break en curso: "6-6 (2-1)". Súper tie-break en curso: sus puntos, "2-1".
export function setsLabel(state: MatchState): string {
  const parts = state.completedSets.map((s) =>
    s.tiebreak ? `${s.us}-${s.them}(${Math.min(s.tiebreak.us, s.tiebreak.them)})` : `${s.us}-${s.them}`,
  );
  const s = state.situation;
  if (s && state.contexts.some((c) => c.setIndex === s.setIndex)) {
    const games = `${s.gamesUs}-${s.gamesThem}`;
    if (!s.isTiebreak) parts.push(games);
    else parts.push(s.gamesUs + s.gamesThem === 0 ? s.scoreLabel : `${games} (${s.scoreLabel})`);
  }
  return parts.join(' ') || 'Sin puntos';
}

// `points` y `emotions` llegan ordenados (por `order` y por `timestamp`, como los entregan las consultas).
export function buildReport(
  match: Pick<Match, 'playerIds' | 'format' | 'firstServer'>,
  points: Point[],
  emotions: Emotion[],
): Report {
  const state = computeMatchState(points, match.format, match.firstServer);
  const played = playedPoints(points, state);
  const effects = emotionEffects(played, state.contexts, emotions, state.situation);

  return {
    state,
    played,
    setsText: setsLabel(state),
    pointsWon: tally(state.contexts, (c) => c.wonBy === 'us'),
    momentum: momentum(played, state.contexts, emotions),
    technical: technicalSummary(played, match.playerIds),
    withoutDetail: withoutDetail(played),
    pressure: pressure(state.contexts),
    closing: closingSyndrome(state.contexts),
    resilience: resilience(played, state.contexts, match.playerIds),
    emotions: effects,
    emotionSummary: emotionSummary(effects),
  };
}
