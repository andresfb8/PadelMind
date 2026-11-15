import { describe, expect, it } from 'vitest';
import { ADV, ANA, gameThem, gameUs, LUIS, PLAYERS, run } from './fixtures';
import { closingSyndrome, pressure, resilience } from './pressure';

describe('pressure', () => {
  // Juego 1 (saca nuestra pareja): 40-40 y ganamos el punto de oro.
  // Juego 2 (saca el rival): 3-0 a nuestro favor, pero perdemos los cuatro puntos siguientes.
  const { state } = run('UUUTTTU' + 'UUUTTTT');

  it('cuenta los puntos de oro ganados sobre los jugados', () => {
    expect(pressure(state.contexts).golden).toEqual({ won: 1, total: 2 });
  });

  it('cuenta las bolas de break nuestras convertidas', () => {
    // 3-0, 3-1, 3-2 y 3-3 restando: cuatro bolas de break, ninguna ganada
    expect(pressure(state.contexts).breakConverted).toEqual({ won: 0, total: 4 });
  });

  it('cuenta las bolas de break del rival que salvamos', () => {
    // solo la del 40-40 del primer juego, y la ganamos
    expect(pressure(state.contexts).breakSaved).toEqual({ won: 1, total: 1 });
  });

  it('con ventajas no hay puntos de oro', () => {
    const adv = run('UUUTTTU', ADV);
    expect(pressure(adv.state.contexts).golden).toEqual({ won: 0, total: 0 });
  });
});

describe('closingSyndrome', () => {
  // Ganamos los cinco primeros juegos, el rival el sexto (5-1) y en el séptimo, con saque nuestro
  // para cerrar el set, ganamos 4 de 6 puntos.
  const spec = gameUs.repeat(5) + gameThem + 'TUTUUU';
  const { state } = run(spec);

  it('separa los puntos jugados sacando para cerrar el set del resto', () => {
    expect(closingSyndrome(state.contexts)).toEqual({
      closing: { won: 4, total: 6 },
      rest: { won: 20, total: 24 },
    });
  });

  it('sin ningún juego sacando para cerrar, closing queda vacío', () => {
    const none = run('UUUU');
    expect(closingSyndrome(none.state.contexts).closing).toEqual({ won: 0, total: 0 });
  });
});

describe('resilience', () => {
  it('cuenta los puntos ganados justo después de un no forzado de cada jugador', () => {
    // x U · x T · x U → Ana: ganamos 2 de los 3 puntos siguientes
    const { played, state } = run('xUxTxU');
    expect(resilience(played, state.contexts, PLAYERS)).toEqual([
      { playerId: ANA, ratio: { won: 2, total: 3 } },
      { playerId: LUIS, ratio: { won: 0, total: 0 } },
    ]);
  });

  it('un no forzado en el último punto no tiene punto siguiente', () => {
    const { played, state } = run('Ux');
    expect(resilience(played, state.contexts, PLAYERS)[0].ratio).toEqual({ won: 0, total: 0 });
  });

  it('no cuenta el punto siguiente si es de otro set', () => {
    // El rival gana el primer set 0-6; el último punto del set es un no forzado de Ana
    const { played, state } = run('T'.repeat(23) + 'x' + 'U');
    expect(state.completedSets).toHaveLength(1);
    expect(resilience(played, state.contexts, PLAYERS)[0].ratio).toEqual({ won: 0, total: 0 });
  });
});
