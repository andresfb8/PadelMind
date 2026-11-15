import type { Situation } from './scoring';
import type { EmotionTag, Outcome, Shot, Side } from './types';

// Orden del siguiente punto: la hora actual, salvo que el último orden ya la alcance (entonces +1).
export function nextOrder(lastOrder: number, now: number): number {
  return Math.max(now, lastOrder + 1);
}

const who = (s: Side) => (s === 'us' ? 'nosotros' : 'rival');

export function situationTag(s: Situation | null): string {
  if (!s) return '';
  if (s.isMatchPoint) return `BOLA DE PARTIDO · ${who(s.isMatchPoint)}`;
  if (s.isSetPoint) return `BOLA DE SET · ${who(s.isSetPoint)}`;
  if (s.isGoldenPoint) return 'PUNTO DE ORO';
  if (s.isBreakPoint) return `BOLA DE BREAK · ${who(s.isBreakPoint)}`;
  return '';
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  winner_nuestro: 'Winner',
  error_rival: 'Error rival',
  no_forzado_nuestro: 'No forzado',
  forzado_nuestro: 'Forzado',
  winner_rival: 'Winner rival',
  nuestro_sin_detalle: 'Punto nuestro',
  rival_sin_detalle: 'Punto rival',
};

export const SHOTS: Shot[] = ['derecha', 'reves', 'volea', 'bandeja_vibora', 'remate', 'globo', 'saque_resto'];

export const SHOT_LABEL: Record<Shot, string> = {
  derecha: 'Derecha',
  reves: 'Revés',
  volea: 'Volea',
  bandeja_vibora: 'Bandeja',
  remate: 'Remate',
  globo: 'Globo',
  saque_resto: 'Saque/resto',
};

// Orden de la rejilla 3×3: las dos primeras columnas negativas, la tercera positiva.
export const EMOTION_GRID: EmotionTag[] = [
  'frustracion', 'nervios', 'euforia',
  'enfado_companero', 'miedo_a_fallar', 'confianza',
  'desconexion', 'distraccion_externa', 'apoyo_companero',
];

export const POSITIVE_EMOTIONS: EmotionTag[] = ['euforia', 'confianza', 'apoyo_companero'];

export const EMOTION_LABEL: Record<EmotionTag, string> = {
  frustracion: 'Frustración',
  enfado_companero: 'Enfado con el compañero',
  desconexion: 'Desconexión',
  nervios: 'Nervios',
  miedo_a_fallar: 'Miedo a fallar',
  distraccion_externa: 'Distracción externa',
  euforia: 'Euforia',
  confianza: 'Confianza',
  apoyo_companero: 'Apoyo al compañero',
};
