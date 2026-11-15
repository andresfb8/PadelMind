import { describe, expect, it } from 'vitest';
import { ANA, emotion, gameUs, LUIS, run } from './fixtures';
import { momentum } from './momentum';

const m = (spec: string, emotions = [] as ReturnType<typeof emotion>[], first: 'us' | 'them' = 'us') => {
  const { state, played } = run(spec, undefined, first);
  return momentum(played, state.contexts, emotions);
};

describe('momentum', () => {
  it('suma +1 por punto nuestro y −1 por punto rival, empezando en 0', () => {
    expect(m('UUT').values).toEqual([0, 1, 2, 1]);
    expect(m('').values).toEqual([0]);
  });

  it('no incluye los puntos sobrantes tras el final del partido', () => {
    const result = m(gameUs.repeat(12) + 'T');
    expect(result.values).toHaveLength(49);
    expect(result.values[48]).toBe(48);
  });

  it('marca el cambio de juego y el de set', () => {
    const result = m(gameUs.repeat(6) + 'U');
    expect(result.boundaries.filter((b) => b.kind === 'game').map((b) => b.x)).toEqual([4, 8, 12, 16, 20]);
    expect(result.boundaries.filter((b) => b.kind === 'set')).toEqual([{ x: 24, kind: 'set', setIndex: 1 }]);
  });

  it('marca los puntos de oro', () => {
    // 40-40 y lo ganamos nosotros
    expect(m('UUUTTTU').marks).toEqual([{ x: 7, y: 1, kind: 'gold', label: 'Punto de oro' }]);
  });

  it('marca el break sufrido y el conseguido', () => {
    expect(m('TTTT').marks).toEqual([{ x: 4, y: -4, kind: 'break_them', label: 'Break' }]);
    expect(m('UUUU', [], 'them').marks).toEqual([{ x: 4, y: 4, kind: 'break_us', label: 'Break' }]);
  });

  it('un punto de oro convertido por el restador cuenta como break, no como punto de oro', () => {
    // 40-40 y lo gana el rival, que resta
    expect(m('UUUTTTT').marks.map((k) => k.kind)).toEqual(['break_them']);
  });

  it('marca las emociones según sean negativas o positivas, ligadas a su punto', () => {
    const result = m('UUT', [
      emotion('e1', ANA, 'euforia', 'pt2'),
      emotion('e2', LUIS, 'frustracion', null),
    ]);
    expect(result.marks).toContainEqual({ x: 2, y: 2, kind: 'emotion_pos', label: 'Euforia' });
    expect(result.marks).toContainEqual({ x: 0, y: 0, kind: 'emotion_neg', label: 'Frustración' });
  });

  it('ignora las emociones ligadas a un punto que ya no existe', () => {
    expect(m('UU', [emotion('e1', ANA, 'nervios', 'pt99')]).marks).toEqual([]);
  });
});
