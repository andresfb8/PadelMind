import { describe, expect, it } from 'vitest';
import { ANA, emotion, gameUs, run } from './analytics/fixtures';
import {
  buildReviewRows,
  draftOf,
  draftProblem,
  draftToFields,
  emptyDraft,
  outcomeNeedsPlayer,
} from './review';

describe('outcomeNeedsPlayer', () => {
  it('solo las acciones de nuestra pareja con autor llevan jugador', () => {
    expect(outcomeNeedsPlayer('winner_nuestro')).toBe(true);
    expect(outcomeNeedsPlayer('no_forzado_nuestro')).toBe(true);
    expect(outcomeNeedsPlayer('forzado_nuestro')).toBe(true);
    expect(outcomeNeedsPlayer('error_rival')).toBe(false);
    expect(outcomeNeedsPlayer('winner_rival')).toBe(false);
    expect(outcomeNeedsPlayer('nuestro_sin_detalle')).toBe(false);
    expect(outcomeNeedsPlayer('rival_sin_detalle')).toBe(false);
  });
});

describe('buildReviewRows', () => {
  it('numera los puntos y da el marcador previo de cada uno', () => {
    const { points, state } = run('UT');
    const rows = buildReviewRows(points, state, []);
    expect(rows.map((r) => [r.number, r.situation])).toEqual([
      [1, 'Set 1 · 0-0 · 0-0'],
      [2, 'Set 1 · 0-0 · 15-0'],
    ]);
  });

  it('señala lo que falta en cada punto', () => {
    // a: winner de Ana sin golpe ni zona · U: sin detalle · e: error rival (no falta nada)
    const { points, state } = run('aUe');
    points[0].shot = 'volea';
    const rows = buildReviewRows(points, state, []);
    expect(rows[0].missing).toEqual(['zona']);
    expect(rows[1].missing).toEqual(['causa']);
    expect(rows[2].missing).toEqual([]);
  });

  it('un punto con golpe y zona está completo', () => {
    const { points, state } = run('a');
    points[0].shot = 'volea';
    points[0].zone = 'red';
    expect(buildReviewRows(points, state, [])[0].missing).toEqual([]);
  });

  it('reparte las emociones entre los puntos a los que están ligadas', () => {
    const { points, state } = run('UUU');
    const emotions = [
      emotion('e1', ANA, 'nervios', 'pt2'),
      emotion('e2', ANA, 'euforia', 'pt2'),
      emotion('e3', ANA, 'confianza', null), // antes del primer punto: no cuelga de ninguna fila
    ];
    const rows = buildReviewRows(points, state, emotions);
    expect(rows.map((r) => r.emotions.map((e) => e.id))).toEqual([[], ['e1', 'e2'], []]);
  });

  it('marca como sobrantes los puntos registrados tras el final del partido', () => {
    const { points, state } = run(gameUs.repeat(12) + 'TT');
    const rows = buildReviewRows(points, state, []);
    expect(rows).toHaveLength(50);
    expect(rows.slice(0, 48).every((r) => !r.extra)).toBe(true);
    expect(rows.slice(48).map((r) => [r.extra, r.situation])).toEqual([
      [true, null],
      [true, null],
    ]);
  });

  it('con una lista vacía no hay filas', () => {
    const { points, state } = run('');
    expect(buildReviewRows(points, state, [])).toEqual([]);
  });
});

describe('borrador de un punto', () => {
  it('un borrador vacío pide el resultado', () => {
    expect(draftProblem(emptyDraft)).toBe('Elige cómo acabó el punto.');
    expect(draftToFields(emptyDraft)).toBeNull();
  });

  it('un winner o error nuestro pide el jugador', () => {
    expect(draftProblem({ ...emptyDraft, outcome: 'winner_nuestro' })).toBe('Elige el jugador.');
    expect(draftProblem({ ...emptyDraft, outcome: 'winner_nuestro', playerId: ANA })).toBeNull();
  });

  it('un punto del rival o sin detalle no necesita jugador', () => {
    expect(draftProblem({ ...emptyDraft, outcome: 'error_rival' })).toBeNull();
    expect(draftProblem({ ...emptyDraft, outcome: 'rival_sin_detalle' })).toBeNull();
  });

  it('guarda golpe y zona cuando el punto lleva jugador', () => {
    const draft = { outcome: 'forzado_nuestro' as const, playerId: ANA, shot: 'remate' as const, zone: 'red' as const };
    expect(draftToFields(draft)).toEqual(draft);
  });

  it('descarta jugador, golpe y zona si el resultado no los lleva', () => {
    const draft = { outcome: 'winner_rival' as const, playerId: ANA, shot: 'remate' as const, zone: 'red' as const };
    expect(draftToFields(draft)).toEqual({ outcome: 'winner_rival', playerId: null, shot: null, zone: null });
  });

  it('draftOf copia los campos de un punto existente', () => {
    const { points } = run('a');
    points[0].shot = 'globo';
    expect(draftOf(points[0])).toEqual({ outcome: 'winner_nuestro', playerId: ANA, shot: 'globo', zone: null });
  });
});
