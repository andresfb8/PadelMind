import type { PointContext } from '../scoring';
import type { Point } from '../types';
import { ratio, tally, type Ratio } from './types';

const wonByUs = (c: PointContext) => c.wonBy === 'us';

export type Pressure = {
  golden: Ratio; // puntos de oro ganados / jugados
  breakConverted: Ratio; // bolas de break nuestras ganadas / jugadas
  breakSaved: Ratio; // bolas de break del rival que salvamos / jugadas
};

export function pressure(contexts: PointContext[]): Pressure {
  return {
    golden: tally(contexts.filter((c) => c.isGoldenPoint), wonByUs),
    breakConverted: tally(contexts.filter((c) => c.isBreakPoint === 'us'), wonByUs),
    breakSaved: tally(contexts.filter((c) => c.isBreakPoint === 'them'), wonByUs),
  };
}

export type Closing = {
  closing: Ratio; // puntos ganados mientras nuestra pareja saca para cerrar el set
  rest: Ratio; // puntos ganados en el resto del partido
};

export function closingSyndrome(contexts: PointContext[]): Closing {
  return {
    closing: tally(contexts.filter((c) => c.servingForSet === 'us'), wonByUs),
    rest: tally(contexts.filter((c) => c.servingForSet !== 'us'), wonByUs),
  };
}

// De los puntos jugados justo después de un error no forzado de cada jugador, cuántos gana la pareja.
// Solo cuenta el punto siguiente si es del mismo set.
export function resilience(
  played: Point[],
  contexts: PointContext[],
  playerIds: [string, string],
): { playerId: string; ratio: Ratio }[] {
  return playerIds.map((playerId) => {
    let won = 0;
    let total = 0;
    played.forEach((p, j) => {
      if (p.outcome !== 'no_forzado_nuestro' || p.playerId !== playerId) return;
      const next = contexts[j + 1];
      if (!next || next.setIndex !== contexts[j].setIndex) return;
      total++;
      if (next.wonBy === 'us') won++;
    });
    return { playerId, ratio: ratio(won, total) };
  });
}
