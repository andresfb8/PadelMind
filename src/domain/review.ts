import { situationLabel } from './analytics/emotions';
import type { MatchState } from './scoring';
import type { Emotion, Outcome, Point, Shot, Zone } from './types';

// Resultados que llevan jugador: una acción de nuestra pareja con autor.
const WITH_PLAYER: Outcome[] = ['winner_nuestro', 'no_forzado_nuestro', 'forzado_nuestro'];
export const outcomeNeedsPlayer = (outcome: Outcome) => WITH_PLAYER.includes(outcome);

export type Missing = 'causa' | 'golpe' | 'zona';

export type ReviewRow = {
  point: Point;
  number: number; // 1, 2, 3…
  situation: string | null; // marcador antes del punto; null si es un punto sobrante
  extra: boolean; // punto registrado después de terminar el partido
  emotions: Emotion[]; // las anotadas justo después de este punto
  missing: Missing[]; // lo que falta por completar
};

// Una fila por punto, en orden. `state` debe salir de los mismos puntos.
export function buildReviewRows(points: Point[], state: MatchState, emotions: Emotion[]): ReviewRow[] {
  return points.map((point, i) => {
    const context = state.contexts[i]; // los puntos sobrantes no tienen contexto
    const missing: Missing[] = [];
    if (point.outcome === 'nuestro_sin_detalle' || point.outcome === 'rival_sin_detalle') missing.push('causa');
    if (outcomeNeedsPlayer(point.outcome)) {
      if (!point.shot) missing.push('golpe');
      if (!point.zone) missing.push('zona');
    }
    return {
      point,
      number: i + 1,
      situation: context ? situationLabel(context) : null,
      extra: !context,
      emotions: emotions.filter((e) => e.afterPointId === point.id),
      missing,
    };
  });
}

export type PointFields = { outcome: Outcome; playerId: string | null; shot: Shot | null; zone: Zone | null };
export type PointDraft = { outcome: Outcome | null; playerId: string | null; shot: Shot | null; zone: Zone | null };

export const emptyDraft: PointDraft = { outcome: null, playerId: null, shot: null, zone: null };

export const draftOf = (p: Point): PointDraft => ({
  outcome: p.outcome,
  playerId: p.playerId,
  shot: p.shot,
  zone: p.zone,
});

// Lo que falta para poder guardar, o null si el borrador ya es válido.
export function draftProblem(d: PointDraft): string | null {
  if (d.outcome === null) return 'Elige cómo acabó el punto.';
  if (outcomeNeedsPlayer(d.outcome) && d.playerId === null) return 'Elige el jugador.';
  return null;
}

// Los campos que se guardan. Un punto sin jugador (del rival o sin detalle) no lleva golpe ni zona,
// aunque el borrador los tuviera de una elección anterior.
export function draftToFields(d: PointDraft): PointFields | null {
  if (draftProblem(d) !== null || d.outcome === null) return null;
  if (!outcomeNeedsPlayer(d.outcome)) return { outcome: d.outcome, playerId: null, shot: null, zone: null };
  return { outcome: d.outcome, playerId: d.playerId, shot: d.shot, zone: d.zone };
}
