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
