import { describe, expect, it } from 'vitest';
import { nextOrder, situationTag } from './helpers';
import type { Situation } from './scoring';

const base: Situation = {
  setIndex: 0, gamesUs: 0, gamesThem: 0, scoreLabel: '0-0', pointLabelUs: '0', pointLabelThem: '0',
  server: 'us', isTiebreak: false, isGoldenPoint: false, isBreakPoint: null, isSetPoint: null,
  isMatchPoint: null, servingForSet: null,
};

describe('nextOrder', () => {
  it('empieza en 1', () => {
    expect(nextOrder([])).toBe(1);
  });
  it('suma 1 al último', () => {
    expect(nextOrder([{ order: 1 }, { order: 2.5 }])).toBe(3.5);
  });
});

describe('situationTag', () => {
  it('vacío en un punto normal o sin situación', () => {
    expect(situationTag(base)).toBe('');
    expect(situationTag(null)).toBe('');
  });
  it('elige la situación más importante', () => {
    expect(situationTag({ ...base, isBreakPoint: 'us' })).toBe('BOLA DE BREAK · nosotros');
    expect(situationTag({ ...base, isGoldenPoint: true, isBreakPoint: 'them' })).toBe('PUNTO DE ORO');
    expect(situationTag({ ...base, isGoldenPoint: true, isSetPoint: 'them' })).toBe('BOLA DE SET · rival');
    expect(situationTag({ ...base, isSetPoint: 'us', isMatchPoint: 'us' })).toBe('BOLA DE PARTIDO · nosotros');
  });
});
