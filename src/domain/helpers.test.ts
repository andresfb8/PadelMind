import { describe, expect, it } from 'vitest';
import { nextOrder, situationTag } from './helpers';
import type { Situation } from './scoring';

const base: Situation = {
  setIndex: 0, gamesUs: 0, gamesThem: 0, scoreLabel: '0-0', pointLabelUs: '0', pointLabelThem: '0',
  server: 'us', isTiebreak: false, isGoldenPoint: false, isBreakPoint: null, isSetPoint: null,
  isMatchPoint: null, servingForSet: null,
};

describe('nextOrder', () => {
  it('sin puntos previos (0) usa la hora actual', () => {
    expect(nextOrder(0, 1700000000000)).toBe(1700000000000);
  });
  it('si el último orden alcanza la hora, suma 1', () => {
    expect(nextOrder(1700000000005, 1700000000000)).toBe(1700000000006);
    expect(nextOrder(1700000000000, 1700000000000)).toBe(1700000000001);
  });
  it('órdenes pequeños de partidos antiguos quedan por debajo', () => {
    expect(nextOrder(12, 1700000000000)).toBe(1700000000000);
  });
  it('crece estrictamente aunque se llame con la misma hora', () => {
    const now = 1700000000000;
    let last = 0;
    for (let i = 0; i < 5; i++) {
      const o = nextOrder(last, now);
      expect(o).toBeGreaterThan(last);
      last = o;
    }
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
