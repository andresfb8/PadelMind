# Tramo 1 — Registro en directo: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una PWA instalable en iPhone con la que el entrenador registra un partido de pádel en directo (puntos, golpe opcional, emociones, deshacer), sin conexión, con marcador automático.

**Architecture:** App de cliente (Vite + React). Un motor de marcador puro calcula todo el estado a partir de la lista de puntos; nada del marcador se guarda. Firestore con caché local persistente es la única capa de datos; la interfaz se pinta desde las suscripciones locales y nunca espera a una escritura.

**Tech Stack:** Vite, React, TypeScript estricto, Tailwind CSS v4, react-router-dom, Firebase (Firestore + Auth con Google), vite-plugin-pwa, Vitest, @firebase/rules-unit-testing, Vercel.

**Spec:** `docs/superpowers/specs/2026-11-15-padel-mind-match-design.md`. Este plan cubre solo el tramo 1. Quedan fuera: informe y analítica (tramo 2), modo vídeo, zona y pantalla de revisión (tramo 3).

**Desviación de la spec:** las fechas se guardan como milisegundos (`number`, `Date.now()`) en vez de `Timestamp` de Firestore, para que el dominio no dependa de Firebase. La spec ya está actualizada.

**Pasos que requieren al usuario** (cuentas y consolas externas): Tarea 5 pasos 1–2, Tarea 12 pasos 5–8 y Tarea 13.

## Orden de ejecución (obligatorio)

Las tareas están numeradas por tema, pero se ejecutan en este orden, para probar pronto lo más arriesgado (acceso con Google en la app instalada del iPhone y supervivencia de datos sin red):

1. Tareas 1, 2, 3 y 4. No requieren nada del usuario.
2. Tareas 5 y 6.
3. **Tarea 12** (PWA y despliegue) y a continuación **Tarea 13, paso 1** (acceso desde la app instalada). Si ese paso falla, se resuelve antes de construir más pantallas.
4. Tareas 7, 8, 9 y 10. Volver a desplegar al terminar la 10.
5. **Tarea 13, paso 3** (supervivencia de datos, dura 3 días): se inicia en cuanto la Tarea 10 está desplegada y corre mientras se hace la Tarea 11.
6. Tarea 11 y despliegue.
7. Resto de la Tarea 13 (pasos 2, 4, 5 y 6).

---

## Estructura de archivos

```
index.html
package.json  tsconfig.json  vite.config.ts  vitest.rules.config.ts
firebase.json  firestore.rules  vercel.json  .env.example
public/icon.svg  (+ PNG generados)
src/
  main.tsx                 arranque: router + proveedor de sesión
  App.tsx                  puerta de acceso y rutas
  index.css                Tailwind y estilos base
  domain/                  lógica pura, sin React ni Firebase
    types.ts               tipos del modelo
    scoring.ts             computeMatchState
    scoring.test.ts
    helpers.ts             nextOrder, situationTag, etiquetas en español
    helpers.test.ts
  data/                    todo lo que toca Firebase
    firebase.ts            inicialización (auth y Firestore con caché persistente)
    auth.tsx               AuthProvider, useAuth, signInWithGoogle
    paths.ts               referencias a colecciones
    useQuery.ts            suscripción genérica con estado de pendientes
    writeErrors.ts         almacén de escrituras rechazadas
    CoachData.tsx          suscripción de arranque a jugadores, parejas y partidos
    mutations.ts           todas las escrituras
  hooks/useWakeLock.ts
  components/
    Scoreboard.tsx  SyncBadge.tsx  OutcomeButtons.tsx  ShotRow.tsx  EmotionSheet.tsx  WriteErrorBanner.tsx
  screens/
    LoginScreen.tsx  HomeScreen.tsx  PlayersScreen.tsx  NewMatchScreen.tsx  TrackerScreen.tsx
tests/rules/firestore.rules.test.ts
```

---

### Task 1: Proyecto base

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "padel-mind-match",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:rules": "firebase emulators:exec --only firestore --project demo-padel \"vitest run --config vitest.rules.config.ts\""
  }
}
```

- [ ] **Step 2: Instalar dependencias**

```bash
npm install react react-dom react-router-dom firebase
```

```bash
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/node tailwindcss @tailwindcss/vite vite-plugin-pwa vitest firebase-tools @firebase/rules-unit-testing
```

Si `npm` falla por un conflicto de versión entre `vite-plugin-pwa` y `vite`, instalar la versión mayor de `vite` que indique el mensaje de error (`npm install -D vite@<mayor>`) y repetir.

- [ ] **Step 3: Crear `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.rules.config.ts"]
}
```

- [ ] **Step 4: Crear `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: { include: ['src/**/*.test.ts'] },
});
```

- [ ] **Step 5: Crear `index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
    <meta name="theme-color" content="#0b0f14" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <title>Padel Mind &amp; Match</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Crear `src/index.css`**

```css
@import "tailwindcss";

html, body, #root { height: 100%; }

body {
  background: #0b0f14;
  color: #e8edf2;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  overscroll-behavior: none;
  user-select: none;
}

@keyframes flash {
  from { background-color: #2b3a4d; }
  to { background-color: #141b24; }
}
.flash { animation: flash 350ms ease-out; }
```

- [ ] **Step 7: Crear `src/App.tsx` y `src/main.tsx` provisionales**

`src/App.tsx`:

```tsx
export default function App() {
  return <p className="p-6 text-xl font-bold">Padel Mind &amp; Match</p>;
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 8: Verificar que compila**

Run: `npm run build`
Expected: termina sin errores y crea `dist/index.html`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Proyecto base con Vite, React, TypeScript y Tailwind"
```

---

### Task 2: Tipos del dominio

**Files:**
- Create: `src/domain/types.ts`

- [ ] **Step 1: Crear `src/domain/types.ts`**

```ts
export type Side = 'us' | 'them';

export type Player = {
  id: string;
  name: string;
  side: 'derecha' | 'reves' | null;
  createdAt: number;
};

export type Pair = {
  id: string;
  playerIds: [string, string];
  createdAt: number;
};

export type MatchFormat = {
  deuce: 'punto_de_oro' | 'ventajas';
  finalSet: 'set_completo' | 'super_tiebreak';
};

export type Match = {
  id: string;
  date: number;
  pairId: string;
  playerIds: [string, string];
  leftPlayerId: string;
  opponentsName: string;
  format: MatchFormat;
  firstServer: Side;
  mode: 'directo' | 'video';
  status: 'in_progress' | 'completed';
  createdAt: number;
};

export type Outcome =
  | 'winner_nuestro'
  | 'error_rival'
  | 'no_forzado_nuestro'
  | 'forzado_nuestro'
  | 'winner_rival'
  | 'nuestro_sin_detalle'
  | 'rival_sin_detalle';

export type Shot =
  | 'derecha'
  | 'reves'
  | 'volea'
  | 'bandeja_vibora'
  | 'remate'
  | 'globo'
  | 'saque_resto';

export type Zone = 'fondo' | 'red';

export type Point = {
  id: string;
  order: number;
  timestamp: number;
  outcome: Outcome;
  playerId: string | null;
  shot: Shot | null;
  zone: Zone | null;
};

export type EmotionTag =
  | 'frustracion'
  | 'enfado_companero'
  | 'desconexion'
  | 'nervios'
  | 'miedo_a_fallar'
  | 'distraccion_externa'
  | 'euforia'
  | 'confianza'
  | 'apoyo_companero';

export type Emotion = {
  id: string;
  playerId: string;
  tag: EmotionTag;
  afterPointId: string | null;
  timestamp: number;
};
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc`
Expected: sin salida (sin errores).

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "Tipos del modelo de dominio"
```

---

### Task 3: Motor de marcador

**Files:**
- Create: `src/domain/scoring.ts`
- Test: `src/domain/scoring.test.ts`

Reglas (spec §5): juego 0/15/30/40; con punto de oro el punto en 40-40 decide; con ventajas hay que ganar por dos. Set a 6 con dos de diferencia; tie-break a 7 en 6-6. Partido al mejor de 3; con `super_tiebreak` y sets 1-1, el tercero es un tie-break a 10. El saque alterna cada juego; en tie-break saca un punto quien le toca y luego se alterna cada dos puntos; quien sacó primero en el tie-break resta en el primer juego del set siguiente.

- [ ] **Step 1: Escribir las pruebas**

`src/domain/scoring.test.ts`:

```ts
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
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npm test`
Expected: FAIL, no se puede resolver `./scoring`.

- [ ] **Step 3: Implementar `src/domain/scoring.ts`**

```ts
import type { MatchFormat, Outcome, Point, Side } from './types';

export type GameKind = 'normal' | 'tiebreak' | 'super_tiebreak';
export type SetScore = { us: number; them: number };

export type Situation = {
  setIndex: number;
  gamesUs: number;
  gamesThem: number;
  scoreLabel: string;
  pointLabelUs: string;
  pointLabelThem: string;
  server: Side;
  isTiebreak: boolean;
  isGoldenPoint: boolean;
  isBreakPoint: Side | null;
  isSetPoint: Side | null;
  isMatchPoint: Side | null;
  servingForSet: Side | null;
};

export type PointContext = Situation & { pointId: string; wonBy: Side };

export type MatchState = {
  contexts: PointContext[];
  extraPointIds: string[];
  completedSets: SetScore[];
  setsUs: number;
  setsThem: number;
  situation: Situation | null;
  finished: boolean;
  winner: Side | null;
};

type Live = {
  setsUs: number;
  setsThem: number;
  gamesUs: number;
  gamesThem: number;
  ptsUs: number;
  ptsThem: number;
  kind: GameKind;
  gameServer: Side;
  completedSets: SetScore[];
  winner: Side | null;
};

const POINT_NAMES = ['0', '15', '30', '40'];
const other = (s: Side): Side => (s === 'us' ? 'them' : 'us');
const pts = (l: Live, s: Side) => (s === 'us' ? l.ptsUs : l.ptsThem);
const games = (l: Live, s: Side) => (s === 'us' ? l.gamesUs : l.gamesThem);
const sets = (l: Live, s: Side) => (s === 'us' ? l.setsUs : l.setsThem);

export function pointWinner(outcome: Outcome): Side {
  return outcome === 'winner_nuestro' || outcome === 'error_rival' || outcome === 'nuestro_sin_detalle'
    ? 'us'
    : 'them';
}

// ¿Gana el juego quien tiene p puntos frente a q?
function gameWon(p: number, q: number, kind: GameKind, format: MatchFormat): boolean {
  if (kind === 'tiebreak') return p >= 7 && p - q >= 2;
  if (kind === 'super_tiebreak') return p >= 10 && p - q >= 2;
  if (format.deuce === 'punto_de_oro') return p >= 4;
  return p >= 4 && p - q >= 2;
}

// ¿Gana el set quien tiene g juegos frente a o si gana el juego en curso?
function setWonByGame(g: number, o: number, kind: GameKind): boolean {
  if (kind !== 'normal') return true;
  return g + 1 >= 6 && g + 1 - o >= 2;
}

function labels(l: Live, golden: boolean) {
  if (l.kind !== 'normal') {
    return {
      scoreLabel: `${l.ptsUs}-${l.ptsThem}`,
      pointLabelUs: String(l.ptsUs),
      pointLabelThem: String(l.ptsThem),
    };
  }
  if (golden) return { scoreLabel: 'Punto de oro', pointLabelUs: '40', pointLabelThem: '40' };
  if (l.ptsUs >= 3 && l.ptsThem >= 3) {
    if (l.ptsUs === l.ptsThem) return { scoreLabel: 'Iguales', pointLabelUs: '40', pointLabelThem: '40' };
    return l.ptsUs > l.ptsThem
      ? { scoreLabel: 'Ventaja nosotros', pointLabelUs: 'Ad', pointLabelThem: '40' }
      : { scoreLabel: 'Ventaja rival', pointLabelUs: '40', pointLabelThem: 'Ad' };
  }
  const u = POINT_NAMES[l.ptsUs];
  const t = POINT_NAMES[l.ptsThem];
  return { scoreLabel: `${u}-${t}`, pointLabelUs: u, pointLabelThem: t };
}

function situationOf(l: Live, format: MatchFormat): Situation {
  const tb = l.kind !== 'normal';
  const played = l.ptsUs + l.ptsThem;
  // En tie-break: un punto quien empieza y después de dos en dos.
  const server = tb && Math.floor((played + 1) / 2) % 2 === 1 ? other(l.gameServer) : l.gameServer;
  const receiver = other(server);
  const hasGamePoint = (s: Side) => gameWon(pts(l, s) + 1, pts(l, other(s)), l.kind, format);
  const hasSetPoint = (s: Side) => hasGamePoint(s) && setWonByGame(games(l, s), games(l, other(s)), l.kind);
  const hasMatchPoint = (s: Side) => hasSetPoint(s) && sets(l, s) === 1;
  const first = (f: (s: Side) => boolean): Side | null => (f('us') ? 'us' : f('them') ? 'them' : null);
  const isGoldenPoint = !tb && format.deuce === 'punto_de_oro' && l.ptsUs === 3 && l.ptsThem === 3;
  const servingForSet =
    !tb && setWonByGame(games(l, l.gameServer), games(l, other(l.gameServer)), 'normal') ? l.gameServer : null;

  return {
    setIndex: l.completedSets.length,
    gamesUs: l.gamesUs,
    gamesThem: l.gamesThem,
    ...labels(l, isGoldenPoint),
    server,
    isTiebreak: tb,
    isGoldenPoint,
    isBreakPoint: !tb && hasGamePoint(receiver) ? receiver : null,
    isSetPoint: first(hasSetPoint),
    isMatchPoint: first(hasMatchPoint),
    servingForSet,
  };
}

function closeSet(l: Live, wonBy: Side, score: SetScore, format: MatchFormat) {
  l.completedSets.push(score);
  if (wonBy === 'us') l.setsUs++;
  else l.setsThem++;
  l.gamesUs = 0;
  l.gamesThem = 0;
  l.ptsUs = 0;
  l.ptsThem = 0;
  if (sets(l, wonBy) === 2) {
    l.winner = wonBy;
    return;
  }
  l.kind = format.finalSet === 'super_tiebreak' && l.setsUs === 1 && l.setsThem === 1 ? 'super_tiebreak' : 'normal';
}

function applyPoint(l: Live, wonBy: Side, format: MatchFormat) {
  if (wonBy === 'us') l.ptsUs++;
  else l.ptsThem++;
  if (!gameWon(pts(l, wonBy), pts(l, other(wonBy)), l.kind, format)) return;

  if (l.kind === 'super_tiebreak') {
    closeSet(l, wonBy, { us: l.ptsUs, them: l.ptsThem }, format);
    return;
  }

  const wasTiebreak = l.kind === 'tiebreak';
  if (wonBy === 'us') l.gamesUs++;
  else l.gamesThem++;
  l.ptsUs = 0;
  l.ptsThem = 0;
  l.gameServer = other(l.gameServer);

  const g = games(l, wonBy);
  const o = games(l, other(wonBy));
  if (wasTiebreak || (g >= 6 && g - o >= 2)) {
    closeSet(l, wonBy, { us: l.gamesUs, them: l.gamesThem }, format);
  } else if (l.gamesUs === 6 && l.gamesThem === 6) {
    l.kind = 'tiebreak';
  }
}

export function computeMatchState(points: Point[], format: MatchFormat, firstServer: Side): MatchState {
  const l: Live = {
    setsUs: 0,
    setsThem: 0,
    gamesUs: 0,
    gamesThem: 0,
    ptsUs: 0,
    ptsThem: 0,
    kind: 'normal',
    gameServer: firstServer,
    completedSets: [],
    winner: null,
  };
  const contexts: PointContext[] = [];
  const extraPointIds: string[] = [];

  for (const p of points) {
    if (l.winner) {
      extraPointIds.push(p.id);
      continue;
    }
    const wonBy = pointWinner(p.outcome);
    contexts.push({ ...situationOf(l, format), pointId: p.id, wonBy });
    applyPoint(l, wonBy, format);
  }

  return {
    contexts,
    extraPointIds,
    completedSets: l.completedSets,
    setsUs: l.setsUs,
    setsThem: l.setsThem,
    situation: l.winner ? null : situationOf(l, format),
    finished: l.winner !== null,
    winner: l.winner,
  };
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npm test`
Expected: PASS, todas las pruebas de `scoring.test.ts`.

Si alguna falla, corregir `scoring.ts`, no la prueba, salvo que la prueba contradiga las reglas escritas al inicio de esta tarea.

- [ ] **Step 5: Commit**

```bash
git add src/domain/scoring.ts src/domain/scoring.test.ts
git commit -m "Motor de marcador calculado a partir de la lista de puntos"
```

---

### Task 4: Ayudas del dominio y etiquetas

**Files:**
- Create: `src/domain/helpers.ts`
- Test: `src/domain/helpers.test.ts`

- [ ] **Step 1: Escribir las pruebas**

`src/domain/helpers.test.ts`:

```ts
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
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npm test`
Expected: FAIL, no se puede resolver `./helpers`.

- [ ] **Step 3: Implementar `src/domain/helpers.ts`**

```ts
import type { Situation } from './scoring';
import type { EmotionTag, Outcome, Shot, Side } from './types';

export function nextOrder(points: { order: number }[]): number {
  return points.length === 0 ? 1 : points[points.length - 1].order + 1;
}

const who = (s: Side) => (s === 'us' ? 'nosotros' : 'rival');

export function situationTag(s: Situation | null): string {
  if (!s) return '';
  if (s.isMatchPoint) return `BOLA DE PARTIDO · ${who(s.isMatchPoint)}`;
  if (s.isSetPoint) return `BOLA DE SET · ${who(s.isSetPoint)}`;
  if (s.isGoldenPoint) return 'PUNTO DE ORO';
  if (s.isBreakPoint) return `BOLA DE BREAK · ${who(s.isBreakPoint)}`;
  return '';
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  winner_nuestro: 'Winner',
  error_rival: 'Error rival',
  no_forzado_nuestro: 'No forzado',
  forzado_nuestro: 'Forzado',
  winner_rival: 'Winner rival',
  nuestro_sin_detalle: 'Punto nuestro',
  rival_sin_detalle: 'Punto rival',
};

export const SHOTS: Shot[] = ['derecha', 'reves', 'volea', 'bandeja_vibora', 'remate', 'globo', 'saque_resto'];

export const SHOT_LABEL: Record<Shot, string> = {
  derecha: 'Derecha',
  reves: 'Revés',
  volea: 'Volea',
  bandeja_vibora: 'Bandeja',
  remate: 'Remate',
  globo: 'Globo',
  saque_resto: 'Saque/resto',
};

// Orden de la rejilla 3×3: las dos primeras columnas negativas, la tercera positiva.
export const EMOTION_GRID: EmotionTag[] = [
  'frustracion', 'nervios', 'euforia',
  'enfado_companero', 'miedo_a_fallar', 'confianza',
  'desconexion', 'distraccion_externa', 'apoyo_companero',
];

export const POSITIVE_EMOTIONS: EmotionTag[] = ['euforia', 'confianza', 'apoyo_companero'];

export const EMOTION_LABEL: Record<EmotionTag, string> = {
  frustracion: 'Frustración',
  enfado_companero: 'Enfado con el compañero',
  desconexion: 'Desconexión',
  nervios: 'Nervios',
  miedo_a_fallar: 'Miedo a fallar',
  distraccion_externa: 'Distracción externa',
  euforia: 'Euforia',
  confianza: 'Confianza',
  apoyo_companero: 'Apoyo al compañero',
};
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/helpers.ts src/domain/helpers.test.ts
git commit -m "Ayudas del dominio y etiquetas en español"
```

---

### Task 5: Firebase, reglas de seguridad y sus pruebas

**Files:**
- Create: `.env.example`, `.env.local` (no se versiona), `firebase.json`, `firestore.rules`, `vitest.rules.config.ts`, `tests/rules/firestore.rules.test.ts`, `src/data/firebase.ts`

- [ ] **Step 1 (usuario): Crear el proyecto de Firebase**

En https://console.firebase.google.com: crear un proyecto; en *Authentication → Sign-in method* activar **Google**; en *Firestore Database* crear la base de datos en modo producción (región `eur3` o `europe-west1`); en *Configuración del proyecto → Tus apps* registrar una app web y copiar `apiKey`, `authDomain`, `projectId` y `appId`.

- [ ] **Step 2 (usuario): Crear `.env.local`** con los valores copiados

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

- [ ] **Step 3: Crear `.env.example`** con ese mismo contenido, sin valores, para versionarlo.

- [ ] **Step 4: Crear `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /coaches/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

- [ ] **Step 5: Crear `firebase.json`**

```json
{
  "firestore": { "rules": "firestore.rules" },
  "emulators": { "firestore": { "port": 8080 }, "ui": { "enabled": false } }
}
```

- [ ] **Step 6: Crear `vitest.rules.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/rules/**/*.test.ts'], environment: 'node', testTimeout: 20000 },
});
```

- [ ] **Step 7: Escribir las pruebas de reglas**

`tests/rules/firestore.rules.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-padel',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('reglas de Firestore', () => {
  it('un entrenador lee y escribe lo suyo, a cualquier profundidad', async () => {
    const db = env.authenticatedContext('ana').firestore();
    await assertSucceeds(setDoc(doc(db, 'coaches/ana/players/p1'), { name: 'Juan' }));
    await assertSucceeds(setDoc(doc(db, 'coaches/ana/matches/m1/points/x'), { order: 1 }));
    await assertSucceeds(getDoc(doc(db, 'coaches/ana/matches/m1/emotions/e1')));
  });

  it('no accede a lo de otro entrenador', async () => {
    const db = env.authenticatedContext('luis').firestore();
    await assertFails(getDoc(doc(db, 'coaches/ana/players/p1')));
    await assertFails(setDoc(doc(db, 'coaches/ana/matches/m1/points/y'), { order: 2 }));
  });

  it('sin sesión no accede a nada', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'coaches/ana/players/p1')));
  });

  it('fuera de coaches todo está denegado', async () => {
    const db = env.authenticatedContext('ana').firestore();
    await assertFails(getDoc(doc(db, 'otra/cosa')));
  });
});
```

- [ ] **Step 8: Ejecutar las pruebas de reglas**

Run: `npm run test:rules`
Expected: PASS, 4 pruebas. El emulador necesita Java instalado; si falla con "Could not spawn java", instalar un JDK 17 o superior y repetir.

Para comprobar que las pruebas detectan un fallo: cambiar temporalmente la condición de `firestore.rules` por `if true`, ejecutar (deben fallar 3 pruebas) y restaurar.

- [ ] **Step 9: Crear `src/data/firebase.ts`**

```ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);

// Caché persistente: las escrituras se aplican en local y suben cuando hay red.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
```

- [ ] **Step 10: Publicar las reglas** (necesita `npx firebase login` del usuario la primera vez)

Run: `npx firebase deploy --only firestore:rules --project <projectId de .env.local>`
Expected: "Deploy complete!".

- [ ] **Step 11: Commit**

```bash
git add .env.example firebase.json firestore.rules vitest.rules.config.ts tests src/data/firebase.ts
git commit -m "Firebase, reglas de seguridad por entrenador y sus pruebas"
```

---

### Task 6: Acceso con Google

**Files:**
- Create: `src/data/auth.tsx`, `src/screens/LoginScreen.tsx`
- Modify: `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Crear `src/data/auth.tsx`**

```tsx
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth } from './firebase';

// undefined = todavía no se sabe; null = sin sesión
type AuthState = { user: User | null | undefined };

const Ctx = createContext<AuthState>({ user: undefined });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return <Ctx.Provider value={{ user }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

// App instalada en la pantalla de inicio (iOS expone `navigator.standalone`).
function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  // En la app instalada las ventanas emergentes pueden abrirse y no volver nunca: se usa redirección.
  if (isStandalone()) {
    await signInWithRedirect(auth, provider);
    return;
  }
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw e;
  }
}

export const signOutUser = () => signOut(auth);

// Errores de un acceso por redirección que acaba de volver a la app.
export const redirectError = () =>
  getRedirectResult(auth).then(
    () => null,
    (e: unknown) => (e instanceof Error ? e.message : 'No se pudo iniciar sesión'),
  );
```

- [ ] **Step 2: Crear `src/screens/LoginScreen.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { redirectError, signInWithGoogle } from '../data/auth';

export default function LoginScreen() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void redirectError().then((message) => {
      if (message) setError(message);
    });
  }, []);

  const enter = () => {
    setError(null);
    signInWithGoogle().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión');
    });
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Padel Mind &amp; Match</h1>
      <button onClick={enter} className="rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold active:brightness-125">
        Entrar con Google
      </button>
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Reemplazar `src/App.tsx`**

```tsx
import { useAuth, signOutUser } from './data/auth';
import LoginScreen from './screens/LoginScreen';

export default function App() {
  const { user } = useAuth();
  if (user === undefined) return <p className="p-6 text-slate-400">Cargando…</p>;
  if (user === null) return <LoginScreen />;
  return (
    <div className="p-6">
      <p>Sesión iniciada: {user.email}</p>
      <button onClick={() => void signOutUser()} className="mt-4 rounded-lg bg-slate-800 px-4 py-2">
        Cerrar sesión
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Envolver la app en `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './data/auth';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
```

- [ ] **Step 5: Verificar a mano**

Run: `npm run dev` y abrir http://localhost:5173.
Expected: aparece "Entrar con Google"; tras entrar se ve el correo; al recargar, la sesión se mantiene; "Cerrar sesión" vuelve a la pantalla de acceso.

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "Acceso con Google"
```

---

### Task 7: Capa de datos

**Files:**
- Create: `src/data/paths.ts`, `src/data/useQuery.ts`, `src/data/writeErrors.ts`, `src/data/mutations.ts`, `src/data/CoachData.tsx`, `src/components/WriteErrorBanner.tsx`

Regla de esta capa (spec §8): ninguna función espera a una escritura. Sin red, la promesa de escritura no se resuelve hasta recuperar conexión; la interfaz se actualiza desde las suscripciones. Los rechazos del servidor se capturan y se envían a `reportWriteError`.

- [ ] **Step 1: Crear `src/data/paths.ts`**

```ts
import { collection } from 'firebase/firestore';
import { db } from './firebase';

export const playersCol = (uid: string) => collection(db, 'coaches', uid, 'players');
export const pairsCol = (uid: string) => collection(db, 'coaches', uid, 'pairs');
export const matchesCol = (uid: string) => collection(db, 'coaches', uid, 'matches');
export const pointsCol = (uid: string, matchId: string) =>
  collection(db, 'coaches', uid, 'matches', matchId, 'points');
export const emotionsCol = (uid: string, matchId: string) =>
  collection(db, 'coaches', uid, 'matches', matchId, 'emotions');
```

- [ ] **Step 2: Crear `src/data/writeErrors.ts`**

```ts
import { useSyncExternalStore } from 'react';

let errors: string[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function reportWriteError(message: string) {
  errors = [...errors, message];
  emit();
}

export function clearWriteErrors() {
  errors = [];
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useWriteErrors = () => useSyncExternalStore(subscribe, () => errors);
```

- [ ] **Step 3: Crear `src/data/useQuery.ts`**

```ts
import { onSnapshot, type Query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { reportWriteError } from './writeErrors';

export type QueryState<T> = {
  data: T[];
  loading: boolean;
  pending: number;      // documentos con escrituras sin sincronizar
  hasPending: boolean;  // hay algún cambio sin sincronizar, incluidos borrados
};

// `q` debe venir de useMemo: una consulta nueva en cada render reiniciaría la suscripción.
export function useQuery<T>(q: Query): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({ data: [], loading: true, pending: 0, hasPending: false });

  useEffect(() => {
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        setState({
          data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T),
          loading: false,
          pending: snap.docs.filter((d) => d.metadata.hasPendingWrites).length,
          hasPending: snap.metadata.hasPendingWrites,
        });
      },
      (e) => {
        // Por ejemplo, reglas sin publicar: sin esto la app se quedaría en "Cargando…".
        reportWriteError(`No se pudieron leer los datos: ${e.message}`);
        setState((prev) => ({ ...prev, loading: false }));
      },
    );
  }, [q]);

  return state;
}
```

- [ ] **Step 4: Crear `src/data/mutations.ts`**

```ts
import { deleteDoc, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { EMOTION_LABEL, OUTCOME_LABEL } from '../domain/helpers';
import type { Emotion, EmotionTag, Match, MatchFormat, Outcome, Player, Point, Shot, Side } from '../domain/types';
import { db } from './firebase';
import { emotionsCol, matchesCol, pairsCol, playersCol, pointsCol } from './paths';
import { reportWriteError } from './writeErrors';

// Lanza la escritura sin esperarla y avisa si el servidor la rechaza.
function fire(write: Promise<void>, what: string) {
  write.catch(() => reportWriteError(`No se pudo guardar: ${what}`));
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
};

export function createMatch(uid: string, input: NewMatch): string {
  const ref = doc(matchesCol(uid));
  const now = Date.now();
  fire(
    setDoc(ref, { ...input, date: now, createdAt: now, mode: 'directo', status: 'in_progress' }),
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

export function setPointShot(uid: string, matchId: string, pointId: string, shot: Shot) {
  fire(updateDoc(doc(pointsCol(uid, matchId), pointId), { shot }), 'golpe del punto');
}

// Borra el punto y sus emociones en un lote (las transacciones no funcionan sin red).
export function undoPoint(uid: string, matchId: string, point: Point, emotions: Emotion[]) {
  const batch = writeBatch(db);
  batch.delete(doc(pointsCol(uid, matchId), point.id));
  for (const e of emotions) {
    if (e.afterPointId === point.id) batch.delete(doc(emotionsCol(uid, matchId), e.id));
  }
  fire(batch.commit(), 'deshacer el último punto');
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
  fire(deleteDoc(doc(emotionsCol(uid, matchId), emotionId)), 'borrar emoción');
}
```

- [ ] **Step 5: Crear `src/data/CoachData.tsx`**

Se suscribe al arrancar a jugadores, parejas y partidos, para que queden en la caché local y se pueda crear un partido sin red.

```tsx
import { orderBy, query } from 'firebase/firestore';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Match, Pair, Player } from '../domain/types';
import { matchesCol, pairsCol, playersCol } from './paths';
import { useQuery } from './useQuery';

type CoachData = { uid: string; players: Player[]; pairs: Pair[]; matches: Match[]; loading: boolean };

const Ctx = createContext<CoachData | null>(null);

export function CoachDataProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const players = useQuery<Player>(useMemo(() => query(playersCol(uid), orderBy('name')), [uid]));
  const pairs = useQuery<Pair>(useMemo(() => query(pairsCol(uid), orderBy('createdAt')), [uid]));
  const matches = useQuery<Match>(useMemo(() => query(matchesCol(uid), orderBy('date', 'desc')), [uid]));

  const value: CoachData = {
    uid,
    players: players.data,
    pairs: pairs.data,
    matches: matches.data,
    loading: players.loading || pairs.loading || matches.loading,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCoachData(): CoachData {
  const value = useContext(Ctx);
  if (!value) throw new Error('useCoachData se usa fuera de CoachDataProvider');
  return value;
}

export function playerName(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? '¿?';
}

export function pairName(players: Player[], ids: [string, string]): string {
  return `${playerName(players, ids[0])} / ${playerName(players, ids[1])}`;
}
```

- [ ] **Step 6: Crear `src/components/WriteErrorBanner.tsx`**

```tsx
import { clearWriteErrors, useWriteErrors } from '../data/writeErrors';

export default function WriteErrorBanner() {
  const errors = useWriteErrors();
  if (errors.length === 0) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-red-700 p-3 text-sm">
      {errors.map((e, i) => (
        <p key={i}>{e}</p>
      ))}
      <button onClick={clearWriteErrors} className="mt-2 rounded bg-red-900 px-3 py-1 font-bold">
        Entendido
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "Capa de datos: suscripciones, escrituras sin espera y aviso de rechazos"
```

---

### Task 8: Rutas, inicio y jugadores

**Files:**
- Create: `src/screens/HomeScreen.tsx`, `src/screens/PlayersScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Crear `src/screens/HomeScreen.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { signOutUser } from '../data/auth';
import { pairName, useCoachData } from '../data/CoachData';

export default function HomeScreen() {
  const { matches, players, loading } = useCoachData();

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">Partidos</h1>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {loading && <p className="text-slate-400">Cargando…</p>}
        {!loading && matches.length === 0 && <p className="text-slate-400">Todavía no hay partidos.</p>}
        {matches.map((m) => (
          <Link key={m.id} to={`/partido/${m.id}`} className="block rounded-xl bg-slate-800 p-4">
            <p className="font-bold">
              {pairName(players, m.playerIds)} vs {m.opponentsName}
            </p>
            <p className="text-sm text-slate-400">
              {new Date(m.date).toLocaleDateString('es-ES')} · {m.status === 'in_progress' ? 'En curso' : 'Terminado'}
            </p>
          </Link>
        ))}
      </div>

      <Link to="/nuevo" className="rounded-xl bg-blue-600 p-4 text-center text-lg font-bold">
        Nuevo partido
      </Link>
      <div className="flex gap-2">
        <Link to="/jugadores" className="flex-1 rounded-xl bg-slate-800 p-3 text-center">
          Jugadores
        </Link>
        <button onClick={() => void signOutUser()} className="flex-1 rounded-xl bg-slate-800 p-3">
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear `src/screens/PlayersScreen.tsx`**

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { pairName, useCoachData } from '../data/CoachData';
import { createPair, createPlayer, renamePlayer } from '../data/mutations';
import type { Player } from '../domain/types';

const SIDE_LABEL = { derecha: 'Derecha', reves: 'Revés' } as const;

export default function PlayersScreen() {
  const { uid, players, pairs } = useCoachData();
  const [name, setName] = useState('');
  const [side, setSide] = useState<Player['side']>(null);
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  const addPlayer = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createPlayer(uid, trimmed, side);
    setName('');
    setSide(null);
  };

  const rename = (p: Player) => {
    const next = window.prompt('Nombre del jugador', p.name)?.trim();
    if (next && next !== p.name) renamePlayer(uid, p.id, next);
  };

  const pairExists = pairs.some((p) => p.playerIds.includes(a) && p.playerIds.includes(b));
  const canPair = a !== '' && b !== '' && a !== b && !pairExists;

  const addPair = () => {
    if (!canPair) return;
    createPair(uid, a, b);
    setA('');
    setB('');
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4">
      <Link to="/" className="text-slate-400">← Partidos</Link>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Jugadores</h2>
        {players.map((p) => (
          <button key={p.id} onClick={() => rename(p)} className="flex w-full justify-between rounded-lg bg-slate-800 p-3 text-left">
            <span>{p.name}</span>
            <span className="text-slate-400">{p.side ? SIDE_LABEL[p.side] : ''}</span>
          </button>
        ))}
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
            className="min-w-0 flex-1 rounded-lg bg-slate-900 p-3"
          />
          <select
            value={side ?? ''}
            onChange={(e) => setSide(e.target.value === '' ? null : (e.target.value as Player['side']))}
            className="rounded-lg bg-slate-900 p-3"
          >
            <option value="">Lado</option>
            <option value="derecha">Derecha</option>
            <option value="reves">Revés</option>
          </select>
          <button onClick={addPlayer} className="rounded-lg bg-blue-600 px-4 font-bold">Añadir</button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Parejas</h2>
        {pairs.map((p) => (
          <p key={p.id} className="rounded-lg bg-slate-800 p-3">{pairName(players, p.playerIds)}</p>
        ))}
        <div className="flex gap-2">
          <select value={a} onChange={(e) => setA(e.target.value)} className="min-w-0 flex-1 rounded-lg bg-slate-900 p-3">
            <option value="">Jugador 1</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={b} onChange={(e) => setB(e.target.value)} className="min-w-0 flex-1 rounded-lg bg-slate-900 p-3">
            <option value="">Jugador 2</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={addPair} disabled={!canPair} className="rounded-lg bg-blue-600 px-4 font-bold disabled:opacity-40">
            Crear
          </button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Reemplazar `src/App.tsx`** (las rutas `/nuevo` y `/partido/:matchId` se añaden en las tareas 9 y 10)

```tsx
import { Route, Routes } from 'react-router-dom';
import WriteErrorBanner from './components/WriteErrorBanner';
import { useAuth } from './data/auth';
import { CoachDataProvider } from './data/CoachData';
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import PlayersScreen from './screens/PlayersScreen';

export default function App() {
  const { user } = useAuth();
  if (user === undefined) return <p className="p-6 text-slate-400">Cargando…</p>;
  if (user === null) return <LoginScreen />;
  return (
    <CoachDataProvider uid={user.uid}>
      <WriteErrorBanner />
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/jugadores" element={<PlayersScreen />} />
      </Routes>
    </CoachDataProvider>
  );
}
```

- [ ] **Step 4: Verificar a mano**

Run: `npm run dev`
Expected: en Jugadores se crean dos jugadores y una pareja; al recargar siguen ahí; tocar un jugador permite renombrarlo; no se puede crear una pareja repetida ni de un jugador consigo mismo.

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "Pantallas de inicio y de jugadores y parejas"
```

---

### Task 9: Nuevo partido

**Files:**
- Create: `src/screens/NewMatchScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Crear `src/screens/NewMatchScreen.tsx`**

```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { pairName, playerName, useCoachData } from '../data/CoachData';
import { createMatch } from '../data/mutations';
import type { MatchFormat, Side } from '../domain/types';

function Choice<T extends string>(props: {
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

export default function NewMatchScreen() {
  const { uid, players, pairs } = useCoachData();
  const navigate = useNavigate();
  const [pairId, setPairId] = useState('');
  const [leftPlayerId, setLeftPlayerId] = useState('');
  const [opponentsName, setOpponentsName] = useState('');
  const [deuce, setDeuce] = useState<MatchFormat['deuce']>('punto_de_oro');
  const [finalSet, setFinalSet] = useState<MatchFormat['finalSet']>('set_completo');
  const [firstServer, setFirstServer] = useState<Side>('us');

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

          <button onClick={start} disabled={!pair} className="w-full rounded-xl bg-green-700 p-4 text-lg font-bold disabled:opacity-40">
            Empezar partido
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Añadir la ruta en `src/App.tsx`**

Añadir el import `import NewMatchScreen from './screens/NewMatchScreen';` y, dentro de `<Routes>`, después de la ruta de jugadores:

```tsx
        <Route path="/nuevo" element={<NewMatchScreen />} />
```

- [ ] **Step 3: Verificar a mano**

Run: `npm run dev`
Expected: desde Inicio, "Nuevo partido" muestra el formulario; al elegir pareja se preselecciona en la izquierda el jugador de revés; "Empezar partido" navega a `/partido/<id>` (pantalla en blanco por ahora) y el partido aparece en Inicio como "En curso".

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "Pantalla de nuevo partido"
```

---

### Task 10: Pantalla de registro — marcador, botones y deshacer

**Files:**
- Create: `src/components/Scoreboard.tsx`, `src/components/SyncBadge.tsx`, `src/components/OutcomeButtons.tsx`, `src/screens/TrackerScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Crear `src/components/Scoreboard.tsx`**

```tsx
import { situationTag } from '../domain/helpers';
import type { MatchState } from '../domain/scoring';
import type { Side } from '../domain/types';

function Row(props: { name: string; side: Side; state: MatchState }) {
  const { state, side } = props;
  const s = state.situation;
  const pick = (v: { us: number; them: number }) => (side === 'us' ? v.us : v.them);
  return (
    <div className="flex items-center gap-3 py-1">
      <span className={`h-2.5 w-2.5 rounded-full ${s?.server === side ? 'bg-yellow-400' : 'bg-transparent'}`} />
      <span className="min-w-0 flex-1 truncate">{props.name}</span>
      {state.completedSets.map((set, i) => (
        <span key={i} className="w-6 text-center text-lg text-slate-400">{pick(set)}</span>
      ))}
      {s && (
        <>
          <span className="w-6 text-center text-lg font-bold">{side === 'us' ? s.gamesUs : s.gamesThem}</span>
          <span className="w-10 rounded bg-slate-900 text-center text-xl font-bold">
            {side === 'us' ? s.pointLabelUs : s.pointLabelThem}
          </span>
        </>
      )}
    </div>
  );
}

export default function Scoreboard(props: { usName: string; themName: string; state: MatchState }) {
  const tag = props.state.finished
    ? `PARTIDO TERMINADO · gana ${props.state.winner === 'us' ? props.usName : props.themName}`
    : situationTag(props.state.situation);
  return (
    <div className="flash rounded-xl bg-[#141b24] px-3 py-2">
      <Row name={props.usName} side="us" state={props.state} />
      <Row name={props.themName} side="them" state={props.state} />
      <p className="h-5 text-center text-xs font-bold text-yellow-400">{tag}</p>
    </div>
  );
}
```

- [ ] **Step 2: Crear `src/components/SyncBadge.tsx`**

```tsx
export default function SyncBadge(props: { hasPending: boolean; pendingPoints: number }) {
  if (!props.hasPending) return <p className="text-right text-xs text-slate-500">Todo guardado</p>;
  const text =
    props.pendingPoints > 0
      ? `${props.pendingPoints} ${props.pendingPoints === 1 ? 'punto' : 'puntos'} sin sincronizar`
      : 'Cambios sin sincronizar';
  return <p className="text-right text-xs text-amber-400">{text}</p>;
}
```

- [ ] **Step 3: Crear `src/components/OutcomeButtons.tsx`**

```tsx
import type { Outcome } from '../domain/types';

type Register = (outcome: Outcome, playerId: string | null) => void;

const BTN = 'rounded-xl font-bold text-white active:scale-95 active:brightness-125 disabled:opacity-30';

function PlayerColumn(props: { name: string; playerId: string; disabled: boolean; onRegister: Register }) {
  const { playerId, disabled, onRegister } = props;
  return (
    <div className="flex flex-1 flex-col gap-2">
      <p className="truncate text-center text-xs uppercase tracking-wide text-slate-400">{props.name}</p>
      <button disabled={disabled} onClick={() => onRegister('winner_nuestro', playerId)} className={`${BTN} h-16 bg-green-700`}>
        Winner
      </button>
      <button disabled={disabled} onClick={() => onRegister('no_forzado_nuestro', playerId)} className={`${BTN} h-16 bg-amber-700`}>
        No forzado
      </button>
      <button disabled={disabled} onClick={() => onRegister('forzado_nuestro', playerId)} className={`${BTN} h-16 bg-red-700`}>
        Forzado
      </button>
    </div>
  );
}

export default function OutcomeButtons(props: {
  left: { id: string; name: string };
  right: { id: string; name: string };
  disabled: boolean;
  onRegister: Register;
}) {
  const { disabled, onRegister } = props;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <PlayerColumn name={props.left.name} playerId={props.left.id} disabled={disabled} onRegister={onRegister} />
        <PlayerColumn name={props.right.name} playerId={props.right.id} disabled={disabled} onRegister={onRegister} />
      </div>
      <div className="flex gap-2">
        <button disabled={disabled} onClick={() => onRegister('error_rival', null)} className={`${BTN} h-14 flex-1 bg-green-700`}>
          Error rival
        </button>
        <button disabled={disabled} onClick={() => onRegister('winner_rival', null)} className={`${BTN} h-14 flex-1 bg-red-700`}>
          Winner rival
        </button>
      </div>
      <div className="flex gap-2">
        <button disabled={disabled} onClick={() => onRegister('nuestro_sin_detalle', null)} className={`${BTN} h-10 flex-1 bg-slate-700 text-sm`}>
          Punto nuestro
        </button>
        <button disabled={disabled} onClick={() => onRegister('rival_sin_detalle', null)} className={`${BTN} h-10 flex-1 bg-slate-700 text-sm`}>
          Punto rival
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Crear `src/screens/TrackerScreen.tsx`**

```tsx
import { orderBy, query } from 'firebase/firestore';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import OutcomeButtons from '../components/OutcomeButtons';
import Scoreboard from '../components/Scoreboard';
import SyncBadge from '../components/SyncBadge';
import { pairName, playerName, useCoachData } from '../data/CoachData';
import { addPoint, undoPoint } from '../data/mutations';
import { emotionsCol, pointsCol } from '../data/paths';
import { useQuery } from '../data/useQuery';
import { nextOrder } from '../domain/helpers';
import { computeMatchState } from '../domain/scoring';
import type { Emotion, Match, Outcome, Player, Point } from '../domain/types';

export default function TrackerScreen() {
  const { matchId } = useParams();
  const { uid, matches, players, loading } = useCoachData();
  const match = matches.find((m) => m.id === matchId);
  if (loading) return <p className="p-6 text-slate-400">Cargando…</p>;
  // Justo después de crear un partido puede tardar un instante en llegar a la lista local.
  if (!match) return <p className="p-6 text-slate-400">Abriendo partido… <Link to="/" className="underline">Volver</Link></p>;
  return <Tracker uid={uid} match={match} players={players} />;
}

function Tracker({ uid, match, players }: { uid: string; match: Match; players: Player[] }) {
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

  const leftId = match.leftPlayerId;
  const rightId = match.playerIds.find((id) => id !== leftId) ?? match.playerIds[1];
  const locked = state.finished || match.status === 'completed';

  const register = (outcome: Outcome, playerId: string | null) => {
    if (locked) return;
    addPoint(uid, match.id, { order: nextOrder(points), outcome, playerId });
  };

  const undo = () => {
    const last = points[points.length - 1];
    if (!last || match.status === 'completed') return;
    undoPoint(uid, match.id, last, emotions);
  };

  return (
    <div
      className="mx-auto flex h-full max-w-xl flex-col gap-2 p-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)', paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      <div className="flex items-center justify-between text-sm text-slate-400">
        <Link to="/">← Partidos</Link>
      </div>

      <Scoreboard
        key={points.length}
        usName={pairName(players, match.playerIds)}
        themName={match.opponentsName}
        state={state}
      />
      <SyncBadge hasPending={pointsQ.hasPending || emotionsQ.hasPending} pendingPoints={pointsQ.pending} />

      <div className="flex-1" />

      <OutcomeButtons
        left={{ id: leftId, name: playerName(players, leftId) }}
        right={{ id: rightId, name: playerName(players, rightId) }}
        disabled={locked}
        onRegister={register}
      />

      <div className="flex gap-2">
        <button
          onClick={undo}
          disabled={points.length === 0 || match.status === 'completed'}
          className="h-12 flex-1 rounded-xl bg-slate-800 font-bold active:brightness-125 disabled:opacity-30"
        >
          ↶ Deshacer
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Añadir la ruta en `src/App.tsx`**

Añadir el import `import TrackerScreen from './screens/TrackerScreen';` y, dentro de `<Routes>`:

```tsx
        <Route path="/partido/:matchId" element={<TrackerScreen />} />
```

- [ ] **Step 6: Verificar a mano**

Run: `npm run dev`, abrir un partido en curso con el navegador en tamaño de móvil (herramientas de desarrollo, modo dispositivo, iPhone en vertical).
Expected:
- Cuatro toques en "Winner" de un jugador: 15, 30, 40 y juego; los juegos pasan a 1-0 y el punto amarillo de saque cambia de fila.
- Con 0-40 al saque propio aparece "BOLA DE BREAK · rival".
- "Deshacer" retrocede un punto cada vez, también a través de un cambio de juego.
- El marcador destella con cada punto.
- Con la red desactivada en las herramientas de desarrollo (Network → Offline) se siguen registrando puntos y aparece "N puntos sin sincronizar"; al reactivarla vuelve a "Todo guardado".
- Recargar la página conserva el marcador.

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "Pantalla de registro: marcador, botones por jugador y deshacer"
```

---

### Task 11: Pantalla de registro — golpes, emociones, cambio de lado, finalizar y pantalla encendida

**Files:**
- Create: `src/components/ShotRow.tsx`, `src/components/EmotionSheet.tsx`, `src/hooks/useWakeLock.ts`
- Modify: `src/screens/TrackerScreen.tsx`

- [ ] **Step 1: Crear `src/components/ShotRow.tsx`**

```tsx
import { SHOTS, SHOT_LABEL } from '../domain/helpers';
import type { Shot } from '../domain/types';

export default function ShotRow(props: { onPick: (shot: Shot) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-center text-xs text-slate-400">¿Con qué golpe? (opcional)</p>
      <div className="grid grid-cols-4 gap-2">
        {SHOTS.map((shot) => (
          <button
            key={shot}
            onClick={() => props.onPick(shot)}
            className="h-11 rounded-lg bg-slate-700 text-sm font-semibold active:brightness-125"
          >
            {SHOT_LABEL[shot]}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear `src/components/EmotionSheet.tsx`**

```tsx
import { useState } from 'react';
import { EMOTION_GRID, EMOTION_LABEL, POSITIVE_EMOTIONS } from '../domain/helpers';
import type { EmotionTag } from '../domain/types';

export default function EmotionSheet(props: {
  players: { id: string; name: string }[];
  onPick: (playerId: string, tag: EmotionTag) => void;
  onClose: () => void;
}) {
  const [playerId, setPlayerId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60" onClick={props.onClose}>
      <div
        className="space-y-3 rounded-t-2xl bg-slate-900 p-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-sm text-slate-400">¿De quién?</p>
        <div className="flex gap-2">
          {props.players.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlayerId(p.id)}
              className={`h-14 flex-1 rounded-xl font-bold ${playerId === p.id ? 'bg-blue-600' : 'bg-slate-700'}`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {EMOTION_GRID.map((tag) => (
            <button
              key={tag}
              disabled={playerId === null}
              onClick={() => playerId && props.onPick(playerId, tag)}
              className={`h-16 rounded-xl px-1 text-sm font-semibold leading-tight disabled:opacity-30 ${
                POSITIVE_EMOTIONS.includes(tag) ? 'bg-green-800' : 'bg-red-900'
              }`}
            >
              {EMOTION_LABEL[tag]}
            </button>
          ))}
        </div>
        <button onClick={props.onClose} className="h-12 w-full rounded-xl bg-slate-800">
          Cancelar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Crear `src/hooks/useWakeLock.ts`**

```ts
import { useEffect } from 'react';

// Mantiene la pantalla encendida mientras el componente esté montado.
export function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release();
      } catch {
        // El sistema puede negarlo (batería baja); la app sigue funcionando sin él.
      }
    };

    // El sistema libera el bloqueo al ocultar la app; se vuelve a pedir al regresar.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, []);
}
```

- [ ] **Step 4: Reemplazar el componente `Tracker` en `src/screens/TrackerScreen.tsx`**

Sustituir las importaciones del archivo por:

```tsx
import { orderBy, query } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import EmotionSheet from '../components/EmotionSheet';
import OutcomeButtons from '../components/OutcomeButtons';
import Scoreboard from '../components/Scoreboard';
import ShotRow from '../components/ShotRow';
import SyncBadge from '../components/SyncBadge';
import { pairName, playerName, useCoachData } from '../data/CoachData';
import { addEmotion, addPoint, setPointShot, undoPoint, updateMatch } from '../data/mutations';
import { emotionsCol, pointsCol } from '../data/paths';
import { useQuery } from '../data/useQuery';
import { nextOrder } from '../domain/helpers';
import { computeMatchState } from '../domain/scoring';
import type { Emotion, EmotionTag, Match, Outcome, Player, Point, Shot } from '../domain/types';
import { useWakeLock } from '../hooks/useWakeLock';
```

`TrackerScreen` (el componente exportado) no cambia. Sustituir la función `Tracker` entera por:

```tsx
const SHOT_ROW_MS = 4000;

function Tracker({ uid, match, players }: { uid: string; match: Match; players: Player[] }) {
  useWakeLock();
  const navigate = useNavigate();
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

  // Punto para el que se ofrece la fila de golpes; null si no se muestra.
  const [shotFor, setShotFor] = useState<string | null>(null);
  const [emotionOpen, setEmotionOpen] = useState(false);

  useEffect(() => {
    if (!shotFor) return;
    const timer = setTimeout(() => setShotFor(null), SHOT_ROW_MS);
    return () => clearTimeout(timer);
  }, [shotFor]);

  const leftId = match.leftPlayerId;
  const rightId = match.playerIds.find((id) => id !== leftId) ?? match.playerIds[1];
  const closed = match.status === 'completed';
  const locked = state.finished || closed;
  const lastPoint = points[points.length - 1];

  const register = (outcome: Outcome, playerId: string | null) => {
    if (locked) return;
    const id = addPoint(uid, match.id, { order: nextOrder(points), outcome, playerId });
    // Solo los puntos de nuestra pareja con jugador ofrecen elegir golpe.
    setShotFor(playerId ? id : null);
  };

  const pickShot = (shot: Shot) => {
    if (shotFor) setPointShot(uid, match.id, shotFor, shot);
    setShotFor(null);
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
    navigate('/');
  };

  return (
    <div
      className="mx-auto flex h-full max-w-xl flex-col gap-2 p-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)', paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      <div className="flex items-center justify-between text-sm text-slate-400">
        <Link to="/">← Partidos</Link>
        {!closed && (
          <div className="flex gap-4">
            <button onClick={swapSides}>⇄ Cambiar lados</button>
            <button onClick={finish} className={state.finished ? 'font-bold text-green-400' : ''}>
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
      <SyncBadge hasPending={pointsQ.hasPending || emotionsQ.hasPending} pendingPoints={pointsQ.pending} />

      <div className="flex flex-1 flex-col justify-end">
        {closed && <p className="text-center text-slate-400">Partido cerrado.</p>}
        {shotFor && !closed && <ShotRow onPick={pickShot} />}
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

- [ ] **Step 5: Verificar a mano**

Run: `npm run dev`, partido en curso, tamaño de móvil.
Expected:
- Tras "Winner", "No forzado" o "Forzado" aparece la fila de golpes; desaparece sola a los 4 segundos, al tocar un golpe o al registrar otro punto. Tras "Error rival", "Winner rival" o los botones sin detalle no aparece.
- En la consola de Firebase, el documento del punto tiene `shot` con el valor elegido, o `null` si se ignoró.
- "Emoción" abre el panel; hasta elegir jugador las etiquetas están desactivadas; al elegir etiqueta se cierra y se crea un documento en `emotions` con `afterPointId` igual al id del último punto.
- "Deshacer" tras anotar una emoción borra el punto y esa emoción.
- "Cambiar lados" intercambia las columnas y se mantiene al recargar.
- "Finalizar partido" pide confirmación, vuelve a Inicio y el partido aparece como "Terminado"; al reabrirlo los botones están desactivados.

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "Registro: golpes opcionales, emociones, cambio de lado, finalizar y pantalla encendida"
```

---

### Task 12: PWA y despliegue

**Files:**
- Create: `public/icon.svg`, `vercel.json`
- Modify: `vite.config.ts`, `index.html`

- [ ] **Step 1: Crear `public/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0b0f14"/>
  <circle cx="256" cy="256" r="150" fill="#d4e157"/>
  <path d="M130 180 Q256 256 130 332" fill="none" stroke="#0b0f14" stroke-width="14"/>
  <path d="M382 180 Q256 256 382 332" fill="none" stroke="#0b0f14" stroke-width="14"/>
</svg>
```

- [ ] **Step 2: Generar los iconos PNG**

Run: `npx @vite-pwa/assets-generator --preset minimal-2023 public/icon.svg`
Expected: crea en `public/` los archivos `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png` y `favicon.ico`. Si los nombres generados difieren, usar los nombres reales en los pasos 3 y 4.

- [ ] **Step 3: Reemplazar `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'Padel Mind & Match',
        short_name: 'PadelMind',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0f14',
        theme_color: '#0b0f14',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        // Las rutas de autenticación de Firebase no deben servirse desde la caché de la app.
        navigateFallbackDenylist: [/^\/__\//],
      },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
});
```

- [ ] **Step 4: Añadir en el `<head>` de `index.html`**, después de la etiqueta `<title>`:

```html
    <link rel="icon" href="/favicon.ico" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
```

- [ ] **Step 5: Crear `vercel.json`**

Sustituir `PROJECT_ID` por el `projectId` de `.env.local`. Antes de darlo por bueno, consultar en la documentación de Firebase la página "Best practices for using signInWithRedirect on browsers that block third-party storage access" (opción de proxy inverso hacia `firebaseapp.com`) y comprobar si hay que redirigir alguna ruta más bajo `/__/` además de `/__/auth/`; si la hay, añadirla con la misma forma. La primera regla hace que el acceso con Google use el mismo dominio que la app, necesario para que funcione en la app instalada en iOS.

```json
{
  "rewrites": [
    { "source": "/__/auth/:path*", "destination": "https://PROJECT_ID.firebaseapp.com/__/auth/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 6: Verificar la compilación y el modo sin red en el ordenador**

Run: `npm run build`
Expected: sin errores; `dist/` contiene `sw.js` y `manifest.webmanifest`.

Run: `npm run preview`, abrir la URL que indique, entrar, recargar una vez, activar Offline en las herramientas de desarrollo y recargar.
Expected: la app se abre sin red con la sesión iniciada. Si las tareas 7–10 ya están hechas, además muestra los partidos y permite registrar puntos.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "PWA instalable y configuración de despliegue en Vercel"
```

- [ ] **Step 8 (usuario): Publicar**

1. Crear un repositorio en GitHub y subir la rama `main`.
2. En Vercel, importar el repositorio (framework: Vite).
3. En Vercel → Settings → Environment Variables, añadir las cuatro variables de `.env.local`, con una diferencia: `VITE_FIREBASE_AUTH_DOMAIN` debe ser el dominio de la app en Vercel (por ejemplo `padel-mind-match.vercel.app`), no el de `firebaseapp.com`. Volver a desplegar.
4. En Firebase → Authentication → Settings → Authorized domains, añadir el dominio de Vercel.
5. En Google Cloud Console → APIs y servicios → Credenciales → cliente OAuth web del proyecto, añadir a "URIs de redireccionamiento autorizados": `https://<dominio de Vercel>/__/auth/handler`.

Expected: abrir el dominio de Vercel en un navegador de escritorio y entrar con Google funciona.

---

### Task 13: Comprobaciones en iPhone real

Requieren al usuario con su iPhone. No se da el tramo por terminado hasta registrar el resultado de cada una en `docs/superpowers/plans/2026-11-15-tramo-1-comprobaciones.md` (fecha, versión de iOS, resultado).

- [ ] **Step 1: Acceso desde la app instalada**

En Safari, abrir el dominio de Vercel → Compartir → "Añadir a pantalla de inicio". Abrir la app desde el icono y entrar con Google.
Expected: se inicia sesión y se vuelve a la app instalada.
Si falla: no seguir con otras comprobaciones; sustituir el acceso por correo y contraseña (`signInWithEmailAndPassword`, activando ese método en Firebase) en una tarea aparte y repetir.

- [ ] **Step 2: Arranque y registro sin red**

Con sesión iniciada y un partido creado, cerrar la app, activar el modo avión y abrirla desde el icono. Crear un partido nuevo y registrar 20 puntos, dos emociones y tres "Deshacer".
Expected: todo funciona; el indicador muestra puntos sin sincronizar. Al desactivar el modo avión con la app abierta pasa a "Todo guardado" y los datos aparecen en la consola de Firebase.

- [ ] **Step 3: Supervivencia de datos sin sincronizar**

En modo avión, registrar 10 puntos, cerrar la app deslizándola fuera, y no abrirla durante 3 días. Después, con red, abrirla.
Expected: los 10 puntos están y se sincronizan.
Si se pierden: detener el tramo y replantear el almacenamiento local antes de usar la app en un partido real.

- [ ] **Step 4: Pantalla encendida**

Con el bloqueo automático del iPhone en 30 segundos, dejar la pantalla de registro abierta 2 minutos sin tocar.
Expected: la pantalla no se apaga. Si se apaga, anotar la versión de iOS; solución provisional: desactivar el bloqueo automático durante los partidos.

- [ ] **Step 5: Uso con una mano**

Registrar un set completo de un partido real o de un vídeo, con el pulgar.
Expected: se alcanzan todos los botones sin cambiar el agarre y no hay toques accidentales frecuentes. Anotar cualquier botón que cueste alcanzar o que se pulse por error, para ajustar tamaños.

- [ ] **Step 6: Commit del registro de comprobaciones**

```bash
git add docs/superpowers/plans/2026-11-15-tramo-1-comprobaciones.md
git commit -m "Resultados de las comprobaciones del tramo 1 en iPhone"
```

---

## Cobertura de la spec (tramo 1)

| Requisito | Tarea |
|---|---|
| Stack y PWA instalable | 1, 12 |
| Modelo de datos bajo `coaches/{uid}` | 2, 7 |
| Reglas de seguridad y sus pruebas | 5 |
| Motor de marcador con pruebas | 3 |
| Acceso con Google | 6 |
| Suscripción de arranque a jugadores, parejas y partidos | 7 |
| Escrituras sin espera; deshacer en lote; aviso de rechazos | 7 |
| Jugadores y parejas | 8 |
| Nuevo partido con formato y saque | 9 |
| Registro por jugador, botones "sin detalle", marcador, saque, situación | 10 |
| Indicador de sincronización | 10 |
| Deshacer | 10, 11 |
| Fila de golpes de 4 s | 11 |
| Emociones ligadas a punto y jugador | 11 |
| Cambio de lado, finalizar partido, pantalla encendida | 11 |
| Reanudar un partido en curso | 8 (lista) y 10 (se recalcula al abrir) |
| Comprobaciones tempranas en iPhone | 13 |

Fuera de este plan, por pertenecer a otros tramos: informe y exportación (tramo 2); modo vídeo, zona, edición de datos del partido y revisión punto por punto (tramo 3). La edición de parejas ya creadas no se incluye: no hay caso de uso en el MVP.
