import type { PointContext, Situation } from '../scoring';
import type { Emotion, EmotionTag, Point } from '../types';
import { ratio, type Ratio } from './types';

// Cuántos puntos siguientes a una emoción se miran.
export const EMOTION_WINDOW = 5;

export type EmotionEffect = {
  emotionId: string;
  playerId: string;
  tag: EmotionTag;
  contextLabel: string; // dónde ocurrió: "Set 2 · 4-3 · 30-30"
  window: Ratio; // puntos ganados por la pareja / puntos mirados (hasta EMOTION_WINDOW, sin salir del set)
  unforcedByPlayer: number; // no forzados de ese jugador dentro de la ventana
};

export type EmotionSummary = {
  playerId: string;
  tag: EmotionTag;
  count: number;
  afterTag: Ratio; // suma de las ventanas de esa etiqueta y jugador
};

type LabelSource = Pick<Situation, 'setIndex' | 'gamesUs' | 'gamesThem' | 'scoreLabel'>;

export const situationLabel = (s: LabelSource) => `Set ${s.setIndex + 1} · ${s.gamesUs}-${s.gamesThem} · ${s.scoreLabel}`;

// `current` es la situación tras el último punto (null si el partido ha terminado); se usa para
// situar una emoción anotada después del último punto jugado.
export function emotionEffects(
  played: Point[],
  contexts: PointContext[],
  emotions: Emotion[],
  current: Situation | null,
): EmotionEffect[] {
  const effects: EmotionEffect[] = [];

  for (const e of emotions) {
    // `start` es el índice del punto tras el que se anotó la emoción (−1: antes del primero).
    const start = e.afterPointId === null ? -1 : played.findIndex((p) => p.id === e.afterPointId);
    if (e.afterPointId !== null && start === -1) continue; // el punto ya no existe

    const emotionSet = start === -1 ? (contexts[0]?.setIndex ?? 0) : contexts[start].setIndex;
    let won = 0;
    let total = 0;
    let unforced = 0;
    for (let j = start + 1; j < played.length && j <= start + EMOTION_WINDOW; j++) {
      if (contexts[j].setIndex !== emotionSet) break; // la ventana se corta al acabar el set
      total++;
      if (contexts[j].wonBy === 'us') won++;
      if (played[j].outcome === 'no_forzado_nuestro' && played[j].playerId === e.playerId) unforced++;
    }

    const at = contexts[start + 1] ?? current;
    effects.push({
      emotionId: e.id,
      playerId: e.playerId,
      tag: e.tag,
      contextLabel: at ? situationLabel(at) : 'Final del partido',
      window: ratio(won, total),
      unforcedByPlayer: unforced,
    });
  }

  return effects;
}

// Agrupa por jugador y etiqueta. Si dos ventanas se solapan, esos puntos cuentan en las dos.
export function emotionSummary(effects: EmotionEffect[]): EmotionSummary[] {
  const groups = new Map<string, EmotionSummary>();
  for (const e of effects) {
    const key = `${e.playerId}|${e.tag}`;
    const group = groups.get(key) ?? { playerId: e.playerId, tag: e.tag, count: 0, afterTag: ratio(0, 0) };
    group.count++;
    group.afterTag = ratio(group.afterTag.won + e.window.won, group.afterTag.total + e.window.total);
    groups.set(key, group);
  }
  return [...groups.values()];
}
