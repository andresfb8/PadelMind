import { nextOrder } from './helpers';
import type { Point } from './types';

// Orden de un punto nuevo entre dos vecinos (null = no hay vecino de ese lado). Devuelve null si
// los vecinos están tan pegados que no cabe un valor entre ellos.
export function orderBetween(prev: number | null, next: number | null, now: number): number | null {
  if (prev === null) return next === null ? now : next - 1;
  if (next === null) return nextOrder(prev, now);
  const middle = (prev + next) / 2;
  return middle > prev && middle < next ? middle : null;
}

// Orden para insertar un punto antes o después del punto de índice `index` de la lista ordenada.
// Insertar entre dos puntos no obliga a reescribir ningún otro.
export function insertOrder(points: Point[], index: number, where: 'before' | 'after', now: number): number | null {
  if (points.length === 0) return now;
  if (where === 'before') return orderBetween(points[index - 1]?.order ?? null, points[index].order, now);
  return orderBetween(points[index].order, points[index + 1]?.order ?? null, now);
}
