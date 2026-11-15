# Tramo 2 — Informe post-partido: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una pantalla de informe por partido con los seis bloques de la spec (momentum, resumen técnico, bajo presión, síndrome de cierre, resiliencia, efecto de las emociones) y un botón para compartirla como imagen por WhatsApp.

**Architecture:** Toda la analítica son funciones puras sobre la lista de puntos, sus contextos (que ya calcula `computeMatchState`) y las emociones; se prueban sin React ni Firebase. La pantalla solo lee los datos con las mismas consultas del registro, llama a `buildReport` y pinta. La imagen se genera con `html-to-image` sobre el propio informe, **antes** de que el usuario pulse "Compartir", porque iOS rechaza compartir si pasa tiempo entre el toque y la llamada.

**Tech Stack:** TypeScript, React 19, Tailwind v4, Vitest, `html-to-image` (nueva), Web Share API. Sin librería de gráficos: el momentum es un SVG propio.

**Spec:** `docs/superpowers/specs/2026-11-15-padel-mind-match-design.md`, secciones 6 (analítica) y 7 (informe). Este plan cubre solo el tramo 2. Quedan fuera: modo vídeo, zona y pantalla de revisión (tramo 3), y acumulados entre partidos.

**Código ya probado.** Todo el código de este plan (módulos de analítica, componentes y pantalla) se escribió y se ejecutó antes de redactarlo: 51 pruebas nuevas pasan, `tsc` y `vite build` terminan sin errores, el informe se vio renderizado con un partido simulado en tamaño de móvil y la generación de la imagen funcionó en Chrome (750×3088 px, 421 KB, ~2 s). Lo que **no** está comprobado es el comportamiento en un iPhone real: de eso trata la Tarea 10.

## Cambios respecto a la spec y decisiones tomadas

- **Sin Recharts ni Chart.js.** La spec decía "una librería como Recharts o Chart.js"; el momentum es un SVG de unas 100 líneas. Menos dependencias, menos peso en la app instalada y un SVG se convierte en imagen sin sorpresas.
- **Exportación como imagen PNG** (no PDF), como se acordó. Web Share con el archivo; si el dispositivo no lo permite, se descarga.
- **La imagen se prepara antes de pulsar el botón** (a los 700 ms de asentarse la pantalla). El botón dice "Preparando imagen…" hasta que está lista.
- **Resiliencia:** mide el punto siguiente a un no forzado, como en la spec. Lo que ocurre tras una emoción negativa se ve en el bloque de emociones.
- **Aviso de golpe** ("Ana falla sobre todo de volea") solo aparece con 2 o más errores con ese golpe: un solo caso no es un patrón.
- **"Finalizar partido"** ahora abre el informe en vez de volver a la lista. En la lista, cada partido tiene un botón "Informe".
- **Detalle de `setsLabel`:** el set en curso solo se muestra si ya se jugó algún punto en él; un set decidido por tie-break se muestra como `7-6(5)` y un tie-break en curso como `6-6 (2-1)`.
- **Las ventanas de emoción que se solapan cuentan cada punto en las dos** (documentado en `emotionSummary`).

---

## Estructura de archivos

```
src/domain/
  analytics/
    types.ts            Ratio, tally, playedPoints
    fixtures.ts         datos de prueba (solo lo usan los tests)
    momentum.ts         serie de momentum, marcas y separadores
    technical.ts        winners / no forzados / forzados por jugador y golpe
    pressure.ts         bajo presión, síndrome de cierre, resiliencia
    emotions.ts         efecto de cada emoción y resumen por jugador
    report.ts           buildReport y setsLabel
    *.test.ts           una prueba por módulo
  format.ts             textos: porcentajes, formato del partido, nombre de archivo
  format.test.ts
src/lib/exportImage.ts  renderNodeToPng, shareImage
src/hooks/useReportImage.ts
src/components/report/
  MomentumChart.tsx     el gráfico SVG
  ReportSections.tsx    los cinco bloques de texto
  ReportView.tsx        el informe completo (lo que se convierte en imagen)
src/screens/ReportScreen.tsx   datos + botón de compartir
Modificados: src/App.tsx, src/screens/HomeScreen.tsx, src/screens/TrackerScreen.tsx, package.json
```

Recuento de pruebas del proyecto al terminar cada tarea (hoy: 35): T1 → 43, T2 → 51, T3 → 60, T4 → 70, T5 → 79, T6 → 86. Las tareas 7 a 9 no añaden pruebas.

---

### Task 1: Base de la analítica y momentum

**Files:**
- Create: `src/domain/analytics/types.ts`, `src/domain/analytics/fixtures.ts`, `src/domain/analytics/momentum.ts`
- Test: `src/domain/analytics/momentum.test.ts`

Contexto: `computeMatchState(points, format, firstServer)` (en `src/domain/scoring.ts`) devuelve `contexts`: uno por punto jugado, con la situación **antes** de jugarse (`setIndex`, `gamesUs`, `gamesThem`, `isGoldenPoint`, `isBreakPoint`, `servingForSet`, `wonBy`…). Los puntos sobrantes tras el final del partido no tienen contexto. La analítica trabaja siempre sobre los puntos jugados.

- [ ] **Step 1: Crear los apoyos `types.ts` y `fixtures.ts`**

`src/domain/analytics/types.ts`:

```ts
import type { MatchState } from '../scoring';
import type { Point } from '../types';

export type Ratio = { won: number; total: number };

export const ratio = (won: number, total: number): Ratio => ({ won, total });

// Cuenta cuántos elementos cumplen `isWon` sobre el total de la lista.
export function tally<T>(items: T[], isWon: (item: T) => boolean): Ratio {
  return ratio(items.filter(isWon).length, items.length);
}

// Los puntos que cuentan para las estadísticas: los sobrantes tras el final del partido no entran.
// (`computeMatchState` los deja siempre al final de la lista.)
export function playedPoints(points: Point[], state: MatchState): Point[] {
  return points.slice(0, state.contexts.length);
}
```

`src/domain/analytics/fixtures.ts` (los tests describen un partido con una cadena de letras; la leyenda está en el propio archivo):

```ts
import { computeMatchState } from '../scoring';
import type { Emotion, EmotionTag, MatchFormat, Outcome, Point, Side } from '../types';
import { playedPoints } from './types';

export const ANA = 'ana';
export const LUIS = 'luis';
export const PLAYERS: [string, string] = [ANA, LUIS];
export const GOLD: MatchFormat = { deuce: 'punto_de_oro', finalSet: 'set_completo' };
export const ADV: MatchFormat = { deuce: 'ventajas', finalSet: 'set_completo' };

// Cada letra es un punto:
//   U / T = punto nuestro / rival sin detalle     e = error rival      w = winner rival
//   a / b = winner de Ana / de Luis               f = forzado de Ana
//   x / y = no forzado de Ana / de Luis
const TOKENS: Record<string, [Outcome, string | null]> = {
  U: ['nuestro_sin_detalle', null],
  T: ['rival_sin_detalle', null],
  a: ['winner_nuestro', ANA],
  b: ['winner_nuestro', LUIS],
  x: ['no_forzado_nuestro', ANA],
  y: ['no_forzado_nuestro', LUIS],
  f: ['forzado_nuestro', ANA],
  e: ['error_rival', null],
  w: ['winner_rival', null],
};

// Los puntos se llaman pt1, pt2… por orden.
export function pts(spec: string): Point[] {
  return [...spec].map((token, i) => {
    const entry = TOKENS[token];
    if (!entry) throw new Error(`Letra de punto desconocida: ${token}`);
    return {
      id: `pt${i + 1}`,
      order: i + 1,
      timestamp: 0,
      outcome: entry[0],
      playerId: entry[1],
      shot: null,
      zone: null,
    };
  });
}

export function run(spec: string, format: MatchFormat = GOLD, firstServer: Side = 'us') {
  const points = pts(spec);
  const state = computeMatchState(points, format, firstServer);
  return { points, state, played: playedPoints(points, state) };
}

export function emotion(id: string, playerId: string, tag: EmotionTag, afterPointId: string | null): Emotion {
  return { id, playerId, tag, afterPointId, timestamp: 0 };
}

// Un juego ganado por nosotros / por el rival con punto de oro (4 puntos).
export const gameUs = 'UUUU';
export const gameThem = 'TTTT';
```

- [ ] **Step 2: Escribir el test de momentum**

`src/domain/analytics/momentum.test.ts`:

```ts
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
```

- [ ] **Step 3: Ejecutar y comprobar que falla**

Run: `npx vitest run src/domain/analytics/momentum.test.ts`
Expected: FAIL, no se puede resolver `./momentum`.

- [ ] **Step 4: Implementar `momentum.ts`**

```ts
import { EMOTION_LABEL, POSITIVE_EMOTIONS } from '../helpers';
import type { PointContext } from '../scoring';
import type { Emotion, Point } from '../types';

export type MarkKind = 'gold' | 'break_us' | 'break_them' | 'emotion_neg' | 'emotion_pos';
export type Mark = { x: number; y: number; kind: MarkKind; label: string };
export type Boundary = { x: number; kind: 'game' | 'set'; setIndex: number };
export type Momentum = { values: number[]; marks: Mark[]; boundaries: Boundary[] };

// `values[i]` es el saldo tras i puntos: +1 por cada punto nuestro, −1 por cada punto rival.
// `x` cuenta puntos ya jugados: una marca o un separador en x queda entre el punto x y el x+1.
export function momentum(played: Point[], contexts: PointContext[], emotions: Emotion[]): Momentum {
  const values = [0];
  const marks: Mark[] = [];
  const boundaries: Boundary[] = [];

  played.forEach((_, j) => {
    const c = contexts[j];
    const prev = contexts[j - 1];
    if (prev) {
      if (c.setIndex !== prev.setIndex) {
        boundaries.push({ x: j, kind: 'set', setIndex: c.setIndex });
      } else if (c.gamesUs + c.gamesThem !== prev.gamesUs + prev.gamesThem) {
        boundaries.push({ x: j, kind: 'game', setIndex: c.setIndex });
      }
    }

    values.push(values[j] + (c.wonBy === 'us' ? 1 : -1));
    const x = j + 1;
    if (c.isBreakPoint !== null && c.wonBy === c.isBreakPoint) {
      marks.push({ x, y: values[x], kind: c.isBreakPoint === 'us' ? 'break_us' : 'break_them', label: 'Break' });
    } else if (c.isGoldenPoint) {
      marks.push({ x, y: values[x], kind: 'gold', label: 'Punto de oro' });
    }
  });

  for (const e of emotions) {
    const x = e.afterPointId === null ? 0 : played.findIndex((p) => p.id === e.afterPointId) + 1;
    if (e.afterPointId !== null && x === 0) continue; // el punto ya no existe
    marks.push({
      x,
      y: values[x],
      kind: POSITIVE_EMOTIONS.includes(e.tag) ? 'emotion_pos' : 'emotion_neg',
      label: EMOTION_LABEL[e.tag],
    });
  }

  return { values, marks, boundaries };
}
```

- [ ] **Step 5: Ejecutar todo y comprobar que pasa**

Run: `npm test` y `npx tsc`
Expected: 43 pruebas pasan (8 nuevas); `tsc` no imprime nada.

- [ ] **Step 6: Commit**

```bash
git add src/domain/analytics
git commit -m "Analítica: base y serie de momentum con sus marcas"
```

---

### Task 2: Resumen técnico

**Files:**
- Create: `src/domain/analytics/technical.ts`
- Test: `src/domain/analytics/technical.test.ts`

- [ ] **Step 1: Escribir el test**

```ts
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
    expect(topUnforcedShot(ana)).toEqual({ shot: 'bandeja_vibora', count: 2 });
  });

  it('devuelve null si no hay no forzados con golpe anotado', () => {
    const [ana] = technicalSummary(pts('xa'), PLAYERS);
    expect(topUnforcedShot(ana)).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run src/domain/analytics/technical.test.ts`
Expected: FAIL, no se puede resolver `./technical`.

- [ ] **Step 3: Implementar `technical.ts`**

```ts
import { SHOTS } from '../helpers';
import type { Point, Shot } from '../types';

export type ShotTally = { winners: number; unforced: number; forced: number };

export type PlayerTechnical = {
  playerId: string;
  winners: number;
  unforced: number;
  forced: number;
  balance: number; // winners − no forzados
  byShot: Partial<Record<Shot, ShotTally>>; // solo los puntos con golpe anotado
};

export function technicalSummary(played: Point[], playerIds: [string, string]): PlayerTechnical[] {
  return playerIds.map((playerId) => {
    const row: PlayerTechnical = { playerId, winners: 0, unforced: 0, forced: 0, balance: 0, byShot: {} };
    for (const p of played) {
      if (p.playerId !== playerId) continue;
      const field =
        p.outcome === 'winner_nuestro'
          ? 'winners'
          : p.outcome === 'no_forzado_nuestro'
            ? 'unforced'
            : p.outcome === 'forzado_nuestro'
              ? 'forced'
              : null;
      if (!field) continue;
      row[field]++;
      if (p.shot) {
        const tally = (row.byShot[p.shot] ??= { winners: 0, unforced: 0, forced: 0 });
        tally[field]++;
      }
    }
    row.balance = row.winners - row.unforced;
    return row;
  });
}

// Puntos que se registraron sin saber cómo acabaron: cuentan para el marcador, no para winners ni errores.
export function withoutDetail(played: Point[]): number {
  return played.filter((p) => p.outcome === 'nuestro_sin_detalle' || p.outcome === 'rival_sin_detalle').length;
}

// El golpe con el que más errores no forzados se anotaron (el primero de la lista si hay empate).
export function topUnforcedShot(row: PlayerTechnical): { shot: Shot; count: number } | null {
  let best: { shot: Shot; count: number } | null = null;
  for (const shot of SHOTS) {
    const count = row.byShot[shot]?.unforced ?? 0;
    if (count > 0 && (!best || count > best.count)) best = { shot, count };
  }
  return best;
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npm test` y `npx tsc`
Expected: 51 pruebas pasan; `tsc` sin salida.

- [ ] **Step 5: Commit**

```bash
git add src/domain/analytics
git commit -m "Analítica: resumen técnico por jugador y por golpe"
```

---

### Task 3: Bajo presión, síndrome de cierre y resiliencia

**Files:**
- Create: `src/domain/analytics/pressure.ts`
- Test: `src/domain/analytics/pressure.test.ts`

- [ ] **Step 1: Escribir el test**

```ts
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
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run src/domain/analytics/pressure.test.ts`
Expected: FAIL, no se puede resolver `./pressure`.

- [ ] **Step 3: Implementar `pressure.ts`**

```ts
import type { PointContext } from '../scoring';
import type { Point } from '../types';
import { ratio, tally, type Ratio } from './types';

const wonByUs = (c: PointContext) => c.wonBy === 'us';

export type Pressure = {
  golden: Ratio; // puntos de oro ganados / jugados
  breakConverted: Ratio; // bolas de break nuestras ganadas / jugadas
  breakSaved: Ratio; // bolas de break del rival que salvamos / jugadas
};

export function pressure(contexts: PointContext[]): Pressure {
  return {
    golden: tally(contexts.filter((c) => c.isGoldenPoint), wonByUs),
    breakConverted: tally(contexts.filter((c) => c.isBreakPoint === 'us'), wonByUs),
    breakSaved: tally(contexts.filter((c) => c.isBreakPoint === 'them'), wonByUs),
  };
}

export type Closing = {
  closing: Ratio; // puntos ganados mientras nuestra pareja saca para cerrar el set
  rest: Ratio; // puntos ganados en el resto del partido
};

export function closingSyndrome(contexts: PointContext[]): Closing {
  return {
    closing: tally(contexts.filter((c) => c.servingForSet === 'us'), wonByUs),
    rest: tally(contexts.filter((c) => c.servingForSet !== 'us'), wonByUs),
  };
}

// De los puntos jugados justo después de un error no forzado de cada jugador, cuántos gana la pareja.
// Solo cuenta el punto siguiente si es del mismo set.
export function resilience(
  played: Point[],
  contexts: PointContext[],
  playerIds: [string, string],
): { playerId: string; ratio: Ratio }[] {
  return playerIds.map((playerId) => {
    let won = 0;
    let total = 0;
    played.forEach((p, j) => {
      if (p.outcome !== 'no_forzado_nuestro' || p.playerId !== playerId) return;
      const next = contexts[j + 1];
      if (!next || next.setIndex !== contexts[j].setIndex) return;
      total++;
      if (next.wonBy === 'us') won++;
    });
    return { playerId, ratio: ratio(won, total) };
  });
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npm test` y `npx tsc`
Expected: 60 pruebas pasan; `tsc` sin salida.

- [ ] **Step 5: Commit**

```bash
git add src/domain/analytics
git commit -m "Analítica: bajo presión, síndrome de cierre y resiliencia"
```

---

### Task 4: Efecto de las emociones

**Files:**
- Create: `src/domain/analytics/emotions.ts`
- Test: `src/domain/analytics/emotions.test.ts`

- [ ] **Step 1: Escribir el test**

```ts
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
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run src/domain/analytics/emotions.test.ts`
Expected: FAIL, no se puede resolver `./emotions`.

- [ ] **Step 3: Implementar `emotions.ts`**

```ts
import type { PointContext, Situation } from '../scoring';
import type { Emotion, EmotionTag, Point } from '../types';
import { ratio, type Ratio } from './types';

// Cuántos puntos siguientes a una emoción se miran.
export const EMOTION_WINDOW = 5;

export type EmotionEffect = {
  emotionId: string;
  playerId: string;
  tag: EmotionTag;
  contextLabel: string; // dónde ocurrió: "Set 2 · 4-3 · 30-30"
  window: Ratio; // puntos ganados por la pareja / puntos mirados (hasta EMOTION_WINDOW, sin salir del set)
  unforcedByPlayer: number; // no forzados de ese jugador dentro de la ventana
};

export type EmotionSummary = {
  playerId: string;
  tag: EmotionTag;
  count: number;
  afterTag: Ratio; // suma de las ventanas de esa etiqueta y jugador
};

type LabelSource = Pick<Situation, 'setIndex' | 'gamesUs' | 'gamesThem' | 'scoreLabel'>;

export const situationLabel = (s: LabelSource) => `Set ${s.setIndex + 1} · ${s.gamesUs}-${s.gamesThem} · ${s.scoreLabel}`;

// `current` es la situación tras el último punto (null si el partido ha terminado); se usa para
// situar una emoción anotada después del último punto jugado.
export function emotionEffects(
  played: Point[],
  contexts: PointContext[],
  emotions: Emotion[],
  current: Situation | null,
): EmotionEffect[] {
  const effects: EmotionEffect[] = [];

  for (const e of emotions) {
    // `start` es el índice del punto tras el que se anotó la emoción (−1: antes del primero).
    const start = e.afterPointId === null ? -1 : played.findIndex((p) => p.id === e.afterPointId);
    if (e.afterPointId !== null && start === -1) continue; // el punto ya no existe

    const emotionSet = start === -1 ? (contexts[0]?.setIndex ?? 0) : contexts[start].setIndex;
    let won = 0;
    let total = 0;
    let unforced = 0;
    for (let j = start + 1; j < played.length && j <= start + EMOTION_WINDOW; j++) {
      if (contexts[j].setIndex !== emotionSet) break; // la ventana se corta al acabar el set
      total++;
      if (contexts[j].wonBy === 'us') won++;
      if (played[j].outcome === 'no_forzado_nuestro' && played[j].playerId === e.playerId) unforced++;
    }

    const at = contexts[start + 1] ?? current;
    effects.push({
      emotionId: e.id,
      playerId: e.playerId,
      tag: e.tag,
      contextLabel: at ? situationLabel(at) : 'Final del partido',
      window: ratio(won, total),
      unforcedByPlayer: unforced,
    });
  }

  return effects;
}

// Agrupa por jugador y etiqueta. Si dos ventanas se solapan, esos puntos cuentan en las dos.
export function emotionSummary(effects: EmotionEffect[]): EmotionSummary[] {
  const groups = new Map<string, EmotionSummary>();
  for (const e of effects) {
    const key = `${e.playerId}|${e.tag}`;
    const group = groups.get(key) ?? { playerId: e.playerId, tag: e.tag, count: 0, afterTag: ratio(0, 0) };
    group.count++;
    group.afterTag = ratio(group.afterTag.won + e.window.won, group.afterTag.total + e.window.total);
    groups.set(key, group);
  }
  return [...groups.values()];
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npm test` y `npx tsc`
Expected: 70 pruebas pasan; `tsc` sin salida.

- [ ] **Step 5: Commit**

```bash
git add src/domain/analytics
git commit -m "Analítica: efecto de las emociones en los puntos siguientes"
```

---

### Task 5: Ensamblar el informe

**Files:**
- Create: `src/domain/analytics/report.ts`
- Test: `src/domain/analytics/report.test.ts`

- [ ] **Step 1: Escribir el test**

```ts
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
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run src/domain/analytics/report.test.ts`
Expected: FAIL, no se puede resolver `./report`.

- [ ] **Step 3: Implementar `report.ts`**

```ts
import { computeMatchState, type MatchState } from '../scoring';
import type { Emotion, Match, Point } from '../types';
import { emotionEffects, emotionSummary, type EmotionEffect, type EmotionSummary } from './emotions';
import { momentum, type Momentum } from './momentum';
import { closingSyndrome, pressure, resilience, type Closing, type Pressure } from './pressure';
import { technicalSummary, withoutDetail, type PlayerTechnical } from './technical';
import { playedPoints, tally, type Ratio } from './types';

export type Report = {
  state: MatchState;
  played: Point[];
  setsText: string; // "6-3 4-6 6-7(5)"
  pointsWon: Ratio; // puntos ganados por nuestra pareja sobre los jugados
  momentum: Momentum;
  technical: PlayerTechnical[];
  withoutDetail: number;
  pressure: Pressure;
  closing: Closing;
  resilience: { playerId: string; ratio: Ratio }[];
  emotions: EmotionEffect[];
  emotionSummary: EmotionSummary[];
};

// Resultado por sets: los terminados y, si el partido sigue, el set en curso (solo si ya se jugó algún punto en él).
//   · Set decidido por tie-break: "7-6(5)", con los puntos del perdedor del tie-break.
//   · Tie-break en curso: "6-6 (2-1)". Súper tie-break en curso: sus puntos, "2-1".
export function setsLabel(state: MatchState): string {
  const parts = state.completedSets.map((s) =>
    s.tiebreak ? `${s.us}-${s.them}(${Math.min(s.tiebreak.us, s.tiebreak.them)})` : `${s.us}-${s.them}`,
  );
  const s = state.situation;
  if (s && state.contexts.some((c) => c.setIndex === s.setIndex)) {
    const games = `${s.gamesUs}-${s.gamesThem}`;
    if (!s.isTiebreak) parts.push(games);
    else parts.push(s.gamesUs + s.gamesThem === 0 ? s.scoreLabel : `${games} (${s.scoreLabel})`);
  }
  return parts.join(' ') || 'Sin puntos';
}

// `points` y `emotions` llegan ordenados (por `order` y por `timestamp`, como los entregan las consultas).
export function buildReport(
  match: Pick<Match, 'playerIds' | 'format' | 'firstServer'>,
  points: Point[],
  emotions: Emotion[],
): Report {
  const state = computeMatchState(points, match.format, match.firstServer);
  const played = playedPoints(points, state);
  const effects = emotionEffects(played, state.contexts, emotions, state.situation);

  return {
    state,
    played,
    setsText: setsLabel(state),
    pointsWon: tally(state.contexts, (c) => c.wonBy === 'us'),
    momentum: momentum(played, state.contexts, emotions),
    technical: technicalSummary(played, match.playerIds),
    withoutDetail: withoutDetail(played),
    pressure: pressure(state.contexts),
    closing: closingSyndrome(state.contexts),
    resilience: resilience(played, state.contexts, match.playerIds),
    emotions: effects,
    emotionSummary: emotionSummary(effects),
  };
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npm test` y `npx tsc`
Expected: 79 pruebas pasan; `tsc` sin salida.

- [ ] **Step 5: Commit**

```bash
git add src/domain/analytics
git commit -m "Analítica: informe completo y resultado por sets"
```

---

### Task 6: Textos y formatos

**Files:**
- Create: `src/domain/format.ts`
- Test: `src/domain/format.test.ts`

- [ ] **Step 1: Escribir el test**

```ts
import { describe, expect, it } from 'vitest';
import { formatLabel, percentText, ratioText, ratioValue, reportFileName, signed } from './format';

describe('percentText y ratioText', () => {
  it('redondea el porcentaje', () => {
    expect(percentText({ won: 5, total: 13 })).toBe('38 %');
    expect(percentText({ won: 1, total: 1 })).toBe('100 %');
  });
  it('sin casos no inventa un porcentaje', () => {
    expect(percentText({ won: 0, total: 0 })).toBe('sin datos');
    expect(ratioValue({ won: 0, total: 0 })).toBeNull();
  });
  it('muestra ganados sobre jugados', () => {
    expect(ratioText({ won: 3, total: 8 })).toBe('3/8');
    expect(ratioValue({ won: 3, total: 8 })).toBe(0.375);
  });
});

describe('signed', () => {
  it('pone el signo', () => {
    expect([signed(3), signed(-5), signed(0)]).toEqual(['+3', '−5', '0']);
  });
});

describe('formatLabel', () => {
  it('describe el formato del partido', () => {
    expect(formatLabel({ deuce: 'punto_de_oro', finalSet: 'set_completo' })).toBe('Punto de oro');
    expect(formatLabel({ deuce: 'ventajas', finalSet: 'super_tiebreak' })).toBe('Ventajas · súper tie-break');
  });
});

describe('reportFileName', () => {
  const day = new Date(2026, 10, 15).getTime(); // 15 nov 2026, hora local
  it('quita tildes y símbolos y añade la fecha', () => {
    expect(reportFileName('Andrés / Pedro vs Los Cuñados', day)).toBe('informe-andres-pedro-vs-los-cunados-2026-11-15.png');
  });
  it('con un nombre vacío usa "partido"', () => {
    expect(reportFileName('???', day)).toBe('informe-partido-2026-11-15.png');
  });
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run src/domain/format.test.ts`
Expected: FAIL, no se puede resolver `./format`.

- [ ] **Step 3: Implementar `format.ts`**

```ts
import type { Ratio } from './analytics/types';
import type { MatchFormat } from './types';

export const ratioText = (r: Ratio) => `${r.won}/${r.total}`;

export const percentText = (r: Ratio) => (r.total === 0 ? 'sin datos' : `${Math.round((r.won / r.total) * 100)} %`);

// Proporción entre 0 y 1, o null si no hay casos.
export const ratioValue = (r: Ratio): number | null => (r.total === 0 ? null : r.won / r.total);

export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

export function formatLabel(f: MatchFormat): string {
  const deuce = f.deuce === 'punto_de_oro' ? 'Punto de oro' : 'Ventajas';
  return f.finalSet === 'super_tiebreak' ? `${deuce} · súper tie-break` : deuce;
}

// "informe-ana-luis-2026-11-15.png": sin tildes ni símbolos, en minúsculas.
export function reportFileName(label: string, date: number): string {
  const slug = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const d = new Date(date);
  const day = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  return `informe-${slug || 'partido'}-${day}.png`;
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npm test` y `npx tsc`
Expected: 86 pruebas pasan; `tsc` sin salida.

- [ ] **Step 5: Commit**

```bash
git add src/domain/format.ts src/domain/format.test.ts
git commit -m "Textos y formatos del informe"
```

---

### Task 7: Generar y compartir la imagen

**Files:**
- Create: `src/lib/exportImage.ts`, `src/hooks/useReportImage.ts`
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Instalar la dependencia**

Run: `npm install html-to-image`
Expected: se añade a `dependencies` en `package.json` (versión probada: 1.11.13). Si npm instala otra versión mayor, anotarlo en el informe.

- [ ] **Step 2: Crear `src/lib/exportImage.ts`**

```ts
import { toBlob } from 'html-to-image';

export const REPORT_BACKGROUND = '#0b0f14';

// Convierte un elemento en una imagen PNG (el doble de resolución que en pantalla).
export async function renderNodeToPng(node: HTMLElement): Promise<Blob> {
  const options = { pixelRatio: 2, backgroundColor: REPORT_BACKGROUND };
  // Safari a veces devuelve una imagen incompleta en la primera pasada: se descarta y se repite.
  await toBlob(node, options);
  const blob = await toBlob(node, options);
  if (!blob) throw new Error('No se pudo generar la imagen');
  return blob;
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

// Abre el menú de compartir del sistema con la imagen; si el dispositivo no lo permite, la descarga.
// Hay que llamarla directamente desde el toque del usuario, sin esperar nada antes: iOS rechaza
// compartir si ha pasado tiempo desde el toque. Por eso la imagen se prepara antes (useReportImage).
export function shareImage(blob: Blob, filename: string, title: string): Promise<ShareResult> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    return navigator.share({ files: [file], title }).then(
      () => 'shared' as const,
      (e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled' as const;
        downloadBlob(blob, filename);
        return 'downloaded' as const;
      },
    );
  }
  downloadBlob(blob, filename);
  return Promise.resolve('downloaded');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
```

- [ ] **Step 3: Crear `src/hooks/useReportImage.ts`**

```ts
import { useEffect, useState, type RefObject } from 'react';
import { renderNodeToPng } from '../lib/exportImage';

export type ReportImage =
  | { status: 'preparing' }
  | { status: 'ready'; blob: Blob }
  | { status: 'error'; message: string };

const SETTLE_MS = 700;

// Prepara la imagen del informe en cuanto la pantalla se asienta, para que al pulsar "Compartir"
// ya esté lista. `version` cambia cuando cambia el contenido y obliga a prepararla de nuevo.
export function useReportImage(ref: RefObject<HTMLElement | null>, version: unknown): ReportImage {
  const [image, setImage] = useState<ReportImage>({ status: 'preparing' });

  useEffect(() => {
    let cancelled = false;
    setImage({ status: 'preparing' });
    const timer = setTimeout(() => {
      const node = ref.current;
      if (!node) return;
      renderNodeToPng(node).then(
        (blob) => {
          if (!cancelled) setImage({ status: 'ready', blob });
        },
        (e: unknown) => {
          if (!cancelled) setImage({ status: 'error', message: e instanceof Error ? e.message : 'Error desconocido' });
        },
      );
    }, SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ref, version]);

  return image;
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc` y `npm test`
Expected: `tsc` sin salida; 86 pruebas pasan.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib src/hooks/useReportImage.ts
git commit -m "Generación de la imagen del informe y compartir con el sistema"
```

---

### Task 8: Componentes del informe

**Files:**
- Create: `src/components/report/MomentumChart.tsx`, `src/components/report/ReportSections.tsx`, `src/components/report/ReportView.tsx`

- [ ] **Step 1: Crear `MomentumChart.tsx`**

El eje X son los puntos; el eje Y, el saldo acumulado (sube con cada punto nuestro, baja con cada rival). Los separadores finos son juegos, los gruesos con etiqueta son sets. Formas: círculo relleno = punto de oro, rombo = break (verde nuestro, rojo rival), anillo = emoción (verde positiva, rojo negativa).

```tsx
import type { Mark, Momentum } from '../../domain/analytics/momentum';

const W = 520;
const H = 190;
const PAD_X = 10;
const PAD_TOP = 22;
const PAD_BOTTOM = 12;

const COLORS = {
  line: '#5aa9ff',
  axis: '#3a4656',
  game: '#1f2a37',
  text: '#8a97a6',
  gold: '#f5c542',
  good: '#4fd08a',
  bad: '#ef6b6b',
};

function MarkShape({ mark, cx, cy }: { mark: Mark; cx: number; cy: number }) {
  switch (mark.kind) {
    case 'gold':
      return <circle cx={cx} cy={cy} r={4.5} fill={COLORS.gold} />;
    case 'break_us':
    case 'break_them': {
      const fill = mark.kind === 'break_us' ? COLORS.good : COLORS.bad;
      return <polygon points={`${cx},${cy - 6.5} ${cx + 6.5},${cy} ${cx},${cy + 6.5} ${cx - 6.5},${cy}`} fill={fill} />;
    }
    case 'emotion_pos':
    case 'emotion_neg':
      return (
        <circle
          cx={cx}
          cy={cy}
          r={7}
          fill="none"
          stroke={mark.kind === 'emotion_pos' ? COLORS.good : COLORS.bad}
          strokeWidth={2.5}
        />
      );
  }
}

export default function MomentumChart({ momentum }: { momentum: Momentum }) {
  const n = momentum.values.length - 1;
  if (n <= 0) return null;

  const maxAbs = Math.max(5, ...momentum.values.map((v) => Math.abs(v)));
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const mid = PAD_TOP + innerH / 2;
  const x = (i: number) => PAD_X + (i / n) * (W - 2 * PAD_X);
  const y = (v: number) => mid - (v / maxAbs) * (innerH / 2);
  const line = momentum.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const sets = [{ x: 0, setIndex: 0 }, ...momentum.boundaries.filter((b) => b.kind === 'set')];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Gráfico de momentum del partido">
        {momentum.boundaries
          .filter((b) => b.kind === 'game')
          .map((b) => (
            <line key={`g${b.x}`} x1={x(b.x)} x2={x(b.x)} y1={PAD_TOP} y2={H - PAD_BOTTOM} stroke={COLORS.game} />
          ))}
        {sets.map((s) => (
          <g key={`s${s.x}`}>
            {s.x > 0 && <line x1={x(s.x)} x2={x(s.x)} y1={4} y2={H - PAD_BOTTOM} stroke={COLORS.axis} />}
            <text x={x(s.x) + 4} y={14} fill={COLORS.text} fontSize={10}>
              Set {s.setIndex + 1}
            </text>
          </g>
        ))}
        <line x1={PAD_X} x2={W - PAD_X} y1={mid} y2={mid} stroke={COLORS.axis} strokeDasharray="4 4" />
        <text x={W - PAD_X} y={mid - 4} fill={COLORS.text} fontSize={9} textAnchor="end">
          nosotros ▲ · ▼ rival
        </text>
        <polyline fill="none" stroke={COLORS.line} strokeWidth={2.5} strokeLinejoin="round" points={line} />
        {momentum.marks.map((m, i) => (
          <MarkShape key={i} mark={m} cx={x(m.x)} cy={y(m.y)} />
        ))}
      </svg>
      <p className="mt-1 text-[10px] leading-4 text-slate-400">
        <span style={{ color: COLORS.gold }}>●</span> punto de oro · <span style={{ color: COLORS.good }}>◆</span> break
        nuestro · <span style={{ color: COLORS.bad }}>◆</span> break rival · <span style={{ color: COLORS.good }}>○</span>{' '}
        emoción positiva · <span style={{ color: COLORS.bad }}>○</span> emoción negativa
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Crear `ReportSections.tsx`**

```tsx
import type { ReactNode } from 'react';
import type { EmotionEffect, EmotionSummary } from '../../domain/analytics/emotions';
import type { Closing, Pressure } from '../../domain/analytics/pressure';
import { topUnforcedShot, type PlayerTechnical } from '../../domain/analytics/technical';
import type { Ratio } from '../../domain/analytics/types';
import { percentText, ratioText, ratioValue, signed } from '../../domain/format';
import { EMOTION_LABEL, SHOT_LABEL } from '../../domain/helpers';

export type NameOf = (playerId: string) => string;
type Tone = 'good' | 'bad' | undefined;

const TONE_CLASS = { good: 'text-green-400', bad: 'text-red-400' };

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h2>
      <div className="rounded-xl bg-slate-900 p-3">{children}</div>
    </section>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: Tone }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${tone ? TONE_CLASS[tone] : ''}`}>{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

const countLabel = (r: Ratio) => (r.total === 0 ? 'sin casos' : ratioText(r));

// Un solo error con un golpe no es un patrón: solo se señala a partir de este número.
const MIN_SHOT_ERRORS = 2;

export function TechnicalSection({
  rows,
  withoutDetail,
  name,
}: {
  rows: PlayerTechnical[];
  withoutDetail: number;
  name: NameOf;
}) {
  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400">
            <th className="py-1 text-left font-semibold" />
            <th className="font-semibold">Winners</th>
            <th className="font-semibold">No forz.</th>
            <th className="font-semibold">Forzados</th>
            <th className="font-semibold">Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.playerId} className="border-t border-slate-800 text-center">
              <td className="py-2 text-left">{name(r.playerId)}</td>
              <td>{r.winners}</td>
              <td>{r.unforced}</td>
              <td>{r.forced}</td>
              <td className={`font-bold ${r.balance < 0 ? TONE_CLASS.bad : r.balance > 0 ? TONE_CLASS.good : ''}`}>
                {signed(r.balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.map((r) => {
        const top = topUnforcedShot(r);
        return top && top.count >= MIN_SHOT_ERRORS ? (
          <p key={r.playerId} className="mt-2 text-xs text-slate-400">
            {name(r.playerId)} falla sobre todo de {SHOT_LABEL[top.shot].toLowerCase()} ({top.count} de {r.unforced} no
            forzados).
          </p>
        ) : null;
      })}
      {withoutDetail > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          {withoutDetail} {withoutDetail === 1 ? 'punto' : 'puntos'} sin detalle: cuentan en el marcador, no aquí.
        </p>
      )}
    </>
  );
}

export function PressureSection({ pressure }: { pressure: Pressure }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat value={countLabel(pressure.golden)} label="puntos de oro ganados" />
      <Stat value={countLabel(pressure.breakConverted)} label="bolas de break convertidas" />
      <Stat value={countLabel(pressure.breakSaved)} label="bolas de break salvadas" />
    </div>
  );
}

export function ClosingSection({ closing }: { closing: Closing }) {
  const a = ratioValue(closing.closing);
  const b = ratioValue(closing.rest);
  const tone: Tone = a !== null && b !== null ? (a < b ? 'bad' : 'good') : undefined;
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat
        value={percentText(closing.closing)}
        tone={tone}
        label={`puntos ganados sacando para cerrar set (${closing.closing.total})`}
      />
      <Stat value={percentText(closing.rest)} label={`puntos ganados en el resto del partido (${closing.rest.total})`} />
    </div>
  );
}

export function ResilienceSection({ rows, name }: { rows: { playerId: string; ratio: Ratio }[]; name: NameOf }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map((r) => (
        <Stat
          key={r.playerId}
          value={percentText(r.ratio)}
          label={`${name(r.playerId)}: gana el punto siguiente a un no forzado suyo (${countLabel(r.ratio)})`}
        />
      ))}
    </div>
  );
}

export function EmotionsSection({
  effects,
  summary,
  pointsWon,
  name,
}: {
  effects: EmotionEffect[];
  summary: EmotionSummary[];
  pointsWon: Ratio;
  name: NameOf;
}) {
  if (effects.length === 0) return <p className="text-sm text-slate-400">No se anotó ninguna emoción en este partido.</p>;
  return (
    <>
      {effects.map((e) => {
        const rate = ratioValue(e.window);
        const tone: Tone = rate === null ? undefined : rate < 0.5 ? 'bad' : rate > 0.5 ? 'good' : undefined;
        return (
          <div key={e.emotionId} className="flex justify-between gap-3 border-b border-slate-800 py-2 text-xs last:border-0">
            <span>
              {name(e.playerId)} · {EMOTION_LABEL[e.tag]} · {e.contextLabel}
            </span>
            <span className={`shrink-0 text-right ${tone ? TONE_CLASS[tone] : 'text-slate-400'}`}>
              {e.window.total === 0
                ? 'sin puntos después'
                : `${e.window.won} de ${e.window.total} siguientes${
                    e.unforcedByPlayer > 0 ? ` · ${e.unforcedByPlayer} no forz. suyos` : ''
                  }`}
            </span>
          </div>
        );
      })}
      <h3 className="mb-1 mt-3 text-xs font-bold text-slate-400">Por jugador y emoción</h3>
      {summary.map((s) => (
        <p key={`${s.playerId}${s.tag}`} className="py-1 text-xs">
          {name(s.playerId)} · {EMOTION_LABEL[s.tag]} ({s.count}):{' '}
          {s.afterTag.total === 0
            ? 'sin puntos después.'
            : `gana ${percentText(s.afterTag)} de los puntos siguientes frente a ${percentText(pointsWon)} en el partido.`}
        </p>
      ))}
      <p className="mt-2 text-[10px] text-slate-500">
        Pocas emociones por partido: son pistas, no conclusiones. El patrón fiable sale al sumar varios partidos.
      </p>
    </>
  );
}
```

- [ ] **Step 3: Crear `ReportView.tsx`**

```tsx
import type { Ref } from 'react';
import type { Report } from '../../domain/analytics/report';
import MomentumChart from './MomentumChart';
import {
  ClosingSection,
  EmotionsSection,
  PressureSection,
  ResilienceSection,
  Section,
  TechnicalSection,
  type NameOf,
} from './ReportSections';

type Props = {
  report: Report;
  title: string;
  subtitle: string;
  name: NameOf;
  ref?: Ref<HTMLDivElement>;
};

// El informe completo. `ref` apunta al elemento que se convierte en imagen al compartir.
export default function ReportView({ report, title, subtitle, name, ref }: Props) {
  return (
    <div ref={ref} className="bg-[#0b0f14] p-4 text-slate-100">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{title}</p>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
        <p className="shrink-0 text-lg font-bold">{report.setsText}</p>
      </div>

      {report.played.length === 0 ? (
        <p className="mt-8 text-center text-slate-400">Todavía no hay puntos registrados.</p>
      ) : (
        <>
          <Section title="1 · Momentum">
            <MomentumChart momentum={report.momentum} />
          </Section>
          <Section title="2 · Resumen técnico">
            <TechnicalSection rows={report.technical} withoutDetail={report.withoutDetail} name={name} />
          </Section>
          <Section title="3 · Bajo presión">
            <PressureSection pressure={report.pressure} />
          </Section>
          <Section title="4 · Síndrome de cierre">
            <ClosingSection closing={report.closing} />
          </Section>
          <Section title="5 · Resiliencia">
            <ResilienceSection rows={report.resilience} name={name} />
          </Section>
          <Section title="6 · Efecto de las emociones">
            <EmotionsSection
              effects={report.emotions}
              summary={report.emotionSummary}
              pointsWon={report.pointsWon}
              name={name}
            />
          </Section>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc`, `npm test` y `npm run build`
Expected: `tsc` sin salida; 86 pruebas pasan; la compilación termina sin errores (el aviso de tamaño del paquete es esperable).

- [ ] **Step 5: Commit**

```bash
git add src/components/report
git commit -m "Componentes del informe: gráfico de momentum y bloques"
```

---

### Task 9: Pantalla, ruta y enlaces

**Files:**
- Create: `src/screens/ReportScreen.tsx`
- Modify: `src/App.tsx`, `src/screens/HomeScreen.tsx`, `src/screens/TrackerScreen.tsx`

- [ ] **Step 1: Crear `ReportScreen.tsx`**

Lee puntos y emociones con las mismas consultas del registro (funciona sin conexión desde la caché local), construye el informe y lo pinta. El botón llama a `shareImage` directamente desde el toque con la imagen ya preparada.

```tsx
import { orderBy, query } from 'firebase/firestore';
import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReportView from '../components/report/ReportView';
import { pairName, playerName, useCoachData } from '../data/CoachData';
import { emotionsCol, pointsCol } from '../data/paths';
import { useQuery } from '../data/useQuery';
import { buildReport } from '../domain/analytics/report';
import { formatLabel, reportFileName } from '../domain/format';
import type { Emotion, Match, Player, Point } from '../domain/types';
import { useReportImage } from '../hooks/useReportImage';
import { shareImage } from '../lib/exportImage';

export default function ReportScreen() {
  const { matchId } = useParams();
  const { uid, matches, players, loading } = useCoachData();
  const match = matches.find((m) => m.id === matchId);
  if (loading) return <p className="p-6 text-slate-400">Cargando…</p>;
  if (!match) {
    return (
      <p className="p-6 text-slate-400">
        Partido no encontrado. <Link to="/" className="underline">Volver</Link>
      </p>
    );
  }
  return <Report uid={uid} match={match} players={players} />;
}

function Report({ uid, match, players }: { uid: string; match: Match; players: Player[] }) {
  const pointsQ = useQuery<Point>(useMemo(() => query(pointsCol(uid, match.id), orderBy('order')), [uid, match.id]));
  const emotionsQ = useQuery<Emotion>(
    useMemo(() => query(emotionsCol(uid, match.id), orderBy('timestamp')), [uid, match.id]),
  );

  const report = useMemo(
    () => buildReport(match, pointsQ.data, emotionsQ.data),
    [match, pointsQ.data, emotionsQ.data],
  );

  const cardRef = useRef<HTMLDivElement>(null);
  const image = useReportImage(cardRef, report);
  const [message, setMessage] = useState<string | null>(null);

  const pair = pairName(players, match.playerIds);
  const title = `${pair} vs ${match.opponentsName}`;
  const subtitle = `${new Date(match.date).toLocaleDateString('es-ES')} · ${formatLabel(match.format)}`;

  // Se llama directamente desde el toque: la imagen ya está preparada (ver useReportImage).
  const share = () => {
    if (image.status !== 'ready') return;
    setMessage(null);
    void shareImage(image.blob, reportFileName(pair, match.date), title).then(
      (result) => setMessage(result === 'downloaded' ? 'Imagen guardada en tus descargas.' : null),
      () => setMessage('No se pudo compartir la imagen.'),
    );
  };

  if (pointsQ.loading || emotionsQ.loading) return <p className="p-6 text-slate-400">Cargando…</p>;

  return (
    <div className="mx-auto h-full max-w-xl overflow-y-auto">
      <div className="flex items-center justify-between p-3 text-sm text-slate-400">
        <Link to="/" className="py-2">← Partidos</Link>
        {match.status === 'in_progress' && (
          <Link to={`/partido/${match.id}`} className="px-2 py-2">Volver al registro</Link>
        )}
      </div>

      <ReportView
        ref={cardRef}
        report={report}
        title={title}
        subtitle={subtitle}
        name={(id) => playerName(players, id)}
      />

      <div className="space-y-2 p-4">
        <button
          onClick={share}
          disabled={image.status !== 'ready' || report.played.length === 0}
          className="h-14 w-full rounded-xl bg-blue-600 text-lg font-bold active:brightness-125 disabled:opacity-40"
        >
          {image.status === 'preparing' ? 'Preparando imagen…' : 'Compartir informe'}
        </button>
        {image.status === 'error' && (
          <p className="text-center text-sm text-red-400">No se pudo preparar la imagen: {image.message}</p>
        )}
        {message && <p className="text-center text-sm text-slate-400">{message}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Añadir la ruta en `src/App.tsx`**

Añadir esta importación junto a las demás, después de la de `PlayersScreen`:

```tsx
import ReportScreen from './screens/ReportScreen';
```

y esta ruta dentro de `<Routes>`, justo después de la de `/partido/:matchId`:

```tsx
        <Route path="/partido/:matchId/informe" element={<ReportScreen />} />
```

- [ ] **Step 3: Botón "Informe" en cada partido de `src/screens/HomeScreen.tsx`**

Sustituir este bloque exacto:

```tsx
          <Link key={m.id} to={`/partido/${m.id}`} className="block rounded-xl bg-slate-800 p-4">
            <p className="font-bold">
              {pairName(players, m.playerIds)} vs {m.opponentsName}
            </p>
            <p className="text-sm text-slate-400">
              {new Date(m.date).toLocaleDateString('es-ES')} · {m.status === 'in_progress' ? 'En curso' : 'Terminado'}
            </p>
          </Link>
```

por:

```tsx
          <div key={m.id} className="flex gap-2">
            <Link to={`/partido/${m.id}`} className="block min-w-0 flex-1 rounded-xl bg-slate-800 p-4">
              <p className="truncate font-bold">
                {pairName(players, m.playerIds)} vs {m.opponentsName}
              </p>
              <p className="text-sm text-slate-400">
                {new Date(m.date).toLocaleDateString('es-ES')} · {m.status === 'in_progress' ? 'En curso' : 'Terminado'}
              </p>
            </Link>
            <Link to={`/partido/${m.id}/informe`} className="flex items-center rounded-xl bg-slate-800 px-4 text-sm font-bold">
              Informe
            </Link>
          </div>
```

- [ ] **Step 4: "Finalizar partido" abre el informe, en `src/screens/TrackerScreen.tsx`**

Dentro de la función `finish`, sustituir

```tsx
    navigate('/');
```

por

```tsx
    navigate(`/partido/${match.id}/informe`);
```

(es la única llamada `navigate('/')` del archivo).

- [ ] **Step 5: Verificar**

Run: `npx tsc`, `npm test` y `npm run build`
Expected: `tsc` sin salida; 86 pruebas pasan; compilación correcta.

Run: `npm run dev` en segundo plano y comprobar con `curl` que `/` responde 200 y que `/src/screens/ReportScreen.tsx` responde 200 (es decir, compila); revisar que el log del servidor no muestra errores; detener el servidor. La comprobación interactiva necesita iniciar sesión con Google y la hace el usuario (Tarea 10).

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "Pantalla de informe, ruta y accesos desde la lista y al finalizar"
```

---

### Task 10: Despliegue y comprobaciones en iPhone (usuario)

Esta tarea no la hace un subagente: requiere el iPhone y la sesión de Google del usuario. Antes de empezar, subir los commits a GitHub; Vercel despliega solo.

- [ ] **Step 1: Subir y esperar el despliegue**

Run: `git push origin main`
Comprobar con `vercel ls` que el último despliegue de producción termina en `Ready`.

- [ ] **Step 2: Informe en pantalla**

En el iPhone, con la app instalada: abrir un partido con puntos y emociones desde "Informe" en la lista.
Expected: se ven los seis bloques; el gráfico y los textos caben sin desbordar a 375 px de ancho.

- [ ] **Step 3: Generar la imagen en iOS**

Mirar el botón: debe pasar de "Preparando imagen…" a "Compartir informe" en pocos segundos.
Si queda en "Preparando…" o aparece "No se pudo preparar la imagen": anotar el mensaje y la versión de iOS. Es el riesgo principal de este tramo; si falla, **parar** y replantear la exportación (dibujo directo en canvas) antes de seguir.

- [ ] **Step 4: Compartir a WhatsApp desde la app instalada**

Pulsar "Compartir informe", elegir WhatsApp, enviarlo a uno mismo.
Expected: llega una imagen legible (texto nítido, gráfico completo, fondo oscuro).
Si el menú de compartir no se abre o da error, el plan B ya está implementado: la imagen se descarga; comprobar dónde queda en el iPhone y que se puede adjuntar a mano. Anotar cuál de los dos caminos ocurrió.

- [ ] **Step 5: Sin conexión**

Con el modo avión, abrir el informe de un partido ya cargado.
Expected: se muestra con los datos locales y la imagen se prepara igual.

- [ ] **Step 6: Registrar el resultado**

Crear `docs/superpowers/plans/2026-11-15-tramo-2-comprobaciones.md` con fecha, versión de iOS y el resultado de los pasos 2 a 5, y hacer commit.

---

## Cobertura de la spec (sección 6 y 7, informe)

| Requisito | Tarea |
|---|---|
| Momentum: +1/−1, eje X puntos con juegos y sets, hitos (oro, breaks) y emociones | 1, 8 |
| Resumen técnico por jugador y desglose por golpe | 2, 8 |
| Bajo presión: oro, break convertido, break salvado | 3, 8 |
| Síndrome de cierre frente al resto del partido | 3, 8 |
| Resiliencia por jugador (punto siguiente a un no forzado, mismo set) | 3, 8 |
| Efecto de las emociones: 5 puntos siguientes, corte al acabar el set, no forzados suyos, resumen por jugador y etiqueta | 4, 8 |
| Toda cifra con su número de casos; sin casos, "sin datos" | 3, 6, 8 |
| Informe disponible con el partido sin terminar | 9 (la ruta no exige partido cerrado) |
| Exportar como imagen y compartir (Web Share; descarga como alternativa) | 7, 9, 10 |
| Informe orden fijo de seis bloques | 8 |

Fuera de este plan: modo vídeo, zona y pantalla de revisión (tramo 3); acumulados por jugador y pareja; enlace de solo lectura; PDF.
