import { EMOTION_LABEL, POSITIVE_EMOTIONS } from '../helpers';
import type { PointContext } from '../scoring';
import type { Emotion, Point } from '../types';

export type MarkKind = 'gold' | 'break_us' | 'break_them' | 'emotion_neg' | 'emotion_pos';
export type Mark = { x: number; y: number; kind: MarkKind; label: string };
export type Boundary = { x: number; kind: 'game' | 'set'; setIndex: number };
export type Momentum = { values: number[]; marks: Mark[]; boundaries: Boundary[] };

// `values[i]` es el saldo tras i puntos: +1 por cada punto nuestro, −1 por cada punto rival.
// `x` cuenta puntos ya jugados: una marca o un separador en x queda entre el punto x y el x+1.
export function momentum(played: Point[], contexts: PointContext[], emotions: Emotion[]): Momentum {
  const values = [0];
  const marks: Mark[] = [];
  const boundaries: Boundary[] = [];

  played.forEach((_, j) => {
    const c = contexts[j];
    const prev = contexts[j - 1];
    if (prev) {
      if (c.setIndex !== prev.setIndex) {
        boundaries.push({ x: j, kind: 'set', setIndex: c.setIndex });
      } else if (c.gamesUs + c.gamesThem !== prev.gamesUs + prev.gamesThem) {
        boundaries.push({ x: j, kind: 'game', setIndex: c.setIndex });
      }
    }

    values.push(values[j] + (c.wonBy === 'us' ? 1 : -1));
    const x = j + 1;
    if (c.isBreakPoint !== null && c.wonBy === c.isBreakPoint) {
      marks.push({ x, y: values[x], kind: c.isBreakPoint === 'us' ? 'break_us' : 'break_them', label: 'Break' });
    } else if (c.isGoldenPoint) {
      marks.push({ x, y: values[x], kind: 'gold', label: 'Punto de oro' });
    }
  });

  for (const e of emotions) {
    const x = e.afterPointId === null ? 0 : played.findIndex((p) => p.id === e.afterPointId) + 1;
    if (e.afterPointId !== null && x === 0) continue; // el punto ya no existe
    marks.push({
      x,
      y: values[x],
      kind: POSITIVE_EMOTIONS.includes(e.tag) ? 'emotion_pos' : 'emotion_neg',
      label: EMOTION_LABEL[e.tag],
    });
  }

  return { values, marks, boundaries };
}
