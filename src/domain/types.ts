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
