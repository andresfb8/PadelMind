import { describe, expect, it } from 'vitest';
import { ANA, emotion, GOLD, gameThem, gameUs, PLAYERS, pts, run } from './fixtures';
import { buildReport, setsLabel } from './report';

const SUPER = { ...GOLD, finalSet: 'super_tiebreak' as const };
const match = { playerIds: PLAYERS, format: GOLD, firstServer: 'us' as const };
const SIX_ALL = (gameUs + gameThem).repeat(6);

describe('setsLabel', () => {
  it('sin puntos', () => {
    expect(setsLabel(run('').state)).toBe('Sin puntos');
  });

  it('partido terminado', () => {
    expect(setsLabel(run(gameUs.repeat(12)).state)).toBe('6-0 6-0');
  });

  it('incluye el set en curso', () => {
    expect(setsLabel(run(gameUs.repeat(6) + gameUs).state)).toBe('6-0 1-0');
  });

  it('un set decidido por tie-break lleva los puntos del perdedor', () => {
    expect(setsLabel(run(SIX_ALL + 'U'.repeat(7)).state)).toBe('7-6(0)');
  });

  it('muestra el tie-break en curso con sus puntos', () => {
    expect(setsLabel(run(SIX_ALL + 'UUT').state)).toBe('6-6 (2-1)');
  });

  it('muestra los puntos de un súper tie-break en curso', () => {
    const spec = gameUs.repeat(6) + gameThem.repeat(6) + 'UUT';
    expect(setsLabel(run(spec, SUPER).state)).toBe('6-0 0-6 2-1');
  });
});

describe('buildReport', () => {
  it('reúne todos los bloques de un mismo partido', () => {
    // Ana gana un punto, comete un no forzado, y el rival gana otro
    const points = pts('aeTx');
    points[0].shot = 'volea';
    const report = buildReport(match, points, [emotion('e1', ANA, 'frustracion', 'pt2')]);

    expect(report.played).toHaveLength(4);
    expect(report.setsText).toBe('0-0');
    expect(report.pointsWon).toEqual({ won: 2, total: 4 });
    expect(report.momentum.values).toEqual([0, 1, 2, 1, 0]);
    expect(report.technical[0]).toMatchObject({ playerId: ANA, winners: 1, unforced: 1 });
    expect(report.withoutDetail).toBe(1);
    expect(report.resilience[0].ratio).toEqual({ won: 0, total: 0 }); // x es el último punto
    expect(report.emotions).toHaveLength(1);
    expect(report.emotions[0].window).toEqual({ won: 0, total: 2 });
    expect(report.emotionSummary).toHaveLength(1);
  });

  it('un partido sin puntos produce un informe vacío sin fallar', () => {
    const report = buildReport(match, [], []);
    expect(report.played).toEqual([]);
    expect(report.pointsWon).toEqual({ won: 0, total: 0 });
    expect(report.momentum.values).toEqual([0]);
    expect(report.emotions).toEqual([]);
  });

  it('no cuenta los puntos sobrantes tras el final del partido', () => {
    const report = buildReport(match, pts(gameUs.repeat(12) + 'TTT'), []);
    expect(report.played).toHaveLength(48);
    expect(report.pointsWon).toEqual({ won: 48, total: 48 });
  });
});
