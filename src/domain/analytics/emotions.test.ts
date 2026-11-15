import { describe, expect, it } from 'vitest';
import { EMOTION_WINDOW, emotionEffects, emotionSummary, situationLabel } from './emotions';
import { ANA, emotion, gameUs, LUIS, run } from './fixtures';

const effects = (spec: string, emotions: ReturnType<typeof emotion>[]) => {
  const { state, played } = run(spec);
  return emotionEffects(played, state.contexts, emotions, state.situation);
};

describe('emotionEffects', () => {
  it('mira los 5 puntos siguientes a la emoción', () => {
    expect(EMOTION_WINDOW).toBe(5);
    // pt1 ganado por nosotros; tras él, Ana comete dos no forzados en 5 puntos que perdemos todos
    const [effect] = effects('UxTTxTUUUU', [emotion('e1', ANA, 'frustracion', 'pt1')]);
    expect(effect).toMatchObject({
      emotionId: 'e1',
      playerId: ANA,
      tag: 'frustracion',
      contextLabel: 'Set 1 · 0-0 · 15-0',
      window: { won: 0, total: 5 },
      unforcedByPlayer: 2,
    });
  });

  it('solo cuenta los no forzados del jugador de la emoción', () => {
    const [effect] = effects('UxyTTT', [emotion('e1', ANA, 'nervios', 'pt1')]);
    expect(effect.unforcedByPlayer).toBe(1);
  });

  it('si quedan menos de 5 puntos, mira los que haya', () => {
    const [effect] = effects('UUUUUUUUTU', [emotion('e1', LUIS, 'euforia', 'pt8')]);
    expect(effect.window).toEqual({ won: 1, total: 2 });
  });

  it('corta la ventana al acabar el set', () => {
    // 24 puntos ganan el primer set 6-0; después, cuatro puntos del rival ya en el segundo set
    const spec = gameUs.repeat(6) + 'TTTT';
    const [effect] = effects(spec, [emotion('e1', ANA, 'confianza', 'pt22')]);
    expect(effect.window).toEqual({ won: 2, total: 2 }); // pt23 y pt24, ambos del primer set
  });

  it('una emoción tras el último punto de un set no tiene ventana', () => {
    const spec = gameUs.repeat(6) + 'TTTT';
    const [effect] = effects(spec, [emotion('e1', ANA, 'euforia', 'pt24')]);
    expect(effect.window).toEqual({ won: 0, total: 0 });
    expect(effect.contextLabel).toBe('Set 2 · 0-0 · 0-0');
  });

  it('una emoción anotada antes del primer punto mira desde el principio', () => {
    const [effect] = effects('TTUUUU', [emotion('e1', ANA, 'nervios', null)]);
    expect(effect.window).toEqual({ won: 3, total: 5 });
    expect(effect.contextLabel).toBe('Set 1 · 0-0 · 0-0');
  });

  it('una emoción tras el último punto usa la situación actual', () => {
    const [effect] = effects('UU', [emotion('e1', ANA, 'euforia', 'pt2')]);
    expect(effect.window).toEqual({ won: 0, total: 0 });
    expect(effect.contextLabel).toBe('Set 1 · 0-0 · 30-0');
  });

  it('ignora una emoción ligada a un punto que ya no existe', () => {
    expect(effects('UU', [emotion('e1', ANA, 'euforia', 'pt99')])).toEqual([]);
  });
});

describe('emotionSummary', () => {
  it('agrupa por jugador y etiqueta sumando sus ventanas', () => {
    const list = effects('UxTTxTUUUUTT', [
      emotion('e1', ANA, 'frustracion', 'pt1'),
      emotion('e2', LUIS, 'euforia', 'pt1'),
      emotion('e3', ANA, 'frustracion', 'pt7'),
    ]);
    expect(emotionSummary(list)).toEqual([
      { playerId: ANA, tag: 'frustracion', count: 2, afterTag: { won: 3, total: 10 } },
      { playerId: LUIS, tag: 'euforia', count: 1, afterTag: { won: 0, total: 5 } },
    ]);
  });
});

describe('situationLabel', () => {
  it('numera los sets desde 1', () => {
    expect(situationLabel({ setIndex: 1, gamesUs: 4, gamesThem: 3, scoreLabel: '30-30' })).toBe('Set 2 · 4-3 · 30-30');
  });
});
