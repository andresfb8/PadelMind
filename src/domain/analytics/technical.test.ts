import { describe, expect, it } from 'vitest';
import { ANA, LUIS, PLAYERS, pts } from './fixtures';
import { technicalSummary, topUnforcedShot, withoutDetail } from './technical';

describe('technicalSummary', () => {
  // a a b x x y e f → Ana: 2 winners, 2 no forzados, 1 forzado · Luis: 1 winner, 1 no forzado
  const points = pts('aabxxyef');

  it('cuenta winners, no forzados y forzados por jugador, con su balance', () => {
    const [ana, luis] = technicalSummary(points, PLAYERS);
    expect(ana).toMatchObject({ playerId: ANA, winners: 2, unforced: 2, forced: 1, balance: 0 });
    expect(luis).toMatchObject({ playerId: LUIS, winners: 1, unforced: 1, forced: 0, balance: 0 });
  });

  it('el balance es winners menos no forzados', () => {
    const [ana] = technicalSummary(pts('axxxa'), PLAYERS);
    expect(ana.balance).toBe(-1);
  });

  it('desglosa por golpe solo los puntos con golpe anotado', () => {
    points[0].shot = 'volea';
    points[3].shot = 'bandeja_vibora';
    points[4].shot = 'bandeja_vibora';
    const [ana] = technicalSummary(points, PLAYERS);
    expect(ana.byShot).toEqual({
      volea: { winners: 1, unforced: 0, forced: 0 },
      bandeja_vibora: { winners: 0, unforced: 2, forced: 0 },
    });
  });

  it('no cuenta los puntos de los rivales ni los de sin detalle', () => {
    const [ana, luis] = technicalSummary(pts('UTew'), PLAYERS);
    expect([ana.winners, ana.unforced, ana.forced, luis.winners, luis.unforced, luis.forced]).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('con un partido vacío todo es cero', () => {
    expect(technicalSummary([], PLAYERS)).toEqual([
      { playerId: ANA, winners: 0, unforced: 0, forced: 0, balance: 0, byShot: {} },
      { playerId: LUIS, winners: 0, unforced: 0, forced: 0, balance: 0, byShot: {} },
    ]);
  });
});

describe('withoutDetail', () => {
  it('cuenta los puntos sin detalle de cualquiera de las dos parejas', () => {
    expect(withoutDetail(pts('UTUea'))).toBe(3);
  });
});

describe('topUnforcedShot', () => {
  it('devuelve el golpe con más no forzados', () => {
    const points = pts('xxxx');
    points[0].shot = 'volea';
    points[1].shot = 'bandeja_vibora';
    points[2].shot = 'bandeja_vibora';
    const [ana] = technicalSummary(points, PLAYERS);
    // el cuarto no forzado no tiene golpe anotado y no entra en el total
    expect(topUnforcedShot(ana)).toEqual({ shot: 'bandeja_vibora', count: 2, of: 3 });
  });

  it('devuelve null si no hay no forzados con golpe anotado', () => {
    const [ana] = technicalSummary(pts('xa'), PLAYERS);
    expect(topUnforcedShot(ana)).toBeNull();
  });
});
