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
