import { describe, expect, it } from 'vitest';
import { computeMatchState, pointWinner } from './scoring';
import type { MatchFormat, Point, Side } from './types';

const GOLD: MatchFormat = { deuce: 'punto_de_oro', finalSet: 'set_completo' };
const ADV: MatchFormat = { deuce: 'ventajas', finalSet: 'set_completo' };
const SUPER: MatchFormat = { deuce: 'punto_de_oro', finalSet: 'super_tiebreak' };

// 'U' = punto nuestro, 'T' = punto del rival
function seq(s: string): Point[] {
  return [...s].map((c, i) => ({
    id: `p${i + 1}`,
    order: i + 1,
    timestamp: 0,
    outcome: c === 'U' ? 'nuestro_sin_detalle' : 'rival_sin_detalle',
    playerId: null,
    shot: null,
    zone: null,
  }));
}
const run = (s: string, format: MatchFormat = GOLD, first: Side = 'us') =>
  computeMatchState(seq(s), format, first);
const game = (c: 'U' | 'T') => c.repeat(4);
const SIX_ALL = (game('U') + game('T')).repeat(6);

describe('pointWinner', () => {
  it('asigna cada resultado a su pareja', () => {
    expect(pointWinner('winner_nuestro')).toBe('us');
    expect(pointWinner('error_rival')).toBe('us');
    expect(pointWinner('nuestro_sin_detalle')).toBe('us');
    expect(pointWinner('no_forzado_nuestro')).toBe('them');
    expect(pointWinner('forzado_nuestro')).toBe('them');
    expect(pointWinner('winner_rival')).toBe('them');
    expect(pointWinner('rival_sin_detalle')).toBe('them');
  });
});

describe('juego', () => {
  it('empieza 0-0 con el saque indicado', () => {
    const s = run('', GOLD, 'them');
    expect(s.situation).toMatchObject({
      setIndex: 0, gamesUs: 0, gamesThem: 0, scoreLabel: '0-0', server: 'them', isTiebreak: false,
    });
    expect(s.finished).toBe(false);
    expect(s.contexts).toEqual([]);
  });

  it('cuenta 15, 30, 40', () => {
    expect(run('U').situation?.scoreLabel).toBe('15-0');
    expect(run('UT').situation?.scoreLabel).toBe('15-15');
    expect(run('UTTT').situation).toMatchObject({ scoreLabel: '15-40', pointLabelUs: '15', pointLabelThem: '40' });
  });

  it('gana el juego con cuatro puntos y cambia el saque', () => {
    const s = run('UUUU');
    expect(s.situation).toMatchObject({ gamesUs: 1, gamesThem: 0, scoreLabel: '0-0', server: 'them' });
  });

  it('guarda el contexto previo de cada punto', () => {
    const s = run('UT');
    expect(s.contexts).toHaveLength(2);
    expect(s.contexts[0]).toMatchObject({ pointId: 'p1', scoreLabel: '0-0', wonBy: 'us' });
    expect(s.contexts[1]).toMatchObject({ pointId: 'p2', scoreLabel: '15-0', wonBy: 'them' });
  });

  it('punto de oro: 40-40 decide el juego', () => {
    const s = run('UUUTTT');
    expect(s.situation).toMatchObject({
      scoreLabel: 'Punto de oro', isGoldenPoint: true, isBreakPoint: 'them', pointLabelUs: '40', pointLabelThem: '40',
    });
    expect(run('UUUTTTT').situation).toMatchObject({ gamesUs: 0, gamesThem: 1 });
  });

  it('ventajas: hay que ganar por dos', () => {
    expect(run('UUUTTT', ADV).situation).toMatchObject({ scoreLabel: 'Iguales', isGoldenPoint: false });
    expect(run('UUUTTTU', ADV).situation).toMatchObject({
      scoreLabel: 'Ventaja nosotros', pointLabelUs: 'Ad', pointLabelThem: '40', isBreakPoint: null,
    });
    expect(run('UUUTTTT', ADV).situation).toMatchObject({ scoreLabel: 'Ventaja rival', isBreakPoint: 'them' });
    expect(run('UUUTTTUT', ADV).situation?.scoreLabel).toBe('Iguales');
    expect(run('UUUTTTUU', ADV).situation).toMatchObject({ gamesUs: 1, gamesThem: 0 });
  });

  it('bola de break para quien resta', () => {
    expect(run('TTT').situation?.isBreakPoint).toBe('them');
    expect(run('UUU').situation?.isBreakPoint).toBe(null);
    expect(run('UUU', GOLD, 'them').situation?.isBreakPoint).toBe('us');
  });
});

describe('set', () => {
  it('se gana con 6 juegos y dos de diferencia', () => {
    const s = run(game('U').repeat(6));
    expect(s.completedSets).toEqual([{ us: 6, them: 0 }]);
    expect(s.setsUs).toBe(1);
    expect(s.situation).toMatchObject({ setIndex: 1, gamesUs: 0, gamesThem: 0 });
  });

  it('con 6-5 se sigue jugando y 7-5 cierra', () => {
    const fiveAll = (game('U') + game('T')).repeat(5);
    expect(run(fiveAll + game('U')).situation).toMatchObject({ gamesUs: 6, gamesThem: 5, isTiebreak: false });
    expect(run(fiveAll + game('U') + game('U')).completedSets).toEqual([{ us: 7, them: 5 }]);
  });

  it('servingForSet cuando el que saca gana el set con ese juego', () => {
    // 5-1 y sacamos nosotros (séptimo juego, saque inicial nuestro)
    expect(run(game('U').repeat(5) + game('T')).situation).toMatchObject({
      gamesUs: 5, gamesThem: 1, server: 'us', servingForSet: 'us',
    });
    // 5-0 y saca el rival: nadie saca para cerrar
    expect(run(game('U').repeat(5)).situation).toMatchObject({ server: 'them', servingForSet: null });
  });

  it('bola de set y de partido', () => {
    // set 1 nuestro, 5-0 en el segundo, 40-0 restando
    const s = run(game('U').repeat(6) + game('U').repeat(5) + 'UUU');
    expect(s.situation).toMatchObject({ isSetPoint: 'us', isMatchPoint: 'us', isBreakPoint: 'us' });
    // primer set, 5-0 40-0: bola de set pero no de partido
    expect(run(game('U').repeat(5) + 'UUU').situation).toMatchObject({ isSetPoint: 'us', isMatchPoint: null });
  });
});

describe('tie-break', () => {
  it('empieza en 6-6', () => {
    expect(run(SIX_ALL).situation).toMatchObject({
      gamesUs: 6, gamesThem: 6, isTiebreak: true, scoreLabel: '0-0', server: 'us',
      isBreakPoint: null, servingForSet: null,
    });
  });

  it('saque: uno, y después de dos en dos', () => {
    const servers = run(SIX_ALL + 'UTUTU').contexts.slice(48).map((c) => c.server);
    expect(servers).toEqual(['us', 'them', 'them', 'us', 'us']);
  });

  it('se gana a 7 y el set queda 7-6; resta primero quien sacó primero', () => {
    const s = run(SIX_ALL + 'U'.repeat(7));
    expect(s.completedSets).toEqual([{ us: 7, them: 6 }]);
    expect(s.situation).toMatchObject({ setIndex: 1, gamesUs: 0, server: 'them' });
  });

  it('hay que ganar por dos', () => {
    const sixSix = SIX_ALL + 'UT'.repeat(6);
    expect(run(sixSix).situation).toMatchObject({ scoreLabel: '6-6', isSetPoint: null });
    expect(run(sixSix + 'U').situation).toMatchObject({ scoreLabel: '7-6', isSetPoint: 'us' });
    expect(run(sixSix + 'UU').completedSets).toEqual([{ us: 7, them: 6 }]);
  });
});

describe('partido', () => {
  const ONE_ALL = game('U').repeat(6) + game('T').repeat(6);

  it('tercer set completo si el formato lo indica', () => {
    expect(run(ONE_ALL, GOLD).situation).toMatchObject({ setIndex: 2, isTiebreak: false, gamesUs: 0 });
  });

  it('súper tie-break a 10 con sets 1-1', () => {
    expect(run(ONE_ALL, SUPER).situation).toMatchObject({ setIndex: 2, isTiebreak: true, scoreLabel: '0-0' });
    expect(run(ONE_ALL + 'U'.repeat(9), SUPER).situation).toMatchObject({ scoreLabel: '9-0', isMatchPoint: 'us' });
    const s = run(ONE_ALL + 'U'.repeat(10), SUPER);
    expect(s.finished).toBe(true);
    expect(s.winner).toBe('us');
    expect(s.situation).toBe(null);
    expect(s.completedSets[2]).toEqual({ us: 10, them: 0 });
  });

  it('termina con dos sets e ignora los puntos sobrantes', () => {
    const s = run(game('U').repeat(12) + 'T');
    expect(s.finished).toBe(true);
    expect(s.winner).toBe('us');
    expect(s.setsUs).toBe(2);
    expect(s.contexts).toHaveLength(48);
    expect(s.extraPointIds).toEqual(['p49']);
  });
});

describe('casos adicionales', () => {
  it('ventajas: varios iguales seguidos y gana el que resta', () => {
    const s = run('UUUTTT' + 'UT' + 'UT' + 'TT', ADV);
    expect(s.situation).toMatchObject({ gamesUs: 0, gamesThem: 1, scoreLabel: '0-0' });
    expect(run('UUUTTT' + 'UT' + 'UT' + 'T', ADV).situation).toMatchObject({
      scoreLabel: 'Ventaja rival', isBreakPoint: 'them',
    });
  });

  it('primer saque del rival: el saque alterna juego a juego durante el set', () => {
    const servers = run((game('U') + game('T')).repeat(3), GOLD, 'them').contexts
      .filter((_, i) => i % 4 === 0)
      .map((c) => c.server);
    expect(servers).toEqual(['them', 'us', 'them', 'us', 'them', 'us']);
  });

  it('tie-break que pasa de 7 (9-7)', () => {
    const s = run(SIX_ALL + 'UT'.repeat(6) + 'UTUU');
    expect(s.completedSets).toEqual([{ us: 7, them: 6 }]);
    expect(s.situation).toMatchObject({ setIndex: 1, gamesUs: 0, server: 'them' });
  });

  it('súper tie-break ganado por quien perdió el primer set', () => {
    const s = run(game('T').repeat(6) + game('U').repeat(6) + 'U'.repeat(10), SUPER);
    expect(s.finished).toBe(true);
    expect(s.winner).toBe('us');
    expect(s.completedSets).toEqual([{ us: 0, them: 6 }, { us: 6, them: 0 }, { us: 10, them: 0 }]);
  });
});
