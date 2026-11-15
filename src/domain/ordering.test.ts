import { describe, expect, it } from 'vitest';
import { insertOrder, orderBetween } from './ordering';
import { pts } from './analytics/fixtures';

describe('orderBetween', () => {
  it('sin vecinos usa la hora actual', () => {
    expect(orderBetween(null, null, 99)).toBe(99);
  });

  it('antes del primero queda por debajo de todos', () => {
    expect(orderBetween(null, 10, 99)).toBe(9);
  });

  it('después del último queda por encima de todos', () => {
    expect(orderBetween(10, null, 99)).toBe(99);
    expect(orderBetween(100, null, 99)).toBe(101);
  });

  it('entre dos puntos toma el valor intermedio', () => {
    expect(orderBetween(10, 20, 0)).toBe(15);
    expect(orderBetween(10, 11, 0)).toBe(10.5);
  });

  it('con los vecinos demasiado pegados no hay hueco', () => {
    expect(orderBetween(1e15, 1e15 + 0.125, 0)).toBeNull();
    expect(orderBetween(5, 5, 0)).toBeNull();
  });

  it('se puede insertar muchas veces seguidas en el mismo hueco', () => {
    let next = 2_000;
    for (let i = 0; i < 30; i++) {
      const order = orderBetween(1_000, next, 0);
      expect(order).not.toBeNull();
      expect(order as number).toBeGreaterThan(1_000);
      expect(order as number).toBeLessThan(next);
      next = order as number;
    }
  });
});

describe('insertOrder', () => {
  const points = pts('UUU'); // órdenes 1, 2, 3
  points[0].order = 10;
  points[1].order = 20;
  points[2].order = 30;

  it('antes del primero', () => expect(insertOrder(points, 0, 'before', 99)).toBe(9));
  it('antes de uno intermedio', () => expect(insertOrder(points, 2, 'before', 99)).toBe(25));
  it('después de uno intermedio', () => expect(insertOrder(points, 1, 'after', 99)).toBe(25));
  it('después del último', () => expect(insertOrder(points, 2, 'after', 99)).toBe(99));
  it('en una lista vacía usa la hora actual', () => expect(insertOrder([], 0, 'after', 99)).toBe(99));
});
