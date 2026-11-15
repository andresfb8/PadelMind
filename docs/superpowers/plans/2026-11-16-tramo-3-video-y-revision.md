# Tramo 3 — Modo vídeo y revisión punto por punto: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poder registrar un partido desde un vídeo (golpe y zona a la vista hasta el siguiente punto) y completar o corregir después cualquier partido, punto por punto, desde una pantalla de revisión.

**Architecture:** Dos piezas sobre los mismos datos. El modo vídeo solo cambia cuánto muestra la pantalla de registro. La revisión lista los puntos con el marcador previo de cada uno y abre un panel para editarlos. La lógica (orden de un punto insertado, filas de revisión, validación del borrador) es pura y está probada; los componentes la pintan y llaman a mutaciones que, como siempre, no esperan a Firestore. Como el marcador se calcula a partir de la lista, cualquier corrección lo rehace solo.

**Tech Stack:** TypeScript, React 19, Tailwind v4, Vitest, Firestore (sin cambios en las reglas ni en la estructura de datos).

**Spec:** `docs/superpowers/specs/2026-11-15-padel-mind-match-design.md`, secciones 7 (Registro, modo vídeo, Revisión) y 4 (orden de los puntos). Este plan cubre solo el tramo 3. Fuera: acumulados entre partidos, vídeo dentro de la app, usar la zona en el informe (la spec no lo pide).

**Código ya probado.** Todo el código de este plan se escribió y se ejecutó antes de redactarlo:

- 24 pruebas nuevas pasan (110 en total); `tsc` y `vite build` terminan sin errores.
- `ReviewScreen` y `TrackerScreen` reales se ejecutaron en un navegador con una capa de datos simulada que se comporta como Firestore (añade, corrige, inserta y borra en una lista ordenada). Se comprobó: completar la zona de un punto; convertir un punto sin detalle en winner de Luis (pide el jugador antes de guardar); cambiar a "winner rival" descarta jugador, golpe y zona; insertar antes del primero (orden 999), entre dos puntos (2500) y al final; borrar un punto con sus 2 emociones; añadir una emoción; cambiar saque, formato y nombre de los rivales (un nombre vacío no se guarda); el filtro "Por completar".
- Modo vídeo: en directo la fila de golpes se cierra sola a los ~4 s; en vídeo se queda, muestra golpe y zona, se puede elegir y quitar tocando otra vez, un punto del rival la cierra, el siguiente punto de tu pareja la abre sin selección y deshacer la cierra.
- Medido a 375×667 px: el panel de vídeo (148 px) no llega a los botones de punto.

**No** se ejecutó con Firestore real ni en un iPhone: de eso trata la Tarea 7. Un detalle del entorno de pruebas: con la ventana del navegador sin foco no se emiten los eventos de foco, así que el guardado del nombre de los rivales (al salir del campo) se probó emitiendo ese evento a mano.

## Decisiones tomadas (la spec las deja abiertas)

- **Los cambios de un punto se guardan con "Guardar"**, no al vuelo: así el marcador no se rehace a medias mientras eliges. Las emociones (añadir o quitar) y el borrado se aplican al momento.
- **Insertar un punto:** abre el mismo panel vacío; no se guarda hasta elegir cómo acabó (y el jugador, si hace falta). Su orden es el valor intermedio entre sus vecinos, así que no se reescribe ningún otro punto. Con los vecinos pegados hasta el límite numérico (muy improbable: órdenes en milisegundos) avisa en vez de insertar mal.
- **Un punto sin jugador** (del rival o sin detalle) no lleva golpe ni zona: al cambiar el resultado se descartan.
- **Borrar un punto** pide confirmación y borra también sus emociones (spec §4).
- **Puntos sobrantes** (registrados después de terminar el partido) aparecen atenuados con "Sobrante" y se pueden editar o borrar como los demás.
- **Qué cuenta como "por completar":** un punto sin detalle (falta la causa) y un winner, no forzado o forzado nuestro sin golpe o sin zona.
- **El timestamp de un punto insertado** es la hora en que se registra, no la del juego (como ya decía la spec).
- **Selector de modo** en la fila del indicador de sincronización del registro. No hay enlace a la revisión dentro del registro (no cabe en la barra superior de 375 px): se llega desde cada partido de la lista ("Revisión") y desde el informe ("Revisar puntos").
- **Limitación conocida:** en modo vídeo el panel de golpe y zona queda abierto y, en móviles pequeños, tapa parte del marcador y el selector de modo (en un 375×667 queda visible solo la fila de tu pareja). Se compactó al máximo; en la Tarea 7 hay que comprobar si molesta en tu iPhone.
- **`undoPoint` pasa a delegar en `deletePoint`**, con el mismo comportamiento.

---

## Estructura de archivos

```
src/domain/
  ordering.ts          orden de un punto insertado entre dos vecinos
  review.ts            filas de revisión y borrador de un punto
  *.test.ts            una prueba por módulo
src/components/
  Choice.tsx           pregunta con botones (se saca de NewMatchScreen para compartirla)
  ModeToggle.tsx       selector En directo / Desde vídeo
  ShotRow.tsx          (modificado) fila de golpes, con fila de zona en modo vídeo
  review/PointEditor.tsx       panel para completar, corregir o crear un punto
  review/MatchDataEditor.tsx   datos del partido (rivales, formato, saque)
src/screens/
  ReviewScreen.tsx     la pantalla de revisión
  NewMatchScreen.tsx   (modificado) elige el modo
  TrackerScreen.tsx    (modificado) modo vídeo y selector de modo
  HomeScreen.tsx  ReportScreen.tsx   (modificados) enlaces a la revisión
src/data/mutations.ts  (modificado) updatePoint, insertPoint, deletePoint, deleteEmotion, setPointZone
src/domain/helpers.ts  (modificado) ZONES y ZONE_LABEL
src/App.tsx            (modificado) ruta de la revisión
```

Recuento de pruebas al terminar cada tarea (hoy: 86): T1 → 97, T2 → 110. Las tareas 3 a 6 no añaden pruebas.

---

### Task 1: Orden de un punto insertado

**Files:**
- Create: `src/domain/ordering.ts`
- Test: `src/domain/ordering.test.ts`

Contexto: los puntos se ordenan por `order` (milisegundos desde 1970 en los registrados en directo). Insertar entre dos puntos debe dar un valor intermedio sin reescribir los demás. `fixtures.ts` (de `src/domain/analytics`) ya existe y describe un partido con una cadena de letras.

- [ ] **Step 1: Escribir el test**

`src/domain/ordering.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { insertOrder, orderBetween } from './ordering';
import { pts } from './analytics/fixtures';

describe('orderBetween', () => {
  it('sin vecinos usa la hora actual', () => {
    expect(orderBetween(null, null, 99)).toBe(99);
  });

  it('antes del primero queda por debajo de todos', () => {
    expect(orderBetween(null, 10, 99)).toBe(9);
  });

  it('después del último queda por encima de todos', () => {
    expect(orderBetween(10, null, 99)).toBe(99);
    expect(orderBetween(100, null, 99)).toBe(101);
  });

  it('entre dos puntos toma el valor intermedio', () => {
    expect(orderBetween(10, 20, 0)).toBe(15);
    expect(orderBetween(10, 11, 0)).toBe(10.5);
  });

  it('con los vecinos demasiado pegados no hay hueco', () => {
    expect(orderBetween(1e15, 1e15 + 0.125, 0)).toBeNull();
    expect(orderBetween(5, 5, 0)).toBeNull();
  });

  it('se puede insertar muchas veces seguidas en el mismo hueco', () => {
    let next = 2_000;
    for (let i = 0; i < 30; i++) {
      const order = orderBetween(1_000, next, 0);
      expect(order).not.toBeNull();
      expect(order as number).toBeGreaterThan(1_000);
      expect(order as number).toBeLessThan(next);
      next = order as number;
    }
  });
});

describe('insertOrder', () => {
  const points = pts('UUU'); // órdenes 1, 2, 3
  points[0].order = 10;
  points[1].order = 20;
  points[2].order = 30;

  it('antes del primero', () => expect(insertOrder(points, 0, 'before', 99)).toBe(9));
  it('antes de uno intermedio', () => expect(insertOrder(points, 2, 'before', 99)).toBe(25));
  it('después de uno intermedio', () => expect(insertOrder(points, 1, 'after', 99)).toBe(25));
  it('después del último', () => expect(insertOrder(points, 2, 'after', 99)).toBe(99));
  it('en una lista vacía usa la hora actual', () => expect(insertOrder([], 0, 'after', 99)).toBe(99));
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run src/domain/ordering.test.ts`
Expected: FAIL, no se puede resolver `./ordering`.

- [ ] **Step 3: Implementar `ordering.ts`**

```ts
import { nextOrder } from './helpers';
import type { Point } from './types';

// Orden de un punto nuevo entre dos vecinos (null = no hay vecino de ese lado). Devuelve null si
// los vecinos están tan pegados que no cabe un valor entre ellos.
export function orderBetween(prev: number | null, next: number | null, now: number): number | null {
  if (prev === null) return next === null ? now : next - 1;
  if (next === null) return nextOrder(prev, now);
  const middle = (prev + next) / 2;
  return middle > prev && middle < next ? middle : null;
}

// Orden para insertar un punto antes o después del punto de índice `index` de la lista ordenada.
// Insertar entre dos puntos no obliga a reescribir ningún otro.
export function insertOrder(points: Point[], index: number, where: 'before' | 'after', now: number): number | null {
  if (points.length === 0) return now;
  if (where === 'before') return orderBetween(points[index - 1]?.order ?? null, points[index].order, now);
  return orderBetween(points[index].order, points[index + 1]?.order ?? null, now);
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npm test` y `npx tsc`
Expected: 97 pruebas pasan (11 nuevas); `tsc` sin salida.

- [ ] **Step 5: Commit**

```bash
git add src/domain/ordering.ts src/domain/ordering.test.ts
git commit -m "Orden de un punto insertado entre dos vecinos"
```

---

### Task 2: Filas de revisión y borrador de un punto

**Files:**
- Create: `src/domain/review.ts`
- Test: `src/domain/review.test.ts`

- [ ] **Step 1: Escribir el test**

`src/domain/review.test.ts`:

```ts
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
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run src/domain/review.test.ts`
Expected: FAIL, no se puede resolver `./review`.

- [ ] **Step 3: Implementar `review.ts`**

```ts
import { situationLabel } from './analytics/emotions';
import type { MatchState } from './scoring';
import type { Emotion, Outcome, Point, Shot, Zone } from './types';

// Resultados que llevan jugador: una acción de nuestra pareja con autor.
const WITH_PLAYER: Outcome[] = ['winner_nuestro', 'no_forzado_nuestro', 'forzado_nuestro'];
export const outcomeNeedsPlayer = (outcome: Outcome) => WITH_PLAYER.includes(outcome);

export type Missing = 'causa' | 'golpe' | 'zona';

export type ReviewRow = {
  point: Point;
  number: number; // 1, 2, 3…
  situation: string | null; // marcador antes del punto; null si es un punto sobrante
  extra: boolean; // punto registrado después de terminar el partido
  emotions: Emotion[]; // las anotadas justo después de este punto
  missing: Missing[]; // lo que falta por completar
};

// Una fila por punto, en orden. `state` debe salir de los mismos puntos.
export function buildReviewRows(points: Point[], state: MatchState, emotions: Emotion[]): ReviewRow[] {
  return points.map((point, i) => {
    const context = state.contexts[i]; // los puntos sobrantes no tienen contexto
    const missing: Missing[] = [];
    if (point.outcome === 'nuestro_sin_detalle' || point.outcome === 'rival_sin_detalle') missing.push('causa');
    if (outcomeNeedsPlayer(point.outcome)) {
      if (!point.shot) missing.push('golpe');
      if (!point.zone) missing.push('zona');
    }
    return {
      point,
      number: i + 1,
      situation: context ? situationLabel(context) : null,
      extra: !context,
      emotions: emotions.filter((e) => e.afterPointId === point.id),
      missing,
    };
  });
}

export type PointFields = { outcome: Outcome; playerId: string | null; shot: Shot | null; zone: Zone | null };
export type PointDraft = { outcome: Outcome | null; playerId: string | null; shot: Shot | null; zone: Zone | null };

export const emptyDraft: PointDraft = { outcome: null, playerId: null, shot: null, zone: null };

export const draftOf = (p: Point): PointDraft => ({
  outcome: p.outcome,
  playerId: p.playerId,
  shot: p.shot,
  zone: p.zone,
});

// Lo que falta para poder guardar, o null si el borrador ya es válido.
export function draftProblem(d: PointDraft): string | null {
  if (d.outcome === null) return 'Elige cómo acabó el punto.';
  if (outcomeNeedsPlayer(d.outcome) && d.playerId === null) return 'Elige el jugador.';
  return null;
}

// Los campos que se guardan. Un punto sin jugador (del rival o sin detalle) no lleva golpe ni zona,
// aunque el borrador los tuviera de una elección anterior.
export function draftToFields(d: PointDraft): PointFields | null {
  if (draftProblem(d) !== null || d.outcome === null) return null;
  if (!outcomeNeedsPlayer(d.outcome)) return { outcome: d.outcome, playerId: null, shot: null, zone: null };
  return { outcome: d.outcome, playerId: d.playerId, shot: d.shot, zone: d.zone };
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npm test` y `npx tsc`
Expected: 110 pruebas pasan (13 nuevas); `tsc` sin salida.

- [ ] **Step 5: Commit**

```bash
git add src/domain/review.ts src/domain/review.test.ts
git commit -m "Filas de revisión y borrador de un punto"
```

---

### Task 3: Capa de datos, zonas y selector de modo al crear el partido

**Files:**
- Modify: `src/domain/helpers.ts`, `src/data/mutations.ts`, `src/screens/NewMatchScreen.tsx`
- Create: `src/components/Choice.tsx`

- [ ] **Step 1: Zonas en `src/domain/helpers.ts`**

Sustituir este texto exacto (aparece una sola vez):

```ts
import type { EmotionTag, Outcome, Shot, Side } from './types';
```

por:

```ts
import type { EmotionTag, Outcome, Shot, Side, Zone } from './types';
```

Sustituir este texto exacto (aparece una sola vez):

```ts
  saque_resto: 'Saque/resto',
};
```

por:

```ts
  saque_resto: 'Saque/resto',
};

export const ZONES: Zone[] = ['fondo', 'red'];

export const ZONE_LABEL: Record<Zone, string> = { fondo: 'Fondo', red: 'Red' };
```

- [ ] **Step 2: Reemplazar `src/data/mutations.ts` entero**

Añade `updatePoint`, `insertPoint`, `deletePoint`, `deleteEmotion` y `setPointZone`; `setPointShot` admite `null`; `createMatch` recibe el modo; `undoPoint` delega en `deletePoint`. Ninguna función espera a Firestore.

```ts
import { doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { EMOTION_LABEL, OUTCOME_LABEL } from '../domain/helpers';
import type { PointFields } from '../domain/review';
import type { Emotion, EmotionTag, Match, MatchFormat, Outcome, Player, Point, Shot, Side, Zone } from '../domain/types';
import { db } from './firebase';
import { emotionsCol, matchesCol, pairsCol, playersCol, pointsCol } from './paths';
import { reportWriteError, writeSettled, writeStarted } from './writeErrors';

// Lanza la escritura sin esperarla y avisa si el servidor la rechaza.
// Cuenta las escrituras en vuelo para que el aviso de sincronización también cubra borrados pendientes.
function fire(write: Promise<void>, what: string) {
  writeStarted();
  write
    .catch(() => reportWriteError(`No se pudo guardar: ${what}`))
    .finally(writeSettled);
}

export function createPlayer(uid: string, name: string, side: Player['side']): string {
  const ref = doc(playersCol(uid));
  fire(setDoc(ref, { name, side, createdAt: Date.now() }), `jugador ${name}`);
  return ref.id;
}

export function renamePlayer(uid: string, playerId: string, name: string) {
  fire(updateDoc(doc(playersCol(uid), playerId), { name }), `nombre de ${name}`);
}

export function createPair(uid: string, a: string, b: string): string {
  const ref = doc(pairsCol(uid));
  fire(setDoc(ref, { playerIds: [a, b], createdAt: Date.now() }), 'pareja');
  return ref.id;
}

export type NewMatch = {
  pairId: string;
  playerIds: [string, string];
  leftPlayerId: string;
  opponentsName: string;
  format: MatchFormat;
  firstServer: Side;
  mode: Match['mode'];
};

export function createMatch(uid: string, input: NewMatch): string {
  const ref = doc(matchesCol(uid));
  const now = Date.now();
  fire(
    setDoc(ref, { ...input, date: now, createdAt: now, status: 'in_progress' }),
    `partido contra ${input.opponentsName}`,
  );
  return ref.id;
}

export function updateMatch(uid: string, matchId: string, patch: Partial<Omit<Match, 'id'>>) {
  fire(updateDoc(doc(matchesCol(uid), matchId), patch), 'datos del partido');
}

export function addPoint(
  uid: string,
  matchId: string,
  input: { order: number; outcome: Outcome; playerId: string | null },
): string {
  const ref = doc(pointsCol(uid, matchId));
  fire(
    setDoc(ref, { ...input, timestamp: Date.now(), shot: null, zone: null }),
    `punto nº ${input.order} (${OUTCOME_LABEL[input.outcome]}). Vuelve a registrarlo.`,
  );
  return ref.id;
}

export function setPointShot(uid: string, matchId: string, pointId: string, shot: Shot | null) {
  fire(updateDoc(doc(pointsCol(uid, matchId), pointId), { shot }), 'golpe del punto');
}

export function setPointZone(uid: string, matchId: string, pointId: string, zone: Zone | null) {
  fire(updateDoc(doc(pointsCol(uid, matchId), pointId), { zone }), 'zona del punto');
}

// Corrige un punto ya registrado (desde la pantalla de revisión).
export function updatePoint(uid: string, matchId: string, pointId: string, fields: PointFields) {
  fire(updateDoc(doc(pointsCol(uid, matchId), pointId), fields), 'cambios del punto');
}

// Añade un punto olvidado en medio de la lista: `order` lo coloca entre sus vecinos (ver `insertOrder`).
// El `timestamp` es la hora en que se registra, no la del juego.
export function insertPoint(uid: string, matchId: string, input: PointFields & { order: number }): string {
  const ref = doc(pointsCol(uid, matchId));
  fire(setDoc(ref, { ...input, timestamp: Date.now() }), `punto nuevo (${OUTCOME_LABEL[input.outcome]})`);
  return ref.id;
}

// Borra el punto y sus emociones en un lote (las transacciones no funcionan sin red).
export function deletePoint(uid: string, matchId: string, point: Point, emotions: Emotion[], what = 'borrar el punto') {
  const batch = writeBatch(db);
  batch.delete(doc(pointsCol(uid, matchId), point.id));
  for (const e of emotions) {
    if (e.afterPointId === point.id) batch.delete(doc(emotionsCol(uid, matchId), e.id));
  }
  fire(batch.commit(), what);
}

export function undoPoint(uid: string, matchId: string, point: Point, emotions: Emotion[]) {
  deletePoint(uid, matchId, point, emotions, 'deshacer el último punto');
}

export function addEmotion(
  uid: string,
  matchId: string,
  input: { playerId: string; tag: EmotionTag; afterPointId: string | null },
): string {
  const ref = doc(emotionsCol(uid, matchId));
  fire(setDoc(ref, { ...input, timestamp: Date.now() }), `emoción ${EMOTION_LABEL[input.tag]}`);
  return ref.id;
}

export function deleteEmotion(uid: string, matchId: string, emotionId: string) {
  const batch = writeBatch(db);
  batch.delete(doc(emotionsCol(uid, matchId), emotionId));
  fire(batch.commit(), 'borrar la emoción');
}
```

- [ ] **Step 3: Crear `src/components/Choice.tsx`**

Es el `Choice` que hasta ahora vivía dentro de `NewMatchScreen`, sacado para reutilizarlo en la revisión.

```tsx
// Una pregunta con varias respuestas en botones (formato del partido, quién saca…).
export default function Choice<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-slate-400">{props.label}</p>
      <div className="flex gap-2">
        {props.options.map((o) => (
          <button
            key={o.value}
            onClick={() => props.onChange(o.value)}
            className={`flex-1 rounded-lg p-3 font-bold ${props.value === o.value ? 'bg-blue-600' : 'bg-slate-800'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Reemplazar `src/screens/NewMatchScreen.tsx` entero**

Usa `Choice` compartido y añade "Cómo vas a registrar" (en directo o desde vídeo).

```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Choice from '../components/Choice';
import { pairName, playerName, useCoachData } from '../data/CoachData';
import { createMatch } from '../data/mutations';
import type { Match, MatchFormat, Side } from '../domain/types';

export default function NewMatchScreen() {
  const { uid, players, pairs } = useCoachData();
  const navigate = useNavigate();
  const [pairId, setPairId] = useState('');
  const [leftPlayerId, setLeftPlayerId] = useState('');
  const [opponentsName, setOpponentsName] = useState('');
  const [deuce, setDeuce] = useState<MatchFormat['deuce']>('punto_de_oro');
  const [finalSet, setFinalSet] = useState<MatchFormat['finalSet']>('set_completo');
  const [firstServer, setFirstServer] = useState<Side>('us');
  const [mode, setMode] = useState<Match['mode']>('directo');

  const pair = pairs.find((p) => p.id === pairId);

  const choosePair = (id: string) => {
    setPairId(id);
    const chosen = pairs.find((p) => p.id === id);
    if (!chosen) return;
    // El jugador de revés ocupa por defecto la columna izquierda.
    const reves = chosen.playerIds.find((pid) => players.find((p) => p.id === pid)?.side === 'reves');
    setLeftPlayerId(reves ?? chosen.playerIds[0]);
  };

  const start = () => {
    if (!pair) return;
    const id = createMatch(uid, {
      pairId: pair.id,
      playerIds: pair.playerIds,
      leftPlayerId,
      opponentsName: opponentsName.trim() || 'Rivales',
      format: { deuce, finalSet },
      firstServer,
      mode,
    });
    navigate(`/partido/${id}`);
  };

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4">
      <Link to="/" className="text-slate-400">← Partidos</Link>
      <h1 className="text-xl font-bold">Nuevo partido</h1>

      {pairs.length === 0 ? (
        <p>
          Primero crea una pareja en <Link to="/jugadores" className="text-blue-400 underline">Jugadores</Link>.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <p className="text-sm text-slate-400">Pareja</p>
            <select value={pairId} onChange={(e) => choosePair(e.target.value)} className="w-full rounded-lg bg-slate-900 p-3">
              <option value="">Elige pareja</option>
              {pairs.map((p) => (
                <option key={p.id} value={p.id}>{pairName(players, p.playerIds)}</option>
              ))}
            </select>
          </div>

          {pair && (
            <Choice
              label="Juega en la izquierda"
              value={leftPlayerId}
              options={pair.playerIds.map((id) => ({ value: id, label: playerName(players, id) }))}
              onChange={setLeftPlayerId}
            />
          )}

          <div className="space-y-1">
            <p className="text-sm text-slate-400">Rivales</p>
            <input
              value={opponentsName}
              onChange={(e) => setOpponentsName(e.target.value)}
              placeholder="Nombre de los rivales"
              className="w-full rounded-lg bg-slate-900 p-3"
            />
          </div>

          <Choice
            label="En 40-40"
            value={deuce}
            options={[
              { value: 'punto_de_oro', label: 'Punto de oro' },
              { value: 'ventajas', label: 'Ventajas' },
            ]}
            onChange={setDeuce}
          />
          <Choice
            label="Tercer set"
            value={finalSet}
            options={[
              { value: 'set_completo', label: 'Set completo' },
              { value: 'super_tiebreak', label: 'Súper tie-break' },
            ]}
            onChange={setFinalSet}
          />
          <Choice
            label="Saca primero"
            value={firstServer}
            options={[
              { value: 'us', label: 'Nosotros' },
              { value: 'them', label: 'Rivales' },
            ]}
            onChange={setFirstServer}
          />
          <Choice
            label="Cómo vas a registrar"
            value={mode}
            options={[
              { value: 'directo', label: 'En directo' },
              { value: 'video', label: 'Desde vídeo' },
            ]}
            onChange={setMode}
          />

          <button onClick={start} disabled={!pair} className="w-full rounded-xl bg-green-700 p-4 text-lg font-bold disabled:opacity-40">
            Empezar partido
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc`, `npm test` y `npm run build`
Expected: `tsc` sin salida; 110 pruebas pasan; la compilación termina sin errores.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "Capa de datos para corregir puntos, zonas y modo al crear el partido"
```

---

### Task 4: Modo vídeo en el registro

**Files:**
- Create: `src/components/ModeToggle.tsx`
- Modify: `src/components/ShotRow.tsx`, `src/screens/TrackerScreen.tsx`

Reglas del modo vídeo (spec §7): tras un punto de nuestra pareja con jugador, la fila de golpe **y zona** se queda hasta que se marca el siguiente punto, sin temporizador. Tocar el golpe o la zona ya elegidos los quita. Un punto del rival o sin detalle no abre la fila. En modo directo todo sigue como antes (solo golpe, se cierra a los 4 s).

- [ ] **Step 1: Crear `src/components/ModeToggle.tsx`**

```tsx
import type { Match } from '../domain/types';

const OPTIONS: { value: Match['mode']; label: string }[] = [
  { value: 'directo', label: 'En directo' },
  { value: 'video', label: 'Desde vídeo' },
];

// Cambia el modo de registro: en directo pide lo mínimo; desde vídeo deja golpe y zona a la vista.
export default function ModeToggle(props: { mode: Match['mode']; disabled?: boolean; onChange: (m: Match['mode']) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg bg-slate-800 text-xs font-bold" role="group" aria-label="Modo de registro">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          disabled={props.disabled}
          onClick={() => props.onChange(o.value)}
          className={`h-8 px-3 disabled:opacity-40 ${props.mode === o.value ? 'bg-blue-600' : ''}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar `src/components/ShotRow.tsx` entero**

Con `zone` (solo en modo vídeo) añade la fila de zona y se compacta (sin título, botones de 40 px) para tapar lo menos posible el marcador.

```tsx
import { SHOTS, SHOT_LABEL, ZONES, ZONE_LABEL } from '../domain/helpers';
import type { Shot, Zone } from '../domain/types';

type Props = {
  onPick: (shot: Shot) => void;
  selected?: Shot | null;
  // Solo en modo vídeo: añade la fila de zona.
  zone?: { selected: Zone | null; onPick: (zone: Zone) => void };
};

// Con la zona (modo vídeo) el panel queda abierto, así que se compacta: sin título y botones más bajos,
// para tapar lo menos posible el marcador en pantallas pequeñas.
const chip = (active: boolean, compact: boolean) =>
  `${compact ? 'h-10' : 'h-11'} rounded-lg text-sm font-semibold active:brightness-125 ${active ? 'bg-blue-600' : 'bg-slate-700'}`;

export default function ShotRow({ onPick, selected = null, zone }: Props) {
  const compact = zone !== undefined;
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 space-y-1 rounded-xl bg-[#0b0f14] p-2">
      {!compact && <p className="text-center text-xs text-slate-400">¿Con qué golpe? (opcional)</p>}
      <div className="grid grid-cols-4 gap-2">
        {SHOTS.map((shot) => (
          <button key={shot} onClick={() => onPick(shot)} className={chip(selected === shot, compact)}>
            {SHOT_LABEL[shot]}
          </button>
        ))}
      </div>
      {zone && (
        <div className="grid grid-cols-2 gap-2">
          {ZONES.map((z) => (
            <button key={z} onClick={() => zone.onPick(z)} className={chip(zone.selected === z, compact)}>
              {ZONE_LABEL[z]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Reemplazar `src/screens/TrackerScreen.tsx` entero**

Cambios respecto a la versión actual: importa `ModeToggle`, `setPointZone` y `Zone`; el temporizador de 4 s solo corre en modo directo; `pickShot` y `pickZone` permiten elegir y quitar sin cerrar la fila en modo vídeo; la fila del indicador de sincronización lleva el selector de modo.

```tsx
import { orderBy, query } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import EmotionSheet from '../components/EmotionSheet';
import ModeToggle from '../components/ModeToggle';
import OutcomeButtons from '../components/OutcomeButtons';
import Scoreboard from '../components/Scoreboard';
import ShotRow from '../components/ShotRow';
import SyncBadge from '../components/SyncBadge';
import { pairName, playerName, useCoachData } from '../data/CoachData';
import { addEmotion, addPoint, setPointShot, setPointZone, undoPoint, updateMatch } from '../data/mutations';
import { emotionsCol, pointsCol } from '../data/paths';
import { useQuery } from '../data/useQuery';
import { usePendingWrites } from '../data/writeErrors';
import { nextOrder } from '../domain/helpers';
import { computeMatchState } from '../domain/scoring';
import type { Emotion, EmotionTag, Match, Outcome, Player, Point, Shot, Zone } from '../domain/types';
import { useWakeLock } from '../hooks/useWakeLock';

export default function TrackerScreen() {
  const { matchId } = useParams();
  const { uid, matches, players, loading } = useCoachData();
  const match = matches.find((m) => m.id === matchId);
  if (loading) return <p className="p-6 text-slate-400">Cargando…</p>;
  // Justo después de crear un partido puede tardar un instante en llegar a la lista local.
  if (!match) return <p className="p-6 text-slate-400">Abriendo partido… <Link to="/" className="underline">Volver</Link></p>;
  return <Tracker uid={uid} match={match} players={players} />;
}

const SHOT_ROW_MS = 4000;
// Ventana en la que se ignoran toques repetidos al registrar un punto (doble toque accidental).
const TAP_LOCKOUT_MS = 350;

function Tracker({ uid, match, players }: { uid: string; match: Match; players: Player[] }) {
  useWakeLock();
  const navigate = useNavigate();
  const pointsQ = useQuery<Point>(useMemo(() => query(pointsCol(uid, match.id), orderBy('order')), [uid, match.id]));
  const emotionsQ = useQuery<Emotion>(
    useMemo(() => query(emotionsCol(uid, match.id), orderBy('timestamp')), [uid, match.id]),
  );
  const pendingWrites = usePendingWrites();
  const points = pointsQ.data;
  const emotions = emotionsQ.data;

  const state = useMemo(
    () => computeMatchState(points, match.format, match.firstServer),
    [points, match.format, match.firstServer],
  );

  // Punto para el que se ofrece la fila de golpes; null si no se muestra.
  const [shotFor, setShotFor] = useState<string | null>(null);
  const [emotionOpen, setEmotionOpen] = useState(false);
  const video = match.mode === 'video';
  const shotPoint = shotFor ? points.find((p) => p.id === shotFor) : undefined;

  useEffect(() => {
    if (!shotFor || video) return; // en modo vídeo la fila se queda hasta el siguiente punto
    const timer = setTimeout(() => setShotFor(null), SHOT_ROW_MS);
    return () => clearTimeout(timer);
  }, [shotFor, video]);

  const leftId = match.leftPlayerId;
  const rightId = match.playerIds.find((id) => id !== leftId) ?? match.playerIds[1];
  const closed = match.status === 'completed';
  const locked = state.finished || closed;
  const lastPoint = points[points.length - 1];

  // Último orden asignado y última pulsación aceptada: evitan órdenes repetidos y dobles registros.
  const lastOrderRef = useRef(0);
  const lastTapRef = useRef(0);

  const register = (outcome: Outcome, playerId: string | null) => {
    if (locked) return;
    const tapAt = Date.now();
    if (tapAt - lastTapRef.current < TAP_LOCKOUT_MS) return;
    lastTapRef.current = tapAt;
    const order = nextOrder(Math.max(lastOrderRef.current, points[points.length - 1]?.order ?? 0), tapAt);
    lastOrderRef.current = order;
    const id = addPoint(uid, match.id, { order, outcome, playerId });
    // Solo los puntos de nuestra pareja con jugador ofrecen elegir golpe.
    setShotFor(playerId ? id : null);
  };

  const pickShot = (shot: Shot) => {
    if (!shotFor) return;
    if (video) {
      // Con el vídeo en pausa hay tiempo para corregir: tocar el golpe elegido lo quita y la fila no se cierra.
      setPointShot(uid, match.id, shotFor, shotPoint?.shot === shot ? null : shot);
      return;
    }
    setPointShot(uid, match.id, shotFor, shot);
    setShotFor(null);
  };

  const pickZone = (zone: Zone) => {
    if (shotFor) setPointZone(uid, match.id, shotFor, shotPoint?.zone === zone ? null : zone);
  };

  const undo = () => {
    if (!lastPoint || closed) return;
    undoPoint(uid, match.id, lastPoint, emotions);
    setShotFor(null);
  };

  const pickEmotion = (playerId: string, tag: EmotionTag) => {
    addEmotion(uid, match.id, { playerId, tag, afterPointId: lastPoint?.id ?? null });
    setEmotionOpen(false);
  };

  const swapSides = () => updateMatch(uid, match.id, { leftPlayerId: rightId });

  const finish = () => {
    const question = state.finished ? '¿Cerrar el partido?' : 'El partido no ha terminado. ¿Finalizarlo igualmente?';
    if (!window.confirm(question)) return;
    updateMatch(uid, match.id, { status: 'completed' });
    navigate(`/partido/${match.id}/informe`);
  };

  return (
    <div
      className="mx-auto flex h-full max-w-xl flex-col gap-2 p-3"
    >
      <div className="flex items-center justify-between text-sm text-slate-400">
        <Link to="/" className="py-2">← Partidos</Link>
        {!closed && (
          <div className="flex gap-4">
            <button onClick={swapSides} className="px-2 py-2">⇄ Cambiar lados</button>
            <button onClick={finish} className={`px-2 py-2 ${state.finished ? 'font-bold text-green-400' : ''}`}>
              Finalizar partido
            </button>
          </div>
        )}
      </div>

      <Scoreboard
        key={points.length}
        usName={pairName(players, match.playerIds)}
        themName={match.opponentsName}
        state={state}
      />
      <div className="flex items-center justify-between gap-2">
        <ModeToggle mode={match.mode} disabled={closed} onChange={(mode) => updateMatch(uid, match.id, { mode })} />
        <SyncBadge hasPending={pointsQ.hasPending || emotionsQ.hasPending || pendingWrites > 0} pendingPoints={pointsQ.pending} />
      </div>

      {/* La fila de golpes flota sobre este hueco: nunca cambia el layout ni mueve los botones. */}
      <div className="relative min-h-0 flex-1">
        {closed && <p className="text-center text-slate-400">Partido cerrado.</p>}
        {shotFor && !closed && (
          <ShotRow
            onPick={pickShot}
            selected={shotPoint?.shot ?? null}
            zone={video ? { selected: shotPoint?.zone ?? null, onPick: pickZone } : undefined}
          />
        )}
      </div>

      <OutcomeButtons
        left={{ id: leftId, name: playerName(players, leftId) }}
        right={{ id: rightId, name: playerName(players, rightId) }}
        disabled={locked}
        onRegister={register}
      />

      <div className="flex gap-2">
        <button
          onClick={undo}
          disabled={!lastPoint || closed}
          className="h-12 flex-1 rounded-xl bg-slate-800 font-bold active:brightness-125 disabled:opacity-30"
        >
          ↶ Deshacer
        </button>
        <button
          onClick={() => setEmotionOpen(true)}
          disabled={closed}
          className="h-12 flex-1 rounded-xl bg-slate-800 font-bold active:brightness-125 disabled:opacity-30"
        >
          Emoción
        </button>
      </div>

      {emotionOpen && (
        <EmotionSheet
          players={[
            { id: leftId, name: playerName(players, leftId) },
            { id: rightId, name: playerName(players, rightId) },
          ]}
          onPick={pickEmotion}
          onClose={() => setEmotionOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc`, `npm test` y `npm run build`
Expected: `tsc` sin salida; 110 pruebas pasan; la compilación termina sin errores.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "Modo vídeo: golpe y zona a la vista hasta el siguiente punto"
```

---

### Task 5: Panel de edición y datos del partido

**Files:**
- Create: `src/components/review/PointEditor.tsx`, `src/components/review/MatchDataEditor.tsx`

- [ ] **Step 1: Crear `PointEditor.tsx`**

Un panel inferior. Sirve para editar un punto existente (con emociones, insertar antes o después y borrar) y para crear uno nuevo (sin esas secciones). El padre debe darle una `key` distinta por punto para que se reinicie al abrir otro.

```tsx
import { useState } from 'react';
import { EMOTION_GRID, EMOTION_LABEL, SHOTS, SHOT_LABEL, ZONES, ZONE_LABEL } from '../../domain/helpers';
import { draftProblem, draftToFields, outcomeNeedsPlayer, type PointDraft, type PointFields } from '../../domain/review';
import type { Emotion, EmotionTag, Outcome } from '../../domain/types';

const OUTCOMES: { value: Outcome; label: string }[] = [
  { value: 'winner_nuestro', label: 'Winner nuestro' },
  { value: 'error_rival', label: 'Error rival' },
  { value: 'no_forzado_nuestro', label: 'No forzado nuestro' },
  { value: 'forzado_nuestro', label: 'Forzado nuestro' },
  { value: 'winner_rival', label: 'Winner rival' },
  { value: 'nuestro_sin_detalle', label: 'Punto nuestro, sin detalle' },
  { value: 'rival_sin_detalle', label: 'Punto rival, sin detalle' },
];

type Existing = {
  emotions: Emotion[];
  onAddEmotion: (playerId: string, tag: EmotionTag) => void;
  onDeleteEmotion: (emotionId: string) => void;
  onInsertBefore: () => void;
  onInsertAfter: () => void;
  onDelete: () => void;
};

type Props = {
  title: string;
  initial: PointDraft;
  players: { id: string; name: string }[];
  onSave: (fields: PointFields) => void;
  onClose: () => void;
  // Solo al editar un punto que ya existe (un punto nuevo aún no tiene emociones ni vecinos).
  existing?: Existing;
};

const chip = (active: boolean) => `rounded-lg px-3 py-2 text-sm font-semibold ${active ? 'bg-blue-600' : 'bg-slate-800'}`;

// Panel inferior para completar, corregir o crear un punto. Los cambios del punto se guardan con
// "Guardar"; las emociones y el borrado se aplican al momento.
export default function PointEditor({ title, initial, players, onSave, onClose, existing }: Props) {
  const [draft, setDraft] = useState<PointDraft>(initial);
  const [emotionPlayer, setEmotionPlayer] = useState(players[0]?.id ?? '');
  const [emotionTag, setEmotionTag] = useState<EmotionTag>(EMOTION_GRID[0]);

  const problem = draftProblem(draft);
  const withPlayer = draft.outcome !== null && outcomeNeedsPlayer(draft.outcome);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? '¿?';

  const save = () => {
    const fields = draftToFields(draft);
    if (fields) onSave(fields);
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[92%] space-y-4 overflow-y-auto rounded-t-2xl bg-slate-900 p-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-center font-bold">{title}</h2>

        <section className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Cómo acabó</p>
          <div className="grid grid-cols-2 gap-2">
            {OUTCOMES.map((o) => (
              <button key={o.value} onClick={() => setDraft({ ...draft, outcome: o.value })} className={chip(draft.outcome === o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </section>

        {withPlayer && (
          <>
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">Jugador</p>
              <div className="grid grid-cols-2 gap-2">
                {players.map((p) => (
                  <button key={p.id} onClick={() => setDraft({ ...draft, playerId: p.id })} className={chip(draft.playerId === p.id)}>
                    {p.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">Golpe (tocar otra vez lo quita)</p>
              <div className="grid grid-cols-4 gap-2">
                {SHOTS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setDraft({ ...draft, shot: draft.shot === s ? null : s })}
                    className={chip(draft.shot === s)}
                  >
                    {SHOT_LABEL[s]}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">Zona (tocar otra vez la quita)</p>
              <div className="grid grid-cols-2 gap-2">
                {ZONES.map((z) => (
                  <button
                    key={z}
                    onClick={() => setDraft({ ...draft, zone: draft.zone === z ? null : z })}
                    className={chip(draft.zone === z)}
                  >
                    {ZONE_LABEL[z]}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {problem && <p className="text-sm text-amber-400">{problem}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="h-12 flex-1 rounded-xl bg-slate-800 font-bold">
            Cancelar
          </button>
          <button onClick={save} disabled={problem !== null} className="h-12 flex-1 rounded-xl bg-blue-600 font-bold disabled:opacity-40">
            Guardar
          </button>
        </div>

        {existing && (
          <>
            <section className="space-y-2 border-t border-slate-800 pt-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Emociones tras este punto</p>
              {existing.emotions.length === 0 && <p className="text-sm text-slate-500">Ninguna.</p>}
              {existing.emotions.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-sm">
                  <span>
                    {nameOf(e.playerId)} · {EMOTION_LABEL[e.tag]}
                  </span>
                  <button onClick={() => existing.onDeleteEmotion(e.id)} className="px-2 font-bold text-red-400" aria-label="Quitar emoción">
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <select value={emotionPlayer} onChange={(e) => setEmotionPlayer(e.target.value)} className="min-w-0 flex-1 rounded-lg bg-slate-800 p-2 text-sm">
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select value={emotionTag} onChange={(e) => setEmotionTag(e.target.value as EmotionTag)} className="min-w-0 flex-1 rounded-lg bg-slate-800 p-2 text-sm">
                  {EMOTION_GRID.map((t) => (
                    <option key={t} value={t}>
                      {EMOTION_LABEL[t]}
                    </option>
                  ))}
                </select>
                <button onClick={() => existing.onAddEmotion(emotionPlayer, emotionTag)} className="rounded-lg bg-slate-700 px-3 font-bold">
                  Añadir
                </button>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-4">
              <button onClick={existing.onInsertBefore} className="h-11 rounded-lg bg-slate-800 text-sm font-semibold">
                Insertar punto antes
              </button>
              <button onClick={existing.onInsertAfter} className="h-11 rounded-lg bg-slate-800 text-sm font-semibold">
                Insertar punto después
              </button>
              <button onClick={existing.onDelete} className="col-span-2 h-11 rounded-lg bg-red-900 text-sm font-bold">
                Borrar este punto
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear `MatchDataEditor.tsx`**

Rivales (se guarda al salir del campo, y un nombre vacío se descarta), formato y quién sacó primero.

```tsx
import { useState } from 'react';
import type { Match } from '../../domain/types';
import Choice from '../Choice';

// Corrige los datos del partido. Como el marcador se calcula a partir de los puntos,
// cualquier cambio rehace el marcador de toda la lista.
export default function MatchDataEditor(props: {
  match: Match;
  onChange: (patch: Partial<Omit<Match, 'id'>>) => void;
}) {
  const { match, onChange } = props;
  const [rivals, setRivals] = useState(match.opponentsName);

  const commitRivals = () => {
    const name = rivals.trim();
    if (name && name !== match.opponentsName) onChange({ opponentsName: name });
    else setRivals(match.opponentsName);
  };

  return (
    <details className="rounded-xl bg-slate-900 p-3">
      <summary className="cursor-pointer py-1 font-bold">Datos del partido</summary>
      <div className="mt-3 space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-slate-400">Rivales</p>
          <input
            value={rivals}
            onChange={(e) => setRivals(e.target.value)}
            onBlur={commitRivals}
            className="w-full rounded-lg bg-slate-800 p-3"
          />
        </div>
        <Choice
          label="En 40-40"
          value={match.format.deuce}
          options={[
            { value: 'punto_de_oro', label: 'Punto de oro' },
            { value: 'ventajas', label: 'Ventajas' },
          ]}
          onChange={(deuce) => onChange({ format: { ...match.format, deuce } })}
        />
        <Choice
          label="Tercer set"
          value={match.format.finalSet}
          options={[
            { value: 'set_completo', label: 'Set completo' },
            { value: 'super_tiebreak', label: 'Súper tie-break' },
          ]}
          onChange={(finalSet) => onChange({ format: { ...match.format, finalSet } })}
        />
        <Choice
          label="Sacó primero"
          value={match.firstServer}
          options={[
            { value: 'us', label: 'Nosotros' },
            { value: 'them', label: 'Rivales' },
          ]}
          onChange={(firstServer) => onChange({ firstServer })}
        />
        <p className="text-xs text-slate-400">El marcador de todos los puntos se recalcula solo con estos cambios.</p>
      </div>
    </details>
  );
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc`, `npm test` y `npm run build`
Expected: `tsc` sin salida; 110 pruebas pasan; compilación correcta.

- [ ] **Step 4: Commit**

```bash
git add src/components/review
git commit -m "Panel de edición de un punto y de los datos del partido"
```

---

### Task 6: Pantalla de revisión, ruta y enlaces

**Files:**
- Create: `src/screens/ReviewScreen.tsx`
- Modify: `src/App.tsx`, `src/screens/HomeScreen.tsx`, `src/screens/ReportScreen.tsx`

- [ ] **Step 1: Crear `ReviewScreen.tsx`**

Una fila por punto con su marcador previo y lo que falta resaltado; filtro "Por completar"; al tocar una fila se abre el panel. Como en el registro y el informe, solo se espera a los puntos para pintar.

```tsx
import { orderBy, query } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import MatchDataEditor from '../components/review/MatchDataEditor';
import PointEditor from '../components/review/PointEditor';
import { pairName, playerName, useCoachData } from '../data/CoachData';
import { addEmotion, deleteEmotion, deletePoint, insertPoint, updateMatch, updatePoint } from '../data/mutations';
import { emotionsCol, pointsCol } from '../data/paths';
import { useQuery } from '../data/useQuery';
import { setsLabel } from '../domain/analytics/report';
import { OUTCOME_LABEL, SHOT_LABEL, ZONE_LABEL } from '../domain/helpers';
import { insertOrder } from '../domain/ordering';
import { buildReviewRows, draftOf, emptyDraft, type PointFields, type ReviewRow } from '../domain/review';
import { computeMatchState } from '../domain/scoring';
import type { Emotion, Match, Player, Point } from '../domain/types';

export default function ReviewScreen() {
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
  return <Review uid={uid} match={match} players={players} />;
}

type Editing =
  | { kind: 'edit'; pointId: string }
  | { kind: 'insert'; index: number; where: 'before' | 'after' };

function RowButton({ row, name, onClick }: { row: ReviewRow; name: (id: string) => string; onClick: () => void }) {
  const { point } = row;
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl p-3 text-left ${row.extra ? 'bg-slate-900 opacity-60' : 'bg-slate-800'}`}
    >
      <div className="flex justify-between gap-2 text-xs text-slate-400">
        <span>
          {row.number} · {row.situation ?? 'Sobrante: después del final del partido'}
        </span>
        {row.emotions.length > 0 && <span>{row.emotions.length} emoc.</span>}
      </div>
      <p className="font-bold">
        {OUTCOME_LABEL[point.outcome]}
        {point.playerId && ` · ${name(point.playerId)}`}
      </p>
      {point.playerId && (
        <p className="text-sm text-slate-300">
          {point.shot ? SHOT_LABEL[point.shot] : '—'} · {point.zone ? ZONE_LABEL[point.zone] : '—'}
        </p>
      )}
      {row.missing.length > 0 && <p className="text-xs text-amber-400">Falta: {row.missing.join(', ')}</p>}
    </button>
  );
}

function Review({ uid, match, players }: { uid: string; match: Match; players: Player[] }) {
  const pointsQ = useQuery<Point>(useMemo(() => query(pointsCol(uid, match.id), orderBy('order')), [uid, match.id]));
  const emotionsQ = useQuery<Emotion>(
    useMemo(() => query(emotionsCol(uid, match.id), orderBy('timestamp')), [uid, match.id]),
  );
  const points = pointsQ.data;
  const emotions = emotionsQ.data;

  const state = useMemo(
    () => computeMatchState(points, match.format, match.firstServer),
    [points, match.format, match.firstServer],
  );
  const rows = useMemo(() => buildReviewRows(points, state, emotions), [points, state, emotions]);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(false);

  if (pointsQ.loading) return <p className="p-6 text-slate-400">Cargando…</p>;

  const name = (id: string) => playerName(players, id);
  const ourPlayers = match.playerIds.map((id) => ({ id, name: name(id) }));
  const incomplete = rows.filter((r) => r.missing.length > 0).length;
  const shown = onlyMissing ? rows.filter((r) => r.missing.length > 0) : rows;
  const editedRow = editing?.kind === 'edit' ? rows.find((r) => r.point.id === editing.pointId) : undefined;

  const saveEdit = (fields: PointFields) => {
    if (editing?.kind === 'edit') updatePoint(uid, match.id, editing.pointId, fields);
    setEditing(null);
  };

  const saveInsert = (fields: PointFields) => {
    if (editing?.kind !== 'insert') return;
    const order = insertOrder(points, editing.index, editing.where, Date.now());
    if (order === null) {
      window.alert('No se puede insertar ahí: los puntos están demasiado pegados.');
      return;
    }
    insertPoint(uid, match.id, { ...fields, order });
    setEditing(null);
  };

  const remove = (row: ReviewRow) => {
    if (!window.confirm(`¿Borrar el punto ${row.number}? También se borran sus emociones.`)) return;
    deletePoint(uid, match.id, row.point, emotions);
    setEditing(null);
  };

  return (
    <div className="mx-auto h-full max-w-xl overflow-y-auto">
      <div className="flex items-center justify-between p-3 text-sm text-slate-400">
        <Link to="/" className="py-2">← Partidos</Link>
        <div className="flex gap-3">
          <Link to={`/partido/${match.id}/informe`} className="px-2 py-2">Informe</Link>
          {match.status === 'in_progress' && <Link to={`/partido/${match.id}`} className="px-2 py-2">Registro</Link>}
        </div>
      </div>

      <div className="space-y-3 px-3 pb-8">
        <div>
          <h1 className="text-lg font-bold">
            {pairName(players, match.playerIds)} vs {match.opponentsName}
          </h1>
          <p className="text-sm text-slate-400">
            {setsLabel(state)} · {rows.length} {rows.length === 1 ? 'punto' : 'puntos'}
          </p>
        </div>

        <MatchDataEditor key={match.id} match={match} onChange={(patch) => updateMatch(uid, match.id, patch)} />

        <div className="flex gap-2 text-sm">
          <button onClick={() => setOnlyMissing(false)} className={`rounded-lg px-3 py-2 font-semibold ${!onlyMissing ? 'bg-blue-600' : 'bg-slate-800'}`}>
            Todos ({rows.length})
          </button>
          <button onClick={() => setOnlyMissing(true)} className={`rounded-lg px-3 py-2 font-semibold ${onlyMissing ? 'bg-blue-600' : 'bg-slate-800'}`}>
            Por completar ({incomplete})
          </button>
        </div>

        <div className="space-y-2">
          {shown.length === 0 && (
            <p className="py-6 text-center text-slate-400">
              {rows.length === 0 ? 'Todavía no hay puntos.' : 'No queda ningún punto por completar.'}
            </p>
          )}
          {shown.map((row) => (
            <RowButton key={row.point.id} row={row} name={name} onClick={() => setEditing({ kind: 'edit', pointId: row.point.id })} />
          ))}
        </div>

        <button
          onClick={() => setEditing({ kind: 'insert', index: Math.max(points.length - 1, 0), where: 'after' })}
          className="h-12 w-full rounded-xl bg-slate-800 font-bold"
        >
          + Añadir punto al final
        </button>
      </div>

      {editing?.kind === 'edit' && editedRow && (
        <PointEditor
          key={editing.pointId}
          title={`Punto ${editedRow.number}`}
          initial={draftOf(editedRow.point)}
          players={ourPlayers}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
          existing={{
            emotions: editedRow.emotions,
            onAddEmotion: (playerId, tag) => addEmotion(uid, match.id, { playerId, tag, afterPointId: editedRow.point.id }),
            onDeleteEmotion: (emotionId) => deleteEmotion(uid, match.id, emotionId),
            onInsertBefore: () => setEditing({ kind: 'insert', index: editedRow.number - 1, where: 'before' }),
            onInsertAfter: () => setEditing({ kind: 'insert', index: editedRow.number - 1, where: 'after' }),
            onDelete: () => remove(editedRow),
          }}
        />
      )}
      {editing?.kind === 'insert' && (
        <PointEditor
          key={`nuevo-${editing.index}-${editing.where}`}
          title="Punto nuevo"
          initial={emptyDraft}
          players={ourPlayers}
          onSave={saveInsert}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Ruta en `src/App.tsx`**

Sustituir este texto exacto (aparece una sola vez):

```tsx
import ReportScreen from './screens/ReportScreen';
```

por:

```tsx
import ReportScreen from './screens/ReportScreen';
import ReviewScreen from './screens/ReviewScreen';
```

Sustituir este texto exacto (aparece una sola vez):

```tsx
        <Route path="/partido/:matchId/informe" element={<ReportScreen />} />
```

por:

```tsx
        <Route path="/partido/:matchId/informe" element={<ReportScreen />} />
        <Route path="/partido/:matchId/revision" element={<ReviewScreen />} />
```

- [ ] **Step 3: Botón "Revisión" en cada partido de `src/screens/HomeScreen.tsx`**

Sustituir este texto exacto (aparece una sola vez):

```tsx
            <Link to={`/partido/${m.id}/informe`} className="flex items-center rounded-xl bg-slate-800 px-4 text-sm font-bold">
              Informe
            </Link>
```

por:

```tsx
            <div className="flex flex-col gap-1">
              <Link to={`/partido/${m.id}/informe`} className="flex flex-1 items-center rounded-xl bg-slate-800 px-4 text-sm font-bold">
                Informe
              </Link>
              <Link to={`/partido/${m.id}/revision`} className="flex flex-1 items-center rounded-xl bg-slate-800 px-4 text-sm font-bold">
                Revisión
              </Link>
            </div>
```

- [ ] **Step 4: Enlace "Revisar puntos" en `src/screens/ReportScreen.tsx`**

Sustituir este texto exacto (aparece una sola vez):

```tsx
        {match.status === 'in_progress' && (
          <Link to={`/partido/${match.id}`} className="px-2 py-2">Volver al registro</Link>
        )}
```

por:

```tsx
        <div className="flex gap-3">
          <Link to={`/partido/${match.id}/revision`} className="px-2 py-2">Revisar puntos</Link>
          {match.status === 'in_progress' && (
            <Link to={`/partido/${match.id}`} className="px-2 py-2">Volver al registro</Link>
          )}
        </div>
```

- [ ] **Step 5: Verificar**

Run: `npx tsc`, `npm test` y `npm run build`
Expected: `tsc` sin salida; 110 pruebas pasan; compilación correcta.

Run: `npm run dev` en segundo plano y comprobar con `curl` que `/src/screens/ReviewScreen.tsx` y `/src/components/review/PointEditor.tsx` responden 200 y que el log no muestra errores; detener el servidor. La comprobación interactiva necesita iniciar sesión con Google y la hace el usuario (Tarea 7).

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "Pantalla de revisión punto por punto, con su ruta y accesos"
```

---

### Task 7: Despliegue y comprobaciones en iPhone (usuario)

Esta tarea no la hace un subagente: requiere el iPhone y la sesión de Google del usuario. Antes, subir los commits (`git push origin main`) y comprobar con `vercel ls` que el despliegue termina en `Ready`.

- [ ] **Step 1: Crear un partido en modo vídeo**

Nuevo partido, elegir "Desde vídeo", y registrar unos 10 puntos de tu pareja.
Expected: tras cada punto con jugador, la fila de golpe y zona se queda; tocar un golpe lo resalta y tocarlo otra vez lo quita; un punto del rival cierra la fila.

- [ ] **Step 2: ¿Tapa el marcador?**

Con la fila abierta, mirar cuánto del marcador queda a la vista en tu iPhone.
Expected: se ve, como mínimo, la fila de tu pareja. Si molesta, anotarlo y el modelo de iPhone: la alternativa es mover el selector de modo y la fila de sincronización fuera de la zona que cubre el panel.

- [ ] **Step 3: Cambiar de modo a mitad de partido**

Pulsar "En directo" y registrar un punto; volver a "Desde vídeo".
Expected: en directo la fila solo pide golpe y se cierra sola a los 4 segundos; en vídeo vuelve a quedarse.

- [ ] **Step 4: Completar un partido registrado en directo**

Desde la lista, "Revisión" de un partido con puntos sin golpe o sin zona. Pulsar "Por completar".
Expected: salen los puntos con "Falta: golpe, zona" o "Falta: causa". Completar tres y ver que el contador baja.

- [ ] **Step 5: Insertar, corregir y borrar**

Insertar un punto olvidado entre dos puntos; cambiar el resultado de uno; borrar uno que tenga una emoción.
Expected: el marcador previo de todos los puntos siguientes se recalcula; el punto insertado queda en su sitio; al borrar desaparece su emoción.

- [ ] **Step 6: Datos del partido**

Abrir "Datos del partido": cambiar quién sacó primero y el formato.
Expected: los marcadores de las filas cambian de inmediato.

- [ ] **Step 7: Sin conexión**

Con el modo avión, abrir la revisión de un partido ya cargado, completar un punto y volver a conectar.
Expected: el cambio se ve al momento; al recuperar la red el aviso de sincronización pasa a "Todo guardado" y el dato aparece en otro dispositivo.

- [ ] **Step 8: El informe refleja las correcciones**

Abrir el informe de ese partido ("Revisar puntos" → "Informe").
Expected: los números cambian según lo corregido.

- [ ] **Step 9: Registrar el resultado**

Crear `docs/superpowers/plans/2026-11-15-tramo-3-comprobaciones.md` con fecha, modelo de iPhone, versión de iOS y el resultado de los pasos 1 a 8, y hacer commit.

---

## Cobertura de la spec (secciones 7 y 4)

| Requisito | Tarea |
|---|---|
| Modo al crear el partido (en directo o desde vídeo) | 3 |
| Modo cambiable en cualquier momento | 4 |
| Modo vídeo: golpe y zona hasta el siguiente punto | 4 |
| Zona solo en modo vídeo o al completar después | 4, 5 |
| Revisión: una fila por punto con marcador previo, resultado, jugador, golpe, zona y emociones | 2, 6 |
| Campos vacíos destacados | 2, 6 |
| Editar cualquier campo de un punto | 2, 5, 6 |
| Añadir o quitar emociones | 5, 6 |
| Insertar un punto antes o después sin reescribir los demás | 1, 5, 6 |
| Borrar un punto (y sus emociones) | 3, 5, 6 |
| Corregir formato, quién saca primero y rivales | 5, 6 |
| Todo se recalcula | 2, 6 (el marcador sale siempre de `computeMatchState`) |
| Completar un partido apuntado en directo, también desde otro dispositivo | 6, 7 |

Fuera de este plan: acumulados por jugador y pareja, enlace de solo lectura, vídeo dentro de la app, zona en el informe.
